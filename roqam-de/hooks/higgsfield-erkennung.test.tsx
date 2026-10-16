// Ab Werk an (Vorgabe Dominik 16.10.2026): API-Kosten und Higgsfield. Higgsfield erscheint nur, wenn der Connector da
// ist; ohne Connector keine Anzeige und keine Abfrage. Wird er später verbunden, findet ihn die nächste Suche (alle 5 min).
import { expect, mock, test } from 'claude-code/testing'

import { readOptions } from './register'

type Fn = Extract<Parameters<typeof test>[1], (...args: never[]) => unknown>
type On = Parameters<Fn>[1]
type Engine = Parameters<Fn>[0]

const T0 = Date.parse('2026-10-07T10:00:00Z')
const HIGGSFIELD = ['mcp__claude_ai_Higgsfield__balance', 'mcp__claude_ai_Higgsfield__generate_video']

// Grundmocks; `werkzeuge()` liefert die aktuelle Werkzeugliste, `abfragen` zählt die Higgsfield-Abfragen
function basis(on: On, werkzeuge: () => string[], abfragen: string[]) {
  mock.store(on)
  mock.env(on, { USERPROFILE: 'C:/U' })
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 1000, window: 200000, percent: 0 }, rateLimits: [], cost: { usd: 1.5 } } }) as never)
  on('command.register', () => ({ value: {} }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }) as never)
  on('tool.list', () => ({ value: werkzeuge().map(name => ({ name })) }) as never)
  on('mcp.call', ($, e) => {
    abfragen.push(`${e.server} ${e.tool}`)
    return { value: { content: [{ type: 'text', text: '{"credits":182}' }], isError: false } } as never
  })
  on('process.run', () => ({ value: { stdout: '', stderr: '', exitCode: 0 } }) as never)
  on('fs.write', () => ({ value: undefined }) as never)
  on('fs.read', () => { throw new Error('nope') })
  on('fs.list', () => ({ value: [] }) as never)
  on('http.fetch', () => { throw new Error('offline') })
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
}

async function leiste($: Engine): Promise<string> {
  const ui = await $.ui.mount({ plugin: 'roqam-de', surface: 'desktop', component: 'AbovePrompt', props: { bodyColumns: 160 } as never, viewport: { columns: 160, rows: 40 } })
  const baum = JSON.stringify(await ui.drawn())
  await ui.unmount()
  return baum
}

function start($: Engine) {
  return $.session.start({ cwd: 'C:/P', surface: 'desktop', isInteractive: true })
}

test('ab Werk: API-Kosten und Higgsfield an, ausdrücklich aus bleibt aus', () => {
  expect(readOptions({})).toMatchObject({ apiKosten: true, higgsfield: true })
  expect(readOptions(undefined)).toMatchObject({ apiKosten: true, higgsfield: true })
  expect(readOptions({ apiKosten: false, higgsfield: false })).toMatchObject({ apiKosten: false, higgsfield: false })
})

test('ohne Higgsfield-Connector: keine Anzeige, keine Abfrage', async ($, on) => {
  const uhr = mock.clock(on, { now: T0 })
  const abfragen: string[] = []
  basis(on, () => [], abfragen)
  await start($)
  await uhr.advance(25 * 1000)
  await uhr.advance(5 * 60 * 1000)
  expect(await leiste($)).not.toContain('Higgsfield')
  expect(abfragen).toEqual([])
})

test('mit Higgsfield-Connector: Credits erscheinen von selbst', async ($, on) => {
  const uhr = mock.clock(on, { now: T0 })
  const abfragen: string[] = []
  basis(on, () => HIGGSFIELD, abfragen)
  await start($)
  await uhr.advance(25 * 1000)
  const baum = await leiste($)
  expect(baum).toContain('Higgsfield')
  expect(baum).toContain('/270Cr')
  expect(abfragen[0]).toBe('claude.ai Higgsfield balance')
})

test('Connector später verbunden: nächste Suche findet ihn, Credits erscheinen', async ($, on) => {
  const uhr = mock.clock(on, { now: T0 })
  const abfragen: string[] = []
  let verbunden = false
  basis(on, () => (verbunden ? HIGGSFIELD : []), abfragen)
  await start($)
  await uhr.advance(25 * 1000)
  expect(await leiste($)).not.toContain('Higgsfield')
  verbunden = true
  await uhr.advance(5 * 60 * 1000)
  expect(await leiste($)).toContain('/270Cr')
})

test('Higgsfield ausdrücklich aus: auch mit Connector keine Anzeige', { options: { higgsfield: false } }, async ($, on) => {
  const uhr = mock.clock(on, { now: T0 })
  const abfragen: string[] = []
  basis(on, () => HIGGSFIELD, abfragen)
  await start($)
  await uhr.advance(25 * 1000)
  expect(await leiste($)).not.toContain('Higgsfield')
  expect(abfragen).toEqual([])
})
