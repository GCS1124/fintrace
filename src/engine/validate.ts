import Papa from 'papaparse'
import { LIMITS } from '../config/detector'
import { parseAmountToPaise } from './money'
import type { Transaction, ValidationIssue, ValidationResult } from '../types'

export const REQUIRED_COLUMNS = [
  'transaction_id',
  'timestamp',
  'from_account',
  'to_account',
  'amount',
  'currency',
] as const

const ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/
const TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:?\d{2})$/

function makeIssue(message: string, row?: number, field?: string): ValidationIssue {
  return { message, ...(row === undefined ? {} : { row }), ...(field ? { field } : {}) }
}

function normaliseHeader(header: string, index: number): string {
  const withoutBom = index === 0 ? header.replace(/^\uFEFF/, '') : header
  return withoutBom.trim()
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

function parseExplicitIsoTimestamp(value: string): number | null {
  const match = TIMESTAMP_PATTERN.exec(value.trim())
  if (!match) return null

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fractionText, zone] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const second = Number(secondText ?? '0')

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month) ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return null
  }

  if (zone !== 'Z') {
    const offsetMatch = /^[+-](\d{2}):?(\d{2})$/.exec(zone)
    if (!offsetMatch || Number(offsetMatch[1]) > 23 || Number(offsetMatch[2]) > 59) {
      return null
    }
  }

  const timestampMs = Date.parse(value.trim())
  if (!Number.isFinite(timestampMs)) return null

  // Epoch milliseconds cannot represent more than three fractional digits exactly.
  if (fractionText && fractionText.length > 3) return null

  return timestampMs
}

function failedResult(
  errors: readonly ValidationIssue[],
  inputRowCount: number,
  warnings: readonly string[] = [],
): ValidationResult {
  return { ok: false, transactions: [], errors, warnings, inputRowCount }
}

export function validateRows(rows: readonly Record<string, string>[]): ValidationResult {
  if (rows.length === 0) {
    return failedResult([makeIssue('The file has a header but no transaction rows.')], 0)
  }

  const errors: ValidationIssue[] = []
  const transactions: Transaction[] = []
  const seenIds = new Map<string, number>()
  let previousTimestampMs: number | undefined
  let inputWasUnsorted = false

  if (rows.length > LIMITS.maxTransactions) {
    errors.push(
      makeIssue(
        `The file contains ${rows.length.toLocaleString()} transaction rows; the limit is ${LIMITS.maxTransactions.toLocaleString()}.`,
      ),
    )
  }

  rows.forEach((row, index) => {
    const rowNumber = index + 2
    const id = (row.transaction_id ?? '').trim()
    const timestampText = (row.timestamp ?? '').trim()
    const fromAccount = (row.from_account ?? '').trim()
    const toAccount = (row.to_account ?? '').trim()
    const amountText = (row.amount ?? '').trim()
    const currency = (row.currency ?? '').trim().toUpperCase()

    if (!ID_PATTERN.test(id)) {
      errors.push(makeIssue('Use 1-40 letters, digits, underscores or hyphens for the transaction ID.', rowNumber, 'transaction_id'))
    } else if (seenIds.has(id)) {
      errors.push(
        makeIssue(
          `Duplicate transaction ID; it first appears on row ${seenIds.get(id)}.`,
          rowNumber,
          'transaction_id',
        ),
      )
    } else {
      seenIds.set(id, rowNumber)
    }

    const timestampMs = parseExplicitIsoTimestamp(timestampText)
    if (timestampMs === null) {
      errors.push(
        makeIssue(
          'Use a valid ISO 8601 timestamp with an explicit Z or numeric offset, for example 2026-09-18T10:00:00+05:30.',
          rowNumber,
          'timestamp',
        ),
      )
    } else {
      if (previousTimestampMs !== undefined && timestampMs < previousTimestampMs) inputWasUnsorted = true
      previousTimestampMs = timestampMs
    }

    if (!ID_PATTERN.test(fromAccount)) {
      errors.push(makeIssue('Use 1-40 letters, digits, underscores or hyphens for the sender account.', rowNumber, 'from_account'))
    }
    if (!ID_PATTERN.test(toAccount)) {
      errors.push(makeIssue('Use 1-40 letters, digits, underscores or hyphens for the receiver account.', rowNumber, 'to_account'))
    }
    if (fromAccount && toAccount && fromAccount === toAccount) {
      errors.push(makeIssue('Self-transfers are not supported in this prototype.', rowNumber, 'to_account'))
    }

    const amountPaise = parseAmountToPaise(amountText)
    if (amountPaise === null) {
      errors.push(
        makeIssue(
          `Enter a positive rupee amount with zero, one or two decimal places, up to INR ${(LIMITS.maxAmountPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}.`,
          rowNumber,
          'amount',
        ),
      )
    }

    if (currency !== 'INR') {
      errors.push(makeIssue('Only INR transactions are supported; currencies are not mixed.', rowNumber, 'currency'))
    }

    if (
      ID_PATTERN.test(id) &&
      timestampMs !== null &&
      ID_PATTERN.test(fromAccount) &&
      ID_PATTERN.test(toAccount) &&
      fromAccount !== toAccount &&
      amountPaise !== null &&
      currency === 'INR' &&
      !transactions.some((transaction) => transaction.id === id)
    ) {
      transactions.push({
        id,
        timestampMs,
        fromAccount,
        toAccount,
        amountPaise,
        currency: 'INR',
      })
    }
  })

  if (errors.length > 0) return failedResult(errors, rows.length)

  const sortedTransactions = [...transactions].sort(
    (left, right) => left.timestampMs - right.timestampMs || left.id.localeCompare(right.id),
  )
  const warnings = inputWasUnsorted
    ? ['Rows were sorted by timestamp and transaction ID for deterministic analysis.']
    : []

  return {
    ok: true,
    transactions: sortedTransactions,
    errors: [],
    warnings,
    inputRowCount: rows.length,
  }
}

export function parseCsvText(csvText: string, inputBytes = new TextEncoder().encode(csvText).byteLength): ValidationResult {
  if (inputBytes > LIMITS.maxFileBytes) {
    return failedResult(
      [makeIssue(`The file is ${(inputBytes / (1024 * 1024)).toFixed(2)} MiB; the limit is 2 MiB.`)],
      0,
    )
  }

  const parsed = Papa.parse<string[]>(csvText, {
    dynamicTyping: false,
    header: false,
    skipEmptyLines: 'greedy',
  })
  const parseErrors = parsed.errors.map((error) =>
    makeIssue(`CSV parser error: ${error.message}`, error.row === undefined ? undefined : error.row + 2),
  )
  const rows = parsed.data

  if (rows.length === 0) return failedResult([...parseErrors, makeIssue('The CSV is empty.')], 0)

  const headers = rows[0].map((header, index) => normaliseHeader(String(header ?? ''), index))
  const headerErrors: ValidationIssue[] = []
  const uniqueHeaders = new Set<string>()

  headers.forEach((header) => {
    if (!header) headerErrors.push(makeIssue('Header names cannot be empty.', 1))
    if (uniqueHeaders.has(header)) headerErrors.push(makeIssue(`Duplicate column header: ${header || '(blank)'}.`, 1))
    uniqueHeaders.add(header)
  })

  REQUIRED_COLUMNS.forEach((requiredColumn) => {
    if (!uniqueHeaders.has(requiredColumn)) {
      headerErrors.push(makeIssue(`Missing required column: ${requiredColumn}.`, 1, requiredColumn))
    }
  })

  if (headerErrors.length > 0 || parseErrors.length > 0) {
    return failedResult([...headerErrors, ...parseErrors], Math.max(rows.length - 1, 0))
  }

  const extraHeaders = headers.filter((header) => !REQUIRED_COLUMNS.includes(header as (typeof REQUIRED_COLUMNS)[number]))
  const warnings = extraHeaders.length > 0 ? [`Ignored extra column${extraHeaders.length > 1 ? 's' : ''}: ${extraHeaders.join(', ')}.`] : []
  const dataRows = rows.slice(1).map((cells) => {
    const record: Record<string, string> = {}
    headers.forEach((header, index) => {
      if (header) record[header] = String(cells[index] ?? '')
    })
    return record
  })

  if (dataRows.length === 0) return failedResult([makeIssue('The file has a header but no transaction rows.')], 0, warnings)

  const result = validateRows(dataRows)
  return {
    ...result,
    errors: [...result.errors, ...parseErrors],
    warnings: [...warnings, ...result.warnings],
    ok: result.ok && parseErrors.length === 0,
  }
}

export async function parseCsvFile(file: File): Promise<ValidationResult> {
  if (file.size > LIMITS.maxFileBytes) {
    return failedResult(
      [makeIssue(`The file is ${(file.size / (1024 * 1024)).toFixed(2)} MiB; the limit is 2 MiB.`)],
      0,
    )
  }
  const text = await file.text()
  return parseCsvText(text, file.size)
}
