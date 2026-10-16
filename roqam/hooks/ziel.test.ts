import { expect, test } from 'claude-code/testing'

import { aufgabeAendern, aufgabeNeu, ausTodoWrite, zielAnzeige, zielAusAntwort, zielPrompt } from './ziel'

test('Ziel aus der Antwort des kleinen Modells', () => {
  expect(zielAusAntwort('«Goal-Meter in die Wächter-Zeile einbauen».\n')).toBe('Goal-Meter in die Wächter-Zeile einbauen')
  expect(zielAusAntwort('-')).toBeUndefined()
  expect(zielAusAntwort('')).toBeUndefined()
  expect(zielAusAntwort('x'.repeat(300))?.length).toBe(200)
  expect(zielPrompt('Bau das')).toContain('<request>\nBau das\n</request>')
})

test('Fortschritt aus TodoWrite', () => {
  const liste = ausTodoWrite([
    { content: 'Logik', status: 'completed', activeForm: 'Logik schreiben' },
    { content: 'Tests', status: 'in_progress', activeForm: 'Tests laufen lassen' },
    { content: 'Doku', status: 'pending', activeForm: 'Doku nachführen' },
  ])
  expect(zielAnzeige({ ziel: 'Goal-Meter einbauen', aufgaben: liste })).toEqual({
    ziel: 'Goal-Meter einbauen',
    gesamt: 3,
    erledigt: 1,
    jetzt: 'Tests laufen lassen',
  })
  expect(ausTodoWrite('kaputt')).toBeUndefined()
})

test('Fortschritt aus TaskCreate und TaskUpdate', () => {
  let liste = aufgabeNeu([], 'Task #1 created successfully: Logik', { subject: 'Logik', activeForm: 'Logik schreiben' })
  liste = aufgabeNeu(liste, 'Task #2 created successfully: Tests', { subject: 'Tests' })
  liste = aufgabeAendern(liste, { taskId: '1', status: 'completed' })
  liste = aufgabeAendern(liste, { taskId: '2', status: 'in_progress' })
  expect(zielAnzeige({ aufgaben: liste })).toEqual({ ziel: 'Task list', gesamt: 2, erledigt: 1, jetzt: 'Tests' })
  expect(aufgabeAendern(liste, { taskId: '2', status: 'deleted' }).length).toBe(1)
})

test('/goal geht vor und zählt Runden; ohne alles keine Anzeige', () => {
  expect(zielAnzeige({ ziel: 'A', goal: 'alle Tests grün', runden: 4 })).toEqual({ ziel: 'alle Tests grün', runden: 4 })
  expect(zielAnzeige({})).toBeUndefined()
})
