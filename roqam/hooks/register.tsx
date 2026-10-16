import { atom, read, update } from 'claude-code'
import type { BoxProps, ElementConstructor, EngineInterface, Register, RenderElement, RenderInput, SessionContextUsage, SessionRateLimit, SvgProps, TextProps } from 'claude-code'

import type { StatusleisteData, StatusleisteNacht, StatusleisteTempo, StatusleisteWetter } from '../types'

import { clock, forecastUrl, himmelFarbe, MOND_GROESSE, MOND_STUFEN, mondEmoji, mondPhase, mondStufe, mondSvg, parseForecast, parseSeeing, seeingUrl, summarize } from './nacht'
import type { Forecast, SeeingForecast } from './nacht'
import { answersInFile, arbeitKosten, betragText, herkunft, KOSTENBUCH_DATEI, mergeKostenbuch, parseKostenbuch, periodStart, summen } from './kosten'
import type { Buchung, Kostenbuch } from './kosten'
import { aktionSignatur, aktionZeilen } from './aktion'
import { abgleichWarnung } from './abgleich'
import { guthabenEintrag, guthabenTeile, parseGuthaben } from './guthaben'
import { compareVersion, connectorServers, effortDe, parseChat, parseStatus, prettyModel, statusColor, STATUS_PAGE, STATUS_URL, untilReset, VERSION_URL } from './system'
import type { Chat } from './system'
import type { StatusleisteAufnahme, StatusleisteSystem, StatusleisteWaechter, StatusleisteZiel } from '../types'
import { AUFNAHME_AUS_KEY, AUFNAHME_KEY, aufnahmeProgramm, istPrivat } from './aufnahme'
import { aufgabeAendern, aufgabeNeu, ausTodoWrite, ZIEL_SYSTEM, zielAnzeige, zielAusAntwort, zielPrompt } from './ziel'
import { ABBRECHEN, aeltester, arbeitText, dauer, inFolge, KEINE_TOKENS, schrittText, signatur, tokensPlus, tokenText, WAECHTER_FRAGE, WEITER, WIEDERHOLUNG, waechterText } from './waechter'
import type { Tokens } from './waechter'
import type { SondermodusSchalter, SondermodusPhase, SterneSchalter } from '../types'
import { AMPEL, AUFNAHME_WORT, BALKEN_HOEHE, BALKEN_SPUR, BLINKEN_SVG, bereitTon, ECKE_ALT, ECKE_RADIUS, eckeSvg, einblenderFarbe, einblenderFuer, einblenderText, fuellBalkenSvg, fuellBalkenZeichen, fussZeile, geheimwort, istEigeneEingabe, istSchlussBlock, SONDERMODUS, SONDERMODUS_KEY, sondermodusFarbe, sondermodusMeldung, schlussVon, standAus, WORT_AUSGABE, WORT_EINGABE, WORT_FRAGE, WORT_ZWISCHENSCHRITT } from './sondermodus-farben'
import type { Einblender, Stand } from './sondermodus-farben'
import { bereitKlang, KLANG_PAUSE_MS, klangBefehl, TON_KEY, TON_PRUEFSUMME, tonMeldung } from './klang'
import type { Klang } from './klang'
import { EASTER_EGG_ID, EASTER_EGG_REGEL } from './easter-egg-regel'
import { RAETSEL_KEY, raetselFuer } from './raetsel'

// Statuszeile für die Konsolenversion von Claude Code, als eigene Zeile über der Eingabe:
//   ctx ▰▱▱▱▱▱▱▱▱▱ 8,4% │ 5h ▰▱▱▱▱▱▱▱▱▱ 6,0% −3h12 │ Woche ▰▱▱▱▱▱▱▱▱▱ 9,0% │ Higgsfield 182,0/270Cr
// Higgsfield-Credits kommen über den claude.ai-Connector, die Claude-Werte vom Abo.

// Im Terminal heisst der Connector «claude.ai Higgsfield», in der Desktop-App trägt er seine ID.
// Beide `…__balance` stehen unter permissions.allow in ~/.claude/settings.json, sonst blockt der Auto-Modus.
// Einstellungen aus /config (plugin.json → userConfig); register() setzt sie beim Laden. Die Astro-Zeile ist fest
// eingebaut, sobald ein Ort gesetzt ist (Vorgabe 14.10.2026: Gimmick «schau mal raus», kein Schalter mehr)
// aktionen: «⚑ Neue Aktion» melden (bis 15.10.2026 hiess die Option «guthaben» und zeigte auch Guthaben aus einer Datei)
// Ab Werk an (Vorgabe Dominik 16.10.2026: «was abgreifbar ist, abgreifen»): API-Kosten und Higgsfield; Higgsfield
// erscheint aber nur, wenn der Connector da ist (wird alle 5 Minuten neu gesucht, auch nachträglich verbunden)
// wetterUrl: eigene Wetterstation statt Open-Meteo (JSON-Antwort mit latest.temp/dew_point/hum.value);
// neuOrdner: Ordner für «+ Neu» (leer = Ordner dieses Chats). Beides leer ab Werk (16.10.2026, eine Leiste für alle)
export type Einstellungen = { ort: string; apiKosten: boolean; higgsfield: boolean; higgsfieldMax: number; aktionen: boolean; wetterUrl: string; neuOrdner: string }
export let cfg: Einstellungen = { ort: '', apiKosten: true, higgsfield: true, higgsfieldMax: 270, aktionen: true, wetterUrl: '', neuOrdner: '' }
// nur für Tests: Einstellungen setzen
export function setCfg(c: Partial<Einstellungen>) {
  cfg = { ...cfg, ...c }
}

export function readOptions(o: Record<string, unknown> | undefined): Einstellungen {
  const b = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d)
  return {
    ort: typeof o?.location === 'string' ? o.location.trim() : '',
    apiKosten: b(o?.apiCost, true),
    higgsfield: b(o?.higgsfield, true),
    higgsfieldMax: typeof o?.higgsfieldMax === 'number' && o.higgsfieldMax > 0 ? o.higgsfieldMax : 270,
    aktionen: b(o?.promotions, true),
    wetterUrl: typeof o?.weatherUrl === 'string' ? o.weatherUrl.trim() : '',
    neuOrdner: typeof o?.newChatFolder === 'string' ? o.newChatFolder.trim() : '',
  }
}

// Higgsfield-Connector: in der Konsole «claude.ai Higgsfield», in der App unter einer Kontonummer; die wird aus den
// Werkzeugen gesucht (ein Server mit «balance» und «generate_video»)
const HIGGSFIELD_SERVERS = ['claude.ai Higgsfield']
const higgsfieldTools = new Set<string>(['mcp__claude_ai_Higgsfield__'])
// Server, die refreshCredits abfragt: nur, was findHiggsfield in den Werkzeugen gefunden hat (leer = kein Connector,
// dann zeigt die Leiste keine Credits und fragt nichts ab)
let higgsfieldServer: string[] = []

async function findHiggsfield($: EngineInterface): Promise<string[]> {
  const names: string[] = []
  try {
    const byServer = new Map<string, string[]>()
    for (const t of await $.tool.list()) {
      const m = /^mcp__(.+?)__(.+)$/.exec(t.name)
      if (m) byServer.set(m[1], [...(byServer.get(m[1]) ?? []), m[2]])
    }
    for (const [server, tools] of byServer) {
      if (tools.includes('balance') && tools.includes('generate_video')) {
        // Konsole: Werkzeuge heissen mcp__claude_ai_Higgsfield__…, abgefragt wird unter «claude.ai Higgsfield»
        if (server === 'claude_ai_Higgsfield') names.push(...HIGGSFIELD_SERVERS)
        names.push(server)
        higgsfieldTools.add(`mcp__${server}__`)
      }
    }
  } catch {
    // ohne Werkzeugliste: kein Connector erkannt, beim nächsten Durchgang nochmals
  }
  return [...new Set(names)]
}

// Higgsfield nachsehen: ist noch kein Connector bekannt, danach suchen (er kann auch später verbunden werden); sonst
// die Credits neu holen. Läuft 20 s nach dem Start und danach alle 5 Minuten.
function higgsfieldPruefen($: EngineInterface) {
  if (higgsfieldServer.length) return void refreshCredits($)
  void findHiggsfield($).then(namen => {
    higgsfieldServer = namen
    if (namen.length) void firstRead($)
  })
}
const REFRESH_MS = 5 * 60 * 1000
// Higgsfield Starter: 270 Credits pro Monat; Balken zeigt, wie viel davon verbraucht ist
// Higgsfield-Credits pro Monat aus der Einstellung «higgsfieldMax»
const creditsMax = () => cfg.higgsfieldMax
// Higgsfield-Markenfarbe (Neon-Lime, von higgsfield.ai)
const HIGGSFIELD_LIME = '#D1FE17'
// Warnfarbe = Anthropic-Rot wie die Beschriftungen (claude.ai-Stylesheet, --cds-text-danger)
const ORANGE = '#EC7E7E'
// Anthropic-Rot der Code-Wörter im Chat (claude.ai --cds-text-danger, dunkles Design) für die Beschriftungen ctx, 5h, Woche
const ANTHROPIC_ORANGE = '#EC7E7E'
// Breite für «Ein: … / Aus: …» rechts in der Wächter-Zeile, bemessen an den grösstmöglichen Zahlen
const TOKEN_PLATZ = `  ${tokenText({ ein: 999.99e6, aus: 999.9e3 })}`.length

const data = atom({ plugin: 'roqam', key: 'data' } as const, {})
const nacht = atom({ plugin: 'roqam', key: 'nacht' } as const, {} as StatusleisteNacht)
// Nachtblau (zwischen Anthropic-Blau 350 und 500, näher bei 500) für die Sternwarten-Zeile
const NIGHT_BLUE = '#3176C9'
// Senkrechte Striche überall gleich, neutral grau
const STRICH_GRAU = '#7A7A7A'
// Die vier Knöpfe der Knopfzeile: hellgrau, damit sie sich vom Hintergrund abheben (gedimmt verschwanden sie, 09.10.2026)
const KNOPF_GRAU = '#C8C8C8'
const NIGHT_REFRESH_MS = 30 * 60 * 1000
// Lokales Wetter von Open-Meteo (Modellwetter, dort alle 15 Minuten neu), Ort aus der Einstellung «ort»
const WETTER_REFRESH_MS = 10 * 60 * 1000
const wetter = atom({ plugin: 'roqam', key: 'wetter' } as const, {} as StatusleisteWetter)
// Stream-Tempo der letzten Modellanfrage im Hauptchat (tempoAus, gemessen in turn.step)
const tempo = atom({ plugin: 'roqam', key: 'tempo' } as const, {} as StatusleisteTempo)

// percent: Füllstand für den Sondermodus-Balken (Ctx, 5h, Woche)
export type Segment = { label: string; labelColor: string; bar?: string; value: string; color: string; note?: string; suffix?: string; suffixColor?: string; percent?: number }

export function parseCredits(text: string): number | undefined {
  try {
    const value = JSON.parse(text).credits
    return finite(value) ? value : undefined
  } catch {
    return undefined
  }
}

export function bar(percent: number, width: number): string {
  const filled = Math.max(0, Math.min(width, Math.round((percent / 100) * width)))
  return '▰'.repeat(filled) + '▱'.repeat(width - filled)
}

// Balkenlänge der Zeile Ctx │ 5h │ Woche in der App (Vorgabe 14.10.2026: immer eine Zeile): ▰ und ▱ laufen dort rund
// 1,63 Zellen breit, der Rest der Zeile (Wörter, Zahlen, Restzeiten, zwei Striche) braucht rund 43 Zellen (gemessen
// am Bildschirmfoto vom 14.10.2026: 10 Felder = 91 Zellen). Höchstens 10 Felder wie bisher, unter 3 keine Balken.
export function appBalken(spalten: number): number {
  if (!finite(spalten)) return 10
  const n = Math.min(10, Math.floor((spalten - 44) / (3 * 1.63)))
  return n >= 3 ? n : 0
}

// Verbrauch: grün, ab 60 % gelb, ab 85 % rot
export function usageColor(percent: number): string {
  return percent >= 85 ? 'red' : percent >= 60 ? 'yellow' : 'green'
}

export function remaining(resetsAt: string | undefined, now: number): string | undefined {
  if (!resetsAt) return undefined
  const minutes = Math.round((Date.parse(resetsAt) - now) / 60000)
  if (!(minutes > 0)) return undefined
  return `−${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`
}

// Ist der Reset-Zeitpunkt vorbei, ist das Fenster leer: 0 % statt des alten Werts,
// bis die nächste Antwort das neue Fenster meldet
export function afterReset(percent: number, resetsAt: string | undefined, now: number): number {
  return resetsAt && Date.parse(resetsAt) <= now ? 0 : percent
}

// Endliche Zahl? Fängt auch null ab: eine nicht-endliche Zahl aus einer Antwort (1e999 → Infinity) wird im $.state zu null
export function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

// Eine Kommastelle, deutsches Komma: 90,1; keine endliche Zahl → «?», damit das Zeichnen nicht wirft
export function fmt(value: number): string {
  return finite(value) ? value.toFixed(1) : '?'
}

// Kontext: grün, ab 60 % orange, ab 75 % rot (Gestaltungsentscheid)
export function ctxColor(percent: number): string {
  return percent >= 75 ? 'red' : percent >= 60 ? ORANGE : 'green'
}

export function segments(d: StatusleisteData, now: number, barWidth: number): Segment[] {
  const out: Segment[] = []
  // Kontext zuerst; erst nach der ersten Antwort bekannt, bis dahin leere Unterhaltung = 0 %
  const ctx = d.ctx ?? 0
  out.push({ label: 'ctx', labelColor: ANTHROPIC_ORANGE, bar: bar(ctx, barWidth), value: `${fmt(ctx)}%`, color: ctxColor(ctx), percent: ctx })
  if (d.fiveHour !== undefined) {
    const fiveHour = afterReset(d.fiveHour, d.fiveHourResetsAt, now)
    out.push({
      label: '5h',
      labelColor: ANTHROPIC_ORANGE,
      bar: bar(fiveHour, barWidth),
      value: `${fmt(fiveHour)}%`,
      color: usageColor(fiveHour),
      note: remaining(d.fiveHourResetsAt, now),
      percent: fiveHour,
    })
  }
  if (d.week !== undefined) {
    // Restzeit bis zum Wochen-Reset (Sonntag 08:00), wie bei 5h
    const week = afterReset(d.week, d.weekResetsAt, now)
    out.push({ label: '7D', labelColor: ANTHROPIC_ORANGE, bar: bar(week, barWidth), value: `${fmt(week)}%`, color: usageColor(week), note: untilReset(d.weekResetsAt, now), percent: week })
  }
  // Higgsfield (eingeschaltet und Credits gelesen, also Connector da), danach der Cache-Countdown
  if (!cfg.higgsfield || !finite(d.credits)) {
    // aus oder kein Connector
  } else {
    // Zahl = noch übrig von CREDITS_MAX; ohne Balken (Gestaltungsentscheid)
    const used = Math.max(0, ((creditsMax() - d.credits) / creditsMax()) * 100)
    out.push({
      label: 'Higgsfield',
      labelColor: HIGGSFIELD_LIME,
      value: fmt(d.credits),
      suffix: `/${creditsMax()}Cr`,
      // «/270Cr» ebenfalls in Higgsfield-Lime (Gestaltungsentscheid)
      suffixColor: HIGGSFIELD_LIME,
      color: usageColor(used),
    })
  }
  const cache = cacheSegment(d.cacheAt, now)
  if (cache) out.push(cache)
  const cost = cfg.apiKosten ? costSegment(d.chatUsd ?? d.costUsd, undefined, d.periodUsd, d.projectUsd) : undefined
  if (cost) out.push(cost)
  return out
}

// Was diese Sitzung über die API gekostet hätte: Claude Codes eigene Summe (Listenpreis in US-Dollar, wie /cost),
// umgerechnet mit dem Tageskurs der EZB über frankfurter.app. Das Abo bezahlt das nicht zusätzlich.
// Wort kurz «API:» (Vorgabe 15.10.2026: ohne «Kosten» und Bindestrich); die Erklärung steht im Kärtchen
export const COST_LABEL = 'API:'
export const KURS_URL = 'https://api.frankfurter.app/latest?from=USD&to=CHF'
const KURS_REFRESH_MS = 6 * 60 * 60 * 1000

export function chf(value: number): string {
  return `${value.toFixed(2)} CHF`
}

// «API: 8,31 / 95,20 / 412,50 CHF» = dieser Chat / dieses Projekt im Abo-Monat / alle Projekte im Abo-Monat.
// Alle drei aus dem Kostenbuch (dieselben Antworten, dieselbe Rechnung); solange das Buch den Chat noch nicht kennt,
// steht vorne Claude Codes eigene Summe.
export function costSegment(usd: number | undefined, usdChf: number | undefined, periodUsd?: number, projectUsd?: number): Segment | undefined {
  if (usd === undefined && periodUsd === undefined) return undefined
  // Kurs nur als endliche Zahl über 0; ohne Kurs (offline, oder null aus einem alten State) lieber in Dollar als gar nicht
  const kurs = finite(usdChf) && usdChf > 0 ? usdChf : undefined
  const num = (v: number | undefined) => (v === undefined ? '…' : (kurs === undefined ? v : v * kurs).toFixed(2))
  const unit = kurs === undefined ? 'USD' : 'CHF'
  const value =
    periodUsd === undefined ? `${num(usd)} ${unit}` : `${num(usd)} / ${num(projectUsd)} / ${num(periodUsd)} ${unit}`
  return { label: COST_LABEL, labelColor: ANTHROPIC_ORANGE, value, color: ANTHROPIC_ORANGE }
}

// Abo-Monat: Verläufe aller Claude-Code-Sitzungen einlesen; eine Datei nur neu rechnen, wenn Grösse oder Zeit sich
// geändert haben. Der Zwischenspeicher lebt im Modul (nach einem Neuladen einmal alles neu, wenige Sekunden).
// Was gelesen wurde, kommt ins Kostenbuch (kosten.ts), damit gelöschte Chats im Monat weiter zählen.
const PERIOD_REFRESH_MS = 10 * 60 * 1000
const fileCache = new Map<string, { stamp: string; since: number; answers: Map<string, Buchung>; ohnePreis: string[] }>()
// zuletzt geschriebenes Buch dieses Prozesses: geht die Datei verloren, schreibt der nächste Lauf sie wieder voll
let kostenbuch: Kostenbuch | undefined

export function projectSlug(dir: string): string {
  return dir.replace(/[^a-zA-Z0-9]/g, '-')
}

async function jsonlFiles($: EngineInterface, dir: string, out: { path: string; stamp: string; size: number }[] = []) {
  for (const e of await $.fs.list(dir).catch(() => [])) {
    const path = `${dir}\\${e.name}`
    if (e.kind === 'dir') await jsonlFiles($, path, out)
    else if (e.name.endsWith('.jsonl')) out.push({ path, stamp: `${e.size}|${e.mtimeMs}`, size: e.size })
  }
  return out
}

// $.fs.read liest höchstens 4 MB; grössere Verläufe liefert das Skript verlauf-auszug.ps1 als Auszug (nur die
// Abrechnungszeilen, gleiche Form wie der Verlauf, darum rechnet costsInFile ohne Unterschied)
const FS_READ_MAX = 4 * 1024 * 1024

async function readVerlauf($: EngineInterface, path: string, size: number): Promise<string> {
  if (size <= FS_READ_MAX) return String(await $.fs.read(path).catch(() => ''))
  const script = `${$.plugin.root}\\verlauf-auszug.ps1`
  const run = await $.process
    .run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, path], { timeoutMs: 120000 })
    .catch(() => undefined)
  return run?.stdout ?? ''
}

// Knopf «✓ Sichern»: schreibt den Auftrag zur Durchsicht von Doku und Gedächtnis ins Eingabefeld (abschicken tut
// man selbst). Ersetzt, was im Feld steht; ist das Feld nicht verfügbar, ein Hinweis.
export const SICHERN_AUFTRAG =
  'Save: Go through this chat and look for new decisions, settings, paths, errors, lessons and preferences ' +
  'that will matter later. Check which of them are not yet in the project docs (CLAUDE.md and other ' +
  'notes or handoff files) and which are not in your memory. ' +
  'Add what is missing right away, without asking, then report briefly "what went where". Then commit the changed ' +
  'project files and, if there is an online copy, push them as well.'

async function runSichern($: EngineInterface) {
  try {
    const r = await $.prompt.fill({ text: SICHERN_AUFTRAG })
    if (!r.isFilled) $.ui.toast('Could not fill the prompt box', { timeoutMs: 6000 })
  } catch (error) {
    $.ui.toast(`Save failed: ${String(error)}`, { timeoutMs: 8000 })
  }
}

// Knöpfe der System-Zeile. Übergabe: zuerst «handoff», dann der volle Skill-Name; ein unbekannter Name wird vom
// Befehl abgewiesen, dann kommt der nächste dran.
export const HANDOFF_NAMES = ['handoff', 'anthropic-skills:handoff']
export const UEBERGABE_AUFTRAG =
  'Handoff: Summarise this chat briefly enough that a new chat can carry on seamlessly (goal, status, ' +
  'decisions, open steps, lessons, important files). Output it as one code block to copy.'

async function runHandoff($: EngineInterface) {
  for (const command of HANDOFF_NAMES) {
    try {
      await $.command.run({ command, args: '' })
      return
    } catch {
      // nächsten Namen versuchen
    }
  }
  // Kein Skill /handoff vorhanden: den Auftrag ins Eingabefeld schreiben, abschicken tut man selbst
  const r = await $.prompt.fill({ text: UEBERGABE_AUFTRAG }).catch(() => undefined)
  if (!r?.isFilled) $.ui.toast('Handoff: could not fill the prompt box', { timeoutMs: 6000 })
}
async function runCompact($: EngineInterface) {
  try {
    const answer = await $.ui.ask('Compact this chat now? The history is summarised and details are lost.', {
      options: ['Compact', 'Cancel'],
      header: 'Compact',
    })
    if (answer !== 'Compact') return
    await $.command.run({ command: 'compact', args: '' })
  } catch {
    // Rückfrage weggeklickt: nichts tun
  }
}

// Link an Windows übergeben (claude://… öffnet die Desktop-App). Fehlt rundll32 (kein Windows) oder meldet es einen
// Fehler, ein Hinweis statt Stillschweigen (09.10.2026)
async function openLink($: EngineInterface, url: string): Promise<boolean> {
  const r = await $.process.run(['rundll32', 'url.dll,FileProtocolHandler', url], { timeoutMs: 15000 }).catch(() => undefined)
  if (r?.exitCode === 0) return true
  // Aufnahme-Modus: ohne den Link (Chat-Kennung oder Ordnerpfad)
  const privat = istPrivat(await read($, aufnahme).catch(() => ({})))
  $.ui.toast(privat ? 'Could not open the link' : `Could not open the link: ${url}`, { timeoutMs: 8000 })
  return false
}

// Knopf «+ Neu»: neuer Chat im selben Ordner wie dieser. App: Link der Desktop-App für einen neuen Chat mit
// Ordner; Konsole: neues Fenster im Windows-Terminal mit claude in diesem Ordner.
export function newChatLink(folder: string): string {
  return `claude://code/new?folder=${encodeURIComponent(folder)}`
}
async function runNewChat($: EngineInterface, isTerminal: boolean) {
  // lehnt die Engine den Aufruf ab, blieb bisher eine unbehandelte Ablehnung ohne Hinweis (09.10.2026)
  const folder = cfg.neuOrdner || (await $.session.root().catch(() => undefined))
  if (!folder) {
    $.ui.toast('New: folder of this chat unknown', { timeoutMs: 6000 })
    return
  }
  if (isTerminal) {
    const r = await $.process.run(['wt.exe', '-d', folder, 'claude'], { timeoutMs: 15000 }).catch(() => undefined)
    // kein Windows-Terminal: sagen, wie es von Hand geht (im Aufnahme-Modus ohne den Ordnerpfad)
    if (r?.exitCode !== 0) {
      const privat = istPrivat(await read($, aufnahme).catch(() => ({})))
      $.ui.toast(privat ? 'Could not open a new chat' : `Could not open a new chat. By hand: claude in ${folder}`, { timeoutMs: 8000 })
    }
  } else {
    await openLink($, newChatLink(folder))
  }
}

// ── System-Zeile ──────────────────────────────────────────────────────────────────────────────────────────────
const system = atom({ plugin: 'roqam', key: 'system' } as const, {} as StatusleisteSystem)
const STATUS_REFRESH_MS = 5 * 60 * 1000
const VERSION_REFRESH_MS = 6 * 60 * 60 * 1000
const CHATS_REFRESH_MS = 60 * 1000

async function refreshStatus($: EngineInterface) {
  try {
    const res = await $.http.fetch(STATUS_URL)
    const status = res.ok ? parseStatus(res.text) : undefined
    await update($, system, s => ({ ...s, status }))
  } catch {
    // offline: Punkt grau (nach dem Entladen des Mods schlägt auch das Schreiben fehl)
    await update($, system, s => ({ ...s, status: undefined })).catch(() => undefined)
  }
}

// Neueste Version aus der npm-Antwort; kein JSON (Wartungsseite, Sperrseite eines Proxys) → unbekannt
export function parseVersion(text: string): string | undefined {
  try {
    return String(JSON.parse(text)?.version ?? '') || undefined
  } catch {
    return undefined
  }
}

async function refreshVersion($: EngineInterface) {
  try {
    // eigene Version zuerst, sie ist lokal bekannt; der Vergleich mit npm kommt getrennt dazu
    const { version } = await $.session.version()
    await update($, system, s => ({ ...s, version }))
    const res = await $.http.fetch(VERSION_URL).catch(() => undefined)
    const latest = res?.ok ? parseVersion(res.text) : undefined
    await update($, system, s => ({ ...s, latest }))
  } catch {
    // Versionshinweis ist Nebensache
  }
}

async function refreshModel($: EngineInterface, effort?: string | number) {
  try {
    const model = prettyModel(await $.session.model().catch(() => undefined))
    await update($, system, s => ({ ...s, model, ...(effort !== undefined ? { effort: effortDe(effort) } : {}) }))
  } catch {
    // Mod inzwischen entladen: nichts mehr schreiben
  }
}

// PIDs aus «tasklist /FO CSV /NH»
function alivePids(csv: string): Set<number> {
  const pids = new Set<number>()
  for (const line of csv.split(/\r?\n/)) {
    const m = /^"[^"]*","(\d+)"/.exec(line)
    if (m) pids.add(Number(m[1]))
  }
  return pids
}

async function refreshChats($: EngineInterface) {
  try {
    const home = (await $.env.get('USERPROFILE')) ?? 'C:\\Users\\Public'
    const selfId = await $.session.id()
    const tasks = await $.process.run(['tasklist', '/FO', 'CSV', '/NH'], { timeoutMs: 15000 }).catch(() => undefined)
    // nur eine brauchbare Liste (Exit 0, mindestens eine PID) filtert; sonst alle Sitzungen zeigen statt «0 Chats»
    const pids = tasks && tasks.exitCode === 0 ? alivePids(tasks.stdout) : undefined
    const alive = pids && pids.size > 0 ? pids : undefined
    const chats: Chat[] = []
    for (const f of await $.fs.list(`${home}\\.claude\\sessions`).catch(() => [])) {
      if (!f.name.endsWith('.json')) continue
      const chat = parseChat(String(await $.fs.read(`${home}\\.claude\\sessions\\${f.name}`).catch(() => '')), selfId, alive)
      if (chat) chats.push(chat)
    }
    await update($, system, s => ({ ...s, chats }))
  } catch {
    // Chat-Liste ist Nebensache
  }
}

// Connectors: welche MCP-Server Werkzeuge liefern; einer, der in dieser Sitzung schon da war und fehlt, gilt als
// getrennt. Die Connectors verbinden erst einige Sekunden nach dem Start, darum zuerst nach 30 s.
const seenConnectors = new Map<string, string>()

async function refreshConnectors($: EngineInterface) {
  try {
    const servers = connectorServers((await $.tool.list()).map(t => t.name))
    for (const [id, name] of servers) seenConnectors.set(id, name)
    const missing = [...seenConnectors].filter(([id]) => !servers.has(id)).map(([, name]) => name)
    await update($, system, s => ({ ...s, connectors: [...new Set(servers.values())].sort(), missing }))
  } catch {
    // Connector-Liste ist Nebensache
  }
}

// Guthaben (~\.claude\statusleiste-guthaben.json, von Hand geführt) und GitHub-Abgleich (~\.claude\github-abgleich.json,
// von einem eigenen Abgleich-Skript geschrieben) jede Minute lesen. Fehlt eine Datei, zeigt die Leiste dazu nichts.
async function refreshDateien($: EngineInterface) {
  try {
    const home = (await $.env.get('USERPROFILE')) ?? ''
    const guthaben = parseGuthaben(String(await $.fs.read(`${home}\\.claude\\statusleiste-guthaben.json`).catch(() => '[]')))
    await update($, data, d => ({ ...d, guthaben }))
    const text = String(await $.fs.read(`${home}\\.claude\\github-abgleich.json`).catch(() => ''))
    const abgleich = abgleichWarnung(text, await $.clock.now())
    await update($, system, s => ({ ...s, abgleich }))
  } catch {
    // Anzeige ist Nebensache
  }
}

// Neue Aktion von Anthropic erkennen (aktion.ts): Fingerabdruck der Merker in ~/.claude.json gegen den bestätigten
// ($.store, über Sitzungen hinweg). Beim allerersten Lauf gilt der jetzige Stand als bestätigt. Weicht er ab, stehen die
// Änderungen in aktionZeilen (für das Kärtchen).
const AKTION_KEY = 'aktionen-bekannt'

async function checkAktion($: EngineInterface, claudeJson: string) {
  const sig = aktionSignatur(claudeJson)
  if (sig === undefined) return
  let bekannt = await $.store.get(AKTION_KEY)
  if (typeof bekannt !== 'string') {
    await $.store.set(AKTION_KEY, sig)
    bekannt = sig
  }
  const neueAktion = sig !== bekannt
  const aktionZeilenJetzt = neueAktion ? aktionZeilen(claudeJson, typeof bekannt === 'string' ? bekannt : undefined) : []
  await update($, data, d => ({ ...d, neueAktion, aktionSig: sig, aktionZeilen: aktionZeilenJetzt }))
}

// Klick auf «⚑ Neue Aktion» (Vorgabe 15.10.2026): das Kärtchen zeigt, was sich geändert hat, und der Klick bestätigt den
// Stand. Das Wort bleibt stehen, solange sein Kärtchen offen ist (mit dem Text vom Klick), danach ist es weg.
let aktionGezeigt: string[] = []
async function aktionQuittieren($: EngineInterface) {
  const d = await read($, data)
  if (!d.neueAktion || !d.aktionSig) return
  aktionGezeigt = d.aktionZeilen?.length ? d.aktionZeilen : ['Anthropic changed a promotion']
  await $.store.set(AKTION_KEY, d.aktionSig)
  await update($, data, x => ({ ...x, neueAktion: false }))
}
// Wort und Kärtchentext: offen gebliebenes, schon bestätigtes Kärtchen oder eine noch unbestätigte Aktion
function aktionAnzeige(d: StatusleisteData): string[] | undefined {
  if (offenesKaertchen === 'aktion' && aktionGezeigt.length > 0 && !d.neueAktion) return aktionGezeigt
  return d.neueAktion ? (d.aktionZeilen?.length ? d.aktionZeilen : ['Anthropic changed a promotion']) : undefined
}

// Neue Aktionen (Option «aktionen»), unabhängig von der Kostenrechnung
async function refreshAktion($: EngineInterface) {
  try {
    const home = (await $.env.get('USERPROFILE')) ?? 'C:\\Users\\Public'
    const claudeJson = await $.fs.read(`${home}\\.claude.json`).catch(() => undefined)
    if (claudeJson !== undefined) await checkAktion($, String(claudeJson))
  } catch (error) {
    $.ui.log(`Promotion check failed: ${String(error)}`, { to: 'debug' })
  }
}

async function refreshPeriod($: EngineInterface) {
  try {
    const home = (await $.env.get('USERPROFILE')) ?? 'C:\\Users\\Public'
    const claudeJson = String(await $.fs.read(`${home}\\.claude.json`))
    const account = JSON.parse(claudeJson).oauthAccount ?? {}
    const subscribed = Date.parse(account.subscriptionCreatedAt ?? '')
    if (!(subscribed > 0)) return
    const now = await $.clock.now()
    const since = periodStart(subscribed, now)
    const projectsDir = `${home}\\.claude\\projects`
    const files = await jsonlFiles($, projectsDir)
    // Projekt dieses Chats: Claude Code legt die Verläufe unter dem Ordnernamen ab (C:\A B\C → C--A-B-C)
    const root = await $.session.root()
    const chatId = await $.session.id().catch(() => '')
    const gelesen: [string, Buchung][] = []
    const ohnePreis = new Set<string>()
    for (const f of files) {
      let entry = fileCache.get(f.path)
      if (!entry || entry.stamp !== f.stamp || entry.since !== since) {
        const { projekt, chat } = herkunft(f.path, projectsDir)
        const text = await readVerlauf($, f.path, f.size)
        const answers = new Map<string, Buchung>()
        const fehlt = new Set<string>()
        for (const [id, a] of answersInFile(text, since, fehlt)) answers.set(id, [a.t, a.usd, projekt, chat])
        entry = { stamp: f.stamp, since, answers, ohnePreis: [...fehlt] }
        // leer gelesen, obwohl die Datei Inhalt hat (Skript zu langsam, Datei gesperrt): nächstes Mal neu versuchen
        if (text || f.size === 0) fileCache.set(f.path, entry)
      }
      gelesen.push(...entry.answers)
      for (const m of entry.ohnePreis) ohnePreis.add(m)
    }
    // Buch = bisheriges Buch (Datei und Sicherung, von allen Chats geschrieben) + was die Verläufe heute zeigen
    const pfad = `${home}\\.claude\\${KOSTENBUCH_DATEI}`
    const lesen = async () => ({
      datei: parseKostenbuch(String(await $.fs.read(pfad).catch(() => ''))),
      sicherung: parseKostenbuch(String(await $.fs.read(`${pfad}.bak`).catch(() => ''))),
    })
    const { datei, sicherung } = await lesen()
    let buch = mergeKostenbuch(
      since,
      Object.entries(datei),
      Object.entries(sicherung),
      Object.entries(kostenbuch?.antworten ?? {}),
      gelesen,
    )
    // Speicher und Anzeige vor dem Schreiben: eine gesperrte Datei darf die Summe nicht verschlucken (09.10.2026)
    kostenbuch = buch
    const summe = summen(buch, projectSlug(root), chatId)
    const periodUsd = summe.all
    const projectUsd = summe.project
    const chatUsd = summe.chat
    const projectName = root.split(/[\\/]/).filter(Boolean).pop() ?? root
    $.ui.log(`Month total: ${files.length} transcripts, ${gelesen.length} answers read, ${summe.count} in cost log, ${periodUsd.toFixed(2)} USD since ${new Date(since).toISOString()}`, { to: 'debug' })
    await update($, data, d => ({ ...d, periodUsd, periodSince: since, projectUsd, chatUsd, projectName, ohnePreis: [...ohnePreis].sort() }))
    // nur schreiben, wenn sich etwas geändert hat (neue Antwort oder neuer Monat)
    const fehlt = (b: Kostenbuch, d: Record<string, Buchung>) => {
      const ids = Object.keys(b.antworten)
      return ids.length !== Object.keys(d).length || ids.some(id => !(id in d))
    }
    if (fehlt(buch, datei)) {
      try {
        // Das Dateisystem kennt keine Sperre: unmittelbar vor dem Schreiben nochmals lesen und einmischen, was
        // eine andere Sitzung inzwischen gebucht hat (frische Dateien zuerst); hat sie schon alles, nichts schreiben
        const frisch = await lesen()
        buch = mergeKostenbuch(since, Object.entries(frisch.datei), Object.entries(frisch.sicherung), Object.entries(buch.antworten))
        kostenbuch = buch
        if (fehlt(buch, frisch.datei)) {
          const text = JSON.stringify(buch)
          // erst die Sicherung, dann die Datei: bricht ein Schreiben ab, ist die andere noch ganz
          await $.fs.write(`${pfad}.bak`, text)
          await $.fs.write(pfad, text)
        }
      } catch (error) {
        // Datei gesperrt oder schreibgeschützt: das Buch bleibt im Speicher, der nächste Lauf holt das Schreiben nach
        $.ui.log(`Writing cost log failed: ${String(error)}`, { to: 'debug' })
      }
    }
  } catch (error) {
    // Monatssumme ist Nebensache: alten Wert behalten
    $.ui.log(`Month total failed: ${String(error)}`, { to: 'debug' })
  }
}

export function parseKurs(text: string): number | undefined {
  try {
    const rate = JSON.parse(text)?.rates?.CHF
    return finite(rate) && rate > 0 ? rate : undefined
  } catch {
    return undefined
  }
}

async function refreshKurs($: EngineInterface) {
  try {
    const res = await $.http.fetch(KURS_URL)
    const usdChf = res.ok ? parseKurs(res.text) : undefined
    if (usdChf !== undefined) await update($, data, d => ({ ...d, usdChf }))
  } catch {
    // ohne Netz: alten Kurs behalten
  }
}

// Prompt-Cache: hält 1 Stunde ab der letzten Antwort; danach liest das nächste Senden den ganzen Chat frisch ein
// (kostet mehr Kontingent). Nur die Restzeit, ohne Balken (Gestaltungsentscheid); danach grau «T−0».
export const CACHE_TTL_MS = 60 * 60 * 1000
export const CACHE_LABEL = 'T'

export function cacheSegment(cacheAt: number | undefined, now: number): Segment | undefined {
  if (cacheAt === undefined) return undefined
  const elapsed = Math.max(0, ((now - cacheAt) / CACHE_TTL_MS) * 100)
  // Nie über eine Stunde, darum nur Minuten mit Minus wie die anderen Restzeiten. NASA-Countdown ohne Leerschlag: «T−42min»
  const minutes = Math.round((cacheAt + CACHE_TTL_MS - now) / 60000)
  if (!(minutes > 0)) return { label: CACHE_LABEL, labelColor: 'gray', value: '−0', color: 'gray' }
  return { label: CACHE_LABEL, labelColor: ANTHROPIC_ORANGE, value: `−${minutes}min`, color: usageColor(elapsed) }
}

function limitsData(limits: readonly SessionRateLimit[], context: SessionContextUsage, cost?: { usd: number }): StatusleisteData {
  const fiveHour = limits.find(l => l.kind === 'five_hour')
  const week = limits.find(l => l.kind === 'seven_day')
  return {
    fiveHour: fiveHour?.percentUsed,
    fiveHourResetsAt: fiveHour?.resetsAt,
    week: week?.percentUsed,
    weekResetsAt: week?.resetsAt,
    // aus Tokens gerechnet, damit eine Kommastelle möglich ist (percent ist ganzzahlig)
    ctx: context.tokens !== undefined ? (context.tokens / context.window) * 100 : context.percent,
    // nur setzen, wenn bekannt, sonst bliebe ein alter Wert nicht stehen
    ...(cost !== undefined ? { costUsd: cost.usd } : {}),
  }
}

async function writeLog($: EngineInterface, text: string) {
  try {
    await $.fs.write(`${$.plugin.root}/letzter-abruf.txt`, `${new Date().toISOString()}\n${text}\n`)
  } catch {
    // Protokoll ist Nebensache
  }
}

async function refreshCredits($: EngineInterface): Promise<boolean> {
  const errors: string[] = []
  for (const server of higgsfieldServer) {
    try {
      const result = await $.mcp.call(server, 'balance')
      const block = result.content.find(b => b.type === 'text')
      const credits = !result.isError && block && 'text' in block ? parseCredits(String(block.text)) : undefined
      if (credits === undefined) {
        errors.push(`${server}: answer unreadable: ${JSON.stringify(result).slice(0, 1000)}`)
        continue
      }
      await update($, data, d => ({ ...d, credits }))
      await writeLog($, `OK via ${server}: ${credits} credits`)
      return true
    } catch (error) {
      // Connector unter diesem Namen (noch) nicht verbunden: nächsten Namen versuchen
      errors.push(`${server}: ${String(error)}`)
    }
  }
  await writeLog($, `Call failed:\n${errors.join('\n')}`)
  return false
}

// Zeit der letzten Antwort im Hauptchat aus der Sitzungsdatei (JSONL, eine Zeile je Eintrag mit `timestamp`)
export function lastAnswerAt(jsonl: string): number | undefined {
  const lines = jsonl.split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].includes('"type":"assistant"')) continue
    try {
      const entry = JSON.parse(lines[i])
      if (entry.type === 'assistant' && !entry.isSidechain && typeof entry.timestamp === 'string') {
        const at = Date.parse(entry.timestamp)
        if (at > 0) return at
      }
    } catch {
      // unvollständige Zeile überspringen
    }
  }
  return undefined
}

// Sitzungsdatei: ~/.claude/projects/<Ordner, Sonderzeichen als «-»>/<Sitzungs-ID>.jsonl (Konsole und App gleich)
async function readCacheStart($: EngineInterface) {
  try {
    const [id, cwd] = await Promise.all([$.session.id(), $.session.cwd()])
    const home = (await $.env.get('USERPROFILE')) ?? cwd.match(/^[A-Za-z]:\\Users\\[^\\]+/)?.[0] ?? 'C:\\Users\\Public'
    const path = `${home}\\.claude\\projects\\${cwd.replace(/[^A-Za-z0-9]/g, '-')}\\${id}.jsonl`
    const at = lastAnswerAt(String(await $.fs.read(path)))
    if (at !== undefined) await update($, data, d => ({ ...d, cacheAt: Math.max(d.cacheAt ?? 0, at) }))
  } catch {
    // neue Sitzung ohne Datei: Countdown erscheint nach der ersten Antwort
  }
}

// Nacht-Ampel: Wolkenvorhersage holen und mit Dunkelheit und Mond zusammenfassen. Die Antworten werden geprüft
// (parseForecast, parseSeeing); nacht wird immer geschrieben, auch bei unbrauchbarer Antwort, sonst bliebe das
// alte Nachtende stehen und der 30-s-Takt holte endlos nach. Scheitert das Schreiben nach dem Nachtende trotzdem,
// wird je Nachtende höchstens einmal pro halbe Stunde nachgeholt.
let nachgeholt: { end: number; at: number } | undefined
async function refreshNight($: EngineInterface) {
  let now: number
  let alt: StatusleisteNacht
  try {
    // /stars aus: Wolken und Seeing ruhen
    if (await sterneAusGespeichert($)) return
    now = await $.clock.now()
    alt = await read($, nacht)
  } catch {
    // Mod inzwischen entladen (Takt lief noch): nichts mehr lesen oder schreiben
    return
  }
  const vorbei = alt.end !== undefined && alt.end <= now
  if (vorbei && nachgeholt !== undefined && nachgeholt.end === alt.end && now - nachgeholt.at < NIGHT_REFRESH_MS) return
  let forecast: Forecast | undefined
  let seeing: SeeingForecast | undefined
  try {
    const res = await $.http.fetch(forecastUrl(ortLat, ortLon))
    if (res.ok) forecast = parseForecast(res.text)
  } catch {
    // ohne Netz: Dunkelheit und Mond trotzdem zeigen
  }
  try {
    const res = await $.http.fetch(seeingUrl(ortLat, ortLon))
    if (res.ok) seeing = parseSeeing(res.text)
  } catch {
    // 7Timer nicht erreichbar: Punkt grau
  }
  // Versatz des Ortes im $.store merken: ohne Vorhersage gilt der zuletzt bekannte statt Winterzeit (im Ausland Stunden daneben)
  const offsetKey = `ort-offset:${cfg.ort.toLowerCase()}`
  const saved = await $.store.get(offsetKey).catch(() => undefined)
  if (forecast && forecast.utc_offset_seconds !== saved) await $.store.set(offsetKey, forecast.utc_offset_seconds).catch(() => undefined)
  let summary: StatusleisteNacht
  try {
    summary = summarize(forecast, now, seeing, ortLat, ortLon)
  } catch (error) {
    // Vorhersage in unerwarteter Form: Dunkelheit und Mond trotzdem
    $.ui.log(`Night light: forecast unreadable: ${String(error)}`, { to: 'debug' })
    summary = summarize(undefined, now, undefined, ortLat, ortLon)
  }
  if (summary.start !== undefined && summary.offset === undefined && finite(saved)) summary.offset = saved
  try {
    await update($, nacht, () => summary)
    nachgeholt = undefined
  } catch (error) {
    if (vorbei && alt.end !== undefined) nachgeholt = { end: alt.end, at: now }
    $.ui.log(`Night light not written: ${String(error)}`, { to: 'debug' })
  }
}

// Ort → Koordinaten über die Open-Meteo-Ortssuche (ohne Konto); einmal pro Ort, gemerkt im $.store
let ortLat: number | undefined
let ortLon: number | undefined

export function parseOrt(text: string): { lat: number; lon: number; name: string } | undefined {
  try {
    const r = JSON.parse(text)?.results?.[0]
    return finite(r?.latitude) && finite(r?.longitude)
      ? { lat: r.latitude, lon: r.longitude, name: String(r.name ?? '') }
      : undefined
  } catch {
    return undefined
  }
}

async function resolveOrt($: EngineInterface): Promise<boolean> {
  if (!cfg.ort) return false
  const key = `ort:${cfg.ort.toLowerCase()}`
  const saved = (await $.store.get(key).catch(() => undefined)) as { lat: number; lon: number } | undefined
  if (saved && typeof saved.lat === 'number') {
    ortLat = saved.lat
    ortLon = saved.lon
    return true
  }
  try {
    const res = await $.http.fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cfg.ort)}&count=1&language=en&format=json`)
    const o = res.ok ? parseOrt(res.text) : undefined
    if (!o) return false
    ortLat = o.lat
    ortLon = o.lon
    // Merken ist nur Beschleunigung: scheitert der Store, stehen die Koordinaten trotzdem
    await $.store.set(key, { lat: o.lat, lon: o.lon }).catch(() => undefined)
    return true
  } catch {
    return false
  }
}

// Temperatur, Taupunkt und Feuchte aus Open-Meteo «current»
// Temperatur, Taupunkt und Feuchte: Open-Meteo (current.*) oder eigene Station (latest.*.value, wetterUrl)
export function parseWetter(text: string): StatusleisteWetter | undefined {
  try {
    const j = JSON.parse(text)
    const num = (v: unknown) => (finite(v) ? v : undefined)
    const cur = j?.current
    const st = j?.latest
    const w = cur
      ? { temp: num(cur.temperature_2m), dewPoint: num(cur.dew_point_2m), hum: num(cur.relative_humidity_2m) }
      : { temp: num(st?.temp?.value), dewPoint: num(st?.dew_point?.value), hum: num(st?.hum?.value) }
    return w.temp === undefined && w.dewPoint === undefined && w.hum === undefined ? undefined : w
  } catch {
    return undefined
  }
}

async function refreshWetter($: EngineInterface) {
  try {
    // /stars aus: kein Wetterabruf
    if (await sterneAusGespeichert($)) return
    // eigene Station (wetterUrl) oder Open-Meteo am eingestellten Ort
    if (!cfg.wetterUrl && (ortLat === undefined || ortLon === undefined)) return
    const res = await $.http.fetch(
      cfg.wetterUrl ||
        `https://api.open-meteo.com/v1/forecast?latitude=${ortLat}&longitude=${ortLon}&current=temperature_2m,dew_point_2m,relative_humidity_2m&timezone=auto`,
    )
    const w = res.ok ? parseWetter(res.text) : undefined
    if (w) await update($, wetter, () => w)
  } catch {
    // Website nicht erreichbar: alte Werte behalten
  }
}

// Ein Teil der Astro-Zeile. Zeichen statt Wort, damit alles auf eine Zeile passt (Vorgabe 14.10.2026); label bleibt als
// Name (Schlüssel, Bildtext, Tests). mond: Stufe für das Mond-Bild der App, die Konsole zeigt das Zeichen (Emoji).
export type NightPart = { label: string; symbol: string; value: string; color: string; mond?: { stufe: number; sued: boolean } }

// Taupunkt als Kürzel «TP»: dafür gibt es kein gängiges Zeichen (Wahl 14.10.2026)
export function wetterParts(w: StatusleisteWetter): NightPart[] {
  const parts: NightPart[] = []
  if (finite(w.temp)) parts.push({ label: 'Temp', symbol: '🌡', value: `${fmt(w.temp)}°`, color: NIGHT_BLUE })
  if (finite(w.dewPoint)) parts.push({ label: 'TP', symbol: 'Dew', value: `${fmt(w.dewPoint)}°`, color: NIGHT_BLUE })
  if (finite(w.hum)) parts.push({ label: 'Feuchte', symbol: '💧', value: `${fmt(w.hum)}%`, color: NIGHT_BLUE })
  return parts
}

// Astro-Zeile als Gimmick für Programmierer (Vorgabe 14.10.2026): Wer den ganzen Tag in den Code-Himmel schaut, sieht
// hier, ob sich ein Blick in den echten lohnt. Vorne der Punkt = Himmels-Ampel aus allen Werten der Zeile: Wolken,
// Seeing, Mond, Taupunkt-Abstand, Feuchte (himmelFarbe in nacht.ts, elf Stufen, grün nur, wenn alles passt) mit dem
// Wort «Seeing:» davor, damit man weiss, wofür er steht
// (Vorgabe 14.10.2026, in jedem Design), dann Wolken, Mond (zwölf Stufen als Bild, in der Konsole acht Emoji, daneben
// die Beleuchtung in Prozent) und die
// astronomisch dunkle Zeit. sued: Ort auf der Südhalbkugel (Mond gespiegelt).
// w: Temperatur, Taupunkt und Feuchte für die Ampel (aus allen Werten, Vorgabe 14.10.2026)
export function nightParts(n: StatusleisteNacht, sued = false, w: StatusleisteWetter = {}): NightPart[] {
  if (n.level === 'keine') return [{ label: 'Himmel', symbol: '', value: 'no astronomical darkness', color: 'gray' }]
  if (n.start === undefined || n.end === undefined) return []
  const farbe = himmelFarbe(n.cloud, n.seeing, { moon: n.moon, temp: w.temp, dewPoint: w.dewPoint, hum: w.hum })
  const parts: NightPart[] = [{ label: 'Himmel', symbol: 'Seeing:', value: '●', color: farbe }]
  parts.push({ label: 'Wolken', symbol: '☁', value: finite(n.cloud) ? `${fmt(n.cloud)}%` : '?', color: NIGHT_BLUE })
  if (finite(n.moon)) {
    const phase = mondPhase(n.moon, n.isWaxing)
    // Beleuchtung in Prozent neben Bild bzw. Emoji (Vorgabe 14.10.2026: fehlte seit dem Astro-Umbau)
    parts.push({ label: 'Mond', symbol: mondEmoji(phase, sued), value: `${fmt(n.moon)}%`, color: NIGHT_BLUE, mond: { stufe: mondStufe(phase), sued } })
  }
  parts.push({ label: 'Dunkel', symbol: '★', value: `${clock(n.start, n.offset)}–${clock(n.end, n.offset)}`, color: NIGHT_BLUE })
  return parts
}

// Stream-Tempo (Vorgabe 14.10.2026): Ausgabe-Tokens je Sekunde der letzten Modellanfrage im Hauptchat. Gemessen vom
// ersten Stück des Streams bis zum Schluss, also ohne die Wartezeit bis zur ersten Antwort, mit Denken. Kurze Anfragen
// (wenige Tokens, unter einer halben Sekunde) geben keinen brauchbaren Wert und zählen nicht.
const TEMPO_MIN_TOKENS = 20
const TEMPO_MIN_MS = 500
export function tempoAus(tokens: number | undefined, ms: number): number | undefined {
  if (!finite(tokens) || !finite(ms) || tokens < TEMPO_MIN_TOKENS || ms < TEMPO_MIN_MS) return undefined
  return tokens / (ms / 1000)
}
export function tempoParts(t: StatusleisteTempo): NightPart[] {
  return finite(t.tps) ? [{ label: 'Tempo', symbol: '⚡', value: `${Math.round(t.tps)} t/s`, color: NIGHT_BLUE }] : []
}
// Das Tempo steht seit 15.10.2026 vor der Aufnahme (Cockpit «◉ Aufnahme», Sondermodus «REC ◉»), nicht mehr in der
// Astro- bzw. SENSOREN-Zeile; ein Klick öffnet dieses Kärtchen (Vorgabe Dominik: man soll sehen, was der Wert ist).
// Kurze Zeilen (höchstens TEMPO_KARTE_MAX Zeichen): mit 86 Zeichen ragte es in der App links aus dem Band (Screenshot 15.10.2026)
export const TEMPO_KARTE_MAX = 55
export const TEMPO_KARTE = [
  'Writing speed of Claude in tokens per second',
  '1 token ≈ 3–4 characters',
  'Last answer in this chat, from the first word on',
  'Thinking counts, the wait before it does not',
  `Not counted: answers under ${TEMPO_MIN_TOKENS} tokens, subagents`,
]

// Kontextwarnung: je einmal ab 75 % und ab 90 %; nach einer Zusammenfassung (unter 50 %) wieder scharf
const warned = new Set<number>()

export function contextWarning(ctx: number, already: Set<number>): string | undefined {
  if (ctx < 50) already.clear()
  const mark = ctx >= 90 ? 90 : ctx >= 75 ? 75 : undefined
  if (mark === undefined || already.has(mark)) return undefined
  already.add(75)
  if (mark === 90) already.add(90)
  return mark === 90
    ? `Context ${fmt(ctx)}%: compact now with /compact`
    : `Context ${fmt(ctx)}%: almost full, /compact summarises the chat`
}

// Die claude.ai-Connectors verbinden erst einige Sekunden nach dem Start
const RETRY_MS = [5000, 10000, 20000, 40000, 60000]

function firstRead($: EngineInterface, attempt = 0) {
  void refreshCredits($).then(isRead => {
    if (!isRead && attempt < RETRY_MS.length) $.clock.after(RETRY_MS[attempt], () => firstRead($, attempt + 1))
  })
}

// ── Wächter ───────────────────────────────────────────────────────────────────────────────────────────────────
// Zeigt in der Leiste, dass und woran Claude arbeitet; fragt bei einem Schritt über 4 Minuten (einmal pro Schritt)
// und bei WIEDERHOLUNG gleichen Aufrufen in Folge (einmal pro Aufruf und Antwort) «Weiterlaufen / Abbrechen».
// Abbrechen beendet die laufende Antwort ($.turn.abort). Nur der Hauptchat, Subagenten nicht.
const waechter = atom({ plugin: 'roqam', key: 'waechter' } as const, {} as StatusleisteWaechter)
let aufrufe: string[] = []
const bestaetigt = new Set<string>()
let langGefragt: number | undefined
// Ersatz-Kennung für einen Schritt, wenn der Aufruf keine tool_use_id trägt
let schrittNr = 0
// Kärtchen öffnen per Klick statt bei Maus darüber (Hover ohne Verzögerung sprang beim Vorbeifahren auf; eine
// Verzögerung lässt die Schnittstelle nicht zu). Nur eins offen; zweiter Klick, Klick aufs Kärtchen oder 30 s
// schliessen es. In der App blieb es trotzdem offen, bis der Benutzer etwas eingab (09.10.2026): darum prüft zusätzlich
// der 5-s-Takt aus session.start den Ablauf (kaertchenAblauf), falls der Einzel-Zeitgeber dort verloren geht.
let offenesKaertchen: string | undefined
let kaertchenNr = 0
let kaertchenSeit = 0
const KAERTCHEN_MS = 30 * 1000
function kaertchenZu($: EngineInterface) {
  if (!offenesKaertchen) return
  offenesKaertchen = undefined
  kaertchenNr++
  $.ui.invalidate('ui.render')
}
async function kaertchenAblauf($: EngineInterface) {
  if (offenesKaertchen && kaertchenSeit && (await $.clock.now()) - kaertchenSeit >= KAERTCHEN_MS) kaertchenZu($)
}
function kaertchenUmschalten($: EngineInterface, key: string) {
  offenesKaertchen = offenesKaertchen === key ? undefined : key
  const nr = ++kaertchenNr
  kaertchenSeit = 0
  if (offenesKaertchen) {
    void $.clock.now().then(t => {
      if (kaertchenNr === nr) kaertchenSeit = t
    })
    $.clock.after(KAERTCHEN_MS, () => {
      if (kaertchenNr === nr && offenesKaertchen) {
        offenesKaertchen = undefined
        $.ui.invalidate('ui.render')
      }
    })
  }
  $.ui.invalidate('ui.render')
}
// Token-Zähler: Aufgabe (seit dem letzten Auftrag) rechts in der Wächter-Zeile, Sitzung (seit dem Laden des Mods)
// unten nach «Aufnahme»
let aufgabeTokens: Tokens = KEINE_TOKENS
let sitzungTokens: Tokens = KEINE_TOKENS
let fragtGerade = false
// Letzte Arbeit (Einblender, Vorgabe 15.10.2026): ab der eigenen Eingabe bis «bereit», samt Unteragenten und
// Nachzüglern von Hintergrund-Agenten; eine Nachricht mitten in der Arbeit beginnt nichts Neues
let arbeitSeit: number | undefined
let arbeitTokens: Tokens = KEINE_TOKENS
async function arbeitBeginn($: EngineInterface) {
  const stand = (await read($, phase).catch(() => undefined))?.stand
  if (stand === 'arbeitet' || stand === 'frage') return
  arbeitSeit = await $.clock.now()
  arbeitTokens = KEINE_TOKENS
}
// Text des Einblenders oben im Band: Zusammenstellung der letzten Arbeit; die Kosten nur mit eingeschalteten API-Kosten
// und nicht im Aufnahme-Modus, umgerechnet wie «API:» (ohne Kurs in Dollar)
async function arbeitZusammenstellung($: EngineInterface, usdChf: number | undefined, privat: boolean): Promise<string | undefined> {
  let api: string | undefined
  if (cfg.apiKosten && !privat && arbeitSeit !== undefined) {
    const usd = arbeitKosten(kostenbuch, await $.session.id().catch(() => ''), arbeitSeit)
    if (usd !== undefined) api = betragText(usd, usdChf)
  }
  return arbeitText(arbeitTokens, api)
}

// true = weiterlaufen, false = abbrechen; undefined = nicht gefragt, weil schon eine Wächter-Frage offen ist (dann
// läuft es weiter, gilt aber nicht als bestätigt). Geht die Rückfrage nicht, läuft es weiter.
async function waechterFrage($: EngineInterface, frage: string): Promise<boolean | undefined> {
  if (fragtGerade) return undefined
  fragtGerade = true
  // Sondermodus: Rückfrage in der Fusszeile und Ton, bis die Antwort da ist
  await frageBeginn($)
  try {
    return (await $.ui.ask(frage, { options: [WEITER, ABBRECHEN], header: WAECHTER_FRAGE })) !== ABBRECHEN
  } catch {
    return true
  } finally {
    fragtGerade = false
    await frageEnde($)
  }
}

// Bricht die Antwort ab, zu der die Frage gehörte (turnId beim Stellen der Frage gemerkt). Ist die Frage über das
// Ende der Antwort hinaus offen geblieben und läuft schon die nächste, bleibt die unbeteiligt.
async function waechterAbbrechen($: EngineInterface, turnId: string | undefined) {
  if (!turnId || (await read($, waechter)).turnId !== turnId) return
  await $.turn.abort({ turnId }).catch(() => undefined)
}

// alle 5 s, solange Claude arbeitet: Leiste neu zeichnen, langen Schritt melden
async function waechterTakt($: EngineInterface) {
  const w = await read($, waechter)
  if (w.seit === undefined) return
  $.ui.invalidate('ui.render')
  const now = await $.clock.now()
  const schritt = aeltester(w)
  if (!schritt || !waechterText(w, now)?.lang || langGefragt === schritt.seit) return
  langGefragt = schritt.seit
  // Aufnahme-Modus: ohne Befehl, Datei oder Pfad
  const was = istPrivat(await read($, aufnahme)) ? '' : ` (${schritt.was})`
  const weiter = await waechterFrage($, `A step has been running for ${dauer(now - schritt.seit)}${was}. Continue or cancel?`)
  // nicht gefragt (andere Frage offen): beim nächsten Takt nochmals
  if (weiter === undefined) langGefragt = undefined
  else if (!weiter) await waechterAbbrechen($, w.turnId)
}

// ── Aufnahme-Modus ────────────────────────────────────────────────────────────────────────────────────────────
// Von Hand über den Knopf (im $.store, damit alle offenen Chats ihn sehen) oder von selbst, solange ein
// Aufnahmeprogramm läuft. Alle 5 s den Knopfstand lesen, alle 10 s die Prozessliste.
const aufnahme = atom({ plugin: 'roqam', key: 'aufnahme' } as const, {} as StatusleisteAufnahme)
let aufnahmeTakt = 0

async function aufnahmePruefen($: EngineInterface) {
  try {
    const hand = (await $.store.get(AUFNAHME_KEY).catch(() => undefined)) === true
    let aus = (await $.store.get(AUFNAHME_AUS_KEY).catch(() => undefined)) === true
    let programm = (await read($, aufnahme)).programm
    if (aufnahmeTakt++ % 2 === 0) {
      const tasks = await $.process.run(['tasklist', '/FO', 'CSV', '/NH'], { timeoutMs: 15000 }).catch(() => undefined)
      if (tasks) programm = aufnahmeProgramm(tasks.stdout)
    }
    // Programm beendet: das Ausschalten von Hand gilt nicht weiter (beim nächsten OBS-Start wieder von selbst an)
    if (aus && !programm) {
      aus = false
      await $.store.set(AUFNAHME_AUS_KEY, false).catch(() => undefined)
    }
    const alt = await read($, aufnahme)
    if ((alt.hand === true) !== hand || alt.programm !== programm || (alt.aus === true) !== aus) {
      await update($, aufnahme, () => ({ ...(hand ? { hand } : {}), ...(programm ? { programm } : {}), ...(aus ? { aus } : {}) }))
    }
  } catch {
    // Mod inzwischen entladen (tasklist antwortete zu spät): nichts mehr schreiben
  }
}

// Knopf: schaltet das, was man sieht. Läuft ein Aufnahmeprogramm, schaltet «aus» bis zu dessen Ende aus.
async function aufnahmeUmschalten($: EngineInterface) {
  const a = await read($, aufnahme)
  const an = !istPrivat(a)
  const aus = !an && a.programm !== undefined
  await $.store.set(AUFNAHME_KEY, an)
  await $.store.set(AUFNAHME_AUS_KEY, aus)
  await update($, aufnahme, () => ({ ...(an ? { hand: an } : {}), ...(a.programm ? { programm: a.programm } : {}), ...(aus ? { aus } : {}) }))
}

// ── Ziel-Anzeige ──────────────────────────────────────────────────────────────────────────────────────────────
// Ziel aus dem Auftrag (kleines Modell, einmal pro Auftrag, ein paar hundert Tokens), Fortschritt aus Claudes
// Aufgabenliste, /goal mit Runden. Sichtbar, solange Claude arbeitet oder ein /goal gilt.
const ziel = atom({ plugin: 'roqam', key: 'ziel' } as const, {} as StatusleisteZiel)

// Nummer des letzten Auftrags: eine verspätete Antwort zu einem früheren Auftrag schreibt nichts mehr
let zielNr = 0

// Neues Ziel → alte Aufgabenliste weg (neue Arbeit). «-» (Ja, Dank, Rückfrage) → Ziel und Aufgaben bleiben.
// Keine Antwort (offline, Zeitlimit) → altes Ziel weg, damit kein fremdes Ziel über der neuen Arbeit steht.
async function zielZusammenfassen($: EngineInterface, auftrag: string, nr: number) {
  try {
    const r = await $.model
      .complete({ model: 'haiku', system: ZIEL_SYSTEM, prompt: zielPrompt(auftrag), maxTokens: 40, timeoutMs: 20000 })
      .catch(() => undefined)
    if (nr !== zielNr) return
    if (!r?.isAnswered) {
      await update($, ziel, ({ ziel: _z, ...s }) => s)
      return
    }
    const z = zielAusAntwort(r.text)
    if (z) await update($, ziel, ({ aufgaben: _a, ...s }) => ({ ...s, ziel: z }))
  } catch {
    // Mod inzwischen entladen (Antwort kam zu spät): nichts mehr schreiben
  }
}

// Nach einem Aufruf: Claudes Aufgabenliste nachführen
async function aufgabenNachfuehren($: EngineInterface, tool: string, input: Record<string, unknown>, result: unknown) {
  if (tool === 'TodoWrite') {
    const liste = ausTodoWrite(input.todos)
    if (liste) await update($, ziel, s => ({ ...s, aufgaben: liste }))
  } else if (tool === 'TaskCreate') {
    const r = result as { text?: unknown; result?: unknown }
    const antwort = typeof r?.text === 'string' ? r.text : JSON.stringify(r?.result ?? '')
    await update($, ziel, s => ({ ...s, aufgaben: aufgabeNeu(s.aufgaben ?? [], antwort, input) }))
  } else if (tool === 'TaskUpdate') {
    await update($, ziel, s => ({ ...s, aufgaben: aufgabeAendern(s.aufgaben ?? [], input) }))
  }
}

// ── Sondermodus-Ansicht (Easter Egg) ────────────────────────────────────────────────────────────────────────────────
// Das Geheimwort (eigene Nachricht, sondermodus-farben.ts) schaltet die Leiste in eine farbige Konsole um, dazu
// Chat-Rahmen (Eingabe blau, Ausgabe orange, Rückfrage rot) und Töne. Der Schalter steht im $.store und gilt in allen
// Chats, bis das Wort ihn wieder ausschaltet; offene Chats lesen ihn alle 5 s nach (wie den Aufnahme-Knopf). Ausgeschaltet bleibt alles beim Cockpit:
// keine Rahmen, keine Töne.
const sondermodusSchalter = atom({ plugin: 'roqam', key: 'sondermodus' } as const, {} as SondermodusSchalter)
// Fusszeile der Konsole: arbeitet, Rückfrage offen, fertig (nächster Schritt bei dir); läuft immer mit, damit sie
// beim Einschalten stimmt
const phase = atom({ plugin: 'roqam', key: 'phase' } as const, {} as SondermodusPhase)
// Oberfläche der letzten Zeichnung (Konsole: dort meldet sich nach einer Antwort schon das Terminal)
let terminalZuletzt = false
let klangZuletzt = -Infinity

async function sondermodusAn($: EngineInterface): Promise<boolean> {
  return (await read($, sondermodusSchalter)).an === true
}

// Schalter aus dem $.store in den State (alle 5 s und beim Start); nur bei einer Änderung neu zeichnen
async function sondermodusPruefen($: EngineInterface) {
  try {
    const an = (await $.store.get(SONDERMODUS_KEY).catch(() => undefined)) === true
    if ((await sondermodusAn($)) !== an) {
      await update($, sondermodusSchalter, () => (an ? { an } : {}))
      $.ui.invalidate('ui.render')
    }
  } catch {
    // Mod inzwischen entladen: nichts mehr schreiben
  }
}

async function sondermodusSetzen($: EngineInterface, an: boolean) {
  await $.store.set(SONDERMODUS_KEY, an)
  await update($, sondermodusSchalter, () => (an ? { an } : {}))
  $.ui.invalidate('ui.render')
}

// ── /stars: Himmel und Wetter ein- oder ausblenden (Vorgabe 15.10.2026) ──
// Aus: in der Leiste (Cockpit und Sondermodus) fehlen Seeing, Wolken, Mond, Dunkelzeit, Temperatur, Taupunkt und Feuchte;
// das Schreibtempo bleibt. Die Abrufe ruhen (Intern vor Cloud), beim Einschalten wird sofort neu geholt. Der Schalter
// steht im $.store und gilt in allen Chats; offene Chats lesen ihn alle 5 s nach (wie den Sondermodus).
const STERNE_KEY = 'sterne-aus'
const sterneSchalter = atom({ plugin: 'roqam', key: 'sterne' } as const, {} as SterneSchalter)
async function sterneAus($: EngineInterface): Promise<boolean> {
  return (await read($, sterneSchalter)).aus === true
}
// massgebend für die Abrufe: der $.store selbst (der State ist beim Start erst nach dem ersten Nachlesen gesetzt)
async function sterneAusGespeichert($: EngineInterface): Promise<boolean> {
  return (await $.store.get(STERNE_KEY).catch(() => undefined)) === true
}
function himmelHolen($: EngineInterface) {
  void refreshWetter($)
  void refreshNight($)
}
async function sternePruefen($: EngineInterface) {
  try {
    const aus = await sterneAusGespeichert($)
    if ((await sterneAus($)) !== aus) {
      await update($, sterneSchalter, () => (aus ? { aus } : {}))
      $.ui.invalidate('ui.render')
      if (!aus) himmelHolen($)
    }
  } catch {
    // Mod inzwischen entladen: nichts mehr schreiben
  }
}
async function sterneSetzen($: EngineInterface, aus: boolean) {
  await $.store.set(STERNE_KEY, aus)
  await update($, sterneSchalter, () => (aus ? { aus } : {}))
  $.ui.invalidate('ui.render')
  if (!aus) himmelHolen($)
}

// Ton über PowerShell (klang.ts), nur bei eingeschaltetem Sondermodus; zwei innert 1,5 s ergeben nur einen
async function klang($: EngineInterface, name: Klang) {
  if (!(await sondermodusAn($))) return
  const jetzt = await $.clock.now()
  if (jetzt - klangZuletzt < KLANG_PAUSE_MS) return
  klangZuletzt = jetzt
  const datei = name === 'bereit' ? bereitKlang(await tonKlassisch($)) : name
  await $.process.run(klangBefehl($.plugin.root, datei), { timeoutMs: 15000 })
}

// Gewählter Bereit-Ton (zweites Geheimwort, klang.ts): true = klassisch (hell), sonst die Quinte
async function tonKlassisch($: EngineInterface): Promise<boolean> {
  return (await $.store.get(TON_KEY).catch(() => undefined)) === true
}

// Rückfrage offen (Frage an dich, Plan zur Freigabe, Frage des Wächters): Fusszeile rot und Ton
async function frageBeginn($: EngineInterface) {
  await update($, phase, p => ({ ...p, stand: 'frage' as const })).catch(() => undefined)
  void klang($, 'eingabe').catch(() => undefined)
}
async function frageEnde($: EngineInterface) {
  await update($, phase, p => (p.stand === 'frage' ? { ...p, stand: 'arbeitet' as const } : p)).catch(() => undefined)
}
// Beginn einer Antwort im Hauptchat: Fusszeile «AKTIV»
async function phaseBeginn($: EngineInterface) {
  const seit = await $.clock.now()
  await update($, phase, () => ({ stand: 'arbeitet' as const, seit }))
}
// Laufende Hintergrund-Agenten (wie naechste-schritte; Teammates in eigenen Fenstern zählen nicht)
const AGENT_LAUFEND = new Set(['pending', 'running', 'waiting'])
async function laufendeAgenten($: EngineInterface): Promise<number> {
  try {
    const agents = await $.agent.list()
    return agents.filter(a => a.teammateId === undefined && AGENT_LAUFEND.has(a.status)).length
  } catch {
    return 0
  }
}
// Rätsel dieses Chats für den Einblender «bereit»; gilt bis zur nächsten fertigen Antwort, während der Arbeit steht
// ohnehin kein «bereit»-Einblender
let raetselText: string | undefined
// Zähler im $.store um eins erhöhen; liefert das Rätsel, wenn die Zahl ein Vielfaches von 100 ist. Geht der Store
// nicht, kein Rätsel.
async function antwortZaehlen($: EngineInterface): Promise<string | undefined> {
  try {
    const alt = await $.store.get(RAETSEL_KEY)
    const n = (typeof alt === 'number' && Number.isInteger(alt) && alt >= 0 ? alt : 0) + 1
    await $.store.set(RAETSEL_KEY, n)
    return raetselFuer(n)
  } catch {
    return undefined
  }
}
// Ende der Antwort im Hauptchat. Laufen noch Hintergrund-Agenten, ist die Aufgabe nicht fertig («hintergrund», kein
// Einblender; ihr Ergebnis startet eine neue Antwort). Sonst «bereit»: Einblender «COMPUTER BEREIT» im Band und am Ende
// der letzten Antwort (schluss); im Sondermodus nach mindestens 20 s Arbeit dazu ein Ton (nicht in der Konsole, nicht nach
// eigenem Abbruch).
async function phaseEnde($: EngineInterface, grund: string | undefined, antwort: string) {
  const jetzt = await $.clock.now()
  const p = await read($, phase)
  const dauer = typeof p.seit === 'number' && Number.isFinite(p.seit) ? Math.max(0, jetzt - p.seit) : 0
  if ((await laufendeAgenten($)) > 0) {
    await update($, phase, () => ({ stand: 'hintergrund' as const, ...(typeof p.seit === 'number' ? { seit: p.seit } : {}) }))
    return
  }
  await update($, phase, () => ({ stand: 'bereit' as const, dauer, schluss: schlussVon(antwort) }))
  // fertige Antworten über alle Chats zählen; bei jeder hundertsten steht ein Rätsel im Einblender (raetsel.ts)
  raetselText = await antwortZaehlen($)
  // der letzte Block der Antwort ist schon gezeichnet: neu zeichnen, damit sein Einblender erscheint
  $.ui.invalidate('ui.render')
  if (!terminalZuletzt && bereitTon(grund, dauer)) void klang($, 'bereit').catch(() => undefined)
  // Kosten der letzten Arbeit fürs Einblender-Band: Kostenbuch gleich und nach 5 s nochmals nachführen (die letzte
  // Antwort steht erst kurz nach dem Ende im Verlauf), danach neu zeichnen
  if (cfg.apiKosten) {
    const nachfuehren = () => void refreshPeriod($).then(() => $.ui.invalidate('ui.render')).catch(() => undefined)
    nachfuehren()
    $.clock.after(5000, nachfuehren)
  }
}

// Ein Teil der Astro-Zeile zeichnen (Cockpit und Sondermodus): Zeichen und Wert ohne Wort, dazwischen ein geschützter
// Leerschlag (die App schneidet einen normalen am Ende eines Text-Teils weg). Mond: in der App ein Bild mit zwölf
// Stufen (bild = Svg, nur auf «desktop»: die Konsole zeichnet Svg leer), sonst das Mond-Emoji; daneben jeweils die
// Beleuchtung in Prozent.
function sensorTeil(Text: ElementConstructor<TextProps>, bild: ElementConstructor<SvgProps> | undefined, p: NightPart, zeichenFarbe: string, wertFarbe: string | undefined) {
  if (p.mond && bild) {
    const Bild = bild
    const mondBild = <Bild key="mond-bild" alt={`Moon, step ${p.mond.stufe} of ${MOND_STUFEN}`} width={MOND_GROESSE} height={MOND_GROESSE} source={mondSvg(p.mond.stufe, p.mond.sued)} />
    // Beleuchtung in Prozent rechts neben dem Bild, mit geschütztem Leerschlag davor
    return p.value
      ? [
          mondBild,
          <Text key="mond-wert" color={wertFarbe} bold>
            {` ${p.value}`}
          </Text>,
        ]
      : mondBild
  }
  return (
    <Text>
      {p.symbol ? <Text color={zeichenFarbe}>{p.value ? `${p.symbol} ` : p.symbol}</Text> : null}
      {p.value ? (
        <Text color={wertFarbe} bold>
          {p.value}
        </Text>
      ) : null}
    </Text>
  )
}

// Farbfläche der Sondermodus-Ansicht. App: runde Ecken über eine Ebene hinter dem Inhalt (position absolute, spannt die
// ganze Fläche: Eckstück oben, Fläche, Eckstück unten; eckeSvg in sondermodus-farben.ts). Konsole und Oberflächen ohne
// Vektorbilder: gewöhnliche Box mit Hintergrund. art = Grösse und Lage (width, flexGrow …), vorn = Ausrichtung des
// Inhalts. Inhalt als Funktion = Schrift: Die App malt die absolute Ebene über alles im Fluss, auch über eine Box mit
// position relative (Namen der Blöcke unsichtbar, gesehen 14.10.2026). Darum steht die Schrift zweimal: im Fluss als
// Platzhalter für die Grösse (verdeckt) und in einer zweiten absoluten Box nach der Ebene (darüber gemalt). Ein
// Client-Element (Taste) bleibt im Fluss: die App zeigt es über der Ebene, und eine absolute Box gäbe den Klick an die
// Eltern-Box ab. Kein Aufhellen per hover: eine per hover eingeblendete absolute Ebene zeigt die App als eigenes Feld
// neben der Taste (Wahl 14.10.2026: ohne Aufhellen).
type Tafel = { Box: ElementConstructor<BoxProps>; Svg?: ElementConstructor<SvgProps> }
// nurLinks: rechts eckig (Tasten CTX, 5H, WOCHE stossen bündig an ihren Balken, Vorgabe 15.10.2026)
function sondermodusEbene(Box: ElementConstructor<BoxProps>, Svg: ElementConstructor<SvgProps>, key: string, farbe: string, nurLinks = false) {
  return (
    <Box key={key} position="absolute" top={0} bottom={0} left={0} right={0} flexDirection="column">
      <Svg alt={ECKE_ALT} height={ECKE_RADIUS} source={eckeSvg(farbe, false, nurLinks)} />
      <Box flexGrow={1} backgroundColor={farbe} />
      <Svg alt={ECKE_ALT} height={ECKE_RADIUS} source={eckeSvg(farbe, true, nurLinks)} />
    </Box>
  )
}
function flaeche(
  tafel: Tafel,
  key: string,
  farbe: string,
  art: BoxProps,
  inhalt?: RenderElement | (() => RenderElement) | null,
  vorn: BoxProps = {},
  nurLinks = false,
) {
  const { Box, Svg } = tafel
  const schrift = typeof inhalt === 'function' ? inhalt : undefined
  const element = typeof inhalt === 'function' ? undefined : inhalt
  if (!Svg) {
    return (
      <Box key={key} {...art} {...vorn} backgroundColor={farbe}>
        {schrift ? schrift() : (element ?? null)}
      </Box>
    )
  }
  if (schrift) {
    return (
      <Box key={key} {...art}>
        <Box key={`${key}-platz`} flexGrow={1} {...vorn}>
          {schrift()}
        </Box>
        {sondermodusEbene(Box, Svg, `${key}-grund`, farbe, nurLinks)}
        <Box key={`${key}-vorn`} position="absolute" top={0} bottom={0} left={0} right={0} flexDirection="row" alignItems="center" {...vorn}>
          {schrift()}
        </Box>
      </Box>
    )
  }
  return (
    <Box key={key} {...art}>
      {sondermodusEbene(Box, Svg, `${key}-grund`, farbe, nurLinks)}
      {element ? (
        <Box key={`${key}-vorn`} position="relative" flexGrow={1} {...vorn}>
          {element}
        </Box>
      ) : null}
    </Box>
  )
}

// Einblender als eigene Zeile über die ganze Breite: Fläche in der Farbe des Einblenders (Sondermodus grün, sonst hellgrau
// «CLAUDE BEREIT»; Zwischenschritt gold), Text schwarz und fett in der Mitte; in der App mit runden Ecken (ausser um den
// Rückfrage-Dialog, dort Tafel ohne Svg)
// text: eigener Text statt des gewohnten (oben im Band die Zusammenstellung der letzten Arbeit, 15.10.2026)
function einblenderZeile(tafel: Tafel, Text: ElementConstructor<TextProps>, key: string, art: Einblender, sondermodus: boolean, text?: string) {
  const { Box } = tafel
  return (
    <Box key={key} flexDirection="row">
      {flaeche(
        tafel,
        `${key}-flaeche`,
        einblenderFarbe(art, sondermodus),
        { flexGrow: 1 },
        () => (
          <Text color={SONDERMODUS.schwarz} bold wrap="truncate-end">
            {text ?? einblenderText(art, sondermodus)}
          </Text>
        ),
        { justifyContent: 'center' },
      )}
    </Box>
  )
}

// ── Sondermodus-Konsole über der Eingabe (Easter Egg) ─────────────────────────────────────────────────────
// Aufbau als farbige Tafel: links je Zeile ein farbiger Block mit dem Namen (schwarze Schrift), rechts
// die Werte in der Farbe ihres Blocks; unten die Fusszeile mit dem Stand (arbeitet, Rückfrage, bereit für den nächsten
// Schritt). Keine Kopfleiste mehr (Vorgabe 14.10.2026: ohne Nutzen). Werte, Kärtchen und Knöpfe sind dieselben wie im
// Cockpit; was dort per Einstellung aus ist (Ort leer, Aktionen, API-Kosten, Higgsfield), fehlt auch hier.
// Farbflächen in der App mit runden Ecken.
//   ZIEL       Ziel des Auftrags · ▰▰▱ 2/3 · jetzt: …          (nur während der Arbeit oder mit /goal)
//   WÄCHTER    ⏱  Arbeitet seit … · Schritt …   Ein: … / Aus: …   (nur während der Arbeit)
//   RESSOURCEN Ctx: ▰▱ 8,4%  │  5h: ▰▱ 6,0% −3h12  │  Woche: ▰▱ 9,0% −4T 6h
//   SYSTEM     Higgsfield … │ T−… │ Claude ● │ Opus 5.5 · Hoch      Sitzung – Ein: … / Aus: …
//   STATUS     v2.1.x │ Cloud $ │ Gratis-Reset │ 3 Chats │ Connectors ✓                     API: … CHF
//   BEFEHLE    [SICHERN] [ÜBERGABE] [KOMPRIMIEREN] [NEU]                                        ◉
//   SENSOREN   ● │ ☁ … │ 🌔 │ ★ … │ 🌡 … │ TP … │ 💧 … │ ⚡ … t/s
//   BEREIT     ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ NÄCHSTER SCHRITT: DEINE EINGABE ▬
// Die Werte liest und säubert der Hook (sichere… in register); hier wird nur gezeichnet.
type SondermodusWerte = {
  d: StatusleisteData
  privat: boolean
  waechter: StatusleisteWaechter
  ziel: StatusleisteZiel
  nacht: StatusleisteNacht
  wetter: StatusleisteWetter
  tempo: StatusleisteTempo
  phase: SondermodusPhase
  sys: StatusleisteSystem
}
async function sondermodusKonsole($: EngineInterface, e: RenderInput<'AbovePrompt'>, below: RenderElement, w: SondermodusWerte) {
  const { d, privat, sys } = w
  const isTerminal = e.surface === 'terminal'
  const width = e.props.bodyColumns ?? e.viewport?.columns ?? 120
  // Balken: App fest 10 Zeichen, Konsole nach Breite (die Blöcke links brauchen 13 Spalten)
  const barWidth = !isTerminal ? 10 : width >= 160 ? 10 : width >= 130 ? 8 : width >= 105 ? 5 : 0
  const jetzt = await $.clock.now()
  const parts = segments(d, jetzt, barWidth)
  // Aufnahme-Modus: Pfade, Kosten und Konten weglassen bzw. in gleicher Breite schwärzen (nichts springt)
  const geschwaerzt = (s: Segment) => privat && (s.label === 'Higgsfield' || s.label === '7D' || s.label === COST_LABEL)
  const SCHWARZ = { color: '#5C5C5C', backgroundColor: '#5C5C5C' }
  const wache = waechterText(w.waechter, jetzt, privat)
  const zs = w.ziel
  const zielZeile = !privat && (wache || zs.goal) ? zielAnzeige(zs) : undefined
  // nur, was eingeschaltet ist (wie im Cockpit)
  // Himmel und Wetter nur mit Ort und nicht per /stars ausgeblendet; das Tempo steht in der Zeile BEFEHLE vor REC
  const himmel = !!cfg.ort && !(await sterneAus($))
  const night = himmel ? nightParts(w.nacht, (ortLat ?? 0) < 0, w.wetter) : []
  const weather = himmel ? wetterParts(w.wetter) : []
  const sensoren = [...night, ...weather]
  // Rückfrage geht vor; sonst arbeitet Claude, solange der Wächter eine Antwort zählt
  const stand: Stand = standAus(w.phase.stand, !!wache)
  const guthaben = guthabenTeile(d.guthaben ?? [], jetzt)
  const st = sys.status
  const tafel = $.ui.resolve(e)
  const { Box, Text, Button } = tafel
  const Svg = 'Svg' in tafel ? tafel.Svg : undefined
  // runde Ecken nur, wo es Vektorbilder gibt (App); die Konsole zeichnet eckig
  const t: Tafel = { Box, Svg: isTerminal ? undefined : Svg }
  // Client nur in Konsole und App (VS Code und Handy zeichnen ihn nicht, 09.10.2026)
  const hatClient = e.surface === 'desktop' || e.surface === 'terminal'
  const Client = hatClient && 'Client' in tafel ? tafel.Client : undefined

  // Breite der Blöcke links (Spalten); in der App etwas breiter, weil fette Grossbuchstaben dort breiter laufen
  const W = isTerminal ? 12 : 14
  // 4 px Spalt zwischen den Zeilen (nur App), wie die Fugen zwischen den Blöcken einer Sondermodus-Tafel
  const luft = (key: string) =>
    !isTerminal && Svg ? (
      <Svg key={key} alt="Spacing" height={4} source={'<svg xmlns="http://www.w3.org/2000/svg" width="1" height="4"/>'} />
    ) : null
  const luecke = (key: string, breite = 1) => <Box key={key} width={breite} flexShrink={0} />
  const sepEl = (key: string) => (
    <Text key={key} color={SONDERMODUS.strich}>
      {' │ '}
    </Text>
  )
  const withSeps = (zeile: string, items: JSX.Element[]) =>
    items.flatMap((el, i) => (i > 0 ? [sepEl(`${zeile}-strich-${i}`), el] : [el]))
  // Block links: Name rechtsbündig in schwarzer Schrift auf der Zeilenfarbe
  const block = (key: string, wort: string, farbe: string) =>
    flaeche(
      t,
      `${key}-block`,
      farbe,
      { width: W, flexShrink: 0 },
      () => (
        <Text color={SONDERMODUS.schwarz} bold wrap="truncate-end">
          {wort}
        </Text>
      ),
      { justifyContent: 'flex-end', paddingRight: 1 },
    )
  // Eine Zeile der Tafel: Block, Fuge, Inhalt. Bricht nie um (Vorgabe 14.10.2026: jede Statuszeile auf einer Zeile);
  // reicht der Platz nicht, werden zuerst die Balken schmaler, dann die Sitzungs-Tokens am Ende gekürzt. Kein overflow
  // hidden: es schnitte die Kärtchen ab, die über ihrem Wort schweben.
  const zeile = (key: string, wort: string, farbe: string, inhalt: (JSX.Element | null)[]) => (
    <Box key={key} flexDirection="row">
      {block(key, wort, farbe)}
      {luecke(`${key}-fuge`)}
      <Box key={`${key}-inhalt`} flexDirection="row" flexGrow={1} flexShrink={1} minWidth={0}>
        {inhalt}
      </Box>
    </Box>
  )

  // Kärtchen per Klick, schweben ÜBER ihrem Wort (position absolute, nach oben), verschieben nichts. Alle gleich:
  // schwarzer Grund, fliederfarbener Rahmen, Schrift in Tan, so breit wie die längste Zeile. rechts: am rechten Rand
  // ausrichten (API-Kosten). Reicht der Platz über dem Wort nicht, kommen oben leere Zeilen dazu.
  // Deckend (Vorgabe 15.10.2026): Die App malt eine absolute Box nur über das, was VOR ihr kommt. Brach die Zeile in
  // zwei Zeilen um, ragte das Kärtchen (bottom 1) in die eigene Zeile, und die Wörter rechts davon lagen darüber
  // (durchscheinend, Screenshot 15.10.2026). Darum sitzt es auf einem Anker ohne Grösse an der Oberkante seines Worts:
  // Es deckt nur frühere Zeilen, egal wie hoch die eigene Zeile ist.
  let offenHoehe = 0
  const rahmen = (key: string, zeilen: string[], inhalt: JSX.Element[], rechts = false) => {
    const breite = Math.min(100, Math.max(20, ...zeilen.map(z => z.length)) + 4)
    if (offenesKaertchen === key) offenHoehe = zeilen.reduce((n, z) => n + Math.max(1, Math.ceil(z.length / (breite - 4))), 0) + 2
    const seite = rechts ? { right: 0 } : { left: 0 }
    return (
      <Box position="absolute" top={0} {...seite}>
        <Box
          position="absolute"
          bottom={0}
          {...seite}
          width={breite}
          display={offenesKaertchen === key ? 'flex' : 'none'}
          borderStyle="round"
          borderColor={SONDERMODUS.kartenRahmen}
          backgroundColor={SONDERMODUS.kartenGrund}
          paddingX={1}
          flexDirection="column"
        >
          {inhalt}
        </Box>
      </Box>
    )
  }
  // Klick auf den Text im Kärtchen schliesst es; ohne Client-Element bleibt es Text
  const kText = (key: string, text: string) =>
    Client ? (
      <Client key={key} module="./farb-knopf.tsx" props={{ teile: [{ text, color: SONDERMODUS.kartenSchrift }], aktion: 'kaertchen-zu' }} />
    ) : (
      <Text key={key} color={SONDERMODUS.kartenSchrift}>
        {text}
      </Text>
    )
  const kKnopf = (key: string, label: string, onPress: () => void) => <Button key={key} plain dimColor label={label} onPress={onPress} />
  const card = (key: string, lines: string[], rechts = false) => rahmen(key, lines, lines.map((l, i) => kText(`${key}-${i}`, l)), rechts)
  // Anklickbares Wort in einer Farbe (öffnet sein Kärtchen; unter der Maus heller, farb-knopf.tsx)
  type Teil = { text: string; color?: string; dim?: boolean; bold?: boolean }
  const farbKlick = (key: string, teile: Teil[]) =>
    Client ? (
      <Client key={`farb-${key}`} module="./farb-knopf.tsx" props={{ teile, kaertchen: key }} />
    ) : (
      <Text key={`farb-${key}`}>
        {teile.map((x, i) => (
          <Text key={`${key}-${i}`} color={x.color} dimColor={x.dim} bold={x.bold}>
            {x.text}
          </Text>
        ))}
      </Text>
    )
  const klick = (key: string, label: string, farbe: string) =>
    Client ? (
      <Client key={`klick-${key}`} module="./farb-knopf.tsx" props={{ teile: [{ text: label, color: farbe }], kaertchen: key }} />
    ) : (
      <Button key={`klick-${key}`} plain label={label} onPress={() => kaertchenUmschalten($, key)} />
    )
  // Sondermodus-Taste (sondermodus-knopf.tsx): farbige Fläche, schwarze Schrift; ohne Client-Element ein gewöhnlicher Knopf. In
  // der App zeichnet die Fläche samt runden Ecken die Ebene dahinter (flaeche), ohne Aufhellen unter der Maus.
  const taste = (key: string, label: string, farbe: string, aktion: string, onPress: () => void) =>
    !Client ? (
      <Button key={key} plain label={label} onPress={onPress} />
    ) : t.Svg ? (
      flaeche(t, `${key}-taste`, farbe, { flexShrink: 0 }, <Client key={key} module="./sondermodus-knopf.tsx" props={{ label, farbe, ohneFlaeche: true, aktion }} />)
    ) : (
      <Client key={key} module="./sondermodus-knopf.tsx" props={{ label, farbe, aktion }} />
    )

  // Ein Wert der Ressourcen- und Systemzeile: Wort und Zahl in der Zeilenfarbe, Balken in der Ampel
  const segEl = (s: Segment, farbe: string, verteilt: boolean) => (
    <Box key={`seg-${s.label}`} {...(verteilt ? { flexShrink: 0 } : {})}>
      <Text>
        {/* «Ctx:», «5h:», «7T:» (Vorgabe 09.10.2026) */}
        <Text color={farbe}>{s.label === 'ctx' ? 'Ctx:' : s.label === '5h' || s.label === '7D' ? `${s.label}:` : s.label}{s.label === CACHE_LABEL ? '' : ' '}</Text>
        {geschwaerzt(s) ? (
          <Text {...SCHWARZ}>{`${s.bar ? `${s.bar} ` : ''}${s.value}${s.suffix ?? ''}`}</Text>
        ) : (
          <Text>
            {s.bar ? (
              <Text color={sondermodusFarbe(s.color, AMPEL.warnung)} bold>
                {s.bar}{' '}
              </Text>
            ) : null}
            <Text color={farbe} bold>
              {s.value}
            </Text>
            {s.suffix ? <Text color={farbe}>{s.suffix}</Text> : null}
          </Text>
        )}
        {s.note ? <Text dimColor> {s.note}</Text> : null}
      </Text>
    </Box>
  )
  // Teile über die ganze Breite verteilt (App): erster links, letzter rechts, Striche mittig in den Lücken
  const verteilt = (zeileKey: string, items: JSX.Element[]) =>
    items.flatMap((el, i) =>
      i === 0
        ? [el]
        : !isTerminal && items.length > 1
          ? [
              <Box key={`${zeileKey}-luecke-${i}`} flexGrow={1} justifyContent="center">
                {sepEl(`${zeileKey}-strich-${i}`)}
              </Box>,
              el,
            ]
          : [sepEl(`${zeileKey}-strich-${i}`), el],
    )

  // ── Ziel und Wächter (nur während der Arbeit) ──
  const zielEl = zielZeile
    ? zeile(
        'ziel',
        'GOAL',
        SONDERMODUS.orange,
        [
          // füllt die Breite und wird erst am Zeilenende gekürzt (minWidth 0, sonst läuft es in der App über den Rand)
          <Box key="ziel-text" flexShrink={1} minWidth={0} overflow="hidden">
            <Text color={SONDERMODUS.weiss} wrap="truncate-end">{`${zs.goal ? '/goal: ' : ''}${zielZeile.ziel}`}</Text>
          </Box>,
          zielZeile.gesamt ? (
            <Text key="ziel-fortschritt" wrap="truncate-end">
              <Text color={SONDERMODUS.strich}>{'  ·  '}</Text>
              <Text color={AMPEL.gut} bold>
                {bar(((zielZeile.erledigt ?? 0) / zielZeile.gesamt) * 100, 5)}
              </Text>
              <Text color={SONDERMODUS.orange} bold>{` ${zielZeile.erledigt ?? 0}/${zielZeile.gesamt}`}</Text>
            </Text>
          ) : null,
          zielZeile.jetzt ? <Text key="ziel-jetzt" color={SONDERMODUS.hell}>{`  ·  now: ${zielZeile.jetzt}`}</Text> : null,
          zielZeile.runden ? <Text key="ziel-runden" color={SONDERMODUS.hell}>{`  ·  Round ${zielZeile.runden}`}</Text> : null,
        ],
      )
    : null
  const wacheEl = wache ? (
    <Box key="waechter" flexDirection="row">
      {block('waechter', 'WATCHDOG', SONDERMODUS.gold)}
      {luecke('waechter-fuge')}
      {/* Text wird am Ende gekürzt, damit Ein/Aus nie in die nächste Zeile rutscht; gold ab 4 Minuten je Schritt */}
      <Box key="waechter-text" flexShrink={1} minWidth={0} overflow="hidden">
        <Text color={wache.lang ? SONDERMODUS.gold : SONDERMODUS.hell} wrap="truncate-end">{`⏱  ${wache.text}`}</Text>
      </Box>
      {/* Tokens der Aufgabe rechtsbündig, Platz für die grösstmöglichen Zahlen reserviert */}
      <Box key="waechter-tokens" flexGrow={1} flexShrink={0} minWidth={TOKEN_PLATZ} justifyContent="flex-end">
        <Text color={SONDERMODUS.hell}>{`  ${tokenText(aufgabeTokens)}`}</Text>
      </Box>
    </Box>
  ) : null

  // ── Ressourcen: Kontext und Abo-Limits ──
  const ownRow = (s: Segment) => s.label === 'Higgsfield' || s.label === CACHE_LABEL
  const costSeg = parts.find(s => s.label === COST_LABEL)
  const limits = parts.filter(s => s.label !== COST_LABEL && !ownRow(s))
  // Variante B (Wahl 14.10.2026): je Wert eine Taste mit dem Wort (schwarz auf Orange), daran der Füllbalken mit runder
  // Kappe in der Ampelfarbe, dahinter Zahl (Orange) und Restzeit (Lavendel). Keine Striche, nur Luft dazwischen
  // (Vorgabe: Platzhalter bei den Strichen weg). Seit 16.10.2026 trennt ein Strich mit kurzem Abstand die Werte, und
  // in der App wachsen die Balken ab 10 Zellen mit und füllen die Zeile; bei Enge bis 3 – die Zeile bricht nie um.
  // Konsole: Balken aus Blöcken nach Breite. Aufnahme-Modus: Woche grau geschwärzt.
  const Bild = t.Svg
  const messEl = (s: Segment) => {
    const wort = s.label === 'ctx' ? 'CTX' : s.label.toUpperCase()
    const schwarz = geschwaerzt(s)
    const fuell = schwarz ? SCHWARZ.color : (sondermodusFarbe(s.color, AMPEL.warnung) ?? AMPEL.gut)
    const spur = schwarz ? SCHWARZ.color : BALKEN_SPUR
    const prozent = finite(s.percent) ? s.percent : 0
    const wert = ` ${s.value}`
    const zeichen = fuellBalkenZeichen(prozent, barWidth)
    return (
      <Box key={`seg-${s.label}`} flexDirection="row" alignItems="center" flexShrink={1} minWidth={0} {...(Bild ? { flexGrow: 1 } : {})}>
        {flaeche(
          t,
          `mess-${s.label}`,
          SONDERMODUS.orange,
          { flexShrink: 0 },
          () => (
            <Text color={SONDERMODUS.schwarz} bold>
              {wort}
            </Text>
          ),
          // Luft um das Wort: in der App ein Viertel weniger als eine Zelle, damit mehr vom Balken zu sehen ist
          // (Vorgabe Dominik 16.10.2026); die Konsole kennt nur ganze Zellen
          { paddingX: Bild ? 0.75 : 1 },
          true,
        )}
        {Bild ? (
          <Box key={`mess-${s.label}-balken`} width={10} minWidth={3} flexGrow={1} flexShrink={1} alignItems="center">
            <Bild alt={`${wort} ${schwarz ? '' : s.value}`.trim()} height={BALKEN_HOEHE} source={fuellBalkenSvg(prozent, fuell, spur)} />
          </Box>
        ) : zeichen.voll || zeichen.rest ? (
          <Text key={`mess-${s.label}-balken`}>
            <Text color={fuell}>{zeichen.voll}</Text>
            <Text color={spur}>{zeichen.rest}</Text>
          </Text>
        ) : null}
        {schwarz ? (
          <Text {...SCHWARZ}>{wert}</Text>
        ) : (
          <Text color={SONDERMODUS.orange} bold>
            {wert}
          </Text>
        )}
        {s.note ? <Text color={SONDERMODUS.lavendel}>{` ${s.note}`}</Text> : null}
      </Box>
    )
  }
  const ressourcen = zeile(
    'ressourcen',
    'RESOURCES',
    SONDERMODUS.orange,
    // zwischen den Werten ein Strich mit kurzem Abstand wie in der Systemzeile (Vorgabe Dominik 16.10.2026)
    withSeps('ressourcen', limits.map(messEl)),
  )

  // ── System: Higgsfield, Cache, Anthropic-Status, Modell; rechts das Token-Total der Sitzung ──
  const sysFarbe = SONDERMODUS.tan
  // App: alle Teile in natürlicher Breite, keiner bricht in sich um (Vorgabe 14.10.2026); kürzen darf nur «Sitzung»
  const sysItems: JSX.Element[] = parts.filter(ownRow).map(s => segEl(s, sysFarbe, !isTerminal))
  sysItems.push(
    <Box key="sys-status" flexDirection="row" {...(!isTerminal ? { flexShrink: 0 } : {})}>
      {farbKlick('status', [
        { text: 'Claude ', color: sysFarbe },
        { text: '●', color: sondermodusFarbe(statusColor(st?.indicator)) },
      ])}
      {/* Nur der farbige Punkt; Meldung und Störungen im Kärtchen, jede Störung anklickbar (öffnet ihre Seite) */}
      {(() => {
        const kopfText = st ? `Anthropic status: ${st.description}` : 'Anthropic status unreachable'
        const keine = st && st.incidents.length === 0 ? 'No open incidents for the services you use' : undefined
        const stoerungen = (st?.incidents ?? []).map(i => ({ text: `• ${i.text}${i.link ? ' ↗' : ''}`, link: i.link }))
        const ignoriert = st?.ignoriert?.length ? `Not counted (not used): ${st.ignoriert.join(', ')}` : undefined
        const seite = 'Open status.claude.com ↗'
        const zeilen = [kopfText, keine, ...stoerungen.map(s => s.text), ignoriert, seite].filter((z): z is string => !!z)
        return rahmen('status', zeilen, [
          kText('status-kopf', kopfText),
          ...(keine ? [kText('status-keine', keine)] : []),
          ...stoerungen.map((s, n) => (s.link ? kKnopf(`stoerung-${n}`, s.text, () => void openLink($, s.link!)) : kText(`stoerung-${n}`, s.text))),
          ...(ignoriert ? [kText('status-ignoriert', ignoriert)] : []),
          kKnopf('status-seite', seite, () => void openLink($, STATUS_PAGE)),
        ])
      })()}
    </Box>,
  )
  if (sys.model) {
    sysItems.push(
      <Box key="sys-model" flexDirection="row" {...(!isTerminal ? { flexShrink: 0 } : {})}>
        <Text color={sysFarbe}>{sys.model}</Text>
        {sys.effort ? <Text color={sysFarbe}>{` · ${sys.effort}`}</Text> : null}
      </Box>,
    )
  }
  const systemZeile = zeile('system', 'SYSTEM', sysFarbe, [
    ...withSeps('system', sysItems),
    // rechtsbündig; wird bei Enge am Ende gekürzt, statt die Zeile umzubrechen
    <Box key="sitzung-rechts" flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden" justifyContent="flex-end">
      <Text color={SONDERMODUS.hell} wrap="truncate-end">{`  Session – ${tokenText(sitzungTokens)}`}</Text>
    </Box>,
  ])

  // ── Status: Version, Aktion, Chats, Connectors; rechts die API-Kosten ──
  const statFarbe = SONDERMODUS.flieder
  const statItems: JSX.Element[] = []
  if (sys.version) {
    const neuer = sys.latest !== undefined && compareVersion(sys.latest, sys.version) > 0
    statItems.push(
      <Box key="sys-version" flexDirection="row">
        {/* gleiches Element in beiden Zuständen, nur die Farbe ändert sich (Flieder → Gold) */}
        {/* nur «Update» ohne Nummer (Vorgabe 15.10.2026); die Versionen stehen im Kärtchen */}
        {neuer
          ? farbKlick('version', [{ text: 'Update', color: AMPEL.warnung }])
          : farbKlick('version', [{ text: `v${sys.version}`, color: statFarbe }])}
        {card('version', [
          `Claude Code ${sys.version} is running in this chat`,
          neuer ? `New: ${sys.latest}. Terminal: "claude update"; the app gets its version with the next app update.` : 'Up to date (source: npm, checked every 6 hours)',
        ])}
      </Box>,
    )
  }
  // Geld-Guthaben nummeriert («Guthaben 1») oder mit Kurznamen («Cloud $»), Gutscheine unter ihrem Namen; ⚠ gold,
  // wenn der Ablauf näher als 7 Tage ist. Schlüssel aus dem Laufindex (zwei gleiche Kurznamen, 09.10.2026).
  let nummer = 0
  let lauf = 0
  for (const g of guthaben) {
    const kurz = g.kurz ?? (g.geld ? `Credit ${++nummer}` : g.name)
    const k = `guthaben-${lauf++}`
    statItems.push(
      <Box key={k} flexDirection="row">
        {privat ? <Text {...SCHWARZ}>{kurz}</Text> : klick(k, kurz, statFarbe)}
        {g.warn ? <Text color={AMPEL.warnung}> ⚠</Text> : null}
        {privat ? null : card(k, [`${g.label} ${g.value}, ${g.note}`])}
      </Box>,
    )
  }
  if (sys.abgleich) {
    statItems.push(
      <Box key="abgleich" flexDirection="row">
        <Text color={AMPEL.warnung} bold>
          ⚠ GitHub
        </Text>
        {privat ? null : card('abgleich', ['GitHub sync failing:', ...sys.abgleich])}
      </Box>,
    )
  }
  // Neue Aktion: Klick zeigt, was sich geändert hat, und bestätigt (Vorgabe 15.10.2026)
  const aktion = cfg.aktionen ? aktionAnzeige(d) : undefined
  if (aktion) {
    statItems.push(
      <Box key="neue-aktion" flexDirection="row">
        {farbKlick('aktion', [{ text: '⚑ New promotion', color: AMPEL.warnung, bold: true }])}
        {card('aktion', aktion)}
      </Box>,
    )
  }
  if (sys.chats) {
    const n = sys.chats.length
    const chatsText = `${n} Chat${n === 1 ? '' : 's'}`
    statItems.push(
      <Box key="sys-chats" flexDirection="row">
        {privat ? <Text color={statFarbe}>{chatsText}</Text> : klick('chats', chatsText, statFarbe)}
        {/* App-Chats anklickbar (springt hinein), dieser Chat und Konsolen-Chats nur zum Lesen; im Aufnahme-Modus
            kein Kärtchen (Chat-Titel nennen Projekte) */}
        {privat
          ? null
          : (() => {
              const zeilen = sys.chats.map(c => {
                const text = `${c.isSelf ? '▸ ' : '  '}${c.name} (${c.where}, ${c.status})`
                return { text: c.link && !c.isSelf ? `${text} ↗` : text, link: c.isSelf ? undefined : c.link }
              })
              return rahmen(
                'chats',
                zeilen.map(z => z.text),
                zeilen.map((z, i) => (z.link ? kKnopf(`chat-${i}`, z.text, () => void openLink($, z.link!)) : kText(`chat-${i}`, z.text))),
              )
            })()}
      </Box>,
    )
  }
  if (sys.connectors) {
    const weg = sys.missing ?? []
    statItems.push(
      <Box key="sys-connectors" flexDirection="row">
        {weg.length
          ? privat
            ? <Text color={AMPEL.warnung} bold>⚠ Connector lost</Text>
            : farbKlick('connectors', [{ text: `⚠ Connector lost: ${weg.join(', ')}`, color: AMPEL.warnung, bold: true }])
          : privat
            ? <Text color={statFarbe}>Connectors ✓</Text>
            : klick('connectors', 'Connectors ✓', statFarbe)}
        {privat
          ? null
          : card('connectors', [...sys.connectors.map(c => `✓ ${c}`), ...weg.map(c => `✗ ${c} (connected earlier in this session, now disconnected)`)])}
      </Box>,
    )
  }
  // API-Kosten rechtsbündig; Wort und Zahlen als EIN anklickbares Wort in derselben Farbe
  const kostenEl = costSeg ? (
    <Box key="api-kosten-rechts" flexGrow={1} justifyContent="flex-end">
      <Box key="api-kosten" flexDirection="row">
        {privat ? <Text color={statFarbe}>{`${costSeg.label} `}</Text> : klick('kosten', `${costSeg.label} ${costSeg.value}`, statFarbe)}
        {privat ? <Text {...SCHWARZ}>{costSeg.value}</Text> : null}
        {privat
          ? null
          : card(
              'kosten',
              [
                'API cost at list price, excluding VAT (your plan does not charge it on top):',
                '1. this chat since the start of the plan month (with subagents)',
                `2. project ${d.projectName ?? '…'} since the start of the plan month`,
                '3. all projects and chats since the start of the plan month, deleted chats included',
                ...(d.ohnePreis?.length ? [`Not counted (no price on file): ${d.ohnePreis.join(', ')}`] : []),
              ],
              true,
            )}
      </Box>
    </Box>
  ) : null
  const statusZeile = statItems.length > 0 || kostenEl ? zeile('status', 'STATUS', statFarbe, [...withSeps('status', statItems), kostenEl]) : null

  // ── Befehle: vier Tasten links, rechts das Aufnahme-Symbol ◉ ohne Fläche (Vorgabe 14.10.2026, die rote Taste blendete):
  // weiss, bei laufender Aufnahme rot, wie im Cockpit (aufnahme-knopf.tsx); davor das Wort «REC» immer in der Farbe
  // der Zeile (Vorgabe 15.10.2026, nur der Punkt zeigt an/aus) ──
  const tasten: [string, string, string, string, () => void][] = [
    ['sichern', 'SAVE', 'knopf-sichern', SONDERMODUS.orange, () => void runSichern($)],
    ['uebergabe', 'HANDOFF', 'knopf-uebergabe', SONDERMODUS.tan, () => void runHandoff($)],
    ['komprimieren', 'COMPACT', 'knopf-komprimieren', SONDERMODUS.flieder, () => void runCompact($)],
    ['neu', 'NEW', 'knopf-neu', SONDERMODUS.blau, () => void runNewChat($, isTerminal)],
  ]
  // Schreibtempo vor REC in der Zeilenfarbe (Vorgabe 15.10.2026, vorher in SENSOREN); ein Klick öffnet das Kärtchen.
  // Es hängt am Zeilenende (rechtsbündig mit REC ◉, wie das API-Kärtchen), nicht am Wort: dort ragte es links aus dem Band
  const tps = w.tempo.tps
  const tempoText = finite(tps) ? `${Math.round(tps)} t/s` : undefined
  const tempoEl = tempoText ? (
    <Box key="tempo" flexDirection="row" flexShrink={0}>
      {Client ? (
        <Client
          key="farb-tempo"
          module="./farb-knopf.tsx"
          props={{ teile: [{ text: '⚡ ', color: SONDERMODUS.lavendel }, { text: tempoText, color: SONDERMODUS.lavendel, bold: true }], kaertchen: 'tempo' }}
        />
      ) : (
        <Button key="klick-tempo" plain label={`⚡ ${tempoText}`} onPress={() => kaertchenUmschalten($, 'tempo')} />
      )}
    </Box>
  ) : null
  const befehle = zeile('befehle', 'COMMANDS', SONDERMODUS.lavendel, [
    ...tasten.flatMap(([aktion, label, key, farbe, onPress], i) => [i > 0 ? luecke(`${key}-fuge`) : null, taste(key, label, farbe, aktion, onPress)]),
    <Box key="knoepfe-rechts" flexDirection="row" flexGrow={1} justifyContent="flex-end">
      {tempoEl ? luecke('tempo-fuge') : null}
      {tempoEl}
      {tempoEl ? card('tempo', TEMPO_KARTE, true) : null}
      {luecke('aufnahme-fuge')}
      {Client ? (
        <Client key="knopf-aufnahme" module="./aufnahme-knopf.tsx" props={{ an: privat, nurSymbol: true, wort: AUFNAHME_WORT, wortFarbe: SONDERMODUS.lavendel }} />
      ) : (
        <Button key="knopf-aufnahme" plain label={`${AUFNAHME_WORT} ◉`} onPress={() => void aufnahmeUmschalten($)} />
      )}
    </Box>,
  ])

  // ── Sensoren: Himmel (Ampel, Wolken, Mond, Dunkelheit), Wetter am eingestellten Ort, Stream-Tempo ──
  const sensFarbe = SONDERMODUS.blau
  const sensorenZeile =
    sensoren.length > 0
      ? zeile(
          'sensoren',
          'SENSORS',
          sensFarbe,
          verteilt(
            'sensoren',
            sensoren.map(p => (
              <Box key={`sens-${p.label}`} {...(!isTerminal ? { flexShrink: 0, alignItems: 'center' as const } : {})}>
                {sensorTeil(Text, e.surface === 'desktop' ? Svg : undefined, p, sensFarbe, sondermodusFarbe(p.color, sensFarbe))}
              </Box>
            )),
          ),
        )
      : null

  // ── Fusszeile: Stand der Arbeit ──
  const fz = fussZeile(stand, privat)
  const fuss = (
    <Box key="sondermodus-fuss" flexDirection="row">
      {block('fuss', fz.block, fz.farbe)}
      {luecke('fuss-fuge1')}
      {flaeche(t, 'fuss-balken', fz.farbe, { flexGrow: 1 })}
      {luecke('fuss-fuge2')}
      <Text key="fuss-text" color={fz.farbe} bold>
        {fz.text}
      </Text>
      {luecke('fuss-fuge3')}
      {flaeche(t, 'fuss-ende', fz.farbe, { width: 3, flexShrink: 0 })}
    </Box>
  )

  // Einblender zuoberst: COMPUTER BEREIT (fertig) bzw. ZWISCHENSCHRITT (Rückfrage mitten in der Arbeit)
  const einblender = einblenderFuer(stand)
  // fertig: statt «COMPUTER BEREIT …» die Zusammenstellung der letzten Arbeit (Vorgabe 15.10.2026); der Einblender am
  // Ende der Antwort im Chat bleibt
  const zusammen = einblender === 'bereit' ? (raetselText ?? (await arbeitZusammenstellung($, undefined, privat))) : undefined
  const einblenderEl = einblender ? einblenderZeile(t, Text, 'einblender', einblender, true, zusammen) : null

  // Reihenfolge der Zeilen; Platz über dem Wort eines offenen Kärtchens = Zeilen darüber
  const reihen: [string, JSX.Element | null][] = [
    ['einblender', einblenderEl],
    ['ziel', zielEl],
    ['waechter', wacheEl],
    ['ressourcen', ressourcen],
    ['system', systemZeile],
    ['status', statusZeile],
    ['befehle', befehle],
    ['sensoren', sensorenZeile],
    ['fuss', fuss],
  ]
  const sichtbar = reihen.filter((r): r is [string, JSX.Element] => r[1] !== null)
  const kartenZeile = offenesKaertchen === 'status' ? 'system' : offenesKaertchen === 'tempo' ? 'befehle' : 'status'
  const platzOben = Math.max(0, sichtbar.findIndex(([name]) => name === kartenZeile))
  const fehlt = offenesKaertchen ? Math.max(0, offenHoehe - platzOben) : 0
  return (
    <Box flexDirection="column">
      {Array.from({ length: fehlt }, (_, i) => (
        <Text key={`kaertchen-platz-${i}`}>{' '}</Text>
      ))}
      {sichtbar.flatMap(([name, el], i) => [i > 0 ? luft(`luft-${name}`) : null, el])}
      {/* was andere Mods hier zeichnen (z. B. naechste-schritte), darunter */}
      {luft('luft-unten')}
      {below}
    </Box>
  )
}

export const register: Register = (on, options) => {
  cfg = readOptions(options as Record<string, unknown> | undefined)

  // ── Easter Egg: Claude bestätigt nur, dass es eines gibt (Vorgabe 16.10.2026, Text in easter-egg-regel.ts) ──
  on('prompt.compose', async ($, e, next) => {
    const result = await next(e)
    const ohne = result.sections.filter(s => s.id !== EASTER_EGG_ID)
    return { sections: [...ohne, { id: EASTER_EGG_ID, text: EASTER_EGG_REGEL, scope: 'session' }] }
  })

  // ── Sondermodus: Chat-Rahmen (nur bei eingeschaltetem Sondermodus) ──
  // Eingabe (deine Nachricht) blau, Ausgabe (Claudes Antwort) orange (getauscht, Vorgabe 14.10.2026), Rückfrage
  // rot. Jeder Teil bekommt eine Kopfzeile
  // (Endstück, Wort, Balken) und einen senkrechten Balken in derselben Farbe; der Inhalt bleibt die Zeichnung der App
  // ({ type: 'engine' } aus next), nur eingerahmt. Werkzeug-Zeilen, Meldungen anderer Sitzungen und alles auf Handy
  // und VS Code bleiben unverändert.

  // Deine Nachricht: in der App rechts bündig wie die Blase der App (Balken rechts), in der Konsole links
  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    const own = await next(e)
    if (e.surface !== 'desktop' && e.surface !== 'terminal') return own
    if (!(await sondermodusAn($))) return own
    if (!istEigeneEingabe(e.props.origin.kind, !!e.props.from, !!e.props.task)) return own
    const tafel = $.ui.resolve(e)
    const { Box, Text } = tafel
    // runde Ecken nur in der App (die Konsole führt Svg zwar in ihrer Tabelle, zeichnet es aber leer)
    const t: Tafel = { Box, Svg: e.surface === 'desktop' && 'Svg' in tafel ? tafel.Svg : undefined }
    const rechts = e.surface === 'desktop'
    const f = SONDERMODUS.blau
    const kopfTeile = [
      flaeche(t, 'ein-ende', f, { width: 2, flexShrink: 0 }),
      <Box key="ein-l1" width={1} flexShrink={0} />,
      <Text key="ein-wort" color={f} bold>
        {WORT_EINGABE}
      </Text>,
      <Box key="ein-l2" width={1} flexShrink={0} />,
      flaeche(t, 'ein-balken', f, { flexGrow: 1 }),
    ]
    const rumpfTeile = [
      flaeche(t, 'ein-seite', f, { width: 1, flexShrink: 0 }),
      <Box key="ein-l3" width={1} flexShrink={0} />,
      <Box key="ein-inhalt" flexDirection="column" flexGrow={1} flexShrink={1}>
        {own}
      </Box>,
    ]
    return (
      <Box flexDirection="column">
        <Box key="ein-kopf" flexDirection="row">
          {rechts ? kopfTeile.reverse() : kopfTeile}
        </Box>
        <Box key="ein-rumpf" flexDirection="row">
          {rechts ? rumpfTeile.reverse() : rumpfTeile}
        </Box>
      </Box>
    )
  }).catch(($, e, next) => next(e))

  // Claudes Antwort: Kopfzeile nur über dem ersten Teil einer Antwort, der orange Balken links an jedem Textteil (Sondermodus).
  // Unter dem letzten Block einer fertigen Aufgabe der Einblender «COMPUTER BEREIT» (Cockpit und Sondermodus).
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const own = await next(e)
    if (e.surface !== 'desktop' && e.surface !== 'terminal') return own
    const ph = await read($, phase)
    const schluss = ph.stand === 'bereit' && typeof ph.schluss === 'string' && istSchlussBlock(e.props.text, ph.schluss)
    const sondermodus = await sondermodusAn($)
    if (!sondermodus && !schluss) return own
    const tafel = $.ui.resolve(e)
    const { Box, Text } = tafel
    const Svg = e.surface === 'desktop' && 'Svg' in tafel ? tafel.Svg : undefined
    // runde Ecken nur in der App (die Konsole führt Svg zwar in ihrer Tabelle, zeichnet es aber leer)
    const t: Tafel = { Box, Svg }
    // Einblender mit 6 px Luft darüber (App; die Konsole kennt nur ganze Zeilen)
    const ende = schluss
      ? [
          Svg ? <Svg key="einblender-luft" alt="Spacing" height={6} source={'<svg xmlns="http://www.w3.org/2000/svg" width="1" height="6"/>'} /> : null,
          einblenderZeile(t, Text, 'einblender', 'bereit', sondermodus),
        ]
      : []
    if (!sondermodus) {
      return (
        <Box flexDirection="column">
          <Box key="aus-inhalt" flexDirection="column">
            {own}
          </Box>
          {ende}
        </Box>
      )
    }
    const f = SONDERMODUS.orange
    return (
      <Box flexDirection="column">
        {e.props.isFirstOfReply ? (
          <Box key="aus-kopf" flexDirection="row">
            {flaeche(t, 'aus-ende', f, { width: 2, flexShrink: 0 })}
            <Box key="aus-l1" width={1} flexShrink={0} />
            <Text key="aus-wort" color={f} bold>
              {WORT_AUSGABE}
            </Text>
            <Box key="aus-l2" width={1} flexShrink={0} />
            {flaeche(t, 'aus-balken', f, { flexGrow: 1 })}
          </Box>
        ) : null}
        <Box key="aus-rumpf" flexDirection="row">
          {flaeche(t, 'aus-seite', f, { width: 1, flexShrink: 0 })}
          <Box key="aus-l3" width={1} flexShrink={0} />
          <Box key="aus-inhalt" flexDirection="column" flexGrow={1} flexShrink={1}>
            {own}
          </Box>
        </Box>
        {ende}
      </Box>
    )
  }).catch(($, e, next) => next(e))

  // Rückfrage (Frage-Dialog, auch die des Wächters und «Komprimieren?»). Mitten in der Arbeit (Stand «frage») ist sie ein
  // Zwischenschritt: im Cockpit der Einblender «ZWISCHENSCHRITT» darüber, im Sondermodus steht es im roten Rahmen. Sondermodus:
  // roter Rahmen, in der App blinkt ein Feld.
  on('ui.render', { component: 'AskUserQuestion' }, async ($, e, next) => {
    const own = await next(e)
    if (e.surface !== 'desktop' && e.surface !== 'terminal') return own
    const zwischenschritt = (await read($, phase)).stand === 'frage'
    const sondermodus = await sondermodusAn($)
    if (!sondermodus && !zwischenschritt) return own
    const tafel = $.ui.resolve(e)
    const { Box, Text } = tafel
    const Svg = e.surface === 'desktop' && 'Svg' in tafel ? tafel.Svg : undefined
    // eckig: um den Dialog lehnt die App jede Positionsangabe ab («Box prop position around the dialog»), also auch
    // die Ebene der runden Ecken
    const t: Tafel = { Box }
    if (!sondermodus) {
      // Einblender über dem Dialog, darunter nichts (die App lässt unter dem Dialog nichts zu)
      return (
        <Box flexDirection="column">
          {einblenderZeile(t, Text, 'zwischenschritt', 'zwischenschritt', false)}
          <Box key="frage-inhalt" flexDirection="column">
            {own}
          </Box>
        </Box>
      )
    }
    const f = SONDERMODUS.alarm
    // Um den Dialog lässt die App keine festen Breiten zu: Endstück und Fugen darum als Text mit geschützten
    // Leerschlägen, der Balken dehnt sich; der Dialog selbst bleibt unverändert zwischen Kopf- und Schlussbalken
    return (
      <Box flexDirection="column">
        <Box key="frage-kopf" flexDirection="row">
          {flaeche(t, 'frage-ende', f, {}, <Text>{'  '}</Text>)}
          <Text color={f} bold>{` ${zwischenschritt ? WORT_ZWISCHENSCHRITT : WORT_FRAGE} `}</Text>
          {Svg ? <Svg key="frage-blinken" alt="Question open" width={44} height={12} isInteractive source={BLINKEN_SVG} /> : null}
          {Svg ? <Text>{' '}</Text> : null}
          {flaeche(t, 'frage-balken', f, { flexGrow: 1 }, <Text>{' '}</Text>)}
        </Box>
        <Box key="frage-rumpf" flexDirection="row">
          {flaeche(t, 'frage-seite', f, { paddingLeft: 1 })}
          <Box key="frage-inhalt" flexDirection="column" flexGrow={1} flexShrink={1} paddingLeft={1}>
            {own}
          </Box>
        </Box>
      </Box>
    )
  }).catch(($, e, next) => next(e))

  // Frage an dich (AskUserQuestion) oder Plan zur Freigabe (ExitPlanMode), nur Hauptchat: Fusszeile rot und Ton
  // (nur bei Sondermodus), bis die Antwort da ist
  on('tool.call', { tool: 'AskUserQuestion' }, async ($, e, next) => {
    if ('agentId' in e && e.agentId) return next(e)
    await frageBeginn($)
    try {
      return await next(e)
    } finally {
      await frageEnde($)
    }
  }).catch(($, e, next) => next(e))
  on('tool.call', { tool: 'ExitPlanMode' }, async ($, e, next) => {
    if ('agentId' in e && e.agentId) return next(e)
    await frageBeginn($)
    try {
      return await next(e)
    } finally {
      await frageEnde($)
    }
  }).catch(($, e, next) => next(e))

  // Geheimwort als eigene Nachricht (nur eigene Eingaben, ohne Anhang): Sondermodus umschalten, gilt in allen Chats bis
  // zum nächsten Mal. Die Nachricht geht nicht ans Modell und steht nicht im Verlauf; alles andere läuft unverändert.
  // Ein zweites Wort (klang.ts, TON_PRUEFSUMME) wechselt ebenso zwischen den zwei Bereit-Tönen und spielt den neuen an.
  on('prompt.submit', async ($, e, next) => {
    const text = e.attachments?.length ? undefined : e.text
    const wort = text === undefined ? undefined : geheimwort(text)
    const tonWort = text === undefined ? undefined : geheimwort(text, TON_PRUEFSUMME)
    const eigen = istEigeneEingabe(e.origin.kind, false, false)
    if (!wort && !tonWort) {
      // eigene Eingabe, die ans Modell geht: hier beginnt die «letzte Arbeit» des Einblenders
      if (eigen) await arbeitBeginn($).catch(() => undefined)
      return next(e)
    }
    if (!eigen) return next(e)
    if (tonWort) {
      const klassisch = !(await tonKlassisch($))
      await $.store.set(TON_KEY, klassisch)
      void klang($, 'bereit').catch(() => undefined)
      return { drop: tonMeldung(tonWort, klassisch) }
    }
    if (!wort) return next(e)
    const an = !(await sondermodusAn($))
    await sondermodusSetzen($, an)
    return { drop: sondermodusMeldung(wort, an) }
  }).catch(($, e, next) => next(e))
  // Wächter: Beginn und Ende jeder Antwort im Hauptchat. Ziel-Anzeige: neuer Auftrag → Ziel zusammenfassen und
  // alte Aufgabenliste weg; mit /goal zählt jede Antwort als Runde.
  on('turn.start', async ($, e, next) => {
    const seit = await $.clock.now()
    aufrufe = []
    bestaetigt.clear()
    aufgabeTokens = KEINE_TOKENS
    await update($, waechter, () => ({ seit, turnId: e.turnId }))
    // Sondermodus-Fusszeile «AKTIV»
    if (!('agentId' in e && e.agentId)) await phaseBeginn($)
    const text = e.text.trim()
    const neu = text !== '' && !text.startsWith('/')
    // Aufgabenliste erst weg, wenn das kleine Modell neue Arbeit erkennt (ein «Ja» lässt den Fortschritt stehen)
    if ((await read($, ziel)).goal) await update($, ziel, s => ({ ...s, runden: (s.runden ?? 0) + 1 }))
    if (neu) void zielZusammenfassen($, text, ++zielNr)
    return next(e)
  }).catch(($, e, next) => next(e))

  // /goal <Bedingung> merken, /goal clear vergessen (der Befehl selbst läuft unverändert)
  on('command.run', { command: 'goal' }, async ($, e, next) => {
    const args = e.args.trim()
    if (args === 'clear') await update($, ziel, ({ goal: _g, runden: _r, ...s }) => s)
    else if (args) await update($, ziel, s => ({ ...s, goal: args.length > 200 ? `${args.slice(0, 199)}…` : args, runden: 0 }))
    return next(e)
  }).catch(($, e, next) => next(e))

  // Wächter: jeden Aufruf im Hauptchat festhalten; gleiche Aufrufe in Folge erst nach Rückfrage durchlassen.
  // Dazu nach jedem Higgsfield-Auftrag (auch von Subagenten) die Credits sofort neu holen.
  on('tool.call', async ($, e, next) => {
    const tool = String(e.tool)
    const higgsfield = cfg.higgsfield && [...higgsfieldTools].some(prefix => tool.startsWith(prefix))
    if ('agentId' in e && e.agentId) {
      const result = await next(e)
      if (higgsfield) void refreshCredits($)
      return result
    }
    // Eigener Credit-Abruf der Leiste (balance, läuft auch nach der Antwort): kein Schritt für den Wächter und kein
    // neuer Abruf (sonst ruft jeder Abruf den nächsten auf)
    if (tool.endsWith('__balance')) return next(e)
    const input = e as unknown as Record<string, unknown>
    const was = schrittText(tool, input)
    const sig = signatur(tool, input)
    aufrufe = [...aufrufe.slice(-9), sig]
    const n = inFolge(aufrufe)
    if (n >= WIEDERHOLUNG && !bestaetigt.has(sig)) {
      // Antwort, zu der die Frage gehört: nur die darf «Abbrechen» treffen
      const turnId = (await read($, waechter)).turnId
      const zeigen = istPrivat(await read($, aufnahme)) ? '' : ` (${was})`
      const weiter = await waechterFrage($, `Claude has made the same call ${n} times in a row${zeigen}. Continue or cancel?`)
      if (weiter === false) {
        void waechterAbbrechen($, turnId)
        return {
          deny:
            'Watchdog: the user cancelled because the same call kept repeating. Do not try again; ' +
            'briefly explain what is going on and ask.',
        }
      }
      // nur eine beantwortete Frage bestätigt; war schon eine andere offen, fragt die nächste Wiederholung
      if (weiter === true) bestaetigt.add(sig)
    }
    const start = await $.clock.now()
    // Wächter-Zeile nur während einer Antwort (turn.start setzt «seit», turn.complete leert sie). Parallele Aufrufe
    // laufen gleichzeitig durch diesen Hook: jeder trägt seinen Schritt ein und entfernt am Ende nur den eigenen.
    const id = typeof input.tool_use_id === 'string' && input.tool_use_id ? input.tool_use_id : `#${++schrittNr}`
    await update($, waechter, w => (w.seit ? { ...w, laufend: [...(w.laufend ?? []), { id, was, seit: start }] } : w))
    let result: Awaited<ReturnType<typeof next>> | undefined
    try {
      result = await next(e)
      return result
    } finally {
      if (result && !('deny' in result && result.deny)) await aufgabenNachfuehren($, tool, input, result).catch(() => undefined)
      const ende = await $.clock.now()
      await update($, waechter, w => (w.seit ? { ...w, laufend: (w.laufend ?? []).filter(s => s.id !== id), letzter: { was, ende } } : w))
      if (higgsfield) void refreshCredits($)
    }
  }).catch(($, e, next) => next(e))

  // Oberfläche der letzten Zeichnung (für «+ Neu»: Konsole oder App)
  let istTerminalZuletzt = false
  // Klick auf den Knopf «◉ Aufnahme» (aufnahme-knopf.tsx meldet sich mit { umschalten: true })
  on('ui.message', async ($, e, next) => {
    if (e.element === 'knopf-aufnahme' && (e.data as { umschalten?: boolean } | undefined)?.umschalten === true) {
      await aufnahmeUmschalten($)
      return {}
    }
    // Klick auf ein farbiges Wort (farb-knopf.tsx meldet sich mit { kaertchen })
    const kaertchen = (e.data as { kaertchen?: unknown } | undefined)?.kaertchen
    if (typeof kaertchen === 'string') {
      // «⚑ Neue Aktion» öffnen bestätigt sie (Vorgabe 15.10.2026)
      if (kaertchen === 'aktion' && offenesKaertchen !== 'aktion') await aktionQuittieren($).catch(() => undefined)
      kaertchenUmschalten($, kaertchen)
      return {}
    }
    // Klick auf einen der vier Knöpfe, als Text gezeichnet (farb-knopf.tsx meldet sich mit { aktion })
    const aktion = (e.data as { aktion?: unknown } | undefined)?.aktion
    if (aktion === 'sichern') void runSichern($)
    else if (aktion === 'uebergabe') void runHandoff($)
    else if (aktion === 'komprimieren') void runCompact($)
    else if (aktion === 'neu') void runNewChat($, istTerminalZuletzt)
    else if (aktion === 'kaertchen-zu') kaertchenZu($)
    if (typeof aktion === 'string') return {}
    return next(e)
  })

  on('session.start', async ($, e, next) => {
    // .catch: eine späte Antwort des State nach dem Entladen des Mods darf keine unbehandelte Ablehnung hinterlassen (09.10.2026)
    $.clock.every(5 * 1000, () => void waechterTakt($).catch(() => undefined))
    $.clock.every(5 * 1000, () => void kaertchenAblauf($).catch(() => undefined))
    void aufnahmePruefen($)
    $.clock.every(5 * 1000, () => void aufnahmePruefen($))
    // Sondermodus-Schalter aus dem $.store (in einem anderen Chat umgeschaltet: hier nach höchstens 5 s)
    void sondermodusPruefen($)
    $.clock.every(5 * 1000, () => void sondermodusPruefen($))
    // /stars-Schalter ebenso (in einem anderen Chat umgeschaltet: hier nach höchstens 5 s)
    void sternePruefen($)
    $.clock.every(5 * 1000, () => void sternePruefen($))
    try {
      const usage = await $.session.usage()
      const limits = limitsData(usage.rateLimits, usage.context, usage.cost)
      await update($, data, d => ({ ...d, ...limits }))
    } catch {
      // keine Nutzungsdaten: Leiste startet ohne Limits (Ctx 0 %), session.measure liefert sie nach
    }
    if (cfg.higgsfield) {
      $.clock.after(20 * 1000, () => higgsfieldPruefen($))
      $.clock.every(REFRESH_MS, () => higgsfieldPruefen($))
    }
    // Ort einmal in Koordinaten auflösen, dann Wetter und Astro-Zeile (fest eingebaut, Vorgabe 14.10.2026); scheitert
    // die Ortssuche (offline beim Start), nochmals im Wetter-Takt
    const ortAufloesen: () => void = () => void resolveOrt($).then(ok => {
      if (!ok) {
        if (cfg.ort) $.clock.after(WETTER_REFRESH_MS, ortAufloesen)
        return
      }
      void refreshWetter($)
      $.clock.every(WETTER_REFRESH_MS, () => void refreshWetter($))
      void refreshNight($)
      $.clock.every(NIGHT_REFRESH_MS, () => void refreshNight($))
      // Ist die dunkle Zeit vorbei, gleich die nächste Nacht holen statt bis zu 30 min die vergangene zu zeigen
      $.clock.every(30 * 1000, async () => {
        const n = await read($, nacht)
        if (n.end !== undefined && n.end <= (await $.clock.now())) void refreshNight($)
      })
    })
    ortAufloesen()
    void readCacheStart($)
    // API-Kosten (Kurs und Monatssumme) und Aktionsprüfung nur, wenn eingeschaltet
    // English version: costs stay in USD, the currency of the API list prices; no exchange-rate request
    if (cfg.apiKosten) {
      void refreshPeriod($)
      $.clock.every(PERIOD_REFRESH_MS, () => void refreshPeriod($))
    }
    if (cfg.aktionen) {
      void refreshAktion($)
      $.clock.every(PERIOD_REFRESH_MS, () => void refreshAktion($))
    }
    // Countdowns (Cache, 5h) jede halbe Minute neu zeichnen
    $.clock.every(30 * 1000, () => $.ui.invalidate('ui.render'))
    void refreshStatus($)
    $.clock.every(STATUS_REFRESH_MS, () => void refreshStatus($))
    void refreshVersion($)
    $.clock.every(VERSION_REFRESH_MS, () => void refreshVersion($))
    void refreshModel($)
    void refreshChats($)
    $.clock.every(CHATS_REFRESH_MS, () => void refreshChats($))
    $.clock.after(30 * 1000, () => void refreshConnectors($))
    $.clock.every(5 * 60 * 1000, () => void refreshConnectors($))
    void refreshDateien($)
    $.clock.every(60 * 1000, () => void refreshDateien($))
    await $.command.register({
      name: 'promo-seen',
      description: 'Confirm the "New promotion" notice in the status bar (clicking it works too)',
    }).catch(() => undefined)
    await $.command.register({
      name: 'stars',
      description: 'Show or hide sky and weather in the status bar (applies to all chats)',
    }).catch(() => undefined)
    return next(e)
  }).catch(($, e, next) => next(e))

  // /stars: Himmel und Wetter umschalten (Vorgabe 15.10.2026); kein Modellaufruf
  on('command.run', { command: 'stars' }, async $ => {
    const aus = !(await sterneAusGespeichert($))
    await sterneSetzen($, aus)
    return {
      text: aus
        ? 'Sky and weather hidden, fetching paused. Applies to all chats; run /stars again to show them.'
        : 'Sky and weather shown, fetching fresh values. Applies to all chats.',
    }
  })

  // /aktion-gesehen: den jetzigen Stand der Aktions-Merker als bestätigt speichern, Hinweis ausblenden (für Oberflächen,
  // auf denen das Wort nicht anklickbar ist: VS Code, Handy)
  on('command.run', { command: 'promo-seen' }, async $ => {
    const d = await read($, data)
    if (d.aktionSig) await $.store.set(AKTION_KEY, d.aktionSig)
    await update($, data, x => ({ ...x, neueAktion: false }))
    return { text: `Promotion confirmed, notice hidden.${d.aktionZeilen?.length ? ` ${d.aktionZeilen.join(' · ')}` : ''}` }
  })

  // Modell und Denkstufe der laufenden Anfrage im Hauptchat (Subagenten nicht)
  // turn.step liefert die Antwort stückweise: nur als async generator erlaubt, reicht alles unverändert durch
  on('turn.step', async function* ($, e, next) {
    if (!e.agentId) void refreshModel($, e.effort).catch(() => undefined)
    // Stream-Tempo (nur Hauptchat): Zeit des ersten Stücks merken; alle Stücke gehen unverändert weiter
    const strom = next(e)
    let erstes: number | undefined
    let gemerkt = false
    for await (const stueck of strom) {
      if (!gemerkt && !e.agentId) {
        gemerkt = true
        erstes = await $.clock.now().catch(() => undefined)
      }
      yield stueck
    }
    const result = await strom.result
    // Tokens jeder Anfrage zählen, auch die der Subagenten
    if (result?.usage) {
      aufgabeTokens = tokensPlus(aufgabeTokens, result.usage)
      sitzungTokens = tokensPlus(sitzungTokens, result.usage)
      arbeitTokens = tokensPlus(arbeitTokens, result.usage)
    }
    // Jede Anfrage im Hauptchat frischt den Cache auf, nicht erst das Ende der Antwort (lange Antworten zeigten «kalt»)
    if (!e.agentId) {
      const at = await $.clock.now()
      await update($, data, d => ({ ...d, cacheAt: at }))
      const tps = erstes !== undefined ? tempoAus(result?.usage?.output_tokens, at - erstes) : undefined
      if (tps !== undefined) await update($, tempo, () => ({ tps })).catch(() => undefined)
    }
    return result
  })

  on('session.measure', async ($, e, next) => {
    const limits = limitsData(e.rateLimits, e.context, e.cost)
    await update($, data, d => ({ ...d, ...limits }))
    if (limits.ctx !== undefined) {
      const warning = contextWarning(limits.ctx, warned)
      if (warning) $.ui.toast(warning, { timeoutMs: 10000 })
    }
    return next(e)
  })

  // Nach dem Komprimieren meldet session.measure erst mit der nächsten Antwort einen neuen Füllstand:
  // darum ctx sofort aus der Grösse nach dem Zusammenfassen setzen (sonst Schätzung des Engines)
  on('session.compact', async ($, e, next) => {
    const result = await next(e)
    if (result.messages && e.trigger !== 'precompute') {
      const usage = await $.session.usage({ breakdown: 'summary' })
      const window = usage.context.window
      const tokens = result.tokensAfter ?? usage.context.breakdown?.totalTokens
      if (tokens !== undefined && window > 0) {
        warned.clear()
        await update($, data, d => ({ ...d, ctx: (tokens / window) * 100 }))
      }
    }
    return result
  }).catch(($, e, next) => next(e))

  // Ende jeder Antwort im Hauptchat: ab jetzt läuft die Cache-Stunde neu (Subagenten haben ihren eigenen Cache)
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (!('agentId' in e && e.agentId)) {
      const at = await $.clock.now()
      await update($, data, d => ({ ...d, cacheAt: at }))
      // Wächter: Antwort fertig (auch abgebrochen), Zeile verschwindet
      await update($, waechter, () => ({}))
      // Einblender «COMPUTER BEREIT» (ausser Hintergrund-Agenten laufen noch), im Sondermodus nach längerer Arbeit ein Ton
      await phaseEnde($, e.reason, e.answer)
    }
    return result
  }).catch(($, e, next) => next(e))

  // Werte aus dem State vor dem Zeichnen säubern: der State überlebt das Neuladen des Codes und kann von einer anderen
  // Fassung stammen oder null enthalten; ein falsch getyptes Feld liess das Zeichnen abstürzen, und ohne .catch war
  // dann die ganze Leiste weg (09.10.2026). Zahlen nur endlich, Texte nur Texte, Listen nur mit gültigen Einträgen;
  // alles andere fällt weg.
  const nurZahl = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
  const nurWort = (v: unknown) => (typeof v === 'string' ? v : undefined)
  const nurWahr = (v: unknown) => (typeof v === 'boolean' ? v : undefined)
  const nurObjekt = (v: unknown): Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
  const nurListe = <T,>(v: unknown, eintrag: (x: unknown) => T | undefined) =>
    Array.isArray(v) ? v.map(eintrag).filter((x): x is T => x !== undefined) : undefined
  const nurWoerter = (v: unknown) => nurListe(v, nurWort)
  const sichereData = (v: unknown): StatusleisteData => {
    const d = nurObjekt(v)
    return {
      credits: nurZahl(d.credits),
      fiveHour: nurZahl(d.fiveHour),
      fiveHourResetsAt: nurWort(d.fiveHourResetsAt),
      week: nurZahl(d.week),
      weekResetsAt: nurWort(d.weekResetsAt),
      ctx: nurZahl(d.ctx),
      cacheAt: nurZahl(d.cacheAt),
      costUsd: nurZahl(d.costUsd),
      usdChf: nurZahl(d.usdChf),
      periodUsd: nurZahl(d.periodUsd),
      periodSince: nurZahl(d.periodSince),
      projectUsd: nurZahl(d.projectUsd),
      chatUsd: nurZahl(d.chatUsd),
      projectName: nurWort(d.projectName),
      ohnePreis: nurWoerter(d.ohnePreis),
      guthaben: nurListe(d.guthaben, guthabenEintrag),
      neueAktion: nurWahr(d.neueAktion),
      aktionSig: nurWort(d.aktionSig),
      aktionZeilen: nurWoerter(d.aktionZeilen),
    }
  }
  const sichereSystem = (v: unknown): StatusleisteSystem => {
    const s = nurObjekt(v)
    const st = nurObjekt(s.status)
    const stoerung = (x: unknown) => {
      const i = nurObjekt(x)
      return typeof i.text === 'string' ? { text: i.text, link: nurWort(i.link) } : undefined
    }
    const chat = (x: unknown) => {
      const c = nurObjekt(x)
      return typeof c.name === 'string' && typeof c.where === 'string' && typeof c.status === 'string'
        ? { name: c.name, where: c.where, status: c.status, isSelf: c.isSelf === true, link: nurWort(c.link) }
        : undefined
    }
    return {
      status:
        typeof st.indicator === 'string' && typeof st.description === 'string'
          ? { indicator: st.indicator, description: st.description, incidents: nurListe(st.incidents, stoerung) ?? [], ignoriert: nurWoerter(st.ignoriert) }
          : undefined,
      model: nurWort(s.model),
      effort: nurWort(s.effort),
      version: nurWort(s.version),
      latest: nurWort(s.latest),
      chats: nurListe(s.chats, chat),
      connectors: nurWoerter(s.connectors),
      missing: nurWoerter(s.missing),
      abgleich: nurWoerter(s.abgleich),
    }
  }
  const sichereWetter = (v: unknown): StatusleisteWetter => {
    const w = nurObjekt(v)
    return { temp: nurZahl(w.temp), dewPoint: nurZahl(w.dewPoint), hum: nurZahl(w.hum) }
  }
  const sichereTempo = (v: unknown): StatusleisteTempo => ({ tps: nurZahl(nurObjekt(v).tps) })
  const NACHT_STUFEN = ['gut', 'mässig', 'bewölkt', 'keine'] as const
  const sichereNacht = (v: unknown): StatusleisteNacht => {
    const n = nurObjekt(v)
    return {
      start: nurZahl(n.start),
      end: nurZahl(n.end),
      offset: nurZahl(n.offset),
      moon: nurZahl(n.moon),
      isWaxing: nurWahr(n.isWaxing),
      cloud: nurZahl(n.cloud),
      seeing: nurZahl(n.seeing),
      level: NACHT_STUFEN.find(l => l === n.level),
    }
  }
  const sichereAufnahme = (v: unknown): StatusleisteAufnahme => {
    const a = nurObjekt(v)
    return { hand: nurWahr(a.hand), programm: nurWort(a.programm), aus: nurWahr(a.aus) }
  }
  const sichereWaechter = (v: unknown): StatusleisteWaechter => {
    const w = nurObjekt(v)
    // laufende Schritte als Liste (parallele Aufrufe); ein alter Stand mit «schritt» fällt weg
    const schritt = (x: unknown) => {
      const s = nurObjekt(x)
      const seit = nurZahl(s.seit)
      return typeof s.id === 'string' && typeof s.was === 'string' && seit !== undefined ? { id: s.id, was: s.was, seit } : undefined
    }
    const l = nurObjekt(w.letzter)
    const lEnde = nurZahl(l.ende)
    return {
      seit: nurZahl(w.seit),
      turnId: nurWort(w.turnId),
      laufend: nurListe(w.laufend, schritt),
      letzter: typeof l.was === 'string' && lEnde !== undefined ? { was: l.was, ende: lEnde } : undefined,
    }
  }
  const AUFGABEN_STATUS = ['pending', 'in_progress', 'completed'] as const
  const sichereZiel = (v: unknown): StatusleisteZiel => {
    const z = nurObjekt(v)
    const aufgabe = (x: unknown) => {
      const a = nurObjekt(x)
      const status = AUFGABEN_STATUS.find(s => s === a.status)
      return typeof a.id === 'string' && typeof a.text === 'string' && status ? { id: a.id, text: a.text, aktiv: nurWort(a.aktiv), status } : undefined
    }
    return { ziel: nurWort(z.ziel), goal: nurWort(z.goal), runden: nurZahl(z.runden), aufgaben: nurListe(z.aufgaben, aufgabe) }
  }
  const PHASE_STAENDE = ['arbeitet', 'hintergrund', 'frage', 'bereit'] as const
  const sicherePhase = (v: unknown): SondermodusPhase => {
    const p = nurObjekt(v)
    return { stand: PHASE_STAENDE.find(s => s === p.stand), seit: nurZahl(p.seit), dauer: nurZahl(p.dauer), schluss: nurWort(p.schluss) }
  }

  // Eigene Zeile über der Eingabe (ohne Warndreieck der Hinweiszeile); im Sondermodus dessen Konsole
  // Auch während einer Bewertung der App (hasSurvey, die Schnittstelle rät, ihr Platz zu lassen): Vorgabe 15.10.2026,
  // das Cockpit bleibt sichtbar; die Bewertung steht wie alles Darunterliegende (below) unter dem Cockpit
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    terminalZuletzt = e.surface === 'terminal'
    if (await sondermodusAn($)) {
      istTerminalZuletzt = terminalZuletzt
      return sondermodusKonsole($, e, below, {
        d: sichereData(await read($, data)),
        privat: istPrivat(sichereAufnahme(await read($, aufnahme))),
        waechter: sichereWaechter(await read($, waechter)),
        ziel: sichereZiel(await read($, ziel)),
        nacht: sichereNacht(await read($, nacht)),
        wetter: sichereWetter(await read($, wetter)),
        tempo: sichereTempo(await read($, tempo)),
        phase: sicherePhase(await read($, phase)),
        sys: sichereSystem(await read($, system)),
      })
    }
    const d = sichereData(await read($, data))
    // Terminal: Striche und Balkenbreite nach Spalten; Desktop-App: Rahmen zeichnet die App, Zeilen umbrechen
    const isTerminal = e.surface === 'terminal'
    istTerminalZuletzt = isTerminal
    const width = e.props.bodyColumns ?? e.viewport?.columns ?? 120
    const barWidth = !isTerminal ? appBalken(width) : width >= 150 ? 12 : width >= 125 ? 10 : width >= 100 ? 6 : 0
    // Aufnahme-Modus: Pfade, Kosten und Konten weglassen (Higgsfield-Credits, API-Kosten, Wochenlimit ohne Reset-Zeit, Chat- und
    // Connector-Kärtchen, Ziel-Zeile, Schritte der Wächter-Zeile)
    const auf = sichereAufnahme(await read($, aufnahme))
    const privat = istPrivat(auf)
    const alleTeile = segments(d, await $.clock.now(), barWidth)
    // Nichts verschwindet (die Leiste darf beim Umschalten nicht springen): private Werte bleiben stehen, aber in gleicher
    // Breite grau geschwärzt (Schrift und Hintergrund gleiche Farbe)
    const parts = alleTeile
    const geschwaerzt = (s: Segment) => privat && (s.label === 'Higgsfield' || s.label === '7D' || s.label === COST_LABEL)
    const SCHWARZ = { color: '#5C5C5C', backgroundColor: '#5C5C5C' }
    // Wächter-Zeile nur, solange Claude arbeitet; gelb, wenn ein Schritt schon über 4 Minuten läuft
    const wache = waechterText(sichereWaechter(await read($, waechter)), await $.clock.now(), privat)
    // Ziel-Zeile darüber, solange Claude arbeitet oder ein /goal gilt
    const zs = sichereZiel(await read($, ziel))
    const zielZeile = !privat && (wache || zs.goal) ? zielAnzeige(zs) : undefined
    // Einblender zuoberst: COMPUTER BEREIT (Aufgabe fertig) bzw. ZWISCHENSCHRITT (Rückfrage mitten in der Arbeit)
    const einblender = einblenderFuer(standAus(sicherePhase(await read($, phase)).stand, !!wache))
    // fertig: statt «CLAUDE BEREIT» die Zusammenstellung der letzten Arbeit (Vorgabe 15.10.2026)
    const zusammen = einblender === 'bereit' ? (raetselText ?? (await arbeitZusammenstellung($, undefined, privat))) : undefined
    // nur, was eingeschaltet ist: die Werte überleben das Neuladen nach einer Optionsänderung
    // Himmel und Wetter nur mit Ort und nicht per /stars ausgeblendet; das Tempo steht vor «◉ Aufnahme»
    const himmel = !!cfg.ort && !(await sterneAus($))
    const night = himmel ? nightParts(sichereNacht(await read($, nacht)), (ortLat ?? 0) < 0, sichereWetter(await read($, wetter))) : []
    const weather = himmel ? wetterParts(sichereWetter(await read($, wetter))) : []
    // Wetter hinter der dunklen Zeit auf derselben Zeile (Vorgabe 14.10.2026: alles auf einer Linie)
    const nightRows = [[...night, ...weather]]
    const tps = sichereTempo(await read($, tempo)).tps
    const tafel = $.ui.resolve(e)
    const { Box, Text, Button } = tafel
    const Svg = 'Svg' in tafel ? tafel.Svg : undefined
    // Luft zwischen den Zeilen unter der weissen Linie: 4 px (nur App; die Konsole kennt nur ganze Zeilen)
    const luft = (key: string) =>
      !isTerminal && Svg ? (
        <Svg key={key} alt="Spacing" height={4} source={'<svg xmlns="http://www.w3.org/2000/svg" width="1" height="4"/>'} />
      ) : null
    // Client gibt es nur in Konsole und App (Typdatei: Elements); die Tabelle führt den Schlüssel auch auf VS Code und
    // Handy, dort zeichnet er aber nur ein leeres Fragment – darum nach der Oberfläche entscheiden (09.10.2026)
    const hatClient = e.surface === 'desktop' || e.surface === 'terminal'
    const Client = hatClient && 'Client' in tafel ? tafel.Client : undefined
    const rule = (key: string) => isTerminal ? <Text key={key} dimColor>{'─'.repeat(Math.max(10, width))}</Text> : null
    // weisse Linie, immer über die ganze Breite (Wunsch 07.10.2026): über der ctx-Zeile, vor der
    // Higgsfield-Zeile und ganz am Ende. Konsole als Strichzeichen, App als feine Linie (0,67 px in 16 px Höhe = bei 150 % genau 1 Bildpunkt auf ganzem Pixelraster, alle gleich hell; NICHT crispEdges, das liess Linien je nach Lage verschwinden; seit 07.10.2026
    // abends dünner) mit je rund 7 px Luft darüber und darunter (Svg 16 px hoch; Svg füllt die Breite, Strichzeichen
    // würden in der App umbrechen; ohne height rechnet die App die Höhe aus dem Seitenverhältnis und zeichnet einen
    // dicken Balken)
    // oben/unten: Luft über und unter dem Strich in CSS-px, Vielfache von 2/3 (bei 150 % ganze Bildpunkte). Die zwei
    // oberen Linien knapp (Vorgabe 15.10.2026: sonst reichte der Platz über der Eingabe nicht für den dritten
    // Vorschlag und man musste scrollen): über der ersten 4 statt 4 + 7,33 (Luft nach dem Einblender entfällt), unter ihr
    // 2 statt 8, über der zweiten 3,33 statt 7,33; zusammen 17,33 px (26 Bildpunkte) weniger.
    const weisseLinie = (key: string, oben = 22 / 3, unten = 8) => {
      if (isTerminal || !Svg) return <Text key={key} color="white">{'─'.repeat(Math.max(10, width))}</Text>
      const z = (v: number) => String(Math.round(v * 1e5) / 1e5)
      const hoehe = Number(z(oben + 2 / 3 + unten))
      return (
        <Svg
          key={key}
          alt="Divider"
          height={hoehe}
          source={`<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="${z(hoehe)}" viewBox="0 0 100 ${z(hoehe)}" preserveAspectRatio="none"><rect y="${z(oben)}" width="100" height="0.66667" fill="#FFFFFF"/></svg>`}
        />
      )
    }
    // Desktop-App: Higgsfield (und Cache, API-Kosten) passen nie mehr in die erste Zeile, darum fest eine eigene Zeile ohne Trennstrich
    const ownRow = (s: Segment) => s.label === 'Higgsfield' || s.label === CACHE_LABEL
    const guthaben = guthabenTeile(d.guthaben ?? [], await $.clock.now())
    // API-Kosten nicht in den farbigen Teilen, sondern grau ganz am Ende hinter dem Modell
    const costSeg = parts.find(s => s.label === COST_LABEL)
    const shown = parts.filter(s => s.label !== COST_LABEL)
    const rows = (isTerminal ? [shown] : [shown.filter(s => !ownRow(s)), shown.filter(ownRow)]).filter(row => row.length > 0)
    // Anordnung (Gestaltungsentscheid):
    //   Zeile mit den Kosten:  Higgsfield │ Cache │ Claude ● │ Opus 5.5 · Mittel │ API-Kosten (grau)
    //   System-Zeile:          Version/Update │ (⚑ Neue Aktion) │ 2 Chats │ Connectors
    // Jeder Teil kommt OHNE Trennstrich; withSeps setzt die Striche, egal welcher Teil wo steht.
    const costRow = rows.findIndex(row => row.some(s => ownRow(s)))
    const extraRow = costRow >= 0 ? costRow : rows.length - 1
    // Striche in festem neutralem Grau statt gedimmt: gedimmt mischt die App mit ihrer warmen Schriftfarbe, neben dem
    // Blau der Wetterzeile wirkte das beige (09.10.2026)
    const sepEl = (key: string) => (
      <Text key={key} color={STRICH_GRAU}>
        {' │ '}
      </Text>
    )
    const withSeps = (items: JSX.Element[], first: boolean) =>
      items.flatMap((el, i) => (i > 0 || !first ? [sepEl(`sep-${i}`), el] : [el]))
    // Kärtchen per Klick: schwebt ÜBER dem Namen (position absolute, nach oben, damit nichts unten abgeschnitten wird), verschiebt nichts (Aufklappen in der Zeile
    // liess die Leiste flackern). Ohne eigenen key: ein unsichtbarer Box mit key wäre selbst der Maus-Bereich, und
    // die App lehnt die ganze Leiste ab.
    // Einheitliches Aussehen aller Kärtchen (Vorgabe 09.10.2026): grauer Rahmen (nie farbig), graue
    // normale Schrift, Knöpfe darin gedimmt wie die Knopfzeile, so breit wie die längste Zeile (sonst bricht es nach
    // jedem Wort um, weil ein schwebender Kasten sonst nur so breit wie sein Wort in der Leiste ist).
    // rechts: am rechten Rand ausrichten (für die rechtsbündigen API-Kosten, sonst ragt das Kärtchen hinaus)
    // Höhe des offenen Kärtchens (Rahmen eingerechnet): reicht der Platz über seinem Wort nicht, kommen oben leere
    // Zeilen dazu, sonst schneidet die App das Kärtchen oben ab (09.10.2026)
    // Deckend (Vorgabe 15.10.2026): Anker ohne Grösse an der Oberkante des Worts, das Kärtchen sitzt darauf. Die App
    // malt eine absolute Box nur über das, was vor ihr kommt; ragte es in die eigene Zeile, lagen die Wörter rechts
    // davon darüber (wie im Sondermodus gesehen).
    let offenHoehe = 0
    const rahmen = (key: string, zeilen: string[], inhalt: JSX.Element[], rechts = false) => {
      const breite = Math.min(100, Math.max(20, ...zeilen.map(z => z.length)) + 4)
      if (offenesKaertchen === key) offenHoehe = zeilen.reduce((n, z) => n + Math.max(1, Math.ceil(z.length / (breite - 4))), 0) + 2
      const seite = rechts ? { right: 0 } : { left: 0 }
      return (
      <Box position="absolute" top={0} {...seite}>
        <Box
          position="absolute"
          bottom={0}
          {...seite}
          width={breite}
          display={offenesKaertchen === key ? 'flex' : 'none'}
          borderStyle="round"
          borderColor="gray"
          backgroundColor="#1A1A1A"
          paddingX={1}
          flexDirection="column"
        >
          {inhalt}
        </Box>
      </Box>
      )
    }
    // Klick auf den Text im Kärtchen schliesst es (09.10.2026); ohne Client-Element bleibt es Text
    const kText = (key: string, text: string) =>
      Client ? (
        <Client key={key} module="./farb-knopf.tsx" props={{ teile: [{ text, color: 'gray' }], aktion: 'kaertchen-zu' }} />
      ) : (
        <Text key={key} color="gray">
          {text}
        </Text>
      )
    const kKnopf = (key: string, label: string, onPress: () => void) => (
      <Button key={key} plain dimColor label={label} onPress={onPress} />
    )
    const card = (key: string, lines: string[], rechts = false) =>
      rahmen(key, lines, lines.map((l, i) => kText(`${key}-${i}`, l)), rechts)
    // Als Client-Text (farb-knopf.tsx), nicht als Knopf: die App gibt Knöpfen einen Innenabstand, dann standen
    // «API-Kosten» nicht bündig rechts und die Striche neben «Cloud $», «2 Chats» ungleich weit weg (09.10.2026)
    const klick = (key: string, label: string) =>
      Client ? (
        <Client key={`klick-${key}`} module="./farb-knopf.tsx" props={{ teile: [{ text: label, dim: true }], kaertchen: key }} />
      ) : (
        <Button key={`klick-${key}`} plain dimColor label={label} onPress={() => kaertchenUmschalten($, key)} />
      )
    // Farbiges anklickbares Wort ohne Pfeil (Vorgabe 09.10.2026: keine Zusatzzeichen, nur Farbe). Wo es kein
    // Client-Element gibt (VS Code, Handy), steht nur der farbige Text.
    type Teil = { text: string; color?: string; dim?: boolean; bold?: boolean }
    const farbKlick = (key: string, teile: Teil[]) =>
      Client ? (
        <Client key={`farb-${key}`} module="./farb-knopf.tsx" props={{ teile, kaertchen: key }} />
      ) : (
        <Text key={`farb-${key}`}>
          {teile.map((t, i) => (
            <Text key={`${key}-${i}`} color={t.color} dimColor={t.dim} bold={t.bold}>
              {t.text}
            </Text>
          ))}
        </Text>
      )
    const sys = sichereSystem(await read($, system))
    const st = sys.status

    // Zeile mit den Kosten: Anthropic-Status und Modell
    // App: Teile in natürlicher Breite, brechen nie in sich um (Vorgabe 14.10.2026); kürzen darf nur «Sitzung»
    const topItems: JSX.Element[] = [
      <Box key="sys-status" flexDirection="row" {...(!isTerminal ? { flexShrink: 0 } : {})}>
        {farbKlick('status', [
          { text: 'Claude ', color: ANTHROPIC_ORANGE },
          { text: '●', color: statusColor(st?.indicator) },
        ])}
        {/* Nur der farbige Punkt; Meldung und Störungen im Kärtchen, jede Störung anklickbar (öffnet ihre Seite) */}
        {(() => {
          const kopf = st ? `Anthropic status: ${st.description}` : 'Anthropic status unreachable'
          const keine = st && st.incidents.length === 0 ? 'No open incidents for the services you use' : undefined
          const stoerungen = (st?.incidents ?? []).map(i => ({ text: `• ${i.text}${i.link ? ' ↗' : ''}`, link: i.link }))
          const ignoriert = st?.ignoriert?.length ? `Not counted (not used): ${st.ignoriert.join(', ')}` : undefined
          const seite = 'Open status.claude.com ↗'
          const zeilen = [kopf, keine, ...stoerungen.map(s => s.text), ignoriert, seite].filter((z): z is string => !!z)
          return rahmen('status', zeilen, [
            kText('status-kopf', kopf),
            ...(keine ? [kText('status-keine', keine)] : []),
            ...stoerungen.map((s, n) =>
              s.link ? kKnopf(`stoerung-${n}`, s.text, () => void openLink($, s.link!)) : kText(`stoerung-${n}`, s.text),
            ),
            ...(ignoriert ? [kText('status-ignoriert', ignoriert)] : []),
            kKnopf('status-seite', seite, () => void openLink($, STATUS_PAGE)),
          ])
        })()}
      </Box>,
    ]
    if (sys.model) {
      topItems.push(
        <Box key="sys-model" flexDirection="row" {...(!isTerminal ? { flexShrink: 0 } : {})}>
          <Text color={ANTHROPIC_ORANGE}>{sys.model}</Text>
          {sys.effort ? <Text color={ANTHROPIC_ORANGE}>{` · ${sys.effort}`}</Text> : null}
        </Box>,
      )
    }
    // API-Kosten rechtsbündig in der System-Zeile (mit den Connectors), ohne Strich davor (09.10.2026); Zahlen in derselben
    // gedimmten Farbe wie das anklickbare Wort «API:»
    let kostenEl: JSX.Element | null = null
    if (costSeg) {
      kostenEl = (
        <Box key="api-kosten-rechts" flexGrow={1} justifyContent="flex-end">
        <Box key="api-kosten" flexDirection="row">
          {/* Wort und Zahlen als EIN Knopf: die App zeichnet Knöpfe in eigener Farbe, getrennter Text wich davon ab */}
          {privat ? <Text color="gray">{`${costSeg.label} `}</Text> : klick('kosten', `${costSeg.label} ${costSeg.value}`)}
          {privat ? <Text {...SCHWARZ}>{costSeg.value}</Text> : null}
          {privat ? null : card('kosten', [
            'API cost at list price, excluding VAT (your plan does not charge it on top):',
            '1. this chat since the start of the plan month (with subagents)',
            `2. project ${d.projectName ?? '…'} since the start of the plan month`,
            '3. all projects and chats since the start of the plan month, deleted chats included',
            ...(d.ohnePreis?.length ? [`Not counted (no price on file): ${d.ohnePreis.join(', ')}`] : []),
          ], true)}
        </Box>
        </Box>
      )
    }

    // System-Zeile: Version zuerst, dann Aktion, Chats, Connectors
    const bottomItems: JSX.Element[] = []
    if (sys.version) {
      const neuer = sys.latest !== undefined && compareVersion(sys.latest, sys.version) > 0
      bottomItems.push(
        <Box key="sys-version" flexDirection="row">
          {/* gleiches Element in beiden Zuständen, damit sich nur die Farbe ändert (grau → gelb), nicht die Grösse */}
          {/* nur «Update» ohne Nummer (Vorgabe 15.10.2026); die Versionen stehen im Kärtchen */}
          {neuer
            ? farbKlick('version', [{ text: 'Update', color: 'yellow' }])
            : farbKlick('version', [{ text: `v${sys.version}`, dim: true }])}
          {card('version', [
            `Claude Code ${sys.version} is running in this chat`,
            neuer
              ? `New: ${sys.latest}. Terminal: "claude update"; the app gets its version with the next app update.`
              : 'Up to date (source: npm, checked every 6 hours)',
          ])}
        </Box>,
      )
    }
    // Kurzname: Geld-Guthaben nummeriert («Guthaben 1») oder aus dem Feld kurz («Cloud $»), Gutscheine unter ihrem
    // Namen («Gratis-Reset»); grau, Angaben im orangen Kärtchen; ⚠ ohne Maus, wenn der Ablauf näher als 7 Tage ist.
    // Abgelaufene, aufgebrauchte und eingelöste («verbraucht»: true) fallen weg (guthabenTeile).
    let nummer = 0
    let lauf = 0
    for (const g of guthaben) {
      const kurz = g.kurz ?? (g.geld ? `Credit ${++nummer}` : g.name)
      // Schlüssel aus dem Laufindex, nicht aus dem Kurznamen: zwei gleiche Kurznamen ergäben zwei Clients mit
      // demselben key, und die Oberfläche verwürfe die ganze Leiste (09.10.2026)
      const k = `guthaben-${lauf++}`
      bottomItems.push(
        <Box key={k} flexDirection="row">
          {privat ? <Text {...SCHWARZ}>{kurz}</Text> : klick(k, kurz)}
          {g.warn ? <Text color="yellow"> ⚠</Text> : null}
          {privat ? null : card(k, [`${g.label} ${g.value}, ${g.note}`])}
        </Box>,
      )
    }
    if (sys.abgleich) {
      bottomItems.push(
        <Box key="abgleich" flexDirection="row">
          <Text color="yellow" bold>⚠ GitHub</Text>
          {privat ? null : card('abgleich', ['GitHub sync failing:', ...sys.abgleich])}
        </Box>,
      )
    }
    // Neue Aktion: Klick zeigt, was sich geändert hat, und bestätigt (Vorgabe 15.10.2026)
    const aktion = cfg.aktionen ? aktionAnzeige(d) : undefined
    if (aktion) {
      bottomItems.push(
        <Box key="neue-aktion" flexDirection="row">
          {farbKlick('aktion', [{ text: '⚑ New promotion', color: 'yellow', bold: true }])}
          {card('aktion', aktion)}
        </Box>,
      )
    }
    if (sys.chats) {
      const n = sys.chats.length
      bottomItems.push(
        <Box key="sys-chats" flexDirection="row">
          {privat ? <Text dimColor>{`${n} Chat${n === 1 ? '' : 's'}`}</Text> : klick('chats', `${n} Chat${n === 1 ? '' : 's'}`)}
          {/* Kärtchen: App-Chats anklickbar (springt hinein), dieser Chat und Konsolen-Chats nur zum Lesen;
              im Aufnahme-Modus kein Kärtchen (Chat-Titel nennen Projekte) */}
          {privat
            ? null
            : (() => {
                const zeilen = sys.chats.map(c => {
                  const text = `${c.isSelf ? '▸ ' : '  '}${c.name} (${c.where}, ${c.status})`
                  return { text: c.link && !c.isSelf ? `${text} ↗` : text, link: c.isSelf ? undefined : c.link }
                })
                return rahmen(
                  'chats',
                  zeilen.map(z => z.text),
                  zeilen.map((z, i) =>
                    z.link ? kKnopf(`chat-${i}`, z.text, () => void openLink($, z.link!)) : kText(`chat-${i}`, z.text),
                  ),
                )
              })()}
        </Box>,
      )
    }
    // Stelle der Connectors in der System-Zeile (für die zwei Spalten), −1 = keine; steht sie allein oder fehlt sie,
    // die alte Anordnung untereinander. Beim Einfügen gemerkt, weil ein JSX-Element seinen key nur in props trägt
    // (el.key war zur Laufzeit immer undefined, darum erschienen die zwei Spalten nie; 09.10.2026)
    let conIdx = -1
    if (sys.connectors) {
      const weg = sys.missing ?? []
      conIdx = bottomItems.length
      bottomItems.push(
        <Box key="sys-connectors" flexDirection="row">
          {weg.length
            ? privat
              ? <Text color="yellow" bold>⚠ Connector lost</Text>
              : farbKlick('connectors', [{ text: `⚠ Connector lost: ${weg.join(', ')}`, color: 'yellow', bold: true }])
            : privat ? <Text dimColor>Connectors ✓</Text> : klick('connectors', 'Connectors ✓')}
          {privat
            ? null
            : card('connectors', [
                ...sys.connectors.map(c => `✓ ${c}`),
                ...weg.map(c => `✗ ${c} (connected earlier in this session, now disconnected)`),
              ])}
        </Box>,
      )
    }
    // Vier schlanke Knöpfe auf einer eigenen Zeile unter der System-Zeile (seit 09.10.2026, ohne Strich nach den Connectors):
    // Sichern (Auftrag ins Eingabefeld), Übergabe (Skill /handoff) und Komprimieren (/compact, mit Rückfrage, weil es
    // den Verlauf zusammenfasst). Schlicht, gedimmt, voll sichtbar erst unter der Maus.
    // Zwei Teile: links die vier Knöpfe mit Strichen dazwischen, rechts «◉ Aufnahme» rechtsbündig (09.10.2026).
    // Als Text gezeichnet (farb-knopf.tsx), nicht als Knopf: die App gibt Knöpfen einen Innenabstand, dann begann
    // «✓ Sichern» nicht bündig mit der Zeile darüber (09.10.2026). Gedimmt, unter der Maus hell. Ohne Client-Element
    // (VS Code, Handy) gewöhnliche Knöpfe.
    const knopfListe: [string, string, string, () => void][] = [
      ['sichern', '✓ Save', 'knopf-sichern', () => void runSichern($)],
      ['uebergabe', '⇢ Handoff', 'knopf-uebergabe', () => void runHandoff($)],
      ['komprimieren', '⇲ Compact', 'knopf-komprimieren', () => void runCompact($)],
      ['neu', '+ New', 'knopf-neu', () => void runNewChat($, isTerminal)],
    ]
    const knoepfeLinks = (
      <Box key="knoepfe-links" flexDirection="row" flexWrap="wrap">
        {/* Striche zwischen den vier Knöpfen (Wunsch 09.10.2026) */}
        {knopfListe.flatMap(([aktion, label, key, onPress], i) => [
          i > 0 ? sepEl(`${key}-strich`) : null,
          Client ? (
            <Client key={key} module="./farb-knopf.tsx" props={{ teile: [{ text: label, color: KNOPF_GRAU }], aktion }} />
          ) : (
            <Button key={key} plain dimColor label={label} onPress={onPress} />
          ),
        ])}
      </Box>
    )
    // Schreibtempo vor «◉ Aufnahme», mit Strich dazwischen, in seinem Blau (Vorgabe 15.10.2026, vorher am Ende der
    // Astro-Zeile); ein Klick öffnet das Kärtchen. Es hängt am Zeilenende (rechtsbündig mit «◉ Aufnahme», wie das
    // API-Kärtchen), nicht am Wort: dort ragte es im Sondermodus links aus dem Band (Screenshot 15.10.2026)
    const tempoText = finite(tps) ? `${Math.round(tps)} t/s` : undefined
    const tempoEl = tempoText ? (
      <Box key="tempo" flexDirection="row" flexShrink={0}>
        {Client ? (
          <Client
            key="farb-tempo"
            module="./farb-knopf.tsx"
            props={{ teile: [{ text: '⚡ ', color: NIGHT_BLUE }, { text: tempoText, color: NIGHT_BLUE, bold: true }], kaertchen: 'tempo' }}
          />
        ) : (
          <Button key="klick-tempo" plain dimColor label={`⚡ ${tempoText}`} onPress={() => kaertchenUmschalten($, 'tempo')} />
        )}
      </Box>
    ) : null
    // «◉ Aufnahme» rechtsbündig, ohne Strich davor (Wunsch 09.10.2026); davor das Tempo
    const knoepfeRechts = (
      <Box key="knoepfe-rechts" flexDirection="row" flexGrow={1} justifyContent="flex-end">
        {tempoEl}
        {tempoEl ? sepEl('tempo-strich') : null}
        {tempoEl ? card('tempo', TEMPO_KARTE, true) : null}
        {/* Aufnahme: immer derselbe Text «◉ Aufnahme» in Weiss, nur der Punkt bei «an» rot (selbst gezeichnet in aufnahme-knopf.tsx, weil
            ein Button seine Schrift nicht färben kann); nichts dazuschreiben, nichts überlagern, damit sich nichts bewegt.
            Wo es kein Client-Element gibt (VS Code, Handy): Punkt als Text (an rot) vor einem Knopf «Aufnahme», der immer
            gleich bleibt (ein Button kann seine Schrift nicht färben) */}
        {Client ? (
          <Client key="knopf-aufnahme" module="./aufnahme-knopf.tsx" props={{ an: privat }} />
        ) : (
          <Box key="knopf-aufnahme" flexDirection="row">
            {privat ? <Text color="red">◉</Text> : <Text dimColor>◉</Text>}
            <Text dimColor>{' '}</Text>
            <Button key="knopf-aufnahme-text" plain dimColor label="Rec" onPress={() => void aufnahmeUmschalten($)} />
          </Box>
        )}
      </Box>
    )
    // Token-Total der Sitzung rechtsbündig, ohne Strich davor, gleiche Farbe wie die Aufgabe in der ⏱-Zeile
    // wird bei Enge am Ende gekürzt, statt die Zeile umzubrechen (Vorgabe 14.10.2026)
    const sitzungEl = (
      <Box key="sitzung-rechts" flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden" justifyContent="flex-end">
        <Text color={KNOPF_GRAU} wrap="truncate-end">{`  Session – ${tokenText(sitzungTokens)}`}</Text>
      </Box>
    )
    // Platz über dem Wort des offenen Kärtchens (Zeilen und weisse Linien der Leiste darüber); fehlt Platz, leere
    // Zeilen ganz oben (die Leiste wächst nach oben, ihre Zeilen bleiben stehen)
    const obenZeilen = (einblender ? 1 : 0) + (zielZeile ? 1 : 0) + (wache ? 1 : 0) + (isTerminal && (zielZeile || wache) ? 1 : 0)
    const zeilenUeber = (r: number) => obenZeilen + (isTerminal ? 1 + r : r < rows.length ? 1 + 2 * r : 2 * r)
    // Tempo-Kärtchen: eine Zeile tiefer (Knopfzeile unter der System-Zeile)
    const platzOben =
      offenesKaertchen === 'status'
        ? zeilenUeber(extraRow)
        : zeilenUeber(rows.length) + (offenesKaertchen === 'tempo' && (conIdx > 0 || bottomItems.length > 0 || kostenEl) ? 1 : 0)
    const fehlt = offenesKaertchen ? Math.max(0, offenHoehe - platzOben) : 0
    // kein Rahmen ums Ganze (07.10.2026 wieder entfernt; der Rahmen um die Vorschläge kommt von naechste-schritte)
    return (
      <Box flexDirection="column">
        {Array.from({ length: fehlt }, (_, i) => (
          <Text key={`kaertchen-platz-${i}`}> </Text>
        ))}
        {/* Einblender zuoberst (COMPUTER BEREIT bzw. ZWISCHENSCHRITT), in der App mit runden Ecken; die Luft darunter
            gibt die erste weisse Linie (4 px, 15.10.2026) */}
        {einblender ? einblenderZeile({ Box, Svg: isTerminal ? undefined : Svg }, Text, 'einblender', einblender, false, zusammen) : null}
        {/* Konsole: grauer Strich oben nur, wenn Ziel- oder Wächter-Zeile darüber stehen (die weisse Linie trennt sonst) */}
        {zielZeile || wache ? rule('oben') : null}
        {zielZeile ? (
          <Box key="ziel" flexDirection="row">
            {/* fett, damit es absticht (Schriftgrösse lässt sich in der Leiste nicht ändern); zwei Leerschläge nach dem Symbol.
                Füllt die ganze Breite und wird erst am Zeilenende gekürzt (Vorgabe 09.10.2026) */}
            {/* minWidth 0 und overflow hidden: sonst wird die Box in der App nie schmaler als ihr Text, und die Zeile
                läuft rechts über den Rand statt mit «…» zu enden (09.10.2026) */}
            <Box flexShrink={1} minWidth={0} overflow="hidden">
              <Text color="white" wrap="truncate-end">{`---> ${zs.goal ? '/goal: ' : ''}${zielZeile.ziel}`}</Text>
            </Box>
            {zielZeile.gesamt ? (
              <Text wrap="truncate-end">
                <Text dimColor>{'  ·  '}</Text>
                <Text color="green" bold>{bar(((zielZeile.erledigt ?? 0) / zielZeile.gesamt) * 100, 5)}</Text>
                <Text color={ANTHROPIC_ORANGE} bold>{` ${zielZeile.erledigt ?? 0}/${zielZeile.gesamt}`}</Text>
              </Text>
            ) : null}
            {zielZeile.jetzt ? <Text color="gray">{`  ·  now: ${zielZeile.jetzt}`}</Text> : null}
            {zielZeile.runden ? <Text color="gray">{`  ·  Round ${zielZeile.runden}`}</Text> : null}
          </Box>
        ) : null}
        {zielZeile && wache ? luft('luft-wache') : null}
        {wache ? (
          <Box key="waechter" flexDirection="row" justifyContent="space-between">
            {/* Text wird am Ende gekürzt, damit Ein/Aus nie in die nächste Zeile rutscht (Vorgabe 09.10.2026) */}
            <Box flexShrink={1} minWidth={0} overflow="hidden">
              <Text color={wache.lang ? 'yellow' : 'gray'} wrap="truncate-end">{`⏱  ${wache.text}`}</Text>
            </Box>
            {/* Tokens der Aufgabe rechtsbündig; Platz von Anfang an für die grösstmöglichen Zahlen reserviert, damit
                wachsende Zahlen den Text links nicht nochmals kürzen */}
            <Box flexGrow={1} flexShrink={0} minWidth={TOKEN_PLATZ} justifyContent="flex-end">
              <Text color={KNOPF_GRAU}>{`  ${tokenText(aufgabeTokens)}`}</Text>
            </Box>
          </Box>
        ) : null}
        {weisseLinie('linie-weiss', 4, 2)}
        {/* zwischen der ctx-Zeile und der Higgsfield-Zeile (nur App; die Konsole hat eine einzige Zeile) */}
        {rows.flatMap((row, r) => [
          r > 0 ? weisseLinie(`linie-zeile${r}`, 10 / 3, 8) : null,
          // App: jede Zeile bleibt eine Zeile (Vorgabe 14.10.2026), die Konsole bricht ihre eine lange Zeile weiter um
          <Box key={`zeile${r}`} flexDirection="row" flexWrap={isTerminal ? 'wrap' : 'nowrap'}>
            {/* Striche als eigenes Element wie in der System-Zeile: in den farbigen Text geschachtelt nahm die App
                dessen Farbe an (bräunlich statt grau, 09.10.2026) */}
            {row.map((s, i) => [
              // App, Zeile Ctx │ 5h │ Woche: Teile in natürlicher Breite (brechen nie in sich um), erster ganz links,
              // letzter ganz rechts; jeder Strich steht mittig im dehnbaren Zwischenraum zwischen zwei Teilen
              // (Vorgabe 09.10.2026)
              i > 0
                ? !isTerminal && r !== extraRow && row.length > 1
                  ? (
                      <Box key={`sep-zeile${r}-${i}`} flexGrow={1} justifyContent="center">
                        {sepEl(`sep-zeile${r}-${i}-strich`)}
                      </Box>
                    )
                  : sepEl(`sep-zeile${r}-${i}`)
                : null,
              <Box key={s.label} {...(!isTerminal && (r === extraRow || row.length > 1) ? { flexShrink: 0 } : {})}>
              <Text>
                {/* «Ctx:», «5h:», «7T:» (Vorgabe 09.10.2026) */}
                <Text color={s.labelColor}>{s.label === 'ctx' ? 'Ctx:' : s.label === '5h' || s.label === '7D' ? `${s.label}:` : s.label}{s.label === CACHE_LABEL ? '' : ' '}</Text>
                {geschwaerzt(s) ? (
                  <Text {...SCHWARZ}>{`${s.bar ? `${s.bar} ` : ''}${s.value}${s.suffix ?? ''}`}</Text>
                ) : (
                  <Text>
                    {s.bar ? <Text color={s.color} bold>{s.bar} </Text> : null}
                    <Text color={s.labelColor} bold>{s.value}</Text>
                    {s.suffix ? (s.suffixColor ? <Text color={s.suffixColor}>{s.suffix}</Text> : <Text dimColor>{s.suffix}</Text>) : null}
                  </Text>
                )}
                {s.note ? <Text dimColor> {s.note}</Text> : null}
              </Text>
              </Box>,
            ])}
            {r === extraRow ? withSeps(topItems, row.length === 0) : null}
            {r === extraRow ? sitzungEl : null}
          </Box>,
        ])}
        {luft('luft-system')}
        {conIdx > 0 ? (
          // zwei Spalten: links System-Teile bis vor Connectors und darunter die vier Knöpfe, rechts «│ Connectors» und
          // darunter «│ ◉ Aufnahme»; die linke Spalte ist so breit wie ihr breiterer Teil, darum stehen die Striche
          // auch bei proportionaler Schrift (App) genau untereinander
          <Box key="system-knoepfe" flexDirection="row">
            <Box key="spalte-links" flexDirection="column" flexShrink={1}>
              <Box key="system" flexDirection="row" flexWrap={isTerminal ? 'wrap' : 'nowrap'}>
                {withSeps(bottomItems.slice(0, conIdx), true)}
              </Box>
              {luft('luft-knoepfe-links')}
              {knoepfeLinks}
            </Box>
            <Box key="spalte-rechts" flexDirection="column" flexGrow={1}>
              {/* API-Kosten rechtsbündig in der Zeile mit den Connectors, das Sitzungstotal oben in der Zeile mit
                  dem Modell (Wunsch 09.10.2026) */}
              <Box key="system-rechts" flexDirection="row">
                {sepEl('sep-connectors')}
                {bottomItems[conIdx]}
                {kostenEl}
              </Box>
              {/* 4 px mehr Abstand zur Knopfzeile, in beiden Spalten gleich, damit die Striche untereinander bleiben */}
              {luft('luft-knoepfe-rechts')}
              {knoepfeRechts}
            </Box>
          </Box>
        ) : (
          <Box key="system-knoepfe" flexDirection="column">
            {bottomItems.length > 0 || kostenEl ? (
              <Box key="system" flexDirection="row" flexWrap={isTerminal ? 'wrap' : 'nowrap'}>
                {withSeps(bottomItems, true)}
                {kostenEl}
              </Box>
            ) : null}
            {luft('luft-knoepfe')}
            <Box key="knoepfe" flexDirection="row" flexWrap="wrap">
              {knoepfeLinks}
              {knoepfeRechts}
            </Box>
          </Box>
        )}
        {nightRows.some(row => row.length > 0) ? rule('mitte') : null}
        {nightRows.some(row => row.length > 0) ? luft('luft-nacht') : null}
        {nightRows.map((row, r) =>
          row.length > 0 ? (
            <Box key={`nacht${r}`} flexDirection="row" flexWrap={isTerminal ? 'wrap' : 'nowrap'}>
              {row.map((p, i) => [
                // Wetter-/Astro-Zeile: Strich wie in den übrigen Zeilen, aber im Blau der Wörter (Wunsch 09.10.2026).
                // App: über die ganze Breite verteilt, erster Teil links, letzter rechts, Striche mittig in den
                // dehnbaren Lücken (Vorgabe 09.10.2026)
                i > 0 ? (
                  <Box key={`sep-nacht${r}-${i}`} {...(!isTerminal ? { flexGrow: 1, justifyContent: 'center' } : {})}>
                    <Text color={NIGHT_BLUE}>{' │ '}</Text>
                  </Box>
                ) : null,
                <Box key={p.label} {...(!isTerminal ? { flexShrink: 0, alignItems: 'center' as const } : {})}>
                  {/* Zeichen statt Wort (Vorgabe 14.10.2026), Mond in der App als Bild */}
                  {sensorTeil(Text, e.surface === 'desktop' ? Svg : undefined, p, NIGHT_BLUE, p.color)}
                </Box>,
              ])}
            </Box>
          ) : null,
        )}
        {/* Abschluss nach der Astro-Zeile (Himmel, Wetter, Stream-Tempo) */}
        {weisseLinie('linie-ende')}
        {/* was andere Mods hier zeichnen (z. B. naechste-schritte), darunter */}
        {below}
      </Box>
    )
  }).catch(async ($, e, next) => {
    // Zeichnen fehlgeschlagen: ohne Handler fehlte die ganze Leiste (Typdatei: «without it a failed hook is absent»).
    // Darum eine Minimalzeile statt nichts, der Grund ins Debug-Protokoll, das Darunterliegende bleibt (09.10.2026)
    $.ui.log(`Cockpit: drawing failed: ${next.error.message ?? next.error.kind}`, { to: 'debug' })
    const { Box, Text } = $.ui.resolve(e)
    const below = await next(e)
    return (
      <Box flexDirection="column">
        <Text color="red">Cockpit: drawing failed</Text>
        {below}
      </Box>
    )
  })
}
