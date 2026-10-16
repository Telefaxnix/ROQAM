import type { ClientSurface } from 'claude-code'

// Anklickbares Wort mit eigener Farbe (ein Button kennt nur gedimmt oder hell): «Claude ●», «Update 2.1.x»,
// «⚑ Neue Aktion», «⚠ Connector weg». Kein Pfeil, kein Zusatzzeichen; der Zustand ändert nur die Farbe, damit sich in
// der Leiste nichts verschiebt. Ein Klick meldet { kaertchen } an register.tsx, das Kärtchen öffnet oder schliesst.
// Unter der Maus wird das Wort heller (Ersatz für die Hand als Mauszeiger, die der Mod nicht setzen kann; 09.10.2026),
// gleiche Schrift, gleiche Breite.
type Teil = { text: string; color?: string; dim?: boolean; bold?: boolean }

// helle Fassung der benannten Farben, die die Leiste verwendet
const HELL: Record<string, string> = { yellow: '#FFF3A0', green: '#9BE59B', red: '#FF9C9C', gray: '#D0D0D0', white: '#FFFFFF' }

// Farbe für «Maus darüber»: Hex 45 % zu Weiss hin gemischt, benannte Farbe aus HELL, gedimmt wird voll (wie ein Button)
export function hell(t: Teil): Teil {
  if (t.dim) return { ...t, dim: false }
  const c = t.color
  if (!c) return t
  const m = /^#([0-9a-f]{6})$/i.exec(c)
  if (!m) return { ...t, color: HELL[c] ?? c }
  const n = parseInt(m[1], 16)
  const mix = (v: number) => Math.round(v + (255 - v) * 0.45).toString(16).padStart(2, '0')
  return { ...t, color: `#${mix(n >> 16)}${mix((n >> 8) & 255)}${mix(n & 255)}`.toUpperCase() }
}

export default function FarbKnopf(props: unknown, surface: ClientSurface<{ hover: boolean }>) {
  const { Text } = surface.elements
  // kaertchen: Klick öffnet ein Kärtchen; aktion: Klick löst einen der Knöpfe der Knopfzeile aus (Sichern usw.)
  const p = (props ?? {}) as { teile?: Teil[]; kaertchen?: string; aktion?: string }
  const hover = surface.state?.hover === true
  surface.onPointer(e => {
    if (e.type === 'down' && (e.button ?? 'left') === 'left') {
      if (p.kaertchen) surface.post({ kaertchen: p.kaertchen })
      else if (p.aktion) surface.post({ aktion: p.aktion })
    }
    // nur bei einem Wechsel neu zeichnen
    const ueber = e.type !== 'leave'
    if (ueber !== hover) surface.setState({ hover: ueber })
  })
  return (
    <Text>
      {(p.teile ?? []).map((t0, i) => {
        const t = hover ? hell(t0) : t0
        return (
          <Text key={`t${i}`} color={t.color} dimColor={t.dim} bold={t.bold}>
            {t.text}
          </Text>
        )
      })}
    </Text>
  )
}
