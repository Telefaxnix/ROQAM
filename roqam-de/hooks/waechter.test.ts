import { expect, test } from 'claude-code/testing'

import { dauer, inFolge, KEINE_TOKENS, LANG_MS, schrittText, signatur, tokensPlus, tokenText, tokenZahl, waechterText } from './waechter'

test('Kurzbeschreibung eines Schritts', () => {
  expect(schrittText('Bash', { command: 'git status', description: 'Stand zeigen' })).toBe('Bash: Stand zeigen')
  expect(schrittText('Read', { file_path: 'C:\\Projekte\\RECHNER.md' })).toBe('Read: RECHNER.md')
  expect(schrittText('Grep', { pattern: 'epitaxy' })).toBe('Grep: epitaxy')
  expect(schrittText('mcp__abc__balance', {})).toBe('balance')
  expect(schrittText('Bash', { command: 'x'.repeat(80) }).length).toBeLessThan(60)
})

test('Gleiche Aufrufe in Folge erkennen, reservierte Schlüssel zählen nicht', () => {
  const a = signatur('Bash', { command: 'ls', tool_use_id: '1' })
  const b = signatur('Bash', { command: 'ls', tool_use_id: '2' })
  const c = signatur('Bash', { command: 'pwd' })
  expect(a).toBe(b)
  expect(inFolge([c, a, b, a])).toBe(3)
  expect(inFolge([a, c])).toBe(1)
  expect(inFolge([])).toBe(0)
})

test('Text für die Leiste', () => {
  const now = Date.parse('2026-10-07T20:00:00Z')
  expect(waechterText({}, now)).toBeUndefined()
  expect(dauer(312000)).toBe('5:12')
  expect(dauer(3723000)).toBe('1:02:03')
  expect(waechterText({ seit: now - 312000, letzter: { was: 'Grep: x', ende: now - 8000 } }, now)?.text).toBe(
    'Arbeitet seit 5:12 · letzter Schritt vor 8 s: Grep: x',
  )
  const lang = waechterText({ seit: now - 400000, laufend: [{ id: 'a', was: 'Bash: suchen', seit: now - LANG_MS - 1000 }] }, now)
  expect(lang?.text).toBe('Arbeitet seit 6:40 · läuft seit 4 min: Bash: suchen')
  expect(lang?.lang).toBe(true)
  expect(waechterText({ seit: now - 5000 }, now)?.text).toBe('Arbeitet seit 0:05 · denkt nach')
})

test('Token-Zähler: Ein mit Cache, Aus, deutsche Kurzform', () => {
  const t = tokensPlus(KEINE_TOKENS, { input_tokens: 10, output_tokens: 1500, cache_read_input_tokens: 120000, cache_creation_input_tokens: 2345 })
  expect(t).toEqual({ ein: 122355, aus: 1500 })
  expect(tokenZahl(0)).toBe('0,0k')
  expect(tokenZahl(568)).toBe('0,6k')
  expect(tokenZahl(12345)).toBe('12,3k')
  expect(tokenZahl(1234567)).toBe('1,23M')
  expect(tokenText(t)).toBe('Ein: 122,4k / Aus: 1,5k')
})
