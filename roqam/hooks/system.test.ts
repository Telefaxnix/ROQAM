import { expect, test } from 'claude-code/testing'

import { compareVersion, connectorServers, effortDe, parseChat, parseStatus, prettyModel, statusColor, untilReset } from './system'

test('Anthropic-Status lesen und färben', () => {
  const s = parseStatus(
    JSON.stringify({
      status: { indicator: 'minor', description: 'Minor Service Outage' },
      incidents: [{ id: 'abc123', name: 'Erhöhte Fehler bei Opus', status: 'investigating' }, { name: 'Alt', status: 'resolved' }],
    }),
  )
  expect(s).toEqual({ indicator: 'minor', description: 'Minor Service Outage', incidents: [{ text: 'Erhöhte Fehler bei Opus (investigating)', link: 'https://status.claude.com/incidents/abc123' }] })
  expect(statusColor('none')).toBe('green')
  expect(statusColor('minor')).toBe('yellow')
  expect(statusColor('critical')).toBe('red')
  expect(statusColor(undefined)).toBe('gray')
  expect(parseStatus('kaputt')).toBeUndefined()
})

test('Status nur aus genutzten Diensten: Console-Störung bleibt grün', () => {
  const komp = (id: string, name: string, status = 'operational') => ({ id, name, status })
  const json = (konsole: string, code: string) =>
    JSON.stringify({
      status: { indicator: 'minor', description: 'Partially Degraded Service' },
      components: [komp('a', 'claude.ai'), komp('b', 'Claude Console (platform.claude.com)', konsole), komp('c', 'Claude Code', code)],
      incidents: [{ id: 'x1', name: 'Elevated errors on platform.claude.com', status: 'monitoring', components: [{ id: 'b' }] }],
    })
  expect(parseStatus(json('degraded_performance', 'operational'))).toEqual({
    indicator: 'none',
    description: 'All services you use are operational',
    incidents: [],
    ignoriert: ['Claude Console (platform.claude.com)'],
  })
  expect(parseStatus(json('operational', 'degraded_performance'))?.indicator).toBe('minor')
  expect(parseStatus(json('operational', 'major_outage'))?.indicator).toBe('critical')
})

test('Modellname und Denkstufe auf Deutsch', () => {
  expect(prettyModel('claude-opus-5-5')).toBe('Opus 5.5')
  expect(prettyModel('claude-haiku-4-5-20251001')).toBe('Haiku 4.5')
  expect(prettyModel('claude-sonnet-5')).toBe('Sonnet 5')
  expect(prettyModel('claude-fable-5-1[1m]')).toBe('Fable 5.1')
  expect(effortDe('medium')).toBe('Medium')
  expect(effortDe('xhigh')).toBe('Extra high')
})

test('Versionen vergleichen', () => {
  expect(compareVersion('2.1.293', '2.1.292')).toBe(1)
  expect(compareVersion('2.1.292', '2.1.292')).toBe(0)
  expect(compareVersion('2.1.99', '2.1.292')).toBe(-1)
})

test('Restzeit bis zum Weekn-Reset', () => {
  const now = Date.parse('2026-10-07T11:00:00Z')
  expect(untilReset('2026-10-11T06:00:00Z', now)).toBe('−3d 19h')
  expect(untilReset('2026-10-07T16:12:00Z', now)).toBe('−5h12')
  expect(untilReset('2026-10-07T10:00:00Z', now)).toBeUndefined()
})

test('Connectors aus Werkzeugnamen, Namen für ID-Server', () => {
  const c = connectorServers([
    'Read',
    'mcp__claude_ai_Higgsfield__balance',
    'mcp__11111111-2222-3333-4444-555555555555__balance',
    'mcp__66666666-7777-8888-9999-000000000000__outlook_send_mail',
  ])
  expect([...c.values()]).toEqual(['Higgsfield', 'Higgsfield', 'Microsoft 365'])
})

test('offene Chats aus der Sitzungsdatei', () => {
  const json = JSON.stringify({ pid: 34400, sessionId: 'abc', name: 'Mods', entrypoint: 'claude-desktop', status: 'busy' })
  expect(parseChat(json, 'abc', new Set([34400]))).toEqual({ name: 'Mods', where: 'App', status: 'working', isSelf: true })
  expect(parseChat(json, 'x', new Set([1]))).toBeUndefined()
})

test('App-Chats tragen einen Link zum Hineinspringen, Konsolen-Chats nicht', () => {
  const app = JSON.stringify({ pid: 1, sessionId: 's1', entrypoint: 'claude-desktop', hostSessionId: 'local_abc', name: 'A', status: 'idle' })
  const konsole = JSON.stringify({ pid: 2, sessionId: 's2', entrypoint: 'cli', name: 'K', status: 'idle' })
  expect(parseChat(app, 'x', new Set([1]))?.link).toBe('claude://claude.ai/epitaxy/local_abc')
  expect(parseChat(konsole, 'x', new Set([2]))?.link).toBeUndefined()
})
