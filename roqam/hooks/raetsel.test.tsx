// Rätsel im Einblender (Vorgabe Dominik 16.10.2026): Bei jeder hundertsten fertigen Antwort, gezählt über alle Chats im
// $.store, steht im Einblender oben im Band ein Rätsel statt der Zusammenstellung, bis zur nächsten Eingabe. Kein Rätsel
// enthält ein Auslösewort (geprüft über die Prüfsummen, damit auch dieser Test keines im Klartext enthält).
import { expect, mock, test } from 'claude-code/testing'

import { TON_PRUEFSUMME } from './klang'
import { RAETSEL, RAETSEL_KEY, raetselFuer } from './raetsel'
import { geheimwort } from './sondermodus-farben'

type Body = Extract<Parameters<typeof test>[1], (...a: never[]) => unknown>
type On = Parameters<Body>[1]
type Engine = Parameters<Body>[0]
type Knoten = { type: string; props?: Record<string, unknown>; children?: unknown }
const T0 = Date.parse('2026-10-16T10:00:00Z')

const kinder = (n: unknown) => {
  const c = (n as Knoten | undefined)?.children
  return (Array.isArray(c) ? c : c ? [c] : []) as Knoten[]
}

// Grundmocks wie einblender.test.tsx
function basis(on: On, store: Record<string, unknown>) {
  mock.store(on, store)
  mock.env(on, { USERPROFILE: 'C:/U' })
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 1000, window: 200000, percent: 0 }, rateLimits: [] } }) as never)
  on('command.register', () => ({ value: {} }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }) as never)
  on('tool.list', () => ({ value: [] }) as never)
  on('agent.list', () => ({ value: [] }) as never)
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
  on('ui.render', { component: 'AssistantMessage' }, () => ({ type: 'engine', ref: 0 }) as never)
  on('ui.render', { component: 'AskUserQuestion' }, () => ({ type: 'engine', ref: 0 }) as never)
}
async function band($: Engine) {
  const ui = await $.ui.mount({ plugin: 'roqam', surface: 'desktop', component: 'AbovePrompt', props: { bodyColumns: 160 }, viewport: { columns: 160, rows: 40 } } as never)
  const t = await ui.drawn()
  await ui.unmount()
  return JSON.stringify(kinder(t)[0])
}
async function antwort($: Engine, uhr: { advance(ms: number): Promise<void>; settle(): Promise<void> }, id: string) {
  await $.turn.start({ text: 'Bau etwas', turnId: id })
  await uhr.advance(5000)
  await $.turn.complete({ turnId: id, answer: 'Fertig.', durationMs: 5000, reason: 'answer' } as never)
  await uhr.settle()
}

test('Rätsel nur bei jeder hundertsten Antwort, der Reihe nach', () => {
  expect(raetselFuer(100)).toBe(RAETSEL[0])
  expect(raetselFuer(200)).toBe(RAETSEL[1])
  expect(raetselFuer(400)).toBe(RAETSEL[3])
  expect(raetselFuer(500)).toBe(RAETSEL[0])
  expect([0, 1, 99, 101, 150, -100, Number.NaN, 100.5].map(raetselFuer)).toEqual(Array(8).fill(undefined))
  expect(new Set(RAETSEL).size).toBe(4)
})

test('Rätsel passen auf eine Zeile und enthalten keines der Auslösewörter', () => {
  expect(RAETSEL.filter(r => r.length > 85)).toEqual([])
  const woerter = RAETSEL.join(' ').toLowerCase().split(/[^a-zäöüéè]+/).filter(Boolean)
  expect(woerter.length > 40).toBe(true)
  expect(woerter.filter(w => geheimwort(w) !== undefined || geheimwort(w, TON_PRUEFSUMME) !== undefined)).toEqual([])
})

test('Zähler über den Store: bei der 100. Antwort das Rätsel im Einblender, bei der nächsten Eingabe weg, danach wieder die Zusammenstellung', async ($, on) => {
  const uhr = mock.clock(on, { now: T0 })
  basis(on, { [RAETSEL_KEY]: 98 })
  await $.session.start({ cwd: 'C:/P' } as never)
  await uhr.settle()
  // 99. Antwort: kein Rätsel
  await antwort($, uhr, 't1')
  expect(await band($)).not.toContain(RAETSEL[0])
  // 100. Antwort: Rätsel zuoberst
  await antwort($, uhr, 't2')
  const oben = await band($)
  expect(oben).toContain('"key":"einblender"')
  expect(oben).toContain(RAETSEL[0])
  // nächste Eingabe: weg, solange gearbeitet wird
  await $.turn.start({ text: 'Weiter', turnId: 't3' })
  expect(await band($)).not.toContain(RAETSEL[0])
  // 101. Antwort: wieder die Zusammenstellung, kein Rätsel
  await uhr.advance(5000)
  await $.turn.complete({ turnId: 't3', answer: 'Fertig.', durationMs: 5000, reason: 'answer' } as never)
  await uhr.settle()
  const danach = await band($)
  expect(danach).toContain('"key":"einblender"')
  expect(danach).not.toContain(RAETSEL[0])
})

test('Sondermodus: das Rätsel steht ebenso im Einblender', async ($, on) => {
  const uhr = mock.clock(on, { now: T0 })
  basis(on, { [RAETSEL_KEY]: 199, sondermodus: true })
  await $.session.start({ cwd: 'C:/P' } as never)
  await uhr.settle()
  await antwort($, uhr, 't1')
  expect(await band($)).toContain(RAETSEL[1])
})

test('Unbrauchbarer Zählerstand im Store zählt ab null', async ($, on) => {
  const uhr = mock.clock(on, { now: T0 })
  basis(on, { [RAETSEL_KEY]: 'kaputt' })
  await $.session.start({ cwd: 'C:/P' } as never)
  await uhr.settle()
  await antwort($, uhr, 't1')
  expect(await band($)).not.toContain(RAETSEL[0])
})
