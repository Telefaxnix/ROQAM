// Eine Leiste für alle (16.10.2026): eigene Wetterstation per Einstellung wetterUrl (sonst Open-Meteo am Ort) und
// Ordner für «+ Neu» per Einstellung neuOrdner (sonst der Ordner dieses Chats).
import { expect, mock, test } from 'claude-code/testing'

import { parseWetter } from './register'

type Fn = Extract<Parameters<typeof test>[1], (...args: never[]) => unknown>
type On = Parameters<Fn>[1]
type Engine = Parameters<Fn>[0]

const T0 = Date.parse('2026-10-07T10:00:00Z')
const STATION = 'https://station.example/weather'
const STATION_ANTWORT = JSON.stringify({ latest: { temp: { value: 14.5 }, dew_point: { value: 9.2 }, hum: { value: 71 } } })
const ORT_ANTWORT = JSON.stringify({ results: [{ latitude: 46.95, longitude: 7.45, name: 'Bern' }] })
const OPEN_METEO = JSON.stringify({ current: { temperature_2m: 12.3, dew_point_2m: 5.1, relative_humidity_2m: 61 } })

// Grundmocks; jeder Abruf landet in `abrufe`, `gestartet` hält die gestarteten Programme samt Argumenten fest
function basis(on: On, abrufe: string[], gestartet: string[] = []) {
  mock.store(on)
  mock.env(on, { USERPROFILE: 'C:/U' })
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 1000, window: 200000, percent: 0 }, rateLimits: [] } }) as never)
  on('command.register', () => ({ value: {} }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }) as never)
  on('session.root', () => ({ value: 'C:\\P' }) as never)
  on('tool.list', () => ({ value: [] }) as never)
  on('process.run', ($, e) => {
    gestartet.push(e.argv.join(' '))
    return { value: { stdout: '', stderr: '', exitCode: 0 } } as never
  })
  on('fs.write', () => ({ value: undefined }) as never)
  on('fs.read', () => { throw new Error('nope') })
  on('fs.list', () => ({ value: [] }) as never)
  on('http.fetch', ($, e) => {
    abrufe.push(e.url)
    const text = e.url === STATION ? STATION_ANTWORT : e.url.includes('geocoding-api') ? ORT_ANTWORT : e.url.includes('current=') ? OPEN_METEO : undefined
    if (text === undefined) throw new Error('offline')
    return { value: { status: 200, ok: true, headers: {}, text } } as never
  })
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
}

async function leiste($: Engine) {
  return $.ui.mount({ plugin: 'roqam', surface: 'desktop', component: 'AbovePrompt', props: { bodyColumns: 160 } as never, viewport: { columns: 160, rows: 40 } })
}

test('eigene Station: Antwortformat latest.*.value wird gelesen, Open-Meteo weiter auch', () => {
  expect(parseWetter(STATION_ANTWORT)).toEqual({ temp: 14.5, dewPoint: 9.2, hum: 71 })
  expect(parseWetter(OPEN_METEO)).toEqual({ temp: 12.3, dewPoint: 5.1, hum: 61 })
  expect(parseWetter('{"latest":{}}')).toBeUndefined()
})

test('wetterUrl gesetzt: Temperatur, Taupunkt und Feuchte von der Station, kein Open-Meteo-Wetter', { options: { location: 'Bern', weatherUrl: STATION } }, async ($, on) => {
  const uhr = mock.clock(on, { now: T0 })
  const abrufe: string[] = []
  basis(on, abrufe)
  await $.session.start({ cwd: 'C:\\P', surface: 'desktop', isInteractive: true })
  await uhr.advance(1000)
  const ui = await leiste($)
  const baum = JSON.stringify(await ui.drawn())
  await ui.unmount()
  expect(abrufe).toContain(STATION)
  expect(abrufe.filter(u => u.includes('current='))).toEqual([])
  expect(['14.5°', '9.2°', '71.0%'].filter(t => !baum.includes(t))).toEqual([])
})

test('ohne wetterUrl: Wetter von Open-Meteo am Ort', { options: { location: 'Bern' } }, async ($, on) => {
  const uhr = mock.clock(on, { now: T0 })
  const abrufe: string[] = []
  basis(on, abrufe)
  await $.session.start({ cwd: 'C:\\P', surface: 'desktop', isInteractive: true })
  await uhr.advance(1000)
  const ui = await leiste($)
  const baum = JSON.stringify(await ui.drawn())
  await ui.unmount()
  expect(abrufe.some(u => u.includes('current='))).toBe(true)
  expect(abrufe).not.toContain(STATION)
  expect(baum).toContain('12.3°')
})

test('neuOrdner gesetzt: «+ Neu» öffnet den Chat in diesem Ordner statt im Ordner des Chats', { options: { newChatFolder: 'C:\\Projekte' } }, async ($, on) => {
  const uhr = mock.clock(on, { now: T0 })
  const gestartet: string[] = []
  basis(on, [], gestartet)
  await $.session.start({ cwd: 'C:\\P', surface: 'desktop', isInteractive: true })
  const ui = await leiste($)
  await ui.post({ aktion: 'neu' }, { in: 'knopf-neu' })
  await uhr.settle()
  await ui.unmount()
  expect(gestartet.some(g => g.includes('C%3A%5CProjekte'))).toBe(true)
  expect(gestartet.some(g => g.includes('folder=C%3A%5CP') && !g.includes('Projekte'))).toBe(false)
})

test('neuOrdner leer: «+ Neu» im Ordner dieses Chats', async ($, on) => {
  const uhr = mock.clock(on, { now: T0 })
  const gestartet: string[] = []
  basis(on, [], gestartet)
  await $.session.start({ cwd: 'C:\\P', surface: 'desktop', isInteractive: true })
  const ui = await leiste($)
  await ui.post({ aktion: 'neu' }, { in: 'knopf-neu' })
  await uhr.settle()
  await ui.unmount()
  expect(gestartet.some(g => g.includes('folder=C%3A%5CP'))).toBe(true)
})
