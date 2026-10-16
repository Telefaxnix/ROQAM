// Sondermodus-Ansicht (Easter Egg): Farben der farbigen Konsole über der Eingabe, die
// Umrechnung der Farben, die die Rechnungen des Cockpits liefern (green/yellow/red, Anthropic-Orange, Nachtblau), und
// die runden Ecken der Farbflächen. Ein Designsystem für Leiste, Chat-Rahmen und Kärtchen.

// Cockpit-Orange der Beschriftungen Ctx, 5h und Woche (claude.ai --cds-text-danger): ersetzt das grelle Orange
// #FF9C00 und das Pfirsich #FF9966, die in der App blendeten (Vorgabe 14.10.2026); volle Deckkraft
const COCKPIT_ORANGE = '#EC7E7E'

export const SONDERMODUS = {
  orange: COCKPIT_ORANGE,
  gold: '#FFCC66',
  tan: '#FFCC99',
  flieder: '#CC99CC',
  lavendel: '#9999CC',
  blau: '#9999FF',
  alarm: '#FF3333',
  // Schrift auf farbigen Flächen
  schwarz: '#000000',
  // gewöhnlicher Inhalt (Wächter, Kärtchen-Links, Tokens)
  hell: '#C8C8D8',
  weiss: '#F5F6FA',
  // senkrechte Trennstriche, überall gleich
  strich: '#77779A',
  // Kärtchen: schwarzer Grund, Rahmen und Schrift
  kartenGrund: '#000000',
  kartenRahmen: '#CC99CC',
  kartenSchrift: '#FFCC99',
} as const

// Ampel im Sondermodus-Tönen: gut, Warnung, kritisch
export const AMPEL = { gut: '#88CC88', warnung: '#FFCC66', kritisch: '#FF5555', aus: '#9A9AAA' } as const

// Farben aus den Rechnungen des Cockpits (segments, cacheSegment, nightParts, statusColor …) auf Sondermodus umsetzen.
// Bekannte Namen und Hausfarben werden ersetzt, alle übrigen Hexwerte (Seeing-Verlauf) bleiben.
export function sondermodusFarbe(farbe: string | undefined, zeile?: string): string | undefined {
  if (farbe === undefined) return undefined
  switch (farbe.toLowerCase()) {
    case 'green':
      return AMPEL.gut
    case 'yellow':
      return AMPEL.warnung
    case 'red':
      return AMPEL.kritisch
    case 'gray':
    case 'grey':
      return AMPEL.aus
    case 'white':
      return SONDERMODUS.weiss
    // Anthropic-Orange (Beschriftungen und Kontext-Warnung ab 60 %): Beschriftung in der Zeilenfarbe, sonst Orange
    case '#ec7e7e':
      return zeile ?? SONDERMODUS.orange
    // Higgsfield-Lime und Nachtblau: Wort und Zahl in der Zeilenfarbe
    case '#d1fe17':
    case '#3176c9':
      return zeile ?? SONDERMODUS.blau
    default:
      return farbe
  }
}

// Unter der Maus heller: Hex 40 % zu Weiss hin gemischt (wie farb-knopf.tsx, nur aufhellen)
export function aufhellen(farbe: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(farbe)
  const hex = m?.[1]
  if (!hex) return farbe
  const n = parseInt(hex, 16)
  const mix = (v: number) => Math.round(v + (255 - v) * 0.4).toString(16).padStart(2, '0')
  return `#${mix(n >> 16)}${mix((n >> 8) & 255)}${mix(n & 255)}`.toUpperCase()
}

// Runde Ecken der Farbflächen (nur App, Vorgabe 14.10.2026): Eine Box kennt keinen Radius. Darum liegt hinter dem
// Inhalt eine Ebene aus drei Teilen: oben ein Eckstück, in der Mitte die Fläche, unten ein Eckstück. Die Eckstücke sind
// kleine Vektorbilder, so breit wie die Fläche, ECKE_RADIUS hoch, und zeigen die obere bzw. untere Hälfte eines
// Rechtecks mit abgerundeten Ecken. Der Radius bleibt in Pixeln gleich, wie breit die Fläche auch ist, und die Schrift
// liegt darüber, abgeschnitten wird nichts. Die Konsole kennt keine Vektorbilder und zeichnet eckig.
export const ECKE_RADIUS = 4
export const ECKE_ALT = 'Corner'
// nurLinks: rechts eckig, damit die Taste bündig an ihren Balken stösst (CTX, 5H, WOCHE; Vorgabe 15.10.2026). Eine
// zweite, eckige Fläche deckt die rechte Hälfte des abgerundeten Rechtecks ab.
export function eckeSvg(farbe: string, unten: boolean, nurLinks = false): string {
  const r = ECKE_RADIUS
  const y = unten ? ` y="-${r}"` : ''
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="${r}">` +
    `<rect${y} width="100%" height="${2 * r}" rx="${r}" ry="${r}" fill="${farbe}"/>` +
    (nurLinks ? `<rect x="50%"${y} width="50%" height="${2 * r}" fill="${farbe}"/>` : '') +
    `</svg>`
  )
}

// ── Ressourcen-Anzeige Ctx, 5h, Woche (Variante B, Wahl 14.10.2026): Taste mit dem Wort (schwarz auf Orange), daran
// ein Füllbalken mit runder Kappe rechts, dahinter Zahl und Restzeit; keine Striche dazwischen ──
// Spur = dunkles Orange (der leere Teil des Balkens)
export const BALKEN_SPUR = '#5A3434'
// So hoch wie die Tasten CTX/5H/WOCHE daneben: eine Textzeile der App. Ein Guss (Vorgabe Dominik 14.10.2026).
// Gemessen 15.10.2026 an zwei Bildschirmfotos (150 %): Die Zeilen der Tafel sind abwechselnd 28 und 29 Bildpunkte hoch,
// Teilung im Mittel 34,5 = (19 + 4 Fuge) × 1,5. Die Taste ist also 19 CSS-px hoch und rundet je nach Lage auf 28 oder 29.
// Gleich hoch rundet der Balken an derselben Stelle gleich (19,5 stand 1 Bildpunkt über, 18,67 einen darunter).
export const BALKEN_HOEHE = 19
// App: Balken als Vektorbild, so breit wie sein Platz (width 100 %, ohne viewBox, damit die Kappe rund bleibt,
// wie breit der Balken auch wird); links eckig an der Taste, rechts halbrund. Füllung in der Ampelfarbe.
export function fuellBalkenSvg(prozent: number, farbe: string, spur = BALKEN_SPUR): string {
  const h = BALKEN_HOEHE
  const p = Number.isFinite(prozent) ? Math.max(0, Math.min(100, prozent)) : 0
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="${h}">` +
    `<clipPath id="kappe"><rect width="100%" height="${h}" rx="${h / 2}" ry="${h / 2}"/><rect width="50%" height="${h}"/></clipPath>` +
    `<g clip-path="url(#kappe)"><rect width="100%" height="${h}" fill="${spur}"/>` +
    `<rect width="${Math.round(p * 10) / 10}%" height="${h}" fill="${farbe}"/></g></svg>`
  )
}
// Konsole (kein Vektorbild): Balken aus vollen Blöcken, gefüllt in der Ampelfarbe, Rest in der Spur
export function fuellBalkenZeichen(prozent: number, breite: number): { voll: string; rest: string } {
  const p = Number.isFinite(prozent) ? Math.max(0, Math.min(100, prozent)) : 0
  const n = Math.max(0, Math.round(breite))
  const voll = Math.max(0, Math.min(n, Math.round((p / 100) * n)))
  return { voll: '█'.repeat(voll), rest: '█'.repeat(n - voll) }
}

// Geheimwort (Vorgabe Dominik 14.10.2026): Der Sondermodus hat keinen Befehl und steht in keiner Liste. Man schickt ein
// Wort als eigene Nachricht; verglichen wird nur seine Prüfsumme (FNV-1a, 32 bit), das Wort selbst steht nirgends im
// Code. Wer es kennt, schaltet um; erraten lässt es sich mit etwas Wissen über das Vorbild der Farben.
export const SONDERMODUS_KEY = 'sondermodus'
export const GEHEIM_PRUEFSUMME = 0x22882747
export function pruefsumme(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}
// Nachricht nur aus dem Wort (Gross-/Kleinschreibung und Leerraum am Rand egal) → das Wort klein, sonst undefined
export function geheimwort(text: string, summe = GEHEIM_PRUEFSUMME): string | undefined {
  const w = text.trim().toLowerCase()
  if (w.length < 2 || w.length > 16 || /\s/.test(w)) return undefined
  return pruefsumme(w) === summe ? w : undefined
}
// Meldung beim Umschalten, aus dem geschickten Wort gebaut
export function sondermodusMeldung(wort: string, an: boolean): string {
  const name = wort.toUpperCase()
  return an ? `${name} on. Applies to all chats until you send ${wort} again.` : `${name} off, back to the cockpit.`
}

// ── Einblender (Vorgabe 14.10.2026), im Cockpit und im Sondermodus gleich ──
// Ist eine Aufgabe wirklich fertig (Antwort zu Ende, kein Hintergrund-Agent mehr), steht zuoberst im Band über der
// Eingabe und am Ende der letzten Antwort «COMPUTER BEREIT – WARTET AUF IHRE EINGABE». Fragt Claude mitten in der
// Arbeit etwas (Rückfrage, Plan-Freigabe, Wächter), steht dort «ZWISCHENSCHRITT»: die Antwort setzt die laufende
// Aufgabe fort, nichts bricht ab. Anrede «Ihre» (Vorgabe 14.10.2026).
export type Einblender = 'bereit' | 'zwischenschritt'
export const EINBLENDER_TEXT: Record<Einblender, string> = {
  bereit: 'COMPUTER READY – AWAITING YOUR INPUT',
  zwischenschritt: 'INTERMEDIATE STEP – YOUR ANSWER CONTINUES THE CURRENT TASK',
}
// Grün = fertig, Gold = Zwischenschritt (Töne der Sondermodus-Ampel); Schrift schwarz
export const EINBLENDER_FARBE: Record<Einblender, string> = { bereit: AMPEL.gut, zwischenschritt: SONDERMODUS.gold }
// Ausserhalb des Sondermodus (Vorgabe Dominik 14.10.2026): «CLAUDE BEREIT» auf hellem Grau, blendet nicht, schwarze
// Schrift bleibt gut lesbar; «COMPUTER BEREIT» in Grün gehört zum freigeschalteten Sondermodus (Geheimwort)
export const EINBLENDER_GRAU = '#BBBBBB'
export const CLAUDE_BEREIT = 'CLAUDE READY'
// Wort vor dem Aufnahme-Symbol ◉ im Sondermodus (Vorgabe 15.10.2026; im Cockpit heisst es weiter «◉ Aufnahme»)
export const AUFNAHME_WORT = 'REC'
export function einblenderText(art: Einblender, sondermodus: boolean): string {
  return art === 'bereit' && !sondermodus ? CLAUDE_BEREIT : EINBLENDER_TEXT[art]
}
export function einblenderFarbe(art: Einblender, sondermodus: boolean): string {
  return art === 'bereit' && !sondermodus ? EINBLENDER_GRAU : EINBLENDER_FARBE[art]
}

// Was gerade gilt: arbeitet, Hintergrund-Agenten laufen noch, wartet auf eine Antwort (Rückfrage, Zwischenschritt)
// oder ist fertig und erwartet die nächste Eingabe. phase = gespeicherter Stand, arbeitet = der Wächter zählt eine
// Antwort (Rückfrage geht vor).
export type Stand = 'start' | 'arbeitet' | 'hintergrund' | 'frage' | 'bereit'
export function standAus(phase: string | undefined, arbeitet: boolean): Stand {
  if (phase === 'frage') return 'frage'
  if (arbeitet) return 'arbeitet'
  if (phase === 'hintergrund') return 'hintergrund'
  return phase === 'bereit' ? 'bereit' : 'start'
}
export function einblenderFuer(stand: Stand): Einblender | undefined {
  return stand === 'frage' ? 'zwischenschritt' : stand === 'bereit' ? 'bereit' : undefined
}

// Letzter Textblock einer fertigen Antwort: der Schluss der Antwort (die letzten 200 Zeichen ohne Leerraum am Rand)
// wird beim Ende gemerkt; ein Block gehört dazu, wenn er so endet (kürzerer Block: der Schluss endet mit ihm)
export const SCHLUSS_ZEICHEN = 200
export function schlussVon(text: string): string {
  return text.trim().slice(-SCHLUSS_ZEICHEN)
}
export function istSchlussBlock(text: string, schluss: string | undefined): boolean {
  const b = text.trim()
  if (!schluss || b === '') return false
  return b.length >= SCHLUSS_ZEICHEN ? b.slice(-SCHLUSS_ZEICHEN) === schluss : schluss.endsWith(b)
}

export function fussZeile(stand: Stand, privat = false): { block: string; text: string; farbe: string } {
  switch (stand) {
    case 'arbeitet':
      return { block: 'ACTIVE', text: 'CLAUDE WORKING', farbe: SONDERMODUS.lavendel }
    case 'hintergrund':
      return { block: 'ACTIVE', text: 'BACKGROUND AGENTS WORKING', farbe: SONDERMODUS.lavendel }
    case 'frage':
      return { block: 'QUESTION', text: EINBLENDER_TEXT.zwischenschritt, farbe: SONDERMODUS.alarm }
    case 'bereit':
      return { block: 'READY', text: privat ? 'COMPUTER READY' : EINBLENDER_TEXT.bereit, farbe: SONDERMODUS.gold }
    default:
      return { block: 'READY', text: 'AWAITING YOUR INPUT', farbe: SONDERMODUS.blau }
  }
}

// Eigene Eingaben (Rahmen «EINGABE»): was du selbst geschickt hast, am PC, übers Handy (Bridge) oder ein SDK.
// Nachrichten anderer Sitzungen, Aufgaben-Meldungen, Kanäle und geplante Aufträge behalten das Aussehen der App.
export const EIGENE_HERKUNFT = ['composer', 'bridge', 'sdk', 'unclassified'] as const

export function istEigeneEingabe(kind: string, hatAbsender: boolean, hatAufgabe: boolean): boolean {
  return !hatAbsender && !hatAufgabe && (EIGENE_HERKUNFT as readonly string[]).includes(kind)
}

// Werkzeuge, die auf dich warten: Frage an dich, Plan zur Freigabe
export const FRAGE_WERKZEUGE = ['AskUserQuestion', 'ExitPlanMode'] as const

// Kopfzeilen der Chat-Rahmen; Rückfrage mitten in der Arbeit = Zwischenschritt, sonst (z. B. «Komprimieren?» über den
// Knopf) eine gewöhnliche Rückfrage
export const WORT_EINGABE = 'INPUT'
export const WORT_AUSGABE = 'OUTPUT'
export const WORT_FRAGE = 'QUESTION · YOUR ANSWER'
export const WORT_ZWISCHENSCHRITT = 'INTERMEDIATE STEP · QUESTION · YOUR ANSWER CONTINUES THE CURRENT TASK'

// Blinkendes rotes Feld neben dem Wort «Rückfrage» (nur App; SMIL braucht isInteractive)
export const BLINKEN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="44" height="12" viewBox="0 0 44 12">' +
  '<rect x="0" y="1" width="18" height="10" rx="2" fill="#FF3333"><animate attributeName="opacity" values="1;0.15;1" dur="1.2s" repeatCount="indefinite"/></rect>' +
  '<rect x="22" y="1" width="22" height="10" rx="2" fill="#CC6666"><animate attributeName="opacity" values="0.15;1;0.15" dur="1.2s" repeatCount="indefinite"/></rect>' +
  '</svg>'

// Ton (nur Sondermodus) zusammen mit dem Einblender «COMPUTER BEREIT», wenn die Aufgabe mindestens 20 s lief und nicht
// selbst abgebrochen wurde
export const BEREIT_TON_AB_MS = 20 * 1000
export function bereitTon(grund: string | undefined, ms: number): boolean {
  return grund !== 'aborted' && ms >= BEREIT_TON_AB_MS
}
