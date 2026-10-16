import { expect, mock, test } from 'claude-code/testing'

// Rückfrage beantworten wie der Mensch: die Antwort steht unter der Frage
function antworte(on: Parameters<Parameters<typeof test>[1]>[1], label: string, fragen: string[]) {
  on('tool.call', { tool: 'AskUserQuestion' }, ($, e) => {
    const q = (e as unknown as { questions: { question: string }[] }).questions[0].question
    fragen.push(q)
    return { result: { questions: [], answers: { [q]: label } } }
  })
}

test('Wächter: dritter gleicher Aufruf in Folge wird nach «Abbrechen» abgelehnt', async ($, on) => {
  mock.clock(on, { now: Date.parse('2026-10-07T20:00:00Z') })
  on('tool.call', { tool: 'Bash' }, () => ({ result: 'ok' }))
  const fragen: string[] = []
  antworte(on, 'Abbrechen', fragen)
  const a = await $.tool.call({ tool: 'Bash', command: 'ls' })
  const b = await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect('deny' in a || 'deny' in b).toBe(false)
  expect(fragen.length).toBe(0)
  const c = await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect(fragen.length).toBe(1)
  expect(fragen[0]).toContain('zum 3. Mal')
  expect('deny' in c && String(c.deny).startsWith('Wächter:')).toBe(true)
})

test('Wächter: nach «Weiterlaufen» keine weitere Frage für denselben Aufruf', async ($, on) => {
  mock.clock(on, { now: Date.parse('2026-10-07T20:00:00Z') })
  on('tool.call', { tool: 'Bash' }, () => ({ result: 'ok' }))
  const fragen: string[] = []
  antworte(on, 'Weiterlaufen', fragen)
  for (let i = 0; i < 5; i++) {
    const r = await $.tool.call({ tool: 'Bash', command: 'sleep 1' })
    expect('deny' in r).toBe(false)
  }
  expect(fragen.length).toBe(1)
})
