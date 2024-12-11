export const LOAD_PLACEMENT_INDEX = 0
export const RETURN_PLACEMENT_INDEX = 1
export const KECCAK_PLACEMENT_INDEX = 2
export const INITIAL_PLACEMENT_INDEX = KECCAK_PLACEMENT_INDEX + 1
export const DEFAULT_SOURCE_SIZE = 32
export const LOAD_PLACEMENT = {
  name: 'Load',
  inPts: [],
  outPts: [],
}
export const KECCAK_PLACEMENT = {
  name: 'KeccakBuffer',
  inPts: [],
  outPts: [],
}
export const RETURN_PLACEMENT = {
  name: 'ReturnBuffer',
  inPts: [],
  outPts: [],
}