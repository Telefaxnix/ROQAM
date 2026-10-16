// Bündel F4, Befund B4 (09.10.2026): Antworten, die erst nach dem Entladen des Mods eintreffen (hier: nach dem
// Testende, in echter Zeit), dürfen keine unbehandelte Ablehnung hinterlassen. Am alten Stand meldete der
// Prüfstand am Dateiende «a rejection nothing handled: … $.state.get refused». Eigene Datei, damit diese
// Meldung eindeutig hierher gehört.
import { expect, mock, test } from 'claude-code/testing'

const T0 = Date.parse('2026-10-07T10:00:00Z')

// antwortet erst nach dem Testende (echte Zeit, nicht die Uhr des Tests)
// setTimeout über globalThis, weil die Typprüfung des Mods keine Node- oder DOM-Bibliothek kennt
const zeitgeber = globalThis as unknown as { setTimeout: (f: () => void, ms: number) => unknown }
const spaet = <T>(wert: T, ms = 300) => new Promise<T>(r => zeitgeber.setTimeout(() => r(wert), ms))

test('B4: späte Antworten von tasklist, Modell, Status und kleinem Modell ohne offene Ablehnung', async ($, on) => {
  mock.clock(on, { now: T0 })
  mock.store(on)
  mock.env(on, { USERPROFILE: 'C:\\U' })
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 1000, window: 200000, percent: 0 }, rateLimits: [] } }) as never)
  on('command.register', () => ({ value: {} }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }) as never)
  on('turn.start', ($, e) => ({ turnId: e.turnId }) as never)
  on('session.id', () => ({ value: 's1' }) as never)
  on('tool.list', () => ({ value: [] }) as never)
  on('fs.write', () => ({ value: undefined }) as never)
  on('fs.read', () => { throw new Error('nope') })
  on('fs.list', () => ({ value: [] }) as never)
  // aufnahmePruefen und refreshChats: tasklist spät
  on('process.run', () => spaet({ value: { stdout: '"obs64.exe","1234","Console","1","10 K"', stderr: '', exitCode: 0 } }) as never)
  // refreshModel: Modellname spät
  on('session.model', () => spaet({ value: 'claude-opus-5-5' }) as never)
  // refreshStatus: status.claude.com scheitert spät
  on('http.fetch', () => spaet(undefined).then(() => { throw new Error('offline') }) as never)
  // zielZusammenfassen: kleines Modell antwortet spät und abgebrochen
  on('model.complete', () => spaet({ value: { isAnswered: false, reason: 'aborted' } }) as never)
  await $.session.start({ cwd: 'C:\\P', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'Baue X', turnId: 't1' })
  expect(true).toBe(true)
})

// Nachlauf: hält den Prüfstand so lange offen, bis die späten Antworten des Tests davor eingetroffen sind
test('B4 Nachlauf: die späten Antworten treffen nach dem Entladen ein', async () => {
  await new Promise<void>(r => zeitgeber.setTimeout(() => r(), 800))
  expect(true).toBe(true)
})
