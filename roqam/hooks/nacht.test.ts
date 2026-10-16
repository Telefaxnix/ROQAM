import { expect, test } from 'claude-code/testing'

import { clock, cloudsDuring, darkness, himmelFarbe, himmelStufe, level, MOND_STUFEN, mondEmoji, mondPhase, mondStufe, mondSvg, moon, seeingColor, seeingDuring, STEPS, sunAltitude } from './nacht'
import { contextWarning, nightParts } from './register'

test('Sonnenhöhe: Mittag Sommeranfang rund 66°, Mitternacht Winteranfang rund −66°', () => {
  const summer = sunAltitude(Date.parse('2026-06-21T11:27:00Z'))
  const winter = sunAltitude(Date.parse('2026-12-21T23:27:00Z'))
  expect(summer > 64 && summer < 67).toBe(true)
  expect(winter < -64 && winter > -67).toBe(true)
})

test('astronomische Dunkelheit am 07.10.2026 beginnt gegen 20:35 Schweizer Zeit', () => {
  const dark = darkness(Date.parse('2026-10-07T12:00:00Z'))
  expect(dark).toBeDefined()
  const startUtcMinutes = new Date(dark!.start).getUTCHours() * 60 + new Date(dark!.start).getUTCMinutes()
  expect(startUtcMinutes > 18 * 60 + 15 && startUtcMinutes < 18 * 60 + 55).toBe(true)
  expect(clock(dark!.start, 7200).startsWith('20:')).toBe(true)
})

test('Mond: Vollmond 03.01.2026 fast ganz, Neumond 18.01.2026 fast dunkel', () => {
  expect(moon(Date.parse('2026-01-03T10:00:00Z')).percent > 97).toBe(true)
  expect(moon(Date.parse('2026-01-18T20:00:00Z')).percent < 3).toBe(true)
})

test('Wolken über die dunkle Zeit gemittelt, Ampel', () => {
  const f = {
    utc_offset_seconds: 7200,
    hourly: { time: ['2026-10-07T20:00', '2026-10-07T21:00', '2026-10-07T22:00'], cloud_cover: [10, 20, 90] },
  }
  // 20:00–22:00 Schweizer Zeit = 18:00–20:00 UTC: die ersten zwei Stunden
  const avg = cloudsDuring(f, Date.parse('2026-10-07T18:00:00Z'), Date.parse('2026-10-07T20:00:00Z'))
  expect(avg).toBe(15)
  expect(level(15)).toBe('gut')
  expect(level(40)).toBe('mässig')
  expect(level(80)).toBe('bewölkt')
})

test('Sternwarten-Zeile', () => {
  const parts = nightParts({
    start: Date.parse('2026-10-07T18:35:00Z'),
    end: Date.parse('2026-10-08T04:05:00Z'),
    offset: 7200,
    moon: 12.34,
    isWaxing: false,
    cloud: 8,
    seeing: 1,
    level: 'gut',
  })
  // Zeichen statt Wörter (Vorgabe 14.10.2026); Mond 12 % abnehmend = Stufe 11 von 12, in der Konsole 🌘
  expect(parts.map(p => p.label)).toEqual(['Himmel', 'Wolken', 'Mond', 'Dunkel'])
  // «Seeing:» vor dem Punkt (Vorgabe 14.10.2026: man soll wissen, wofür der Punkt steht)
  // Mond mit Beleuchtung in Prozent (14.10.2026, fehlte seit dem Astro-Umbau)
  expect(parts.map(p => `${p.symbol} ${p.value}`.trim())).toEqual(['Seeing: ●', '☁ 8.0%', '🌘 12.3%', '★ 20:35–06:05'])
  expect(parts[2]?.mond).toEqual({ stufe: 11, sued: false })
  // 8 % Wolken, bestes Seeing: grün
  expect(parts[0]?.color).toBe(STEPS[1])
  // Südhalbkugel: Sichel gespiegelt
  expect(nightParts({ start: 0, end: 1, moon: 12.34, isWaxing: false, cloud: 8, level: 'gut' }, true)[2]?.symbol).toBe('🌒')
})

// Vorgabe 14.10.2026: Der Punkt ist eine Himmels-Ampel. Vorher zeigte er nur das Seeing und war bei 100 % Wolken grün.
test('Himmels-Ampel: Wolken bestimmen, Seeing verfeinert, ohne Wolkenwert grau', () => {
  expect(himmelFarbe(0, 1)).toBe(STEPS[0])
  expect(himmelFarbe(100, 1)).toBe(STEPS[10])
  // schlechtestes Seeing bei klarem Himmel: höchstens Gelb (Mitte)
  expect(himmelFarbe(0, 8)).toBe(STEPS[5])
  expect(himmelFarbe(50, 1)).toBe(STEPS[5])
  expect(himmelFarbe(10, undefined)).toBe(STEPS[1])
  expect(himmelFarbe(undefined, 1)).toBe('gray')
  expect(himmelFarbe(Infinity, 1)).toBe('gray')
})

// Vorgabe 14.10.2026: Der Punkt rechnet aus allen Werten der Zeile, nicht nur aus Wolken und Seeing
test('Himmels-Ampel aus allen Werten: Mond, Taupunkt-Abstand und Feuchte zählen mit', () => {
  // klar und trocken, Neumond: grün
  expect(himmelStufe(5, 2, { moon: 0, temp: 12, dewPoint: 2, hum: 50 })).toBe(1)
  // klar, aber Vollmond: höchstens gelbgrün
  expect(himmelStufe(0, 1, { moon: 100 })).toBe(4)
  // klar, aber Taupunkt 1 °C unter der Temperatur und 93 % Feuchte: Tau und Dunst, orange
  expect(himmelStufe(0, 1, { temp: 10, dewPoint: 9, hum: 93 })).toBe(8)
  // Werte vom 14.10.2026 früh (97 % Wolken, Station 13.3° / TP 11.7° / 90 %): rot
  expect(himmelStufe(97.3, 3, { moon: 50, temp: 13.3, dewPoint: 11.7, hum: 90 })).toBe(10)
  // mehrere mittlere Werte zusammen sind schlechter als einer allein
  expect(himmelStufe(40, 1, { moon: 100, hum: 88 })!).toBeGreaterThan(himmelStufe(40, 1)!)
  // ohne Wolkenwert keine Aussage; unbrauchbare Zusatzwerte zählen nicht
  expect(himmelStufe(undefined, 1, { moon: 0, hum: 50 })).toBeUndefined()
  expect(himmelStufe(0, 1, { moon: Number.NaN, temp: Infinity, dewPoint: 5, hum: undefined })).toBe(0)
  // der Punkt in der Zeile nimmt die Wetterwerte mit
  const n = { start: 0, end: 1, moon: 12.34, isWaxing: false, cloud: 8, seeing: 1, level: 'gut' as const }
  expect(nightParts(n)[0]?.color).toBe(STEPS[1])
  expect(nightParts(n, false, { temp: 10, dewPoint: 9, hum: 93 })[0]?.color).toBe(STEPS[8])
})

// Vorgabe 14.10.2026: mindestens zehn Stufen von grün über gelb nach rot, ungerade Zahl, damit Gelb genau in der Mitte steht
test('Ampel: elf Stufen, grün zuerst, Gelb in der Mitte, rot zuletzt, jede Stufe anders', () => {
  expect(STEPS.length).toBe(11)
  expect(STEPS[0]).toBe('#00C853')
  expect(STEPS[5]).toBe('#FFEA00')
  expect(STEPS[10]).toBe('#D50000')
  expect(new Set(STEPS).size).toBe(11)
  // jede Wolkenstufe von 0 bis 100 % in Zehnerschritten trifft eine eigene Stufe
  expect(new Set([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(c => himmelFarbe(c, 1))).size).toBe(11)
})

test('Mond: zwölf Stufen über einen Umlauf, Viertel und Vollmond an der richtigen Stelle', () => {
  const stufe = (iso: string) => {
    const m = moon(Date.parse(iso))
    return mondStufe(mondPhase(m.percent, m.isWaxing))
  }
  // Mondphasen Januar 2026: Vollmond 03.01., letztes Viertel 10.01., Neumond 18.01., erstes Viertel 26.01.
  expect([stufe('2026-01-03T10:00:00Z'), stufe('2026-01-10T15:00:00Z'), stufe('2026-01-18T20:00:00Z'), stufe('2026-01-26T05:00:00Z')]).toEqual([6, 9, 0, 3])
  const gesehen = new Set<number>()
  const t0 = Date.parse('2026-01-18T20:00:00Z')
  for (let d = 0; d < 29.6; d += 0.1) {
    const m = moon(t0 + d * 86400000)
    gesehen.add(mondStufe(mondPhase(m.percent, m.isWaxing)))
  }
  expect(gesehen.size).toBe(MOND_STUFEN)
})

test('Mond-Zeichen und Mond-Bild', () => {
  expect([mondEmoji(0), mondEmoji(0.125), mondEmoji(0.25), mondEmoji(0.5), mondEmoji(0.75), mondEmoji(0.875)]).toEqual(['🌑', '🌒', '🌓', '🌕', '🌗', '🌘'])
  expect([mondEmoji(0.125, true), mondEmoji(0.5, true)]).toEqual(['🌘', '🌕'])
  // Neumond: nur die dunkle Scheibe; Vollmond: helle Scheibe darüber
  expect(mondSvg(0)).not.toContain('<path')
  expect(mondSvg(6).match(/<circle/g)?.length).toBe(2)
  // zunehmend rechts hell (ohne Spiegelung), abnehmend und Südhalbkugel gespiegelt
  expect(mondSvg(3)).not.toContain('matrix(-1')
  expect(mondSvg(9)).toContain('matrix(-1')
  expect(mondSvg(3, true)).toContain('matrix(-1')
  // Sichel wölbt sich zur hellen Seite (Bogen 0), dreiviertel zur dunklen (Bogen 1); Halbmond gerade Grenze
  expect(mondSvg(1)).toMatch(/A[0-9.]+ 6\.5 0 0 0 8 1\.5Z/)
  expect(mondSvg(4)).toMatch(/A[0-9.]+ 6\.5 0 0 1 8 1\.5Z/)
  expect(mondSvg(3)).toContain('A0.000 6.5')
})

test('Kontextwarnung je einmal bei 75 und 90 %, nach Zusammenfassung wieder', () => {
  const seen = new Set<number>()
  expect(contextWarning(60, seen)).toBe(undefined)
  expect(contextWarning(76, seen)?.startsWith('Context 76.0%')).toBe(true)
  expect(contextWarning(80, seen)).toBe(undefined)
  expect(contextWarning(91, seen)?.includes('compact now')).toBe(true)
  expect(contextWarning(95, seen)).toBe(undefined)
  expect(contextWarning(20, seen)).toBe(undefined)
  expect(contextWarning(77, seen)).toBeDefined()
})

test('Seeing über die dunkle Zeit und zehn Farbstufen', () => {
  const f = { init: '2026100718', dataseries: [{ timepoint: 0, seeing: 2 }, { timepoint: 3, seeing: 4 }, { timepoint: 6, seeing: 8 }] }
  // 18:00–24:00 UTC: Punkte 18 und 21 Uhr
  expect(seeingDuring(f, Date.parse('2026-10-07T18:00:00Z'), Date.parse('2026-10-08T00:00:00Z'))).toBe(3)
  expect(seeingColor(1)).toBe('#00C853')
  expect(seeingColor(8)).toBe('#D50000')
  expect(seeingColor(4.5)).toBe(STEPS[5])
  expect(seeingColor(undefined)).toBe('gray')
})
