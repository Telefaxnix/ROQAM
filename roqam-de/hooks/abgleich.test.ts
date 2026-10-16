import { expect, test } from 'claude-code/testing'

import { abgleichWarnung } from './abgleich'

const NOW = Date.parse('2026-10-08T20:30:00Z')

test('GitHub-Abgleich: frisch und fehlerfrei → keine Anzeige', () => {
  const text = JSON.stringify({ zeit: '2026-10-08T22:28:00+02:00', letzterErfolg: '2026-10-08T22:28:00+02:00', fehler: [] })
  expect(abgleichWarnung(text, NOW)).toBe(undefined)
})

test('GitHub-Abgleich: Fehler wird gezeigt, auch wenn der letzte Erfolg frisch ist', () => {
  const text = JSON.stringify({ letzterErfolg: '2026-10-08T22:25:00+02:00', fehler: ['Sternwarte: Hochladen fehlgeschlagen'] })
  const z = abgleichWarnung(text, NOW)
  expect(z?.[0]).toBe('Sternwarte: Hochladen fehlgeschlagen')
})

test('GitHub-Abgleich: über 30 Minuten ohne Erfolg → Warnung mit Alter', () => {
  const text = '﻿' + JSON.stringify({ letzterErfolg: '2026-10-08T21:50:00+02:00', fehler: [] })
  const z = abgleichWarnung(text, NOW)
  expect(z?.[0]).toBe('Letzter fehlerfreier Abgleich vor 40 min.')
})

test('GitHub-Abgleich: fehlende oder kaputte Datei → Warnung', () => {
  expect(abgleichWarnung('', NOW)?.[0]).toBe('Der GitHub-Abgleich hat noch keinen Stand geschrieben.')
})
