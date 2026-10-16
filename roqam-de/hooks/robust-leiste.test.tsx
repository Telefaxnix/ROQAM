// Bündel F2 (09.10.2026): Leiste nie leer – State-Form (A4), Client-Rückfall (D-A1), Zwei-Spalten-Index (G1), Knopf
// «+ Neu» (D-A2, E5). Jeder Test zeigte vor der Korrektur das Fehlverhalten. Die Tests zur Guthaben-Datei (C-A3, C-A4)
// fielen am 15.10.2026 mit der Guthaben-Anzeige weg.
import { expect, mock, test } from 'claude-code/testing'

type Body = Extract<Parameters<typeof test>[1], (...a: never[]) => unknown>
type Dollar = Parameters<Body>[0]
type On = Parameters<Body>[1]
type Surface = 'desktop' | 'terminal' | 'vscode' | 'mobile'
const T0 = Date.parse('2026-10-07T10:00:00Z')

// an Stelle der Engine: was unter der Leiste gezeichnet wird
function grund(on: On) {
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>UNTEN</Text>
  })
}

// Grundmocks für session.start (wie logik.test.tsx); lesen() liefert den Inhalt einer Datei oder nichts
function basis(on: On, lesen: (pfad: string) => string | undefined) {
  mock.store(on)
  mock.env(on, { USERPROFILE: 'C:\\U' })
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 1000, window: 200000, percent: 0 }, rateLimits: [] } }) as never)
  on('command.register', () => ({ value: {} }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }) as never)
  on('tool.list', () => ({ value: [] }) as never)
  on('process.run', () => ({ value: { stdout: '', stderr: '', exitCode: 0 } }) as never)
  on('fs.write', () => ({ value: undefined }) as never)
  on('fs.read', ($, e) => {
    const t = lesen(String((e as { path: string }).path))
    if (t === undefined) throw new Error('nope')
    return { value: t } as never
  })
  on('fs.list', () => ({ value: [] }) as never)
  on('http.fetch', () => {
    throw new Error('offline')
  })
}

function mount<P extends Surface>($: Dollar, surface: P, cols = 160) {
  return $.ui.mount({ plugin: 'roqam-de', surface, component: 'AbovePrompt', props: { bodyColumns: cols }, viewport: { columns: cols, rows: 40 } })
}

// gezeichneter Baum als Text (Knöpfe und Client-Wörter tragen ihren Text in den Props)
async function baum($: Dollar, surface: Surface, cols = 160) {
  const ui = await mount($, surface, cols)
  const t = JSON.stringify(await ui.drawn())
  await ui.unmount()
  return t
}

// Toasts mitschreiben
function toasts(on: On) {
  const liste: string[] = []
  on('ui.toast', ($, e) => {
    liste.push(e.text)
    return { value: undefined } as never
  })
  return liste
}

test('A4: falsch getypter State nimmt die Leiste nicht weg', { options: { apiKosten: true, aktionen: true, higgsfield: true, ort: 'Bern' } }, async ($, on) => {
  mock.clock(on, { now: T0 })
  grund(on)
  const gut = {
    data: { ctx: 8, fiveHour: 6, week: 9, credits: 100, chatUsd: 1.5, neueAktion: true, aktionZeilen: ['Gästepässe: 3 von 3 frei'], ohnePreis: [] },
    system: { status: { indicator: 'none', description: 'ok', incidents: [] }, version: '2.1.0', chats: [], connectors: ['X'] },
    wetter: { temp: 12 },
    nacht: { level: 'gut', start: T0, end: T0 + 3600000, offset: 7200000, cloud: 10, moon: 50, isWaxing: true },
  }
  // der State kann aus einer anderen Code-Fassung stammen (überlebt das Neuladen) oder null enthalten
  const faelle: [string, Partial<Record<keyof typeof gut, unknown>>][] = [
    ['data.credits null', { data: { ...gut.data, credits: null } }],
    ['data.ctx String', { data: { ...gut.data, ctx: '8' } }],
    ['data.chatUsd String', { data: { ...gut.data, chatUsd: '1' } }],
    // alter Stand mit Guthaben (vor 15.10.2026) und falsch getypte Aktionszeilen
    ['data.guthaben alt', { data: { ...gut.data, guthaben: [{ name: 'Cloud', kurz: 'Cloud $', rest: 5, ablauf: '2026-12-01' }] } }],
    ['data.aktionZeilen Objekt', { data: { ...gut.data, aktionZeilen: {} } }],
    ['data.aktionZeilen [null]', { data: { ...gut.data, aktionZeilen: [null] } }],
    ['data.neueAktion String', { data: { ...gut.data, neueAktion: 'ja' } }],
    ['data.ohnePreis String', { data: { ...gut.data, ohnePreis: 'x' } }],
    ['data null', { data: null }],
    ['wetter.temp String', { wetter: { temp: '12' } }],
    ['wetter null', { wetter: null }],
    ['nacht.cloud String', { nacht: { ...gut.nacht, cloud: '10' } }],
    ['nacht null', { nacht: null }],
    ['system.chats Objekt', { system: { ...gut.system, chats: {} } }],
    ['system.connectors String', { system: { ...gut.system, connectors: 'x' } }],
    ['system.status String', { system: { ...gut.system, status: 'x' } }],
    ['system.status ohne incidents', { system: { ...gut.system, status: { indicator: 'none', description: 'ok' } } }],
    ['system.version Zahl', { system: { ...gut.system, version: 5 } }],
    ['system null', { system: null }],
  ]
  let stand: Record<string, unknown> = gut
  let version = 1
  on('state.get', { plugin: 'roqam-de', key: 'data' }, () => ({ value: { value: stand.data, version } }) as never)
  on('state.get', { plugin: 'roqam-de', key: 'system' }, () => ({ value: { value: stand.system, version } }) as never)
  on('state.get', { plugin: 'roqam-de', key: 'wetter' }, () => ({ value: { value: stand.wetter, version } }) as never)
  on('state.get', { plugin: 'roqam-de', key: 'nacht' }, () => ({ value: { value: stand.nacht, version } }) as never)
  // Kontrolle: mit guten Werten ist alles da
  const kontrolle = await baum($, 'desktop')
  expect(['Ctx:', 'Neue Aktion', 'Temp', 'Wolken', 'Higgsfield', 'API:'].filter(w => !kontrolle.includes(w))).toEqual([])
  const fehlt: string[] = []
  for (const [name, aenderung] of faelle) {
    stand = { ...gut, ...aenderung }
    version++
    for (const surface of ['desktop', 'terminal'] as const) {
      if (!(await baum($, surface)).includes('Ctx:')) fehlt.push(`${surface}: ${name}`)
    }
  }
  expect(fehlt).toEqual([])
})

test('A4: wirft das Zeichnen trotzdem, bleibt eine Minimalzeile samt dem Darunterliegenden', async ($, on) => {
  mock.clock(on, { now: T0 })
  grund(on)
  // ein verweigerter State-Aufruf lässt read() ablehnen, das Zeichnen wirft (ein werfender Test-Hook würde nur
  // übersprungen, dann antwortet die Engine selbst)
  on('state.get', { plugin: 'roqam-de', key: 'data' }, () => ({ deny: 'State gesperrt' }) as never)
  const logs: string[] = []
  on('ui.log', ($, e) => {
    logs.push(`${e.to}: ${e.text}`)
    return { value: undefined } as never
  })
  for (const surface of ['desktop', 'terminal'] as const) {
    const t = await baum($, surface)
    expect(t).toContain('Cockpit: Zeichnen fehlgeschlagen')
    expect(t).toContain('UNTEN')
  }
  expect(logs.some(l => l.startsWith('debug: Cockpit: Zeichnen fehlgeschlagen'))).toBe(true)
})

test('D-A1: VS Code und Handy zeichnen Wörter und Knöpfe als Text und Button, nicht als leeres Client', async ($, on) => {
  mock.clock(on, { now: T0 })
  grund(on)
  on('state.get', { plugin: 'roqam-de', key: 'system' }, () => ({ value: { value: { version: '2.1.0', latest: '2.2.0', chats: [], connectors: ['X'] }, version: 1 } }) as never)
  const fehlt: string[] = []
  for (const surface of ['vscode', 'mobile'] as const) {
    for (const cols of [40, 160]) {
      const t = await baum($, surface, cols)
      for (const w of ['Claude ', '"Update"', '0 Chats', 'Connectors ✓', '✓ Sichern', '⇢ Übergabe', '⇲ Komprimieren', '+ Neu', 'knopf-sichern', 'knopf-neu', 'knopf-aufnahme-text'])
        if (!t.includes(w)) fehlt.push(`${surface} ${cols}: ${w}`)
    }
  }
  expect(fehlt).toEqual([])
  // Konsole und App unverändert: Client-Elemente mit farb-knopf.tsx
  for (const surface of ['desktop', 'terminal'] as const) expect((await baum($, surface)).includes('farb-knopf.tsx')).toBe(true)
})

test('G1: mit Connectors hinter anderen Teilen zwei Spalten; allein die alte Anordnung', async ($, on) => {
  mock.clock(on, { now: T0 })
  grund(on)
  let sys: Record<string, unknown> = { version: '2.1.0', model: 'Opus 5.5', chats: [], connectors: ['Higgsfield'] }
  let version = 1
  on('state.get', { plugin: 'roqam-de', key: 'system' }, () => ({ value: { value: sys, version } }) as never)
  const stand = (t: string) => `spalte-links=${t.includes('"spalte-links"')} system-rechts=${t.includes('"system-rechts"')} knoepfe=${t.includes('"knoepfe"')} Connectors=${t.includes('Connectors ✓')}`
  const zwei = 'spalte-links=true system-rechts=true knoepfe=false Connectors=true'
  const eins = 'spalte-links=false system-rechts=false knoepfe=true Connectors=true'
  const ergebnis: string[] = []
  for (const surface of ['desktop', 'terminal'] as const) ergebnis.push(`${surface}: ${stand(await baum($, surface))}`)
  sys = { connectors: ['Higgsfield'] }
  version++
  for (const surface of ['desktop', 'terminal'] as const) ergebnis.push(`${surface} allein: ${stand(await baum($, surface))}`)
  expect(ergebnis).toEqual([`desktop: ${zwei}`, `terminal: ${zwei}`, `desktop allein: ${eins}`, `terminal allein: ${eins}`])
})

test('D-A2: Neu ohne Ordner (session.root abgelehnt) meldet einen Hinweis statt einer offenen Ablehnung', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  grund(on)
  on('session.root', () => ({ deny: 'kein Ordner' }) as never)
  const meldungen = toasts(on)
  const gestartet: string[] = []
  on('process.run', ($, e) => {
    gestartet.push(String(e.argv[0]))
    return { value: { stdout: '', stderr: '', exitCode: 0 } } as never
  })
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await mount($, surface)
    await ui.post({ aktion: 'neu' }, { in: 'knopf-neu' })
    await clock.settle()
    await ui.unmount()
  }
  expect(meldungen).toEqual(['Neu: Ordner dieses Chats unbekannt', 'Neu: Ordner dieses Chats unbekannt'])
  expect(gestartet).toEqual([])
})

test('E5: Neu meldet, wenn wt.exe oder rundll32 fehlen (ENOENT), mit dem Ordner als Hinweis', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  grund(on)
  on('session.root', () => ({ value: 'C:\\P' }) as never)
  const meldungen = toasts(on)
  const versucht: string[] = []
  on('process.run', ($, e) => {
    versucht.push(String(e.argv[0]))
    throw new Error(`spawn ${e.argv[0]} ENOENT`)
  })
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await mount($, surface)
    await ui.post({ aktion: 'neu' }, { in: 'knopf-neu' })
    await clock.settle()
    await ui.unmount()
  }
  expect([...versucht].sort()).toEqual(['rundll32', 'wt.exe'])
  expect(meldungen.length).toBe(2)
  expect(meldungen.every(m => m.includes('C:\\P') || m.includes('C%3A%5CP'))).toBe(true)
})
