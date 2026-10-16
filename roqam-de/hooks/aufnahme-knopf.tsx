import type { ClientSurface } from 'claude-code'

// Knopf «◉ Aufnahme» als selbst gezeichnetes Element: nur so lässt sich die Schrift färben (ein Button kennt nur
// gedimmt oder hell). Schrift immer weiss, nur der Punkt wird bei «an» rot; sonst ändert sich nichts (gleicher Text, gleiche Schrift, nicht fett),
// damit sich in der Leiste nichts bewegt. nurSymbol (Sondermodus): nur der Punkt ◉, ohne Fläche; mit wort steht davor
// ein Wort in fester Farbe (Sondermodus «REC» in der Zeilenfarbe, Vorgabe 15.10.2026: nur der Punkt zeigt an/aus).
// Ein Klick (auch aufs Wort) meldet «umschalten» an register.tsx.
export default function AufnahmeKnopf(props: unknown, surface: ClientSurface) {
  const { Text } = surface.elements
  const p = (props ?? {}) as { an?: boolean; nurSymbol?: boolean; wort?: string; wortFarbe?: string }
  const an = p.an === true
  surface.onPointer(e => {
    if (e.type === 'down' && (e.button ?? 'left') === 'left') surface.post({ umschalten: true })
  })
  if (p.nurSymbol && p.wort) {
    // geschützter Leerschlag nach dem Wort: einen normalen am Ende eines Text-Teils schneidet die App weg
    return (
      <Text>
        <Text color={p.wortFarbe ?? 'white'}>{`${p.wort} `}</Text>
        <Text color={an ? 'red' : 'white'}>◉</Text>
      </Text>
    )
  }
  if (p.nurSymbol) return <Text color={an ? 'red' : 'white'}>◉</Text>
  return (
    <Text color="white">
      <Text color={an ? 'red' : 'white'}>◉</Text> Aufnahme
    </Text>
  )
}
