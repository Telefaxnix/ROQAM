// «⚑ Neue Aktion» (Vorgabe 15.10.2026): Ein Klick zeigt, was sich geändert hat, und bestätigt den Stand; das Wort bleibt,
// solange sein Kärtchen offen ist, danach ist es weg, auch nach der nächsten Prüfung. Der Fingerabdruck bleibt mit dem
// bisher gespeicherten vergleichbar; die Zahl der Gästepässe zählt jetzt auch als Zahl (Claude Code legt sie seit
// 15.10.2026 so ab, vorher als Liste). Guthaben zeigt die Leiste nicht mehr.
import { expect, mock, test } from 'claude-code/testing'

import { AKTION_ZEILE_MAX, aktionSignatur, aktionStand, aktionZeilen } from './aktion'

type Body = Extract<Parameters<typeof test>[1], (...a: never[]) => unknown>
type On = Parameters<Body>[1]
type Knoten = { type: string; props?: Record<string, unknown>; children?: unknown }
const T0 = Date.parse('2026-10-15T10:00:00Z')

// Stand bis 14.10.2026 (Cloud-Guthaben-Aktion eingelöst, keine Pässe) und ab 15.10.2026 (drei Gästepässe)
const ALT = JSON.stringify({
  promoStartupStatusCache: { endpoint: '/v1/code/promo/cloud_credit', eligible: false, claimed: true },
  passesEligibilityCache: { a: { eligible: false, remaining_passes: null } },
  cachedGrowthBookFeatures: { tengu_rate_limit_promo_notices: [], tengu_penguin_mode_promo: { discountPercent: 0, endDate: 'Feb 16' } },
})
const NEU = JSON.stringify({
  promoStartupStatusCache: { endpoint: '/v1/code/promo/cloud_credit', eligible: false, claimed: true },
  passesEligibilityCache: { a: { eligible: true, remaining_passes: 3, limit: 3, referrer_reward: { amount_minor_units: 1000, currency: 'USD' } } },
  cachedGrowthBookFeatures: { tengu_rate_limit_promo_notices: [], tengu_penguin_mode_promo: { discountPercent: 0, endDate: 'Feb 16' } },
})
// so stand der Fingerabdruck am 15.10.2026 im $.store (alte Fassung von aktionSignatur)
const ALT_GESPEICHERT = '{"promo":["/v1/code/promo/cloud_credit",false,true],"passes":[[false,null]],"hinweise":0,"rabatt":0}'

test('Fingerabdruck: bisher gespeicherter bleibt gültig; Gästepässe als Zahl zählen', () => {
  expect(aktionSignatur(ALT)).toBe(ALT_GESPEICHERT)
  expect(aktionStand(NEU)?.passes).toEqual([[true, 3]])
  const zwei = NEU.replace('"remaining_passes":3', '"remaining_passes":2')
  expect(aktionSignatur(zwei) === aktionSignatur(NEU)).toBe(false)
  // als Liste wie früher: Länge
  expect(aktionStand(NEU.replace('"remaining_passes":3', '"remaining_passes":[1,2]'))?.passes).toEqual([[true, 2]])
  expect(aktionSignatur('kaputt')).toBeUndefined()
  expect(aktionSignatur('[1]')).toBeUndefined()
})

test('Zeilen fürs Kärtchen: nur was sich geändert hat, mit dem heutigen Stand, kurz', () => {
  expect(aktionZeilen(NEU, ALT_GESPEICHERT)).toEqual(['Gästepässe: 3 von 3 frei, Empfehlungsbonus 10 $', 'Mehr: claude.ai › Einstellungen › Nutzung'])
  // Rabatt, Hinweise und eine neue Cloud-Aktion
  const viel = JSON.stringify({
    promoStartupStatusCache: { endpoint: '/v1/code/promo/cloud_credit', eligible: true, claimed: false },
    passesEligibilityCache: { a: { eligible: false, remaining_passes: null } },
    cachedGrowthBookFeatures: { tengu_rate_limit_promo_notices: [{}, {}], tengu_penguin_mode_promo: { discountPercent: 20, endDate: 'Feb 16' } },
  })
  const zeilen = aktionZeilen(viel, ALT_GESPEICHERT)
  expect(zeilen).toEqual([
    'Aktion Cloud-Guthaben: verfügbar, noch nicht eingelöst',
    'Hinweise zum Nutzungslimit: 2',
    'Rabatt: 20 % bis Feb 16',
    'Mehr: claude.ai › Einstellungen › Nutzung',
  ])
  // Pässe wieder weg
  expect(aktionZeilen(ALT, aktionSignatur(NEU))[0]).toBe('Gästepässe: keine')
  // ohne lesbaren alten Stand: alles, was es gibt
  expect(aktionZeilen(NEU, undefined)).toContain('Gästepässe: 3 von 3 frei, Empfehlungsbonus 10 $')
  for (const z of [...zeilen, ...aktionZeilen(NEU, undefined)]) expect(`${z.length > AKTION_ZEILE_MAX} ${z}`).toBe(`false ${z}`)
  expect(aktionZeilen('kaputt', ALT_GESPEICHERT)).toEqual([])
})

// gezeichneter Baum: Kärtchen mit diesem Text (display) und ob das Wort da ist
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
function lage(t: unknown) {
  const karte = alle(t, n => n.props?.borderStyle === 'round' && JSON.stringify(n).includes('Gästepässe: 3 von 3 frei'))[0]
  return { wort: JSON.stringify(t).includes('⚑ Neue Aktion'), karte: karte ? String(karte.props?.display) : 'keine' }
}

function basis(on: On, claudeJson: string) {
  mock.store(on, { 'aktionen-bekannt': ALT_GESPEICHERT })
  mock.env(on, { USERPROFILE: 'C:\\U' })
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 1000, window: 200000, percent: 0 }, rateLimits: [] } }) as never)
  on('command.register', () => ({ value: {} }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }) as never)
  on('tool.list', () => ({ value: [] }) as never)
  on('agent.list', () => ({ value: [] }) as never)
  on('process.run', () => ({ value: { stdout: '', stderr: '', exitCode: 0 } }) as never)
  on('fs.write', () => ({ value: undefined }) as never)
  on('fs.read', ($, e) => {
    if (String((e as { path: string }).path).endsWith('.claude.json')) return { value: claudeJson } as never
    throw new Error('nope')
  })
  on('fs.list', () => ({ value: [] }) as never)
  on('http.fetch', () => {
    throw new Error('offline')
  })
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
}

for (const sondermodus of [false, true]) {
  test(`${sondermodus ? 'Sondermodus' : 'Cockpit'}: Klick auf «Neue Aktion» zeigt die Änderung und bestätigt; danach weg`, { options: { aktionen: true } }, async ($, on) => {
    const uhr = mock.clock(on, { now: T0 })
    basis(on, NEU)
    if (sondermodus) on('state.get', { plugin: 'roqam-de', key: 'sondermodus' }, () => ({ value: { value: { an: true }, version: 1 } }) as never)
    await $.session.start({ cwd: 'C:\\P', surface: 'desktop', isInteractive: true })
    await uhr.advance(1000)
    const ui = await $.ui.mount({ plugin: 'roqam-de', surface: 'desktop', component: 'AbovePrompt', props: { bodyColumns: 160 } as never, viewport: { columns: 160, rows: 40 } })
    expect(lage(await ui.drawn())).toEqual({ wort: true, karte: 'none' })
    // Klick: Kärtchen offen mit der Änderung, das Wort bleibt, solange es offen ist
    await ui.post({ kaertchen: 'aktion' }, { in: 'farb-aktion' })
    expect(lage(await ui.drawn())).toEqual({ wort: true, karte: 'flex' })
    // zweiter Klick schliesst: Wort weg, in jeder Oberfläche
    await ui.post({ kaertchen: 'aktion' }, { in: 'farb-aktion' })
    expect(lage(await ui.drawn())).toEqual({ wort: false, karte: 'keine' })
    await ui.unmount()
    // nächste Prüfung (10 Min.): der Stand ist bestätigt, das Wort kommt nicht wieder
    await uhr.advance(11 * 60 * 1000)
    for (const surface of ['desktop', 'terminal'] as const) {
      const ui2 = await $.ui.mount({ plugin: 'roqam-de', surface, component: 'AbovePrompt', props: { bodyColumns: 160 } as never, viewport: { columns: 160, rows: 40 } })
      expect(`${surface}: ${lage(await ui2.drawn()).wort}`).toBe(`${surface}: false`)
      await ui2.unmount()
    }
  })
}

test('Kärtchen schliesst nach 30 s von selbst: Wort danach weg', { options: { aktionen: true } }, async ($, on) => {
  const uhr = mock.clock(on, { now: T0 })
  basis(on, NEU)
  await $.session.start({ cwd: 'C:\\P', surface: 'desktop', isInteractive: true })
  await uhr.advance(1000)
  const ui = await $.ui.mount({ plugin: 'roqam-de', surface: 'desktop', component: 'AbovePrompt', props: { bodyColumns: 160 } as never, viewport: { columns: 160, rows: 40 } })
  await ui.post({ kaertchen: 'aktion' }, { in: 'farb-aktion' })
  expect(lage(await ui.drawn()).karte).toBe('flex')
  await uhr.advance(31 * 1000)
  expect(lage(await ui.drawn())).toEqual({ wort: false, karte: 'keine' })
  await ui.unmount()
})

test('Ohne Änderung kein Wort; /aktion-gesehen bestätigt weiterhin (VS Code, Handy)', { options: { aktionen: true } }, async ($, on) => {
  const uhr = mock.clock(on, { now: T0 })
  basis(on, NEU)
  await $.session.start({ cwd: 'C:\\P', surface: 'desktop', isInteractive: true })
  await uhr.advance(1000)
  const antwort = JSON.stringify(await $.command.run({ command: 'aktion-gesehen', args: '' } as never))
  expect(antwort).toContain('Gästepässe: 3 von 3 frei')
  const ui = await $.ui.mount({ plugin: 'roqam-de', surface: 'terminal', component: 'AbovePrompt', props: { bodyColumns: 160 } as never, viewport: { columns: 160, rows: 40 } })
  expect(lage(await ui.drawn()).wort).toBe(false)
  await ui.unmount()
})
