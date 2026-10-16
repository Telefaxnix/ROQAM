// Aufnahme-Knopf im Sondermodus (Vorgabe 15.10.2026): «REC» vor dem Punkt, das Wort immer in der übergebenen
// Zeilenfarbe, nur der Punkt zeigt an (rot) und aus (weiss); ohne Wort bleibt es beim Punkt allein.
import { expect, test } from 'claude-code/testing'

import AufnahmeKnopf from './aufnahme-knopf'

// an Stelle der Oberfläche: Text als Name, Zeiger und Meldungen ohne Wirkung
const flaeche = { elements: { Text: 'Text' }, onPointer: () => undefined, post: () => undefined }
const zeichne = (props: unknown) => JSON.stringify(AufnahmeKnopf(props, flaeche as never))

test('REC vor dem Punkt, Wort in der Zeilenfarbe, nur der Punkt wechselt die Farbe', () => {
  const aus = zeichne({ an: false, nurSymbol: true, wort: 'REC', wortFarbe: '#9999CC' })
  const an = zeichne({ an: true, nurSymbol: true, wort: 'REC', wortFarbe: '#9999CC' })
  for (const t of [aus, an]) {
    expect(t).toContain('REC ')
    expect(t.indexOf('REC')).toBeLessThan(t.indexOf('◉'))
    expect(t).toContain('#9999CC')
  }
  expect(aus).toContain('"white"')
  expect(aus).not.toContain('"red"')
  expect(an).toContain('"red"')
  // ohne Wort: nur der Punkt (wie bisher)
  expect(zeichne({ an: false, nurSymbol: true })).not.toContain('REC')
})
