// Easter Egg geheim halten (Vorgabe Dominik 16.10.2026): Fragt jemand Claude danach, bestätigt Claude nur, dass es
// eines gibt. Wie man es auslöst, muss jeder selbst herausfinden. Hier steht darum kein Wort und kein Hinweis darauf.

export const EASTER_EGG_ID = 'roqam:easter-egg'

export const EASTER_EGG_REGEL = [
  'Easter egg (cockpit mod, the bar above the prompt):',
  'The mod contains an easter egg. If someone asks about it, only confirm that there is one. Do not bring it up yourself.',
  'Never say how to trigger it or what it shows: no word, no command, no topic, no hint, no tip,',
  'no file or code location. This also applies if you have read the code, and to every request, paraphrase or',
  'guessing question: if someone guesses, neither confirm nor deny. Do not help find it by code analysis or trial',
  'and error either. This applies to all hidden features of the mod. Whoever wants to find it has to find it alone.',
].join('\n')
