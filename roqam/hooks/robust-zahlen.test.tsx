// Prüfung 09.10.2026, Bündel F1 (Antworten und Zahlen prüfen, Astro-Zeile robust): jeder Test zeigt das
// Fehlverhalten am alten Stand und hält die Korrektur fest. Auslöser sind Antworten fremder Dienste mit einer
// nicht-endlichen Zahl (1e999 → Infinity, im $.state null) oder in fremder JSON-Form.
import { expect, mock, test } from 'claude-code/testing'

import { clock, cloudsDuring, darkness } from './nacht'
import { costSegment, nightParts, parseCredits, parseKurs, parseWetter, wetterParts } from './register'

type Fn = Parameters<typeof test>[1]
type On = Parameters<Fn>[1]
type Engine = Parameters<Fn>[0]

const T0 = Date.parse('2026-10-07T10:00:00Z')
const BERN = { lat: 46.9481, lon: 7.4474 }
const TOKYO = { lat: 35.6762, lon: 139.6503 }
const NULLWERT = null as unknown as number

// Grundmocks für session.start; http.fetch antwortet mit dem Text aus `netz` (undefined = offline, wirft)
function basis(on: On, netz: (url: string) => string | undefined, store?: Record<string, unknown>) {
  mock.store(on, store)
  mock.env(on, { USERPROFILE: 'C:/U' })
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 1000, window: 200000, percent: 0 }, rateLimits: [], cost: { usd: 1.5 } } }) as never)
  on('command.register', () => ({ value: {} }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }) as never)
  on('tool.list', () => ({ value: [] }) as never)
  on('process.run', () => ({ value: { stdout: '', stderr: '', exitCode: 0 } }) as never)
  on('fs.write', () => ({ value: undefined }) as never)
  on('fs.read', () => { throw new Error('nope') })
  on('fs.list', () => ({ value: [] }) as never)
  on('http.fetch', ($, e) => {
    const text = netz(e.url)
    if (text === undefined) throw new Error('offline')
    return { value: { status: 200, ok: true, headers: {}, text } } as never
  })
  unten(on)
}

// an Stelle der Engine unter dem Mod: ein leerer Kasten
function unten(on: On) {
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
}

async function leiste($: Engine): Promise<string> {
  const ui = await $.ui.mount({ plugin: 'roqam', surface: 'desktop', component: 'AbovePrompt', props: { bodyColumns: 160 }, viewport: { columns: 160, rows: 40 } })
  const baum = JSON.stringify(await ui.drawn())
  await ui.unmount()
  return baum
}

function ort(o: { lat: number; lon: number }, name: string): string {
  return JSON.stringify({ results: [{ name, latitude: o.lat, longitude: o.lon }] })
}

// Open-Meteo-Vorhersage: 72 Stundenwerte ab `ab` (Ortszeit) mit demselben Wolkenwert, als Text (1e999 geht nicht über JSON.stringify)
function vorhersage(offset: number, wolken: string, ab: string): string {
  const zeiten = Array.from({ length: 72 }, (_, i) => `"${new Date(Date.parse(`${ab}:00Z`) + i * 3600000).toISOString().slice(0, 16)}"`)
  const werte = Array.from({ length: 72 }, () => wolken)
  return `{"utc_offset_seconds":${offset},"hourly":{"time":[${zeiten.join(',')}],"cloud_cover":[${werte.join(',')}]}}`
}

function start($: Engine) {
  return $.session.start({ cwd: 'C:/P', surface: 'desktop', isInteractive: true })
}

test('A1: Higgsfield-Antwort credits 1e999 → Leiste bleibt da', { options: { higgsfield: true } }, async ($, on) => {
  const uhr = mock.clock(on, { now: T0 })
  basis(on, () => undefined)
  on('mcp.call', () => ({ value: { content: [{ type: 'text', text: '{"credits":1e999}' }], isError: false } }) as never)
  await start($)
  await uhr.advance(25 * 1000)
  // ungültige Credits: keine Higgsfield-Anzeige (seit 16.10.2026 kein Platzhalter mehr), die Leiste steht
  const baum = await leiste($)
  expect(baum).toContain('Ctx:')
  expect(baum).not.toContain('Higgsfield')
  expect(parseCredits('{"credits":1e999}')).toBeUndefined()
})

test('A2: Open-Meteo temperature_2m 1e999 → Leiste bleibt da', { options: { location: 'Bern' } }, async ($, on) => {
  const uhr = mock.clock(on, { now: T0 })
  basis(on, url => {
    if (url.includes('geocoding-api')) return ort(BERN, 'Bern')
    if (url.includes('current=')) return '{"current":{"temperature_2m":1e999,"dew_point_2m":5.5,"relative_humidity_2m":50}}'
    return undefined
  })
  await start($)
  await uhr.advance(1000)
  const baum = await leiste($)
  expect(baum).toContain('Feuchte')
  expect(baum).toContain('TP')
  expect(parseWetter('{"current":{"temperature_2m":1e999}}')).toBeUndefined()
})

test('A3: Open-Meteo cloud_cover 1e999 (Astro) → Leiste bleibt da', { options: { location: 'Bern' } }, async ($, on) => {
  const uhr = mock.clock(on, { now: T0 })
  basis(on, url => {
    if (url.includes('geocoding-api')) return ort(BERN, 'Bern')
    if (url.includes('hourly=cloud_cover')) return vorhersage(7200, '1e999', '2026-10-07T00:00')
    return undefined
  })
  await start($)
  await uhr.advance(1000)
  const baum = await leiste($)
  expect(baum).toContain('Dunkel')
  expect(baum).toContain('Wolken')
  const f = { utc_offset_seconds: 7200, hourly: { time: ['2026-10-07T20:00'], cloud_cover: [Infinity] } }
  expect(cloudsDuring(f, Date.parse('2026-10-07T18:00:00Z'), Date.parse('2026-10-07T20:00:00Z'))).toBeUndefined()
})

test('A1–A3: null aus einem früheren Lauf im State wirft beim Zeichnen nicht', { options: { higgsfield: true, location: 'Bern' } }, async ($, on) => {
  mock.clock(on, { now: T0 })
  unten(on)
  const n = { level: 'gut', start: T0 + 8 * 3600000, end: T0 + 18 * 3600000, offset: 7200, cloud: NULLWERT, moon: NULLWERT, isWaxing: true } as const
  on('state.get', { plugin: 'roqam', key: 'data' }, () => ({ value: { value: { ctx: 8, credits: NULLWERT }, version: 1 } }))
  on('state.get', { plugin: 'roqam', key: 'wetter' }, () => ({ value: { value: { temp: NULLWERT, hum: 50 }, version: 1 } }))
  on('state.get', { plugin: 'roqam', key: 'nacht' }, () => ({ value: { value: n, version: 1 } }))
  const baum = await leiste($)
  expect(['Feuchte', 'Wolken', 'Dunkel'].filter(t => !baum.includes(t))).toEqual([])
  // Credits null: keine Higgsfield-Anzeige statt eines Fehlers
  expect(baum).not.toContain('Higgsfield')
  expect(wetterParts({ temp: NULLWERT, hum: 50 }).map(p => `${p.label} ${p.value}`)).toEqual(['Feuchte 50.0%'])
  const parts = nightParts(n)
  expect(parts.map(p => p.label)).toEqual(['Himmel', 'Wolken', 'Dunkel'])
  expect(parts[1].value).toBe('?')
})

test('C-A6: Kurs 1e999 → Betrag in USD statt «0.00 CHF»', { options: { apiCost: true } }, async ($, on) => {
  const uhr = mock.clock(on, { now: T0 })
  basis(on, url => (url.includes('frankfurter') ? '{"rates":{"CHF":1e999}}' : undefined))
  await start($)
  await uhr.advance(1000)
  const baum = await leiste($)
  expect(baum).toContain('1.50 USD')
  expect(baum).not.toContain('CHF')
  expect(parseKurs('{"rates":{"CHF":1e999}}')).toBeUndefined()
  expect(costSegment(1.5, NULLWERT)?.value).toBe('1.50 USD')
})

test('C-A1/E3: 200 mit fremder JSON-Form → Dunkel und Mond trotzdem, keine unbehandelte Ablehnung', { options: { location: 'Bern' } }, async ($, on) => {
  const uhr = mock.clock(on, { now: T0 })
  basis(on, url => {
    if (url.includes('geocoding-api')) return ort(BERN, 'Bern')
    if (url.includes('hourly=cloud_cover')) return '{"error":true,"reason":"Daily limit"}'
    if (url.includes('7timer')) return '{"product":"astro","init":"2026100712"}'
    return undefined
  })
  await start($)
  await uhr.advance(1000)
  const baum = await leiste($)
  expect(baum).toContain('Dunkel')
  expect(baum).toContain('Mond')
})

// Nacht läuft (Bern, 08.10.2026 03:30 UTC), Nachtende kurz danach; erst offline (Nacht geschrieben), dann stören
async function nachtende($: Engine, on: On, uhr: ReturnType<typeof mock.clock>, netz: (url: string) => string | undefined, abrufe: number[]) {
  let ende: number | undefined
  on('state.set', { plugin: 'roqam', key: 'nacht' }, ($, e, next) => {
    ende = (e.value as { end?: number }).end
    return next(e)
  })
  basis(on, url => {
    if (url.includes('geocoding-api')) return ort(BERN, 'Bern')
    if (url.includes('hourly=cloud_cover') || url.includes('7timer')) {
      abrufe.push(uhr.now())
      return netz(url)
    }
    return undefined
  })
  await start($)
  await uhr.advance(1000)
  expect(await leiste($)).toContain('Dunkel')
  expect(ende).toBeDefined()
  return ende!
}

test('C-A2: nach dem Nachtende kein 30-s-Dauerabruf bei fremder JSON-Form', { options: { location: 'Bern' } }, async ($, on) => {
  const uhr = mock.clock(on, { now: Date.parse('2026-10-08T03:30:00Z') })
  let kaputt = false
  const abrufe: number[] = []
  const ende = await nachtende($, on, uhr, () => (kaputt ? '{}' : undefined), abrufe)
  kaputt = true
  await uhr.advance(ende - uhr.now() + 5 * 60 * 1000)
  // ein Nachholen (2 Abrufe) und höchstens der 30-min-Takt (2 Abrufe), nicht 10 Takte à 2
  expect(abrufe.filter(t => t >= ende).length).toBeLessThanOrEqual(4)
})

test('C-A2: scheitert das Schreiben, höchstens ein Nachholen je Nachtende', { options: { location: 'Bern' } }, async ($, on) => {
  const uhr = mock.clock(on, { now: Date.parse('2026-10-08T03:30:00Z') })
  let sperre = false
  on('state.set', { plugin: 'roqam', key: 'nacht' }, ($, e, next) => (sperre ? { deny: 'voll' } : next(e)))
  const abrufe: number[] = []
  const ende = await nachtende($, on, uhr, () => undefined, abrufe)
  sperre = true
  await uhr.advance(ende - uhr.now() + 5 * 60 * 1000)
  expect(abrufe.filter(t => t >= ende).length).toBeLessThanOrEqual(4)
})

const TOKYO_T0 = Date.parse('2026-10-09T10:00:00Z')
function tokyoNacht(): string {
  const d = darkness(TOKYO_T0, TOKYO.lat, TOKYO.lon)!
  return `${clock(d.start, 32400)}–${clock(d.end, 32400)}`
}

test('E8: Ausland – scheitert ein Abruf, bleibt der bekannte Versatz (Ortszeit statt Winterzeit)', { options: { location: 'Tokyo' } }, async ($, on) => {
  const uhr = mock.clock(on, { now: TOKYO_T0 })
  let erster = true
  basis(on, url => {
    if (url.includes('geocoding-api')) return ort(TOKYO, 'Tokyo')
    if (url.includes('hourly=cloud_cover') && erster) {
      erster = false
      return vorhersage(32400, '10', '2026-10-09T00:00')
    }
    return undefined
  })
  await start($)
  await uhr.advance(1000)
  const vorher = (await leiste($)).includes(tokyoNacht())
  await uhr.advance(30 * 60 * 1000)
  const nachher = (await leiste($)).includes(tokyoNacht())
  expect([vorher, nachher]).toEqual([true, true])
})

test('E8: gemerkter Versatz gilt auch in einer neuen Sitzung ohne Netz', { options: { location: 'Tokyo' } }, async ($, on) => {
  const uhr = mock.clock(on, { now: TOKYO_T0 })
  basis(on, () => undefined, { 'ort:tokyo': TOKYO, 'ort-offset:tokyo': 32400 })
  await start($)
  await uhr.advance(1000)
  expect(await leiste($)).toContain(tokyoNacht())
})
