import { expect, mock, test } from 'claude-code/testing'

// Die Leiste mit allem, was sie zeigen kann (Guthaben, API-Kosten, Update, Aktion, GitHub-Störung, Chats, Connectors):
// Am 09.10.2026 brach das Zeichnen ab, sobald ein Guthaben da war (card() mit altem Farb-Argument), und in der App
// blieben nur die drei Vorschläge. Die übrigen Tests zeichnen ohne Guthaben und merkten nichts. Vom 15. bis 16.10.2026
// zeigte die Leiste keine Guthaben; seither wieder, aber nur aktuelle und nicht eingelöste (Vorgabe Dominik).

// Kärtchen deckend (Vorgabe 15.10.2026): jedes Kärtchen sitzt mit bottom 0 auf einem Anker (absolut, top 0) an der
// Oberkante seines Worts. Mit bottom 1 ragte es in eine zweizeilige Zeile, und die Wörter rechts davon lagen darüber.
function kaertchenLage(k: unknown, eltern: Record<string, unknown> = {}, out: string[] = []): string[] {
  if (!k || typeof k !== 'object') return out
  if (Array.isArray(k)) {
    for (const x of k) kaertchenLage(x, eltern, out)
    return out
  }
  const n = k as { type?: string; props?: Record<string, unknown>; children?: unknown }
  if (n.type === 'Box' && n.props?.borderStyle === 'round')
    out.push(n.props.bottom === 0 && eltern.position === 'absolute' && eltern.top === 0 ? 'auf Anker' : `bottom ${String(n.props.bottom)}, Anker ${JSON.stringify(eltern)}`)
  kaertchenLage(n.children, n.props ?? {}, out)
  return out
}

test('Leiste mit Guthaben und allen Kärtchen zeichnet ohne Absturz; eingelöste fehlen, die Aktion nennt die Änderung', { options: { apiCost: true, promotions: true } }, async ($, on) => {
  mock.clock(on, { now: Date.parse('2026-10-07T10:00:00Z') })
  mock.store(on)
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  const daten = {
    ctx: 8,
    fiveHour: 6,
    week: 9,
    costUsd: 1.5,
    usdChf: 0.8,
    periodUsd: 120,
    projectUsd: 40,
    projectName: 'Test',
    neueAktion: true,
    aktionZeilen: ['Guest passes: 3 of 3 left, referral bonus 10 $', 'More: claude.ai › Settings › Usage'],
    guthaben: [
      { name: 'Cloud credit', kurz: 'Cloud $', rest: 20, total: 50, einheit: 'USD', ablauf: '2026-11-30T23:00:00Z' },
      { name: 'Gratis-Reset', ablauf: '2026-10-10T22:00:00Z' },
      // schon eingelöst: erscheint nicht
      { name: 'Eingelöster Gutschein', ablauf: '2026-12-01T00:00:00Z', verbraucht: true },
    ],
  }
  const sys = {
    status: { indicator: 'none', description: 'Alles in Betrieb', incidents: [] },
    model: 'Opus 5.5',
    effort: 'Medium',
    version: '2.1.0',
    latest: '2.2.0',
    chats: [{ name: 'Test-Chat', where: 'App', status: 'offen', isSelf: true }],
    connectors: ['Higgsfield'],
    abgleich: ['Push abgelehnt'],
  }
  // an Stelle der Engine: die Werte, die die Leiste beim Zeichnen liest
  on('state.get', { plugin: 'roqam', key: 'data' }, () => ({ value: { value: daten, version: 1 } }))
  on('state.get', { plugin: 'roqam', key: 'system' }, () => ({ value: { value: sys, version: 1 } }))
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({
      plugin: 'roqam',
      surface,
      component: 'AbovePrompt',
      props: { bodyColumns: 160 },
      viewport: { columns: 160, rows: 40 },
    })
    // jedes aktuelle Guthaben samt Kärtchen ist da, ebenso die übrigen Teile (ganzer Baum als Text: Knöpfe und
    // selbst gezeichnete Wörter tragen ihren Text in den Props); das eingelöste fehlt
    const baum = JSON.stringify(await ui.drawn())
    const fehlt = ['Cloud $', 'Gratis-Reset', 'Cloud credit: 20', 'API: ', '"Update"', 'New promotion', 'Guest passes: 3 of 3 left', 'GitHub', 'Connectors', 'Save']
      .filter(t => !baum.includes(t))
      .map(t => `${surface}: ${t}`)
    expect(fehlt).toEqual([])
    expect(`${surface}: ${baum.includes('Eingelöster Gutschein')}`).toBe(`${surface}: false`)
    // kurz «API:» und «Update» ohne Nummer; jedes Kärtchen deckend auf seinem Anker (Vorgabe 15.10.2026)
    expect(baum).not.toContain('Update 2.2.0')
    expect(baum).not.toContain('API cost:')
    const lage = kaertchenLage(JSON.parse(baum))
    expect(`${surface}: ${lage.length > 3}`).toBe(`${surface}: true`)
    expect(lage.filter(l => l !== 'auf Anker').map(l => `${surface}: ${l}`)).toEqual([])
    await ui.unmount()
  }
})
