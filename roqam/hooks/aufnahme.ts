// Aufnahme-Modus: solange der Bildschirm aufgenommen wird, blendet die Leiste Pfade, Kosten und Konten aus.
// An: von Hand (Knopf «◉ Aufnahme», gilt für alle offenen Chats, gespeichert im $.store) oder von selbst, solange
// ein reines Aufnahmeprogramm läuft. NVIDIA App und Windows-Aufnahme (Snipping Tool, Game Bar) laufen immer bzw.
// verraten nicht, ob sie aufnehmen: dafür bleibt der Knopf.

// Prozessnamen (ohne .exe, klein) reiner Aufnahmeprogramme → Anzeigename
export const AUFNAHME_PROGRAMME: Record<string, string> = {
  obs64: 'OBS',
  obs32: 'OBS',
  'streamlabs obs': 'Streamlabs',
  bdcam: 'Bandicam',
  camrecorder: 'Camtasia',
}

export const AUFNAHME_KEY = 'aufnahme-hand'
// Von Hand ausgeschaltet, obwohl ein Aufnahmeprogramm läuft; gilt, bis das Programm beendet ist
export const AUFNAHME_AUS_KEY = 'aufnahme-aus'

// Erstes laufendes Aufnahmeprogramm aus «tasklist /FO CSV /NH», sonst nichts
export function aufnahmeProgramm(csv: string): string | undefined {
  for (const line of csv.split(/\r?\n/)) {
    const m = /^"([^"]+)"/.exec(line)
    if (!m) continue
    const name = m[1].toLowerCase().replace(/\.exe$/, '')
    if (AUFNAHME_PROGRAMME[name]) return AUFNAHME_PROGRAMME[name]
  }
  return undefined
}

export function istPrivat(a: { hand?: boolean; programm?: string; aus?: boolean }): boolean {
  return a.hand === true || (a.programm !== undefined && a.aus !== true)
}
