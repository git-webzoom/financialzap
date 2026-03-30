/**
 * Tests for campanha.service.js — divideContacts
 * Run with: node src/tests/campanha.service.test.js
 */

const assert = require('assert')
const { divideContacts } = require('../services/campanha.service')

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeContacts(n) {
  return Array.from({ length: n }, (_, i) => ({ id: i + 1, phone: `5511900000${String(i).padStart(3, '0')}` }))
}

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (err) {
    console.error(`  ✗ ${name}`)
    console.error(`    ${err.message}`)
    failed++
  }
}

// ─── Equal mode ───────────────────────────────────────────────────────────────

console.log('\nEqual split')

test('divides evenly across 3 templates (9 contacts)', () => {
  const contacts = makeContacts(9)
  const result   = divideContacts(contacts, ['t1', 't2', 't3'])

  assert.strictEqual(result.length, 3)
  assert.strictEqual(result[0].count, 3)
  assert.strictEqual(result[1].count, 3)
  assert.strictEqual(result[2].count, 3)
})

test('remainder goes to the last template (10 contacts ÷ 3)', () => {
  const contacts = makeContacts(10)
  const result   = divideContacts(contacts, ['t1', 't2', 't3'])

  assert.strictEqual(result[0].count, 3)
  assert.strictEqual(result[1].count, 3)
  assert.strictEqual(result[2].count, 4)  // 10 - 3 - 3 = 4
})

test('all contacts go to the single template', () => {
  const contacts = makeContacts(7)
  const result   = divideContacts(contacts, ['t1'])

  assert.strictEqual(result.length, 1)
  assert.strictEqual(result[0].count, 7)
  assert.strictEqual(result[0].templateId, 't1')
})

test('total contact count preserved across all slices', () => {
  const contacts = makeContacts(1000)
  const result   = divideContacts(contacts, ['t1', 't2', 't3', 't4'])

  const total = result.reduce((s, r) => s + r.count, 0)
  assert.strictEqual(total, 1000)
})

test('contacts are sequential and non-overlapping', () => {
  const contacts = makeContacts(6)
  const result   = divideContacts(contacts, ['t1', 't2'])

  assert.deepStrictEqual(result[0].contacts.map(c => c.id), [1, 2, 3])
  assert.deepStrictEqual(result[1].contacts.map(c => c.id), [4, 5, 6])
})

test('2 templates with odd number (7 contacts)', () => {
  const contacts = makeContacts(7)
  const result   = divideContacts(contacts, ['t1', 't2'])

  assert.strictEqual(result[0].count, 3)
  assert.strictEqual(result[1].count, 4)
})

// ─── Weighted mode ────────────────────────────────────────────────────────────

console.log('\nWeighted split')

test('exact percentages split 100 contacts as 40/35/25', () => {
  const contacts = makeContacts(100)
  const result   = divideContacts(contacts, ['t1', 't2', 't3'], {
    mode: 'weighted', weights: [40, 35, 25],
  })

  assert.strictEqual(result[0].count, 40)
  assert.strictEqual(result[1].count, 35)
  assert.strictEqual(result[2].count, 25)
})

test('total contact count preserved in weighted mode (1000 contacts)', () => {
  const contacts = makeContacts(1000)
  const result   = divideContacts(contacts, ['t1', 't2', 't3'], {
    mode: 'weighted', weights: [50, 30, 20],
  })

  const total = result.reduce((s, r) => s + r.count, 0)
  assert.strictEqual(total, 1000)
})

test('weighted: non-round split (10 contacts, weights 33/33/34)', () => {
  const contacts = makeContacts(10)
  const result   = divideContacts(contacts, ['t1', 't2', 't3'], {
    mode: 'weighted', weights: [33, 33, 34],
  })

  const total = result.reduce((s, r) => s + r.count, 0)
  assert.strictEqual(total, 10)
  result.forEach(r => assert.ok(r.count >= 0, `count should be >= 0, got ${r.count}`))
})

test('weighted: unnormalized weights (not summing to 100) still work', () => {
  // weights 1:1:1 is same as 33/33/34 on 9 contacts
  const contacts = makeContacts(9)
  const result   = divideContacts(contacts, ['t1', 't2', 't3'], {
    mode: 'weighted', weights: [1, 1, 1],
  })

  const total = result.reduce((s, r) => s + r.count, 0)
  assert.strictEqual(total, 9)
  result.forEach(r => assert.strictEqual(r.count, 3))
})

test('weighted: single template with 100% weight', () => {
  const contacts = makeContacts(50)
  const result   = divideContacts(contacts, ['t1'], {
    mode: 'weighted', weights: [100],
  })

  assert.strictEqual(result[0].count, 50)
})

test('weighted: largest-remainder assigns extra contact to highest fractional part', () => {
  // 10 contacts, 3 templates with equal weight → 3.33 each
  // two get 3, one gets 4 (highest fractional = first one over the tie)
  const contacts = makeContacts(10)
  const result   = divideContacts(contacts, ['t1', 't2', 't3'], {
    mode: 'weighted', weights: [1, 1, 1],
  })

  const total = result.reduce((s, r) => s + r.count, 0)
  assert.strictEqual(total, 10)
  const counts = result.map(r => r.count).sort((a, b) => a - b)
  assert.deepStrictEqual(counts, [3, 3, 4])
})

// ─── Error handling ───────────────────────────────────────────────────────────

console.log('\nError handling')

test('throws on empty contacts array', () => {
  assert.throws(
    () => divideContacts([], ['t1']),
    /contacts deve ser um array não vazio/
  )
})

test('throws on empty templateIds array', () => {
  assert.throws(
    () => divideContacts(makeContacts(5), []),
    /templateIds deve ser um array não vazio/
  )
})

test('throws on unknown mode', () => {
  assert.throws(
    () => divideContacts(makeContacts(5), ['t1'], { mode: 'random' }),
    /Modo desconhecido/
  )
})

test('throws when weights length mismatches templateIds', () => {
  assert.throws(
    () => divideContacts(makeContacts(5), ['t1', 't2'], { mode: 'weighted', weights: [100] }),
    /mesmo número de elementos/
  )
})

test('throws when all weights are zero', () => {
  assert.throws(
    () => divideContacts(makeContacts(5), ['t1', 't2'], { mode: 'weighted', weights: [0, 0] }),
    /soma dos pesos não pode ser zero/
  )
})

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
