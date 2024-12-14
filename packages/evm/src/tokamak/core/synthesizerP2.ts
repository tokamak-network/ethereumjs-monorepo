import { bigIntToBytes, bytesToHex, setLengthLeft } from '@ethereumjs/util'
import fs from 'fs'
import path from 'path'

import { subcircuits } from '../constant/index.js'
import { LOAD_PLACEMENT_INDEX } from '../constant/placement.js'

import type { DataPt, PlacementEntry, Placements } from '../types/index.js'

const halveWordSizeOfWires = (newDataPts: DataPt[], prevDataPt: DataPt, index: number): void => {
  const indHigh = index * 2
  const indLow = indHigh + 1
  newDataPts[indHigh] = { ...prevDataPt }
  newDataPts[indLow] = { ...prevDataPt }
  if (prevDataPt.wireIndex !== undefined) {
    newDataPts[indHigh].wireIndex = prevDataPt.wireIndex * 2
    newDataPts[indLow].wireIndex = prevDataPt.wireIndex * 2 + 1
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

export const synthesizerPhase2 = (placements: Placements): void =>
  outputPlacementInputs(refactoryPlacement(placements))

function refactoryPlacement(placements: Placements): Placements {
  const subcircuitIdByName = new Map()
  for (const subcircuit of subcircuits) {
    subcircuitIdByName.set(subcircuit.name, subcircuit.id)
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

function outputPlacementInputs(placements: Placements): void {
  const result = Array.from(placements.entries()).map(([key, entry]) => ({
    placementIndex: key,
    subcircuitId: entry.id,
    instructionName: entry.name,
    inValues: entry.inPts.map((pt) => pt.valueHex),
    outValues: entry.outPts.map((pt) => pt.valueHex),
  }))

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
