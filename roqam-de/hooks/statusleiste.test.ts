import { expect, test } from 'claude-code/testing'

import { bar, ctxColor, fmt, parseCredits, remaining, segments, usageColor, setCfg } from './register'

// alle Teile eingeschaltet, damit die Tests die volle Leiste sehen
setCfg({ higgsfield: true, apiKosten: true, aktionen: true })

test('liest die Credits aus der Higgsfield-Antwort', () => {
  expect(parseCredits('{"credits":182,"subscription_plan_type":"starter"}')).toBe(182)
  expect(parseCredits('kein JSON')).toBe(undefined)
})

test('zeichnet Balken', () => {
  expect(bar(0, 10)).toBe('▱▱▱▱▱▱▱▱▱▱')
  expect(bar(50, 10)).toBe('▰▰▰▰▰▱▱▱▱▱')
  expect(bar(130, 4)).toBe('▰▰▰▰')
})

test('färbt nach Verbrauch', () => {
  expect(usageColor(10)).toBe('green')
  expect(usageColor(70)).toBe('yellow')
  expect(usageColor(90)).toBe('red')
})

test('rechnet die Restzeit bis zum Zurücksetzen', () => {
  const now = Date.parse('2026-10-07T10:00:00Z')
  expect(remaining('2026-10-07T13:12:00Z', now)).toBe('−3h12')
  expect(remaining('2026-10-07T09:00:00Z', now)).toBe(undefined)
})

test('baut die Abschnitte', () => {
  const now = Date.parse('2026-10-07T10:00:00Z')
  const parts = segments({ credits: 182, fiveHour: 6, fiveHourResetsAt: '2026-10-07T13:12:00Z', week: 9, ctx: 8 }, now, 10)
  expect(parts.map(p => p.label)).toEqual(['ctx', '5h', '7T', 'Higgsfield'])
  expect(parts[3].value).toBe('182,0')
  expect(parts[3].suffix).toBe('/270Cr')
  // Higgsfield ohne Balken (07.10.2026)
  expect(parts[3].bar).toBeUndefined()
  expect(parts[3].color).toBe('green')
  expect(parts[3].labelColor).toBe('#D1FE17')
  expect(parts[0].labelColor).toBe('#EC7E7E')
  expect(parts[1].value).toBe('6,0%')
  expect(parts[1].note).toBe('−3h12')
  expect(segments({}, now, 10).map(p => `${p.label} ${p.value}`)).toEqual(['ctx 0,0%'])
})

test('färbt den Kontext: grün, ab 60 % orange, ab 75 % rot', () => {
  expect(ctxColor(59)).toBe('green')
  expect(ctxColor(60)).toBe('#EC7E7E')
  expect(ctxColor(74)).toBe('#EC7E7E')
  expect(ctxColor(75)).toBe('red')
})

test('eine Kommastelle mit deutschem Komma', () => {
  expect(fmt(90.14)).toBe('90,1')
  expect(fmt(3)).toBe('3,0')
  expect(fmt(180.5)).toBe('180,5')
})

test('nach dem Reset 0 % statt des alten Werts', () => {
  const now = Date.parse('2026-10-07T14:00:00Z')
  const parts = segments({ fiveHour: 64, fiveHourResetsAt: '2026-10-07T13:12:00Z', week: 40, weekResetsAt: '2026-10-11T06:00:00Z' }, now, 10)
  expect(parts.filter(p => p.label === '5h' || p.label === '7T').map(p => `${p.label} ${p.value} ${p.note ?? ''}`)).toEqual(['5h 0,0% ', '7T 40,0% −3T 16h'])
})
