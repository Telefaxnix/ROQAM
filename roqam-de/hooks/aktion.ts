// Aktionen von Anthropic (Cloud-Guthaben-Aktion, Gästepässe, Rabatt, Hinweise zum Nutzungslimit): Claude Code legt dazu in
// ~/.claude.json nur Merker ab. Aus ihnen wird ein Stand gebildet; weicht er vom bestätigten ab, zeigt die Leiste
// «⚑ Neue Aktion». Ein Klick darauf zeigt, was sich geändert hat, und bestätigt den Stand (Vorgabe 15.10.2026; vorher
// nur mit /aktion-gesehen). Beträge und Ablaufdaten von Guthaben liefert Claude Code nicht, darum zeigt die Leiste keine
// Guthaben mehr (Wahl Dominik 15.10.2026: «Cloud $» und «Gratis-Reset» veralteten, weil sie von Hand nachgeführt wurden).

// Stand in fester Form; als JSON ist er der Fingerabdruck. Gleiche Form wie bis 15.10.2026, nur die Zahl der Pässe zählt
// jetzt auch, wenn Claude Code sie als Zahl statt als Liste ablegt (seit 15.10.2026: «remaining_passes»: 3)
export type AktionStand = {
  promo: [string | null, boolean | null, boolean | null]
  passes: [boolean | null, number | null][]
  hinweise: number
  rabatt: number
}

// Zeilen höchstens so lang (das Kärtchen sitzt mitten in der STATUS-Zeile)
export const AKTION_ZEILE_MAX = 55

type Pass = { eligible?: boolean; remaining_passes?: unknown; limit?: unknown; referrer_reward?: { amount_minor_units?: unknown; currency?: unknown } }

function lesen(claudeJson: string): Record<string, unknown> | undefined {
  try {
    const j = JSON.parse(claudeJson)
    return j && typeof j === 'object' && !Array.isArray(j) ? (j as Record<string, unknown>) : undefined
  } catch {
    return undefined
  }
}
const objekt = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const zahl = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
const restPaesse = (v: unknown): number | null => (Array.isArray(v) ? v.length : (zahl(v) ?? null))
const paesse = (j: Record<string, unknown>) => Object.values(objekt(j.passesEligibilityCache)).map(p => objekt(p) as Pass)

export function aktionStand(claudeJson: string): AktionStand | undefined {
  const j = lesen(claudeJson)
  if (!j) return undefined
  const f = objekt(j.cachedGrowthBookFeatures)
  const promo = objekt(j.promoStartupStatusCache)
  const wahr = (v: unknown) => (typeof v === 'boolean' ? v : null)
  return {
    promo: [typeof promo.endpoint === 'string' ? promo.endpoint : null, wahr(promo.eligible), wahr(promo.claimed)],
    passes: paesse(j).map(p => [wahr(p.eligible), restPaesse(p.remaining_passes)]),
    hinweise: Array.isArray(f.tengu_rate_limit_promo_notices) ? f.tengu_rate_limit_promo_notices.length : 0,
    rabatt: zahl(objekt(f.tengu_penguin_mode_promo).discountPercent) ?? 0,
  }
}

export function aktionSignatur(claudeJson: string): string | undefined {
  const s = aktionStand(claudeJson)
  return s ? JSON.stringify(s) : undefined
}

function geld(minor: unknown, waehrung: unknown): string | undefined {
  const n = zahl(minor)
  if (n === undefined) return undefined
  const betrag = Number.isInteger(n / 100) ? String(n / 100) : (n / 100).toFixed(2).replace('.', ',')
  return `${betrag} ${waehrung === 'USD' || waehrung === undefined ? '$' : String(waehrung)}`
}

// Was sich gegenüber dem bestätigten Fingerabdruck geändert hat, in kurzen Zeilen mit dem heutigen Stand. Ohne lesbaren
// alten Stand: alles, was es gibt. Am Schluss, wo es Einzelheiten gibt.
export function aktionZeilen(claudeJson: string, bekannt: string | undefined): string[] {
  const j = lesen(claudeJson)
  const s = aktionStand(claudeJson)
  if (!j || !s) return []
  let alt: Partial<AktionStand> = {}
  try {
    alt = objekt(JSON.parse(bekannt ?? '')) as Partial<AktionStand>
  } catch {
    alt = {}
  }
  const anders = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b)
  const zeilen: string[] = []
  if (anders(alt.promo, s.promo) && s.promo[0]) {
    const name = s.promo[0].split('/').pop() === 'cloud_credit' ? 'Cloud-Guthaben' : (s.promo[0].split('/').pop() ?? 'Aktion')
    const was = s.promo[2] ? 'eingelöst' : s.promo[1] ? 'verfügbar, noch nicht eingelöst' : 'nicht verfügbar'
    zeilen.push(`Aktion ${name}: ${was}`)
  }
  if (anders(alt.passes, s.passes)) {
    const liste = paesse(j)
    if (!liste.some(p => p.eligible === true)) zeilen.push('Gästepässe: keine')
    for (const p of liste.filter(x => x.eligible === true)) {
      const rest = restPaesse(p.remaining_passes)
      const limit = zahl(p.limit)
      const bonus = geld(p.referrer_reward?.amount_minor_units, p.referrer_reward?.currency)
      zeilen.push(`Gästepässe: ${rest ?? '?'}${limit !== undefined ? ` von ${limit}` : ''} frei${bonus ? `, Empfehlungsbonus ${bonus}` : ''}`)
    }
  }
  if (alt.hinweise !== s.hinweise) zeilen.push(s.hinweise > 0 ? `Hinweise zum Nutzungslimit: ${s.hinweise}` : 'Hinweise zum Nutzungslimit: keine mehr')
  if (alt.rabatt !== s.rabatt) {
    const ende = objekt(objekt(j.cachedGrowthBookFeatures).tengu_penguin_mode_promo).endDate
    zeilen.push(s.rabatt > 0 ? `Rabatt: ${s.rabatt} %${typeof ende === 'string' ? ` bis ${ende}` : ''}` : 'Rabatt: keiner mehr')
  }
  if (zeilen.length === 0) zeilen.push('Anthropic hat eine Aktion geändert')
  zeilen.push('Mehr: claude.ai › Einstellungen › Nutzung')
  return zeilen.map(z => (z.length > AKTION_ZEILE_MAX ? `${z.slice(0, AKTION_ZEILE_MAX - 1)}…` : z))
}
