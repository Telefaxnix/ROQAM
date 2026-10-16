// GitHub-Abgleich: Ein eigenes Abgleich-Skript (z. B. eine geplante Windows-Aufgabe) schreibt seinen Stand nach
// ~\.claude\github-abgleich.json. Die Leiste zeigt nur bei einer Störung «⚠ GitHub»; fehlt die Datei, nichts.

export const ABGLEICH_ALT_MS = 30 * 60 * 1000

// Liefert die Zeilen fürs Kärtchen, wenn etwas nicht stimmt; sonst undefined (dann bleibt die Leiste still)
export function abgleichWarnung(text: string, now: number): string[] | undefined {
  let s: { zeit?: string; letzterErfolg?: string | null; fehler?: unknown }
  try {
    s = JSON.parse(text.replace(/^\uFEFF/, ''))
  } catch {
    return ['Der GitHub-Abgleich hat noch keinen Stand geschrieben.', 'Abgleich-Skript prüfen.']
  }
  // «null» oder eine blosse Zahl ist gültiges JSON, aber kein Stand: wie «noch kein fehlerfreier Abgleich» (09.10.2026)
  if (typeof s !== 'object' || s === null) s = {}
  const fehler = Array.isArray(s.fehler) ? s.fehler.map(String) : []
  const erfolg = s.letzterErfolg ? Date.parse(s.letzterErfolg) : NaN
  const alt = !Number.isFinite(erfolg) || now - erfolg > ABGLEICH_ALT_MS
  if (fehler.length === 0 && !alt) return undefined
  const zeilen: string[] = [...fehler]
  if (alt) {
    zeilen.push(
      Number.isFinite(erfolg)
        ? `Letzter fehlerfreier Abgleich vor ${Math.round((now - erfolg) / 60000)} min.`
        : 'Noch kein fehlerfreier Abgleich.',
    )
    if (fehler.length === 0) zeilen.push('Abgleich-Skript prüfen.')
  }
  return zeilen
}
