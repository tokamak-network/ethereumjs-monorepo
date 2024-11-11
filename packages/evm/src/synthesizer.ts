import { subcircuits } from './subcircuit_info.js'

import type { DataAliasInfos } from './memoryPt.js'

export type SubcircuitCode = {
  subcircuitId: number
  nWire: number
  outIdx: number
  nOut: number
  inIdx: number
  nIn: number
}

export type SubcircuitId = {
  code: number
  name: string
  nWire: number
  outIdx: number
  nOut: number
  inIdx: number
  nIn: number
}

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

export class Synthesizer {
  placements: Placements
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

  newDataPt(sourceId: number | string, sourceOffset: number, value: bigint): DataPt {
    const outDataPt: DataPt = {
      source: sourceId,
      sourceOffset,
      actualSize: byteSize(value),
      value,
      valuestr: value.toString(16),
    }
    return outDataPt
  }

  newPlacementPUSH(numToPush: number, programCounter: number, value: bigint): DataPt {
    const pointerIn: DataPt = this.newDataPt('code', programCounter + 1, value)
    // code 데이터는 항상 Placements의 0번째 엔트리에 저장됩니다.
    // 기존 output list에 이어서 추가
    const outOffset = this.placements.get(0)!.outPts.length
    const pointerOut: DataPt = this.newDataPt(0, outOffset, value)
    this.placements.get(0)!.inPts.push(pointerIn)
    this.placements.get(0)!.outPts.push(pointerOut)

    return this.placements.get(0)!.outPts[outOffset]
  }

  newPlacementMSTORE(truncSize: number, dataPt: DataPt): DataPt {
    // MSTORE8은 trucSize=1로써, data의 최하위 1바이트만을 저장하고 상위 바이트는 버림.
    if (truncSize < dataPt.actualSize) {
      // 원본 데이터에 변형이 있으므로, 이를 추적하는 가상의 연산를 만들고 이를 Placements에 반영합니다.
      // MSTORE8의 데이터 변형은 AND 연산으로 표현 가능 (= AND(data, 0xff))
      const maskerString = '0x' + 'FF'.repeat(truncSize)
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

  private _resolveDataAlias(dataAliasInfos: DataAliasInfos): DataPt {
    const orTargets: number[] = []
    const prevPlacementIndex = this.placementIndex
    // 먼저 각각을 shift 후 AND 해줌
    /*eslint-disable */
    dataAliasInfos.forEach((Info) => {
      const masker = Info.masker
      const shift = BigInt(Info.shift)
      const dataPt = Info.dataPt
      let shiftOutValue = dataPt.value

      if (Math.abs(Number(shift)) > 0) {
        // shift 값과 shift 방향과의 관계는 MemoryPt에서 정의하였음
        const subcircuitName: string = shift > 0 ? 'SHL' : 'SHR'
        const absShift = shift < 0n ? -shift : shift
        this.auxin.push(absShift)
        const auxinIndex = this.auxin.length - 1
        const auxValue = this.auxin[auxinIndex]
        // SHR 혹은 SHL은 두 개의 입력과 하나의 출력을 가집니다. 각각,
        const inPts: DataPt[] = []
        inPts[0] = this.newDataPt('auxin', auxinIndex, auxValue)
        inPts[1] = this.placements.get(this.placementIndex - 1)!.outPts[0]
        shiftOutValue =
          shift > 0 ? inPts[1].value << inPts[0].value : inPts[1].value >> inPts[0].value
        const outPts: DataPt[] = [this.newDataPt(this.placementIndex, 0, shiftOutValue)]
        this._place(subcircuitName, inPts, outPts)
      }

      const maskOutValue = shiftOutValue & BigInt(masker)
      if (maskOutValue != shiftOutValue) {
        const subcircuitName = 'AND'
        this.auxin.push(BigInt(masker))
        const auxinIndex = this.auxin.length - 1
        const auxValue = this.auxin[auxinIndex]
        const inPts: DataPt[] = []
        inPts[0] = this.newDataPt('auxin', auxinIndex, auxValue)
        inPts[1] = dataPt
        const outPts: DataPt[] = [this.newDataPt(this.placementIndex, 0, maskOutValue)]
        this._place(subcircuitName, inPts, outPts)
      }

      if (prevPlacementIndex != this.placementIndex) {
        orTargets.push(this.placementIndex - 1)
      }
    })

    const nDataAlias = orTargets.length

    if (nDataAlias > 1) {
      // 이전의 AND 결과물들을 모두 ADD 해줌
      const subcircuitName = 'ADD'
      const inPts: DataPt[] = [
        this.placements.get(orTargets[0])!.outPts[0],
        this.placements.get(orTargets[1])!.outPts[0],
      ]
      const outValue = inPts[0].value + inPts[1].value
      const outPts: DataPt[] = [this.newDataPt(this.placementIndex, 0, outValue)]
      this._place(subcircuitName, inPts, outPts)

      for (let i = 2; i < nDataAlias; i++) {
        const inPts: DataPt[] = [
          this.placements.get(this.placementIndex - 1)!.outPts[0],
          this.placements.get(orTargets[i])!.outPts[0],
        ]
        const outValue = inPts[0].value + inPts[1].value
        const outPts: DataPt[] = [this.newDataPt(this.placementIndex, 0, outValue)]
        this._place(subcircuitName, inPts, outPts)
      }
    }

    if (prevPlacementIndex === this.placementIndex) {
      // there was no alias or shift
      return dataAliasInfos[0].dataPt
    } else {
      return this.placements.get(this.placementIndex - 1)!.outPts[0]
    }
  }

  newPlacementMLOAD(dataAliasInfos: DataAliasInfos): DataPt {
    if (dataAliasInfos.length === 0) {
      throw new Error(`Failur in loading memory pointer`)
    } else {
      return this._resolveDataAlias(dataAliasInfos)
    }
  }

  newPlacementRETURNs(name: string, dataAliasInfos: DataAliasInfos): DataPt {
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
        //Big Endian
        const outValues = Array.from(uint8Array, (byte) => BigInt(byte))

        const sourceOffset = this.auxin.length
        this.auxin.push(...outValues)
        const inPt = aliasResolvedDataPt
        const outPts: DataPt[] = []
        for (let i = 0; i < 32; i++) {
          outPts[i] = this.newDataPt('auxin', sourceOffset + i, outValues[i])
        }
        this._place('RETURN', [inPt], outPts)
        break
      }

      default:
        throw new Error(`LOAD subcircuit can only be manipulated by PUSH or RETURNs.`)
    }
    return outPt
  }

  newPlacementArith(name: string, inPts: DataPt[]): DataPt[] {
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

      // case 'MUL': {
      //   const nInputs = 2
      //   if (inPts.length !== nInputs) {
      //     throw new Error(`MUL takes 2 inputs, while this placement takes ${inPts.length}.`)
      //   }
      //   const outValue = inPts[0].value * inPts[1].value
      //   outPts = [this.newDataPt(this.placementIndex, 0, outValue)]
      //   this._place(name, inPts, outPts)
      //   break
      // }

      default:
        throw new Error(`LOAD subcircuit can only be manipulated by PUSH or RETURNs.`)
    }

    return outPts
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
