// Hardcore-Test 09.10.2026, Runde 3 (S1-2, S1-3): Takte, deren State-Lesen verweigert wird (gesperrter State, oder
// eine späte Antwort nach dem Entladen des Mods), hinterliessen eine unbehandelte Ablehnung. Der Prüfstand meldet
// so etwas erst am Dateiende («the file ran to its end … a rejection nothing handled»), darum eine eigene Datei:
// läuft sie sauber durch, sind waechterTakt (5-s-Takt) und refreshNight (30-min-Takt) dicht. Gegenprobe gemacht.
import { expect, mock, test } from 'claude-code/testing'

type Body = Extract<Parameters<typeof test>[1], (...a: never[]) => unknown>
type On = Parameters<Body>[1]

const T0 = Date.parse('2026-10-07T10:00:00Z')
const BERN = JSON.stringify({ results: [{ name: 'Bern', latitude: 46.95, longitude: 7.45 }] })

function basis(on: On) {
  mock.store(on)
  mock.env(on, { USERPROFILE: 'C:/U' })
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 1000, window: 200000, percent: 0 }, rateLimits: [] } }) as never)
  on('command.register', () => ({ value: {} }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }) as never)
  on('tool.list', () => ({ value: [] }) as never)
  on('process.run', () => ({ value: { stdout: '', stderr: '', exitCode: 0 } }) as never)
  on('fs.write', () => ({ value: undefined }) as never)
  on('fs.read', () => {
    throw new Error('nope')
  })
  on('fs.list', () => ({ value: [] }) as never)
  // nur die Ortssuche antwortet, die Vorhersagen sind offline
  on('http.fetch', ($, e) => {
    if (String(e.url).includes('geocoding-api')) return { value: { status: 200, ok: true, headers: {}, text: BERN } } as never
    throw new Error('offline')
  })
  on('ui.log', () => ({ value: undefined }) as never)
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
}

test('Runde 3 S1-2: waechter-State verweigert → der 5-s-Takt hinterlässt keine unbehandelte Ablehnung', async ($, on) => {
  const uhr = mock.clock(on, { now: T0 })
  basis(on)
  let sperre = false
  on('state.get', { plugin: 'roqam-de', key: 'waechter' }, ($, e, next) => (sperre ? { deny: 'waechter gesperrt' } : next(e)))
  await $.session.start({ cwd: 'C:/P', surface: 'desktop', isInteractive: true })
  await uhr.advance(1000)
  sperre = true
  // ein Takt (5 s) mit gesperrtem State
  await uhr.advance(5 * 1000)
  expect(true).toBe(true)
})

test('Runde 3 S1-3: nacht-State verweigert → der 30-min-Takt von refreshNight hinterlässt keine unbehandelte Ablehnung', { options: { ort: 'Bern' } }, async ($, on) => {
  const uhr = mock.clock(on, { now: T0 })
  basis(on)
  let sperre = false
  on('state.get', { plugin: 'roqam-de', key: 'nacht' }, ($, e, next) => (sperre ? { deny: 'nacht gesperrt' } : next(e)))
  await $.session.start({ cwd: 'C:/P', surface: 'desktop', isInteractive: true })
  await uhr.advance(1000)
  sperre = true
  await uhr.advance(30 * 60 * 1000)
  expect(true).toBe(true)
})
