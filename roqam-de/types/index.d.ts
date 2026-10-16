export type StatusleisteData = {
  credits?: number
  fiveHour?: number
  fiveHourResetsAt?: string
  week?: number
  weekResetsAt?: string
  ctx?: number
  // Ende der letzten Antwort im Hauptchat (ms), Start der Cache-Stunde
  cacheAt?: number
  // Kosten der Sitzung zum API-Listenpreis (US-Dollar, Claude Codes eigene Summe) und Tageskurs USD→CHF
  costUsd?: number
  usdChf?: number
  // API-Kosten aller Claude-Code-Sitzungen seit Beginn des Abo-Monats (US-Dollar) und dieser Beginn (ms)
  periodUsd?: number
  periodSince?: number
  // dasselbe nur für das Projekt dieses Chats (Ordner unter ~/.claude/projects) und dessen Name
  projectUsd?: number
  // dasselbe nur für diesen Chat (aus dem Kostenbuch; fehlt, solange das Buch den Chat nicht kennt)
  chatUsd?: number
  projectName?: string
  // Modelle ohne Preis in kosten.ts: ihre Antworten fehlen in den Summen
  ohnePreis?: string[]
  // Guthaben und Gutscheine mit Ablaufdatum aus ~/.claude/statusleiste-guthaben.json (nur wenn die Datei existiert);
  // verbraucht: eingelöst, wird nicht mehr gezeigt
  guthaben?: { name: string; kurz?: string; rest?: number; total?: number; einheit?: string; ablauf: string; verbraucht?: boolean }[]
  // eine Aktion von Anthropic hat sich geändert, noch nicht bestätigt (Klick auf «⚑ Neue Aktion» oder /aktion-gesehen);
  // aktionZeilen: was sich geändert hat, fürs Kärtchen. Guthaben zeigt die Leiste seit 15.10.2026 nicht mehr
  neueAktion?: boolean
  aktionSig?: string
  aktionZeilen?: string[]
}

export type StatusleisteNacht = {
  start?: number
  end?: number
  offset?: number
  moon?: number
  isWaxing?: boolean
  cloud?: number
  seeing?: number
  level?: 'gut' | 'mässig' | 'bewölkt' | 'keine'
}

// Aktuelles Wetter am eingestellten Ort (Open-Meteo)
export type StatusleisteWetter = {
  temp?: number
  dewPoint?: number
  hum?: number
}

// Stream-Tempo der letzten Modellanfrage im Hauptchat: Ausgabe-Tokens je Sekunde
export type StatusleisteTempo = {
  tps?: number
}

// System-Zeile: Anthropic-Status, Modell, Version, offene Chats, Connectors
export type StatusleisteSystem = {
  // incidents: offene Störungen, link = Seite der Störung auf status.claude.com
  // ignoriert: gestörte Dienste, die Claude Code mit dem Abo nicht braucht (z. B. Console); färben den Punkt nicht
  status?: { indicator: string; description: string; incidents: { text: string; link?: string }[]; ignoriert?: string[] }
  model?: string
  effort?: string
  version?: string
  latest?: string
  // link: App-Chats lassen sich über claude://claude.ai/epitaxy/<hostSessionId> öffnen (Konsolen-Chats nicht)
  chats?: { name: string; where: string; status: string; isSelf: boolean; link?: string }[]
  connectors?: string[]
  missing?: string[]
  // GitHub-Abgleich gestört: Zeilen fürs Kärtchen (sonst undefined, dann keine Anzeige)
  abgleich?: string[]
}

// Wächter: läuft gerade eine Antwort, welche Schritte laufen (bei parallelen Aufrufen mehrere, id = tool_use_id),
// welcher war zuletzt (Zeiten in ms)
export type StatusleisteWaechter = {
  seit?: number
  turnId?: string
  laufend?: { id: string; was: string; seit: number }[]
  letzter?: { was: string; ende: number }
}

// Ziel-Anzeige: Ziel aus dem Auftrag (kleines Modell), /goal mit Runden, Claudes Aufgabenliste
export type StatusleisteZiel = {
  ziel?: string
  goal?: string
  runden?: number
  aufgaben?: { id: string; text: string; aktiv?: string; status: 'pending' | 'in_progress' | 'completed' }[]
}

// Aufnahme-Modus: von Hand eingeschaltet oder Aufnahmeprogramm läuft
export type StatusleisteAufnahme = { hand?: boolean; programm?: string; aus?: boolean }

// Sondermodus-Ansicht (Easter Egg): an = eingeschaltet (im $.store, gilt in allen Chats bis zum Ausschalten)
export type SondermodusSchalter = { an?: boolean }

// /stars: aus = Himmel und Wetter ausgeblendet (im $.store, gilt in allen Chats bis zum nächsten /stars)
export type SterneSchalter = { aus?: boolean }

// Stand der Arbeit für Einblender und Sondermodus-Fusszeile: arbeitet, Hintergrund-Agenten laufen noch, Rückfrage offen
// (Zwischenschritt), fertig (Computer bereit); seit = Beginn der Antwort (ms), dauer = Länge der letzten Antwort (ms),
// schluss = Schluss der fertigen Antwort (findet ihren letzten Block im Chat)
export type SondermodusPhase = { stand?: 'arbeitet' | 'hintergrund' | 'frage' | 'bereit'; seit?: number; dauer?: number; schluss?: string }

declare module 'claude-code' {
  interface PluginState {
    'roqam-de': {
      data: StatusleisteData
      nacht: StatusleisteNacht
      wetter: StatusleisteWetter
      tempo: StatusleisteTempo
      system: StatusleisteSystem
      waechter: StatusleisteWaechter
      ziel: StatusleisteZiel
      aufnahme: StatusleisteAufnahme
      sondermodus: SondermodusSchalter
      phase: SondermodusPhase
      sterne: SterneSchalter
    }
  }
}
