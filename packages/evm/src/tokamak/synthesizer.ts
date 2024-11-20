import { subcircuits } from './subcircuit_info.js'
import { powMod } from './utils.js'

import type { DataAliasInfos } from './memoryPt.js'

/**
 * @TODO
 * 
 * 1. loadSubcircuit을 분할
 *  -> 1-1. public load
 *    -> envirmental information, 최종 출력
 *    -> 
 *  -> 1-2. private load
 *    -> 바이트 코드 데이터, auxin 데이터
 * 
 /


 * @property {number} subcircuitId - 서브서킷의 식별자.
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
 * @property {number} actualSize - 데이터의 실제 크기.
 * @property {bigint} value - 데이터 값.
 * @property {string} valuestr - 데이터 값을 16진수 문자열로 표현한 값.
 */
export type DataPt = {
  source: string | number
  sourceOffset: number
  actualSize: number
  value: bigint
  valuestr: string
}

type PlacementEntry = {
  name: string
  inPts: DataPt[]
  outPts: DataPt[]
}

type Placements = Map<number, PlacementEntry>

const byteSize = (value: bigint): number => {
  const hexLength = value.toString(16).length
  return Math.max(Math.ceil(hexLength / 2), 1)
}

const mapPush = (map: Placements, value: PlacementEntry) => {
  const key = map.size
  map.set(key, value)
}

// 부호 있는 정수로 변환 (256비트)
const convertToSigned = (value: bigint): bigint => {
  const mask = 1n << 255n
  return value & mask ? value - (1n << 256n) : value
}

/**
 * Synthesizer 클래스는 서브서킷과 관련된 데이터를 관리합니다.
 *
 * @property {Placements} placements - 서브서킷의 배치 정보를 저장하는 맵.
 * @property {bigint[]} auxin - 보조 입력 데이터를 저장하는 배열.
 * @property {number} placementIndex - 현재 배치 인덱스.
 * @property {string[]} subcircuitNames - 서브서킷 이름을 저장하는 배열.
 */
export class Synthesizer {
  public placements: Placements
  public auxin: bigint[]
  protected placementIndex: number
  private subcircuitNames

  constructor() {
    this.placements = new Map()
    this.placements.set(0, {
      name: 'LOAD',
      inPts: [],
      outPts: [],
    })
    this.auxin = []
    this.placementIndex = 1
    this.subcircuitNames = subcircuits.map((circuit) => circuit.name)
  }

  /**
   * 새로운 데이터 포인트를 생성합니다.
   *
   * @param {number | string} source - 데이터 소스의 식별자.
   * @param {number} sourceOffset - 데이터 소스 내에서의 위치를 나타내는 오프셋.
   * @param {bigint} value - 데이터 값.
   * @returns {DataPt} 생성된 데이터 포인트.
   */
  public newDataPt(sourceId: number | string, sourceOffset: number, value: bigint): DataPt {
    /**
     * 생성된 데이터 포인트를 나타내는 변수입니다.
     *
     * @property {string | number} source - 데이터 소스의 식별자.
     * @property {number} sourceOffset - 데이터 소스 내에서의 위치를 나타내는 오프셋.
     * @property {number} actualSize - 데이터의 실제 크기.
     * @property {bigint} value - 데이터 값.
     * @property {string} valuestr - 데이터 값을 16진수 문자열로 표현한 값.
     */
    const outDataPt: DataPt = {
      source: sourceId,
      sourceOffset,
      actualSize: byteSize(value),
      value,
      valuestr: value.toString(16),
    }
    return outDataPt
  }

  /**
   * 새로운 배치를 추가합니다.
   *
   * @param {string} name - 배치의 이름.
   * @param {DataPt[]} inPts - 입력 데이터 포인트 배열.
   * @param {DataPt[]} outPts - 출력 데이터 포인트 배열.
   * @returns {void}
   */
  public newPlacementPUSH(programCounter: number, value: bigint): DataPt {
    const pointerIn: DataPt = this.newDataPt('code', programCounter + 1, value)

    // 기존 output list에 이어서 추가
    const outOffset = this.placements.get(0)!.outPts.length
    const pointerOut: DataPt = this.newDataPt(0, outOffset, value)
    this.placements.get(0)!.inPts.push(pointerIn)
    this.placements.get(0)!.outPts.push(pointerOut)

    return this.placements.get(0)!.outPts[outOffset]
  }

  /**
   * 새로운 MSTORE 배치를 추가합니다.
   * MSTORE는 Ethereum Virtual Machine(EVM)에서 사용되는 오퍼코드(opcode) 중 하나로, 메모리에 데이터를 저장하는 명령어입니다. MSTORE는 지정된 메모리 위치에 32바이트(256비트) 크기의 데이터를 저장합니다.
   EVM 오퍼코드 설명
   MSTORE:
   기능: 메모리의 특정 위치에 32바이트 크기의 데이터를 저장합니다.
   스택 동작: 스택에서 두 개의 값을 팝(pop)합니다. 첫 번째 값은 메모리 주소이고, 두 번째 값은 저장할 데이터입니다.
   예: MSTORE는 메모리 주소와 데이터를 스택에서 꺼내어 해당 주소에 데이터를 저장합니다.
   *
   * @param {DataPt} inPt - 입력 데이터 포인트.
   * @param {DataPt} outPt - 출력 데이터 포인트.
   * @returns {void}
   * 이 메서드는 MSTORE 오퍼코드를 시뮬레이션하여 새로운 배치를 추가합니다. truncSize가 dataPt.actualSize보다 작으면, 데이터의 하위 바이트만 저장하고 상위 바이트는 버립니다. 변형된 데이터 포인트를 반환합니다.
   */
  public newPlacementMSTORE(truncSize: number, dataPt: DataPt): DataPt {
    // MSTORE8은 trucSize=1로써, data의 최하위 1바이트만을 저장하고 상위 바이트는 버림.
    if (truncSize < dataPt.actualSize) {
      // 원본 데이터에 변형이 있으므로, 이를 추적하는 가상의 연산를 만들고 이를 Placements에 반영합니다.
      // MSTORE8의 데이터 변형은 AND 연산으로 표현 가능 (= AND(data, 0xff))
      const maskerString = '0x' + 'FF'.repeat(truncSize)

      /**
       * @author Ale
       *
       */
      // const mask = (1n << BigInt(truncSize * 8)) - 1n
      // const maskerString = '0x' + mask.toString(16).toUpperCase()

      const outValue = dataPt.value & BigInt(maskerString)

      if (dataPt.value !== outValue) {
        this.auxin.push(BigInt(maskerString))
        const auxinIndex = this.auxin.length - 1
        const auxValue = this.auxin[auxinIndex]
        const subcircuitName = 'AND'
        const inPts: DataPt[] = []
        // AND는 두 개의 입력과 하나의 출력을 가집니다. 각각,
        inPts[0] = dataPt
        inPts[1] = this.newDataPt('auxin', auxinIndex, auxValue)
        const outPts: DataPt[] = [this.newDataPt(this.placementIndex, 0, outValue)]
        this._place(subcircuitName, inPts, outPts)

        return outPts[0]
      }
    }
    const outPt = dataPt
    outPt.actualSize = truncSize
    return outPt
  }

  /**
   * 새로운 MLOAD 배치를 추가합니다.
   *
   * MLOAD는 Ethereum Virtual Machine(EVM)에서 사용되는 오퍼코드(opcode) 중 하나로, 메모리에서 32바이트(256비트) 크기의 데이터를 읽어옵니다.
   * @param {DataAliasInfos} dataAliasInfos - 데이터 출처와 변형 정보를 포함하는 배열.
   * @returns {DataPt} 생성된 데이터 포인트.
   */
  public newPlacementMLOAD(dataAliasInfos: DataAliasInfos): DataPt {
    if (dataAliasInfos.length === 0) {
      throw new Error(`Failur in loading memory pointer`)
    }
    return this._resolveDataAlias(dataAliasInfos)
  }

  /**
   * 새로운 RETURN 배치를 추가합니다.
   *
   * RETURN은 Ethereum Virtual Machine(EVM)에서 사용되는 오퍼코드(opcode) 중 하나로, 지정된 메모리 위치에서 데이터를 반환합니다.
   *
   * @param {string} name - 배치의 이름.
   * @param {DataAliasInfos} dataAliasInfos - 데이터 출처와 변형 정보를 포함하는 배열.
   * @returns {DataPt} 생성된 데이터 포인트.
   */
  public newPlacementRETURNs(name: string, dataAliasInfos: DataAliasInfos): DataPt {
    const inPt: DataPt = this._resolveDataAlias(dataAliasInfos)
    const outPt: DataPt = inPt
    outPt.sourceOffset = 0
    outPt.source = this.placementIndex

    switch (name) {
      case 'RETURN': {
        const aliasResolvedDataPt = this.newPlacementMLOAD(dataAliasInfos)

        let dataCopy = aliasResolvedDataPt.value
        const uint8Array = new Uint8Array(32)
        for (let i = 31; i >= 0; i--) {
          uint8Array[i] = Number(dataCopy & 0xffn)
          dataCopy >>= 8n
        }

        /**
         * @example Big Endian
         *
         * 주소:  0x00  0x01  0x02  0x03
         * 값:   0x12  0x34  0x56  0x78
         */
        const outValues = Array.from(uint8Array, (byte) => BigInt(byte))
        const sourceOffset = this.auxin.length
        this._addAuxin(outValues)

        const inPt = aliasResolvedDataPt
        const outPts: DataPt[] = outValues
          .slice(0, 32)
          .map((value, index) => this.newDataPt('auxin', sourceOffset + index, value))
        this._place('RETURN', [inPt], outPts)
        break
      }
      default:
        throw new Error(`LOAD subcircuit can only be manipulated by PUSH or RETURNs.`)
    }

    /**
     * @todo
     *
     * outPt 리턴을 여기서 해야될 필요?
     * switch statement 안에서 해야될 것처럼 보임
     */
    return outPt
  }

  /**
   * 새로운 산술 연산 배치를 추가합니다.
   *
   * @param {string} name - 배치의 이름. 예: 'ADD', 'SUB', 'MUL', 'DIV'.
   * @param {DataPt[]} inPts - 입력 데이터 포인트 배열.
   * @returns {DataPt[]} 생성된 출력 데이터 포인트 배열.
   * @throws {Error} 정의되지 않은 서브서킷 이름이 주어진 경우.
   */
  public newPlacementArith(name: string, inPts: DataPt[]): DataPt[] {
    if (!this.subcircuitNames.includes(name)) {
      throw new Error(`Subcircuit name ${name} is not defined.`)
    }
    let outPts: DataPt[] = []
    switch (name) {
      case 'ADD': {
        const nInputs = 2
        if (inPts.length !== nInputs) {
          throw new Error(`ADD takes 2 inputs, while this placement takes ${inPts.length}.`)
        }
        const outValue = inPts[0].value + inPts[1].value
        outPts = [this.newDataPt(this.placementIndex, 0, outValue)]
        this._place(name, inPts, outPts)
        break
      }

      case 'MUL': {
        const nInputs = 2
        if (inPts.length !== nInputs) {
          throw new Error(`MUL takes 2 inputs, while this placement takes ${inPts.length}.`)
        }
        const outValue = inPts[0].value * inPts[1].value
        outPts = [this.newDataPt(this.placementIndex, 0, outValue)]
        this._place(name, inPts, outPts)
        break
      }

      case 'SUB': {
        const nInputs = 2
        if (inPts.length !== nInputs) {
          throw new Error(`SUB takes 2 inputs, while this placement takes ${inPts.length}.`)
        }
        const outValue = inPts[0].value - inPts[1].value
        outPts = [this.newDataPt(this.placementIndex, 0, outValue)]
        this._place(name, inPts, outPts)
        break
      }

      case 'DIV': {
        const nInputs = 2
        if (inPts.length !== nInputs) {
          throw new Error(`DIV takes 2 inputs, while this placement takes ${inPts.length}.`)
        }
        // 0으로 나누기 처리
        const outValue = inPts[1].value === 0n ? 0n : inPts[0].value / inPts[1].value
        outPts = [this.newDataPt(this.placementIndex, 0, outValue)]
        this._place(name, inPts, outPts)
        break
      }

      case 'SDIV': {
        const nInputs = 2
        if (inPts.length !== nInputs) {
          throw new Error(`SDIV takes 2 inputs, while this placement takes ${inPts.length}.`)
        }

        const a = convertToSigned(inPts[0].value)
        const b = convertToSigned(inPts[1].value)

        // 0으로 나누기 처리
        let outValue = 0n
        if (b !== 0n) {
          // 부호 있는 나눗셈 수행
          outValue = a / b
          // 결과를 다시 unsigned로 변환
          if (outValue < 0n) {
            outValue = (1n << 256n) + outValue
          }
        }

        outPts = [this.newDataPt(this.placementIndex, 0, outValue)]
        this._place(name, inPts, outPts)
        break
      }

      case 'MOD': {
        const nInputs = 2
        if (inPts.length !== nInputs) {
          throw new Error(`MOD takes 2 inputs, while this placement takes ${inPts.length}.`)
        }
        // 0으로 나누기 처리
        const outValue = inPts[1].value === 0n ? 0n : inPts[0].value % inPts[1].value
        outPts = [this.newDataPt(this.placementIndex, 0, outValue)]
        this._place(name, inPts, outPts)
        break
      }

      case 'SMOD': {
        const nInputs = 2
        if (inPts.length !== nInputs) {
          throw new Error(`SMOD takes 2 inputs, while this placement takes ${inPts.length}.`)
        }

        // 부호 있는 정수로 변환 (256비트)
        const convertToSigned = (value: bigint): bigint => {
          const mask = 1n << 255n
          return value & mask ? value - (1n << 256n) : value
        }

        const a = convertToSigned(inPts[0].value)
        const b = convertToSigned(inPts[1].value)

        // 0으로 나누기 처리
        let outValue = 0n
        if (b !== 0n) {
          // 부호 있는 모듈로 연산 수행
          outValue = a % b
          // 결과의 부호는 피제수(a)의 부호를 따름
          if (outValue < 0n) {
            outValue = (1n << 256n) + outValue
          }
        }

        outPts = [this.newDataPt(this.placementIndex, 0, outValue)]
        this._place(name, inPts, outPts)
        break
      }

      case 'ADDMOD': {
        const nInputs = 3
        if (inPts.length !== nInputs) {
          throw new Error(`ADDMOD takes 3 inputs, while this placement takes ${inPts.length}.`)
        }

        let outValue = 0n
        // N이 0이 아닌 경우에만 연산 수행
        if (inPts[2].value !== 0n) {
          // 먼저 덧셈을 수행한 후 모듈러 연산
          outValue = (inPts[0].value + inPts[1].value) % inPts[2].value
        }

        outPts = [this.newDataPt(this.placementIndex, 0, outValue)]
        this._place(name, inPts, outPts)
        break
      }

      case 'MULMOD': {
        const nInputs = 3
        if (inPts.length !== nInputs) {
          throw new Error(`MULMOD takes 3 inputs, while this placement takes ${inPts.length}.`)
        }

        let outValue = 0n
        // N이 0이 아닌 경우에만 연산 수행
        if (inPts[2].value !== 0n) {
          // 먼저 곱셈을 수행한 후 모듈러 연산
          outValue = (inPts[0].value * inPts[1].value) % inPts[2].value
        }

        outPts = [this.newDataPt(this.placementIndex, 0, outValue)]
        this._place(name, inPts, outPts)
        break
      }

      case 'EXP': {
        const nInputs = 2
        if (inPts.length !== nInputs) {
          throw new Error(`EXP takes 2 inputs, while this placement takes ${inPts.length}.`)
        }

        const base = inPts[0].value
        const exponent = inPts[1].value

        // 특수 케이스 처리
        let outValue: bigint
        if (exponent === 0n) {
          outValue = 1n
        } else if (base === 0n) {
          outValue = 0n
        } else {
          // 모든 연산은 2^256 모듈러 내에서 수행됨
          // EVM의 256비트 연산 범위를 벗어나지 않도록 함
          const modulus = 1n << 256n
          outValue = powMod(base, exponent, modulus)
        }

        outPts = [this.newDataPt(this.placementIndex, 0, outValue)]
        this._place(name, inPts, outPts)
        break
      }

      case 'EQ': {
        const nInputs = 2
        if (inPts.length !== nInputs) {
          throw new Error(`EQ takes 2 inputs, while this placement takes ${inPts.length}.`)
        }

        const outValue = inPts[0].value === inPts[1].value ? 1n : 0n
        outPts = [this.newDataPt(this.placementIndex, 0, outValue)]
        this._place(name, inPts, outPts)
        break
      }

      case 'ISZERO': {
        const nInputs = 1 // ISZERO는 하나의 입력만 받음, In_idx : [2, 1]
        if (inPts.length !== nInputs) {
          throw new Error(`ISZERO takes 1 input, while this placement takes ${inPts.length}.`)
        }

        const outValue = inPts[0].value === 0n ? 1n : 0n
        outPts = [this.newDataPt(this.placementIndex, 0, outValue)]
        this._place(name, inPts, outPts)
        break
      }

      case 'SHL': {
        const nInputs = 2
        if (inPts.length !== nInputs) {
          throw new Error(`SHL takes 2 inputs, while this placement takes ${inPts.length}.`)
        }

        const shift = inPts[0].value // 시프트할 비트 수
        const value = inPts[1].value // 시프트될 값

        let outValue: bigint
        /**
         * @question (Ale)
         *
         * shift 수가 256비트를 초과하면 에러 처리를 해야되는지 비트 사이즈에 맞게 밸류 조정을 해야 하는지?
         * @answer EVM와 같은 방식으로 처리하면 됨
         */
        if (shift >= 256n) {
          // 256비트 이상 시프트하면 0이 됨
          outValue = 0n
        } else {
          // 왼쪽 시프트 수행 후 256비트로 자름
          outValue = (value << shift) & ((1n << 256n) - 1n)
        }

        outPts = [this.newDataPt(this.placementIndex, 0, outValue)]
        this._place(name, inPts, outPts)
        break
      }

      case 'SHR': {
        const nInputs = 2
        if (inPts.length !== nInputs) {
          throw new Error(`SHR takes 2 inputs, while this placement takes ${inPts.length}.`)
        }

        const shift = inPts[0].value // 시프트할 비트 수
        const value = inPts[1].value // 시프트될 값

        let outValue: bigint
        if (shift >= 256n) {
          // 256비트 이상 시프트하면 0이 됨
          outValue = 0n
        } else {
          // 오른쪽 시프트 수행
          outValue = value >> shift
        }

        outPts = [this.newDataPt(this.placementIndex, 0, outValue)]
        this._place(name, inPts, outPts)
        break
      }

      case 'LT': {
        const nInputs = 2
        if (inPts.length !== nInputs) {
          throw new Error(`LT takes 2 inputs, while this placement takes ${inPts.length}.`)
        }

        // 부호 없는(unsigned) 비교 수행
        const outValue = inPts[0].value < inPts[1].value ? 1n : 0n
        outPts = [this.newDataPt(this.placementIndex, 0, outValue)]
        this._place(name, inPts, outPts)
        break
      }

      case 'GT': {
        const nInputs = 2
        if (inPts.length !== nInputs) {
          throw new Error(`GT takes 2 inputs, while this placement takes ${inPts.length}.`)
        }

        // 부호 없는(unsigned) 비교 수행
        const outValue = inPts[0].value > inPts[1].value ? 1n : 0n
        outPts = [this.newDataPt(this.placementIndex, 0, outValue)]
        this._place(name, inPts, outPts)
        break
      }

      case 'NOT': {
        const nInputs = 1
        if (inPts.length !== nInputs) {
          throw new Error(`NOT takes 1 input, while this placement takes ${inPts.length}.`)
        }

        // 256비트 NOT 연산 수행
        const outValue = ~inPts[0].value & ((1n << 256n) - 1n)
        outPts = [this.newDataPt(this.placementIndex, 0, outValue)]
        this._place(name, inPts, outPts)
        break
      }

      case 'BYTE': {
        const nInputs = 2
        if (inPts.length !== nInputs) {
          throw new Error(`BYTE takes 2 inputs, while this placement takes ${inPts.length}.`)
        }

        const index = inPts[0].value
        const word = inPts[1].value

        let outValue: bigint
        if (index >= 32n) {
          // 인덱스가 31보다 크면 0 반환
          outValue = 0n
        } else {
          // 1. 원하는 바이트를 오른쪽으로 시프트
          // 2. 최하위 바이트만 남기기 위해 0xFF와 AND 연산
          const shiftBits = (31n - index) * 8n
          outValue = (word >> shiftBits) & 0xffn
        }

        outPts = [this.newDataPt(this.placementIndex, 0, outValue)]
        this._place(name, inPts, outPts)
        break
      }

      case 'SAR': {
        const nInputs = 2
        if (inPts.length !== nInputs) {
          throw new Error(`SAR takes 2 inputs, while this placement takes ${inPts.length}.`)
        }

        const shift = inPts[0].value // 시프트할 비트 수
        const value = inPts[1].value // 시프트될 값

        let outValue: bigint
        if (shift >= 256n) {
          // 256비트 이상 시프트할 경우
          // 최상위 비트(부호 비트)가 1이면 모든 비트가 1, 0이면 모든 비트가 0
          outValue = (value & (1n << 255n)) === 0n ? 0n : (1n << 256n) - 1n
        } else {
          // 부호 비트 확인 (최상위 비트)
          const isNegative = (value & (1n << 255n)) !== 0n

          if (isNegative) {
            // 음수인 경우: 오른쪽 시프트 후 왼쪽에 1을 채움
            const mask = ((1n << 256n) - 1n) << (256n - shift)
            outValue = (value >> shift) | mask
          } else {
            // 양수인 경우: 일반 오른쪽 시프트
            outValue = value >> shift
          }
        }

        outPts = [this.newDataPt(this.placementIndex, 0, outValue)]
        this._place(name, inPts, outPts)
        break
      }

      case 'SIGNEXTEND': {
        const nInputs = 2
        if (inPts.length !== nInputs) {
          throw new Error(`SIGNEXTEND takes 2 inputs, while this placement takes ${inPts.length}.`)
        }
        const k = inPts[0].value // 확장할 바이트 위치 (0부터 시작)
        const x = inPts[1].value // 확장할 숫자

        let outValue: bigint
        if (k > 30n) {
          // k가 30보다 크면 (31바이트 이상을 가리키면) 입력값을 그대로 반환
          // 이는 EVM이 256비트(32바이트)를 사용하기 때문
          outValue = x
        } else {
          // k번째 바이트의 최상위 비트 위치 계산
          const bitPosition = (k + 1n) * 8n - 1n
          // k번째 바이트의 최상위 비트(부호 비트) 확인
          const signBit = (x >> bitPosition) & 1n

          if (signBit === 1n) {
            // 부호 비트가 1이면 (음수), 상위 비트들을 1로 채움
            const mask = ((1n << 256n) - 1n) << bitPosition
            outValue = x | mask
          } else {
            // 부호 비트가 0이면 (양수), 상위 비트들을 0으로 채움
            const mask = (1n << bitPosition) - 1n
            outValue = x & mask
          }
        }

        outPts = [this.newDataPt(this.placementIndex, 0, outValue)]
        this._place(name, inPts, outPts)
        break
      }

      case 'SLT': {
        const nInputs = 2
        if (inPts.length !== nInputs) {
          throw new Error(`SLT takes 2 inputs, while this placement takes ${inPts.length}.`)
        }

        console.log('GOGO?')

        // 두 입력값을 부호 있는 정수로 변환하여 비교
        const a = convertToSigned(inPts[0].value)
        const b = convertToSigned(inPts[1].value)

        const outValue = a < b ? 1n : 0n
        outPts = [this.newDataPt(this.placementIndex, 0, outValue)]
        this._place(name, inPts, outPts)
        break
      }

      case 'SGT': {
        const nInputs = 2
        if (inPts.length !== nInputs) {
          throw new Error(`SGT takes 2 inputs, while this placement takes ${inPts.length}.`)
        }

        // 두 입력값을 부호 있는 정수로 변환하여 비교
        const a = convertToSigned(inPts[0].value)
        const b = convertToSigned(inPts[1].value)

        const outValue = a > b ? 1n : 0n
        outPts = [this.newDataPt(this.placementIndex, 0, outValue)]
        this._place(name, inPts, outPts)
        break
      }

      case 'AND': {
        const nInputs = 2
        if (inPts.length !== nInputs) {
          throw new Error(`AND takes 2 inputs, while this placement takes ${inPts.length}.`)
        }

        // 두 입력값에 대해 비트 AND 연산 수행
        const outValue = inPts[0].value & inPts[1].value
        outPts = [this.newDataPt(this.placementIndex, 0, outValue)]
        this._place(name, inPts, outPts)
        break
      }

      case 'OR': {
        const nInputs = 2
        if (inPts.length !== nInputs) {
          throw new Error(`OR takes 2 inputs, while this placement takes ${inPts.length}.`)
        }

        console.log('****OR*****')
        console.log(inPts[0].value, inPts[1].value)

        // 두 입력값에 대해 비트 OR 연산 수행
        const outValue = inPts[0].value | inPts[1].value
        console.log('outValue', outValue)
        outPts = [this.newDataPt(this.placementIndex, 0, outValue)]
        this._place(name, inPts, outPts)
        break
      }

      case 'XOR': {
        const nInputs = 2
        if (inPts.length !== nInputs) {
          throw new Error(`XOR takes 2 inputs, while this placement takes ${inPts.length}.`)
        }

        // 두 입력값에 대해 비트 XOR 연산 수행
        const outValue = inPts[0].value ^ inPts[1].value
        outPts = [this.newDataPt(this.placementIndex, 0, outValue)]
        this._place(name, inPts, outPts)
        break
      }

      default:
        throw new Error(`LOAD subcircuit can only be manipulated by PUSH or RETURNs.`)
    }

    return outPts
  }

  /**
   * MLOAD는 고정적으로 32바이트를 읽지만, offset이 1바이트 단위이기 때문에 데이터 변형이 발생할 수 있습니다.
   * 데이터 변형을 추적하기 위해 데이터 변형 여부를 확인하는 함수를 구현합니다.
   * getDataAlias(offset, size) 함수는 Memory에서 offset 부터 offset + size -1 까지의 주소의 데이터의 출처를 추적합니다.
   * 결과물은 여러 데이터가 잘려지거나 concatenated 되는 방식으로 변형 되었을 가능성이 있습니다.
   * getDataAlias의 출력물의 타입은 다음과 같습니다.
   * type DataAliasInfos = {dataPt: DataPt, shift: number, masker: string}[]
   * 예를 들어, dataAliasInfos 의 배열 길이가 3일 경우, Memory의 해당 주소에서 가져온 변형 데이터는 3개의 원본 데이터가 조합된 결과물입니다.
   * 3개 원본 데이터의 출처는 각각 dataPt에 저장되어 있으며,
   * 3개의 원본 데이터를 각각 "shift"만큼 bit shift 한 뒤 (음의 값이라면 왼쪽으로, 양의 값이라면 오른쪽으로),
   * 그 결과를 각각 "masker"와 AND 해주고,
   * 그 결과를 모두 OR 해주면, 그 결과는 변형 데이터와 같습니다.
   **/

  /**
   * 데이터 출처와 변형 정보를 포함하는 배열을 받아서 데이터 포인트를 생성합니다.
   *
   * @param {DataAliasInfos} dataAliasInfos - 데이터 출처와 변형 정보를 포함하는 배열.
   * @returns {DataPt} 생성된 데이터 포인트.
   */
  private _resolveDataAlias(dataAliasInfos: DataAliasInfos): DataPt {
    const orTargets: number[] = []
    const prevPlacementIndex = this.placementIndex
    // 먼저 각각을 shift 후 AND 해줌

    for (const info of dataAliasInfos) {
      const { masker, shift: _shift, dataPt } = info
      const shift = BigInt(_shift)
      let shiftOutValue = dataPt.value

      if (Math.abs(Number(shift)) > 0) {
        // shift 값과 shift 방향과의 관계는 MemoryPt에서 정의하였음
        /**
         * @author Ale
         *
         */
        shiftOutValue = this._applyShift(shift, dataPt)
      }

      const maskOutValue = shiftOutValue & BigInt(masker)

      if (maskOutValue !== shiftOutValue) {
        this._applyMask(masker, shiftOutValue)
      }

      if (prevPlacementIndex !== this.placementIndex) {
        orTargets.push(this.placementIndex - 1)
      }
    }

    const nDataAlias = orTargets.length

    if (nDataAlias > 1) {
      this._addAndPlace(orTargets)
    }

    if (prevPlacementIndex === this.placementIndex) {
      // there was no alias or shift
      return dataAliasInfos[0].dataPt
    }
    return this.placements.get(this.placementIndex - 1)!.outPts[0]
  }

  /**
   * auxin 배열에 값을 추가합니다.
   *
   * @param {bigint} value - 추가할 값.
   */
  private _addAuxin(value: bigint | bigint[]): void {
    if (Array.isArray(value)) {
      this.auxin.push(...value)
    } else {
      this.auxin.push(value)
    }
  }

  /**
   * shift 연산을 적용합니다.
   *
   * @param {bigint} shift - 적용할 shift 값.
   * @param {DataPt} dataPt - 데이터 포인트.
   * @returns {bigint} shift 연산이 적용된 값.
   */
  private _applyShift(shift: bigint, dataPt: DataPt): bigint {
    const subcircuitName: string = shift > 0 ? 'SHL' : 'SHR'
    const absShift = shift < 0n ? -shift : shift
    this._addAuxin(absShift)
    const auxinIndex = this.auxin.length - 1
    const auxValue = this.auxin[auxinIndex]
    const inPts: DataPt[] = []
    inPts[0] = this.newDataPt('auxin', auxinIndex, auxValue)
    inPts[1] = dataPt
    const shiftOutValue =
      shift > 0 ? inPts[1].value << inPts[0].value : inPts[1].value >> inPts[0].value
    const outPts: DataPt[] = [this.newDataPt(this.placementIndex, 0, shiftOutValue)]
    this._place(subcircuitName, inPts, outPts)
    return shiftOutValue
  }

  /**
   * mask 연산을 적용합니다.
   *
   * @param {string} masker - 적용할 mask 값.
   * @param {bigint} shiftOutValue - shift 연산이 적용된 값.
   */
  private _applyMask(masker: string, shiftOutValue: bigint): void {
    const subcircuitName = 'AND'
    this.auxin.push(BigInt(masker))
    const auxinIndex = this.auxin.length - 1
    const auxValue = this.auxin[auxinIndex]
    const inPts: DataPt[] = []
    inPts[0] = this.newDataPt('auxin', auxinIndex, auxValue)
    inPts[1] = this.newDataPt(this.placementIndex, 0, shiftOutValue)
    const outPts: DataPt[] = [
      this.newDataPt(this.placementIndex, 0, shiftOutValue & BigInt(masker)),
    ]
    this._place(subcircuitName, inPts, outPts)
  }

  /**
   * AND 결과물들을 모두 ADD 해줍니다.
   *
   * @param {number[]} orTargets - OR 연산 대상 인덱스 배열.
   */
  private _addAndPlace(orTargets: number[]): void {
    const subcircuitName = 'ADD'
    let inPts: DataPt[] = [
      this.placements.get(orTargets[0])!.outPts[0],
      this.placements.get(orTargets[1])!.outPts[0],
    ]
    let outValue = inPts[0].value + inPts[1].value
    let outPts: DataPt[] = [this.newDataPt(this.placementIndex, 0, outValue)]
    this._place(subcircuitName, inPts, outPts)

    for (let i = 2; i < orTargets.length; i++) {
      inPts = [
        this.placements.get(this.placementIndex - 1)!.outPts[0],
        this.placements.get(orTargets[i])!.outPts[0],
      ]
      outValue = inPts[0].value + inPts[1].value
      outPts = [this.newDataPt(this.placementIndex, 0, outValue)]
      this._place(subcircuitName, inPts, outPts)
    }
  }

  private _place(name: string, inPts: DataPt[], outPts: DataPt[]) {
    if (!this.subcircuitNames.includes(name)) {
      throw new Error(`Subcircuit name ${name} is not defined`)
    }
    mapPush(this.placements, {
      name,
      inPts,
      outPts,
    })
    this.placementIndex++
  }
}
