import { LIMITS } from '../config/detector.js'

const AMOUNT_PATTERN = /^\d+(?:\.\d{1,2})?$/

export function parseAmountToPaise(input: string): number | null {
  const value = input.trim()
  if (!AMOUNT_PATTERN.test(value)) {
    return null
  }

  const [wholePart, fractionalPart = ''] = value.split('.')
  const paise = BigInt(wholePart) * 100n + BigInt(fractionalPart.padEnd(2, '0') || '0')
  if (paise <= 0n || paise > BigInt(LIMITS.maxAmountPaise)) {
    return null
  }

  return Number(paise)
}

export function formatRupees(amountPaise: number, withDecimals = true): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: withDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amountPaise / 100)
}

export function formatCompactRupees(amountPaise: number): string {
  return formatRupees(amountPaise, false)
}
