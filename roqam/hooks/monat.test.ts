import { expect, test } from 'claude-code/testing'

import { answersInFile, costOf, costsInFile, herkunft, mergeKostenbuch, parseKostenbuch, periodStart, priceFor, summen } from './kosten'
import type { Buchung } from './kosten'
import { costSegment, newChatLink, projectSlug } from './register'

test('Preis je Antwort: Eingabe, Ausgabe, Cache, Websuche, Schnellmodus', () => {
  // Opus 5.5: 1 Mio. Ausgabe = 20 $, 1 Mio. Cache gelesen = 0.20 $, 1 Mio. 1-h-Cache geschrieben = 8 $
  expect(costOf('claude-opus-5-5', { output_tokens: 1e6 })).toBe(20)
  expect(Math.round((costOf('claude-opus-5-5', { cache_read_input_tokens: 1e6 }) ?? 0) * 100)).toBe(20)
  expect(costOf('claude-opus-5-5', { cache_creation: { ephemeral_1h_input_tokens: 1e6, ephemeral_5m_input_tokens: 0 } })).toBe(8)
  expect(costOf('claude-opus-5-5', { cache_creation_input_tokens: 1e6 })).toBe(5)
  expect(costOf('claude-opus-5-5', { output_tokens: 1e6, speed: 'fast' })).toBe(40)
  expect(Math.round((costOf('claude-sonnet-5', { server_tool_use: { web_search_requests: 3 } }) ?? 0) * 100)).toBe(3)
  expect(priceFor('claude-haiku-4-5-20251001')?.input).toBe(1)
  expect(costOf('unbekannt', { output_tokens: 1 })).toBeUndefined()
})

test('jede Antwort zählt einmal, nur ab Monatsbeginn, keine synthetischen', () => {
  const zeile = (id: string, ts: string, model = 'claude-opus-5-5') =>
    JSON.stringify({ type: 'assistant', timestamp: ts, message: { id, model, usage: { output_tokens: 1e6 } } })
  const jsonl = [
    zeile('a', '2026-10-01T10:00:00Z'),
    zeile('a', '2026-10-01T10:00:01Z'),
    zeile('b', '2026-09-01T10:00:00Z'),
    zeile('c', '2026-10-02T10:00:00Z', '<synthetic>'),
    '{"type":"user"}',
  ].join('\n')
  const costs = costsInFile(jsonl, Date.parse('2026-09-14T00:00:00Z'))
  expect([...costs.keys()]).toEqual(['a'])
  expect(costs.get('a')).toBe(20)
})

test('Abo-Monat beginnt am Abschlusstag', () => {
  const abo = Date.parse('2026-09-14T06:59:56Z')
  expect(new Date(periodStart(abo, Date.parse('2026-10-07T12:00:00Z'))).toISOString()).toBe('2026-09-14T06:59:56.000Z')
  expect(new Date(periodStart(abo, Date.parse('2026-10-20T12:00:00Z'))).toISOString()).toBe('2026-10-14T06:59:56.000Z')
  const ende = Date.parse('2026-01-31T08:00:00Z')
  expect(new Date(periodStart(ende, Date.parse('2026-03-05T12:00:00Z'))).toISOString()).toBe('2026-02-28T08:00:00.000Z')
})

test('Anzeige: Chat / Projekt / alle Projekte im Abo-Monat', () => {
  expect(costSegment(10, 0.8, 500, 100)?.value).toBe('8.00 / 80.00 / 400.00 CHF')
  expect(costSegment(10, 0.8, 500)?.value).toBe('8.00 / … / 400.00 CHF')
  expect(costSegment(10, 0.8, undefined)?.value).toBe('8.00 CHF')
  expect(costSegment(undefined, 0.8, 500, 100)?.value).toBe('… / 80.00 / 400.00 CHF')
})

test('Projektordner wie Claude Code ihn benennt, Link für neuen Chat', () => {
  expect(projectSlug('C:\\Meine Projekte\\Haus-Technik')).toBe('C--Meine-Projekte-Haus-Technik')
  expect(newChatLink('C:\\Meine Projekte')).toBe('claude://code/new?folder=C%3A%5CMeine%20Projekte')
})

test('Kostenbuch: gelöschter Chat zählt weiter, nichts doppelt, neuer Monat räumt ab', () => {
  const since = Date.parse('2026-09-14T06:59:56Z')
  const t = Date.parse('2026-10-01T10:00:00Z')
  // altes Buch: Antwort a aus einem inzwischen gelöschten Chat, b aus dem Vormonat
  const alt = parseKostenbuch(JSON.stringify({
    version: 1,
    since,
    antworten: { a: [t, 5, 'c--x-wow', 'weg'], b: [since - 1, 99, 'c--x-wow', 'alt'], kaputt: [1, 'x'] },
  }))
  expect(Object.keys(alt).sort()).toEqual(['a', 'b'])
  // heute gelesen: c in diesem Chat, a nochmals (kopiert in einen wieder aufgenommenen Chat)
  const heute: [string, Buchung][] = [['c', [t, 2, 'c--x-pc', 'jetzt']], ['a', [t, 5, 'c--x-pc', 'jetzt']]]
  const buch = mergeKostenbuch(since, Object.entries(alt), heute)
  expect(Object.keys(buch.antworten).sort()).toEqual(['a', 'c'])
  // a behält Projekt und Chat der ersten Buchung
  expect(buch.antworten.a[2]).toBe('c--x-wow')
  const s = summen(buch, 'C--X-PC', 'jetzt')
  expect(s.all).toBe(7)
  expect(s.project).toBe(2)
  expect(s.chat).toBe(2)
  // unbekannter Chat: undefined, damit die Leiste Claude Codes eigene Summe zeigt
  expect(summen(buch, 'C--X-PC', 'neu').chat).toBeUndefined()
  // defekte Datei: leer, kein Fehler
  expect(parseKostenbuch('{kaputt')).toEqual({})
})

test('Herkunft einer Verlaufsdatei: Projekt und Chat, Unteragenten zum Chat', () => {
  const dir = 'C:\\Users\\D\\.claude\\projects'
  expect(herkunft(`${dir}\\C--Claude-Code-Projekte\\abc.jsonl`, dir)).toEqual({ projekt: 'c--claude-code-projekte', chat: 'abc' })
  expect(herkunft(`${dir}\\C--Claude-Code-Projekte\\abc\\subagents\\agent-1.jsonl`, dir)).toEqual({ projekt: 'c--claude-code-projekte', chat: 'abc' })
})

test('Antworten mit Zeitpunkt', () => {
  const zeile = JSON.stringify({ type: 'assistant', timestamp: '2026-10-01T10:00:00Z', message: { id: 'a', model: 'claude-opus-5-5', usage: { output_tokens: 1e6 } } })
  expect(answersInFile(zeile, 0).get('a')).toEqual({ t: Date.parse('2026-10-01T10:00:00Z'), usd: 20 })
})
