// Rätsel im Einblender (Vorgabe Dominik 16.10.2026): Bei jeder hundertsten fertigen Antwort, gezählt über alle Chats
// im $.store, steht im Einblender oben im Band ein Rätsel statt der Zusammenstellung der letzten Arbeit, bis zur
// nächsten Eingabe. Die Rätsel wechseln der Reihe nach. Keines enthält ein Auslösewort (easter-egg.test.ts).

export const RAETSEL_KEY = 'antworten'
export const RAETSEL_ALLE = 100

// je höchstens 85 Zeichen: der Einblender ist eine Zeile und kürzt am Ende
export const RAETSEL = [
  'What is the point of the celestial sphere below your feet? Send just that word.',
  'Which point of the celestial sphere lies opposite the one overhead? Send that word.',
  'Which five-letter word names the lowest point of the celestial sphere? Send it alone.',
  'Which point in the sky is named after the Arabic for "opposite"? Send the name.',
]

// Rätsel zur n-ten fertigen Antwort, sonst undefined
export function raetselFuer(n: number): string | undefined {
  if (!Number.isInteger(n) || n <= 0 || n % RAETSEL_ALLE !== 0) return undefined
  return RAETSEL[(n / RAETSEL_ALLE - 1) % RAETSEL.length]
}
