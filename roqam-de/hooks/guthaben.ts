// Guthaben mit Ablaufdatum (Cloud-Credits von Claude, Gratis-Reset usw.). Die Mod-Schnittstelle liefert diese
// Werte nicht, darum stehen sie in ~\.claude\statusleiste-guthaben.json (von Hand oder von Claude nachgeführt, Werte
// von claude.ai > Einstellungen > Nutzung). Die Leiste rechnet die Resttage selbst; fehlt die Datei, zeigt sie nichts.
// Der Fingerabdruck für «⚑ Neue Aktion» liegt in aktion.ts.

// kurz: Bezeichnung in der Leiste (z. B. «Cloud $»); fehlt sie, «Guthaben 1, 2 …» für Beträge, sonst der Name
// verbraucht: Gutschein schon eingelöst (z. B. Gratis-Reset benutzt) → nicht mehr zeigen
export type Guthaben = { name: string; kurz?: string; rest?: number; total?: number; einheit?: string; ablauf: string; verbraucht?: boolean }

// geld: ein Betrag (Cloud-Credits); sonst ein Gutschein ohne Betrag (z. B. Gratis-Reset)
export type GuthabenTeil = { name: string; kurz?: string; label: string; value: string; note: string; warn: boolean; geld: boolean }

// Ein Eintrag (aus der Datei oder dem State) in geprüfter Form: name und ablauf Pflicht, die übrigen Felder nur im
// richtigen Typ, sonst weggelassen. Eine Zahl in Anführungszeichen oder ein Objekt als kurz liess sonst das Zeichnen
// abstürzen, und die ganze Leiste fehlte (09.10.2026).
export function guthabenEintrag(g: unknown): Guthaben | undefined {
  if (typeof g !== 'object' || g === null) return undefined
  const e = g as Record<string, unknown>
  if (typeof e.name !== 'string' || typeof e.ablauf !== 'string' || !(Date.parse(e.ablauf) > 0)) return undefined
  const zahl = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
  const out: Guthaben = { name: e.name, ablauf: e.ablauf }
  if (typeof e.kurz === 'string') out.kurz = e.kurz
  const rest = zahl(e.rest)
  if (rest !== undefined) out.rest = rest
  const total = zahl(e.total)
  if (total !== undefined) out.total = total
  if (typeof e.einheit === 'string') out.einheit = e.einheit
  if (typeof e.verbraucht === 'boolean') out.verbraucht = e.verbraucht
  return out
}

export function parseGuthaben(text: string): Guthaben[] {
  try {
    const list = JSON.parse(text)
    return Array.isArray(list) ? list.map(guthabenEintrag).filter((g): g is Guthaben => g !== undefined) : []
  } catch {
    return []
  }
}

// Versatz der Schweizer Zeit zu UTC: Sommerzeit vom letzten Sonntag im März bis zum letzten Sonntag im Oktober,
// je 01:00 UTC
export function swissOffsetMs(ms: number): number {
  const y = new Date(ms).getUTCFullYear()
  const lastSunday = (month: number) => {
    const last = new Date(Date.UTC(y, month + 1, 0, 1))
    return last.getTime() - last.getUTCDay() * 86400000
  }
  return ms >= lastSunday(2) && ms < lastSunday(9) ? 7200000 : 3600000
}

function betrag(v: number): string {
  // kein Zahlenwert (Datei von Hand gefüllt): «?» statt Absturz
  if (typeof v !== 'number' || !Number.isFinite(v)) return '?'
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace('.', ',')
}

// «Cloud-Guthaben: 248/250 $ bis 5.11. · noch 29 Tage»; abgelaufene, aufgebrauchte und eingelöste fallen weg; ab 7 Tagen vor Ablauf Warnung
export function guthabenTeile(list: readonly Guthaben[], now: number): GuthabenTeil[] {
  const out: GuthabenTeil[] = []
  for (const g of list) {
    const ablauf = Date.parse(g.ablauf)
    const ms = ablauf - now
    // Nur zeigen, was es wirklich gibt: abgelaufen, aufgebraucht (Betrag 0) oder eingelöst → weg
    if (!(ms > 0) || g.verbraucht === true || (g.rest !== undefined && g.rest <= 0)) continue
    const tage = Math.floor(ms / 86400000)
    // Datum in Schweizer Zeit, Sommer- und Winterzeit beachtet
    const d = new Date(ablauf + swissOffsetMs(ablauf))
    const datum = `${d.getUTCDate()}.${d.getUTCMonth() + 1}.`
    const menge =
      g.rest !== undefined ? `${betrag(g.rest)}${g.total !== undefined ? `/${betrag(g.total)}` : ''} ${g.einheit ?? ''}`.trim() + ' ' : ''
    out.push({
      name: g.name,
      ...(g.kurz ? { kurz: g.kurz } : {}),
      geld: g.rest !== undefined,
      label: `${g.name}:`,
      value: `${menge}bis ${datum}`,
      note: tage >= 1 ? `noch ${tage} Tag${tage === 1 ? '' : 'e'}` : `noch ${Math.max(1, Math.round(ms / 3600000))} h`,
      warn: tage < 7,
    })
  }
  return out
}
