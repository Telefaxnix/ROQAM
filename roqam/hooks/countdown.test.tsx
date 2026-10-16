import { expect, mock, test } from 'claude-code/testing'

// Cache-Restzeit als NASA-Countdown (Vorgabe 14.10.2026): «T−42min» ohne Leerschlag zwischen Wort und Zahl,
// abgelaufen grau «T−0». Die übrigen Wörter behalten ihren Leerschlag.

const NOW = Date.parse('2026-10-07T10:00:00Z')

for (const [fall, cacheAt, sichtbar] of [
  ['läuft', NOW - 18 * 60000, 'T−42min'],
  ['abgelaufen', NOW - 61 * 60000, 'T−0'],
] as const) {
  test(`Countdown ${fall}: «${sichtbar}» in App und Konsole`, async ($, on) => {
    mock.clock(on, { now: NOW })
    mock.store(on)
    on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
      const { Box } = $.ui.resolve(e)
      return <Box />
    })
    on('state.get', { plugin: 'roqam', key: 'data' }, () => ({ value: { value: { ctx: 8, cacheAt }, version: 1 } }))
    for (const surface of ['desktop', 'terminal'] as const) {
      const ui = await $.ui.mount({
        plugin: 'roqam',
        surface,
        component: 'AbovePrompt',
        props: { bodyColumns: 160 },
        viewport: { columns: 160, rows: 40 },
      } as never)
      expect(await ui.find({ type: 'Text', text: new RegExp(sichtbar) })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /T −|Timeout|kalt/ })).toBeUndefined()
      expect(await ui.find({ type: 'Text', text: /Ctx: / })).toBeDefined()
      // Farbe des Worts «T» aus dem gezeichneten Baum (ui.find kennt keinen Filter nach Props): grau erst nach Ablauf
      const wort = JSON.stringify(await ui.drawn()).includes('"props":{"color":"gray"},"children":["T",""]')
      expect(wort).toBe(fall === 'abgelaufen')
      await ui.unmount()
    }
  })
}
