// Zwei Bereit-Töne (Vorgabe 14.10.2026): Standard die weiche Quinte (bereit.wav), wählbar der frühere hellere Ton
// (bereit-klassisch.wav). Die Wahl steht im $.store (TON_KEY); umgeschaltet wird per zweitem Geheimwort — das Wort
// selbst prüft nur der private Test geheimwort.test.tsx, hier geht es um Datei, Meldung und Abspielen.
import { expect, mock, test } from 'claude-code/testing'

import { bereitKlang, klangBefehl, TON_KEY, tonMeldung } from './klang'
import { SONDERMODUS_KEY } from './sondermodus-farben'

type Body = Extract<Parameters<typeof test>[1], (...a: never[]) => unknown>
type On = Parameters<Body>[1]
const T0 = Date.parse('2026-10-14T10:00:00Z')

function basis(on: On, gestartet: string[], store: Record<string, unknown>) {
  mock.store(on, store)
  mock.env(on, { USERPROFILE: 'C:/U' })
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 1000, window: 200000, percent: 0 }, rateLimits: [] } }) as never)
  on('command.register', () => ({ value: {} }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }) as never)
  on('tool.list', () => ({ value: [] }) as never)
  on('agent.list', () => ({ value: [] }) as never)
  on('process.run', ($, e) => {
    gestartet.push(e.argv.join(' '))
    return { value: { stdout: '', stderr: '', exitCode: 0 } } as never
  })
  on('fs.write', () => ({ value: undefined }) as never)
  on('fs.read', () => {
    throw new Error('nope')
  })
  on('fs.list', () => ({ value: [] }) as never)
  on('http.fetch', () => {
    throw new Error('offline')
  })
  on('turn.start', ($, e) => ({ turnId: e.turnId }) as never)
  on('turn.complete', ($, e) => ({ text: (e as { answer: string }).answer }) as never)
  on('model.complete', () => ({ value: { isAnswered: true, text: '-' } }) as never)
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
}

test('Bereit-Ton: Datei nach Wahl, Befehl mit dem richtigen Pfad, Meldung aus dem Wort gebaut', () => {
  expect(bereitKlang(false)).toBe('bereit')
  expect(bereitKlang(true)).toBe('bereit-klassisch')
  expect(klangBefehl('C:\\M', 'bereit-klassisch')[4]).toBe("(New-Object Media.SoundPlayer 'C:\\M\\klang\\bereit-klassisch.wav').PlaySync()")
  expect(tonMeldung('xyz', true)).toBe('XYZ: Quittierton klassisch (hell). Mit xyz zurück zur Quinte.')
  expect(tonMeldung('xyz', false)).toBe('XYZ: Quittierton Quinte (weich). Mit xyz zurück zum klassischen.')
})

for (const [klassisch, datei] of [
  [undefined, '\\klang\\bereit.wav'],
  [true, '\\klang\\bereit-klassisch.wav'],
] as const) {
  test(`Sondermodus: nach einer langen Antwort spielt ${datei.split('\\').pop()}`, async ($, on) => {
    const uhr = mock.clock(on, { now: T0 })
    const gestartet: string[] = []
    basis(on, gestartet, { [SONDERMODUS_KEY]: true, ...(klassisch ? { [TON_KEY]: true } : {}) })
    await $.session.start({ cwd: 'C:/P' } as never)
    await uhr.settle()
    await $.turn.start({ text: 'Bau etwas', turnId: 't1' })
    await uhr.advance(30000)
    await $.turn.complete({ turnId: 't1', answer: 'Fertig.', durationMs: 30000, reason: 'answer' } as never)
    await uhr.settle()
    const toene = gestartet.filter(a => a.includes('.wav'))
    expect(toene.length).toBe(1)
    expect(toene[0]).toContain(datei)
  })
}
