import { expect, test } from 'claude-code/testing'

import { aufnahmeProgramm, istPrivat } from './aufnahme'
import { waechterText } from './waechter'

test('Aufnahmeprogramm in der Prozessliste erkennen', () => {
  const csv = '"System","4","Services","0","1 K"\r\n"obs64.exe","1234","Console","1","200 K"\r\n'
  expect(aufnahmeProgramm(csv)).toBe('OBS')
  expect(aufnahmeProgramm('"Greenshot.exe","1","Console","1","1 K"')).toBeUndefined()
})

test('Privat von Hand oder durch ein Programm', () => {
  expect(istPrivat({})).toBe(false)
  expect(istPrivat({ hand: true })).toBe(true)
  expect(istPrivat({ programm: 'OBS' })).toBe(true)
})

test('Wächter-Zeile ohne Pfade und Befehle während der Aufnahme', () => {
  const now = Date.parse('2026-10-07T20:00:00Z')
  const w = { seit: now - 60000, letzter: { was: 'Read: C:\\Users\\x\\geheim.md', ende: now - 3000 } }
  expect(waechterText(w, now, true)?.text).toBe('Arbeitet seit 1:00 · letzter Schritt vor 3 s')
  expect(waechterText(w, now)?.text).toContain('geheim.md')
})
