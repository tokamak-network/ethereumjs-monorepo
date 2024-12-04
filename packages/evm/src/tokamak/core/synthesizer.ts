import {
  DEFAULT_SOURCE_SIZE,
  INITIAL_PLACEMENT,
  INITIAL_PLACEMENT_INDEX,
  subcircuits,
} from '../constant/index.js'
import { type ArithmeticOperator, OPERATION_MAPPING } from '../operations/index.js'
import { DataPointFactory } from '../pointers/index.js'
import {
  InvalidInputCountError,
  SynthesizerError,
  SynthesizerValidator,
} from '../validation/index.js'

import type { RunState } from '../../interpreter.js'
import type { DataAliasInfoEntry, DataAliasInfos } from '../pointers/index.js'
import type { DataPt, Placements } from '../types/index.js'

/**
 * @TODO
 *
 * 1. loadSubcircuit을 분할
 *    -> 1-1. public load
 *      -> envirmental information, 최종 출력, auxin 데이터
 *      ->
 *    -> 1-2. private load
 *      -> 바이트 코드 데이터
 */

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
  public envInf: Map<string, bigint>
  protected placementIndex: number
  private subcircuitNames

  constructor() {
    this.placements = new Map()
    this.placements.set(0, INITIAL_PLACEMENT)

    this.auxin = []
    this.envInf = new Map()
    this.placementIndex = INITIAL_PLACEMENT_INDEX
    this.subcircuitNames = subcircuits.map((circuit) => circuit.name)
  }

  /**
   * LOAD 서브서킷에 새���운 입출력 쌍을 추가합니다.
   * @param pointerIn - 입력 데이터 포인트
   * @returns 생성된 출력 데이터 포인트
   * @private
   */
  private _addToLoadPlacement(pointerIn: DataPt): DataPt {
    // 기존 output list의 길이를 새로운 출력의 인덱스로 사용
    const outOffset = this.placements.get(0)!.outPts.length

    // 출력 데이터 포인트 생성
    const pointerOut = DataPointFactory.create({
      sourceId: 0,
      sourceIndex: outOffset,
      value: pointerIn.value,
      sourceSize: DEFAULT_SOURCE_SIZE,
    })

    // LOAD 서브서킷에 입출력 추가
    this.placements.get(0)!.inPts.push(pointerIn)
    this.placements.get(0)!.outPts.push(pointerOut)

    return this.placements.get(0)!.outPts[outOffset]
  }

  /**
   * PUSH 명령어에 의한 새로운 LOAD 배치의 입출력 쌍을 추가합니다.
   *
   * @param {string} codeAddress - PUSH가 실행 된 코드의 address.
   * @param {number} programCounter - PUSH 입력 인자의 program counter.
   * @param {bigint} value - PUSH 입력 인자의 값.
   * @returns {void}
   */
  public loadPUSH(
    codeAddress: string,
    programCounter: number,
    value: bigint,
    size: number,
  ): DataPt {
    const pointerIn: DataPt = DataPointFactory.create({
      sourceId: `code: ${codeAddress}`,
      sourceIndex: programCounter + 1,
      value,
      sourceSize: size,
    })

    // 기존 output list에 이어서 추가
    const outOffset = this.placements.get(0)!.outPts.length
    const pointerOut: DataPt = DataPointFactory.create({
      sourceId: 0,
      sourceIndex: outOffset,
      value,
      sourceSize: DEFAULT_SOURCE_SIZE,
    })
    this.placements.get(0)!.inPts.push(pointerIn)
    this.placements.get(0)!.outPts.push(pointerOut)

    return this.placements.get(0)!.outPts[outOffset]
  }

  public loadAuxin(value: bigint): DataPt {
    this.auxin.push(value)
    const auxinIndex = this.auxin.length - 1
    const auxValue = this.auxin[auxinIndex]
    const pointerIn = DataPointFactory.create({
      sourceId: 'auxin',
      sourceIndex: auxinIndex,
      value: auxValue,
      sourceSize: DEFAULT_SOURCE_SIZE,
    })

    return this._addToLoadPlacement(pointerIn)
  }

  public loadEnvInf(source: string, value: bigint, offset?: number, size?: number): DataPt {
    this.envInf.set(source, value)
    const index = offset ?? 0
    const sourceSize = size ?? DEFAULT_SOURCE_SIZE
    const pointerIn = DataPointFactory.create({
      sourceId: source,
      sourceIndex: index,
      value,
      sourceSize,
    })

    return this._addToLoadPlacement(pointerIn)
  }

  /**
   * 새���운 MSTORE 배치를 추가합니다.
   * MSTORE는 Ethereum Virtual Machine(EVM)에서 사용되는 오퍼코드(opcode) 중 하나로, 메모리에 데이터를 저장하는 명령어입니다. MSTORE 지정된 메모리 위치에 32바이트(256비트) 크기의 데이터를 저장합니다.
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
  public placeMSTORE(dataPt: DataPt, truncSize: number): DataPt {
    // MSTORE8은 trucSize=1로써, data의 최하위 1바이트만을 저장하고 상위 바이트는 버림.
    if (truncSize < dataPt.sourceSize) {
      // 원본 데이터에 변형이 있으므로, 이를 추적하는 가상의 연산를 만들고 이를 Placements에 반영합니다.
      // MSTORE8의 데이터 변형은 AND 연산으로 표현 가능 (= AND(data, 0xff))
      const maskerString = '0x' + 'FF'.repeat(truncSize)

      const outValue = dataPt.value & BigInt(maskerString)
      if (dataPt.value !== outValue) {
        const subcircuitName = 'AND'
        const inPts: DataPt[] = [this.loadAuxin(BigInt(maskerString)), dataPt]
        const outPts: DataPt[] = [
          DataPointFactory.create({
            sourceId: this.placementIndex,
            sourceIndex: 0,
            value: outValue,
            sourceSize: truncSize,
          }),
        ]
        this._place(subcircuitName, inPts, outPts)

        return outPts[0]
      }
    }
    const outPt = dataPt
    outPt.sourceSize = truncSize
    return outPt
  }

  /**
   * 새로운 MLOAD 배치를 추가합니다.
   *
   * MLOAD는 Ethereum Virtual Machine(EVM)에서 사용되는 오퍼코드(opcode) 중 하나로, 메모리에서 32바이트(256비트) 크기의 데이터를 읽어옵니다.
   * @param {DataAliasInfos} dataAliasInfos - 데이터 출처와 변형 정보를 포함하는 배열.
   * @returns {DataPt} 생성된 데이터 포인트.
   */
  public placeMemoryToStack(dataAliasInfos: DataAliasInfos): DataPt {
    if (dataAliasInfos.length === 0) {
      throw new Error(`Synthesizer: placeMemoryToStack: Noting tho load`)
    }
    return this._resolveDataAlias(dataAliasInfos)
  }

  public placeMemoryToMemory(dataAliasInfos: DataAliasInfos): DataPt[] {
    if (dataAliasInfos.length === 0) {
      throw new Error(`Synthesizer: placeMemoryToMemory: Nothing to load`)
    }
    const copiedDataPts: DataPt[] = []
    for (const info of dataAliasInfos) {
      // the lower index, the older data
      copiedDataPts.push(this._applyMask(info, true))
    }
    return copiedDataPts
  }

  /**
   * @deprecated
   * RETURN은 더이상 배치를 사용하지 않습니다.
   *
   * RETURN은 Ethereum Virtual Machine(EVM)에서 사용되는 오퍼코드(opcode) 중 하나로, 지정된 메모리 위치에서 데이터를 반환합니다.
   *
   * @param {string} name - 배치의 이름.
   * @param {DataAliasInfos} dataAliasInfos - 데이터 출처와 변형 정보를 포함하는 배열.
   * @returns {DataPt} 생성된 데이터 포인트.
   */
  // public newPlacementRETURNs(name: string, dataAliasInfos: DataAliasInfos): DataPt {
  //   const inPt: DataPt = this._resolveDataAlias(dataAliasInfos)
  //   const outPt: DataPt = inPt
  //   outPt.sourceIndex = 0
  //   outPt.source = this.placementIndex

  //   switch (name) {
  //     case 'RETURN': {
  //       const aliasResolvedDataPt = this.placeMemoryToMemory(dataAliasInfos)

  //       let dataCopy = aliasResolvedDataPt.value
  //       const uint8Array = new Uint8Array(32)
  //       for (let i = 31; i >= 0; i--) {
  //         uint8Array[i] = Number(dataCopy & 0xffn)
  //         dataCopy >>= 8n
  //       }

  //       /**
  //        * @example Big Endian
  //        *
  //        * 주소:  0x00  0x01  0x02  0x03
  //        * 값:   0x12  0x34  0x56  0x78
  //        */
  //       const outValues = Array.from(uint8Array, (byte) => BigInt(byte))
  //       const sourceOffset = this.auxin.length
  //       this._addAuxin(outValues)

  //       const inPt = aliasResolvedDataPt
  //       const outPts: DataPt[] = outValues
  //         .slice(0, 32)
  //         .map((value, index) => DataPointFactory.create('auxin', sourceOffset + index, value, 32))
  //       this._place('RETURN', [inPt], outPts)
  //       break
  //     }
  //     default:
  //       throw new Error(`LOAD subcircuit can only be manipulated by PUSH or RETURNs.`)
  //   }

  //   /**
  //    * @todo
  //    *
  //    * outPt 리턴을 여기서 해야될 필요?
  //    * switch statement 안에서 해야될 것처럼 보임
  //    */
  //   return outPt
  // }

  //# TODO: newDataPt size 변수 검증 필요
  /**
   * CALLDATALOAD 배치를 추가합니다.
   *
   * @param {RunState} runState - 실행 상태 객체.
   * @param {bigint} offset - 호출 데이터의 시작 오프셋.
   * @returns {DataPt} 생성된 데이터 포인트.
   *
   */
  public newPlacementCALLDATALOAD(runState: RunState, offset: bigint) {
    const inPt = DataPointFactory.create({
      sourceId: 'CALLDATALOAD',
      sourceIndex: 0,
      value: offset,
      sourceSize: DEFAULT_SOURCE_SIZE,
    })

    // Get calldata slice and convert to bigint
    const calldata = runState.interpreter.getCallData()
    const slice = calldata.slice(Number(offset), Number(offset) + 32)

    // Convert Uint8Array to hex string
    const hexString = Array.from(slice)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
    const value = BigInt('0x' + hexString)

    const outPt = DataPointFactory.create({
      sourceId: this.placementIndex,
      sourceIndex: Number(offset),
      value,
      sourceSize: DEFAULT_SOURCE_SIZE,
    })

    // Place the subcircuit
    this._place('CALLDATALOAD', [inPt], [outPt])

    return outPt
  }

  // 기본값(2)과 다른 입력 개수를 가진 연산들만 정의
  private static readonly REQUIRED_INPUTS: Partial<Record<string, number>> = {
    ADDMOD: 3,
    MULMOD: 3,
    ISZERO: 1,
    NOT: 1,
  } as const

  private validateOperation(name: ArithmeticOperator, inPts: DataPt[]): void {
    // 기본값은 2, 예외적인 경우만 REQUIRED_INPUTS에서 확인
    const requiredInputs = Synthesizer.REQUIRED_INPUTS[name] ?? 2
    SynthesizerValidator.validateInputCount(name, inPts.length, requiredInputs)
    SynthesizerValidator.validateInputs(inPts)
  }

  private executeOperation(name: ArithmeticOperator, values: bigint[]): bigint {
    const operation = OPERATION_MAPPING[name]
    return operation(...values)
  }

  private createOutputPoint(value: bigint): DataPt {
    return DataPointFactory.create({
      sourceId: this.placementIndex,
      sourceIndex: 0,
      value,
      sourceSize: 32,
    })
  }

  private handleBinaryOp(name: ArithmeticOperator, inPts: DataPt[]): DataPt[] {
    try {
      // 1. 입력값 검증
      this.validateOperation(name, inPts)

      // 2. 연산 실행
      const values = inPts.map((pt) => pt.value)
      const outValue = this.executeOperation(name, values)

      // 3. 출력값 생성
      const outPts = [this.createOutputPoint(outValue)]

      // 4. 배치 추가
      this._place(name, inPts, outPts)

      return outPts
    } catch (error) {
      if (error instanceof InvalidInputCountError) {
        /*eslint-disable*/
        console.error(`Invalid input count for ${name}: ${error.message}`)
      }
      if (error instanceof SynthesizerError) {
        /*eslint-disable*/
        console.error(`Synthesizer error in ${name}: ${error.message}`)
      }
      throw error
    }
  }

  /**
   * 새로운 산술 연산 배치를 추가합니다.
   *
   * @param {string} name - 배치의 이름. 예: 'ADD', 'SUB', 'MUL', 'DIV'.
   * @param {DataPt[]} inPts - 입력 데이터 포인트 배열.
   * @returns {DataPt[]} 생성된 출력 데이터 포인트 배열.
   * @throws {Error} 정의되지 않은 서브서킷 이름이 주어진 경우.
   */
  public placeArith(name: ArithmeticOperator, inPts: DataPt[]): DataPt[] {
    SynthesizerValidator.validateSubcircuitName(name, this.subcircuitNames)
    return this.handleBinaryOp(name, inPts)
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
   *  결과를 모두 OR 해주면, 그 결과는 변형 데이터와 같습니다.
   **/

  /**
   * 데이터 출처와 변형 정보를 포함하는 배열을 받아서 데이터 포인트를 생성합니다.
   *
   * @param {DataAliasInfos} dataAliasInfos - 데이터 출처와 변형 정보를 포함하는 배열.
   * @returns {DataPt} 생성된 데이터 포인트.
   */
  private _resolveDataAlias(dataAliasInfos: DataAliasInfos): DataPt {
    const ADDTargets: number[] = []
    const prevPlacementIndex = this.placementIndex
    // 먼저 각각을 shift 후 mask와 AND 해줌

    for (const info of dataAliasInfos) {
      // this method may increases the placementIndex
      this._applyShiftAndMask(info)
      if (prevPlacementIndex !== this.placementIndex) {
        ADDTargets.push(this.placementIndex - 1)
      }
    }

    const nDataAlias = ADDTargets.length

    if (nDataAlias > 1) {
      this._addAndPlace(ADDTargets)
    }

    if (prevPlacementIndex === this.placementIndex) {
      // there was no alias or shift
      return dataAliasInfos[0].dataPt
    }
    return this.placements.get(this.placementIndex - 1)!.outPts[0]
  }

  /**
   * @deprecated Auxin에는 한 번에 하나씩 원소가 추가되어야 하며, 하나가 추가 될 때 마다 LOAD 서브서킷에 등록하도록 변경됨
   * auxin 배열에 값을 추가합니다.
   *
   * @param {bigint} value - 추가할 값.
   */
  // private _addAuxin(value: bigint | bigint[]): void {
  //   if (Array.isArray(value)) {
  //     this.auxin.push(...value)
  //   } else {
  //     this.auxin.push(value)
  //   }
  // }

  private _applyShiftAndMask(info: DataAliasInfoEntry): DataPt {
    let shiftOutPt = info.dataPt
    shiftOutPt = this._applyShift(info)
    const modInfo: DataAliasInfoEntry = {
      dataPt: shiftOutPt,
      masker: info.masker,
      shift: info.shift,
    }
    let maskOutPt = modInfo.dataPt
    maskOutPt = this._applyMask(modInfo)
    return maskOutPt
  }

  /**
   * shift 연산을 적용합니다.
   *
   * @param {bigint} shift - 적용할 shift 값.
   * @param {DataPt} dataPt - 데이터 포인트.
   * @returns {bigint} shift 연산이 적용된 값.
   */
  private _applyShift(info: DataAliasInfoEntry): DataPt {
    const { shift, dataPt } = info
    let outPts = [dataPt]
    if (Math.abs(shift) > 0) {
      // shift 값과 shift 방향과의 관계는 MemoryPt에서 정의하였음
      const subcircuitName: ArithmeticOperator = shift > 0 ? 'SHL' : 'SHR'
      const absShift = Math.abs(shift)
      const inPts: DataPt[] = [this.loadAuxin(BigInt(absShift)), dataPt]
      outPts = this.placeArith(subcircuitName, inPts)
    }
    return outPts[0]
  }

  /**
   * mask 연산을 적용합니다.
   *
   * @param {string} masker - 적용할 mask 값.
   * @param {bigint} dataPt - 적용 대상의 포인터.
   */
  private _applyMask(info: DataAliasInfoEntry, unshift?: boolean): DataPt {
    let masker = info.masker
    const { shift, dataPt } = info
    if (unshift === true) {
      const maskerBigint = BigInt(masker)
      const unshiftMaskerBigint =
        shift > 0
          ? maskerBigint >> BigInt(Math.abs(shift))
          : maskerBigint << BigInt(Math.abs(shift))
      masker = '0x' + unshiftMaskerBigint.toString(16)
    }
    const maskOutValue = dataPt.value & BigInt(masker)
    let outPts = [dataPt]
    if (maskOutValue !== dataPt.value) {
      const inPts: DataPt[] = [this.loadAuxin(BigInt(masker)), dataPt]
      outPts = this.placeArith('AND', inPts)
    }
    return outPts[0]
  }

  /**
   * AND 결과물들을 모두 ADD 해줍니다.
   *
   * @param {number[]} addTargets - OR 연산 대상 인덱스 배열.
   */
  private _addAndPlace(addTargets: number[]): void {
    let inPts: DataPt[] = [
      this.placements.get(addTargets[0])!.outPts[0],
      this.placements.get(addTargets[1])!.outPts[0],
    ]
    this.placeArith('ADD', inPts)

    for (let i = 2; i < addTargets.length; i++) {
      inPts = [
        this.placements.get(this.placementIndex - 1)!.outPts[0],
        this.placements.get(addTargets[i])!.outPts[0],
      ]
      this.placeArith('ADD', inPts)
    }
  }

  private _place(name: string, inPts: DataPt[], outPts: DataPt[]) {
    if (!this.subcircuitNames.includes(name)) {
      throw new Error(`Subcircuit name ${name} is not defined`)
    }
    addPlacement(this.placements, {
      name,
      inPts,
      outPts,
    })
    this.placementIndex++
  }
}
