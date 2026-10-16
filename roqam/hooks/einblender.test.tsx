// Einblender (14.10.2026): Ist eine Aufgabe wirklich fertig, steht zuoberst im Band über der Eingabe und unter dem
// letzten Block der Antwort im Cockpit «CLAUDE BEREIT» auf hellem Grau, im Sondermodus «COMPUTER BEREIT – WARTET AUF
// IHRE EINGABE» in Grün; mitten in der Arbeit steht bei einer Rückfrage «ZWISCHENSCHRITT». Laufen noch
// Hintergrund-Agenten, ist die Aufgabe nicht fertig. Im Cockpit ohne Ton, im Sondermodus mit Ton.
import { expect, mock, test } from 'claude-code/testing'

import { CLAUDE_BEREIT, EINBLENDER_FARBE, EINBLENDER_GRAU, EINBLENDER_TEXT, einblenderFarbe, einblenderText } from './sondermodus-farben'

type Body = Extract<Parameters<typeof test>[1], (...a: never[]) => unknown>
type On = Parameters<Body>[1]
type Engine = Parameters<Body>[0]
type Knoten = { type: string; props?: Record<string, unknown>; children?: unknown }
const T0 = Date.parse('2026-10-14T10:00:00Z')

function alle(k: unknown, pruef: (n: Knoten) => boolean, out: Knoten[] = []): Knoten[] {
  if (!k || typeof k !== 'object') return out
  if (Array.isArray(k)) {
    for (const x of k) alle(x, pruef, out)
    return out
  }
  const n = k as Knoten
  if (pruef(n)) out.push(n)
  alle(n.children, pruef, out)
  return out
}
const kinder = (n: unknown) => {
  const c = (n as Knoten | undefined)?.children
  return (Array.isArray(c) ? c : c ? [c] : []) as Knoten[]
}

// Grundmocks wie sondermodus.test.tsx; agenten = was $.agent.list() meldet
function basis(on: On, gestartet: string[], store: Record<string, unknown> = {}, agenten: () => unknown[] = () => []) {
  mock.store(on, store)
  mock.env(on, { USERPROFILE: 'C:/U' })
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 1000, window: 200000, percent: 0 }, rateLimits: [] } }) as never)
  on('command.register', () => ({ value: {} }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }) as never)
  on('tool.list', () => ({ value: [] }) as never)
  on('agent.list', () => ({ value: agenten() }) as never)
  on('process.run', ($, e) => {
    gestartet.push(e.argv.join(' '))
    return { value: { stdout: '', stderr: '', exitCode: 0 } } as never
  })
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
  on('ui.render', { component: 'AssistantMessage' }, () => ({ type: 'engine', ref: 0 }) as never)
  on('ui.render', { component: 'AskUserQuestion' }, () => ({ type: 'engine', ref: 0 }) as never)
}
async function zeichne($: Engine, surface: 'desktop' | 'terminal', component: string, props: unknown) {
  const ui = await $.ui.mount({ plugin: 'roqam', surface, component, props, viewport: { columns: 160, rows: 40 } } as never)
  const t = await ui.drawn()
  await ui.unmount()
  return t as unknown
}
const band = ($: Engine, surface: 'desktop' | 'terminal' = 'desktop') => zeichne($, surface, 'AbovePrompt', { bodyColumns: 160 })
// erste Zeile des Bands (der Einblender steht zuoberst)
const ersteZeile = (baum: unknown) => kinder(baum)[0]
const ANTWORT = 'Erster Teil der Antwort.\n\nAlles erledigt, die Tests laufen durch.'

test('Cockpit: nach der Antwort CLAUDE BEREIT (hellgrau) zuoberst im Band und unter dem letzten Block, ohne Ton; weg bei neuer Arbeit', async ($, on) => {
  const uhr = mock.clock(on, { now: T0 })
  const gestartet: string[] = []
  basis(on, gestartet)
  await $.session.start({ cwd: 'C:/P' } as never)
  await uhr.settle()
  // vor der ersten Aufgabe: kein Einblender
  expect(JSON.stringify(await band($))).not.toContain(CLAUDE_BEREIT)
  await $.turn.start({ text: 'Bau etwas', turnId: 't1' })
  // während der Arbeit: kein Einblender
  expect(JSON.stringify(await band($))).not.toContain(CLAUDE_BEREIT)
  await uhr.advance(30000)
  await $.turn.complete({ turnId: 't1', answer: ANTWORT, durationMs: 30000, reason: 'answer' } as never)
  await uhr.settle()
  for (const surface of ['desktop', 'terminal'] as const) {
    const b = await band($, surface)
    const oben = ersteZeile(b)
    expect(oben?.props?.key).toBe('einblender')
    expect(JSON.stringify(oben)).toContain(CLAUDE_BEREIT)
    expect(JSON.stringify(oben)).toContain(EINBLENDER_GRAU)
    // «COMPUTER» und Grün nur im freigeschalteten Sondermodus
    expect(JSON.stringify(oben)).not.toContain('COMPUTER')
    expect(JSON.stringify(oben)).not.toContain(EINBLENDER_FARBE.bereit)
  }
  // im Chat: unter dem letzten Block, nicht unter dem ersten
  const letzter = JSON.stringify(await zeichne($, 'desktop', 'AssistantMessage', { text: 'Alles erledigt, die Tests laufen durch.', isFirstOfReply: false }))
  const erster = JSON.stringify(await zeichne($, 'desktop', 'AssistantMessage', { text: 'Erster Teil der Antwort.', isFirstOfReply: true }))
  expect(letzter).toContain(CLAUDE_BEREIT)
  expect(letzter).toContain(EINBLENDER_GRAU)
  expect(letzter).not.toContain('COMPUTER')
  expect(letzter).toContain('"type":"engine"')
  expect(erster).toBe('{"type":"engine","ref":0}')
  // im Cockpit kein Ton
  expect(gestartet.filter(a => a.includes('.wav'))).toEqual([])
  // neue Aufgabe: Einblender verschwindet überall
  await $.turn.start({ text: 'Weiter', turnId: 't2' })
  expect(JSON.stringify(await band($))).not.toContain(CLAUDE_BEREIT)
  expect(JSON.stringify(await zeichne($, 'desktop', 'AssistantMessage', { text: 'Alles erledigt, die Tests laufen durch.', isFirstOfReply: false }))).toBe('{"type":"engine","ref":0}')
})

test('Cockpit: Rückfrage mitten in der Arbeit = ZWISCHENSCHRITT im Band und über dem Dialog (eckig, nichts darunter); danach weg', async ($, on) => {
  const uhr = mock.clock(on, { now: T0 })
  const gestartet: string[] = []
  basis(on, gestartet)
  let bandWaehrend = ''
  let dialogWaehrend: unknown
  on('tool.call', { tool: 'AskUserQuestion' }, async () => {
    bandWaehrend = JSON.stringify(ersteZeile(await band($)))
    dialogWaehrend = await zeichne($, 'desktop', 'AskUserQuestion', { tool: 'AskUserQuestion', questions: [] })
    return { result: { questions: [], answers: { 'Q?': 'Ja' } } }
  })
  await $.session.start({ cwd: 'C:/P' } as never)
  await uhr.settle()
  await $.turn.start({ text: 'Bau etwas', turnId: 't1' })
  await $.tool.call({ tool: 'AskUserQuestion', questions: [{ question: 'Q?', header: 'H', options: [{ label: 'Ja' }, { label: 'Nein' }], multiSelect: false }] } as never)
  await uhr.settle()
  expect(bandWaehrend).toContain(EINBLENDER_TEXT.zwischenschritt)
  expect(bandWaehrend).toContain(EINBLENDER_FARBE.zwischenschritt)
  const d = dialogWaehrend as Knoten
  expect(JSON.stringify(kinder(d)[0])).toContain(EINBLENDER_TEXT.zwischenschritt)
  // der Dialog ist das letzte Element, um ihn keine Positionsangabe und keine feste Breite
  expect(JSON.stringify(kinder(d).at(-1))).toContain('"type":"engine"')
  expect(alle(d, n => n.type === 'Box' && (n.props?.position !== undefined || n.props?.width !== undefined))).toEqual([])
  // im Cockpit kein Ton
  expect(gestartet.filter(a => a.includes('.wav'))).toEqual([])
  // nach der Antwort läuft die Aufgabe weiter: kein Einblender
  expect(JSON.stringify(await band($))).not.toContain('INTERMEDIATE STEP')
  // eine Rückfrage ausserhalb der Arbeit (z. B. «Komprimieren?» über den Knopf) bleibt unverändert
  await $.turn.complete({ turnId: 't1', answer: 'fertig', durationMs: 1000, reason: 'answer' } as never)
  await uhr.settle()
  expect(JSON.stringify(await zeichne($, 'desktop', 'AskUserQuestion', { tool: 'AskUserQuestion', questions: [] }))).toBe('{"type":"engine","ref":0}')
})

test('Hintergrund-Agenten laufen noch: kein COMPUTER BEREIT; Sondermodus-Fusszeile meldet sie; sind sie fertig, kommt der Einblender', async ($, on) => {
  const uhr = mock.clock(on, { now: T0 })
  const gestartet: string[] = []
  let laufend = true
  basis(on, gestartet, { sondermodus: true }, () => (laufend ? [{ agentId: 'a1', status: 'running' }] : [{ agentId: 'a1', status: 'completed' }]))
  await $.session.start({ cwd: 'C:/P' } as never)
  await uhr.settle()
  await $.turn.start({ text: 'Bau etwas', turnId: 't1' })
  await uhr.advance(30000)
  await $.turn.complete({ turnId: 't1', answer: ANTWORT, durationMs: 30000, reason: 'answer' } as never)
  await uhr.settle()
  const b = JSON.stringify(await band($))
  expect(b).not.toContain('COMPUTER READY')
  expect(b).toContain('BACKGROUND AGENTS WORKING')
  expect(gestartet.filter(a => a.includes('bereit.wav'))).toEqual([])
  // Ergebnis des Agenten kommt als neue Antwort; jetzt läuft keiner mehr
  laufend = false
  await $.turn.start({ text: '', turnId: 't2' })
  await uhr.advance(25000)
  await $.turn.complete({ turnId: 't2', answer: 'Agent fertig.', durationMs: 25000, reason: 'answer' } as never)
  await uhr.settle()
  expect(JSON.stringify(ersteZeile(await band($)))).toContain(EINBLENDER_TEXT.bereit)
  // Sondermodus: Ton zusammen mit dem Einblender
  expect(gestartet.filter(a => a.includes('bereit.wav')).length).toBe(1)
})

test('Sondermodus: Einblender zuoberst (keine Kopfleiste mehr) und unter dem letzten Block innerhalb des Rahmens', async ($, on) => {
  const uhr = mock.clock(on, { now: T0 })
  const gestartet: string[] = []
  basis(on, gestartet, { sondermodus: true })
  await $.session.start({ cwd: 'C:/P' } as never)
  await uhr.settle()
  await $.turn.start({ text: 'Bau etwas', turnId: 't1' })
  await uhr.advance(5000)
  await $.turn.complete({ turnId: 't1', answer: ANTWORT, durationMs: 5000, reason: 'answer' } as never)
  await uhr.settle()
  const b = await band($)
  expect(kinder(b).map(k => k.props?.key).filter(Boolean).slice(0, 2)).toEqual(['einblender', 'ressourcen'])
  // Schrift des Einblenders in der absoluten Box nach der Ebene (die App malt sie über die Fläche)
  const vorn = alle(b, n => n.props?.key === 'einblender-flaeche-vorn')[0]
  expect(vorn?.props?.position).toBe('absolute')
  expect(JSON.stringify(vorn)).toContain(EINBLENDER_TEXT.bereit)
  const letzter = await zeichne($, 'desktop', 'AssistantMessage', { text: 'Alles erledigt, die Tests laufen durch.', isFirstOfReply: false })
  const t = JSON.stringify(letzter)
  expect(t).toContain('aus-rumpf')
  expect(t).toContain(EINBLENDER_TEXT.bereit)
  // kurze Antwort (unter 20 s): kein Ton
  expect(gestartet.filter(a => a.includes('bereit.wav'))).toEqual([])
})

test('Einblender-Text und -Farbe: Cockpit «CLAUDE BEREIT» hellgrau, Sondermodus «COMPUTER BEREIT …» grün; Zwischenschritt überall gold', () => {
  expect(einblenderText('bereit', false)).toBe('CLAUDE READY')
  expect(einblenderFarbe('bereit', false)).toBe('#BBBBBB')
  expect(einblenderText('bereit', true)).toBe('COMPUTER READY – AWAITING YOUR INPUT')
  expect(einblenderFarbe('bereit', true)).toBe(EINBLENDER_FARBE.bereit)
  for (const l of [false, true]) {
    expect(einblenderText('zwischenschritt', l)).toBe(EINBLENDER_TEXT.zwischenschritt)
    expect(einblenderFarbe('zwischenschritt', l)).toBe(EINBLENDER_FARBE.zwischenschritt)
  }
})
