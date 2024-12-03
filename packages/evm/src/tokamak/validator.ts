import { InvalidInputCountError, UndefinedSubcircuitError } from './errors.js'

import type { DataPt } from './type.js'

/**
 * Synthesizer 관련 유효성 검사를 담당하는 클래스
 */
export class SynthesizerValidator {
  /**
   * 입력 개수가 예상된 개수와 일치하는지 검증합니다.
   *
   * @param name 연산자 이름
   * @param actual 실제 입력 개수
   * @param expected 예상되는 입력 개수
   * @throws {InvalidInputCountError} 입력 개수가 일치하지 않을 경우
   */
  static validateInputCount(name: string, actual: number, expected: number): void {
    if (actual !== expected) {
      throw new InvalidInputCountError(name, expected, actual)
    }
  }

  /**
   * 서브서킷 이름이 유효한지 검증합니다.
   *
   * @param name 서브서킷 이름
   * @param validNames 유효한 서브서킷 이름 목록
   * @throws {UndefinedSubcircuitError} 유효하지 않은 서브서킷 이름일 경우
   */
  static validateSubcircuitName(name: string, validNames: string[]): void {
    if (!validNames.includes(name)) {
      throw new UndefinedSubcircuitError(name)
    }
  }

  /**
   * 입력값들이 유효한지 검증합니다.
   *
   * @param inputs 검증할 입력값 배열
   * @throws {Error} 입력값이 null이거나 undefined인 경우
   */
  static validateInputs(inputs: DataPt[]): void {
    for (const input of inputs) {
      if (input === null || input === undefined) {
        throw new Error('Input cannot be null or undefined')
      }
      if (typeof input.value !== 'bigint') {
        throw new Error('Input value must be a bigint')
      }
    }
  }

  /**
   * 숫자 범위를 검증합니다.
   *
   * @param value 검증할 값
   * @param min 최소값
   * @param max 최대값
   * @param paramName 파라미터 이름
   * @throws {Error} 값이 범위를 벗어난 경우
   */
  static validateRange(
    value: number | bigint,
    min: number | bigint,
    max: number | bigint,
    paramName: string,
  ): void {
    if (value < min || value > max) {
      throw new Error(`${paramName} must be between ${min} and ${max}, got ${value}`)
    }
  }
}
