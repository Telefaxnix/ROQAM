// Easter Egg geheim halten (Vorgabe 16.10.2026): Die Regel im System-Prompt bestätigt nur, dass es eines gibt, und
// verrät kein Auslösewort. Geprüft wird über die Prüfsummen, damit auch dieser Test kein Wort im Klartext enthält.
import { expect, test } from 'claude-code/testing'

import { EASTER_EGG_ID, EASTER_EGG_REGEL } from './easter-egg-regel'
import { TON_PRUEFSUMME } from './klang'
import { geheimwort } from './sondermodus-farben'

test('Regel: Existenz bestätigen, sonst nichts verraten', () => {
  expect(EASTER_EGG_REGEL.includes('only confirm that there is one')).toBe(true)
  expect(EASTER_EGG_REGEL.includes('Do not bring it up yourself')).toBe(true)
  expect(EASTER_EGG_REGEL.includes('neither confirm nor deny')).toBe(true)
  expect(EASTER_EGG_REGEL.includes('has to find it alone')).toBe(true)
})

test('Regel enthält keines der Auslösewörter', () => {
  const woerter = EASTER_EGG_REGEL.toLowerCase().split(/[^a-zäöüéè]+/).filter(Boolean)
  expect(woerter.length > 40).toBe(true)
  expect(woerter.filter(w => geheimwort(w) !== undefined || geheimwort(w, TON_PRUEFSUMME) !== undefined)).toEqual([])
})

test('prompt.compose hängt die Regel einmal an und lässt die übrigen Abschnitte stehen', async ($, on) => {
  on('prompt.compose', () => ({
    sections: [
      { id: 'engine', text: 'Grundtext', scope: 'session' },
      { id: EASTER_EGG_ID, text: 'alt', scope: 'session' },
    ],
  }))
  const { sections } = await $.prompt.compose({ model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: ['desktop'], tools: [], outputStyle: null, traits: [] })
  expect(sections.map(s => s.id)).toEqual(['engine', EASTER_EGG_ID])
  expect(sections[1]?.text).toBe(EASTER_EGG_REGEL)
  expect(sections[1]?.scope).toBe('session')
})
