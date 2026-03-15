import { isAddress } from 'web3-validator'

export function toUSDCurrency(n: number | string): string {
  n = String(n)
  const pointIndex = n.indexOf('.')

  let lastIndex
  let s
  if (pointIndex === -1) {
    s = ''
    lastIndex = n.length
  } else {
    lastIndex = pointIndex
    s = n.substring(pointIndex)
  }

  let i
  for (i = lastIndex - 3; i > 0; i -= 3) {
    s = `,${n.substring(i, i + 3)}${s}`
  }

  return `$${n.substring(0, i + 3)}${s}`
}

export function formatCompact(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B'
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M'
  if (abs >= 1_000) return (n / 1_000).toFixed(2) + 'K'
  return n.toFixed(2)
}

export function toUSDCompact(n: number): string {
  return '$' + formatCompact(n)
}

export function extractAddresses(str: string): string[] {
  return str.split(',').map((s) => s.replace(' ', ''))
}

export function invalidAddresses(str: string) {
  const addresses = extractAddresses(str)

  const addr: { [a: string]: true } = {}
  return (
    addresses.find((a) => {
      if (addr[a]) return a
      addr[a] = true
      return !isAddress(a)
    }) !== undefined
  )
}
