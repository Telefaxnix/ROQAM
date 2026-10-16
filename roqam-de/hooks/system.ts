// System-Zeile der Statusleiste: Anthropic-Status, Modell und Denkstufe, Claude-Code-Version, offene Chats,
// Connectors. Reine Rechenteile, damit sie sich testen lassen; das Abrufen steht in register.tsx.

import type { StatusleisteSystem } from '../types'

// Öffentliche Statusseite von Anthropic (Statuspage), kein Konto nötig
export const STATUS_URL = 'https://status.claude.com/api/v2/summary.json'
export const STATUS_PAGE = 'https://status.claude.com'
// Neueste veröffentlichte Claude-Code-Version
export const VERSION_URL = 'https://registry.npmjs.org/@anthropic-ai/claude-code/latest'

// Dienste, die Claude Code mit dem Abo nicht braucht: ihre Störungen färben den Punkt nicht
// (Console = platform.claude.com für API-Kunden; Government). Lehre 09.10.2026: eine Console-Störung hielt den
// Gesamtstand über zwei Tage auf «minor», obwohl claude.ai, API und Claude Code liefen.
const NICHT_GENUTZT = /console|platform\.claude\.com|government/i

// Komponentenstand → Stufe: in Betrieb = none, langsamer/Wartung = minor, teilweise aus = major, aus = critical
const STUFE: Record<string, number> = { operational: 0, degraded_performance: 1, under_maintenance: 1, partial_outage: 2, major_outage: 3 }
const INDICATOR = ['none', 'minor', 'major', 'critical']
const BESCHREIBUNG = ['Alle genutzten Dienste in Betrieb', 'Genutzte Dienste beeinträchtigt', 'Genutzte Dienste teilweise ausgefallen', 'Genutzte Dienste ausgefallen']

type Komponente = { id?: string; name?: string; status?: string; group?: boolean }

// Stand nur aus den genutzten Diensten (claude.ai, API, Claude Code, Cowork); ohne Komponentenliste der Gesamtstand
export function parseStatus(text: string): StatusleisteSystem['status'] | undefined {
  try {
    const j = JSON.parse(text)
    const gesamt = String(j?.status?.indicator ?? '')
    if (!gesamt) return undefined
    const alle: Komponente[] = (Array.isArray(j.components) ? j.components : []).filter((c: Komponente) => !c?.group)
    const genutzt = alle.filter(c => !NICHT_GENUTZT.test(c.name ?? ''))
    const genutztIds = new Set(genutzt.map(c => c.id))
    const ignoriert = alle.filter(c => NICHT_GENUTZT.test(c.name ?? '') && (STUFE[c.status ?? ''] ?? 0) > 0).map(c => c.name ?? '?')
    const incidents = (Array.isArray(j.incidents) ? j.incidents : [])
      .filter((i: { status?: string }) => i?.status !== 'resolved' && i?.status !== 'postmortem')
      // Störung ohne Komponentenangabe zählt mit; sonst nur, wenn sie einen genutzten Dienst betrifft
      .filter(
        (i: { components?: Komponente[] }) =>
          genutzt.length === 0 || !Array.isArray(i.components) || i.components.length === 0 || i.components.some(c => genutztIds.has(c.id)),
      )
      .map((i: { name?: string; status?: string; id?: string }) => ({
        text: `${i.name ?? '?'} (${i.status ?? '?'})`,
        ...(typeof i.id === 'string' && i.id ? { link: `${STATUS_PAGE}/incidents/${i.id}` } : {}),
      }))
      .slice(0, 4)
    if (genutzt.length === 0) return { indicator: gesamt, description: String(j.status.description ?? ''), incidents }
    const stufe = Math.max(...genutzt.map(c => STUFE[c.status ?? ''] ?? 0))
    return { indicator: INDICATOR[stufe], description: BESCHREIBUNG[stufe], incidents, ...(ignoriert.length ? { ignoriert } : {}) }
  } catch {
    return undefined
  }
}

// none = alles gut (grün), minor = beeinträchtigt (gelb), major und critical = Ausfall (rot), sonst (unbekannt/offline) grau
export function statusColor(indicator: string | undefined): string {
  return indicator === 'none' ? 'green' : indicator === 'minor' ? 'yellow' : indicator === 'major' || indicator === 'critical' ? 'red' : 'gray'
}

// «claude-opus-5-5» → «Opus 5.5», «claude-haiku-4-5-20251001» → «Haiku 4.5»
export function prettyModel(id: string | undefined): string | undefined {
  if (!id) return undefined
  const m = /^claude-([a-z]+)-(\d+)(?:-(\d+))?/.exec(id.replace(/\[.*\]$/, ''))
  if (!m) return id
  const name = m[1].charAt(0).toUpperCase() + m[1].slice(1)
  return m[3] !== undefined && m[3].length <= 2 ? `${name} ${m[2]}.${m[3]}` : `${name} ${m[2]}`
}

const EFFORT_DE: Record<string, string> = { low: 'Niedrig', medium: 'Mittel', high: 'Hoch', xhigh: 'Sehr hoch', max: 'Max' }

export function effortDe(level: string | number | undefined): string | undefined {
  if (level === undefined) return undefined
  return EFFORT_DE[String(level)] ?? String(level)
}

// 1, wenn a neuer als b («2.1.293» > «2.1.292»), -1 älter, 0 gleich
export function compareVersion(a: string, b: string): number {
  const pa = a.split(/[.-]/).map(n => Number(n) || 0)
  const pb = b.split(/[.-]/).map(n => Number(n) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0) ? 1 : -1
  }
  return 0
}

// Restzeit bis zum Wochen-Reset: «−3T 19h», unter einem Tag «−5h12»
export function untilReset(resetsAt: string | undefined, now: number): string | undefined {
  if (!resetsAt) return undefined
  const min = Math.round((Date.parse(resetsAt) - now) / 60000)
  if (!(min > 0)) return undefined
  const tage = Math.floor(min / 1440)
  const h = Math.floor((min % 1440) / 60)
  return tage > 0 ? `−${tage}T ${h}h` : `−${h}h${String(min % 60).padStart(2, '0')}`
}

// MCP-Server aus den Werkzeugnamen: «mcp__<server>__<tool>»; lesbarer Name, wo der Server nur eine ID hat
export function connectorServers(toolNames: readonly string[]): Map<string, string> {
  const tools = new Map<string, string[]>()
  for (const t of toolNames) {
    const m = /^mcp__(.+?)__(.+)$/.exec(t)
    if (!m) continue
    tools.set(m[1], [...(tools.get(m[1]) ?? []), m[2]])
  }
  const out = new Map<string, string>()
  for (const [server, names] of tools) out.set(server, connectorName(server, names))
  return out
}

export function connectorName(server: string, tools: readonly string[]): string {
  const known = server.replace(/^claude_ai_/, '').replace(/_/g, ' ')
  if (!/^[0-9a-f]{8}-/.test(server)) return known
  const has = (re: RegExp) => tools.some(t => re.test(t))
  if (has(/^balance$/) || has(/^generate_video$/)) return 'Higgsfield'
  if (has(/^outlook_/) || has(/^teams_/)) return 'Microsoft 365'
  if (has(/^pdf_/) || has(/^adobe_/)) return 'Adobe'
  if (has(/^batch$/) && has(/^guide$/)) return 'Claude Docs'
  return server.slice(0, 8)
}

// Laufende Claude-Sitzungen aus ~/.claude/sessions/<pid>.json (nur die, deren Prozess noch läuft)
export type Chat = { name: string; where: string; status: string; isSelf: boolean; link?: string }

export function parseChat(json: string, selfId: string, alive: Set<number> | undefined): Chat | undefined {
  try {
    const s = JSON.parse(json)
    if (typeof s.pid !== 'number' || typeof s.sessionId !== 'string') return undefined
    if (alive && !alive.has(s.pid)) return undefined
    const status = s.status === 'busy' ? 'arbeitet' : s.status === 'idle' ? 'bereit' : s.status === 'waiting' ? 'wartet' : String(s.status ?? '?')
    return {
      name: typeof s.name === 'string' && s.name ? s.name : s.sessionId.slice(0, 8),
      where: s.entrypoint === 'claude-desktop' ? 'App' : 'Konsole',
      status,
      isSelf: s.sessionId === selfId,
      // App-Chats öffnet der Link der Desktop-App; Konsolen-Chats haben keinen
      ...(s.entrypoint === 'claude-desktop' && typeof s.hostSessionId === 'string'
        ? { link: `claude://claude.ai/epitaxy/${s.hostSessionId}` }
        : {}),
    }
  } catch {
    return undefined
  }
}
