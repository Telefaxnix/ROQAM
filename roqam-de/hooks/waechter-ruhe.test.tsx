import { expect, mock, test } from 'claude-code/testing'

test('Wächter: eigener Credit-Abruf und Aufrufe nach der Antwort zeigen keine Zeile', async ($, on) => {
  mock.clock(on, { now: Date.parse('2026-10-07T20:00:00Z') })
  on('tool.call', () => ({ result: 'ok' }))
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  const ui = await $.ui.mount({ plugin: 'roqam-de', surface: 'desktop', component: 'AbovePrompt', props: { bodyColumns: 160 }, viewport: { columns: 160, rows: 40 } })
  await $.tool.call({ tool: 'mcp__e7532db9-c300-4234-b842-c495ced4f530__balance' })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect(await ui.find({ type: 'Text', text: /Arbeitet seit/ })).toBeUndefined()
  await ui.unmount()
})
