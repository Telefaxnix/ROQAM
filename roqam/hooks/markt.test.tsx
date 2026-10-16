// English version for the international market (16.10.2026): costs stay in USD and there is no exchange-rate request.
// This file exists only in the English copy; englisch_bauen.py writes it.
import { expect, mock, test } from 'claude-code/testing'

import { KURS_URL } from './register'

const T0 = Date.parse('2026-10-07T10:00:00Z')

test('English version: API costs in USD, even with an exchange rate in the state', { options: { apiCost: true } }, async ($, on) => {
  mock.clock(on, { now: T0 })
  mock.store(on)
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  const daten = { ctx: 8, costUsd: 1.5, usdChf: 0.8, periodUsd: 120, projectUsd: 40, projectName: 'Test' }
  on('state.get', { plugin: 'roqam', key: 'data' }, () => ({ value: { value: daten, version: 1 } }))
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ plugin: 'roqam', surface, component: 'AbovePrompt', props: { bodyColumns: 160 } as never, viewport: { columns: 160, rows: 40 } })
    const baum = JSON.stringify(await ui.drawn())
    expect(`${surface}: ${baum.includes('API: 1.50 / 40.00 / 120.00 USD')}`).toBe(`${surface}: true`)
    expect(`${surface}: ${baum.includes('CHF')}`).toBe(`${surface}: false`)
    await ui.unmount()
  }
})

test('English version: no exchange-rate request with API costs on', { options: { apiCost: true } }, async ($, on) => {
  const uhr = mock.clock(on, { now: T0 })
  const abrufe: string[] = []
  mock.store(on)
  mock.env(on, { USERPROFILE: 'C:\\U' })
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 1000, window: 200000, percent: 0 }, rateLimits: [] } }) as never)
  on('command.register', () => ({ value: {} }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }) as never)
  on('session.id', () => ({ value: 's1' }) as never)
  on('tool.list', () => ({ value: [] }) as never)
  on('process.run', () => ({ value: { stdout: '', stderr: '', exitCode: 0 } }) as never)
  on('fs.write', () => ({ value: undefined }) as never)
  on('fs.list', () => ({ value: [] }) as never)
  on('fs.read', () => {
    throw new Error('nope')
  })
  on('http.fetch', ($, e) => {
    abrufe.push(String((e as { url: string }).url))
    throw new Error('offline')
  })
  await $.session.start({ cwd: 'C:\\P', surface: 'desktop', isInteractive: true })
  // the German version asks for the rate right at the start
  await uhr.advance(2000)
  // the bar does fetch other things (status page), so an empty list would prove nothing
  expect(abrufe.some(u => u.includes('status.claude.com'))).toBe(true)
  expect(abrufe.filter(u => u === KURS_URL)).toEqual([])
})
