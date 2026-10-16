import { expect, test } from 'claude-code/testing'

import { chf, costSegment, parseKurs, segments, setCfg } from './register'

// alle Teile eingeschaltet, damit die Tests die volle Leiste sehen
setCfg({ higgsfield: true, apiKosten: true, aktionen: true })

test('API-Kosten in Franken mit zwei Stellen', () => {
  expect(chf(12.3456)).toBe('12.35 CHF')
  expect(costSegment(10, 0.83051)?.value).toBe('8.31 CHF')
  // Wort kurz «API:» (Vorgabe 15.10.2026)
  expect(costSegment(10, 0.83051)?.label).toBe('API:')
})

test('ohne Kurs in Dollar, ohne Kosten gar nicht', () => {
  expect(costSegment(4.5, undefined)?.value).toBe('4.50 USD')
  expect(costSegment(undefined, 0.83)).toBeUndefined()
})

test('liest den Kurs von frankfurter.app', () => {
  expect(parseKurs('{"amount":1.0,"base":"USD","date":"2026-10-06","rates":{"CHF":0.83051}}')).toBe(0.83051)
  expect(parseKurs('kaputt')).toBeUndefined()
})

test('API-Kosten stehen hinter dem Cache', () => {
  const now = Date.parse('2026-10-07T10:00:00Z')
  const labels = segments({ credits: 182, cacheAt: now, costUsd: 3, usdChf: 0.83 }, now + 60000, 10).map(s => s.label)
  expect(labels.slice(-3)).toEqual(['Higgsfield', 'T', 'API:'])
})
