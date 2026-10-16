// Zusammenstellung der letzten Arbeit (Vorgabe 15.10.2026): Ist eine Aufgabe fertig, steht oben im Band statt «CLAUDE
// BEREIT» bzw. «COMPUTER BEREIT …» die Übersicht «EIN … · AUS … · TOTAL … · API …», gezählt ab der eigenen Eingabe
// (Unteragenten eingeschlossen, eine Nachricht mitten in der Arbeit beginnt nichts Neues), Ein mit Cache wie im Wächter.
// Die Kosten kommen aus dem Kostenbuch (dieselbe Rechnung wie «API:»). Der Einblender am Ende der Antwort bleibt.
import { expect, mock, test } from 'claude-code/testing'

import { arbeitKosten, betragText } from './kosten'
import type { Kostenbuch } from './kosten'
import { CLAUDE_BEREIT, EINBLENDER_TEXT } from './sondermodus-farben'
import { arbeitText, KEINE_TOKENS } from './waechter'

type Body = Extract<Parameters<typeof test>[1], (...a: never[]) => unknown>
type On = Parameters<Body>[1]
type Engine = Parameters<Body>[0]
type Knoten = { type: string; props?: Record<string, unknown>; children?: unknown }
type Nutzung = { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }
const T0 = Date.parse('2026-10-14T10:00:00Z')
const ABO = '2026-09-14T06:59:56Z'
const HOME = 'C:\\U'
const PROJEKTE = `${HOME}\\.claude\\projects`

const kinder = (n: unknown) => {
  const c = (n as Knoten | undefined)?.children
  return (Array.isArray(c) ? c : c ? [c] : []) as Knoten[]
}
// Antwortzeile eines Verlaufs (wie Claude Code sie schreibt)
const zeile = (id: string, zeit: number, output: number) =>
  JSON.stringify({ type: 'assistant', timestamp: new Date(zeit).toISOString(), message: { id, model: 'claude-opus-5-5', usage: { output_tokens: output } } })

// Grundmocks; nutzung = was die nächste Modellanfrage meldet, verlauf = Dateien unter projects\C--P
function basis(on: On, store: Record<string, unknown>, verlauf: Record<string, string>, nutzung: { naechste: Nutzung | null }) {
  mock.store(on, store)
  mock.env(on, { USERPROFILE: HOME })
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 1000, window: 200000, percent: 0 }, rateLimits: [] } }) as never)
  on('command.register', () => ({ value: {} }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }) as never)
  on('session.root', () => ({ value: 'C:\\P' }) as never)
  on('session.id', () => ({ value: 'chat-b' }) as never)
  on('tool.list', () => ({ value: [] }) as never)
  on('agent.list', () => ({ value: [] }) as never)
  on('process.run', () => ({ value: { stdout: '', stderr: '', exitCode: 0 } }) as never)
  on('fs.write', () => ({ value: undefined }) as never)
  on('fs.list', ($, e) => {
    const p = String((e as { path: string }).path)
    if (p === PROJEKTE) return { value: [{ name: 'C--P', kind: 'dir', size: 0, mtimeMs: 0, isLink: false }] } as never
    if (p === `${PROJEKTE}\\C--P`)
      return { value: Object.entries(verlauf).map(([name, text]) => ({ name, kind: 'file', size: text.length, mtimeMs: 1, isLink: false })) } as never
    return { value: [] } as never
  })
  on('fs.read', ($, e) => {
    const p = String((e as { path: string }).path)
    if (p.endsWith('.claude.json')) return { value: JSON.stringify({ oauthAccount: { subscriptionCreatedAt: ABO } }) } as never
    const name = p.split('\\').pop() ?? ''
    if (name in verlauf) return { value: verlauf[name] } as never
    throw new Error(`fehlt: ${p}`)
  })
  on('http.fetch', () => {
    throw new Error('offline')
  })
  on('prompt.submit', ($, e) => ({ text: e.text }) as never)
  on('turn.start', ($, e) => ({ turnId: e.turnId }) as never)
  on('turn.complete', ($, e) => ({ text: (e as { answer: string }).answer }) as never)
  on('turn.step', async function* ($, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: nutzung.naechste } as never
  })
  on('model.complete', () => ({ value: { isAnswered: true, text: '-' } }) as never)
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  on('ui.render', { component: 'AssistantMessage' }, () => ({ type: 'engine', ref: 0 }) as never)
}
async function zeichne($: Engine, surface: 'desktop' | 'terminal', component: string, props: unknown) {
  const ui = await $.ui.mount({ plugin: 'roqam-de', surface, component, props, viewport: { columns: 160, rows: 40 } } as never)
  const t = await ui.drawn()
  await ui.unmount()
  return t as unknown
}
// erste Zeile des Bands (der Einblender steht zuoberst)
const oben = async ($: Engine, surface: 'desktop' | 'terminal' = 'desktop') => JSON.stringify(kinder(await zeichne($, surface, 'AbovePrompt', { bodyColumns: 160 }))[0])
const chatEnde = async ($: Engine) => JSON.stringify(await zeichne($, 'desktop', 'AssistantMessage', { text: 'Alles erledigt.', isFirstOfReply: false }))
const eingabe = ($: Engine, text: string) => $.prompt.submit({ text, wait: false, origin: { kind: 'composer' } } as never)
async function schritt($: Engine, nutzung: { naechste: Nutzung | null }, n: Nutzung, turnId: string, agentId?: string) {
  nutzung.naechste = n
  const s = $.turn.step({ turnId, index: 0, model: 'claude-opus-5-5', messageCount: 1, ...(agentId ? { agentId } : {}) })
  for await (const _ of s) void _
  await s.result
}
const N = (ein: number, aus: number, gelesen = 0, geschrieben = 0): Nutzung => ({
  input_tokens: ein,
  output_tokens: aus,
  cache_read_input_tokens: gelesen,
  cache_creation_input_tokens: geschrieben,
})

test('Text, Kosten und Betrag der letzten Arbeit', () => {
  expect(arbeitText(KEINE_TOKENS)).toBeUndefined()
  expect(arbeitText({ ein: 1_550_000, aus: 10_000 })).toBe('EIN 1,55M · AUS 10,0k · TOTAL 1,56M')
  expect(arbeitText({ ein: 1_550_000, aus: 10_000 }, '0,85 CHF')).toBe('EIN 1,55M · AUS 10,0k · TOTAL 1,56M · API 0,85 CHF')
  const buch: Kostenbuch = {
    version: 1,
    since: 0,
    antworten: { a: [100, 1, 'c--p', 'c1'], b: [200, 0.5, 'c--p', 'c1'], c: [300, 2, 'c--p', 'c2'], d: [50, 9, 'c--p', 'c1'] },
  }
  expect(arbeitKosten(buch, 'c1', 100)).toBe(1.5)
  expect(arbeitKosten(buch, 'c3', 100)).toBeUndefined()
  expect(arbeitKosten(buch, '', 100)).toBeUndefined()
  expect(arbeitKosten(undefined, 'c1', 100)).toBeUndefined()
  expect(betragText(1, 0.8)).toBe('0,80 CHF')
  expect(betragText(1, undefined)).toBe('1,00 USD')
  expect(betragText(1, Number.NaN)).toBe('1,00 USD')
})

test('Cockpit: oben die Zusammenstellung ab der eigenen Eingabe (mit Unteragent, Nachricht mitten drin zählt dazu), im Chat CLAUDE BEREIT', async ($, on) => {
  const uhr = mock.clock(on, { now: T0 })
  const nutzung = { naechste: null as Nutzung | null }
  basis(on, {}, {}, nutzung)
  await $.session.start({ cwd: 'C:/P' } as never)
  await uhr.settle()
  // erste Arbeit: Hauptchat und Unteragent; mitten drin eine weitere eigene Nachricht
  await eingabe($, 'Bau etwas')
  await $.turn.start({ text: 'Bau etwas', turnId: 't1' })
  await schritt($, nutzung, N(1000, 2000, 1_000_000, 9000), 't1')
  await eingabe($, 'Und noch das')
  await schritt($, nutzung, N(500, 8000, 39_500), 't1', 'agent-1')
  await uhr.advance(30000)
  await $.turn.complete({ turnId: 't1', answer: 'Alles erledigt.', durationMs: 30000, reason: 'answer' } as never)
  await uhr.settle()
  for (const surface of ['desktop', 'terminal'] as const) {
    const o = await oben($, surface)
    expect(`${surface}: ${o.includes('EIN 1,05M · AUS 10,0k · TOTAL 1,06M')}`).toBe(`${surface}: true`)
    expect(o).not.toContain('API')
    expect(o).not.toContain(CLAUDE_BEREIT)
  }
  // im Chat unverändert
  expect(await chatEnde($)).toContain(CLAUDE_BEREIT)
  // knappe Abstände oben (Vorgabe 15.10.2026, sonst Scrollen für den dritten Vorschlag): gleich nach dem Einblender die
  // erste Linie (4 px über, 2 px unter dem Strich), vor der zweiten Zeile 3,33 px über dem Strich, darunter wie bisher 8
  const band = kinder(await zeichne($, 'desktop', 'AbovePrompt', { bodyColumns: 160 }))
  const nachEinblender = band[band.findIndex(k => k.props?.key === 'einblender') + 1]
  expect(nachEinblender?.props?.alt).toBe('Trennlinie')
  expect(nachEinblender?.props?.height).toBe(6.66667)
  // (Svg tragen ihren key nicht im gezeichneten Baum: die Linie steht direkt vor der zweiten Zeile)
  const zweite = band[band.findIndex(k => k.props?.key === 'zeile1') - 1]
  expect(zweite?.props?.alt).toBe('Trennlinie')
  expect(zweite?.props?.height).toBe(12)
  expect(String(zweite?.props?.source)).toContain('viewBox="0 0 100 12" preserveAspectRatio="none"><rect y="3.33333"')
  // nächste Arbeit: zählt neu
  await eingabe($, 'Weiter')
  await $.turn.start({ text: 'Weiter', turnId: 't2' })
  await schritt($, nutzung, N(100, 900), 't2')
  await $.turn.complete({ turnId: 't2', answer: 'Fertig.', durationMs: 1000, reason: 'answer' } as never)
  await uhr.settle()
  expect(await oben($)).toContain('EIN 0,1k · AUS 0,9k · TOTAL 1,0k')
})

test('Sondermodus: grüner Einblender oben mit der Zusammenstellung, Chat-Ende und Fusszeile bleiben COMPUTER BEREIT', async ($, on) => {
  const uhr = mock.clock(on, { now: T0 })
  const nutzung = { naechste: null as Nutzung | null }
  basis(on, { sondermodus: true }, {}, nutzung)
  await $.session.start({ cwd: 'C:/P' } as never)
  await uhr.settle()
  await eingabe($, 'Bau etwas')
  await $.turn.start({ text: 'Bau etwas', turnId: 't1' })
  await schritt($, nutzung, N(1000, 2000, 1_000_000, 9000), 't1')
  await uhr.advance(5000)
  await $.turn.complete({ turnId: 't1', answer: 'Alles erledigt.', durationMs: 5000, reason: 'answer' } as never)
  await uhr.settle()
  const band = JSON.stringify(await zeichne($, 'desktop', 'AbovePrompt', { bodyColumns: 160 }))
  const o = await oben($)
  expect(o).toContain('EIN 1,01M · AUS 2,0k · TOTAL 1,01M')
  expect(o).not.toContain(EINBLENDER_TEXT.bereit)
  // Fusszeile «BEREIT» und Chat-Ende unverändert
  expect(band).toContain(EINBLENDER_TEXT.bereit)
  expect(await chatEnde($)).toContain(EINBLENDER_TEXT.bereit)
})

test('API-Kosten: nur Antworten dieses Chats ab der eigenen Eingabe, aus dem Kostenbuch', { options: { apiKosten: true, aktionen: false } }, async ($, on) => {
  const uhr = mock.clock(on, { now: T0 })
  const nutzung = { naechste: null as Nutzung | null }
  // 1 Mio Ausgabe-Tokens Opus 5.5 = 20 USD; die Antwort vor der Eingabe und die eines anderen Chats zählen nicht
  const verlauf = {
    'chat-b.jsonl': [zeile('vorher', T0 - 3600_000, 500_000), zeile('jetzt', T0 + 10_000, 1_000_000)].join('\n'),
    'chat-a.jsonl': zeile('fremd', T0 + 10_000, 1_000_000),
  }
  basis(on, {}, verlauf, nutzung)
  await $.session.start({ cwd: 'C:/P' } as never)
  await uhr.settle()
  await eingabe($, 'Bau etwas')
  await $.turn.start({ text: 'Bau etwas', turnId: 't1' })
  await schritt($, nutzung, N(1000, 2000, 1_000_000, 9000), 't1')
  await uhr.advance(20000)
  await $.turn.complete({ turnId: 't1', answer: 'Alles erledigt.', durationMs: 20000, reason: 'answer' } as never)
  await uhr.advance(6000)
  await uhr.settle()
  expect(await oben($)).toContain('EIN 1,01M · AUS 2,0k · TOTAL 1,01M · API 20,00 USD')
})
