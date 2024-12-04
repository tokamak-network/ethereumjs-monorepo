/**
 * @property { number } subcircuitId - 서브서킷의 식별자.
 * @property {number} nWire - 서브서킷의 와이어 수.
 * @property {number} outIdx - 출력 인덱스.
 * @property {number} nOut - 출력의 수.
 * @property {number} inIdx - 입력 인덱스.
 * @property {number} nIn - 입력의 수.
 */
export type SubcircuitCode = {
  subcircuitId: number
  nWire: number
  outIdx: number
  nOut: number
  inIdx: number
  nIn: number
}

/**
 * @property {number} code - 서브서킷 코드.
 * @property {string} name - 서브서킷 이름.
 * @property {number} nWire - 서브서킷의 와이어 수.
 * @property {number} outIdx - 출력 인덱스.
 * @property {number} nOut - 출력의 수.
 * @property {number} inIdx - 입력 인덱스.
 * @property {number} nIn - 입력의 수.
 */
export type SubcircuitId = {
  code: number
  name: string
  nWire: number
  outIdx: number
  nOut: number
  inIdx: number
  nIn: number
}

/**
 * @property {string | number} source - 데이터 소스의 식별자. 문자열 또는 숫자.
 * @property {number} sourceOffset - 데이터 소스 내에서의 위치를 나타내는 오프셋.
 * @property {number} sourceSize - 데이터의 실제 크기.
 * @property {bigint} value - 데이터 값.
 * @property {string} valuestr - 데이터 값을 16진수 문자열로 표현한 값.
 */
export type DataPt = {
  source: string | number
  sourceIndex: number
  sourceSize: number
  value: bigint
  valueHex: string
}

export type PlacementEntry = {
  name: string
  inPts: DataPt[]
  outPts: DataPt[]
}

export type Placements = Map<number, PlacementEntry>

/**
 * 데이터 포인트 생성에 필요한 파라미터 인터페이스
 * @property sourceId - 데이터 소스의 식별자 (예: 코드 주소, 'auxin', 'CALLDATALOAD' 등)
 * @property sourceIndex - 데이터 소스 내에서의 위치를 나타내는 인덱스
 * @property value - 실제 데이터 값
 * @property sourceSize - 데이터의 크기 (바이트 단위)
 */
export interface CreateDataPointParams {
  sourceId: string | number
  sourceIndex: number
  value: bigint
  sourceSize: number
}
