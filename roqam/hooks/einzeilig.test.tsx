// Statuszeilen immer auf einer Zeile und Sondermodus-Ressourcen als Taste mit Füllbalken (Vorgabe 14.10.2026): In der App
// brach «Week» in eine zweite Zeile um, weil die zehn ▰ dort je rund 1.6 Zellen breit laufen; daneben standen die
// Striche in dehnbaren Lücken (Platzhalter). Jetzt: normale Leiste wie bisher, aber Balken kürzer, sobald es eng wird,
// und keine Zeile bricht mehr um; im Sondermodus je Wert eine Taste (CTX, 5H, WEEK) mit Füllbalken (Variante B), ohne Striche.
import { expect, mock, test } from 'claude-code/testing'

import { appBalken } from './register'
import { AMPEL, BALKEN_SPUR, fuellBalkenSvg, fuellBalkenZeichen } from './sondermodus-farben'

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

const daten = { ctx: 40, fiveHour: 10, week: 90, fiveHourResetsAt: '2026-10-14T12:03:00Z', weekResetsAt: Date.parse('2026-10-18T06:00:00Z') / 1000 }
function werte(on: On, sondermodus: boolean, privat = false) {
  mock.clock(on, { now: T0 })
  mock.store(on)
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  on('state.get', { plugin: 'roqam', key: 'data' }, () => ({ value: { value: daten, version: 1 } }) as never)
  on('state.get', { plugin: 'roqam', key: 'system' }, () => ({ value: { value: { model: 'Opus 5.5', effort: 'Sehr hoch', version: '2.1.299', chats: [], connectors: ['Higgsfield'] }, version: 1 } }) as never)
  if (sondermodus) on('state.get', { plugin: 'roqam', key: 'sondermodus' }, () => ({ value: { value: { an: true }, version: 1 } }) as never)
  if (privat) on('state.get', { plugin: 'roqam', key: 'aufnahme' }, () => ({ value: { value: { hand: true }, version: 1 } }) as never)
}
async function zeichne($: Engine, surface: 'desktop' | 'terminal', spalten: number) {
  const ui = await $.ui.mount({ plugin: 'roqam', surface, component: 'AbovePrompt', props: { bodyColumns: spalten }, viewport: { columns: spalten, rows: 40 } } as never)
  const t = await ui.drawn()
  await ui.unmount()
  return t as unknown
}

test('App-Balken: 10 Felder bei Standardbreite, kürzer bei Enge, unter 3 Feldern keine', () => {
  // Standardbreite der App (Bildschirmfoto 14.10.2026: rund 96 Zellen) = wie bisher 10 Felder
  expect(appBalken(96)).toBe(10)
  expect(appBalken(160)).toBe(10)
  expect(appBalken(91)).toBe(9)
  expect(appBalken(70)).toBe(5)
  expect(appBalken(60)).toBe(3)
  expect(appBalken(55)).toBe(0)
  expect(appBalken(Number.NaN)).toBe(10)
})

test('normale Leiste (App): Balken nach Breite, keine Zeile bricht um, Sitzung wird am Ende gekürzt', async ($, on) => {
  werte(on, false)
  const breit = await zeichne($, 'desktop', 160)
  const eng = await zeichne($, 'desktop', 70)
  // Ctx 40 %: bei 160 Zellen 10 Felder (4 voll), bei 70 Zellen 5 Felder (2 voll)
  expect(JSON.stringify(breit)).toContain('▰▰▰▰▱▱▱▱▱▱')
  expect(JSON.stringify(eng)).toContain('▰▰▱▱▱')
  expect(JSON.stringify(eng)).not.toContain('▰▰▱▱▱▱')
  for (const t of [breit, eng]) {
    const umbruch = alle(t, n => n.type === 'Box' && n.props?.flexWrap === 'wrap' && /^(zeile\d|system|nacht\d)$/.test(String(n.props?.key)))
    expect(umbruch.map(n => n.props?.key)).toEqual([])
    const sitzung = suche(t, 'sitzung-rechts')
    expect(sitzung?.props?.flexShrink).toBe(1)
    expect(sitzung?.props?.minWidth).toBe(0)
    expect(JSON.stringify(sitzung)).toContain('truncate-end')
  }
})

test('Sondermodus (App): Tasten CTX, 5H, 7T mit Füllbalken als Bild, Strich dazwischen, Zeile ohne Umbruch', async ($, on) => {
  werte(on, true)
  const t = await zeichne($, 'desktop', 96)
  const zeile = suche(t, 'ressourcen-inhalt')
  expect(zeile).toBeDefined()
  expect(zeile?.props?.flexWrap).toBeUndefined()
  const text = JSON.stringify(zeile)
  // zwischen den Werten je ein Strich mit kurzem Abstand, keine dehnbare Lücke (Vorgabe Dominik 16.10.2026)
  // (Text-Teile tragen ihren key im gezeichneten Baum nicht, darum über den Text gezählt)
  expect(text.split('" │ "').length - 1).toBe(2)
  expect(alle(zeile, n => String(n.props?.key).startsWith('ressourcen-luft'))).toEqual([])
  expect(text).not.toContain('Ctx:')
  for (const [label, wort] of [['ctx', 'CTX'], ['5h', '5H'], ['7D', '7D']] as const) {
    const taste = suche(zeile, `mess-${label}`)
    expect(JSON.stringify(taste)).toContain(`"${wort}"`)
  }
  const bilder = alle(zeile, n => n.type === 'Svg' && n.props?.alt !== 'Corner')
  expect(bilder.map(b => String(b.props?.alt))).toEqual(['CTX 40.0%', '5H 10.0%', '7D 90.0%'])
  // Füllung je Wert in der Ampel: Ctx 40 % grün, Week 90 % rot; Spur dunkles Orange
  expect(String(bilder[0]?.props?.source)).toBe(fuellBalkenSvg(40, AMPEL.gut))
  expect(String(bilder[2]?.props?.source)).toBe(fuellBalkenSvg(90, AMPEL.kritisch))
  // Balkenplatz dehnbar: ab 10 Zellen, wächst mit und füllt die Zeile, bei Enge bis 3
  const platz = suche(zeile, 'mess-ctx-balken')
  expect([platz?.props?.width, platz?.props?.minWidth, platz?.props?.flexGrow, platz?.props?.flexShrink]).toEqual([10, 3, 1, 1])
  expect(['ctx', '5h', '7D'].map(l => suche(zeile, `seg-${l}`)?.props?.flexGrow)).toEqual([1, 1, 1])
  // Zahl direkt vor «%» (Vorgabe Dominik 16.10.2026), Restzeit dahinter
  expect(text).toContain('"children":[" 40.0%"]')
  expect(text).not.toContain(' %')
  // Luft um das Wort der Taste: in der App 0.75 Zellen (ein Viertel weniger)
  expect(suche(zeile, 'mess-7D-platz')?.props?.paddingX).toBe(0.75)
  expect(text).toContain('−2h03')
})

test('Sondermodus (Konsole): Balken aus Blöcken, kein Bild; Aufnahme schwärzt den Weeknbalken', async ($, on) => {
  werte(on, true, true)
  const kon = suche(await zeichne($, 'terminal', 160), 'ressourcen-inhalt')
  expect(alle(kon, n => n.type === 'Svg')).toEqual([])
  const k = JSON.stringify(kon)
  expect(k).toContain(fuellBalkenZeichen(40, 10).voll)
  expect(k).toContain(BALKEN_SPUR)
  expect(k).toContain(' │ ')
  // in der Konsole wachsen die Werte nicht mit
  expect(suche(kon, 'seg-ctx')?.props?.flexGrow).toBeUndefined()
  // Aufnahme-Modus in der App: Weeknbalken ganz grau (Füllung und Spur), Wert geschwärzt
  const app = suche(await zeichne($, 'desktop', 96), 'ressourcen-inhalt')
  const woche = alle(app, n => n.type === 'Svg' && n.props?.alt !== 'Corner').find(b => String(b.props?.alt).startsWith('7D'))
  expect(String(woche?.props?.source)).toBe(fuellBalkenSvg(90, '#5C5C5C', '#5C5C5C'))
  expect(String(woche?.props?.alt)).toBe('7D')
})

test('Füllbalken: Kappe rechts rund, links eckig, Füllung begrenzt auf 0–100 %', () => {
  const s = fuellBalkenSvg(150, '#88CC88')
  expect(s).toContain('width="100%"')
  // so hoch wie die Taste: eine Textzeile der App = 19 CSS-px, Kappe halb so hoch (gemessen 15.10.2026)
  expect(s).toContain('rx="9.5"')
  expect(s).toContain('<rect width="50%"')
  expect(fuellBalkenSvg(Number.NaN, '#88CC88')).toContain('width="0%" height="19" fill="#88CC88"')
  expect(fuellBalkenZeichen(50, 4)).toEqual({ voll: '██', rest: '██' })
  expect(fuellBalkenZeichen(120, 3)).toEqual({ voll: '███', rest: '' })
})
