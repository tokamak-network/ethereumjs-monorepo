import { time } from 'console'

import type { DataPt } from './synthesizer.js'

export type DataAliasInfos = { dataPt: DataPt; shift: number; masker: string }[]
type _MemoryPt = Map<number, { memOffset: number; containerSize: number; dataPt: DataPt }>
type _DataFragments = Map<number, { originalRange: Set<number>; validRange: Set<number> }>

const createRangeSet = (a: number, b: number): Set<number> => {
  // the resulting increasing set from 'a' to 'b'
  return new Set(Array.from({ length: b - a + 1 }, (_, i) => a + i))
}
const setMinus = (A: Set<number>, B: Set<number>): Set<number> => {
  const result = new Set<number>()
  for (const element of A) {
    if (!B.has(element)) {
      result.add(element)
    }
  }
  return result
}

/*eslint-disable */
const CONTAINER_SIZE = 8192

/**
 * Memory implements a simple memory model
 * for the ethereum virtual machine.
 */
export class MemoryPt {
  _storePt: _MemoryPt
  private _timeStamp: number

  constructor() {
    this._storePt = new Map()
    this._timeStamp = 0
  }

  /**
   * 만약 새롭게 쓰이는 데이터가 기존의 데이터를 완전히 오버랩 한다면,
   * 기존의 key-value 쌍을 삭제합니다.
   */
  private _memPtCleanUp(newOffset: number, newSize: number) {
    for (const [key, { memOffset: _offset, containerSize: _size }] of this._storePt) {
      //새 데이터가 기존 데이터를 완전히 오버랩 하는 조건
      const _endOffset = _offset + _size - 1
      const newEndOffset = newOffset + newSize - 1
      if (_endOffset <= newEndOffset && _offset >= newOffset) {
        this._storePt.delete(key)
      }
    }
  }

  /**
   * Writes a byte array with length `size` to memory, starting from `offset`.
   * @param offset - Starting memory position
   * @param size - How many bytes to write
   * @param dataPt - Data pointer
   */
  write(offset: number, size: number, dataPt: DataPt) {
    if (size === 0) {
      return
    }

    // if setLengthLeft(bigIntToBytes(dataPt.value), 32).length !== size) throw new Error('Invalid value size')
    // if (offset + size > this._storePt.length) throw new Error('Value exceeds memory capacity')

    this._memPtCleanUp(offset, size)
    this._storePt.set(this._timeStamp++, {
      memOffset: offset,
      containerSize: size,
      dataPt,
    })
  }

  /**
     * read 는 MemoryPt조작에는 사용되지 않습니다. 대신 "getDataAlias"를 사용합니다.
     * Reads a slice of memory from `offset` till `offset + size` as a `Uint8Array`.
     * It fills up the difference between memory's length and `offset + size` with zeros.
     * @param offset - Starting memory position
     * @param size - How many bytes to read
     * @param avoidCopy - Avoid memory copy if possible for performance reasons (optional)
    
    read(offset: number, size: number): Uint8Array {
        const loaded = this._storePt.subarray(offset, offset + size)
        if (avoidCopy === true) {
        return loaded
        }
        const returnBytes = new Uint8Array(size)
        // Copy the stored "buffer" from memory into the return Uint8Array
        returnBytes.set(loaded)

        return returnBytes
    }
    */

  getDataAlias(offset: number, size: number): DataAliasInfos {
    if (size > 32) {
      throw new Error(`The range of memory view exceeds 32 bytes. Try to chunk it in the Handlers.`)
    }
    const dataAliasInfos: DataAliasInfos = []
    const dataFragments = this._viewMemoryConflict(offset, size)
    /*eslint-disable */
    dataFragments.forEach((value, key) => {
      const dataEndOffset =
        this._storePt.get(key)!.memOffset + this._storePt.get(key)!.containerSize - 1
      const viewEndOffset = offset + size - 1
      dataAliasInfos.push({
        dataPt: this._storePt.get(key)!.dataPt,
        // shift가 양의 값이면 SHL, 음의 값이면 SHR
        shift: (viewEndOffset - dataEndOffset) * 8,
        masker: this._generateMasker(offset, size, value.validRange),
      })
    })
    return dataAliasInfos
  }

  private _viewMemoryConflict(offset: number, size: number) {
    const dataFragments: _DataFragments = new Map()
    const endOffset = offset + size - 1
    const sortedTimeStamps = Array.from(this._storePt.keys()).sort((a, b) => a - b)
    let i = 0

    for (const timeStamp of sortedTimeStamps) {
      // const containerOffset = this._storePt.get(timeStamp)!.memOffset
      // const storedEndOffset = this._storePt.get(timeStamp)!.memOffset
      // Find the offset where nonzero value starts
      const storedOffset = this._storePt.get(timeStamp)!.memOffset
      const storedEndOffset = storedOffset + this._storePt.get(timeStamp)!.containerSize - 1
      const sortedTimeStamps_firsts = sortedTimeStamps.slice(0, i)
      // If data is in the range
      if (storedEndOffset >= offset && storedOffset <= endOffset) {
        const overlapStart = Math.max(offset, storedOffset)
        const overlapEnd = Math.min(endOffset, storedEndOffset)
        const thisDataValidRange = createRangeSet(overlapStart, overlapEnd)
        const thisDataOriginalRange = createRangeSet(storedOffset, storedEndOffset)
        dataFragments.set(timeStamp, {
          originalRange: thisDataOriginalRange,
          validRange: thisDataValidRange,
        })
        // Update previous data overlap ranges
        for (const _timeStamp of sortedTimeStamps_firsts) {
          if (dataFragments.has(_timeStamp)) {
            const overwrittenRange = setMinus(
              dataFragments.get(_timeStamp)!.validRange,
              dataFragments.get(timeStamp)!.validRange,
            )
            if (overwrittenRange.size <= 0) {
              dataFragments.delete(_timeStamp)
            } else {
              dataFragments.set(_timeStamp, {
                originalRange: dataFragments.get(_timeStamp)!.originalRange,
                validRange: overwrittenRange,
              })
            }
          }
        }
      }
      i++
    }
    return dataFragments
  }

  private _generateMasker(offset: number, size: number, validRange: Set<number>): string {
    const targetRange = createRangeSet(offset, offset + size - 1)
    for (const element of validRange) {
      if (!targetRange.has(element)) {
        throw new Error('Error: arg2 is not a subset of arg1')
      }
    }

    let maskerString = '0x'
    for (const element of targetRange) {
      if (validRange.has(element)) {
        maskerString += 'FF'
      } else {
        maskerString += '00'
      }
    }
    //const maskerBigInt = BigInt(`0x${maskerString}`)
    return maskerString
  }
}
