import { bigIntToBytes, bytesToHex, setLengthLeft } from '@ethereumjs/util'
import fs from 'fs'
import path from 'path'

import { subcircuits as subcircuitInfos } from '../resources/index.js'
import { KECCAK_OUT_PLACEMENT_INDEX, LOAD_PLACEMENT_INDEX } from '../constant/placement.js'

import type { DataPt, PlacementEntry, PlacementInstances, Placements } from '../types/index.js'
import { checkInstances } from '../validation/wireAssignments.js'

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
  newDataPts[indHigh].sourceSize = 16
  newDataPts[indLow].sourceSize = 16
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
          if (_inPt.source! === LOAD_PLACEMENT_INDEX && _inPt.wireIndex === ind) {
            flag = 1
            break
          }
        }
      }
      if (flag) break
    }
    if (!flag) {
      newInPts.splice(ind, 1)
      newOutPts.splice(ind, 1)
    }
  }
  outLoadPlacement.inPts = newInPts
  outLoadPlacement.outPts = newOutPts
  return outLoadPlacement
}

export const synthesizerPhase2 = async (placements: Placements): Promise<void> =>
  await outputPlacementInstance(refactoryPlacement(placements))

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
      id: subcircuitIdByName.get(placement!.name)!,
      inPts: newInPts,
      outPts: newOutPts,
    })
  }
  return outPlacements
}

async function outputPlacementInstance(placements: Placements): Promise<void> {
  const result: PlacementInstances = Array.from(placements.entries()).map(([key, entry]) => ({
    placementIndex: key,
    subcircuitId: entry.id!,
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

  await checkInstances(result)

  const tsContent = `export const placementInputs = \n ${JSON.stringify(result, null, 2)}`
  const filePath = '../resources/placementInputs.ts'
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(filePath, tsContent, 'utf-8')
  console.log(
    `Input and output wire assingments of the placements are generated in "placementInputs.ts".`,
  )
}
