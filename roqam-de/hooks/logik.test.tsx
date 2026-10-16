// Logik-Prüfung 09.10.2026: zwei unabhängige Prüfungen fanden diese Fehler; jeder Test hält die Korrektur fest
import { expect, mock, test } from 'claude-code/testing'

import { answersInFile } from './kosten'

type On = Parameters<Parameters<typeof test>[1]>[1]

// Grundmocks für session.start
function basis(on: On, extra: { tools?: string[]; tasklist?: string; ohne?: string[]; store?: Record<string, unknown> } = {}) {
  const o = (n: string) => !(extra.ohne ?? []).includes(n)
  mock.store(on, extra.store)
  mock.env(on, { USERPROFILE: 'C:\\U' })
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 1000, window: 200000, percent: 0 }, rateLimits: [] } }) as never)
  on('command.register', () => ({ value: {} }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }) as never)
  on('tool.list', () => ({ value: (extra.tools ?? []).map(name => ({ name })) }) as never)
  if (o('process.run')) on('process.run', () => ({ value: { stdout: extra.tasklist ?? '', stderr: '', exitCode: 0 } }) as never)
  on('fs.write', () => ({ value: undefined }) as never)
  if (o('fs.read')) on('fs.read', () => { throw new Error('nope') })
  if (o('fs.list')) on('fs.list', () => ({ value: [] }) as never)
  on('http.fetch', () => { throw new Error('offline') })
}

test('1: Higgsfield-Credits auch über den App-Connector (UUID)', { options: { higgsfield: true } }, async ($, on) => {
  const clock = mock.clock(on, { now: Date.parse('2026-10-07T10:00:00Z') })
  basis(on, { tools: ['mcp__e7532db9-uuid__balance', 'mcp__e7532db9-uuid__generate_video'] })
  const servers: string[] = []
  on('mcp.call', ($, e) => {
    servers.push(e.server)
    if (e.server === 'e7532db9-uuid') return { value: { content: [{ type: 'text', text: '{"credits":100}' }], isError: false } } as never
    throw new Error('not connected: ' + e.server)
  })
  await $.session.start({ cwd: 'C:\\P', surface: 'desktop', isInteractive: true })
  await clock.advance(5 * 60 * 1000)
  expect(servers.includes('e7532db9-uuid')).toBe(true)
})

const T0 = Date.parse('2026-10-07T10:00:00Z')
async function knopfPunkt(ui: { drawn: (o?: { in: string }) => Promise<unknown> }) {
  const t = JSON.stringify(await ui.drawn({ in: 'knopf-aufnahme' }))
  return t.includes('"red"') ? 'rot' : 'weiss'
}
function grund(on: On) {
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
}
type Z = { value?: { aufgaben?: unknown[]; ziel?: string; guthaben?: unknown[] } }

test('2: Knopf schaltet bei laufendem OBS aus; nach OBS-Ende aus, beim nächsten Start wieder an', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  let tasklist = '"obs64.exe","1234","Console","1","10 K"\n'
  basis(on, { ohne: ['process.run'] })
  on('process.run', () => ({ value: { stdout: tasklist, stderr: '', exitCode: 0 } }) as never)
  grund(on)
  await $.session.start({ cwd: 'C:\\P', surface: 'desktop', isInteractive: true })
  await clock.advance(1000)
  const ui = await $.ui.mount({ plugin: 'roqam-de', surface: 'desktop', component: 'AbovePrompt', props: { bodyColumns: 160 }, viewport: { columns: 160, rows: 40 } })
  const z: string[] = [await knopfPunkt(ui)]
  await ui.post({ umschalten: true }, { in: 'knopf-aufnahme' })
  z.push(await knopfPunkt(ui))
  tasklist = ''
  await clock.advance(20000)
  z.push(await knopfPunkt(ui))
  tasklist = '"obs64.exe","1234","Console","1","10 K"\n'
  await clock.advance(20000)
  z.push(await knopfPunkt(ui))
  expect(z.join(' / ')).toBe('rot / weiss / weiss / rot')
  await ui.unmount()
})

test('3: Aufnahme-Modus: Wächter-Rückfrage ohne Befehl und Pfad', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  basis(on, { store: { 'aufnahme-hand': true } })
  on('tool.call', { tool: 'Bash' }, () => ({ result: 'ok' }))
  const fragen: string[] = []
  on('tool.call', { tool: 'AskUserQuestion' }, ($, e) => {
    const q = (e as unknown as { questions: { question: string }[] }).questions[0].question
    fragen.push(q)
    return { result: { questions: [], answers: { [q]: 'Weiterlaufen' } } }
  })
  await $.session.start({ cwd: 'C:/P', surface: 'desktop', isInteractive: true })
  await clock.advance(1000)
  for (let i = 0; i < 3; i++) await $.tool.call({ tool: 'Bash', command: 'type C:\\Geheim\\Kunde-Meier\\vertrag.txt' } as never)
  expect(fragen.length).toBe(1)
  expect(fragen[0]).not.toContain('Geheim')
})

test('4a: «Ja» lässt den Fortschritt stehen', async ($, on) => {
  mock.clock(on, { now: T0 })
  on('tool.call', { tool: 'TodoWrite' }, () => ({ result: 'ok' }))
  on('model.complete', () => ({ value: { isAnswered: true, text: '-' } }) as never)
  on('turn.start', ($, e) => ({ turnId: e.turnId }) as never)
  grund(on)
  await $.turn.start({ text: 'Baue X', turnId: 't1' })
  await $.tool.call({ tool: 'TodoWrite', todos: [{ content: 'A', status: 'completed', activeForm: 'A' }, { content: 'B', status: 'in_progress', activeForm: 'B' }] } as never)
  const m = () => $.ui.mount({ plugin: 'roqam-de', surface: 'desktop', component: 'AbovePrompt', props: { bodyColumns: 160 }, viewport: { columns: 160, rows: 40 } })
  let ui = await m()
  const vor = JSON.stringify(await ui.drawn()).includes(' 1/2')
  await ui.unmount()
  await $.turn.start({ text: 'Ja', turnId: 't2' })
  ui = await m()
  const nach = JSON.stringify(await ui.drawn()).includes(' 1/2')
  await ui.unmount()
  expect([vor, nach]).toEqual([true, true])
})

test('4b: verspätete Zusammenfassung überschreibt die neuere nicht', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  on('model.complete', async ($, e) => {
    const p = String((e as { prompt: string }).prompt)
    if (p.includes('ALT')) {
      await clock.sleep(15000)
      return { value: { isAnswered: true, text: 'Altes Ziel bearbeiten' } } as never
    }
    await clock.sleep(1000)
    return { value: { isAnswered: true, text: 'Neues Ziel bearbeiten' } } as never
  })
  on('turn.start', ($, e) => ({ turnId: e.turnId }) as never)
  grund(on)
  const zielText = async () => {
    const ui = await $.ui.mount({ plugin: 'roqam-de', surface: 'desktop', component: 'AbovePrompt', props: { bodyColumns: 160 }, viewport: { columns: 160, rows: 40 } })
    const t = /---> ([^"]*)/.exec(JSON.stringify(await ui.drawn()))?.[1]
    await ui.unmount()
    return t
  }
  await $.turn.start({ text: 'Auftrag ALT', turnId: 't1' })
  await $.turn.start({ text: 'Auftrag NEU', turnId: 't2' })
  await clock.advance(2000)
  const a = await zielText()
  await clock.advance(20000)
  const b = await zielText()
  expect([a, b]).toEqual(['Neues Ziel bearbeiten', 'Neues Ziel bearbeiten'])
})

// Seit 15.10.2026 keine Guthaben mehr (Wahl Dominik: von Hand nachgeführt, veralteten sie); die Aktionsprüfung läuft
// weiter, auch ohne API-Kosten und ohne Abo-Datum
test('5: Aktionsprüfung auch ohne API-Kosten und ohne Abo-Datum; Guthaben nur aus statusleiste-guthaben.json', { options: { apiKosten: false, aktionen: true } }, async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  basis(on, { ohne: ['fs.read'] })
  grund(on)
  const gelesen: string[] = []
  on('fs.read', ($, e) => {
    const p = String((e as { path: string }).path)
    gelesen.push(p)
    if (p.endsWith('.claude.json')) return { value: JSON.stringify({ oauthAccount: {} }) } as never
    if (p.endsWith('cockpit-guthaben.json')) return { value: JSON.stringify([{ name: 'Cloud', rest: 5, ablauf: '2026-12-01' }]) } as never
    throw new Error('nope')
  })
  await $.session.start({ cwd: 'C:\\P', surface: 'desktop', isInteractive: true })
  await clock.advance(1000)
  const ui = await $.ui.mount({ plugin: 'roqam-de', surface: 'desktop', component: 'AbovePrompt', props: { bodyColumns: 160 }, viewport: { columns: 160, rows: 40 } })
  expect(gelesen.some(p => p.endsWith('.claude.json'))).toBe(true)
  // gelesen wird nur die Guthaben-Datei der Leiste; die alte cockpit-guthaben.json nicht, darum kein «Cloud»
  const guthabenDateien = gelesen.filter(p => p.includes('guthaben'))
  expect(guthabenDateien.length > 0 && guthabenDateien.every(p => p.endsWith('statusleiste-guthaben.json'))).toBe(true)
  expect(JSON.stringify(await ui.drawn())).not.toContain('Cloud')
  await ui.unmount()
})

test('5b: ohne API-Kosten keine Verläufe lesen', { options: { apiKosten: false, aktionen: true } }, async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  basis(on, { ohne: ['fs.read', 'fs.list'] })
  const gelistet: string[] = []
  on('fs.list', ($, e) => {
    gelistet.push(String((e as { path: string }).path))
    return { value: [] } as never
  })
  on('fs.read', ($, e) => {
    const p = String((e as { path: string }).path)
    if (p.endsWith('.claude.json')) return { value: JSON.stringify({ oauthAccount: { subscriptionCreatedAt: '2026-01-05T00:00:00Z' } }) } as never
    throw new Error('nope')
  })
  on('session.root', () => ({ value: 'C:\\P' }) as never)
  on('session.id', () => ({ value: 's1' }) as never)
  await $.session.start({ cwd: 'C:\\P', surface: 'desktop', isInteractive: true })
  await clock.advance(1000)
  const n1 = gelistet.filter(p => p.endsWith('projects')).length
  await clock.advance(10 * 60 * 1000)
  const n2 = gelistet.filter(p => p.endsWith('projects')).length
  expect([n1, n2]).toEqual([0, 0])
})

test('6: Ort leer: alte Werte nicht mehr zeichnen', { options: { ort: '' } }, async ($, on) => {
  mock.clock(on, { now: T0 })
  grund(on)
  on('state.get', { plugin: 'roqam-de', key: 'nacht' }, () => ({ value: { value: { level: 'gut', start: T0, end: T0 + 3600000, offset: 7200000, cloud: 10, moon: 50, isWaxing: true }, version: 1 } }))
  on('state.get', { plugin: 'roqam-de', key: 'wetter' }, () => ({ value: { value: { temp: 12.3 }, version: 1 } }))
  const ui = await $.ui.mount({ plugin: 'roqam-de', surface: 'desktop', component: 'AbovePrompt', props: { bodyColumns: 160 }, viewport: { columns: 160, rows: 40 } })
  const t = JSON.stringify(await ui.drawn())
  expect(t.includes('Wolken') || t.includes('Temp')).toBe(false)
  await ui.unmount()
})

test('7: bei offener Rückfrage gilt eine Wiederholung nicht als bestätigt', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  on('tool.call', { tool: 'Bash' }, () => ({ result: 'ok' }))
  const fragen: string[] = []
  on('tool.call', { tool: 'AskUserQuestion' }, async ($, e) => {
    const q = (e as unknown as { questions: { question: string }[] }).questions[0].question
    fragen.push(q)
    // nur die erste Frage bleibt eine Minute offen
    if (fragen.length === 1) await clock.sleep(60000)
    return { result: { questions: [], answers: { [q]: 'Abbrechen' } } }
  })
  for (let i = 0; i < 2; i++) await $.tool.call({ tool: 'Bash', command: 'A' } as never)
  const offen = $.tool.call({ tool: 'Bash', command: 'A' } as never)
  await clock.settle()
  const abgelehnt: boolean[] = []
  for (let i = 0; i < 5; i++) abgelehnt.push('deny' in (await $.tool.call({ tool: 'Bash', command: 'B' } as never)))
  await clock.advance(61000)
  await offen
  for (let i = 0; i < 3; i++) abgelehnt.push('deny' in (await $.tool.call({ tool: 'Bash', command: 'B' } as never)))
  expect(fragen.length).toBeGreaterThan(1)
  expect(abgelehnt.includes(true)).toBe(true)
})

test('9b: Zeichnen schreibt keine Fehlersuch-Datei', async ($, on) => {
  mock.clock(on, { now: T0 })
  mock.env(on, { USERPROFILE: 'C:\\U' })
  grund(on)
  const geschrieben: string[] = []
  on('fs.write', ($, e) => {
    geschrieben.push(String((e as { path: string }).path))
    return { value: undefined } as never
  })
  const ui = await $.ui.mount({ plugin: 'roqam-de', surface: 'desktop', component: 'AbovePrompt', props: { bodyColumns: 160 }, viewport: { columns: 160, rows: 40 } })
  await ui.unmount()
  expect(geschrieben.some(p => p.includes('kasten-zeilen'))).toBe(false)
})

test('2b: OBS ohne Klick: nach OBS-Ende aus, Klick schaltet an', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  let tasklist = '"obs64.exe","1234","Console","1","10 K"'
  basis(on, { ohne: ['process.run'] })
  on('process.run', () => ({ value: { stdout: tasklist, stderr: '', exitCode: 0 } }) as never)
  grund(on)
  await $.session.start({ cwd: 'C:\\P', surface: 'desktop', isInteractive: true })
  await clock.advance(1000)
  const ui = await $.ui.mount({ plugin: 'roqam-de', surface: 'desktop', component: 'AbovePrompt', props: { bodyColumns: 160 }, viewport: { columns: 160, rows: 40 } })
  const z: string[] = [await knopfPunkt(ui)]
  tasklist = ''
  await clock.advance(20000)
  z.push(await knopfPunkt(ui))
  await ui.post({ umschalten: true }, { in: 'knopf-aufnahme' })
  z.push(await knopfPunkt(ui))
  expect(z.join(' / ')).toBe('rot / weiss / rot')
  await ui.unmount()
})

test('9c: Modelle ohne Preis werden gemeldet statt still weggelassen', () => {
  const zeile = (model: string, id: string) =>
    JSON.stringify({ type: 'assistant', timestamp: '2026-10-07T10:00:00Z', message: { id, model, usage: { input_tokens: 1000, output_tokens: 100 } } })
  const fehlt = new Set<string>()
  const a = answersInFile([zeile('claude-opus-5-5', 'a'), zeile('claude-opus-4-8', 'b')].join('\n'), 0, fehlt)
  expect(a.size).toBe(1)
  expect([...fehlt]).toEqual(['claude-opus-4-8'])
})
