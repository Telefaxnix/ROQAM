// Wächter: zeigt, ob Claude noch arbeitet und woran, und fragt nach, wenn ein Schritt hängt oder sich wiederholt.
//   «Arbeitet seit 5:12 · letzter Schritt vor 8 s: Bash: Tests laufen lassen»
//   «Arbeitet seit 5:12 · läuft seit 42 s: Grep: epitaxy»
// Rückfrage «Weiterlaufen / Abbrechen» bei einem Schritt über LANG_MS oder bei WIEDERHOLUNG gleichen Aufrufen in Folge.
// Reine Rechnungen hier; die Hooks stehen in register.tsx.

export const LANG_MS = 4 * 60 * 1000
export const WIEDERHOLUNG = 3
export const WEITER = 'Continue'
export const ABBRECHEN = 'Cancel'
export const WAECHTER_FRAGE = 'Watchdog'

// Schlüssel, die nicht zum Werkzeug gehören (Claude Code entfernt sie vor dem Aufruf)
const RESERVIERT = new Set(['tool', 'tool_use_id', 'consent', 'agentId'])

function kurz(text: string, max = 48): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

function dateiname(p: unknown): string | undefined {
  return typeof p === 'string' && p ? p.split(/[\\/]/).filter(Boolean).pop() : undefined
}

// Kurzbeschreibung eines Aufrufs für die Leiste: Werkzeug und das Wichtigste daraus
export function schrittText(tool: string, input: Record<string, unknown>): string {
  const s = (k: string) => (typeof input[k] === 'string' ? (input[k] as string) : undefined)
  const name = tool.startsWith('mcp__') ? tool.split('__').pop() ?? tool : tool
  const was =
    s('description') ??
    dateiname(input.file_path ?? input.notebook_path) ??
    s('pattern') ??
    s('command') ??
    s('query') ??
    s('url') ??
    s('prompt') ??
    s('skill')
  return was ? `${name}: ${kurz(was)}` : name
}

// Fingerabdruck eines Aufrufs: Werkzeug und Eingaben ohne die reservierten Schlüssel
export function signatur(tool: string, input: Record<string, unknown>): string {
  const rest = Object.keys(input)
    .filter(k => !RESERVIERT.has(k))
    .sort()
    .map(k => [k, input[k]])
  return `${tool}|${JSON.stringify(rest)}`
}

// Wie oft derselbe Aufruf zuletzt in Folge kam (die Liste endet mit dem neuesten)
export function inFolge(verlauf: readonly string[]): number {
  if (verlauf.length === 0) return 0
  const letzter = verlauf[verlauf.length - 1]
  let n = 0
  for (let i = verlauf.length - 1; i >= 0 && verlauf[i] === letzter; i--) n++
  return n
}

// «0:42», «5:12», «1:02:03»
export function dauer(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sek = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sek}` : `${m}:${sek}`
}

// «8 s», «2 min»
function seit(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  return s < 120 ? `${s} s` : `${Math.round(s / 60)} min`
}

export type WaechterSchritt = { id: string; was: string; seit: number }

export type WaechterStand = {
  // Beginn der laufenden Antwort im Hauptchat (ms); fehlt, wenn Claude nicht arbeitet
  seit?: number
  turnId?: string
  // gerade laufende Schritte (bei parallelen Aufrufen mehrere; id = tool_use_id, damit jeder nur den eigenen entfernt)
  laufend?: WaechterSchritt[]
  // zuletzt beendeter Schritt
  letzter?: { was: string; ende: number }
}

// der am längsten laufende Schritt: den zeigt die Leiste, auf den bezieht sich die 4-Minuten-Frage
export function aeltester(w: WaechterStand): WaechterSchritt | undefined {
  let a: WaechterSchritt | undefined
  for (const s of w.laufend ?? []) if (!a || s.seit < a.seit) a = s
  return a
}

// Text für die Leiste, oder nichts, wenn Claude nicht arbeitet. lang: der laufende Schritt dauert schon über LANG_MS.
// privat (Aufnahme-Modus): ohne den Schritt selbst, der Pfade und Befehle enthalten kann
export function waechterText(w: WaechterStand, now: number, privat = false): { text: string; lang: boolean } | undefined {
  if (w.seit === undefined) return undefined
  const kopf = `Working for ${dauer(now - w.seit)}`
  const was = (s: string) => (privat ? '' : `: ${s}`)
  const schritt = aeltester(w)
  if (schritt) {
    const ms = now - schritt.seit
    return { text: `${kopf} · running for ${seit(ms)}${was(schritt.was)}`, lang: ms >= LANG_MS }
  }
  if (w.letzter) return { text: `${kopf} · last step ${seit(now - w.letzter.ende)} ago${was(w.letzter.was)}`, lang: false }
  return { text: `${kopf} · thinking`, lang: false }
}

// Token-Zähler rechts in der Wächter-Zeile: Ein = alles, was das Modell gelesen hat (ungecacht + aus dem Cache +
// in den Cache geschrieben), Aus = erzeugt. Gezählt seit Chatbeginn
// (bzw. seit dem letzten Laden des Mods). Subagenten zählen mit.
export type Tokens = { ein: number; aus: number }
export const KEINE_TOKENS: Tokens = { ein: 0, aus: 0 }

export function tokensPlus(t: Tokens, u: { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }): Tokens {
  return { ein: t.ein + u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens, aus: t.aus + u.output_tokens }
}

// 568 → «0,6k», 12'345 → «12,3k», 1'234'567 → «1,23M»; auch unter 1000 mit «k», damit die Zahl nicht abgeschnitten
// aussieht (Vorgabe 09.10.2026)
export function tokenZahl(n: number): string {
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`
  return `${(n / 1_000_000).toFixed(2)}M`
}

export function tokenText(t: Tokens): string {
  return `In: ${tokenZahl(t.ein)} / Out: ${tokenZahl(t.aus)}`
}

// Zusammenstellung der letzten Arbeit im Einblender oben im Band (Vorgabe 15.10.2026): gezählt ab der eigenen Eingabe
// bis «bereit», Ein wie im Wächter mit Cache, dazu das Total und die API-Kosten:
// «EIN 1,55M · AUS 5,5k · TOTAL 1,56M · API 0,85 CHF». Ohne Tokens keine Zusammenstellung (dann der gewohnte Text),
// ohne Kosten (ausgeschaltet, Aufnahme-Modus, noch nicht gebucht) ohne «API».
export function arbeitText(t: Tokens, api?: string): string | undefined {
  if (!(t.ein + t.aus > 0)) return undefined
  const teile = [`IN ${tokenZahl(t.ein)}`, `OUT ${tokenZahl(t.aus)}`, `TOTAL ${tokenZahl(t.ein + t.aus)}`]
  if (api) teile.push(`API ${api}`)
  return teile.join(' · ')
}
