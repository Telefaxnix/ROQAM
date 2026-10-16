// Sondermodus-Ansicht als Easter Egg (14.10.2026): das Geheimwort als eigene Nachricht schaltet um und gilt in allen Chats,
// bis es wieder geschickt wird; einen Befehl gibt es nicht. Ausgeschaltet bleibt alles beim Cockpit (keine Rahmen, keine Töne). Eingeschaltet: Konsole über der Eingabe,
// Chat-Rahmen, Töne; Orange = Cockpit-Orange #EC7E7E; Farbflächen in der App mit runden Ecken (Eckstücke als Svg), in
// der Konsole eckig.
import { expect, mock, test } from 'claude-code/testing'

import { klangBefehl } from './klang'
import { AMPEL, bereitTon, ECKE_ALT, ECKE_RADIUS, eckeSvg, EINBLENDER_FARBE, EINBLENDER_TEXT, einblenderFuer, fussZeile, geheimwort, GEHEIM_PRUEFSUMME, istEigeneEingabe, istSchlussBlock, pruefsumme, SONDERMODUS, sondermodusFarbe, sondermodusMeldung, schlussVon, standAus, WORT_ZWISCHENSCHRITT } from './sondermodus-farben'

type Body = Extract<Parameters<typeof test>[1], (...a: never[]) => unknown>
type On = Parameters<Body>[1]
type Engine = Parameters<Body>[0]
type Knoten = { type: string; props?: Record<string, unknown>; children?: unknown }
const T0 = Date.parse('2026-10-14T10:00:00Z')

// Knoten mit diesem key im gezeichneten Baum
function suche(k: unknown, key: string): Knoten | undefined {
  if (!k || typeof k !== 'object') return undefined
  if (Array.isArray(k)) {
    for (const x of k) {
      const f = suche(x, key)
      if (f) return f
    }
    return undefined
  }
  const n = k as Knoten
  if (n.props?.key === key) return n
  return suche(n.children, key)
}
// Kärtchen deckend (Vorgabe 15.10.2026): jedes Kärtchen sitzt mit bottom 0 auf einem Anker (absolut, top 0) an der
// Oberkante seines Worts. Mit bottom 1 ragte es in eine zweizeilige Zeile, und die Wörter rechts davon lagen darüber.
function kaertchenLage(k: unknown, eltern: Record<string, unknown> = {}, out: string[] = []): string[] {
  if (!k || typeof k !== 'object') return out
  if (Array.isArray(k)) {
    for (const x of k) kaertchenLage(x, eltern, out)
    return out
  }
  const n = k as Knoten
  if (n.type === 'Box' && n.props?.borderStyle === 'round')
    out.push(n.props.bottom === 0 && eltern.position === 'absolute' && eltern.top === 0 ? 'auf Anker' : `bottom ${String(n.props.bottom)}, Anker ${JSON.stringify(eltern)}`)
  kaertchenLage(n.children, n.props ?? {}, out)
  return out
}
// alle Knoten, auf die die Prüfung zutrifft
function alle(k: unknown, pruef: (n: Knoten) => boolean, out: Knoten[] = []): Knoten[] {
  if (!k || typeof k !== 'object') return out
  if (Array.isArray(k)) {
    for (const x of k) alle(x, pruef, out)
    return out
  }
  const n = k as Knoten
  if (pruef(n)) out.push(n)
  alle(n.children, pruef, out)
  return out
}
const kinder = (n: Knoten | undefined) => (Array.isArray(n?.children) ? (n.children as Knoten[]) : n?.children ? [n.children as Knoten] : [])
const kinderKeys = (n: Knoten | undefined) => kinder(n).map(c => c.props?.key ?? c.type)
const ecken = (k: unknown) => alle(k, n => n.type === 'Svg' && n.props?.alt === ECKE_ALT)

// Sondermodus ein (wie nach dem Geheimwort): der State-Wert, den die Leiste und die Rahmen lesen
function sondermodusEin(on: On) {
  on('state.get', { plugin: 'roqam-de', key: 'sondermodus' }, () => ({ value: { value: { an: true }, version: 1 } }) as never)
}
// Grundmocks wie waechter-parallel.test.tsx; process.run schreibt mit, was gestartet wird (Töne)
function basis(on: On, gestartet: string[], store: Record<string, unknown> = {}, angemeldet: string[] = []) {
  mock.store(on, store)
  mock.env(on, { USERPROFILE: 'C:/U' })
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 1000, window: 200000, percent: 0 }, rateLimits: [] } }) as never)
  on('command.register', ($, e) => {
    angemeldet.push((e as { name: string }).name)
    return { value: {} } as never
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }) as never)
  on('tool.list', () => ({ value: [] }) as never)
  on('process.run', ($, e) => {
    gestartet.push(e.argv.join(' '))
    return { value: { stdout: '', stderr: '', exitCode: 0 } } as never
  })
  on('fs.write', () => ({ value: undefined }) as never)
  on('fs.read', () => {
    throw new Error('nope')
  })
  on('fs.list', () => ({ value: [] }) as never)
  on('http.fetch', () => {
    throw new Error('offline')
  })
  on('turn.start', ($, e) => ({ turnId: e.turnId }) as never)
  on('turn.complete', ($, e) => ({ text: (e as { answer: string }).answer }) as never)
  on('model.complete', () => ({ value: { isAnswered: true, text: '-' } }) as never)
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
}
// was die App selbst zeichnen würde
function engine(on: On) {
  on('ui.render', { component: 'UserMessage' }, () => ({ type: 'engine', ref: 0 }) as never)
  on('ui.render', { component: 'AssistantMessage' }, () => ({ type: 'engine', ref: 0 }) as never)
  on('ui.render', { component: 'AskUserQuestion' }, () => ({ type: 'engine', ref: 0 }) as never)
}
async function zeichne($: Engine, surface: 'desktop' | 'terminal' | 'mobile' | 'vscode', component: string, props: unknown) {
  const ui = await $.ui.mount({ plugin: 'roqam-de', surface, component, props, viewport: { columns: 160, rows: 40 } } as never)
  const t = await ui.drawn()
  await ui.unmount()
  return t as unknown
}
// Fusszeile der Konsole (Text neben dem Balken)
async function fuss($: Engine, surface: 'desktop' | 'terminal' = 'desktop') {
  const baum = await zeichne($, surface, 'AbovePrompt', { bodyColumns: 160 })
  const block = suche(baum, 'fuss-block')
  const text = JSON.stringify(suche(baum, 'sondermodus-fuss') ?? {})
  return { block: JSON.stringify(block ?? {}), text }
}
const toene = (g: string[], name: string) => g.filter(a => a.startsWith('powershell') && a.includes(`${name}.wav`)).length

test('ausgeschaltet (Standard): Cockpit, Chat unverändert, kein Ton', async ($, on) => {
  const uhr = mock.clock(on, { now: T0 })
  const gestartet: string[] = []
  basis(on, gestartet)
  engine(on)
  on('tool.call', { tool: 'AskUserQuestion' }, () => ({ result: { questions: [], answers: {} } }))
  await $.session.start({ cwd: 'C:/P' } as never)
  const leiste = JSON.stringify(await zeichne($, 'desktop', 'AbovePrompt', { bodyColumns: 160 }))
  expect(leiste).toContain('Ctx:')
  expect(leiste).not.toContain('RESSOURCEN')
  expect(leiste).not.toContain(ECKE_ALT)
  const roh = '{"type":"engine","ref":0}'
  expect(JSON.stringify(await zeichne($, 'desktop', 'UserMessage', { text: 'Hallo', origin: { kind: 'composer' }, isExpanded: true }))).toBe(roh)
  expect(JSON.stringify(await zeichne($, 'terminal', 'AssistantMessage', { text: 'x', isFirstOfReply: true }))).toBe(roh)
  expect(JSON.stringify(await zeichne($, 'desktop', 'AskUserQuestion', { tool: 'AskUserQuestion', questions: [] }))).toBe(roh)
  // Rückfrage und lange Antwort: ohne Sondermodus kein Ton
  await $.turn.start({ text: 'Lange Arbeit', turnId: 't1' })
  await $.tool.call({ tool: 'AskUserQuestion', questions: [{ question: 'Q?', header: 'H', options: [{ label: 'Ja' }, { label: 'Nein' }], multiSelect: false }] } as never)
  await uhr.advance(30000)
  await $.turn.complete({ turnId: 't1', answer: 'fertig', durationMs: 30000, reason: 'answer' } as never)
  await uhr.settle()
  expect(gestartet.filter(a => a.includes('.wav'))).toEqual([])
})

test('Kein Befehl in der /-Liste; gewöhnliche Nachrichten gehen unverändert ans Modell', async ($, on) => {
  const uhr = mock.clock(on, { now: T0 })
  const gestartet: string[] = []
  const store: Record<string, unknown> = {}
  const angemeldet: string[] = []
  basis(on, gestartet, store, angemeldet)
  on('prompt.submit', ($, e) => ({ text: e.text }) as never)
  await $.session.start({ cwd: 'C:/P' } as never)
  await uhr.settle()
  // angemeldet sind nur die Befehle der Leiste (Hinweis bestätigen, /stars seit 15.10.2026), nichts vom Sondermodus
  expect(angemeldet).toEqual(['aktion-gesehen', 'stars'])
  const sichtbar = async () => JSON.stringify(await zeichne($, 'desktop', 'AbovePrompt', { bodyColumns: 160 })).includes('RESSOURCEN')
  for (const text of ['hallo', 'sondermodus', 'Sondermodus', 'cockpit', 'computer', 'ok']) {
    const r = (await $.prompt.submit({ text, wait: false, origin: { kind: 'composer' } } as never)) as { text?: string; drop?: string }
    expect(r).toEqual({ text })
  }
  expect(await sichtbar()).toBe(false)
  expect(Object.keys(store).filter(k => k.startsWith('sondermodus'))).toEqual([])
})

test('in einem anderen Chat eingeschaltet: dieser Chat liest den Schalter beim Start aus dem Store', async ($, on) => {
  const uhr = mock.clock(on, { now: T0 })
  const gestartet: string[] = []
  basis(on, gestartet, { sondermodus: true })
  await $.session.start({ cwd: 'C:/P' } as never)
  await uhr.settle()
  expect(JSON.stringify(await zeichne($, 'desktop', 'AbovePrompt', { bodyColumns: 160 }))).toContain('RESSOURCEN')
})

test('Eingabe: eigene Nachricht blau eingerahmt (App rechts, Konsole links); fremde Nachrichten und Handy unverändert', async ($, on) => {
  mock.clock(on, { now: T0 })
  engine(on)
  sondermodusEin(on)
  const props = (kind: string, extra: Record<string, unknown> = {}) => ({ text: 'Hallo', origin: { kind }, isExpanded: true, ...extra })
  const app = await zeichne($, 'desktop', 'UserMessage', props('composer'))
  const appText = JSON.stringify(app)
  expect(appText).toContain('EINGABE')
  expect(appText).toContain('"type":"engine"')
  // Eingabe blau, Ausgabe orange (getauscht 14.10.2026)
  expect(appText).toContain(SONDERMODUS.blau)
  expect(appText).not.toContain(SONDERMODUS.orange)
  expect(appText).not.toContain('#FF9C00')
  // App: Balken rechts (wie die Blase der App), Konsole: links
  expect(kinderKeys(suche(app, 'ein-rumpf'))).toEqual(['ein-inhalt', 'ein-l3', 'ein-seite'])
  expect(kinderKeys(suche(app, 'ein-kopf'))).toEqual(['ein-balken', 'ein-l2', 'Text', 'ein-l1', 'ein-ende'])
  const kon = await zeichne($, 'terminal', 'UserMessage', props('composer'))
  expect(kinderKeys(suche(kon, 'ein-rumpf'))).toEqual(['ein-seite', 'ein-l3', 'ein-inhalt'])
  // Handy-Bridge zählt als eigene Eingabe
  expect(JSON.stringify(await zeichne($, 'desktop', 'UserMessage', props('bridge')))).toContain('EINGABE')
  // nicht eingerahmt: Nachricht einer anderen Sitzung, Aufgaben-Meldung, Handy-App, VS Code
  const unveraendert = [
    await zeichne($, 'desktop', 'UserMessage', props('peer', { from: { name: 'Anderer Chat' } })),
    await zeichne($, 'desktop', 'UserMessage', props('task-notification', { task: { id: 't', status: 'completed' } })),
    await zeichne($, 'desktop', 'UserMessage', props('unclassified', { from: { name: 'Teammate' } })),
    await zeichne($, 'mobile', 'UserMessage', props('composer')),
    await zeichne($, 'vscode', 'UserMessage', props('composer')),
  ]
  expect(unveraendert.map(t => JSON.stringify(t))).toEqual(unveraendert.map(() => '{"type":"engine","ref":0}'))
})

test('Ausgabe: Kopfzeile nur über dem ersten Teil, oranger Balken an jedem Teil; App rund, Konsole eckig', async ($, on) => {
  mock.clock(on, { now: T0 })
  engine(on)
  sondermodusEin(on)
  for (const surface of ['desktop', 'terminal'] as const) {
    const erster = await zeichne($, surface, 'AssistantMessage', { text: 'Antwort', isFirstOfReply: true })
    const zweiter = await zeichne($, surface, 'AssistantMessage', { text: 'Weiter', isFirstOfReply: false })
    expect(JSON.stringify(erster)).toContain('AUSGABE')
    expect(JSON.stringify(zweiter)).not.toContain('AUSGABE')
    expect(JSON.stringify(erster)).not.toContain(SONDERMODUS.blau)
    for (const t of [erster, zweiter]) {
      const seite = suche(t, 'aus-seite')
      expect(JSON.stringify(seite)).toContain(SONDERMODUS.orange)
      expect(JSON.stringify(suche(t, 'aus-inhalt'))).toContain('"type":"engine"')
      if (surface === 'terminal') {
        expect(seite?.props?.backgroundColor).toBe(SONDERMODUS.orange)
        expect(ecken(t)).toEqual([])
      } else {
        // Ebene dahinter: Eckstück oben, Fläche, Eckstück unten
        const grund = suche(t, 'aus-seite-grund')
        expect(grund?.props?.position).toBe('absolute')
        expect(kinder(grund).map(k => k.type)).toEqual(['Svg', 'Box', 'Svg'])
        expect(ecken(seite).map(s => s.props?.height)).toEqual([ECKE_RADIUS, ECKE_RADIUS])
      }
    }
  }
  expect(JSON.stringify(await zeichne($, 'mobile', 'AssistantMessage', { text: 'x', isFirstOfReply: true }))).toBe('{"type":"engine","ref":0}')
})

test('Rückfrage-Dialog: roter Rahmen, in der App ein blinkendes Feld (Svg mit isInteractive), in der Konsole ohne', async ($, on) => {
  mock.clock(on, { now: T0 })
  engine(on)
  sondermodusEin(on)
  const props = { tool: 'AskUserQuestion', questions: [] }
  const app = await zeichne($, 'desktop', 'AskUserQuestion', props)
  const appText = JSON.stringify(app)
  // keine Rückfrage mitten in der Arbeit (z. B. «Komprimieren?» über den Knopf): gewöhnliche Rückfrage, kein Zwischenschritt
  expect(appText).toContain('RÜCKFRAGE · IHRE ANTWORT')
  expect(appText).not.toContain('ZWISCHENSCHRITT')
  expect(appText).toContain('"type":"engine"')
  const blinken = alle(app, n => n.type === 'Svg' && n.props?.alt === 'Rückfrage offen')[0]
  expect(blinken?.props?.isInteractive).toBe(true)
  expect(String(blinken?.props?.source)).toContain('<animate')
  // der Dialog steht im Rumpf neben dem roten Seitenbalken; um den Dialog keine feste Breite und keine Positionsangabe
  // (die App lehnt sie dort ab), darum hier eckig
  expect(JSON.stringify(suche(app, 'frage-inhalt'))).toContain('"type":"engine"')
  expect(alle(app, n => n.type === 'Box' && (n.props?.width !== undefined || n.props?.position !== undefined))).toEqual([])
  expect(ecken(app)).toEqual([])
  const kon = await zeichne($, 'terminal', 'AskUserQuestion', props)
  expect(JSON.stringify(kon)).toContain('RÜCKFRAGE · IHRE ANTWORT')
  expect(alle(kon, n => n.type === 'Svg')).toEqual([])
})

test('Konsole über der Eingabe mit allen Werten: App und Konsole zeichnen ohne Absturz; Orange, runde Ecken, Tasten', { options: { apiKosten: true, aktionen: true, ort: 'Fehraltorf' } }, async ($, on) => {
  mock.clock(on, { now: T0 })
  mock.store(on)
  sondermodusEin(on)
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  const daten = {
    ctx: 8,
    fiveHour: 6,
    week: 9,
    costUsd: 1.5,
    usdChf: 0.8,
    periodUsd: 120,
    projectUsd: 40,
    projectName: 'Test',
    neueAktion: true,
    aktionZeilen: ['Gästepässe: 3 von 3 frei, Empfehlungsbonus 10 $'],
    // Guthaben und Gutscheine (seit 16.10.2026 wieder gezeichnet)
    guthaben: [
      { name: 'Cloud-Guthaben', kurz: 'Cloud $', rest: 20, total: 50, einheit: 'USD', ablauf: '2026-11-30T23:00:00Z' },
      { name: 'Gratis-Reset', ablauf: '2026-10-20T22:00:00Z' },
    ],
  }
  const sys = {
    status: { indicator: 'none', description: 'Alles in Betrieb', incidents: [] },
    model: 'Opus 5.5',
    effort: 'Mittel',
    version: '2.1.0',
    latest: '2.2.0',
    chats: [{ name: 'Test-Chat', where: 'App', status: 'offen', isSelf: true }],
    connectors: ['Higgsfield'],
  }
  const wetter = { temp: 14.7, dewPoint: 11.7, hum: 82 }
  const waechter = { seit: T0 - 60000, turnId: 't1', laufend: [{ id: 'a', was: 'Bash: Tests laufen lassen', seit: T0 - 20000 }] }
  const ziel = { ziel: 'Sondermodus als Easter Egg einbauen', aufgaben: [{ id: '1', text: 'a', status: 'completed' }, { id: '2', text: 'b', status: 'in_progress', aktiv: 'Tests' }] }
  on('state.get', { plugin: 'roqam-de', key: 'data' }, () => ({ value: { value: daten, version: 1 } }) as never)
  on('state.get', { plugin: 'roqam-de', key: 'system' }, () => ({ value: { value: sys, version: 1 } }) as never)
  on('state.get', { plugin: 'roqam-de', key: 'wetter' }, () => ({ value: { value: wetter, version: 1 } }) as never)
  // Astro-Zeile mit Halbmond (zunehmend) und Stream-Tempo (Vorgabe 14.10.2026)
  const nacht = { level: 'gut', start: T0 + 8 * 3600000, end: T0 + 18 * 3600000, offset: 7200, cloud: 5, seeing: 2, moon: 50, isWaxing: true }
  on('state.get', { plugin: 'roqam-de', key: 'nacht' }, () => ({ value: { value: nacht, version: 1 } }) as never)
  on('state.get', { plugin: 'roqam-de', key: 'tempo' }, () => ({ value: { value: { tps: 48.4 }, version: 1 } }) as never)
  on('state.get', { plugin: 'roqam-de', key: 'waechter' }, () => ({ value: { value: waechter, version: 1 } }) as never)
  on('state.get', { plugin: 'roqam-de', key: 'ziel' }, () => ({ value: { value: ziel, version: 1 } }) as never)
  for (const surface of ['desktop', 'terminal'] as const) {
    const t = await zeichne($, surface, 'AbovePrompt', { bodyColumns: 160 })
    const baum = JSON.stringify(t)
    expect(baum).not.toContain('Zeichnen fehlgeschlagen')
    // Ressourcen als Tasten CTX, 5H, WOCHE (Variante B, 14.10.2026) statt «Ctx:»
    const fehlt = ['ZIEL', 'WÄCHTER', 'RESSOURCEN', 'SYSTEM', 'STATUS', 'BEFEHLE', 'SENSOREN', 'CLAUDE ARBEITET', 'CTX', '5H', '7T', 'Seeing:', 'API: ', '"Update"', 'Neue Aktion', 'Gästepässe: 3 von 3 frei', 'Connectors', 'SICHERN', '🌡', '⚡']
      .filter(x => !baum.includes(x))
      .map(x => `${surface}: ${x}`)
    expect(fehlt).toEqual([])
    // Guthaben erscheinen (Datei vorhanden)
    expect(['Cloud $', 'Gratis-Reset'].filter(x => !baum.includes(x)).map(x => `${surface}: ${x}`)).toEqual([])
    // kurz «API:» und «Update» ohne Nummer; jedes Kärtchen deckend auf seinem Anker (Vorgabe 15.10.2026)
    expect(baum).not.toContain('Update 2.2.0')
    expect(baum).not.toContain('API-Kosten:')
    const lage = kaertchenLage(t)
    expect(`${surface}: ${lage.length > 3}`).toBe(`${surface}: true`)
    expect(lage.filter(l => l !== 'auf Anker').map(l => `${surface}: ${l}`)).toEqual([])
    // Mond: App als Bild (Stufe 3 = Halbmond), Konsole als Emoji; keine Wörter mehr in der Sensoren-Zeile
    expect(baum.includes('Mond, Stufe 3 von 12')).toBe(surface === 'desktop')
    expect(baum.includes('🌓')).toBe(surface === 'terminal')
    // Halbmond: Beleuchtung 50 % daneben (14.10.2026)
    expect(baum).toContain('50,0%')
    expect(baum).toContain('48 t/s')
    expect(baum).not.toContain('Temp: ')
    // keine Kopfleiste mehr, Aufnahme ohne das Wort «AUFNAHME» (Vorgabe 14.10.2026)
    expect(baum).not.toContain('CLAUDE CODE')
    expect(baum).not.toContain('sondermodus-kopf')
    expect(baum).not.toContain('AUFNAHME')
    // Aufnahme: Symbol ◉ (aufnahme-knopf.tsx) ohne Taste und Fläche, davor «REC» in der Zeilenfarbe Lavendel
    // (Vorgabe 15.10.2026; nur der Punkt zeigt an/aus)
    const aufnahme = alle(t, n => n.type === 'Client' && n.props?.key === 'knopf-aufnahme')[0]
    expect(String(aufnahme?.props?.module)).toContain('aufnahme-knopf.tsx')
    expect(aufnahme?.props?.props).toEqual({ an: false, nurSymbol: true, wort: 'REC', wortFarbe: SONDERMODUS.lavendel })
    expect(suche(t, 'knopf-aufnahme-taste')).toBeUndefined()
    // nirgends ein Aufhellen per hover (die App zeigte die eingeblendete Ebene als eigenes Feld neben der Taste)
    expect(alle(t, n => (n as Knoten & { hover?: unknown }).hover !== undefined)).toEqual([])
    // Orange = Cockpit-Orange; das grelle Sondermodus-Orange und Pfirsich sind weg
    expect(baum).toContain('#EC7E7E')
    expect(baum).not.toContain('#FF9C00')
    expect(baum).not.toContain('#FF9966')
    const block = suche(t, 'ressourcen-block')
    if (surface === 'terminal') {
      expect(block?.props?.backgroundColor).toBe(SONDERMODUS.orange)
      expect(ecken(t)).toEqual([])
      // Tasten: gewöhnliche Sondermodus-Taste mit eigener Fläche
      const knopf = alle(t, n => n.type === 'Client' && n.props?.key === 'knopf-sichern')[0]
      expect((knopf?.props?.props as Record<string, unknown>)?.ohneFlaeche).toBeUndefined()
    } else {
      // Block: Platzhalter im Fluss, Ebene (absolut) mit Eckstücken, danach die Schrift in einer zweiten absoluten Box:
      // die App malt Absolutes über alles im Fluss, die spätere absolute Box über die Ebene (Namen sonst unsichtbar)
      expect(block?.props?.backgroundColor).toBeUndefined()
      expect(kinderKeys(block)).toEqual(['ressourcen-block-platz', 'ressourcen-block-grund', 'ressourcen-block-vorn'])
      expect(suche(block, 'ressourcen-block-platz')?.props?.position).toBeUndefined()
      expect(suche(block, 'ressourcen-block-grund')?.props?.position).toBe('absolute')
      const vorn = suche(block, 'ressourcen-block-vorn')
      expect(vorn?.props?.position).toBe('absolute')
      expect(JSON.stringify(vorn)).toContain('RESSOURCEN')
      expect(ecken(block).map(s => String(s.props?.source))).toEqual([eckeSvg(SONDERMODUS.orange, false), eckeSvg(SONDERMODUS.orange, true)])
      // Tasten CTX, 5H, WOCHE: rechts eckig, bündig an ihrem Balken (Vorgabe 15.10.2026)
      const messTasten = alle(t, n => /^mess-[^-]+$/.test(String(n.props?.key ?? '')))
      expect(messTasten.length).toBe(3)
      for (const m of messTasten)
        expect(ecken(m).map(s => String(s.props?.source))).toEqual([eckeSvg(SONDERMODUS.orange, false, true), eckeSvg(SONDERMODUS.orange, true, true)])
      // Taste: eine Ebene dahinter, keine hellere; der Client bleibt im Fluss (sichtbar, bekommt den Klick)
      const taste = suche(t, 'knopf-sichern-taste')
      expect(kinder(taste).filter(k => k.props?.position === 'absolute').length).toBe(1)
      const knopf = alle(t, n => n.type === 'Client' && n.props?.key === 'knopf-sichern')[0]
      expect((knopf?.props?.props as Record<string, unknown>)?.ohneFlaeche).toBe(true)
    }
  }
})

test('Aufnahme an (Sondermodus): nur das Symbol ◉ meldet «an», keine rote Fläche', async ($, on) => {
  mock.clock(on, { now: T0 })
  mock.store(on)
  sondermodusEin(on)
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  on('state.get', { plugin: 'roqam-de', key: 'data' }, () => ({ value: { value: { ctx: 8, fiveHour: 6, week: 9 }, version: 1 } }) as never)
  on('state.get', { plugin: 'roqam-de', key: 'aufnahme' }, () => ({ value: { value: { hand: true }, version: 1 } }) as never)
  for (const surface of ['desktop', 'terminal'] as const) {
    const t = await zeichne($, surface, 'AbovePrompt', { bodyColumns: 160 })
    const aufnahme = alle(t, n => n.type === 'Client' && n.props?.key === 'knopf-aufnahme')[0]
    expect(aufnahme?.props?.props).toEqual({ an: true, nurSymbol: true, wort: 'REC', wortFarbe: SONDERMODUS.lavendel })
    expect(JSON.stringify(suche(t, 'befehle'))).not.toContain(SONDERMODUS.alarm)
  }
})

test('Frage an Sie (Sondermodus): Ton «eingabe», Fusszeile und Rahmen ZWISCHENSCHRITT bis zur Antwort, danach wieder AKTIV', async ($, on) => {
  const uhr = mock.clock(on, { now: T0 })
  const gestartet: string[] = []
  basis(on, gestartet, { sondermodus: true })
  engine(on)
  let waehrend = { block: '', text: '' }
  let dialog = ''
  on('tool.call', { tool: 'AskUserQuestion' }, async () => {
    waehrend = await fuss($)
    dialog = JSON.stringify(await zeichne($, 'desktop', 'AskUserQuestion', { tool: 'AskUserQuestion', questions: [] }))
    return { result: { questions: [], answers: { 'Q?': 'Ja' } } }
  })
  await $.session.start({ cwd: 'C:/P' } as never)
  await uhr.settle()
  await $.turn.start({ text: 'Bau etwas', turnId: 't1' })
  await uhr.advance(3000)
  await $.tool.call({ tool: 'AskUserQuestion', questions: [{ question: 'Q?', header: 'H', options: [{ label: 'Ja' }, { label: 'Nein' }], multiSelect: false }] } as never)
  await uhr.settle()
  expect(waehrend.block).toContain('RÜCKFRAGE')
  expect(waehrend.text).toContain(EINBLENDER_TEXT.zwischenschritt)
  expect(waehrend.text).toContain(SONDERMODUS.alarm)
  expect(dialog).toContain(WORT_ZWISCHENSCHRITT)
  expect(toene(gestartet, 'eingabe')).toBe(1)
  const danach = await fuss($)
  expect(danach.text).toContain('CLAUDE ARBEITET')
})

test('Fusszeile: WARTET AUF IHRE EINGABE → CLAUDE ARBEITET → COMPUTER BEREIT; Ton «bereit» nur nach 20 s, nicht nach Abbruch, nicht in der Konsole', async ($, on) => {
  const uhr = mock.clock(on, { now: T0 })
  const gestartet: string[] = []
  basis(on, gestartet, { sondermodus: true })
  await $.session.start({ cwd: 'C:/P' } as never)
  await uhr.settle()
  expect((await fuss($)).text).toContain('WARTET AUF IHRE EINGABE')
  // lange Antwort in der App: Ton
  await $.turn.start({ text: 'Lange Arbeit', turnId: 't1' })
  expect((await fuss($)).text).toContain('CLAUDE ARBEITET')
  await uhr.advance(25000)
  await $.turn.complete({ turnId: 't1', answer: 'fertig', durationMs: 25000, reason: 'answer' } as never)
  await uhr.settle()
  const bereit = await fuss($)
  expect(bereit.text).toContain(EINBLENDER_TEXT.bereit)
  expect(bereit.text).toContain(SONDERMODUS.gold)
  expect(toene(gestartet, 'bereit')).toBe(1)
  // kurze Antwort: kein Ton
  await uhr.advance(5000)
  await $.turn.start({ text: 'Kurz', turnId: 't2' })
  await uhr.advance(5000)
  await $.turn.complete({ turnId: 't2', answer: 'ok', durationMs: 5000, reason: 'answer' } as never)
  await uhr.settle()
  expect(toene(gestartet, 'bereit')).toBe(1)
  // selbst abgebrochen: kein Ton
  await $.turn.start({ text: 'Abbruch', turnId: 't3' })
  await uhr.advance(30000)
  await $.turn.complete({ turnId: 't3', answer: '', durationMs: 30000, isAborted: true, reason: 'aborted' } as never)
  await uhr.settle()
  expect(toene(gestartet, 'bereit')).toBe(1)
  // Konsole (zuletzt dort gezeichnet): kein Ton
  await fuss($, 'terminal')
  await $.turn.start({ text: 'Konsole', turnId: 't4' })
  await uhr.advance(30000)
  await $.turn.complete({ turnId: 't4', answer: 'ok', durationMs: 30000, reason: 'answer' } as never)
  await uhr.settle()
  expect(toene(gestartet, 'bereit')).toBe(1)
})

test('Hilfsfunktionen: Farben, Ecken, Geheimwort-Prüfung, Fusszeile, eigene Eingabe, Ton-Schwelle, Ton-Befehl', () => {
  expect(SONDERMODUS.orange).toBe('#EC7E7E')
  expect([sondermodusFarbe('green'), sondermodusFarbe('yellow'), sondermodusFarbe('red'), sondermodusFarbe('gray')]).toEqual([AMPEL.gut, AMPEL.warnung, AMPEL.kritisch, AMPEL.aus])
  expect(sondermodusFarbe('#EC7E7E', SONDERMODUS.tan)).toBe(SONDERMODUS.tan)
  expect(sondermodusFarbe('#EC7E7E')).toBe(SONDERMODUS.orange)
  expect(sondermodusFarbe('#3176C9', SONDERMODUS.blau)).toBe(SONDERMODUS.blau)
  expect(sondermodusFarbe('#123456')).toBe('#123456')
  expect(sondermodusFarbe(undefined)).toBeUndefined()
  // Eckstück: Hälfte eines gerundeten Rechtecks, Radius in Pixeln, volle Breite
  expect(eckeSvg('#EC7E7E', false)).toBe('<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="4"><rect width="100%" height="8" rx="4" ry="4" fill="#EC7E7E"/></svg>')
  expect(eckeSvg('#EC7E7E', true)).toContain('<rect y="-4" width="100%" height="8"')
  // nur links rund: eckige Fläche über der rechten Hälfte (Vorgabe 15.10.2026)
  expect(eckeSvg('#EC7E7E', false, true)).toBe(
    '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="4"><rect width="100%" height="8" rx="4" ry="4" fill="#EC7E7E"/><rect x="50%" width="50%" height="8" fill="#EC7E7E"/></svg>',
  )
  expect(eckeSvg('#EC7E7E', true, true)).toContain('<rect x="50%" y="-4" width="50%" height="8" fill="#EC7E7E"/>')
  // Prüfsumme FNV-1a 32 bit (Prüfwerte der Referenz), Geheimwort nur als ganze Nachricht aus einem Wort
  expect([pruefsumme(''), pruefsumme('a'), pruefsumme('foobar')]).toEqual([0x811c9dc5, 0xe40c292c, 0xbf9cf968])
  expect(geheimwort(' FooBar ', pruefsumme('foobar'))).toBe('foobar')
  expect([geheimwort('foo bar', pruefsumme('foo bar')), geheimwort('x', pruefsumme('x')), geheimwort('foobar')]).toEqual([undefined, undefined, undefined])
  expect(GEHEIM_PRUEFSUMME).not.toBe(pruefsumme('sondermodus'))
  expect(sondermodusMeldung('abc', true)).toBe('ABC an. Gilt in allen Chats, bis Sie abc wieder schicken.')
  expect(sondermodusMeldung('abc', false)).toBe('ABC aus, zurück im Cockpit.')
  expect(fussZeile('frage').farbe).toBe(SONDERMODUS.alarm)
  expect(fussZeile('bereit', true).text).toBe('COMPUTER BEREIT')
  expect(fussZeile('bereit').text).toBe('COMPUTER BEREIT – WARTET AUF IHRE EINGABE')
  expect(fussZeile('hintergrund').text).toBe('HINTERGRUND-AGENTEN ARBEITEN')
  // Stand: Rückfrage geht vor, dann Arbeit, dann Hintergrund, dann fertig
  expect([standAus('frage', true), standAus('bereit', true), standAus('hintergrund', false), standAus('bereit', false), standAus(undefined, false)]).toEqual(['frage', 'arbeitet', 'hintergrund', 'bereit', 'start'])
  expect([einblenderFuer('frage'), einblenderFuer('bereit'), einblenderFuer('arbeitet'), einblenderFuer('hintergrund'), einblenderFuer('start')]).toEqual(['zwischenschritt', 'bereit', undefined, undefined, undefined])
  // letzter Block: endet wie die Antwort; kurzer Block am Ende einer langen Antwort; früherer Block nicht
  const lang = `${'x'.repeat(300)}\n\nSchluss.`
  expect([istSchlussBlock('Schluss.', schlussVon(lang)), istSchlussBlock('x'.repeat(300), schlussVon(lang)), istSchlussBlock(lang, schlussVon(lang)), istSchlussBlock('', schlussVon(lang)), istSchlussBlock('Schluss.', undefined)]).toEqual([true, false, true, false, false])
  expect(istEigeneEingabe('composer', false, false)).toBe(true)
  expect(istEigeneEingabe('peer', false, false)).toBe(false)
  expect(istEigeneEingabe('unclassified', true, false)).toBe(false)
  expect([bereitTon('answer', 20000), bereitTon('answer', 19999), bereitTon('aborted', 60000), bereitTon('error', 60000)]).toEqual([true, false, false, true])
  const befehl = klangBefehl("C:\\Users\\D'x\\cockpit", 'eingabe')
  expect(befehl.slice(0, 4)).toEqual(['powershell', '-NoProfile', '-NonInteractive', '-Command'])
  expect(befehl[4]).toBe("(New-Object Media.SoundPlayer 'C:\\Users\\D''x\\cockpit\\klang\\eingabe.wav').PlaySync()")
})
