import { expect, test } from 'claude-code/testing'

import { parseOrt, parseWetter, tempoAus, tempoParts, wetterParts } from './register'

// Ausschnitt einer Open-Meteo-Antwort («current»)
const ANTWORT = JSON.stringify({ current: { temperature_2m: 20.7, dew_point_2m: 10.8, relative_humidity_2m: 53 } })

test('liest Temperatur, Taupunkt und Feuchte von Open-Meteo', () => {
  expect(parseWetter(ANTWORT)).toEqual({ temp: 20.7, dewPoint: 10.8, hum: 53 })
  expect(parseWetter('kaputt')).toBeUndefined()
  expect(parseWetter('{"current":{}}')).toBeUndefined()
})

test('Ort in Koordinaten', () => {
  expect(parseOrt(JSON.stringify({ results: [{ name: 'Winterthur', latitude: 47.50564, longitude: 8.72413 }] }))).toEqual({
    lat: 47.50564,
    lon: 8.72413,
    name: 'Winterthur',
  })
  expect(parseOrt('{"results":[]}')).toBeUndefined()
})

test('Wetterteil mit einer Kommastelle, Zeichen statt Wörter, Taupunkt als «TP»', () => {
  const parts = wetterParts({ temp: 20.7, dewPoint: 10.8, hum: 53 })
  expect(parts.map(p => `${p.label} ${p.value}`)).toEqual(['Temp 20.7°', 'TP 10.8°', 'Feuchte 53.0%'])
  expect(parts.map(p => `${p.symbol} ${p.value}`)).toEqual(['🌡 20.7°', 'Dew 10.8°', '💧 53.0%'])
})

test('Stream-Tempo: Tokens je Sekunde, kurze Anfragen zählen nicht', () => {
  expect(tempoAus(480, 10000)).toBe(48)
  expect(tempoAus(10, 10000)).toBeUndefined()
  expect(tempoAus(480, 200)).toBeUndefined()
  expect(tempoAus(undefined, 10000)).toBeUndefined()
  expect(tempoParts({ tps: 48.4 }).map(p => `${p.symbol} ${p.value}`)).toEqual(['⚡ 48 t/s'])
  expect(tempoParts({})).toEqual([])
})