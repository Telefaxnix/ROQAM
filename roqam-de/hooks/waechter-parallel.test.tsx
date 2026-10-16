// Bündel F3 (09.10.2026): Wächter bricht nur die eigene Antwort ab und behält bei parallelen Aufrufen den ältesten
// laufenden Schritt im Blick.
import { expect, mock, test } from 'claude-code/testing'

import { LANG_MS, waechterText } from './waechter'

type On = Parameters<Parameters<typeof test>[1]>[1]
type Engine = Parameters<Parameters<typeof test>[1]>[0]
const T0 = Date.parse('2026-10-07T10:00:00Z')
const MIN = 60 * 1000

// Grundmocks: session.start läuft durch, nichts im Netz, keine Dateien
function basis(on: On) {
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
  on('http.fetch', () => {
    throw new Error('offline')
  })
  on('turn.start', ($, e) => ({ turnId: e.turnId }) as never)
  on('turn.complete', ($, e) => ({ text: (e as { answer: string }).answer }) as never)
  on('model.complete', () => ({ value: { isAnswered: true, text: '-' } }) as never)
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
}

// Rückfrage wie der Mensch beantworten; mit halten() bleibt sie so lange offen
function antworte(on: On, fragen: string[], antwort: string, halten?: () => Promise<void>) {
  on('tool.call', { tool: 'AskUserQuestion' }, async ($, e) => {
    const q = (e as unknown as { questions: { question: string }[] }).questions[0].question
    fragen.push(q)
    if (halten) await halten()
    return { result: { questions: [], answers: { [q]: antwort } } }
  })
}

const MOUNT = { plugin: 'roqam-de', surface: 'desktop', component: 'AbovePrompt', props: { bodyColumns: 160 }, viewport: { columns: 160, rows: 40 } } as const
async function leiste($: Engine) {
  const ui = await $.ui.mount(MOUNT)
  const t = JSON.stringify(await ui.drawn())
  await ui.unmount()
  return t
}
const wachtZeile = (t: string) => /⏱  ([^"]*)/.exec(t)?.[1]

test('F3-B1: offene Lange-Schritt-Frage bricht nach einem Antwortwechsel nicht die neue Antwort ab', async ($, on) => {
  const uhr = mock.clock(on, { now: T0 })
  basis(on)
  const fragen: string[] = []
  // die Frage (bei 4:00) bleibt 10 s offen, dann «Abbrechen»; der Schritt endet erst danach. Kurze Zeiten, weil jede
  // simulierte Minute die 5-s-Takte des Mods zwölfmal auslöst (10 min brauchten 4,4–5 s bei 5 s Zeitlimit).
  let beantwortet = false
  antworte(on, fragen, 'Abbrechen', async () => {
    await uhr.sleep(10 * 1000)
    beantwortet = true
  })
  on('tool.call', { tool: 'Bash' }, async () => {
    await uhr.sleep(4 * MIN + 30 * 1000)
    return { result: 'fertig' }
  })
  const abgebrochen: string[] = []
  on('turn.abort', ($, e) => {
    abgebrochen.push(e.turnId)
    return { value: undefined } as never
  })
  await $.session.start({ cwd: 'C:/P', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'Erste Arbeit', turnId: 't1' })
  const lauf = $.tool.call({ tool: 'Bash', command: 'sleep 270' } as never)
  await uhr.advance(4 * MIN + 5 * 1000)
  expect(fragen.length, 'nach 4 min eine Frage').toBe(1)
  // Antwort 1 endet (Esc), Antwort 2 beginnt — die Frage ist noch offen
  await $.turn.complete({ turnId: 't1', answer: '', durationMs: 1, isAborted: true, reason: 'aborted' } as never)
  await $.turn.start({ text: 'Zweite Arbeit', turnId: 't2' })
  expect(beantwortet, 'Frage beim Wechsel noch offen').toBe(false)
  // «Abbrechen» kommt, während t2 läuft; danach endet der Schritt
  await uhr.advance(10 * 1000)
  expect(beantwortet, '«Abbrechen» während t2').toBe(true)
  await uhr.advance(20 * 1000)
  await lauf
  // höchstens die alte Antwort t1 wird abgebrochen, nie die neue
  expect(abgebrochen, `abgebrochen: ${abgebrochen.join(',')}`).not.toContain('t2')
})

test('F3-B2: parallele Aufrufe — der kurze endet, der lange bleibt sichtbar und wird nach 4 Minuten gemeldet', async ($, on) => {
  const uhr = mock.clock(on, { now: T0 })
  basis(on)
  const fragen: string[] = []
  antworte(on, fragen, 'Weiterlaufen')
  on('tool.call', { tool: 'Bash' }, async ($, e) => {
    // kurze Zeiten wie in F3-B1 (Zeitlimit 5 s)
    await uhr.sleep(String((e as { command: string }).command) === 'lang' ? 4 * MIN + 30 * 1000 : 5 * 1000)
    return { result: 'fertig' }
  })
  await $.session.start({ cwd: 'C:/P', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'Arbeit', turnId: 't1' })
  const lang = $.tool.call({ tool: 'Bash', command: 'lang' } as never)
  const kurz = $.tool.call({ tool: 'Bash', command: 'kurz' } as never)
  await uhr.advance(6 * 1000)
  await kurz
  const nachKurz = wachtZeile(await leiste($))
  await uhr.advance(4 * MIN)
  const bei4min = wachtZeile(await leiste($))
  await uhr.advance(30 * 1000)
  await lang
  expect(`${nachKurz} | ${bei4min} | Fragen: ${fragen.length}`).toBe(
    'Arbeitet seit 0:06 · läuft seit 6 s: Bash: lang | Arbeitet seit 4:06 · läuft seit 4 min: Bash: lang | Fragen: 1',
  )
})

test('F3-B2b: Leistentext nimmt bei mehreren laufenden Schritten den ältesten', () => {
  const now = T0 + 400000
  const w = {
    seit: T0,
    laufend: [
      { id: 'b', was: 'Bash: kurz', seit: now - 5000 },
      { id: 'a', was: 'Bash: lang', seit: now - LANG_MS - 1000 },
    ],
  }
  expect(waechterText(w, now)).toEqual({ text: 'Arbeitet seit 6:40 · läuft seit 4 min: Bash: lang', lang: true })
  // keiner läuft mehr: wieder «letzter Schritt»
  expect(waechterText({ seit: T0, laufend: [], letzter: { was: 'Bash: kurz', ende: now - 8000 } }, now)?.text).toBe(
    'Arbeitet seit 6:40 · letzter Schritt vor 8 s: Bash: kurz',
  )
})
