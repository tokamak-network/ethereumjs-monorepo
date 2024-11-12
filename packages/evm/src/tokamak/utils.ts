export const powMod = (base: bigint, exponent: bigint, modulus: bigint): bigint => {
  if (modulus === 1n) return 0n

  let result = 1n
  base = base % modulus

  while (exponent > 0n) {
    if (exponent % 2n === 1n) {
      result = (result * base) % modulus
    }
    base = (base * base) % modulus
    exponent = exponent >> 1n
  }
  return result
}
