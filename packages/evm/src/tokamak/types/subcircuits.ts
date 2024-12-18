export type SubcircuitInfoByNameEntry = {
  id: number
  NWires: number
  inWireIndex: number
  NInWires: number
  outWireIndex: number
  NOutWires: number
}
export type SubcircuitInfoByName = Map<string, SubcircuitInfoByNameEntry>
