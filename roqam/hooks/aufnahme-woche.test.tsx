import { expect, mock, test } from 'claude-code/testing'

// Aufnahme-Modus (Vorgabe 09.10.2026): Balken und Prozent des Weeknlimits geschwärzt, die Zeit bis zum
// Reset bleibt sichtbar.

type Knoten = { type?: string; props?: Record<string, unknown>; children?: unknown }
const texte = (n: unknown, schwarz: boolean, aus: string[] = []): string[] => {
  if (typeof n === 'string') {
    if (schwarz) aus.push(n)
    return aus
  }
  if (!n || typeof n !== 'object') return aus
  if (Array.isArray(n)) {
    n.forEach(k => texte(k, schwarz, aus))
    return aus
  }
  const o = n as Knoten
  const s = schwarz || o.props?.backgroundColor === '#5C5C5C'
  texte(o.props?.children, s, aus)
  texte(o.children, s, aus)
  return aus
}

test('Aufnahme schwärzt Weeknbalken und Prozent, Reset-Zeit bleibt', async ($, on) => {
  mock.clock(on, { now: Date.parse('2026-10-07T10:00:00Z') })
  mock.store(on)
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  const daten = { ctx: 8, fiveHour: 6, week: 9, weekResetsAt: Date.parse('2026-10-11T06:00:00Z') / 1000 }
  on('state.get', { plugin: 'roqam', key: 'data' }, () => ({ value: { value: daten, version: 1 } }))
  const ui = await $.ui.mount({
    plugin: 'roqam',
    surface: 'desktop',
    component: 'AbovePrompt',
    props: { bodyColumns: 160 },
    viewport: { columns: 160, rows: 40 },
  })
  const vorher = JSON.stringify(await ui.drawn())
  expect(texte(await ui.drawn(), false).join('').includes('9.0%')).toBe(false)
  await ui.post({ umschalten: true }, { in: 'knopf-aufnahme' })
  const nachher = await ui.drawn()
  expect(texte(nachher, false).join('').includes('9.0%')).toBe(true)
  // die Reset-Zeit (note) steht weiterhin, ungeschwärzt
  const note = /7D[^]*?"dimColor":true[^]*?"children":\[" ","([^"]+)"\]/.exec(vorher)?.[1]
  if (note) {
    expect(JSON.stringify(nachher).includes(note)).toBe(true)
    expect(texte(nachher, false).join('').includes(note)).toBe(false)
  }
  await ui.unmount()
})
