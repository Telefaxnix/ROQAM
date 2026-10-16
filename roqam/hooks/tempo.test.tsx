// Schreibtempo vor der Aufnahme (Vorgabe 15.10.2026): nicht mehr am Ende der Astro- bzw. SENSOREN-Zeile, sondern vor
// «◉ Rec» (Cockpit, mit Strich dazwischen) bzw. «REC ◉» (Sondermodus), in App und Konsole. Ein Klick öffnet ein
// Kärtchen, das erklärt, was der Wert ist; es sitzt deckend auf seinem Anker am Zeilenende, rechtsbündig mit der Aufnahme,
// und hat kurze Zeilen (am Wort und mit 86 Zeichen ragte es in der App links aus dem Band, Screenshot 15.10.2026). Ohne
// Messwert kein Tempo.
import { expect, mock, test } from 'claude-code/testing'

import { TEMPO_KARTE, TEMPO_KARTE_MAX } from './register'
import { SONDERMODUS } from './sondermodus-farben'

type Body = Extract<Parameters<typeof test>[1], (...a: never[]) => unknown>
type On = Parameters<Body>[1]
type Engine = Parameters<Body>[0]
type Knoten = { type: string; props?: Record<string, unknown>; children?: unknown }
const T0 = Date.parse('2026-10-15T10:00:00Z')

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
const kinderKeys = (n: Knoten | undefined) => kinder(n).map(c => String(c.props?.key ?? c.type))
// das Tempo-Kärtchen: der runde Kasten mit dem Erklärtext, samt seinem Anker
function tempoKarte(t: unknown): { display: unknown; lage: unknown[]; anker: Knoten; breite: unknown } | undefined {
  const anker = alle(t, n => n.type === 'Box' && n.props?.position === 'absolute' && n.props?.top === 0).find(a =>
    kinder(a).some(c => c.props?.borderStyle === 'round' && JSON.stringify(c).includes('Writing speed of Claude')),
  )
  const karte = kinder(anker).find(c => c.props?.borderStyle === 'round')
  // Anker: absolut, oben, rechts; Kärtchen darauf: unten bündig, rechts
  return anker && karte
    ? {
        display: karte.props?.display,
        lage: [anker.props?.position, anker.props?.top, anker.props?.right, karte.props?.position, karte.props?.bottom, karte.props?.right],
        anker,
        breite: karte.props?.width,
      }
    : undefined
}

function basis(on: On, opt: { sondermodus?: boolean; tps?: number; sterneAus?: boolean } = {}) {
  mock.store(on, {})
  mock.env(on, { USERPROFILE: 'C:/U' })
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 1000, window: 200000, percent: 0 }, rateLimits: [] } }) as never)
  on('command.register', () => ({ value: {} }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }) as never)
  on('tool.list', () => ({ value: [] }) as never)
  on('agent.list', () => ({ value: [] }) as never)
  on('process.run', () => ({ value: { stdout: '', stderr: '', exitCode: 0 } }) as never)
  on('fs.write', () => ({ value: undefined }) as never)
  on('fs.read', () => {
    throw new Error('nope')
  })
  on('fs.list', () => ({ value: [] }) as never)
  on('http.fetch', () => {
    throw new Error('offline')
  })
  const nacht = { level: 'gut', start: T0 + 8 * 3600000, end: T0 + 18 * 3600000, offset: 7200, cloud: 5, seeing: 2, moon: 50, isWaxing: true }
  on('state.get', { plugin: 'roqam', key: 'nacht' }, () => ({ value: { value: nacht, version: 1 } }) as never)
  on('state.get', { plugin: 'roqam', key: 'wetter' }, () => ({ value: { value: { temp: 12.3, dewPoint: 8.1, hum: 76 }, version: 1 } }) as never)
  if (opt.tps !== undefined) on('state.get', { plugin: 'roqam', key: 'tempo' }, () => ({ value: { value: { tps: opt.tps }, version: 1 } }) as never)
  if (opt.sondermodus) on('state.get', { plugin: 'roqam', key: 'sondermodus' }, () => ({ value: { value: { an: true }, version: 1 } }) as never)
  if (opt.sterneAus) on('state.get', { plugin: 'roqam', key: 'sterne' }, () => ({ value: { value: { aus: true }, version: 1 } }) as never)
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
}
const montiere = ($: Engine, surface: 'desktop' | 'terminal') =>
  $.ui.mount({ plugin: 'roqam', surface, component: 'AbovePrompt', props: { bodyColumns: 160 } as never, viewport: { columns: 160, rows: 40 } })

// Wort anklicken: Kärtchen offen, deckend auf dem Anker, rechtsbündig; zweiter Klick schliesst
async function kaertchenPruefen(ui: Awaited<ReturnType<typeof montiere>>, surface: string) {
  expect(`${surface} zu: ${String(tempoKarte(await ui.drawn())?.display)}`).toBe(`${surface} zu: none`)
  await ui.post({ kaertchen: 'tempo' }, { in: 'farb-tempo' })
  const baum = await ui.drawn()
  const offen = tempoKarte(baum)
  expect(`${surface} offen: ${String(offen?.display)}`).toBe(`${surface} offen: flex`)
  expect(offen?.lage).toEqual(['absolute', 0, 0, 'absolute', 0, 0])
  // Anker am Zeilenende (direkt im rechten Teil der Zeile, nicht im Wort), kurze Zeilen, schmal
  expect(`${surface} am Zeilenende: ${!!offen && kinder(suche(baum, 'knoepfe-rechts')).includes(offen.anker)}`).toBe(`${surface} am Zeilenende: true`)
  expect(TEMPO_KARTE.filter(z => z.length > TEMPO_KARTE_MAX)).toEqual([])
  expect(offen?.breite).toBe(Math.max(...TEMPO_KARTE.map(z => z.length)) + 4)
  const text = JSON.stringify(await ui.drawn())
  for (const zeile of TEMPO_KARTE) expect(`${surface}: ${text.includes(JSON.stringify(zeile).slice(1, -1))}`).toBe(`${surface}: true`)
  await ui.post({ kaertchen: 'tempo' }, { in: 'farb-tempo' })
  expect(`${surface} 2. Klick: ${String(tempoKarte(await ui.drawn())?.display)}`).toBe(`${surface} 2. Klick: none`)
}

test('Cockpit: Tempo vor «◉ Rec» mit Strich, nicht mehr in der Astro-Zeile; Kärtchen erklärt es', { options: { location: 'Bern' } }, async ($, on) => {
  mock.clock(on, { now: T0 })
  basis(on, { tps: 103.4 })
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await montiere($, surface)
    const t = await ui.drawn()
    const rechts = suche(t, 'knoepfe-rechts')
    // Text-Teile tragen ihren key im gezeichneten Baum nicht: der Strich ist der Text «│» dazwischen; der Anker des
    // Kärtchens (Box ohne key) nimmt keinen Platz
    expect(kinderKeys(rechts).filter(k => k !== 'Box').slice(0, 3)).toEqual(['tempo', 'Text', 'knopf-aufnahme'])
    expect(JSON.stringify(kinder(rechts)[1])).toContain('│')
    const tempo = suche(t, 'farb-tempo')
    expect(tempo?.props?.props).toEqual({ teile: [{ text: '⚡ ', color: '#3176C9' }, { text: '103 t/s', color: '#3176C9', bold: true }], kaertchen: 'tempo' })
    // Astro-Zeile bleibt, aber ohne Tempo
    const astro = JSON.stringify(suche(t, 'nacht0') ?? {})
    expect(`${surface}: ${astro.includes('☁')} ${astro.includes('t/s')}`).toBe(`${surface}: true false`)
    await kaertchenPruefen(ui, surface)
    await ui.unmount()
  }
})

test('Sondermodus: Tempo in BEFEHLE vor REC in Lavendel, nicht mehr in SENSOREN; Kärtchen erklärt es', { options: { location: 'Bern' } }, async ($, on) => {
  mock.clock(on, { now: T0 })
  basis(on, { tps: 103.4, sondermodus: true })
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await montiere($, surface)
    const t = await ui.drawn()
    expect(kinderKeys(suche(t, 'knoepfe-rechts')).filter(k => k !== 'Box')).toEqual(['tempo-fuge', 'tempo', 'aufnahme-fuge', 'knopf-aufnahme'])
    expect(JSON.stringify(suche(t, 'befehle') ?? {})).toContain('103 t/s')
    const tempo = suche(t, 'farb-tempo')
    expect(tempo?.props?.props).toEqual({
      teile: [{ text: '⚡ ', color: SONDERMODUS.lavendel }, { text: '103 t/s', color: SONDERMODUS.lavendel, bold: true }],
      kaertchen: 'tempo',
    })
    const sensoren = JSON.stringify(suche(t, 'sensoren') ?? {})
    expect(`${surface}: ${sensoren.includes('☁')} ${sensoren.includes('t/s')}`).toBe(`${surface}: true false`)
    await kaertchenPruefen(ui, surface)
    await ui.unmount()
  }
})

test('Ohne Messwert kein Tempo; mit /stars aus und Tempo keine SENSOREN-Zeile mehr', { options: { location: 'Bern' } }, async ($, on) => {
  mock.clock(on, { now: T0 })
  basis(on, { sondermodus: true, sterneAus: true, tps: 61.6 })
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await montiere($, surface)
    const t = await ui.drawn()
    expect(`${surface}: ${suche(t, 'sensoren') === undefined}`).toBe(`${surface}: true`)
    expect(JSON.stringify(suche(t, 'befehle') ?? {})).toContain('62 t/s')
    await ui.unmount()
  }
})

test('Ohne Messwert: kein Tempo und kein Kärtchen, weder im Cockpit noch im Sondermodus', { options: { location: 'Bern' } }, async ($, on) => {
  mock.clock(on, { now: T0 })
  basis(on)
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await montiere($, surface)
    const t = await ui.drawn()
    expect(`${surface}: ${suche(t, 'tempo') === undefined} ${tempoKarte(t) === undefined}`).toBe(`${surface}: true true`)
    expect(kinderKeys(suche(t, 'knoepfe-rechts'))[0]).toBe('knopf-aufnahme')
    await ui.unmount()
  }
})
