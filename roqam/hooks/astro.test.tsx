// Astro-Zeile als Gimmick (Vorgabe 14.10.2026): fest eingebaut, sobald ein Ort gesetzt ist; Zeichen statt Wörter, Mond in
// zwölf Stufen (App als Bild, Konsole als Emoji); Stream-Tempo am Zeilenende. Jeder Test zeigte am alten Stand das alte
// Verhalten (Astro nur mit Schalter, Wörter «Seeing:», «Temp:», kein Tempo).
import { expect, mock, test } from 'claude-code/testing'

type Fn = Parameters<typeof test>[1]
type On = Parameters<Fn>[1]
type Engine = Parameters<Fn>[0]

const T0 = Date.parse('2026-10-07T10:00:00Z')

// Grundmocks für session.start; http.fetch antwortet je Adresse, alle Abrufe werden gesammelt
function basis(on: On, netz: (url: string) => string | undefined) {
  const abrufe: string[] = []
  mock.store(on)
  mock.env(on, { USERPROFILE: 'C:/U' })
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 1000, window: 200000, percent: 0 }, rateLimits: [] } }) as never)
  on('command.register', () => ({ value: {} }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }) as never)
  on('tool.list', () => ({ value: [] }) as never)
  on('process.run', () => ({ value: { stdout: '', stderr: '', exitCode: 0 } }) as never)
  on('fs.write', () => ({ value: undefined }) as never)
  on('fs.read', () => {
    throw new Error('nope')
  })
  on('fs.list', () => ({ value: [] }) as never)
  on('http.fetch', ($, e) => {
    abrufe.push(e.url)
    const text = netz(e.url)
    if (text === undefined) throw new Error('offline')
    return { value: { status: 200, ok: true, headers: {}, text } } as never
  })
  unten(on)
  return abrufe
}

// an Stelle der Engine unter dem Mod: ein leerer Kasten
function unten(on: On) {
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
}

async function leiste($: Engine, surface: 'desktop' | 'terminal'): Promise<string> {
  const ui = await $.ui.mount({ plugin: 'roqam', surface, component: 'AbovePrompt', props: { bodyColumns: 160 }, viewport: { columns: 160, rows: 40 } })
  const baum = JSON.stringify(await ui.drawn())
  await ui.unmount()
  return baum
}

test('Astro fest eingebaut: mit Ort holt das Cockpit Wolken und Seeing ohne eigenen Schalter', { options: { location: 'Bern' } }, async ($, on) => {
  const uhr = mock.clock(on, { now: T0 })
  const abrufe = basis(on, url => (url.includes('geocoding-api') ? JSON.stringify({ results: [{ name: 'Bern', latitude: 46.95, longitude: 7.45 }] }) : undefined))
  await $.session.start({ cwd: 'C:/P', surface: 'desktop', isInteractive: true })
  await uhr.advance(1000)
  expect(abrufe.some(u => u.includes('7timer'))).toBe(true)
  expect(abrufe.some(u => u.includes('hourly=cloud_cover'))).toBe(true)
})

test('Ort leer: keine Abrufe für Himmel und Wetter', { options: { location: '' } }, async ($, on) => {
  const uhr = mock.clock(on, { now: T0 })
  const abrufe = basis(on, () => undefined)
  await $.session.start({ cwd: 'C:/P', surface: 'desktop', isInteractive: true })
  await uhr.advance(1000)
  expect(abrufe.filter(u => u.includes('open-meteo') || u.includes('7timer'))).toEqual([])
})

test('Astro-Zeile ohne Wörter: App mit Mond-Bild, Konsole mit Mond-Emoji, Tempo am Ende', { options: { location: 'Bern' } }, async ($, on) => {
  mock.clock(on, { now: T0 })
  unten(on)
  const nacht = { level: 'gut', start: T0 + 8 * 3600000, end: T0 + 18 * 3600000, offset: 7200, cloud: 0, seeing: 1, moon: 100, isWaxing: true }
  on('state.get', { plugin: 'roqam', key: 'nacht' }, () => ({ value: { value: nacht, version: 1 } }) as never)
  on('state.get', { plugin: 'roqam', key: 'wetter' }, () => ({ value: { value: { temp: 12.3, dewPoint: 8.1, hum: 76 }, version: 1 } }) as never)
  on('state.get', { plugin: 'roqam', key: 'tempo' }, () => ({ value: { value: { tps: 61.6 }, version: 1 } }) as never)
  const app = await leiste($, 'desktop')
  const konsole = await leiste($, 'terminal')
  for (const baum of [app, konsole]) {
    for (const wort of ['Wolken:', 'Mond:', 'Dunkel:', 'Temp:', 'TP:', 'Feuchte:']) expect(baum).not.toContain(wort)
    // einziges Wort: «Seeing:» vor dem Punkt, damit man weiss, wofür er steht (Vorgabe 14.10.2026, jedes Design)
    expect(baum).toContain('Seeing:')
    for (const teil of ['☁', '★', '🌡', 'TP', '💧', '⚡', '62 t/s']) expect(baum).toContain(teil)
    // klarer Himmel, bestes Seeing, aber Vollmond (Stufe 4) und TP 4.2° unter der Temperatur: gelbgrün (Ampel aus allen
    // Werten, 14.10.2026)
    expect(baum).toContain('#CCE806')
  }
  // Vollmond = Stufe 6: in der App ein Bild, in der Konsole 🌕 (die Konsole zeichnet Svg leer)
  expect(app).toContain('Moon, step 6 of 12')
  expect(app).not.toContain('🌕')
  expect(konsole).toContain('🌕')
  expect(konsole).not.toContain('Moon, step')
  // Beleuchtung in Prozent rechts neben Bild bzw. Emoji, mit geschütztem Leerschlag, vor der dunklen Zeit (Vorgabe
  // 14.10.2026: fehlte seit dem Astro-Umbau)
  const mondApp = app.indexOf('Moon, step 6 of 12')
  expect(app.indexOf(' 100.0%')).toBeGreaterThan(mondApp)
  expect(app.indexOf(' 100.0%')).toBeLessThan(app.indexOf('★'))
  const mondKonsole = konsole.indexOf('🌕 ')
  expect(mondKonsole).toBeGreaterThan(-1)
  expect(konsole.indexOf('100.0%')).toBeGreaterThan(mondKonsole)
  expect(konsole.indexOf('100.0%')).toBeLessThan(konsole.indexOf('★'))
})

test('Stream-Tempo: Hauptchat misst Tokens je Sekunde ab dem ersten Stück, ein Unteragent nicht', async ($, on) => {
  const uhr = mock.clock(on, { now: T0 })
  mock.store(on)
  mock.env(on, { USERPROFILE: 'C:/U' })
  on('session.model', () => ({ value: 'claude-opus-5-5' }) as never)
  // an Stelle der Engine: State im Speicher, damit der Test lesen kann, was der Mod schreibt
  const speicher: Record<string, { value: unknown; version: number }> = {}
  for (const key of ['data', 'tempo'] as const) {
    on('state.get', { plugin: 'roqam', key }, () => ({ value: speicher[key] ?? { value: undefined, version: 0 } }) as never)
    on('state.set', { plugin: 'roqam', key }, ($, e) => {
      const version = (speicher[key]?.version ?? 0) + 1
      speicher[key] = { value: (e as { value: unknown }).value, version }
      return { value: { isSet: true, version } } as never
    })
  }
  // an Stelle des Modells: 3 s bis zum ersten Stück (zählt nicht), dann 10 s Stream mit 480 Ausgabe-Tokens
  on('turn.step', async function* ($, e) {
    await uhr.advance(3000)
    yield { kind: 'text', index: 0, text: 'Hallo' } as never
    await uhr.advance(10000)
    yield { kind: 'text', index: 0, text: ' Welt' } as never
    const usage = { input_tokens: 10, output_tokens: 480, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, model: 'claude-opus-5-5' }
    return { turnId: e.turnId, index: e.index, answer: 'Hallo Welt', toolUses: [], stopReason: 'end_turn', usage } as never
  })
  const schritt = async (agentId?: string) => {
    const s = $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', messageCount: 1, ...(agentId ? { agentId } : {}) })
    const texte: string[] = []
    for await (const stueck of s) texte.push(String((stueck as { text?: string }).text))
    await s.result
    return texte
  }
  const tps = () => (speicher.tempo?.value as { tps?: number } | undefined)?.tps

  expect(await schritt('agent-1'), 'Stücke gehen unverändert weiter').toEqual(['Hallo', ' Welt'])
  expect(tps(), 'Unteragent misst nicht').toBeUndefined()
  await schritt()
  expect(tps(), '480 Tokens in 10 s').toBe(48)
})
