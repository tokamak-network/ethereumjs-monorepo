import { convertToSigned } from './utils.js'

/**
 * Synthesizer 산술 연산을 처리하는 유틸리티 클래스
 */
export class ArithmeticOperations {
  private static readonly MAX_UINT256 = (1n << 256n) - 1n

  /**
   * 기본 산술 연산
   */
  static add(a: bigint, b: bigint): bigint {
    return (a + b) & ArithmeticOperations.MAX_UINT256
  }

  static mul(a: bigint, b: bigint): bigint {
    return (a * b) & ArithmeticOperations.MAX_UINT256
  }

  static sub(a: bigint, b: bigint): bigint {
    return (a - b) & ArithmeticOperations.MAX_UINT256
  }

  static div(a: bigint, b: bigint): bigint {
    return b === 0n ? 0n : a / b
  }

  static sdiv(a: bigint, b: bigint): bigint {
    if (b === 0n) return 0n
    const signedA = convertToSigned(a)
    const signedB = convertToSigned(b)
    const result = signedA / signedB
    return result < 0n ? ArithmeticOperations.MAX_UINT256 + result + 1n : result
  }

  /**
   * 모듈로 연산
   */
  static mod(a: bigint, b: bigint): bigint {
    return b === 0n ? 0n : a % b
  }

  static smod(a: bigint, b: bigint): bigint {
    if (b === 0n) return 0n
    const signedA = convertToSigned(a)
    const signedB = convertToSigned(b)
    const result = signedA % signedB
    return result < 0n ? ArithmeticOperations.MAX_UINT256 + result + 1n : result
  }

  static addmod(a: bigint, b: bigint, N: bigint): bigint {
    if (N === 0n) return 0n
    return ((a % N) + (b % N)) % N
  }

  static mulmod(a: bigint, b: bigint, N: bigint): bigint {
    if (N === 0n) return 0n
    return ((a % N) * (b % N)) % N
  }

  /**
   * 지수 연산
   */
  static exp(base: bigint, exponent: bigint): bigint {
    if (exponent === 0n) return 1n
    if (base === 0n) return 0n

    let result = 1n
    let currentBase = base
    let currentExp = exponent

    while (currentExp > 0n) {
      if (currentExp & 1n) {
        result = (result * currentBase) & ArithmeticOperations.MAX_UINT256
      }
      currentBase = (currentBase * currentBase) & ArithmeticOperations.MAX_UINT256
      currentExp >>= 1n
    }
    return result
  }

  /**
   * 비교 연산
   */
  static lt(a: bigint, b: bigint): bigint {
    return a < b ? 1n : 0n
  }

  static gt(a: bigint, b: bigint): bigint {
    return a > b ? 1n : 0n
  }

  static slt(a: bigint, b: bigint): bigint {
    return convertToSigned(a) < convertToSigned(b) ? 1n : 0n
  }

  static sgt(a: bigint, b: bigint): bigint {
    return convertToSigned(a) > convertToSigned(b) ? 1n : 0n
  }

  static eq(a: bigint, b: bigint): bigint {
    return a === b ? 1n : 0n
  }

  static iszero(a: bigint): bigint {
    return a === 0n ? 1n : 0n
  }

  /**
   * 비트 연산
   */
  static and(a: bigint, b: bigint): bigint {
    return a & b
  }

  static or(a: bigint, b: bigint): bigint {
    return a | b
  }

  static xor(a: bigint, b: bigint): bigint {
    return a ^ b
  }

  static not(a: bigint): bigint {
    return ~a & ArithmeticOperations.MAX_UINT256
  }

  /**
   * 시프트 연산
   */
  static shl(shift: bigint, value: bigint): bigint {
    return shift >= 256n ? 0n : (value << shift) & ArithmeticOperations.MAX_UINT256
  }

  static shr(shift: bigint, value: bigint): bigint {
    return shift >= 256n ? 0n : value >> shift
  }

  static sar(shift: bigint, value: bigint): bigint {
    if (shift >= 256n) {
      return (value & (1n << 255n)) === 0n ? 0n : ArithmeticOperations.MAX_UINT256
    }

    const isNegative = (value & (1n << 255n)) !== 0n
    if (isNegative) {
      const mask = ArithmeticOperations.MAX_UINT256 << (256n - shift)
      return (value >> shift) | mask
    }
    return value >> shift
  }

  /**
   * 바이트 연산
   */
  static byte(index: bigint, value: bigint): bigint {
    if (index >= 32n) return 0n
    const shiftBits = (31n - index) * 8n
    return (value >> shiftBits) & 0xffn
  }

  /**
   * 부호 확장
   */
  static signextend(k: bigint, value: bigint): bigint {
    if (k > 31n) return value

    const bitPos = (k + 1n) * 8n - 1n
    const signBit = (value >> bitPos) & 1n

    if (signBit === 1n) {
      const mask = ((1n << (256n - bitPos)) - 1n) << bitPos
      return value | mask
    } else {
      const mask = (1n << (bitPos + 1n)) - 1n
      return value & mask
    }
  }
}
