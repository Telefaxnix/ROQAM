// Bewertung der App über der Eingabe (hasSurvey, Vorgabe 15.10.2026): Das Cockpit bleibt sichtbar, im Cockpit und im
// Sondermodus, in App und Konsole; die Bewertung (was die App darunter zeichnet) steht unter dem Cockpit. Vorher gab die
// Leiste den ganzen Platz ab, und nach dem App-Update vom 15.10.2026 fehlte das Cockpit, solange die Bewertung stand.
import { expect, mock, test } from 'claude-code/testing'

type Body = Extract<Parameters<typeof test>[1], (...a: never[]) => unknown>
type On = Parameters<Body>[1]
type Engine = Parameters<Body>[0]
const T0 = Date.parse('2026-10-15T16:00:00Z')

function basis(on: On, store: Record<string, unknown>) {
  mock.store(on, store)
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
  // an Stelle der App: während der Bewertung zeichnet sie diese im Band
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    return e.props.hasSurvey ? <Text>BEWERTUNG-DER-APP</Text> : <Box />
  })
}
async function band($: Engine, surface: 'desktop' | 'terminal') {
  const props = { hasSurvey: true, isWorking: false, maxRows: 20, bodyColumns: 160 }
  const ui = await $.ui.mount({ plugin: 'roqam-de', surface, component: 'AbovePrompt', props, viewport: { columns: 160, rows: 40 } } as never)
  const t = JSON.stringify(await ui.drawn())
  await ui.unmount()
  return t
}

for (const [name, store, merkmal] of [
  ['Cockpit', {}, 'Ctx:'],
  ['Sondermodus', { sondermodus: true }, 'RESSOURCEN'],
] as const) {
  test(`Bewertung der App: ${name} bleibt sichtbar, die Bewertung steht darunter`, async ($, on) => {
    const uhr = mock.clock(on, { now: T0 })
    basis(on, { ...store })
    await $.session.start({ cwd: 'C:/P', surface: 'desktop', isInteractive: true } as never)
    await uhr.advance(6000)
    for (const surface of ['desktop', 'terminal'] as const) {
      const t = await band($, surface)
      expect(`${surface}: ${t.includes(merkmal)}`).toBe(`${surface}: true`)
      expect(t).toContain('BEWERTUNG-DER-APP')
      // das Cockpit oben, die Bewertung darunter
      expect(t.indexOf(merkmal)).toBeLessThan(t.indexOf('BEWERTUNG-DER-APP'))
    }
  })
}
