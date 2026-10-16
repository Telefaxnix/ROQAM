// Nacht-Ampel für den eingestellten Ort (Standard Zürich, im Mod aus der Einstellung «Ort»):
// astronomische Dunkelheit (Sonne unter −18°), Mondbeleuchtung, Wolken von Open-Meteo, Seeing von 7Timer.

import type { StatusleisteNacht } from '../types'

export const LAT = 47.3769
export const LON = 8.5417
export function forecastUrl(lat = LAT, lon = LON): string {
  return `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=cloud_cover&timezone=auto&forecast_days=3`
}

// 7Timer «astro»: alle 3 Stunden Seeing 1 (unter 0,5″, sehr ruhig) bis 8 (über 2,5″, sehr unruhig), kostenlos
export function seeingUrl(lat = LAT, lon = LON): string {
  return `https://www.7timer.info/bin/api.pl?lon=${lon}&lat=${lat}&product=astro&output=json`
}

export type SeeingForecast = { init: string; dataseries: { timepoint: number; seeing: number }[] }

// 7Timer-Antwort prüfen: nur mit init (Text) und dataseries (Liste), sonst undefined — eine 200-Antwort in fremder Form darf nicht werfen
export function parseSeeing(text: string): SeeingForecast | undefined {
  try {
    const s = JSON.parse(text)
    return typeof s?.init === 'string' && Array.isArray(s.dataseries) ? (s as SeeingForecast) : undefined
  } catch {
    return undefined
  }
}

// Mittleres Seeing (1–8) über die dunkle Zeit; init = Startzeit UTC als JJJJMMTTHH
export function seeingDuring(f: SeeingForecast, start: number, end: number): number | undefined {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})$/.exec(f.init)
  if (!m) return undefined
  const base = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]))
  const values = f.dataseries
    .filter(d => {
      const at = base + d.timepoint * 3600000
      return at + 3 * 3600000 > start && at < end && d.seeing >= 1 && d.seeing <= 8
    })
    .map(d => d.seeing)
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : undefined
}

// Elf Stufen von grün über gelb nach rot, Gelb genau in der Mitte (Stufe 5; Vorgabe 14.10.2026: mindestens zehn,
// ungerade Zahl)
export const STEPS = ['#00C853', '#34D03F', '#64DD17', '#9BE30C', '#CCE806', '#FFEA00', '#FFC400', '#FF9F00', '#FF7A00', '#FF4D00', '#D50000']
const LETZTE = STEPS.length - 1
const GELB = LETZTE / 2

export function seeingColor(seeing: number | undefined): string {
  if (seeing === undefined) return 'gray'
  const i = Math.round(((Math.min(8, Math.max(1, seeing)) - 1) / 7) * LETZTE)
  return STEPS[i]
}

// Himmels-Ampel für den Punkt vorne in der Astro-Zeile (Vorgabe 14.10.2026: grün nur, wenn sich Rausschauen lohnt).
// Aus allen Werten der Astro-Zeile (Vorgabe 14.10.2026, nicht nur Wolken und Seeing): Jeder Wert ergibt eine Stufe
// 0–10, die schlechteste bestimmt die Farbe, die übrigen schieben sie etwas weiter Richtung Rot (15 % ihrer Summe).
//   Wolken     0 % → 0, 100 % → 10: allein bis Rot, denn fürs blosse Auge zählen die Wolken zuerst
//   Seeing     1 → 0, 8 → 5: höchstens Gelb
//   Mond       Neumond 0, Vollmond 4: heller Himmel, aber kein Grund, drinnen zu bleiben
//   Taupunkt   Abstand Temperatur − Taupunkt ab 6 °C → 0, 1 °C und weniger → 7: Tau und Dunst
//   Feuchte    bis 75 % → 0, 100 % → 7
// Ohne Wolkenwert grau: dann lässt sich nichts sagen, auch wenn alles andere gut wäre. Temperatur, Taupunkt und Feuchte
// sind die aktuellen Werte (statusleiste: eigene Station, Cockpit: Open-Meteo am Ort), Wolken, Seeing und Mond gelten
// für die kommende dunkle Zeit.
export type HimmelWerte = { moon?: number; temp?: number; dewPoint?: number; hum?: number }
export const MOND_STUFE_MAX = 4
export function himmelStufe(cloud: number | undefined, seeing: number | undefined, w: HimmelWerte = {}): number | undefined {
  const zahl = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
  const klemme = (v: number, max: number) => Math.min(max, Math.max(0, v))
  if (!zahl(cloud)) return undefined
  const stufen = [(klemme(cloud, 100) / 100) * LETZTE]
  if (zahl(seeing)) stufen.push(((Math.min(8, Math.max(1, seeing)) - 1) / 7) * GELB)
  if (zahl(w.moon)) stufen.push((klemme(w.moon, 100) / 100) * MOND_STUFE_MAX)
  if (zahl(w.temp) && zahl(w.dewPoint)) stufen.push(klemme(((6 - (w.temp - w.dewPoint)) / 5) * 7, 7))
  if (zahl(w.hum)) stufen.push(klemme(((w.hum - 75) / 25) * 7, 7))
  const schlechteste = Math.max(...stufen)
  const rest = stufen.reduce((a, b) => a + b, 0) - schlechteste
  return Math.min(LETZTE, Math.round(schlechteste + 0.15 * rest))
}
export function himmelFarbe(cloud: number | undefined, seeing: number | undefined, w: HimmelWerte = {}): string {
  const s = himmelStufe(cloud, seeing, w)
  return s === undefined ? 'gray' : (STEPS[s] ?? 'gray')
}

// Mondphase 0–1 (0 Neumond, 0,5 Vollmond) aus beleuchtetem Anteil und «zunehmend» (so steht es im State)
export function mondPhase(percent: number, isWaxing: boolean | undefined): number {
  const f = Math.min(1, Math.max(0, percent / 100))
  const p = Math.acos(1 - 2 * f) / (2 * Math.PI)
  return isWaxing === false ? 1 - p : p
}

// Mond als Bild (App): zwölf Stufen, 0 Neumond, 6 Vollmond (Vorgabe 14.10.2026: etwa 10–12 Stufen)
export const MOND_STUFEN = 12
export function mondStufe(phase: number): number {
  return Math.round((((phase % 1) + 1) % 1) * MOND_STUFEN) % MOND_STUFEN
}

// Mond als Zeichen (Konsole, kann keine Bilder): die acht Mond-Emoji. Auf der Südhalbkugel ist die Sichel gespiegelt.
export const MOND_EMOJI = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'] as const
export function mondEmoji(phase: number, sued = false): string {
  const i = Math.round((((phase % 1) + 1) % 1) * 8) % 8
  return MOND_EMOJI[sued ? (8 - i) % 8 : i] ?? '🌑'
}

// Mond-Bild für die App: dunkle Scheibe, darauf der beleuchtete Teil der Stufe. Zunehmend ist rechts hell
// (Nordhalbkugel); abnehmend oder Südhalbkugel gespiegelt. Die Schattengrenze ist eine Halbellipse mit der Breite
// r·|cos(2π·Phase)|: bis zum Halbmond wölbt sie sich zur hellen Seite (Sichel), danach zur dunklen (dreiviertel).
export const MOND_GROESSE = 14
export function mondSvg(stufe: number, sued = false): string {
  const s = ((Math.round(stufe) % MOND_STUFEN) + MOND_STUFEN) % MOND_STUFEN
  const p = s / MOND_STUFEN
  const r = 6.5
  const kopf = `<svg xmlns="http://www.w3.org/2000/svg" width="${MOND_GROESSE}" height="${MOND_GROESSE}" viewBox="0 0 16 16">`
  const scheibe = `<circle cx="8" cy="8" r="${r}" fill="#2B3240" stroke="#6E7A8F" stroke-width="0.8"/>`
  const hell = '#ECE8D8'
  let licht = ''
  if (s === MOND_STUFEN / 2) licht = `<circle cx="8" cy="8" r="${r}" fill="${hell}"/>`
  else if (s !== 0) {
    // Teil auf der rechten Seite rechnen, für links spiegeln
    const q = p < 0.5 ? p : 1 - p
    const rx = Math.abs(Math.cos(2 * Math.PI * q)) * r
    const bogen = q < 0.25 ? 0 : 1
    const pfad = `M8 ${8 - r} A${r} ${r} 0 0 1 8 ${8 + r} A${rx.toFixed(3)} ${r} 0 0 ${bogen} 8 ${8 - r}Z`
    const links = p > 0.5 !== sued
    licht = `<path d="${pfad}" fill="${hell}"${links ? ' transform="matrix(-1 0 0 1 16 0)"' : ''}/>`
  }
  return `${kopf}${scheibe}${licht}</svg>`
}

const RAD = Math.PI / 180

function daysSinceJ2000(ms: number): number {
  return ms / 86400000 + 2440587.5 - 2451545.0
}

// Sonnenhöhe in Grad (vereinfachte Formel, auf etwa 0,5° genau — reicht für die Dämmerung)
export function sunAltitude(ms: number, lat = LAT, lon = LON): number {
  const d = daysSinceJ2000(ms)
  const g = (357.529 + 0.98560028 * d) * RAD
  const q = 280.459 + 0.98564736 * d
  const l = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD
  const e = (23.439 - 0.00000036 * d) * RAD
  const ra = Math.atan2(Math.cos(e) * Math.sin(l), Math.cos(l))
  const dec = Math.asin(Math.sin(e) * Math.sin(l))
  const gmst = (((18.697374558 + 24.06570982441908 * d) % 24) + 24) % 24
  const h = (gmst * 15 + lon) * RAD - ra
  return Math.asin(Math.sin(lat * RAD) * Math.sin(dec) + Math.cos(lat * RAD) * Math.cos(dec) * Math.cos(h)) / RAD
}

// Die astronomisch dunkle Zeit, die jetzt läuft oder als nächste kommt
export function darkness(now: number, lat = LAT, lon = LON): { start: number; end: number } | undefined {
  const step = 5 * 60000
  let start: number | undefined
  for (let t = now - 14 * 3600000; t <= now + 38 * 3600000; t += step) {
    const isDark = sunAltitude(t, lat, lon) < -18
    if (isDark && start === undefined) start = t
    if (!isDark && start !== undefined) {
      if (t > now) return { start, end: t }
      start = undefined
    }
  }
  return undefined
}

// Beleuchteter Anteil des Mondes in Prozent, dazu ob er zunimmt
export function moon(ms: number): { percent: number; isWaxing: boolean } {
  const jd = ms / 86400000 + 2440587.5
  const phase = ((((jd - 2451550.1) / 29.530588853) % 1) + 1) % 1
  return { percent: ((1 - Math.cos(2 * Math.PI * phase)) / 2) * 100, isWaxing: phase < 0.5 }
}

export type Forecast = { hourly: { time: string[]; cloud_cover: number[] }; utc_offset_seconds: number }

// Open-Meteo-Antwort prüfen: nur mit Stundenliste, Wolkenliste und endlichem Versatz, sonst undefined
export function parseForecast(text: string): Forecast | undefined {
  try {
    const f = JSON.parse(text)
    return Array.isArray(f?.hourly?.time) && Array.isArray(f.hourly.cloud_cover) && Number.isFinite(f.utc_offset_seconds) ? (f as Forecast) : undefined
  } catch {
    return undefined
  }
}

// Mittlere Bewölkung über die dunkle Zeit; nur endliche Werte (1e999 → Infinity würde im $.state zu null)
export function cloudsDuring(f: Forecast, start: number, end: number): number | undefined {
  const values: number[] = []
  f.hourly.time.forEach((t, i) => {
    const from = Date.parse(`${t}:00Z`) - f.utc_offset_seconds * 1000
    const cloud = f.hourly.cloud_cover[i]
    if (from + 3600000 > start && from < end && typeof cloud === 'number' && Number.isFinite(cloud)) values.push(cloud)
  })
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : undefined
}

// Ampel: unter 25 % Wolken gut, unter 60 % mässig, sonst bewölkt
export function level(cloud: number | undefined): StatusleisteNacht['level'] {
  if (cloud === undefined) return undefined
  return cloud < 25 ? 'gut' : cloud < 60 ? 'mässig' : 'bewölkt'
}

export function summarize(f: Forecast | undefined, now: number, s?: SeeingForecast, lat = LAT, lon = LON): StatusleisteNacht {
  const dark = darkness(now, lat, lon)
  if (!dark) return { level: 'keine' }
  const m = moon((dark.start + dark.end) / 2)
  const cloud = f ? cloudsDuring(f, dark.start, dark.end) : undefined
  return {
    start: dark.start,
    end: dark.end,
    offset: f?.utc_offset_seconds,
    moon: m.percent,
    isWaxing: m.isWaxing,
    cloud,
    level: level(cloud),
    seeing: s ? seeingDuring(s, dark.start, dark.end) : undefined,
  }
}

// Uhrzeit in Schweizer Zeit; Versatz aus der Vorhersage, sonst Winterzeit
export function clock(ms: number, offsetSeconds = 3600): string {
  const d = new Date(ms + offsetSeconds * 1000)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}
