// Bündel F4 (09.10.2026): Fehlerfang in session.start, Ortssuche, tasklist-Filter und Versionsanzeige.
// Jeder Test zeigte am alten Stand das Fehlverhalten und hält die Korrektur fest.
import { expect, mock, test } from 'claude-code/testing'

import { STATUS_URL, VERSION_URL } from './system'

type On = Parameters<Parameters<typeof test>[1]>[1]
type Dollar = Parameters<Parameters<typeof test>[1]>[0]
type Antwort = { status: number; ok: boolean; headers: Record<string, string>; text: string }
type Tasklist = { stdout: string; stderr: string; exitCode: number }

const T0 = Date.parse('2026-10-07T10:00:00Z')
const ORT_URL = 'https://geocoding-api.open-meteo.com/v1/search?name=Bern'
const WETTER_URL = 'https://api.open-meteo.com/v1/forecast?latitude='
const ok = (text: string): Antwort => ({ status: 200, ok: true, headers: {}, text })

// Ortssuche und Wetter von Open-Meteo antworten
function wetterNetz(url: string): Antwort | undefined {
  if (url.startsWith(ORT_URL)) return ok(JSON.stringify({ results: [{ latitude: 46.95, longitude: 7.45, name: 'Bern' }] }))
  if (url.startsWith(WETTER_URL)) return ok(JSON.stringify({ current: { temperature_2m: 12.3, dew_point_2m: 5.1, relative_humidity_2m: 61 } }))
  return undefined
}

// Grundmocks für session.start; http.fetch antwortet je Adresse (sonst offline). Zurück kommen die Adressen
// der Abrufe und die Namen der registrierten Befehle.
function basis(
  on: On,
  extra: {
    usageFehlt?: boolean
    tasklist?: Tasklist
    fetch?: (url: string) => Antwort | undefined
    ohneStore?: boolean
    sitzungen?: Record<string, string>
    version?: string
  } = {},
) {
  const abrufe: string[] = []
  const befehle: string[] = []
  if (!extra.ohneStore) mock.store(on)
  mock.env(on, { USERPROFILE: 'C:\\U' })
  on('session.usage', () => {
    if (extra.usageFehlt) throw new Error('keine Nutzungsdaten')
    return { value: { startedAt: 0, context: { tokens: 1000, window: 200000, percent: 0 }, rateLimits: [] } } as never
  })
  on('command.register', ($, e) => {
    befehle.push(String((e as { name: string }).name))
    return { value: {} } as never
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }) as never)
  on('session.id', () => ({ value: 's1' }) as never)
  on('tool.list', () => ({ value: [] }) as never)
  on('process.run', () => ({ value: extra.tasklist ?? { stdout: '', stderr: '', exitCode: 0 } }) as never)
  on('fs.write', () => ({ value: undefined }) as never)
  on('fs.list', ($, e) => {
    const p = String((e as { path: string }).path)
    const namen = p.endsWith('sessions') ? Object.keys(extra.sitzungen ?? {}) : []
    return { value: namen.map(name => ({ name, kind: 'file', size: 1, mtimeMs: 0 })) } as never
  })
  on('fs.read', ($, e) => {
    const p = String((e as { path: string }).path)
    const inhalt = p.includes('sessions') ? extra.sitzungen?.[p.slice(p.lastIndexOf('\\') + 1)] : undefined
    if (inhalt !== undefined) return { value: inhalt } as never
    throw new Error('nope')
  })
  if (extra.version !== undefined) on('session.version', () => ({ value: { version: extra.version } }) as never)
  on('http.fetch', ($, e) => {
    const url = String((e as { url: string }).url)
    abrufe.push(url)
    const r = extra.fetch?.(url)
    if (!r) throw new Error('offline')
    return { value: r } as never
  })
  return { abrufe, befehle }
}

function grund(on: On) {
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
}

// Die Leiste einmal zeichnen, ganzer Baum als Text
async function leiste($: Dollar) {
  const ui = await $.ui.mount({ plugin: 'roqam-de', surface: 'desktop', component: 'AbovePrompt', props: { bodyColumns: 160 }, viewport: { columns: 160, rows: 40 } })
  const t = JSON.stringify(await ui.drawn())
  await ui.unmount()
  return t
}

const start = ($: Dollar) => $.session.start({ cwd: 'C:\\P', surface: 'desktop', isInteractive: true })

// ── E4: session.start ohne Fehlerfang ────────────────────────────────────────────────────────────────────────

test('E4: scheitert $.session.usage(), richtet session.start den Rest trotzdem ein', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  const { abrufe, befehle } = basis(on, { usageFehlt: true })
  grund(on)
  await start($)
  await clock.advance(2000)
  const t = await leiste($)
  expect({ status: abrufe.includes(STATUS_URL), befehl: befehle.includes('aktion-gesehen'), leiste: t.includes('Sichern') }).toEqual({
    status: true,
    befehl: true,
    leiste: true,
  })
})

// ── C-A7: tasklist als Filter der Chat-Liste ─────────────────────────────────────────────────────────────────

const eigeneSitzung = { '1234.json': JSON.stringify({ pid: 1234, sessionId: 's1', status: 'idle', entrypoint: 'claude-desktop', name: 'Dieser Chat' }) }

test('A7a: tasklist mit Fehler (Exit 1, leer) filtert keinen Chat weg', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  basis(on, { tasklist: { stdout: '', stderr: 'FEHLER: Der RPC-Server ist nicht verfügbar.', exitCode: 1 }, sitzungen: eigeneSitzung })
  grund(on)
  await start($)
  await clock.advance(1000)
  const t = await leiste($)
  expect({ einer: t.includes('1 Chat'), keiner: t.includes('0 Chats') }).toEqual({ einer: true, keiner: false })
})

test('A7b: tasklist in fremdem Format (kein CSV) filtert keinen Chat weg', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  basis(on, { tasklist: { stdout: 'Abbildname  PID  Sitzungsname\nobs64.exe  1234  Console', stderr: '', exitCode: 0 }, sitzungen: eigeneSitzung })
  grund(on)
  await start($)
  await clock.advance(1000)
  const t = await leiste($)
  expect({ einer: t.includes('1 Chat'), keiner: t.includes('0 Chats') }).toEqual({ einer: true, keiner: false })
})

test('A7c: Gegenprobe – brauchbare CSV-Liste filtert beendete Chats weiter', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  basis(on, {
    tasklist: { stdout: '"claude.exe","1234","Console","1","10 K"\n"System","4","Services","0","8 K"', stderr: '', exitCode: 0 },
    sitzungen: { ...eigeneSitzung, '999.json': JSON.stringify({ pid: 999, sessionId: 's2', status: 'idle', entrypoint: 'claude-desktop', name: 'Alter Chat' }) },
  })
  grund(on)
  await start($)
  await clock.advance(1000)
  const t = await leiste($)
  expect({ einer: t.includes('1 Chat'), alter: t.includes('Alter Chat') }).toEqual({ einer: true, alter: false })
})

// ── C-A8: Versionsanzeige ────────────────────────────────────────────────────────────────────────────────────

test('A8: npm antwortet 200 mit HTML – eigene Version bleibt in der Leiste', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  basis(on, { version: '2.1.0', fetch: url => (url === VERSION_URL ? ok('<!doctype html><html><body>Wartung</body></html>') : undefined) })
  grund(on)
  await start($)
  await clock.advance(1000)
  expect(await leiste($)).toContain('v2.1.0')
})

test('A8 Gegenprobe: npm meldet eine neuere Version – Update-Hinweis', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  basis(on, { version: '2.1.0', fetch: url => (url === VERSION_URL ? ok('{"version":"2.2.0"}') : undefined) })
  grund(on)
  await start($)
  await clock.advance(1000)
  // nur das Wort «Update», die Nummer steht im Kärtchen (Vorgabe 15.10.2026)
  const l = await leiste($)
  expect(l).toContain('[{"text":"Update","color":"yellow"}]')
  expect(l).toContain('Neu: 2.2.0.')
  expect(l).not.toContain('Update 2.2.0')
})

// ── C-A9: Ortssuche ──────────────────────────────────────────────────────────────────────────────────────────

test('A9a: Ortssuche gelingt, Merken im Store scheitert – Wetter kommt trotzdem', { options: { ort: 'Bern' } }, async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  basis(on, { ohneStore: true, fetch: wetterNetz })
  on('store.get', () => ({ value: undefined }) as never)
  on('store.set', ($, e) => {
    if (String((e as { key: string }).key).startsWith('ort:')) throw new Error('EBUSY: resource busy or locked')
    return { value: undefined } as never
  })
  grund(on)
  await start($)
  await clock.advance(2000)
  expect(await leiste($)).toContain('Temp')
})

test('A9b: Ortssuche beim Start offline – im Wetter-Takt nachgeholt', { options: { ort: 'Bern' } }, async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  let netz = false
  const { abrufe } = basis(on, { fetch: url => (netz ? wetterNetz(url) : undefined) })
  grund(on)
  await start($)
  await clock.advance(2000)
  const vorher = (await leiste($)).includes('Temp')
  netz = true
  await clock.advance(10 * 60 * 1000 + 1000)
  const nachher = (await leiste($)).includes('Temp')
  expect({ vorher, nachher, ortsuchen: abrufe.filter(u => u.startsWith(ORT_URL)).length }).toEqual({ vorher: false, nachher: true, ortsuchen: 2 })
})
