import { describe, expect, it } from 'vitest'
import { LIMITS } from '../config/detector'
import { parseAmountToPaise } from '../engine/money'
import { parseCsvText, validateRows } from '../engine/validate'

const validRow = {
  transaction_id: 'T001',
  timestamp: '2026-09-18T10:00:00+05:30',
  from_account: 'A001',
  to_account: 'A101',
  amount: '5000.00',
  currency: 'INR',
}

describe('FINTRACE input validation', () => {
  it('converts rupee strings to exact integer paise without floating point parsing', () => {
    expect(parseAmountToPaise('5000')).toBe(500_000)
    expect(parseAmountToPaise('0.01')).toBe(1)
    expect(parseAmountToPaise('0005.5')).toBe(550)
    expect(parseAmountToPaise('5000.000')).toBeNull()
    expect(parseAmountToPaise('1e3')).toBeNull()
    expect(parseAmountToPaise('₹10')).toBeNull()
    expect(parseAmountToPaise('0.00')).toBeNull()
    expect(parseAmountToPaise(String((LIMITS.maxAmountPaise / 100) + 1))).toBeNull()
  })

  it('accepts valid records, preserves IDs and sorts unsorted input with a warning', () => {
    const result = validateRows([
      { ...validRow, transaction_id: '0002', timestamp: '2026-09-18T10:01:00+05:30' },
      { ...validRow, transaction_id: '0001', timestamp: '2026-09-18T10:00:00+05:30' },
    ])
    expect(result.ok).toBe(true)
    expect(result.transactions.map((transaction) => transaction.id)).toEqual(['0001', '0002'])
    expect(result.warnings.join(' ')).toContain('sorted')
  })

  it('parses quoted CSV values, trims headers, ignores extra columns and keeps the active contract', () => {
    const csv = [
      '\uFEFF transaction_id , timestamp, from_account, to_account, amount, currency, memo',
      'T001,2026-09-18T10:00:00+05:30,A001,A101,"5000.00",INR,"customer, one"',
    ].join('\n')
    const result = parseCsvText(csv)
    expect(result.ok).toBe(true)
    expect(result.transactions[0]).toMatchObject({ id: 'T001', amountPaise: 500_000, currency: 'INR' })
    expect(result.warnings.join(' ')).toContain('Ignored extra column')
  })

  it('rejects duplicate IDs, self-transfers, invalid dates, currencies and amounts as a whole file', () => {
    const result = validateRows([
      validRow,
      { ...validRow, timestamp: '2026-02-30T10:00:00+05:30', amount: '-1', currency: 'USD' },
      { ...validRow, transaction_id: 'T001', from_account: 'A2', to_account: 'A2' },
    ])
    expect(result.ok).toBe(false)
    expect(result.transactions).toEqual([])
    expect(result.errors.map((error) => error.message).join(' ')).toMatch(/Duplicate transaction ID/)
    expect(result.errors.map((error) => error.message).join(' ')).toMatch(/Self-transfers/)
    expect(result.errors.map((error) => error.message).join(' ')).toMatch(/valid ISO 8601/)
    expect(result.errors.map((error) => error.message).join(' ')).toMatch(/Only INR/)
  })

  it('rejects missing columns, empty/header-only files and oversized input', () => {
    const missing = parseCsvText('transaction_id,timestamp\nT1,2026-09-18T10:00:00Z')
    expect(missing.ok).toBe(false)
    expect(missing.errors.map((error) => error.message).join(' ')).toContain('Missing required column')
    expect(parseCsvText('transaction_id,timestamp,from_account,to_account,amount,currency').ok).toBe(false)
    expect(parseCsvText('').ok).toBe(false)
    expect(parseCsvText('x', LIMITS.maxFileBytes + 1).ok).toBe(false)
  })

  it('rejects duplicate headers and ambiguous timestamps', () => {
    const duplicateHeaders = parseCsvText([
      'transaction_id,timestamp,from_account,to_account,amount,currency,currency',
      'T1,2026-09-18T10:00:00,A,B,1.00,INR,INR',
    ].join('\n'))
    expect(duplicateHeaders.ok).toBe(false)
    expect(duplicateHeaders.errors.map((error) => error.message).join(' ')).toContain('Duplicate column header')

    const ambiguousTime = validateRows([{ ...validRow, timestamp: '2026-09-18 10:00:00' }])
    expect(ambiguousTime.ok).toBe(false)
  })
})
