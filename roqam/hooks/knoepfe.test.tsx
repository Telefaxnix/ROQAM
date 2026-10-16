import { expect, mock, test } from 'claude-code/testing'

test('Knöpfe: Sichern füllt das Eingabefeld, Übergabe startet den Skill, Komprimieren nicht ohne Ja', async ($, on) => {
  mock.clock(on, { now: Date.parse('2026-10-07T10:00:00Z') })
  // an Stelle der Engine: leere Leiste, Befehle und Eingabefeld mitschreiben, Rückfrage beantworten
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  const gelaufen: string[] = []
  on('command.run', ($, e) => {
    gelaufen.push(e.command)
    return { text: '' }
  })
  const gefuellt: string[] = []
  on('prompt.fill', ($, e) => {
    gefuellt.push(e.text)
    return { isFilled: true }
  })
  // Rückfrage beim Komprimieren: weggeklickt, also darf nicht komprimiert werden
  on('tool.call', { tool: 'AskUserQuestion' }, () => ({ deny: 'weggeklickt' }))
  for (const surface of ['desktop', 'terminal'] as const) {
    gelaufen.length = 0
    gefuellt.length = 0
    const ui = await $.ui.mount({
      plugin: 'roqam',
      surface,
      component: 'AbovePrompt',
      props: { bodyColumns: 160 },
      viewport: { columns: 160, rows: 40 },
    })
    await ui.post({ aktion: 'sichern' }, { in: 'knopf-sichern' })
    expect(gefuellt.length).toBe(1)
    expect(gefuellt[0].startsWith('Save: Go through this chat')).toBe(true)
    // bewusster Auftrag: direkt eintragen, keine Liste zur Freigabe
    expect(gefuellt[0].includes('right away, without asking')).toBe(true)
    expect(gefuellt[0].includes('nach meinem Ja')).toBe(false)
    // Sichern schickt nichts ab und startet keinen Befehl
    expect(gelaufen).toEqual([])
    await ui.post({ aktion: 'uebergabe' }, { in: 'knopf-uebergabe' })
    await ui.post({ aktion: 'komprimieren' }, { in: 'knopf-komprimieren' })
    expect(gelaufen).toEqual(['handoff'])
    await ui.unmount()
  }
})
