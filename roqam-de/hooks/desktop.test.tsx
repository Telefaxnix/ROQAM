import { expect, mock, test } from 'claude-code/testing'

test('in der Desktop-App ohne gezeichnete Striche, mit Balken', async ($, on) => {
  mock.clock(on, { now: Date.parse('2026-10-07T10:00:00Z') })
  // an Stelle der Engine: ein leeres Element unter den Mods
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  const ui = await $.ui.mount({
    plugin: 'roqam-de',
    surface: 'desktop',
    component: 'AbovePrompt',
    props: { bodyColumns: 80 },
    viewport: { columns: 80, rows: 40 },
  })
  expect(await ui.find({ type: 'Text', text: /Ctx:/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /▰|▱/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /─{10}/ })).toBeUndefined()
  // weisse Linien als Svg über die ganze Breite: über der ctx-Zeile und am Ende (dazu vor der Higgsfield-Zeile,
  // sobald es sie gibt); feine Linie 0,67 px, mit Luft fest 16 px hoch (bei 150 % ganzes Pixelraster) (ohne Höhe zeichnet die App einen dicken Balken)
  const svgs = await ui.findAll({ type: 'Svg' })
  const linien = svgs.filter(s => s.props?.alt === 'Trennlinie')
  expect(linien.length).toBeGreaterThan(1)
  // die erste knapp (Vorgabe 15.10.2026, sonst musste man für den dritten Vorschlag scrollen): 4 px über, 2 px unter
  // dem Strich; die letzte wie bisher 16 px hoch mit dem Strich in der Mitte
  expect(linien[0]?.props?.height).toBe(6.66667)
  expect(String(linien[0]?.props?.source)).toContain('viewBox="0 0 100 6.66667" preserveAspectRatio="none"><rect y="4" width="100" height="0.66667"')
  expect(linien.at(-1)?.props?.height).toBe(16)
  expect(String(linien.at(-1)?.props?.source)).toContain('viewBox="0 0 100 16" preserveAspectRatio="none"><rect y="7.33333" width="100" height="0.66667" fill="#FFFFFF"/>')
  // überall ein Strich von 2/3 px (bei 150 % genau 1 Bildpunkt) auf einem Vielfachen von 2/3 px
  for (const l of linien) {
    const y = Number(/<rect y="([\d.]+)"/.exec(String(l.props?.source))?.[1])
    expect(Math.abs(y * 1.5 - Math.round(y * 1.5)) < 1e-3).toBe(true)
  }
  // Luft zwischen den Zeilen darunter: 4 px hohe leere Svg
  const luft = svgs.filter(s => s.props?.alt === 'Abstand')
  expect(luft.length).toBeGreaterThan(0)
  expect(luft.every(l => l.props?.height === 4)).toBe(true)
  await ui.unmount()
})
