import { expect, mock, test } from 'claude-code/testing'

// Sichtbarer Text je Zeile, ohne schwebende (position absolute) und versteckte Teile: das, was den Platz bestimmt
type Knoten = { type: string; props?: Record<string, unknown>; children?: unknown }
function text(k: unknown): string {
  if (typeof k === 'string' || typeof k === 'number') return String(k)
  if (Array.isArray(k)) return k.map(text).join('')
  if (!k || typeof k !== 'object') return ''
  const n = k as Knoten
  if (n.props?.position === 'absolute' || n.props?.display === 'none') return ''
  if (n.type === 'Button') return String(n.props?.label ?? '')
  return text(n.children)
}
function zeilen(baum: unknown): string[] {
  const n = baum as Knoten
  const kinder = Array.isArray(n.children) ? n.children : [n.children]
  return kinder.map(text).filter(z => z.length > 0)
}

test('Aufnahme an verschiebt nichts: gleiche Zeilen, gleicher Text, Schrift weiss, nur der Punkt an rot', async ($, on) => {
  mock.clock(on, { now: Date.parse('2026-10-07T10:00:00Z') })
  mock.store(on)
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({
      plugin: 'roqam-de',
      surface,
      component: 'AbovePrompt',
      props: { bodyColumns: 160 },
      viewport: { columns: 160, rows: 40 },
    })
    // was der selbst gezeichnete Knopf malt: Text und Farbe
    const knopf = async () => {
      const t = (await ui.drawn({ in: 'knopf-aufnahme' })) as unknown as Knoten
      const blatt = (t.type === 'Text' ? t : (Array.isArray(t.children) ? t.children[0] : t.children)) as Knoten
      const kinder = Array.isArray(blatt.children) ? blatt.children : [blatt.children]
      const punkt = kinder.find(k => (k as Knoten)?.type === 'Text') as Knoten | undefined
      return { text: text(blatt), farbe: blatt.props?.color, punkt: punkt?.props?.color }
    }
    const vorher = zeilen(await ui.drawn())
    expect(await knopf()).toEqual({ text: '◉ Aufnahme', farbe: 'white', punkt: 'white' })
    await ui.post({ umschalten: true }, { in: 'knopf-aufnahme' })
    const nachher = zeilen(await ui.drawn())
    expect(nachher).toEqual(vorher)
    expect(await knopf()).toEqual({ text: '◉ Aufnahme', farbe: 'white', punkt: 'red' })
    // nochmals klicken (echter Mausklick auf den Knopf) schaltet aus
    await ui.pointer({ type: 'down', x: 2, y: 0, button: 'left', in: 'knopf-aufnahme' })
    expect(await knopf()).toEqual({ text: '◉ Aufnahme', farbe: 'white', punkt: 'white' })
    await ui.unmount()
  }
})
