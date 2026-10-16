// API-Kosten im laufenden Abo-Monat über ALLE Claude-Code-Sitzungen (Konsole und Code-Tab der App), gerechnet aus
// den Verläufen in ~/.claude/projects (jede Antwort steht dort mit Modell und Token-Zahlen). Cowork und normale
// Chats auf claude.ai laufen in der Cloud und hinterlassen keine Token-Zahlen auf dem Rechner: nicht enthalten.
// Preise: Anthropic-Listenpreise in US-Dollar pro Million Tokens (Stand 25.09.2026, Skill claude-api).

export type Price = { input: number; output: number; write5m: number; write1h: number; read: number }

export const PRICES: Record<string, Price> = {
  'claude-opus-5-5': { input: 4, output: 20, write5m: 5, write1h: 8, read: 0.2 },
  'claude-opus-5': { input: 5, output: 25, write5m: 6.25, write1h: 10, read: 0.5 },
  'claude-sonnet-5-5': { input: 2, output: 10, write5m: 2.5, write1h: 4, read: 0.2 },
  'claude-sonnet-5': { input: 2, output: 10, write5m: 2.5, write1h: 4, read: 0.2 },
  'claude-fable-5-1': { input: 10, output: 50, write5m: 12.5, write1h: 20, read: 0.25 },
  'claude-fable-5': { input: 10, output: 50, write5m: 12.5, write1h: 20, read: 1 },
  'claude-haiku-4-5': { input: 1, output: 5, write5m: 1.25, write1h: 2, read: 0.1 },
}

// Websuche: 10 $ pro 1000 Abfragen
const WEB_SEARCH_USD = 0.01

export function priceFor(model: string): Price | undefined {
  // «claude-haiku-4-5-20251001» → «claude-haiku-4-5»
  return PRICES[model] ?? PRICES[model.replace(/-\d{8}$/, '')]
}

type Usage = {
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
  cache_creation?: { ephemeral_5m_input_tokens?: number; ephemeral_1h_input_tokens?: number }
  server_tool_use?: { web_search_requests?: number }
  speed?: string
}

export function costOf(model: string, u: Usage): number | undefined {
  const p = priceFor(model)
  if (!p) return undefined
  const n = (v: number | undefined) => (typeof v === 'number' ? v : 0)
  const w1h = n(u.cache_creation?.ephemeral_1h_input_tokens)
  // ohne Aufteilung gilt die ganze Cache-Schreibmenge als 5-Minuten-Cache
  const w5m = u.cache_creation ? n(u.cache_creation.ephemeral_5m_input_tokens) : n(u.cache_creation_input_tokens)
  const tokens =
    n(u.input_tokens) * p.input +
    n(u.output_tokens) * p.output +
    w5m * p.write5m +
    w1h * p.write1h +
    n(u.cache_read_input_tokens) * p.read
  // Schnellmodus kostet das Doppelte
  const factor = u.speed === 'fast' ? 2 : 1
  return (tokens / 1e6) * factor + n(u.server_tool_use?.web_search_requests) * WEB_SEARCH_USD
}

// Kosten je Antwort einer Verlaufsdatei (JSONL), ab einem Zeitpunkt. Claude Code schreibt eine Antwort oft in
// mehreren Zeilen mit derselben message.id und derselben Abrechnung; wieder aufgenommene Sitzungen kopieren alte
// Antworten in eine neue Datei. Darum zählt jede message.id nur einmal (Schlüssel der Map).
export function costsInFile(jsonl: string, since: number): Map<string, number> {
  return new Map([...answersInFile(jsonl, since)].map(([id, a]) => [id, a.usd]))
}

// dasselbe mit dem Zeitpunkt jeder Antwort (fürs Kostenbuch); Modelle ohne Preis werden nicht gezählt, aber in
// ohnePreis gesammelt, damit die Anzeige darauf hinweisen kann
export function answersInFile(jsonl: string, since: number, ohnePreis?: Set<string>): Map<string, { t: number; usd: number }> {
  const out = new Map<string, { t: number; usd: number }>()
  for (const line of jsonl.split('\n')) {
    if (!line.includes('"usage"') || !line.includes('"assistant"')) continue
    try {
      const e = JSON.parse(line)
      const m = e.message
      if (e.type !== 'assistant' || !m?.usage || typeof m.model !== 'string' || m.model === '<synthetic>') continue
      const t = Date.parse(e.timestamp)
      if (!(t >= since)) continue
      const id = typeof m.id === 'string' ? m.id : `${e.requestId ?? ''}|${e.timestamp}`
      const usd = costOf(m.model, m.usage)
      if (usd !== undefined) out.set(id, { t, usd })
      else ohnePreis?.add(m.model)
    } catch {
      // unvollständige Zeile überspringen
    }
  }
  return out
}

// Kostenbuch: Die Desktop-App löscht mit einem Chat auch seinen Verlauf; ohne Buch fiele er aus der Monatssumme.
// Darum wird jede Antwort einmal mit Zeit, Betrag, Projektordner und Chat in ~/.claude/api-kostenbuch.json
// festgehalten und bleibt dort bis zum Ende des Abo-Monats, auch wenn der Verlauf verschwindet. Alle drei Werte
// (Chat / Projekt / alle) werden aus diesem Buch summiert, also aus denselben Antworten.
// Buchung: [Zeit ms, US-Dollar, Projektordner klein geschrieben, Chat-Kennung]
export type Buchung = [number, number, string, string]
export type Kostenbuch = { version: 1; since: number; antworten: Record<string, Buchung> }
export const KOSTENBUCH_DATEI = 'api-cost-log.json'

function istBuchung(b: unknown): b is Buchung {
  return (
    Array.isArray(b) && b.length === 4 && Number.isFinite(b[0]) && Number.isFinite(b[1]) &&
    typeof b[2] === 'string' && typeof b[3] === 'string'
  )
}

// Defekte Datei oder fremdes Format: leeres Ergebnis, nie ein Fehler; kaputte Einzeleinträge fallen weg
export function parseKostenbuch(text: string): Record<string, Buchung> {
  try {
    const j = JSON.parse(text)
    const out: Record<string, Buchung> = {}
    for (const [id, b] of Object.entries(j?.antworten ?? {})) if (istBuchung(b)) out[id] = b
    return out
  } catch {
    return {}
  }
}

// Vereinigung aller Quellen ab Monatsbeginn. Eine schon gebuchte Antwort behält Projekt und Chat der ersten
// Buchung (ein wieder aufgenommener Chat kopiert alte Antworten in eine neue Datei: nicht doppelt, nicht verschoben).
export function mergeKostenbuch(since: number, ...quellen: Iterable<[string, Buchung]>[]): Kostenbuch {
  const antworten: Record<string, Buchung> = {}
  for (const q of quellen) {
    for (const [id, b] of q) if (b[0] >= since && !(id in antworten)) antworten[id] = b
  }
  return { version: 1, since, antworten }
}

// Projektordner und Chat einer Verlaufsdatei unter ~/.claude/projects:
// <projekt>\<chat>.jsonl oder <projekt>\<chat>\subagents\agent-….jsonl (Unteragenten zählen zum Chat)
export function herkunft(path: string, projectsDir: string): { projekt: string; chat: string } {
  const rel = path.slice(projectsDir.length).replace(/^[\\/]+/, '').split(/[\\/]/)
  const projekt = (rel[0] ?? '').toLowerCase()
  const chat = rel.length > 2 ? rel[1] : (rel[1] ?? '').replace(/\.jsonl$/i, '')
  return { projekt, chat }
}

// chat bleibt undefined, solange das Buch keine Antwort dieses Chats kennt (dann zeigt die Leiste Claude Codes eigene Summe)
export function summen(buch: Kostenbuch, projekt: string, chat: string): { all: number; project: number; chat?: number; count: number } {
  const p = projekt.toLowerCase()
  let all = 0
  let project = 0
  let c: number | undefined
  let count = 0
  for (const [, usd, bp, bc] of Object.values(buch.antworten)) {
    all += usd
    count++
    if (bp === p) project += usd
    if (bc === chat) c = (c ?? 0) + usd
  }
  return { all, project, chat: c, count }
}

// Kosten der letzten Arbeit (Einblender, 15.10.2026): Antworten dieses Chats (samt Unteragenten) ab der eigenen Eingabe,
// aus demselben Buch wie «API:» in der Leiste; undefined, solange das Buch noch keine solche Antwort kennt
export function arbeitKosten(buch: Kostenbuch | undefined, chat: string, seit: number): number | undefined {
  if (!buch || !chat) return undefined
  let usd: number | undefined
  for (const [t, betrag, , bc] of Object.values(buch.antworten)) if (bc === chat && t >= seit) usd = (usd ?? 0) + betrag
  return usd
}

// Betrag wie «API:» in der Leiste: mit Tageskurs in Franken, ohne Kurs (offline) in Dollar, zwei Stellen, Komma
export function betragText(usd: number, usdChf: number | undefined): string {
  const kurs = typeof usdChf === 'number' && Number.isFinite(usdChf) && usdChf > 0 ? usdChf : undefined
  return `${(kurs === undefined ? usd : usd * kurs).toFixed(2)} ${kurs === undefined ? 'USD' : 'CHF'}`
}

// Beginn des laufenden Abo-Monats: derselbe Kalendertag wie beim Abschluss (z. B. der 14.), um dieselbe Uhrzeit
export function periodStart(subscribedAt: number, now: number): number {
  const s = new Date(subscribedAt)
  const n = new Date(now)
  const at = (y: number, mo: number) => {
    // kürzere Monate: auf den letzten Tag kürzen
    const last = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate()
    return Date.UTC(y, mo, Math.min(s.getUTCDate(), last), s.getUTCHours(), s.getUTCMinutes(), s.getUTCSeconds())
  }
  let start = at(n.getUTCFullYear(), n.getUTCMonth())
  if (start > now) start = at(n.getUTCFullYear(), n.getUTCMonth() - 1)
  return Math.max(start, subscribedAt)
}
