import { SynthesizerValidator } from './validator.js'

import type { CreateDataPointParams, DataPt } from './type.js'

export class DataPointFactory {
  public static create(params: CreateDataPointParams): DataPt {
    SynthesizerValidator.validateValue(params.value)

    /**
     * 생성된 데이터 포인트를 나타내는 변수입니다.
     *
     * @property {string | number} source - 데이터 소스의 식별자.
     * @property {number} sourceOffset - 데이터 소스 내에서의 위치를 나타내는 오프셋.
     * @property {number} sourceSize - 데이터의 실제 크기.
     * @property {bigint} value - 데이터 값.
     * @property {string} valuestr - 데이터 값을 16진수 문자열로 표현한 값.
     */
    return {
      source: params.sourceId,
      sourceIndex: params.sourceIndex,
      sourceSize: params.sourceSize,
      value: params.value,
      valueHex: params.value.toString(16),
    }
  }
}
