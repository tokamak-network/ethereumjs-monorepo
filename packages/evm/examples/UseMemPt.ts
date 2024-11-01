import type { DataPt } from '../src/synthesizer.js'
import { MemoryPt } from '../src/memoryPt.js'

const memoryPt = new MemoryPt()
  
// Example usage of MemoryPt

const dataPt1 : DataPt = {
    source: 'code',
    offset: 0,
    size: 32,
    value: 36n
}

const dataPt2 : DataPt = {
    source: 0,
    offset: 0,
    size: 32,
    value: 0n
}


memoryPt.write(3,6,dataPt1)
memoryPt.write(13,10,dataPt2)
const res = memoryPt.getDataAug(7,10)


