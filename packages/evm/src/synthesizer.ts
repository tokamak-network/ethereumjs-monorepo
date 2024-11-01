
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
  source: string | number,
  offset: number,
  size: number,
  value: BigInt
}

