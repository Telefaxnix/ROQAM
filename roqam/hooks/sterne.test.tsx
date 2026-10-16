// /stars (Vorgabe 15.10.2026): blendet Himmel und Wetter in der Leiste aus und wieder ein, im Cockpit und im
// Sondermodus; das Schreibtempo bleibt (seit 15.10.2026 vor der Aufnahme). Ausgeschaltet ruhen die Abrufe (Wetter, Wolken, Seeing), eingeschaltet wird sofort
// neu geholt. Der Schalter steht im $.store und gilt in allen Chats.
import { expect, mock, test } from 'claude-code/testing'

type Body = Extract<Parameters<typeof test>[1], (...a: never[]) => unknown>
type On = Parameters<Body>[1]
type Engine = Parameters<Body>[0]

const T0 = Date.parse('2026-10-07T10:00:00Z')
// Himmel- und Wetterabrufe (die Ortssuche zählt nicht)
const himmelAbruf = (u: string) => u.includes('7timer') || u.includes('api.open-meteo.com/v1/forecast')

function basis(on: On, store: Record<string, unknown>, angemeldet: string[]) {
  const abrufe: string[] = []
  mock.store(on, store)
  mock.env(on, { USERPROFILE: 'C:/U' })
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 1000, window: 200000, percent: 0 }, rateLimits: [] } }) as never)
  on('command.register', ($, e) => {
    angemeldet.push((e as { name: string }).name)
    return { value: {} } as never
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }) as never)
  on('tool.list', () => ({ value: [] }) as never)
  on('agent.list', () => ({ value: [] }) as never)
  on('process.run', () => ({ value: { stdout: '', stderr: '', exitCode: 0 } }) as never)
  on('fs.write', () => ({ value: undefined }) as never)
  on('fs.read', () => {
    throw new Error('nope')
  })
  on('fs.list', () => ({ value: [] }) as never)
  on('http.fetch', ($, e) => {
    abrufe.push(e.url)
    if (!e.url.includes('geocoding-api')) throw new Error('offline')
    return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ results: [{ name: 'Bern', latitude: 46.95, longitude: 7.45 }] }) } } as never
  })
  // Werte, die die Leiste zeichnet (Nacht, Wetter, Tempo)
  const nacht = { level: 'gut', start: T0 + 8 * 3600000, end: T0 + 18 * 3600000, offset: 7200, cloud: 0, seeing: 1, moon: 100, isWaxing: true }
  on('state.get', { plugin: 'roqam', key: 'nacht' }, () => ({ value: { value: nacht, version: 1 } }) as never)
  on('state.get', { plugin: 'roqam', key: 'wetter' }, () => ({ value: { value: { temp: 12.3, dewPoint: 8.1, hum: 76 }, version: 1 } }) as never)
  on('state.get', { plugin: 'roqam', key: 'tempo' }, () => ({ value: { value: { tps: 61.6 }, version: 1 } }) as never)
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  return abrufe
}
async function leiste($: Engine, surface: 'desktop' | 'terminal'): Promise<string> {
  const ui = await $.ui.mount({ plugin: 'roqam', surface, component: 'AbovePrompt', props: { bodyColumns: 160 }, viewport: { columns: 160, rows: 40 } } as never)
  const baum = JSON.stringify(await ui.drawn())
  await ui.unmount()
  return baum
}
const stars = async ($: Engine) => JSON.stringify(await $.command.run({ command: 'stars', args: '' } as never))

test('/stars: angemeldet; aus blendet Himmel und Wetter aus (Tempo bleibt), Abrufe ruhen; ein holt sofort neu', { options: { location: 'Bern' } }, async ($, on) => {
  const uhr = mock.clock(on, { now: T0 })
  const angemeldet: string[] = []
  const abrufe = basis(on, {}, angemeldet)
  await $.session.start({ cwd: 'C:/P', surface: 'desktop', isInteractive: true })
  await uhr.advance(1000)
  expect(angemeldet).toContain('stars')
  expect(abrufe.some(himmelAbruf)).toBe(true)
  for (const surface of ['desktop', 'terminal'] as const) expect(await leiste($, surface)).toContain('Seeing:')
  // aus
  expect(await stars($)).toContain('hidden')
  abrufe.length = 0
  await uhr.advance(61 * 60 * 1000)
  expect(abrufe.filter(himmelAbruf)).toEqual([])
  for (const surface of ['desktop', 'terminal'] as const) {
    const b = await leiste($, surface)
    for (const teil of ['Seeing:', '☁', '★', '🌡', 'TP', '💧']) expect(`${surface}: ${b.includes(teil)} ${teil}`).toBe(`${surface}: false ${teil}`)
    expect(b).toContain('62 t/s')
  }
  // wieder ein: sofort neu holen, Zeile wieder da
  expect(await stars($)).toContain('shown')
  await uhr.settle()
  expect(abrufe.some(himmelAbruf)).toBe(true)
  expect(await leiste($, 'desktop')).toContain('Seeing:')
})

test('/stars gespeichert aus (anderer Chat, Neustart): keine Himmelabrufe beim Start, Sondermodus ohne Himmel, mit Tempo', { options: { location: 'Bern' } }, async ($, on) => {
  const uhr = mock.clock(on, { now: T0 })
  const angemeldet: string[] = []
  const abrufe = basis(on, { 'sterne-aus': true, sondermodus: true }, angemeldet)
  await $.session.start({ cwd: 'C:/P', surface: 'desktop', isInteractive: true })
  await uhr.advance(1000)
  expect(abrufe.filter(himmelAbruf)).toEqual([])
  for (const surface of ['desktop', 'terminal'] as const) {
    const b = await leiste($, surface)
    // das Tempo steht seit 15.10.2026 in BEFEHLE vor REC; ohne Himmel bleibt SENSOREN leer und fällt weg
    expect(b).not.toContain('SENSORS')
    expect(b).not.toContain('Seeing:')
    expect(b).not.toContain('☁')
    expect(b).toContain('62 t/s')
  }
})
