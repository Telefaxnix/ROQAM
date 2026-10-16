// Rätsel im Einblender (Vorgabe Dominik 16.10.2026): Bei jeder hundertsten fertigen Antwort, gezählt über alle Chats
// im $.store, steht im Einblender oben im Band ein Rätsel statt der Zusammenstellung der letzten Arbeit, bis zur
// nächsten Eingabe. Die Rätsel wechseln der Reihe nach. Keines enthält ein Auslösewort (easter-egg.test.ts).

export const RAETSEL_KEY = 'antworten'
export const RAETSEL_ALLE = 100

// je höchstens 85 Zeichen: der Einblender ist eine Zeile und kürzt am Ende
export const RAETSEL = [
  'Wie heisst der Himmelspunkt genau unter Ihren Füssen? Senden Sie nur das Wort.',
  'Welcher Himmelspunkt liegt dem Scheitelpunkt gegenüber? Schicken Sie nur dieses Wort.',
  'Welches Wort aus fünf Buchstaben nennt den tiefsten Himmelspunkt? Schicken Sie es.',
  'Welcher Punkt am Himmel heisst nach dem arabischen «gegenüber»? Senden Sie den Namen.',
]

// Rätsel zur n-ten fertigen Antwort, sonst undefined
export function raetselFuer(n: number): string | undefined {
  if (!Number.isInteger(n) || n <= 0 || n % RAETSEL_ALLE !== 0) return undefined
  return RAETSEL[(n / RAETSEL_ALLE - 1) % RAETSEL.length]
}
