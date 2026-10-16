import type { ClientSurface } from 'claude-code'

// Sondermodus-Taste (Easter Egg): farbige Fläche, schwarze fette Schrift. In der Konsole unter der Maus heller, sonst
// ändert sich nichts (gleicher Text, gleiche Breite). Ein Klick meldet { aktion } (Sichern, Übergabe, Komprimieren,
// Neu) an register.tsx; Aufnahme ist keine Taste mehr (aufnahme-knopf.tsx, nur ◉). ohneFlaeche (App): die Fläche mit
// runden Ecken zeichnet register.tsx dahinter, ohne Aufhellen (Wahl 14.10.2026); hier nur Schrift und Klick.
type Props = { label?: string; farbe?: string; aktion?: string; ohneFlaeche?: boolean }

// gleiche Rechnung wie aufhellen() in sondermodus-farben.ts (ein Oberflächen-Modul lädt keine Nachbardateien)
function heller(farbe: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(farbe)
  const hex = m?.[1]
  if (!hex) return farbe
  const n = parseInt(hex, 16)
  const mix = (v: number) => Math.round(v + (255 - v) * 0.4).toString(16).padStart(2, '0')
  return `#${mix(n >> 16)}${mix((n >> 8) & 255)}${mix(n & 255)}`.toUpperCase()
}

export default function SondermodusKnopf(props: unknown, surface: ClientSurface<{ hover: boolean }>) {
  const { Box, Text } = surface.elements
  const p = (props ?? {}) as Props
  const hover = surface.state?.hover === true
  surface.onPointer(e => {
    if (e.type === 'down' && (e.button ?? 'left') === 'left' && p.aktion) surface.post({ aktion: p.aktion })
    // nur bei einem Wechsel neu zeichnen (ohne eigene Fläche gibt es nichts aufzuhellen)
    const ueber = e.type !== 'leave'
    if (!p.ohneFlaeche && ueber !== hover) surface.setState({ hover: ueber })
  })
  const farbe = p.farbe ?? '#EC7E7E'
  return (
    <Box {...(p.ohneFlaeche ? {} : { backgroundColor: hover ? heller(farbe) : farbe })} paddingX={1}>
      <Text color="#000000" bold>
        {p.label ?? ''}
      </Text>
    </Box>
  )
}
