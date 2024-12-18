import { subcircuits } from '../resources/index.js'
import {
  PlacementInstances,
  Placements,
  SubcircuitInfoByName,
  SubcircuitInfoByNameEntry,
} from '../types/index.js'
type SubcircuitWireIndex = { subcircuitId: number; wireId: number }
type PlacementWireIndex = { placementId: number; flatWireId: number }

// This class instantiates the compiler model in Section "3.1 Compilers" of the Tokamak zk-SNARK paper.
export class Permutation {
  private numTotalWires: number
  private numPublicWires: number
  private numInterfaceWires: number
  private l: number
  private l_D: number
  private m_D: number
  private subcircuitInfoByName: SubcircuitInfoByName
  private _placements: Placements
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

    this.subcircuitInfoByName = new Map()
    this.numTotalWires = 0
    this.numPublicWires = 0
    this.numInterfaceWires = 0
    for (const subcircuit of subcircuits) {
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
    this._validatePermutation(instances)
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

    for (let i = 1; i < subcircuits.length - 1; i++) {
      const targetSubcircuit = subcircuits[i]
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

    for (const targetSubcircuit of subcircuits) {
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

  private _validatePermutation = (instances: PlacementInstances): void => {
    let permutationDetected = false
    for (const [placementId, instance] of instances.entries()) {
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
          ...instances[nextPlacementId].outValues,
          ...instances[nextPlacementId].inValues,
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
      console.log(`Warning: No permutation detected!`)
    } else {
      console.log(`Permutation check clear`)
    }
  }
}
// Todo: permutationY와 permutationZ의 내용 압축해서 내보내기.
// Todo: WireFlattenMap과 Inverse를 buildQAP에서 수행하고 내용 압축해서 내보내고, 여기선 그걸 불러오기
