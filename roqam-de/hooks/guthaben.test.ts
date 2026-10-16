import { expect, test } from 'claude-code/testing'

import { guthabenTeile, parseGuthaben, swissOffsetMs } from './guthaben'

const NOW = Date.parse('2026-10-07T12:00:00Z')

test('Cloud-Guthaben mit Betrag, Ablaufdatum und Resttagen', () => {
  const teile = guthabenTeile(
    [{ name: 'Cloud-Guthaben', rest: 248, total: 250, einheit: '$', ablauf: '2026-11-05T08:59:00+01:00' }],
    NOW,
  )
  expect(teile).toEqual([
    { name: 'Cloud-Guthaben', geld: true, label: 'Cloud-Guthaben:', value: '248/250 $ bis 5.11.', note: 'noch 28 Tage', warn: false },
  ])
})

test('Gratis-Reset ohne Betrag; Warnung ab 7 Tagen; abgelaufen fällt weg', () => {
  const teile = guthabenTeile(
    [
      { name: 'Gratis-Reset', ablauf: '2026-10-12T23:59:00+02:00' },
      { name: 'Alt', ablauf: '2026-10-01T00:00:00Z' },
    ],
    NOW,
  )
  expect(teile.length).toBe(1)
  expect(teile[0]?.value).toBe('bis 12.10.')
  expect(teile[0]?.warn).toBe(true)
  expect(teile[0]?.geld).toBe(false)
})

test('Datei lesen: kaputt oder ohne Ablauf wird ignoriert', () => {
  expect(parseGuthaben('kaputt')).toEqual([])
  expect(parseGuthaben('[{"name":"x"},{"name":"y","ablauf":"2026-11-01"}]').length).toBe(1)
})

test('Kurzname aus der Datei', () => {
  const teile = guthabenTeile([{ name: 'Cloud-Guthaben', kurz: 'Cloud $', rest: 248, total: 250, einheit: '$', ablauf: '2026-11-05T08:59:00+01:00' }], NOW)
  expect(teile[0]?.kurz).toBe('Cloud $')
})

test('Ablaufdatum in Schweizer Zeit, Sommer- und Winterzeit', () => {
  expect(swissOffsetMs(Date.parse('2026-07-01T12:00:00Z'))).toBe(7200000)
  expect(swissOffsetMs(Date.parse('2026-12-01T12:00:00Z'))).toBe(3600000)
  // Umstellung 2026: 29.3. und 25.10., je 01:00 UTC
  expect(swissOffsetMs(Date.parse('2026-03-29T00:59:00Z'))).toBe(3600000)
  expect(swissOffsetMs(Date.parse('2026-03-29T01:00:00Z'))).toBe(7200000)
  expect(swissOffsetMs(Date.parse('2026-10-25T00:59:00Z'))).toBe(7200000)
  expect(swissOffsetMs(Date.parse('2026-10-25T01:00:00Z'))).toBe(3600000)
  // 22.10. um 23:30 Sommerzeit ist UTC schon 21:30 desselben Tags, 23.10. 00:30 aber UTC noch der 22.
  const teil = guthabenTeile([{ name: 'X', ablauf: '2026-10-23T00:30:00+02:00' }], Date.parse('2026-10-07T12:00:00Z'))
  expect(teil[0]?.value).toBe('bis 23.10.')
})

test('Nur zeigen, was es gibt: aufgebraucht, eingelöst oder abgelaufen fällt weg', () => {
  const now = Date.parse('2026-10-07T12:00:00Z')
  const liste = [
    { name: 'Cloud', rest: 0, total: 250, einheit: '$', ablauf: '2026-11-05T08:59:00+01:00' },
    { name: 'Reset', ablauf: '2026-10-22T23:59:00+02:00', verbraucht: true },
    { name: 'Alt', ablauf: '2026-10-01T00:00:00Z' },
    { name: 'Gilt', ablauf: '2026-10-22T23:59:00+02:00' },
  ]
  expect(guthabenTeile(liste, now).map(g => g.name)).toEqual(['Gilt'])
  expect(guthabenTeile([], now)).toEqual([])
})
