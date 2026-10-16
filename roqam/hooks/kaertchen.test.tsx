import { expect, mock, test } from 'claude-code/testing'

// Kärtchen schliessen (09.10.2026): In der App blieb ein offenes Kärtchen stehen, bis der Benutzer etwas eingab.
// Ein zweiter Klick auf das Wort und 30 s ohne Klick müssen es schliessen.

test('Kärtchen schliesst per zweitem Klick und nach 30 s', { options: { apiCost: true } }, async ($, on) => {
  const uhr = mock.clock(on, { now: Date.parse('2026-10-07T10:00:00Z') })
  mock.store(on)
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  const daten = { ctx: 8, fiveHour: 6, week: 9, costUsd: 1.5, usdChf: 0.8, periodUsd: 120, projectUsd: 40, projectName: 'Test' }
  on('state.get', { plugin: 'roqam', key: 'data' }, () => ({ value: { value: daten, version: 1 } }))
  const sichtbar = async (ui: { drawn: () => Promise<unknown> }) => {
    // das Kosten-Kärtchen ist der Kasten mit dem Text «API-Kosten at list price»; offen = display flex
    const finde = (n: unknown): string | undefined => {
      if (!n || typeof n !== 'object') return undefined
      const o = n as { props?: Record<string, unknown>; children?: unknown }
      if (o.props?.borderStyle === 'round' && JSON.stringify(o).includes('at list price')) return String(o.props.display)
      for (const k of Object.values(o)) {
        const r = Array.isArray(k) ? k.map(finde).find(Boolean) : finde(k)
        if (r) return r
      }
      return undefined
    }
    return finde(await ui.drawn())
  }
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({
      plugin: 'roqam',
      surface,
      component: 'AbovePrompt',
      props: { bodyColumns: 160 },
      viewport: { columns: 160, rows: 40 },
    })
    expect(`${surface} zu: ${await sichtbar(ui)}`).toBe(`${surface} zu: none`)
    await ui.post({ kaertchen: 'kosten' }, { in: 'klick-kosten' })
    expect(`${surface} offen: ${await sichtbar(ui)}`).toBe(`${surface} offen: flex`)
    await ui.post({ kaertchen: 'kosten' }, { in: 'klick-kosten' })
    expect(`${surface} 2. Klick: ${await sichtbar(ui)}`).toBe(`${surface} 2. Klick: none`)
    // Klick auf den Text im Kärtchen
    await ui.post({ kaertchen: 'kosten' }, { in: 'klick-kosten' })
    await ui.post({ aktion: 'kaertchen-zu' }, { in: 'kosten-0' })
    expect(`${surface} Klick aufs Kärtchen: ${await sichtbar(ui)}`).toBe(`${surface} Klick aufs Kärtchen: none`)
    await ui.post({ kaertchen: 'kosten' }, { in: 'klick-kosten' })
    await uhr.advance(31 * 1000)
    expect(`${surface} 30 s: ${await sichtbar(ui)}`).toBe(`${surface} 30 s: none`)
    await ui.unmount()
  }
})
