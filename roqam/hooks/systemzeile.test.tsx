// Systemzeile einzeilig (Vorgabe 14.10.2026): In der App brachen «Claude ●», «Opus 5.5 · Sehr hoch» und «T−59min» an
// ihren Leerzeichen um (Punkt unter «Claude», «Sehr» über «hoch»), weil die Teile schrumpfen durften. Jetzt behalten sie
// in der App ihre natürliche Breite (flexShrink 0), gekürzt wird nur «Sitzung» am Ende. Die Konsole bricht ihre eine
// lange Zeile weiter als Ganzes um.
import { expect, mock, test } from 'claude-code/testing'

type Body = Extract<Parameters<typeof test>[1], (...a: never[]) => unknown>
type On = Parameters<Body>[1]
type Engine = Parameters<Body>[0]
type Knoten = { type: string; props?: Record<string, unknown>; children?: unknown }
const T0 = Date.parse('2026-10-14T10:00:00Z')

function suche(k: unknown, key: string): Knoten | undefined {
  if (!k || typeof k !== 'object') return undefined
  if (Array.isArray(k)) {
    for (const x of k) {
      const f = suche(x, key)
      if (f) return f
    }
    return undefined
  }
  const n = k as Knoten
  if (n.props?.key === key) return n
  return suche(n.children, key)
}

function werte(on: On, sondermodus: boolean) {
  mock.clock(on, { now: T0 })
  mock.store(on)
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  const daten = { ctx: 40, fiveHour: 10, week: 90, cacheAt: T0 - 18 * 60000 }
  const sys = {
    status: { indicator: 'none', description: 'Alles in Betrieb', incidents: [] },
    model: 'Opus 5.5',
    effort: 'Sehr hoch',
    version: '2.1.299',
    chats: [],
    connectors: [],
  }
  on('state.get', { plugin: 'roqam', key: 'data' }, () => ({ value: { value: daten, version: 1 } }) as never)
  on('state.get', { plugin: 'roqam', key: 'system' }, () => ({ value: { value: sys, version: 1 } }) as never)
  if (sondermodus) on('state.get', { plugin: 'roqam', key: 'sondermodus' }, () => ({ value: { value: { an: true }, version: 1 } }) as never)
}

async function zeichne($: Engine, surface: 'desktop' | 'terminal') {
  const ui = await $.ui.mount({ plugin: 'roqam', surface, component: 'AbovePrompt', props: { bodyColumns: 96 }, viewport: { columns: 96, rows: 40 } } as never)
  const t = await ui.drawn()
  await ui.unmount()
  return t as unknown
}

const schrumpf = (t: unknown, key: string) => [key, suche(t, key)?.props?.flexShrink]

for (const [fall, sondermodus, cache] of [
  ['normale Leiste', false, 'T'],
  ['Sondermodus', true, 'seg-T'],
] as const) {
  test(`${fall} (App): Claude ●, Modell und T−… schrumpfen nicht, nur Sitzung wird gekürzt`, async ($, on) => {
    werte(on, sondermodus)
    const t = await zeichne($, 'desktop')
    expect(['sys-status', 'sys-model', cache].map(k => schrumpf(t, k))).toEqual([
      ['sys-status', 0],
      ['sys-model', 0],
      [cache, 0],
    ])
    const sitzung = suche(t, 'sitzung-rechts')
    expect([sitzung?.props?.flexShrink, sitzung?.props?.minWidth]).toEqual([1, 0])
    expect(JSON.stringify(sitzung)).toContain('truncate-end')
  })
}

test('normale Leiste (Konsole): Teile bleiben dehnbar, die eine Zeile bricht als Ganzes um', async ($, on) => {
  werte(on, false)
  const t = await zeichne($, 'terminal')
  expect(['sys-status', 'sys-model', 'T'].map(k => schrumpf(t, k))).toEqual([
    ['sys-status', undefined],
    ['sys-model', undefined],
    ['T', undefined],
  ])
})
