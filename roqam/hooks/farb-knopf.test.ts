import { expect, test } from 'claude-code/testing'
import { hell } from './farb-knopf'

test('Maus darüber: Farbe heller, Text und Schrift gleich', () => {
  expect(hell({ text: 'Claude ', color: '#EC7E7E' })).toEqual({ text: 'Claude ', color: '#F5B8B8' })
  expect(hell({ text: 'Update 2.1.295', color: 'yellow' }).color).toBe('#FFF3A0')
  expect(hell({ text: 'v2.1.293', dim: true })).toEqual({ text: 'v2.1.293', dim: false })
  expect(hell({ text: '⚑ New promotion', color: 'yellow', bold: true }).bold).toBe(true)
  expect(hell({ text: 'ohne Farbe' })).toEqual({ text: 'ohne Farbe' })
})
