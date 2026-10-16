import { expect, mock, test } from 'claude-code/testing'

import { CACHE_TTL_MS, cacheSegment, lastAnswerAt, segments, setCfg } from './register'

// alle Teile eingeschaltet, damit die Tests die volle Leiste sehen
setCfg({ higgsfield: true, apiKosten: true, aktionen: true })

const START = Date.parse('2026-10-07T10:00:00Z')

test('Cache: Restzeit ab der letzten Antwort, ohne Balken', () => {
  const s = cacheSegment(START, START + 18 * 60000)
  expect(s?.label).toBe('T')
  expect(s?.value).toBe('−42min')
  expect(s?.bar).toBeUndefined()
  expect(s?.color).toBe('green')
  expect(cacheSegment(START, START + 55 * 60000)?.color).toBe('red')
})

test('Cache: nach einer Stunde grau T−0, vor der ersten Antwort nicht angezeigt', () => {
  expect(cacheSegment(START, START + CACHE_TTL_MS + 1000)?.value).toBe('−0')
  expect(cacheSegment(START, START + CACHE_TTL_MS + 1000)?.labelColor).toBe('gray')
  expect(cacheSegment(undefined, START)).toBeUndefined()
})

test('Cache steht hinter Higgsfield', () => {
  const labels = segments({ credits: 182, cacheAt: START }, START + 60000, 10).map(s => s.label)
  expect(labels.slice(-2)).toEqual(['Higgsfield', 'T'])
})

test('Cache-Start: letzte Antwort im Hauptchat aus der Sitzungsdatei', () => {
  const jsonl = [
    '{"type":"user","timestamp":"2026-10-07T09:00:00.000Z"}',
    '{"type":"assistant","isSidechain":false,"timestamp":"2026-10-07T09:05:00.000Z"}',
    '{"type":"assistant","isSidechain":true,"timestamp":"2026-10-07T09:10:00.000Z"}',
    '{"type":"last-prompt"}',
    '{"type":"assistant","timest',
  ].join('\n')
  expect(lastAnswerAt(jsonl)).toBe(Date.parse('2026-10-07T09:05:00.000Z'))
  expect(lastAnswerAt('')).toBeUndefined()
})
// 11.10.2026: Die Cache-Uhr lief nur ab turn.complete. Eine stundenlange Antwort zeigte «kalt», obwohl jede
// Modellanfrage den Cache auffrischt. Jetzt stellt turn.step im Hauptchat die Uhr neu, ein Unteragent nicht.
test('Cache-Start: jede Modellanfrage im Hauptchat stellt die Uhr neu, ein Unteragent nicht', async ($, on) => {
  const uhr = mock.clock(on, { now: START })
  mock.store(on)
  mock.env(on, { USERPROFILE: 'C:/U' })
  on('session.model', () => ({ value: 'claude-opus-5-5' }) as never)
  // an Stelle der Engine: der State der Leiste im Speicher, damit der Test lesen kann, was der Mod schreibt
  let daten: { cacheAt?: number } | undefined
  let version = 0
  on('state.get', { plugin: 'roqam-de', key: 'data' }, () => ({ value: { value: daten, version } }) as never)
  on('state.set', { plugin: 'roqam-de', key: 'data' }, ($, e) => {
    daten = (e as { value: typeof daten }).value
    version++
    return { value: { isSet: true, version } } as never
  })
  // an Stelle des Modells: eine leere Antwort
  on('turn.step', async function* ($, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null } as never
  })
  const schritt = async (agentId?: string) => {
    const s = $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', messageCount: 1, ...(agentId ? { agentId } : {}) })
    for await (const _ of s) void _
    await s.result
  }
  const cacheAt = async () => daten?.cacheAt

  await schritt('agent-1')
  expect(await cacheAt(), 'Unteragent allein stellt keine Uhr').toBeUndefined()
  await schritt()
  expect(await cacheAt(), 'Hauptchat stellt die Uhr').toBe(START)
  await uhr.advance(30 * 60000)
  await schritt('agent-1')
  expect(await cacheAt(), 'Unteragent lässt die Uhr stehen').toBe(START)
  await schritt()
  expect(await cacheAt(), 'nächste Anfrage im Hauptchat stellt neu').toBe(START + 30 * 60000)
})
