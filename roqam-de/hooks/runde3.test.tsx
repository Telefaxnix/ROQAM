// Hardcore-Test 09.10.2026, Runde 3: Befunde aus der Prüfung der statusleiste, die auch das Cockpit betreffen. Jeder
// Test schlägt am alten Stand an (Gegenprobe gemacht). S2-3: die Fehler-Toasts von «+ Neu» nannten im Aufnahme-Modus den
// Ordnerpfad bzw. den Link. Die Tests S1-1 (zwei Guthaben mit demselben Kurznamen) fielen am 15.10.2026 mit der
// Guthaben-Anzeige weg.
import { expect, mock, test } from 'claude-code/testing'

type Body = Extract<Parameters<typeof test>[1], (...a: never[]) => unknown>
type On = Parameters<Body>[1]

const T0 = Date.parse('2026-10-07T10:00:00Z')

// an Stelle der Engine: was unter der Leiste gezeichnet wird
function grund(on: On) {
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>UNTEN</Text>
  })
  on('ui.log', () => ({ value: undefined }) as never)
}

test('Runde 3 S2-3: Aufnahme an, «+ Neu» scheitert → Toasts ohne Ordnerpfad und ohne Link', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  grund(on)
  const meldungen: string[] = []
  on('ui.toast', ($, e) => {
    meldungen.push(e.text)
    return { value: undefined } as never
  })
  on('session.root', () => ({ value: 'C:/GEHEIM-ORDNER' }) as never)
  // Aufnahme von Hand an; wt.exe und rundll32 melden Exit 1
  on('state.get', { plugin: 'roqam-de', key: 'aufnahme' }, () => ({ value: { value: { hand: true }, version: 1 } }) as never)
  on('state.get', { plugin: 'roqam-de', key: 'data' }, () => ({ value: { value: { ctx: 8 }, version: 1 } }) as never)
  on('process.run', () => ({ value: { stdout: '', stderr: '', exitCode: 1 } }) as never)
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ plugin: 'roqam-de', surface, component: 'AbovePrompt', props: { bodyColumns: 160 }, viewport: { columns: 160, rows: 40 } })
    await ui.post({ aktion: 'neu' }, { in: 'knopf-neu' })
    await clock.settle()
    await ui.unmount()
  }
  expect(meldungen).toEqual(['Link liess sich nicht öffnen', 'Neuer Chat liess sich nicht öffnen'])
  expect(meldungen.some(m => m.includes('GEHEIM') || m.includes(encodeURIComponent('C:/GEHEIM-ORDNER')))).toBe(false)
})
