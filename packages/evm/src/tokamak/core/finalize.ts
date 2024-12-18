import { bigIntToBytes, bytesToHex, setLengthLeft } from '@ethereumjs/util'
import fs from 'fs'
import { readFileSync } from 'fs'
import path from 'path'
import appRootPath from 'app-root-path'

import { subcircuits as subcircuitInfos } from '../resources/index.js'
import { KECCAK_OUT_PLACEMENT_INDEX, LOAD_PLACEMENT_INDEX } from '../constant/placement.js'

// @ts-ignore
import { builder } from '../utils/witness_calculator.js'

import type {
  DataPt,
  PlacementEntry,
  PlacementInstances,
  Placements,
  SubcircuitInfoByName,
  SubcircuitInfoByNameEntry,
} from '../types/index.js'
type SubcircuitWireIndex = { subcircuitId: number; wireId: number }
type PlacementWireIndex = { placementId: number; flatWireId: number }

export async function finalize(placements: Placements): Promise<Permutation> {
  const refactoriedPlacements = refactoryPlacement(placements)
  const placementInstances = await outputPlacementInstance(refactoriedPlacements)
  const permutation = new Permutation(refactoriedPlacements, placementInstances)
  return permutation
}

const halveWordSizeOfWires = (newDataPts: DataPt[], prevDataPt: DataPt, index: number): void => {
  const indLow = index * 2
  const indHigh = indLow + 1
  newDataPts[indLow] = { ...prevDataPt }
  newDataPts[indHigh] = { ...prevDataPt }
  if (prevDataPt.wireIndex !== undefined) {
    newDataPts[indLow].wireIndex = prevDataPt.wireIndex * 2
    newDataPts[indHigh].wireIndex = prevDataPt.wireIndex * 2 + 1
  }
  if (prevDataPt.pairedInputWireIndices !== undefined) {
    newDataPts[indHigh].pairedInputWireIndices = prevDataPt.pairedInputWireIndices.flatMap(
      (ind) => [ind * 2, ind * 2 + 1],
    )
    newDataPts[indLow].pairedInputWireIndices = prevDataPt.pairedInputWireIndices.flatMap((ind) => [
      ind * 2,
      ind * 2 + 1,
    ])
  }
  newDataPts[indHigh].value = prevDataPt.value >> 128n
  newDataPts[indLow].value = prevDataPt.value & (2n ** 128n - 1n)
  newDataPts[indHigh].valueHex = bytesToHex(
    setLengthLeft(bigIntToBytes(newDataPts[indHigh].value), 16),
  )
  newDataPts[indLow].valueHex = bytesToHex(
    setLengthLeft(bigIntToBytes(newDataPts[indLow].value), 16),
  )
}

const removeUnusedLoadWires = (placements: Placements): PlacementEntry => {
  const outLoadPlacement = { ...placements.get(LOAD_PLACEMENT_INDEX)! }
  const newInPts = [...outLoadPlacement.inPts]
  const newOutPts = [...outLoadPlacement.outPts]
  for (let ind = 0; ind < outLoadPlacement.outPts.length; ind++) {
    let flag = 0
    for (const key of placements.keys()) {
      if (key !== LOAD_PLACEMENT_INDEX) {
        const placement = placements.get(key)!
        for (const [_ind, _inPt] of placement.inPts.entries()) {
          if (
            _inPt.source! === LOAD_PLACEMENT_INDEX &&
            _inPt.wireIndex === outLoadPlacement.outPts[ind].wireIndex
          ) {
            flag = 1
            break
          }
        }
      }
      if (flag) break
    }
    if (!flag) {
      const arrayIdx = newOutPts.findIndex(
        (outPt) => outPt.wireIndex! === outLoadPlacement.outPts[ind].wireIndex!,
      )
      newInPts.splice(arrayIdx, 1)
      newOutPts.splice(arrayIdx, 1)
    }
  }
  outLoadPlacement.inPts = newInPts
  outLoadPlacement.outPts = newOutPts
  return outLoadPlacement
}

function refactoryPlacement(placements: Placements): Placements {
  const subcircuitIdByName = new Map()
  for (const subcircuitInfo of subcircuitInfos) {
    subcircuitIdByName.set(subcircuitInfo.name, subcircuitInfo.id)
  }
  const dietLoadPlacment = removeUnusedLoadWires(placements)
  const outPlacements: Placements = new Map()
  for (const key of placements.keys()) {
    const placement = key === LOAD_PLACEMENT_INDEX ? dietLoadPlacment : placements.get(key)
    const newInPts: DataPt[] = []
    const newOutPts: DataPt[] = []
    const inPts = placement!.inPts
    const outPts = placement!.outPts
    for (const [ind, inPt] of inPts.entries()) {
      halveWordSizeOfWires(newInPts, inPt, ind)
    }
    for (const [ind, outPt] of outPts.entries()) {
      halveWordSizeOfWires(newOutPts, outPt, ind)
    }
    outPlacements.set(key, {
      name: placement!.name,
      subcircuitId: subcircuitIdByName.get(placement!.name)!,
      inPts: newInPts,
      outPts: newOutPts,
    })
  }
  return outPlacements
}

async function outputPlacementInstance(placements: Placements): Promise<PlacementInstances> {
  const result: PlacementInstances = Array.from(placements.entries()).map(([key, entry]) => ({
    placementIndex: key,
    subcircuitId: entry.subcircuitId!,
    instructionName: entry.name,
    inValues: entry.inPts.map((pt) => pt.valueHex),
    outValues: entry.outPts.map((pt) => pt.valueHex),
  }))
  for (let i = LOAD_PLACEMENT_INDEX; i <= KECCAK_OUT_PLACEMENT_INDEX; i++) {
    let ins = result[i].inValues
    let outs = result[i].outValues
    const expectedInsLen = subcircuitInfos[result[i].subcircuitId].In_idx[1]
    const expectedOutsLen = subcircuitInfos[result[i].subcircuitId].Out_idx[1]
    if (expectedInsLen > ins.length) {
      const filledIns = ins.concat(Array(expectedInsLen - ins.length).fill('0x00'))
      result[i].inValues = filledIns
    }
    if (expectedOutsLen > outs.length) {
      const filledOuts = outs.concat(Array(expectedOutsLen - outs.length).fill('0x00'))
      result[i].outValues = filledOuts
    }
  }

  await testInstances(result)

  const tsContent = `export const placementInstance = \n ${JSON.stringify(result, null, 2)}`
  const filePath = path.resolve(
    appRootPath.path,
    'packages/evm/examples/tokamak/outputs/placementInstance.ts',
  )
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  try {
    fs.writeFileSync(filePath, tsContent, 'utf-8')
    console.log(
      `Synthesizer: Input and output wire assingments of the placements are generated in "/outputs/placementInstance.ts".`,
    )
  } catch (error) {
    throw new Error(`Synthesizer: Failure in writing "placementInstance.ts".`)
  }

  return result
}

// This class instantiates the compiler model in Section "3.1 Compilers" of the Tokamak zk-SNARK paper.
class Permutation {
  private numTotalWires: number
  private numPublicWires: number
  private numInterfaceWires: number
  private l: number
  private l_D: number
  private m_D: number
  private subcircuitInfoByName: SubcircuitInfoByName
  private _placements: Placements
  private _instances: PlacementInstances
  // wireFlattenMap: {0, 1, ..., m_D-1} -> \union_{j=0}^{s_D - 1} {j} \times {0, 1, ...,m^{(j)}-1} }
  public wireFlattenMap: Map<number, SubcircuitWireIndex>
  public wireFlattenMapInverse: Map<string, number>

  private permGroup: Map<string, boolean>[]
  // permultationY: {0, 1, ..., s_{max}-1} \times {0, 1, ..., l_D-l-1} -> {0, 1, ..., s_{max}-1}
  public permutationY: number[][]
  // permutationZ: {0, 1, ..., s_{max}-1} \times {0, 1, ..., l_D-l-1} -> {0, 1, ..., l_D-l-1}
  public permutationZ: number[][]
  public permutationFile: { row: number; col: number; Y: number; Z: number }[]

  constructor(placements: Placements, instances: PlacementInstances) {
    this._placements = placements
    this._instances = instances

    this.subcircuitInfoByName = new Map()
    this.numTotalWires = 0
    this.numPublicWires = 0
    this.numInterfaceWires = 0
    for (const subcircuit of subcircuitInfos) {
      this.numTotalWires += subcircuit.Nwires
      if (subcircuit.name === `KeccakBufferIn`) {
        this.numPublicWires += subcircuit.Out_idx[1]
        this.numInterfaceWires += subcircuit.In_idx[1]
      } else if (subcircuit.name === `KeccakBufferOut`) {
        this.numPublicWires += subcircuit.In_idx[1]
        this.numInterfaceWires += subcircuit.Out_idx[1]
      } else {
        this.numInterfaceWires += subcircuit.In_idx[1] + subcircuit.Out_idx[1]
      }

      const entryObject: SubcircuitInfoByNameEntry = {
        id: subcircuit.id,
        NWires: subcircuit.Nwires,
        NInWires: subcircuit.In_idx[1],
        NOutWires: subcircuit.Out_idx[1],
        inWireIndex: subcircuit.In_idx[0],
        outWireIndex: subcircuit.Out_idx[0],
      }
      this.subcircuitInfoByName.set(subcircuit.name, entryObject)
    }
    this.l = this.numPublicWires
    this.l_D = this.numInterfaceWires + this.l
    this.m_D = this.numTotalWires

    // Equation 7 (Todo: This must be done in buildQAP and read from it)
    this.wireFlattenMap = new Map()
    this.wireFlattenMapInverse = new Map()
    this._flattenSubcircuitWires()

    // Construct permutation
    this.permGroup = []
    this._buildPermGroup()

    // Equation 8
    this.permutationY = Array.from({ length: this._placements.size }, (_, i) =>
      Array.from({ length: this.l_D - this.l }, () => i),
    )
    this.permutationZ = Array.from({ length: this._placements.size }, () =>
      Array.from({ length: this.l_D - this.l }, (_, j) => j),
    )
    this.permutationFile = []
    // File write the permutation
    this._outputPermutation()
  }

  private _outputPermutation() {
    for (const _group of this.permGroup) {
      const group = [..._group.keys()]
      const groupLength = group.length
      if (groupLength > 1) {
        for (let i = 0; i < groupLength; i++) {
          const element: PlacementWireIndex = JSON.parse(group[i])
          const nextElement: PlacementWireIndex = JSON.parse(group[(i + 1) % groupLength])
          this.permutationFile.push({
            row: element.placementId,
            col: element.flatWireId - this.l,
            Y: nextElement.placementId,
            Z: nextElement.flatWireId - this.l,
          })
          const rowIdx = this.permutationFile[this.permutationFile.length - 1].row
          const colIdx = this.permutationFile[this.permutationFile.length - 1].col
          this.permutationY[rowIdx][colIdx] =
            this.permutationFile[this.permutationFile.length - 1].Y
          this.permutationZ[rowIdx][colIdx] =
            this.permutationFile[this.permutationFile.length - 1].Z
        }
      }
    }

    this._validatePermutation()

    const tsContent = `export const permutationRule = \n ${JSON.stringify(this.permutationFile, null, 2)}`
    const filePath = path.resolve(
      appRootPath.path,
      'packages/evm/examples/tokamak/outputs/permutation.ts',
    )
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    try {
      fs.writeFileSync(filePath, tsContent, 'utf-8')
      console.log(`Synthesizer: Permutation rule is generated in "/outputs/permutation.ts".`)
    } catch (error) {
      throw new Error(`Synthesizer: Failure in writing "permutation.ts".`)
    }
  }

  private _buildWireFlattenMap = (key: number, value: SubcircuitWireIndex): void => {
    const valueString = JSON.stringify({ ...value })
    if (this.wireFlattenMap.has(key) || this.wireFlattenMapInverse.has(valueString)) {
      throw new Error(`Permutation: Unexpected error during building the wire flatten map.`)
    }
    this.wireFlattenMap.set(key, value)
    this.wireFlattenMapInverse.set(valueString, key)
  }

  private _flattenSubcircuitWires = (): void => {
    let ind = 0
    let targetSubcircuit: SubcircuitInfoByNameEntry
    let _numInterestWires: number

    targetSubcircuit = this.subcircuitInfoByName.get('KeccakBufferIn')!
    _numInterestWires = targetSubcircuit.NOutWires
    for (let i = 0; i < _numInterestWires; i++) {
      this._buildWireFlattenMap(ind++, {
        subcircuitId: targetSubcircuit.id,
        wireId: targetSubcircuit.outWireIndex + i,
      })
    }

    targetSubcircuit = this.subcircuitInfoByName.get('KeccakBufferOut')!
    _numInterestWires = targetSubcircuit.NInWires
    for (let i = 0; i < _numInterestWires; i++) {
      this._buildWireFlattenMap(ind++, {
        subcircuitId: targetSubcircuit.id,
        wireId: targetSubcircuit.inWireIndex + i,
      })
    }

    if (ind !== this.l) {
      throw new Error(`Synthesizer: Error during flattening the subcircuit wires`)
    }

    targetSubcircuit = this.subcircuitInfoByName.get('KeccakBufferOut')!
    _numInterestWires = targetSubcircuit.NOutWires
    for (let i = 0; i < _numInterestWires; i++) {
      this._buildWireFlattenMap(ind++, {
        subcircuitId: targetSubcircuit.id,
        wireId: targetSubcircuit.outWireIndex + i,
      })
    }

    targetSubcircuit = this.subcircuitInfoByName.get('KeccakBufferIn')!
    _numInterestWires = targetSubcircuit.NInWires
    for (let i = 0; i < _numInterestWires; i++) {
      this._buildWireFlattenMap(ind++, {
        subcircuitId: targetSubcircuit.id,
        wireId: targetSubcircuit.inWireIndex + i,
      })
    }

    for (let i = 1; i < subcircuitInfos.length - 1; i++) {
      const targetSubcircuit = subcircuitInfos[i]
      _numInterestWires = targetSubcircuit.Out_idx[1] + targetSubcircuit.In_idx[1]
      for (let j = 0; j < _numInterestWires; j++) {
        this._buildWireFlattenMap(ind++, {
          subcircuitId: targetSubcircuit.id,
          wireId: targetSubcircuit.Out_idx[0] + j,
        })
      }
    }

    if (ind !== this.l_D) {
      throw new Error(`Synthesizer: Error during flattening the subcircuit wires`)
    }

    for (const targetSubcircuit of subcircuitInfos) {
      // The wire for constant
      this._buildWireFlattenMap(ind++, { subcircuitId: targetSubcircuit.id, wireId: 0 })
      _numInterestWires =
        targetSubcircuit.Nwires - (targetSubcircuit.Out_idx[1] + targetSubcircuit.In_idx[1]) - 1
      for (let j = 0; j < _numInterestWires; j++) {
        this._buildWireFlattenMap(ind++, {
          subcircuitId: targetSubcircuit.id,
          wireId: targetSubcircuit.In_idx[0] + targetSubcircuit.In_idx[1] + j,
        })
      }
    }

    if (ind !== this.m_D) {
      throw new Error(`Synthesizer: Error during flattening the subcircuit wires`)
    }
  }

  private _searchInsert = (parent: PlacementWireIndex, child: PlacementWireIndex): void => {
    const parentString = JSON.stringify({ ...parent })
    const childString = JSON.stringify({ ...child })
    for (const group of this.permGroup) {
      if (group.has(parentString)) {
        group.set(childString, true)
        return
      }
    }
    const groupEntry: Map<string, boolean> = new Map()
    groupEntry.set(parentString, true)
    groupEntry.set(childString, true)
    this.permGroup.push(groupEntry)
  }

  private _buildPermGroup = (): void => {
    for (const placeId of this._placements.keys()) {
      const thisPlacement = this._placements.get(placeId)!
      const thisSubcircuitInfo = this.subcircuitInfoByName.get(thisPlacement.name)!
      for (let i = 0; i < thisSubcircuitInfo.NOutWires; i++) {
        const subcircuitWireIndex: SubcircuitWireIndex = {
          subcircuitId: thisSubcircuitInfo.id,
          wireId: thisSubcircuitInfo.outWireIndex + i,
        }
        const flatWireIndex: PlacementWireIndex = {
          placementId: placeId,
          flatWireId: this.wireFlattenMapInverse.get(JSON.stringify({ ...subcircuitWireIndex }))!,
        }
        if (!(flatWireIndex.flatWireId >= this.l && flatWireIndex.flatWireId < this.l_D)) {
          break
        }
        const groupEntry: Map<string, boolean> = new Map()
        groupEntry.set(JSON.stringify({ ...flatWireIndex }), true)
        this.permGroup.push(groupEntry)
      }
    }
    for (const placeId of this._placements.keys()) {
      const thisPlacement = this._placements.get(placeId)!
      const thisSubcircuitInfo = this.subcircuitInfoByName.get(thisPlacement.name)!
      for (let i = 0; i < thisSubcircuitInfo.NInWires; i++) {
        const subcircuitWireIndex: SubcircuitWireIndex = {
          subcircuitId: thisSubcircuitInfo.id,
          wireId: thisSubcircuitInfo.inWireIndex + i,
        }
        const flatWireIndex: PlacementWireIndex = {
          placementId: placeId,
          flatWireId: this.wireFlattenMapInverse.get(JSON.stringify({ ...subcircuitWireIndex }))!,
        }
        if (!(flatWireIndex.flatWireId >= this.l && flatWireIndex.flatWireId < this.l_D)) {
          break
        }
        const dataPt = thisPlacement.inPts[i]
        let hasParent = false
        if (dataPt !== undefined) {
          if (typeof dataPt.source === 'number') {
            if (dataPt.source !== placeId) {
              hasParent = true
              const pointedSubcircuitInfo = this.subcircuitInfoByName.get(
                this._placements.get(dataPt.source!)!.name,
              )!
              const pointedWireId = this._placements
                .get(dataPt.source!)!
                .outPts.findIndex((outPt) => outPt.wireIndex! === dataPt.wireIndex!)
              const pointedSubcircuitWireIndex: SubcircuitWireIndex = {
                subcircuitId: pointedSubcircuitInfo.id,
                wireId: pointedSubcircuitInfo.outWireIndex + pointedWireId,
              }
              const pointedFlatWireIndex: PlacementWireIndex = {
                placementId: dataPt.source,
                flatWireId: this.wireFlattenMapInverse.get(
                  JSON.stringify({ ...pointedSubcircuitWireIndex }),
                )!,
              }
              if (
                !(
                  pointedFlatWireIndex.flatWireId >= this.l &&
                  pointedFlatWireIndex.flatWireId < this.l_D
                )
              ) {
                throw new Error(`Permutation: A wire is referring to a public wire.`)
              }
              this._searchInsert(pointedFlatWireIndex, flatWireIndex)
            }
          }
        }
        if (!hasParent) {
          const groupEntry: Map<string, boolean> = new Map()
          groupEntry.set(JSON.stringify({ ...flatWireIndex }), true)
          this.permGroup.push(groupEntry)
        }
      }
      // console.log(`Length inc: ${thisSubcircuitInfo.NInWires}`)
      // let checksum = 0
      // for (const group of this.permGroup){
      //     checksum += group.size
      // }
      // console.log(`checksum: ${checksum}`)
      // console.log(`a`)
    }
  }

  private _validatePermutation = (): void => {
    let permutationDetected = false
    for (const [placementId, instance] of this._instances.entries()) {
      const rawInstance = [1, ...instance.outValues, ...instance.inValues]
      const thisSubcircuitInfo = this.subcircuitInfoByName.get(instance.instructionName)!
      const thisSubcircuitId = thisSubcircuitInfo.id
      for (let idx = 1; idx < rawInstance.length; idx++) {
        const inversedKey: SubcircuitWireIndex = {
          subcircuitId: thisSubcircuitId,
          wireId: idx,
        }
        const thisFlatWireId = this.wireFlattenMapInverse.get(JSON.stringify({ ...inversedKey }))!
        if (thisFlatWireId < this.l) {
          break
        }
        const nextPlacementId = this.permutationY[placementId][thisFlatWireId - this.l]
        const nextFlatWireId = this.permutationZ[placementId][thisFlatWireId - this.l] + this.l
        const nextIdx = this.wireFlattenMap.get(nextFlatWireId)!.wireId
        const nextRawInstance = [
          1,
          ...this._instances[nextPlacementId].outValues,
          ...this._instances[nextPlacementId].inValues,
        ]
        if (idx !== nextIdx) {
          permutationDetected = true
          if (rawInstance[idx] !== nextRawInstance[nextIdx]) {
            throw new Error(`Permutation: Permutation does not hold.`)
          }
        }
      }
    }
    if (permutationDetected === false) {
      console.log(`Synthesizer: Warning: No permutation detected!`)
    } else {
      console.log(`Synthesizer: Permutation check clear`)
    }
  }
}

const testInstances = async (instances: PlacementInstances): Promise<void> => {
  //console.log("Usage: tsx generate_witness.ts <file.wasm> <input.json> <output.wtns>")
  const dir = 'packages/evm/src/tokamak/resources/subcircuitLibrary'
  const reuseBuffer = new Map()
  for (const [placementInd, instance] of instances.entries()) {
    const id = instance.subcircuitId

    let buffer
    if (reuseBuffer.has(id)) {
      buffer = reuseBuffer.get(id)
    } else {
      const targetWasmPath = path.resolve(appRootPath.path, dir, `subcircuit${id}.wasm`)
      try {
        buffer = readFileSync(targetWasmPath)
      } catch (err) {
        throw new Error(`Error while reading subcircuit${id}.wasm`)
      }
      reuseBuffer.set(id, buffer)
    }
    const ins = { in: instance.inValues }

    const witnessCalculator = await builder(buffer)
    const witness = await witnessCalculator.calculateWitness(ins, 0)
    for (let i = 1; i <= instance.outValues.length; i++) {
      if (witness[i] !== BigInt(instance.outValues[i - 1])) {
        throw new Error(
          `Instance check failed in the placement ${instance.instructionName} (index = ${placementInd})`,
        )
      }
    }
  }
  console.log(`Synthesizer: Instances passed subcircuits.`)
}

// Todo: permutationY와 permutationZ의 내용 압축해서 내보내기.
// Todo: WireFlattenMap과 Inverse를 buildQAP에서 수행하고 내용 압축해서 내보내고, 여기선 그걸 불러오기
