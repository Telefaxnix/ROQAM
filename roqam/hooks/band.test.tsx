import { expect, mock, test } from 'claude-code/testing'

test('die Leiste zeichnet im Terminal und in der App', async ($, on) => {
  mock.clock(on, { now: Date.parse('2026-10-07T10:00:00Z') })
  // an Stelle der Engine: ein leeres Element unter den Mods
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'roqam',
      surface,
      component: 'AbovePrompt',
      props: { bodyColumns: 160 },
      viewport: { columns: 160, rows: 40 },
    })
    expect(await ui.find({ type: 'Text', text: /Ctx:/ })).toBeDefined()
    await ui.unmount()
  }
})
