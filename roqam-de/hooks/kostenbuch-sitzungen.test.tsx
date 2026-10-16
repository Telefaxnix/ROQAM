// Bündel F5 (09.10.2026): Kostenbuch — Lesen vor Schreiben (B3) und Anzeige vor Schreiben (C-A10).
// Jeder Test zeigt am alten Stand das Fehlverhalten und hält die Korrektur fest.
import { expect, mock, test } from 'claude-code/testing'

type On = Parameters<Parameters<typeof test>[1]>[1]
const T0 = Date.parse('2026-10-07T10:00:00Z')
const ABO = '2026-09-14T06:59:56Z'
const HOME = 'C:\\U'
const PFAD = `${HOME}\\.claude\\api-kostenbuch.json`
const BAK = `${PFAD}.bak`
const PROJEKTE = `${HOME}\\.claude\\projects`
const MOUNT = { plugin: 'roqam-de', surface: 'desktop', component: 'AbovePrompt', props: { bodyColumns: 160 }, viewport: { columns: 160, rows: 40 } } as const

type Buch = Record<string, [number, number, string, string]>
const buchText = (antworten: Buch) => JSON.stringify({ version: 1, since: Date.parse(ABO), antworten })
const zeile = (id: string) =>
  JSON.stringify({ type: 'assistant', timestamp: '2026-10-01T10:00:00Z', message: { id, model: 'claude-opus-5-5', usage: { output_tokens: 1e6 } } })
// nur die gesuchten Kennungen einer Buchdatei (andere Tests derselben Datei können weitere im Speicher hinterlassen)
const davon = (text: string, ...gesucht: string[]) => Object.keys(JSON.parse(text).antworten).filter(id => gesucht.includes(id)).sort()

// «Platte»: Buch, Sicherung und die Verläufe eines Projekts; jedes Schreiben landet dort oder scheitert
type Platte = { buch: string; bak: string; verlauf: Record<string, string>; schreibfehler?: string }
type Protokoll = { art: 'read' | 'write'; pfad: string }

function basis(on: On, platte: Platte, protokoll: Protokoll[], beimLesen?: (pfad: string) => void) {
  mock.store(on)
  mock.env(on, { USERPROFILE: HOME })
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 1000, window: 200000, percent: 0 }, rateLimits: [] } }) as never)
  on('command.register', () => ({ value: {} }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }) as never)
  on('session.root', () => ({ value: 'C:\\P' }) as never)
  on('session.id', () => ({ value: 'chat-b' }) as never)
  on('tool.list', () => ({ value: [] }) as never)
  on('process.run', () => ({ value: { stdout: '', stderr: '', exitCode: 0 } }) as never)
  on('http.fetch', () => { throw new Error('offline') })
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  on('fs.list', ($, e) => {
    const p = String((e as { path: string }).path)
    if (p === PROJEKTE) return { value: [{ name: 'C--P', kind: 'dir', size: 0, mtimeMs: 0, isLink: false }] } as never
    if (p === `${PROJEKTE}\\C--P`)
      return { value: Object.entries(platte.verlauf).map(([name, text]) => ({ name, kind: 'file', size: text.length, mtimeMs: 1, isLink: false })) } as never
    return { value: [] } as never
  })
  on('fs.read', ($, e) => {
    const p = String((e as { path: string }).path)
    protokoll.push({ art: 'read', pfad: p })
    beimLesen?.(p)
    if (p.endsWith('.claude.json')) return { value: JSON.stringify({ oauthAccount: { subscriptionCreatedAt: ABO } }) } as never
    if (p === PFAD) return { value: platte.buch } as never
    if (p === BAK) return { value: platte.bak } as never
    const name = p.split('\\').pop() ?? ''
    if (name in platte.verlauf) return { value: platte.verlauf[name] } as never
    throw new Error(`fehlt: ${p}`)
  })
  on('fs.write', ($, e) => {
    const { path, text } = e as { path: string; text: string }
    protokoll.push({ art: 'write', pfad: path })
    if (platte.schreibfehler !== undefined && (path === PFAD || path === BAK)) throw new Error(platte.schreibfehler)
    if (path === PFAD) platte.buch = text
    if (path === BAK) platte.bak = text
    return { value: undefined } as never
  })
}

test('B3: andere Sitzung schreibt zwischen unserem Lesen und Schreiben — ihre Buchung bleibt in Datei und Sicherung', { options: { apiKosten: true, aktionen: false } }, async ($, on) => {
  const uhr = mock.clock(on, { now: T0 })
  const alt = buchText({ a2: [T0 - 1000, 5, 'c--x', 'chat-a'] })
  const platte: Platte = { buch: alt, bak: alt, verlauf: { 'f5-b3.jsonl': zeile('c2') } }
  const protokoll: Protokoll[] = []
  // Sitzung A legt b2 (aus einem Chat, dessen Verlauf gleich gelöscht wird) in beide Dateien, sobald wir die
  // Sicherung das erste Mal gelesen haben — also zwischen unserem Lesen und unserem Schreiben
  const mitB = buchText({ a2: [T0 - 1000, 5, 'c--x', 'chat-a'], b2: [T0 - 500, 2, 'c--x', 'chat-a'] })
  let geschehen = false
  basis(on, platte, protokoll, pfad => {
    if (pfad === BAK && !geschehen) {
      geschehen = true
      void Promise.resolve().then(() => {
        platte.bak = mitB
        platte.buch = mitB
      })
    }
  })
  await $.session.start({ cwd: 'C:\\P', surface: 'desktop', isInteractive: true })
  await uhr.advance(1000)
  expect(protokoll.filter(p => p.art === 'write').map(p => p.pfad)).toEqual([BAK, PFAD])
  expect(davon(platte.buch, 'a2', 'b2', 'c2'), 'Buch nach unserem Schreiben').toEqual(['a2', 'b2', 'c2'])
  expect(davon(platte.bak, 'a2', 'b2', 'c2'), 'Sicherung nach unserem Schreiben').toEqual(['a2', 'b2', 'c2'])
})

test('C-A10: Kostenbuch nicht schreibbar — API-Kosten erscheinen trotzdem, das Schreiben wird nachgeholt', { options: { apiKosten: true, aktionen: false } }, async ($, on) => {
  const uhr = mock.clock(on, { now: T0 })
  const leer = buchText({})
  const platte: Platte = { buch: leer, bak: leer, verlauf: { 'f5-a10.jsonl': zeile('c10') }, schreibfehler: 'EBUSY: resource busy or locked' }
  const protokoll: Protokoll[] = []
  basis(on, platte, protokoll)
  await $.session.start({ cwd: 'C:\\P', surface: 'desktop', isInteractive: true })
  await uhr.advance(1000)
  const ui = await $.ui.mount(MOUNT)
  const gesperrt = JSON.stringify(await ui.drawn())
  // Datei wieder frei, Verlauf des Chats inzwischen gelöscht: der nächste Takt schreibt die Buchung aus dem Speicher
  platte.schreibfehler = undefined
  platte.verlauf = {}
  await uhr.advance(10 * 60 * 1000)
  const frei = JSON.stringify(await ui.drawn())
  await ui.unmount()
  expect(gesperrt, 'Leiste bei gesperrter Datei').toContain('API: ')
  expect(frei, 'Leiste nach dem Nachholen').toContain('API: ')
  expect(davon(platte.buch, 'c10'), 'Buch nach dem Nachholen').toEqual(['c10'])
  expect(davon(platte.bak, 'c10'), 'Sicherung nach dem Nachholen').toEqual(['c10'])
})
