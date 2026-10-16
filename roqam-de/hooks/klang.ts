// Töne der Sondermodus-Ansicht (Easter Egg; klang\eingabe.wav: Rückfrage; klang\bereit.wav: Antwort fertig,
// nächster Schritt bei dir). $.audio.play spielt unter Windows nichts, darum über PowerShell; abgespielt wird in
// register.tsx (klang), nur bei eingeschaltetem Sondermodus. Zwei Töne innert 1,5 s ergeben nur einen (Frage und Wächter
// gleichzeitig).
// Die WAV-Dateien baut klang\klang-bauen.py (rein synthetisch).
export type Klang = 'eingabe' | 'bereit' | 'bereit-klassisch'
export const KLANG_PAUSE_MS = 1500

export function klangBefehl(root: string, name: Klang): string[] {
  // Pfad in einfachen Anführungszeichen; ein Apostroph im Pfad wird für PowerShell verdoppelt
  const datei = `${root}\\klang\\${name}.wav`.replace(/'/g, "''")
  return ['powershell', '-NoProfile', '-NonInteractive', '-Command', `(New-Object Media.SoundPlayer '${datei}').PlaySync()`]
}

// Zweiter Bereit-Ton (Vorgabe Dominik 14.10.2026): Standard ist die weiche Quinte (bereit.wav), der frühere hellere
// Ton (bereit-klassisch.wav) lässt sich wählen. Umgeschaltet wird wie beim Sondermodus mit einem Wort als eigener
// Nachricht; im Code steht nur seine Prüfsumme (FNV-1a, sondermodus-farben.ts → pruefsumme). Die Wahl gilt in allen
// Chats ($.store), bis das Wort wieder kommt.
export const TON_KEY = 'quittierton'
export const TON_PRUEFSUMME = 0xfecb8f95

// Welche Datei für «bereit» spielt
export function bereitKlang(klassisch: boolean): Klang {
  return klassisch ? 'bereit-klassisch' : 'bereit'
}

// Meldung beim Umschalten, aus dem geschickten Wort gebaut
export function tonMeldung(wort: string, klassisch: boolean): string {
  const name = wort.toUpperCase()
  return klassisch
    ? `${name}: Quittierton klassisch (hell). Mit ${wort} zurück zur Quinte.`
    : `${name}: Quittierton Quinte (weich). Mit ${wort} zurück zum klassischen.`
}
