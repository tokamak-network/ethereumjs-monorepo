import {
  Address,
  BIGINT_0,
  BIGINT_1,
  BIGINT_160,
  BIGINT_2,
  BIGINT_224,
  BIGINT_255,
  BIGINT_256,
  BIGINT_2EXP160,
  BIGINT_2EXP224,
  BIGINT_2EXP96,
  BIGINT_31,
  BIGINT_32,
  BIGINT_7,
  BIGINT_8,
  BIGINT_96,
  MAX_INTEGER_BIGINT,
  TWO_POW256,
  bigIntToAddressBytes,
  bigIntToBytes,
  bytesToBigInt,
  bytesToHex,
  bytesToInt,
  concatBytes,
  equalsBytes,
  getVerkleTreeIndicesForStorageSlot,
  setLengthLeft,
} from '@ethereumjs/util'
import { keccak256 } from 'ethereum-cryptography/keccak.js'

import { EOFContainer, EOFContainerMode } from '../eof/container.js'
import { EOFError } from '../eof/errors.js'
import { EOFBYTES, EOFHASH, isEOF } from '../eof/util.js'
import { ERROR } from '../exceptions.js'
import { DELEGATION_7702_FLAG } from '../types.js'

import {
  createAddressFromStackBigInt,
  describeLocation,
  exponentiation,
  fromTwos,
  getDataSlice,
  jumpIsValid,
  mod,
  toTwos,
  trap,
  writeCallOutput,
} from './util.js'

import type { RunState } from '../interpreter.js'
import type { Common } from '@ethereumjs/common'

export interface SyncOpHandler {
  (runState: RunState, common: Common): void
}

export interface AsyncOpHandler {
  (runState: RunState, common: Common): Promise<void>
}

export type OpHandler = SyncOpHandler | AsyncOpHandler

function getEIP7702DelegatedAddress(code: Uint8Array) {
  if (equalsBytes(code.slice(0, 3), DELEGATION_7702_FLAG)) {
    return new Address(code.slice(3, 24))
  }
}

async function eip7702CodeCheck(runState: RunState, code: Uint8Array) {
  const address = getEIP7702DelegatedAddress(code)
  if (address !== undefined) {
    return runState.stateManager.getCode(address)
  }

  return code
}

// the opcode functions
export const handlers: Map<number, OpHandler> = new Map([
  // 0x00: STOP
  [
    0x00,
    function () {
      trap(ERROR.STOP)
    },
  ],
  // 0x01: ADD
  [
    0x01,
    function (runState) {
      const [a, b] = runState.stack.popN(2)
      const r = mod(a + b, TWO_POW256)
      runState.stack.push(r)

      // For Synthesizer //
      const inPts = runState.stackPt.popN(2)
      const outPts = runState.synthesizer.newPlacementArith('ADD', inPts)
      runState.stackPt.push(outPts[0])
    },
  ],
  // 0x02: MUL
  [
    0x02,
    function (runState) {
      const [a, b] = runState.stack.popN(2)
      const r = mod(a * b, TWO_POW256)
      runState.stack.push(r)

      // For Synthesizer //
      const inPts = runState.stackPt.popN(2)
      const outPts = runState.synthesizer.newPlacementArith('MUL', inPts)
      runState.stackPt.push(outPts[0])
    },
  ],
  // 0x03: SUB
  [
    0x03,
    function (runState) {
      const [a, b] = runState.stack.popN(2)
      const r = mod(a - b, TWO_POW256)
      runState.stack.push(r)
    },
  ],
  // 0x04: DIV
  [
    0x04,
    function (runState) {
      const [a, b] = runState.stack.popN(2)
      let r
      if (b === BIGINT_0) {
        r = BIGINT_0
      } else {
        r = mod(a / b, TWO_POW256)
      }
      runState.stack.push(r)
    },
  ],
  // 0x05: SDIV
  [
    0x05,
    function (runState) {
      const [a, b] = runState.stack.popN(2)
      let r
      if (b === BIGINT_0) {
        r = BIGINT_0
      } else {
        r = toTwos(fromTwos(a) / fromTwos(b))
      }
      runState.stack.push(r)
    },
  ],
  // 0x06: MOD
  [
    0x06,
    function (runState) {
      const [a, b] = runState.stack.popN(2)
      let r
      if (b === BIGINT_0) {
        r = b
      } else {
        r = mod(a, b)
      }
      runState.stack.push(r)
    },
  ],
  // 0x07: SMOD
  [
    0x07,
    function (runState) {
      const [a, b] = runState.stack.popN(2)
      let r
      if (b === BIGINT_0) {
        r = b
      } else {
        r = fromTwos(a) % fromTwos(b)
      }
      runState.stack.push(toTwos(r))
    },
  ],
  // 0x08: ADDMOD
  [
    0x08,
    function (runState) {
      const [a, b, c] = runState.stack.popN(3)
      let r
      if (c === BIGINT_0) {
        r = BIGINT_0
      } else {
        r = mod(a + b, c)
      }
      runState.stack.push(r)
    },
  ],
  // 0x09: MULMOD
  [
    0x09,
    function (runState) {
      const [a, b, c] = runState.stack.popN(3)
      let r
      if (c === BIGINT_0) {
        r = BIGINT_0
      } else {
        r = mod(a * b, c)
      }
      runState.stack.push(r)
    },
  ],
  // 0x0a: EXP
  [
    0x0a,
    function (runState) {
      const [base, exponent] = runState.stack.popN(2)
      if (base === BIGINT_2) {
        switch (exponent) {
          case BIGINT_96:
            runState.stack.push(BIGINT_2EXP96)
            return
          case BIGINT_160:
            runState.stack.push(BIGINT_2EXP160)
            return
          case BIGINT_224:
            runState.stack.push(BIGINT_2EXP224)
            return
        }
      }
      if (exponent === BIGINT_0) {
        runState.stack.push(BIGINT_1)
        return
      }

      if (base === BIGINT_0) {
        runState.stack.push(base)
        return
      }
      const r = exponentiation(base, exponent)
      runState.stack.push(r)
    },
  ],
  // 0x0b: SIGNEXTEND
  [
    0x0b,
    function (runState) {
      /* eslint-disable-next-line prefer-const */
      let [k, val] = runState.stack.popN(2)
      if (k < BIGINT_31) {
        const signBit = k * BIGINT_8 + BIGINT_7
        const mask = (BIGINT_1 << signBit) - BIGINT_1
        if ((val >> signBit) & BIGINT_1) {
          val = val | BigInt.asUintN(256, ~mask)
        } else {
          val = val & mask
        }
      }
      runState.stack.push(val)
    },
  ],
  // 0x10 range - bit ops
  // 0x10: LT
  [
    0x10,
    function (runState) {
      const [a, b] = runState.stack.popN(2)
      const r = a < b ? BIGINT_1 : BIGINT_0
      runState.stack.push(r)
    },
  ],
  // 0x11: GT
  [
    0x11,
    function (runState) {
      const [a, b] = runState.stack.popN(2)
      const r = a > b ? BIGINT_1 : BIGINT_0
      runState.stack.push(r)
    },
  ],
  // 0x12: SLT
  [
    0x12,
    function (runState) {
      const [a, b] = runState.stack.popN(2)
      const r = fromTwos(a) < fromTwos(b) ? BIGINT_1 : BIGINT_0
      runState.stack.push(r)
    },
  ],
  // 0x13: SGT
  [
    0x13,
    function (runState) {
      const [a, b] = runState.stack.popN(2)
      const r = fromTwos(a) > fromTwos(b) ? BIGINT_1 : BIGINT_0
      runState.stack.push(r)
    },
  ],
  // 0x14: EQ
  [
    0x14,
    function (runState) {
      const [a, b] = runState.stack.popN(2)
      const r = a === b ? BIGINT_1 : BIGINT_0
      runState.stack.push(r)
    },
  ],
  // 0x15: ISZERO
  [
    0x15,
    function (runState) {
      const a = runState.stack.pop()
      const r = a === BIGINT_0 ? BIGINT_1 : BIGINT_0
      runState.stack.push(r)
    },
  ],
  // 0x16: AND
  [
    0x16,
    function (runState) {
      const [a, b] = runState.stack.popN(2)
      const r = a & b
      runState.stack.push(r)
    },
  ],
  // 0x17: OR
  [
    0x17,
    function (runState) {
      const [a, b] = runState.stack.popN(2)
      const r = a | b
      runState.stack.push(r)
    },
  ],
  // 0x18: XOR
  [
    0x18,
    function (runState) {
      const [a, b] = runState.stack.popN(2)
      const r = a ^ b
      runState.stack.push(r)
    },
  ],
  // 0x19: NOT
  [
    0x19,
    function (runState) {
      const a = runState.stack.pop()
      const r = BigInt.asUintN(256, ~a)
      runState.stack.push(r)
    },
  ],
  // 0x1a: BYTE
  [
    0x1a,
    function (runState) {
      const [pos, word] = runState.stack.popN(2)
      if (pos > BIGINT_32) {
        runState.stack.push(BIGINT_0)
        return
      }

      const r = (word >> ((BIGINT_31 - pos) * BIGINT_8)) & BIGINT_255
      runState.stack.push(r)
    },
  ],
  // 0x1b: SHL
  [
    0x1b,
    function (runState) {
      const [a, b] = runState.stack.popN(2)
      if (a > BIGINT_256) {
        runState.stack.push(BIGINT_0)
        return
      }

      const r = (b << a) & MAX_INTEGER_BIGINT
      runState.stack.push(r)
    },
  ],
  // 0x1c: SHR
  [
    0x1c,
    function (runState) {
      const [a, b] = runState.stack.popN(2)
      if (a > 256) {
        runState.stack.push(BIGINT_0)
        return
      }

      const r = b >> a
      runState.stack.push(r)
    },
  ],
  // 0x1d: SAR
  [
    0x1d,
    function (runState) {
      const [a, b] = runState.stack.popN(2)

      let r
      const bComp = BigInt.asIntN(256, b)
      const isSigned = bComp < 0
      if (a > 256) {
        if (isSigned) {
          r = MAX_INTEGER_BIGINT
        } else {
          r = BIGINT_0
        }
        runState.stack.push(r)
        return
      }

      const c = b >> a
      if (isSigned) {
        const shiftedOutWidth = BIGINT_255 - a
        const mask = (MAX_INTEGER_BIGINT >> shiftedOutWidth) << shiftedOutWidth
        r = c | mask
      } else {
        r = c
      }
      runState.stack.push(r)
    },
  ],
  // 0x20 range - crypto
  // 0x20: KECCAK256
  [
    0x20,
    function (runState, common) {
      const [offset, length] = runState.stack.popN(2)
      let data = new Uint8Array(0)
      if (length !== BIGINT_0) {
        data = runState.memory.read(Number(offset), Number(length))
      }
      const r = BigInt(bytesToHex((common.customCrypto.keccak256 ?? keccak256)(data)))
      runState.stack.push(r)
    },
  ],
  // 0x30 range - closure state
  // 0x30: ADDRESS
  [
    0x30,
    function (runState) {
      const address = bytesToBigInt(runState.interpreter.getAddress().bytes)
      runState.stack.push(address)
    },
  ],
  // 0x31: BALANCE
  [
    0x31,
    async function (runState) {
      const addressBigInt = runState.stack.pop()
      const address = createAddressFromStackBigInt(addressBigInt)
      const balance = await runState.interpreter.getExternalBalance(address)
      runState.stack.push(balance)
    },
  ],
  // 0x32: ORIGIN
  [
    0x32,
    function (runState) {
      runState.stack.push(runState.interpreter.getTxOrigin())
    },
  ],
  // 0x33: CALLER
  [
    0x33,
    function (runState) {
      runState.stack.push(runState.interpreter.getCaller())
    },
  ],
  // 0x34: CALLVALUE
  [
    0x34,
    function (runState) {
      runState.stack.push(runState.interpreter.getCallValue())
    },
  ],
  // 0x35: CALLDATALOAD
  [
    0x35,
    function (runState) {
      const pos = runState.stack.pop()
      if (pos > runState.interpreter.getCallDataSize()) {
        runState.stack.push(BIGINT_0)
        return
      }

      const i = Number(pos)
      let loaded = runState.interpreter.getCallData().subarray(i, i + 32)
      loaded = loaded.length ? loaded : Uint8Array.from([0])
      let r = bytesToBigInt(loaded)
      if (loaded.length < 32) {
        r = r << (BIGINT_8 * BigInt(32 - loaded.length))
      }
      runState.stack.push(r)
    },
  ],
  // 0x36: CALLDATASIZE
  [
    0x36,
    function (runState) {
      const r = runState.interpreter.getCallDataSize()
      runState.stack.push(r)
    },
  ],
  // 0x37: CALLDATACOPY
  [
    0x37,
    function (runState) {
      const [memOffset, dataOffset, dataLength] = runState.stack.popN(3)

      if (dataLength !== BIGINT_0) {
        const data = getDataSlice(runState.interpreter.getCallData(), dataOffset, dataLength)
        const memOffsetNum = Number(memOffset)
        const dataLengthNum = Number(dataLength)
        runState.memory.write(memOffsetNum, dataLengthNum, data)
      }
    },
  ],
  // 0x38: CODESIZE
  [
    0x38,
    function (runState) {
      runState.stack.push(runState.interpreter.getCodeSize())
    },
  ],
  // 0x39: CODECOPY
  [
    0x39,
    function (runState) {
      const [memOffset, codeOffset, dataLength] = runState.stack.popN(3)

      if (dataLength !== BIGINT_0) {
        const data = getDataSlice(runState.interpreter.getCode(), codeOffset, dataLength)
        const memOffsetNum = Number(memOffset)
        const lengthNum = Number(dataLength)
        runState.memory.write(memOffsetNum, lengthNum, data)
      }
    },
  ],
  // 0x3b: EXTCODESIZE
  [
    0x3b,
    async function (runState, common) {
      const addressBigInt = runState.stack.pop()
      const address = createAddressFromStackBigInt(addressBigInt)
      // EOF check
      let code = await runState.stateManager.getCode(address)
      if (isEOF(code)) {
        // In legacy code, the target code is treated as to be "EOFBYTES" code
        runState.stack.push(BigInt(EOFBYTES.length))
        return
      } else if (common.isActivatedEIP(7702)) {
        code = await eip7702CodeCheck(runState, code)
      }

      const size = BigInt(code.length)

      runState.stack.push(size)
    },
  ],
  // 0x3c: EXTCODECOPY
  [
    0x3c,
    async function (runState, common) {
      const [addressBigInt, memOffset, codeOffset, dataLength] = runState.stack.popN(4)

      if (dataLength !== BIGINT_0) {
        const address = createAddressFromStackBigInt(addressBigInt)
        let code = await runState.stateManager.getCode(address)

        if (isEOF(code)) {
          // In legacy code, the target code is treated as to be "EOFBYTES" code
          code = EOFBYTES
        } else if (common.isActivatedEIP(7702)) {
          code = await eip7702CodeCheck(runState, code)
        }

        const data = getDataSlice(code, codeOffset, dataLength)
        const memOffsetNum = Number(memOffset)
        const lengthNum = Number(dataLength)
        runState.memory.write(memOffsetNum, lengthNum, data)
      }
    },
  ],
  // 0x3f: EXTCODEHASH
  [
    0x3f,
    async function (runState, common) {
      const addressBigInt = runState.stack.pop()
      const address = createAddressFromStackBigInt(addressBigInt)

      // EOF check
      const code = await runState.stateManager.getCode(address)
      if (isEOF(code)) {
        // In legacy code, the target code is treated as to be "EOFBYTES" code
        // Therefore, push the hash of EOFBYTES to the stack
        runState.stack.push(bytesToBigInt(EOFHASH))
        return
      } else if (common.isActivatedEIP(7702)) {
        const possibleDelegatedAddress = getEIP7702DelegatedAddress(code)
        if (possibleDelegatedAddress !== undefined) {
          const account = await runState.stateManager.getAccount(possibleDelegatedAddress)
          if (!account || account.isEmpty()) {
            runState.stack.push(BIGINT_0)
            return
          }

          runState.stack.push(BigInt(bytesToHex(account.codeHash)))
          return
        } else {
          runState.stack.push(bytesToBigInt(keccak256(code)))
          return
        }
      }

      const account = await runState.stateManager.getAccount(address)
      if (!account || account.isEmpty()) {
        runState.stack.push(BIGINT_0)
        return
      }

      runState.stack.push(BigInt(bytesToHex(account.codeHash)))
    },
  ],
  // 0x3d: RETURNDATASIZE
  [
    0x3d,
    function (runState) {
      runState.stack.push(runState.interpreter.getReturnDataSize())
    },
  ],
  // 0x3e: RETURNDATACOPY
  [
    0x3e,
    function (runState) {
      const [memOffset, returnDataOffset, dataLength] = runState.stack.popN(3)

      if (dataLength !== BIGINT_0) {
        const data = getDataSlice(
          runState.interpreter.getReturnData(),
          returnDataOffset,
          dataLength,
        )
        const memOffsetNum = Number(memOffset)
        const lengthNum = Number(dataLength)
        runState.memory.write(memOffsetNum, lengthNum, data)
      }
    },
  ],
  // 0x3a: GASPRICE
  [
    0x3a,
    function (runState) {
      runState.stack.push(runState.interpreter.getTxGasPrice())
    },
  ],
  // '0x40' range - block operations
  // 0x40: BLOCKHASH
  [
    0x40,
    async function (runState, common) {
      const number = runState.stack.pop()

      if (common.isActivatedEIP(7709)) {
        if (number >= runState.interpreter.getBlockNumber()) {
          runState.stack.push(BIGINT_0)
          return
        }

        const diff = runState.interpreter.getBlockNumber() - number
        // block lookups must be within the original window even if historyStorageAddress's
        // historyServeWindow is much greater than 256
        if (diff > BIGINT_256 || diff <= BIGINT_0) {
          runState.stack.push(BIGINT_0)
          return
        }

        const historyAddress = new Address(
          bigIntToAddressBytes(common.param('historyStorageAddress')),
        )
        const historyServeWindow = common.param('historyServeWindow')
        const key = setLengthLeft(bigIntToBytes(number % historyServeWindow), 32)

        if (common.isActivatedEIP(6800)) {
          const { treeIndex, subIndex } = getVerkleTreeIndicesForStorageSlot(number)
          // create witnesses and charge gas
          const statelessGas = runState.env.accessWitness!.touchAddressOnReadAndComputeGas(
            historyAddress,
            treeIndex,
            subIndex,
          )
          runState.interpreter.useGas(statelessGas, `BLOCKHASH`)
        }
        const storage = await runState.stateManager.getStorage(historyAddress, key)

        runState.stack.push(bytesToBigInt(storage))
      } else {
        const diff = runState.interpreter.getBlockNumber() - number
        // block lookups must be within the past 256 blocks
        if (diff > BIGINT_256 || diff <= BIGINT_0) {
          runState.stack.push(BIGINT_0)
          return
        }

        const block = await runState.blockchain.getBlock(Number(number))

        runState.stack.push(bytesToBigInt(block.hash()))
      }
    },
  ],
  // 0x41: COINBASE
  [
    0x41,
    function (runState) {
      runState.stack.push(runState.interpreter.getBlockCoinbase())
    },
  ],
  // 0x42: TIMESTAMP
  [
    0x42,
    function (runState) {
      runState.stack.push(runState.interpreter.getBlockTimestamp())
    },
  ],
  // 0x43: NUMBER
  [
    0x43,
    function (runState) {
      runState.stack.push(runState.interpreter.getBlockNumber())
    },
  ],
  // 0x44: DIFFICULTY (EIP-4399: supplanted as PREVRANDAO)
  [
    0x44,
    function (runState, common) {
      if (common.isActivatedEIP(4399)) {
        runState.stack.push(runState.interpreter.getBlockPrevRandao())
      } else {
        runState.stack.push(runState.interpreter.getBlockDifficulty())
      }
    },
  ],
  // 0x45: GASLIMIT
  [
    0x45,
    function (runState) {
      runState.stack.push(runState.interpreter.getBlockGasLimit())
    },
  ],
  // 0x46: CHAINID
  [
    0x46,
    function (runState) {
      runState.stack.push(runState.interpreter.getChainId())
    },
  ],
  // 0x47: SELFBALANCE
  [
    0x47,
    function (runState) {
      runState.stack.push(runState.interpreter.getSelfBalance())
    },
  ],
  // 0x48: BASEFEE
  [
    0x48,
    function (runState) {
      runState.stack.push(runState.interpreter.getBlockBaseFee())
    },
  ],
  // 0x49: BLOBHASH
  [
    0x49,
    function (runState) {
      const index = runState.stack.pop()
      if (runState.env.blobVersionedHashes.length > Number(index)) {
        runState.stack.push(BigInt(runState.env.blobVersionedHashes[Number(index)]))
      } else {
        runState.stack.push(BIGINT_0)
      }
    },
  ],
  // 0x4a: BLOBBASEFEE
  [
    0x4a,
    function (runState) {
      runState.stack.push(runState.interpreter.getBlobBaseFee())
    },
  ],
  // 0x50 range - 'storage' and execution
  // 0x50: POP
  [
    0x50,
    function (runState) {
      runState.stack.pop()
    },
  ],
  // 0x51: MLOAD
  [
    0x51,
    function (runState) {
      const pos = runState.stack.pop()
      const word = runState.memory.read(Number(pos), 32, true)
      runState.stack.push(bytesToBigInt(word))

      // For Synthesizer //
      const loadSize = 32
      const offsetPt = runState.stackPt.pop()
      const offsetNum = Number(offsetPt.value)
      const dataAliasInfos = runState.memoryPt.getDataAlias(offsetNum, loadSize)
      const mutDataPt = runState.synthesizer.newPlacementMLOAD(dataAliasInfos)
      if (Number(pos) !== offsetNum || runState.stack.peek(1)[0] !== mutDataPt.value) {
        throw new Error(`MLOAD: Data mismatch between stackPt and stack`)
      }
      runState.stackPt.push(mutDataPt)
    },
  ],
  // 0x52: MSTORE
  [
    0x52,
    function (runState) {
      const [offset, word] = runState.stack.popN(2)
      const buf = setLengthLeft(bigIntToBytes(word), 32)
      const offsetNum = Number(offset)
      runState.memory.write(offsetNum, 32, buf)

      // For Synthesizer //
      const truncSize = 32
      const dataPt = runState.stackPt.peek(2)[1]
      const memPt = runState.synthesizer.newPlacementMSTORE(truncSize, dataPt)
      if (truncSize < dataPt.actualSize) {
        // StackPt에서 dataPt를 변형을 추적 memPt로 교체해 줍니다.
        runState.stackPt.swap(1)
        runState.stackPt.pop() // 기존 dataPt를 버립니다.
        runState.stackPt.push(memPt) // 변형된 dataPt를 넣습니다.
        runState.stackPt.swap(1)
      }
      const [offsetPt, newDataPt] = runState.stackPt.popN(2)
      const _offsetNum = Number(offsetPt.value)
      if (_offsetNum !== offsetNum || newDataPt.value !== word) {
        throw new Error(`MSTORE: Data mismatch between stackPt and stack`)
      }
      runState.memoryPt.write(offsetNum, truncSize, newDataPt)
    },
  ],
  // 0x53: MSTORE8
  [
    0x53,
    function (runState) {
      const [offset, byte] = runState.stack.popN(2)

      const buf = bigIntToBytes(byte & BIGINT_255)
      const offsetNum = Number(offset)
      runState.memory.write(offsetNum, 1, buf)

      // For Synthesizer //
      const truncSize = 1 // MSTORE8은 최하위 1바이트만을 저장하고, 상위 바이트는 버림.
      const dataPt = runState.stackPt.peek(2)[1] // StackPt에서 최상위 두번째 포인터를 리턴 (stack.ts 참고)
      // 데이터의 변형을 추적하면서 동시에 Placements에도 반영 해 줍니다.
      const memPt = runState.synthesizer.newPlacementMSTORE(truncSize, dataPt)
      if (truncSize < dataPt.actualSize) {
        // StackPt에서 dataPt를 변형을 추적 memPt로 교체해 줍니다.
        runState.stackPt.swap(1)
        runState.stackPt.pop() // 기존 dataPt를 버립니다.
        runState.stackPt.push(memPt) // 변형된 dataPt를 넣습니다.
        runState.stackPt.swap(1)
      }
      // 이제 일반적인 MSTORE 연산을 수행합니다
      const [offsetPt, newDataPt] = runState.stackPt.popN(2)
      const _offsetNum = Number(offsetPt.value)
      if (_offsetNum !== offsetNum || newDataPt.value !== byte) {
        throw new Error(`MSTORE8: Data mismatch between stackPt and stack`)
      }
      runState.memoryPt.write(offsetNum, truncSize, newDataPt)
    },
  ],
  // 0x54: SLOAD
  [
    0x54,
    async function (runState) {
      const key = runState.stack.pop()
      const keyBuf = setLengthLeft(bigIntToBytes(key), 32)
      const value = await runState.interpreter.storageLoad(keyBuf)
      const valueBigInt = value.length ? bytesToBigInt(value) : BIGINT_0
      runState.stack.push(valueBigInt)
    },
  ],
  // 0x55: SSTORE
  [
    0x55,
    async function (runState) {
      const [key, val] = runState.stack.popN(2)

      const keyBuf = setLengthLeft(bigIntToBytes(key), 32)
      // NOTE: this should be the shortest representation
      let value
      if (val === BIGINT_0) {
        value = Uint8Array.from([])
      } else {
        value = bigIntToBytes(val)
      }

      await runState.interpreter.storageStore(keyBuf, value)
    },
  ],
  // 0x56: JUMP
  [
    0x56,
    function (runState) {
      const dest = runState.stack.pop()
      if (dest > runState.interpreter.getCodeSize()) {
        trap(ERROR.INVALID_JUMP + ' at ' + describeLocation(runState))
      }

      const destNum = Number(dest)

      if (!jumpIsValid(runState, destNum)) {
        trap(ERROR.INVALID_JUMP + ' at ' + describeLocation(runState))
      }

      runState.programCounter = destNum
    },
  ],
  // 0x57: JUMPI
  [
    0x57,
    function (runState) {
      const [dest, cond] = runState.stack.popN(2)
      if (cond !== BIGINT_0) {
        if (dest > runState.interpreter.getCodeSize()) {
          trap(ERROR.INVALID_JUMP + ' at ' + describeLocation(runState))
        }

        const destNum = Number(dest)

        if (!jumpIsValid(runState, destNum)) {
          trap(ERROR.INVALID_JUMP + ' at ' + describeLocation(runState))
        }

        runState.programCounter = destNum
      }
    },
  ],
  // 0x58: PC
  [
    0x58,
    function (runState) {
      runState.stack.push(BigInt(runState.programCounter - 1))
    },
  ],
  // 0x59: MSIZE
  [
    0x59,
    function (runState) {
      runState.stack.push(runState.memoryWordCount * BIGINT_32)
    },
  ],
  // 0x5a: GAS
  [
    0x5a,
    function (runState) {
      runState.stack.push(runState.interpreter.getGasLeft())
    },
  ],
  // 0x5b: JUMPDEST
  [0x5b, function () {}],
  // 0x5c: TLOAD (EIP 1153)
  [
    0x5c,
    function (runState) {
      const key = runState.stack.pop()
      const keyBuf = setLengthLeft(bigIntToBytes(key), 32)
      const value = runState.interpreter.transientStorageLoad(keyBuf)
      const valueBN = value.length ? bytesToBigInt(value) : BIGINT_0
      runState.stack.push(valueBN)
    },
  ],
  // 0x5d: TSTORE (EIP 1153)
  [
    0x5d,
    function (runState) {
      // TSTORE
      if (runState.interpreter.isStatic()) {
        trap(ERROR.STATIC_STATE_CHANGE)
      }
      const [key, val] = runState.stack.popN(2)

      const keyBuf = setLengthLeft(bigIntToBytes(key), 32)
      // NOTE: this should be the shortest representation
      let value
      if (val === BIGINT_0) {
        value = Uint8Array.from([])
      } else {
        value = bigIntToBytes(val)
      }

      runState.interpreter.transientStorageStore(keyBuf, value)
    },
  ],
  // 0x5e: MCOPY (5656)
  [
    0x5e,
    function (runState) {
      const [dst, src, length] = runState.stack.popN(3)
      const data = runState.memory.read(Number(src), Number(length), true)
      runState.memory.write(Number(dst), Number(length), data)
    },
  ],
  // 0x5f: PUSH0
  [
    0x5f,
    function (runState) {
      runState.stack.push(BIGINT_0)
    },
  ],
  // 0x60: PUSH
  [
    0x60,
    function (runState, common) {
      const numToPush = runState.opCode - 0x5f
      if (
        runState.programCounter + numToPush > runState.code.length &&
        common.isActivatedEIP(3540)
      ) {
        trap(ERROR.OUT_OF_RANGE)
      }

      if (common.isActivatedEIP(6800) && runState.env.chargeCodeAccesses === true) {
        const contract = runState.interpreter.getAddress()
        const startOffset = Math.min(runState.code.length, runState.programCounter + 1)
        const endOffset = Math.min(runState.code.length, startOffset + numToPush - 1)
        const statelessGas = runState.env.accessWitness!.touchCodeChunksRangeOnReadAndChargeGas(
          contract,
          startOffset,
          endOffset,
        )
        runState.interpreter.useGas(statelessGas, `PUSH`)
      }

      if (!runState.shouldDoJumpAnalysis) {
        runState.stack.push(runState.cachedPushes[runState.programCounter])
        runState.programCounter += numToPush
      } else {
        const loaded = bytesToBigInt(
          runState.code.subarray(runState.programCounter, runState.programCounter + numToPush),
        )
        runState.programCounter += numToPush
        runState.stack.push(loaded)
      }

      // For Synthesizer
      const value = runState.stack.peek(1)[0]
      const dataPt = runState.synthesizer.newPlacementPUSH(
        numToPush,
        runState.programCounterPrev,
        value,
      )
      runState.stackPt.push(dataPt)
    },
  ],
  // 0x80: DUP
  [
    0x80,
    function (runState) {
      const stackPos = runState.opCode - 0x7f
      runState.stack.dup(stackPos)
    },
  ],
  // 0x90: SWAP
  [
    0x90,
    function (runState) {
      const stackPos = runState.opCode - 0x8f
      runState.stack.swap(stackPos)
    },
  ],
  // 0xa0: LOG
  [
    0xa0,
    function (runState) {
      const [memOffset, memLength] = runState.stack.popN(2)

      const topicsCount = runState.opCode - 0xa0

      const topics = runState.stack.popN(topicsCount)
      const topicsBuf = topics.map(function (a: bigint) {
        return setLengthLeft(bigIntToBytes(a), 32)
      })

      let mem = new Uint8Array(0)
      if (memLength !== BIGINT_0) {
        mem = runState.memory.read(Number(memOffset), Number(memLength))
      }

      runState.interpreter.log(mem, topicsCount, topicsBuf)
    },
  ],
  // 0xd0: DATALOAD
  [
    0xd0,
    function (runState, _common) {
      if (runState.env.eof === undefined) {
        // Opcode not available in legacy contracts
        trap(ERROR.INVALID_OPCODE)
      }
      const pos = runState.stack.pop()
      if (pos > runState.env.eof!.container.body.dataSection.length) {
        runState.stack.push(BIGINT_0)
        return
      }

      const i = Number(pos)
      let loaded = runState.env.eof!.container.body.dataSection.subarray(i, i + 32)
      loaded = loaded.length ? loaded : Uint8Array.from([0])
      let r = bytesToBigInt(loaded)
      // Pad the loaded length with 0 bytes in case it is smaller than 32
      if (loaded.length < 32) {
        r = r << (BIGINT_8 * BigInt(32 - loaded.length))
      }
      runState.stack.push(r)
    },
  ],
  // 0xd1: DATALOADN
  [
    0xd1,
    function (runState, _common) {
      if (runState.env.eof === undefined) {
        // Opcode not available in legacy contracts
        trap(ERROR.INVALID_OPCODE)
      }
      const toLoad = Number(
        bytesToBigInt(runState.code.subarray(runState.programCounter, runState.programCounter + 2)),
      )
      const data = bytesToBigInt(
        runState.env.eof!.container.body.dataSection.subarray(toLoad, toLoad + 32),
      )
      runState.stack.push(data)
      runState.programCounter += 2
    },
  ],
  // 0xd2: DATASIZE
  [
    0xd2,
    function (runState, _common) {
      if (runState.env.eof === undefined) {
        // Opcode not available in legacy contracts
        trap(ERROR.INVALID_OPCODE)
      }
      runState.stack.push(BigInt(runState.env.eof!.container.body.dataSection.length))
    },
  ],
  // 0xd3: DATACOPY
  [
    0xd3,
    function (runState, _common) {
      if (runState.env.eof === undefined) {
        // Opcode not available in legacy contracts
        trap(ERROR.INVALID_OPCODE)
      }
      const [memOffset, offset, size] = runState.stack.popN(3)
      if (size !== BIGINT_0) {
        const data = getDataSlice(runState.env.eof!.container.body.dataSection, offset, size)
        const memOffsetNum = Number(memOffset)
        const dataLengthNum = Number(size)
        runState.memory.write(memOffsetNum, dataLengthNum, data)
      }
    },
  ],
  // 0xe0: RJUMP
  [
    0xe0,
    function (runState, _common) {
      if (runState.env.eof === undefined) {
        // Opcode not available in legacy contracts
        trap(ERROR.INVALID_OPCODE)
      } else {
        const code = runState.env.code
        const rjumpDest = new DataView(code.buffer).getInt16(runState.programCounter)
        runState.programCounter += 2 + rjumpDest
      }
    },
  ],
  // 0xe1: RJUMPI
  [
    0xe1,
    function (runState, _common) {
      if (runState.env.eof === undefined) {
        // Opcode not available in legacy contracts
        trap(ERROR.INVALID_OPCODE)
      } else {
        const cond = runState.stack.pop()
        // Move PC to the PC post instruction
        if (cond > 0) {
          const code = runState.env.code
          const rjumpDest = new DataView(code.buffer).getInt16(runState.programCounter)
          runState.programCounter += rjumpDest
        }
        // In all cases, increment PC with 2 (also in the case if `cond` is `0`)
        runState.programCounter += 2
      }
    },
  ],
  // 0xe2: RJUMPV
  [
    0xe2,
    function (runState, _common) {
      if (runState.env.eof === undefined) {
        // Opcode not available in legacy contracts
        trap(ERROR.INVALID_OPCODE)
      } else {
        const code = runState.env.code
        const jumptableEntries = code[runState.programCounter]
        // Note: if the size of the immediate is `0`, this thus means that the actual size is `2`
        // This allows for 256 entries in the table instead of 255
        const jumptableSize = (jumptableEntries + 1) * 2
        // Move PC to start of the jump table
        runState.programCounter += 1
        const jumptableCase = runState.stack.pop()
        if (jumptableCase <= jumptableEntries) {
          const rjumpDest = new DataView(code.buffer).getInt16(
            runState.programCounter + Number(jumptableCase) * 2,
          )
          runState.programCounter += jumptableSize + rjumpDest
        } else {
          runState.programCounter += jumptableSize
        }
      }
    },
  ],
  // 0xe3: CALLF
  [
    0xe3,
    function (runState, _common) {
      if (runState.env.eof === undefined) {
        // Opcode not available in legacy contracts
        trap(ERROR.INVALID_OPCODE)
      }
      const sectionTarget = bytesToInt(
        runState.code.slice(runState.programCounter, runState.programCounter + 2),
      )
      const stackItems = runState.stack.length
      const typeSection = runState.env.eof!.container.body.typeSections[sectionTarget]
      if (1024 < stackItems + typeSection?.inputs - typeSection?.maxStackHeight) {
        trap(EOFError.StackOverflow)
      }
      if (runState.env.eof!.eofRunState.returnStack.length >= 1024) {
        trap(EOFError.ReturnStackOverflow)
      }
      runState.env.eof?.eofRunState.returnStack.push(runState.programCounter + 2)

      // Find out the opcode we should jump into
      runState.programCounter = runState.env.eof!.container.header.getCodePosition(sectionTarget)
    },
  ],
  // 0xe4: RETF
  [
    0xe4,
    function (runState, _common) {
      if (runState.env.eof === undefined) {
        // Opcode not available in legacy contracts
        trap(ERROR.INVALID_OPCODE)
      }
      const newPc = runState.env.eof!.eofRunState.returnStack.pop()
      if (newPc === undefined) {
        // This should NEVER happen since it is validated that functions either terminate (the call frame) or return
        trap(EOFError.RetfNoReturn)
      }
      runState.programCounter = newPc!
    },
  ],
  // 0xe5: JUMPF
  [
    0xe5,
    function (runState, _common) {
      if (runState.env.eof === undefined) {
        // Opcode not available in legacy contracts
        trap(ERROR.INVALID_OPCODE)
      }
      // NOTE: (and also TODO) this code is exactly the same as CALLF, except pushing to the return stack is now skipped
      // (and also the return stack overflow check)
      // It is commented out here
      const sectionTarget = bytesToInt(
        runState.code.slice(runState.programCounter, runState.programCounter + 2),
      )
      const stackItems = runState.stack.length
      const typeSection = runState.env.eof!.container.body.typeSections[sectionTarget]
      if (1024 < stackItems + typeSection?.inputs - typeSection?.maxStackHeight) {
        trap(EOFError.StackOverflow)
      }
      /*if (runState.env.eof!.eofRunState.returnStack.length >= 1024) {
        trap(EOFError.ReturnStackOverflow)
      }
      runState.env.eof?.eofRunState.returnStack.push(runState.programCounter + 2)*/

      // Find out the opcode we should jump into
      runState.programCounter = runState.env.eof!.container.header.getCodePosition(sectionTarget)
    },
  ],
  // 0xe6: DUPN
  [
    0xe6,
    function (runState, _common) {
      if (runState.env.eof === undefined) {
        // Opcode not available in legacy contracts
        trap(ERROR.INVALID_OPCODE)
      }
      const toDup =
        Number(
          bytesToBigInt(
            runState.code.subarray(runState.programCounter, runState.programCounter + 1),
          ),
        ) + 1
      runState.stack.dup(toDup)
      runState.programCounter++
    },
  ],
  // 0xe7: SWAPN
  [
    0xe7,
    function (runState, _common) {
      if (runState.env.eof === undefined) {
        // Opcode not available in legacy contracts
        trap(ERROR.INVALID_OPCODE)
      }
      const toSwap =
        Number(
          bytesToBigInt(
            runState.code.subarray(runState.programCounter, runState.programCounter + 1),
          ),
        ) + 1
      runState.stack.swap(toSwap)
      runState.programCounter++
    },
  ],
  // 0xe8: EXCHANGE
  [
    0xe8,
    function (runState, _common) {
      if (runState.env.eof === undefined) {
        // Opcode not available in legacy contracts
        trap(ERROR.INVALID_OPCODE)
      }
      const toExchange = Number(
        bytesToBigInt(runState.code.subarray(runState.programCounter, runState.programCounter + 1)),
      )
      const n = (toExchange >> 4) + 1
      const m = (toExchange & 0x0f) + 1
      runState.stack.exchange(n, n + m)
      runState.programCounter++
    },
  ],
  // 0xec: EOFCREATE
  [
    0xec,
    async function (runState, _common) {
      if (runState.env.eof === undefined) {
        // Opcode not available in legacy contracts
        trap(ERROR.INVALID_OPCODE)
      } else {
        // Read container index
        const containerIndex = runState.env.code[runState.programCounter]
        const containerCode = runState.env.eof!.container.body.containerSections[containerIndex]

        // Pop stack values
        const [value, salt, inputOffset, inputSize] = runState.stack.popN(4)

        const gasLimit = runState.messageGasLimit!
        runState.messageGasLimit = undefined

        let data = new Uint8Array(0)
        if (inputSize !== BIGINT_0) {
          data = runState.memory.read(Number(inputOffset), Number(inputSize), true)
        }

        runState.programCounter++ // Jump over the immediate byte

        const ret = await runState.interpreter.eofcreate(
          gasLimit,
          value,
          containerCode,
          setLengthLeft(bigIntToBytes(salt), 32),
          data,
        )
        runState.stack.push(ret)
      }
    },
  ],
  // 0xee: RETURNCONTRACT
  [
    0xee,
    async function (runState, _common) {
      if (runState.env.eof === undefined) {
        // Opcode not available in legacy contracts
        trap(ERROR.INVALID_OPCODE)
      } else {
        // Read container index
        const containerIndex = runState.env.code[runState.programCounter]
        const containerCode = runState.env.eof!.container.body.containerSections[containerIndex]

        // Read deployContainer as EOFCreate (initcode) container
        const deployContainer = new EOFContainer(containerCode, EOFContainerMode.Initmode)

        // Pop stack values
        const [auxDataOffset, auxDataSize] = runState.stack.popN(2)

        let auxData = new Uint8Array(0)
        if (auxDataSize !== BIGINT_0) {
          auxData = runState.memory.read(Number(auxDataOffset), Number(auxDataSize))
        }

        const originalDataSize = deployContainer.header.dataSize
        const preDeployDataSectionSize = deployContainer.body.dataSection.length
        const actualSectionSize = preDeployDataSectionSize + Number(auxDataSize)

        if (actualSectionSize < originalDataSize) {
          trap(EOFError.InvalidReturnContractDataSize)
        }

        if (actualSectionSize > 0xffff) {
          // Data section size is now larger than the max data section size
          // Temp: trap OOG?
          trap(ERROR.OUT_OF_GAS)
        }

        const newSize = setLengthLeft(bigIntToBytes(BigInt(actualSectionSize)), 2)

        // Write the bytes to the containerCode
        const dataSizePtr = deployContainer.header.dataSizePtr
        containerCode[dataSizePtr] = newSize[0]
        containerCode[dataSizePtr + 1] = newSize[1]

        const returnContainer = concatBytes(containerCode, auxData)

        runState.interpreter.finish(returnContainer)
      }
    },
  ],
  // '0xf0' range - closures
  // 0xf0: CREATE
  [
    0xf0,
    async function (runState, common) {
      const [value, offset, length] = runState.stack.popN(3)

      if (
        common.isActivatedEIP(3860) &&
        length > Number(common.param('maxInitCodeSize')) &&
        !runState.interpreter._evm.allowUnlimitedInitCodeSize
      ) {
        trap(ERROR.INITCODE_SIZE_VIOLATION)
      }

      const gasLimit = runState.messageGasLimit!
      runState.messageGasLimit = undefined

      let data = new Uint8Array(0)
      if (length !== BIGINT_0) {
        data = runState.memory.read(Number(offset), Number(length), true)
      }

      if (isEOF(data)) {
        // Legacy cannot deploy EOF code
        runState.stack.push(BIGINT_0)
        return
      }

      const ret = await runState.interpreter.create(gasLimit, value, data)
      runState.stack.push(ret)
    },
  ],
  // 0xf5: CREATE2
  [
    0xf5,
    async function (runState, common) {
      if (runState.interpreter.isStatic()) {
        trap(ERROR.STATIC_STATE_CHANGE)
      }

      const [value, offset, length, salt] = runState.stack.popN(4)

      if (
        common.isActivatedEIP(3860) &&
        length > Number(common.param('maxInitCodeSize')) &&
        !runState.interpreter._evm.allowUnlimitedInitCodeSize
      ) {
        trap(ERROR.INITCODE_SIZE_VIOLATION)
      }

      const gasLimit = runState.messageGasLimit!
      runState.messageGasLimit = undefined

      let data = new Uint8Array(0)
      if (length !== BIGINT_0) {
        data = runState.memory.read(Number(offset), Number(length), true)
      }

      if (isEOF(data)) {
        // Legacy cannot deploy EOF code
        runState.stack.push(BIGINT_0)
        return
      }

      const ret = await runState.interpreter.create2(
        gasLimit,
        value,
        data,
        setLengthLeft(bigIntToBytes(salt), 32),
      )
      runState.stack.push(ret)
    },
  ],
  // 0xf1: CALL
  [
    0xf1,
    async function (runState: RunState, common: Common) {
      const [_currentGasLimit, toAddr, value, inOffset, inLength, outOffset, outLength] =
        runState.stack.popN(7)
      const toAddress = createAddressFromStackBigInt(toAddr)

      let data = new Uint8Array(0)
      if (inLength !== BIGINT_0) {
        data = runState.memory.read(Number(inOffset), Number(inLength), true)
      }

      let gasLimit = runState.messageGasLimit!
      if (value !== BIGINT_0) {
        const callStipend = common.param('callStipendGas')
        runState.interpreter.addStipend(callStipend)
        gasLimit += callStipend
      }

      runState.messageGasLimit = undefined

      const ret = await runState.interpreter.call(gasLimit, toAddress, value, data)
      // Write return data to memory
      writeCallOutput(runState, outOffset, outLength)
      runState.stack.push(ret)
    },
  ],
  // 0xf2: CALLCODE
  [
    0xf2,
    async function (runState: RunState, common: Common) {
      const [_currentGasLimit, toAddr, value, inOffset, inLength, outOffset, outLength] =
        runState.stack.popN(7)
      const toAddress = createAddressFromStackBigInt(toAddr)

      let gasLimit = runState.messageGasLimit!
      if (value !== BIGINT_0) {
        const callStipend = common.param('callStipendGas')
        runState.interpreter.addStipend(callStipend)
        gasLimit += callStipend
      }

      runState.messageGasLimit = undefined

      let data = new Uint8Array(0)
      if (inLength !== BIGINT_0) {
        data = runState.memory.read(Number(inOffset), Number(inLength), true)
      }

      const ret = await runState.interpreter.callCode(gasLimit, toAddress, value, data)
      // Write return data to memory
      writeCallOutput(runState, outOffset, outLength)
      runState.stack.push(ret)
    },
  ],
  // 0xf4: DELEGATECALL
  [
    0xf4,
    async function (runState) {
      const value = runState.interpreter.getCallValue()
      const [_currentGasLimit, toAddr, inOffset, inLength, outOffset, outLength] =
        runState.stack.popN(6)
      const toAddress = createAddressFromStackBigInt(toAddr)

      let data = new Uint8Array(0)
      if (inLength !== BIGINT_0) {
        data = runState.memory.read(Number(inOffset), Number(inLength), true)
      }

      const gasLimit = runState.messageGasLimit!
      runState.messageGasLimit = undefined

      const ret = await runState.interpreter.callDelegate(gasLimit, toAddress, value, data)
      // Write return data to memory
      writeCallOutput(runState, outOffset, outLength)
      runState.stack.push(ret)
    },
  ],
  // 0xf8: EXTCALL
  [
    0xf8,
    async function (runState, _common) {
      if (runState.env.eof === undefined) {
        // Opcode not available in legacy contracts
        trap(ERROR.INVALID_OPCODE)
      } else {
        const [toAddr, inOffset, inLength, value] = runState.stack.popN(4)

        const gasLimit = runState.messageGasLimit!
        runState.messageGasLimit = undefined

        if (gasLimit === -BIGINT_1) {
          // Special case, abort doing any logic (this logic is defined in `gas.ts`), and put `1` on stack per spec
          runState.stack.push(BIGINT_1)
          runState.returnBytes = new Uint8Array(0)
          return
        }

        const toAddress = createAddressFromStackBigInt(toAddr)

        let data = new Uint8Array(0)
        if (inLength !== BIGINT_0) {
          data = runState.memory.read(Number(inOffset), Number(inLength), true)
        }

        const ret = await runState.interpreter.call(gasLimit, toAddress, value, data)
        // Write return data to memory

        runState.stack.push(ret)
      }
    },
  ],
  // 0xf9: EXTDELEGATECALL
  [
    0xf9,
    async function (runState, _common) {
      if (runState.env.eof === undefined) {
        // Opcode not available in legacy contracts
        trap(ERROR.INVALID_OPCODE)
      } else {
        const value = runState.interpreter.getCallValue()
        const [toAddr, inOffset, inLength] = runState.stack.popN(3)

        const gasLimit = runState.messageGasLimit!
        runState.messageGasLimit = undefined

        if (gasLimit === -BIGINT_1) {
          // Special case, abort doing any logic (this logic is defined in `gas.ts`), and put `1` on stack per spec
          runState.stack.push(BIGINT_1)
          runState.returnBytes = new Uint8Array(0)
          return
        }

        const toAddress = createAddressFromStackBigInt(toAddr)

        const code = await runState.stateManager.getCode(toAddress)

        if (!isEOF(code)) {
          // EXTDELEGATECALL cannot call legacy contracts
          runState.stack.push(BIGINT_1)
          return
        }

        let data = new Uint8Array(0)
        if (inLength !== BIGINT_0) {
          data = runState.memory.read(Number(inOffset), Number(inLength), true)
        }

        const ret = await runState.interpreter.callDelegate(gasLimit, toAddress, value, data)
        runState.stack.push(ret)
      }
    },
  ],
  // 0xfa: STATICCALL
  [
    0xfa,
    async function (runState) {
      const value = BIGINT_0
      const [_currentGasLimit, toAddr, inOffset, inLength, outOffset, outLength] =
        runState.stack.popN(6)
      const toAddress = createAddressFromStackBigInt(toAddr)

      const gasLimit = runState.messageGasLimit!
      runState.messageGasLimit = undefined

      let data = new Uint8Array(0)
      if (inLength !== BIGINT_0) {
        data = runState.memory.read(Number(inOffset), Number(inLength), true)
      }

      const ret = await runState.interpreter.callStatic(gasLimit, toAddress, value, data)
      // Write return data to memory
      writeCallOutput(runState, outOffset, outLength)
      runState.stack.push(ret)
    },
  ],
  // 0xfb: EXTSTATICCALL
  [
    0xfb,
    async function (runState, _common) {
      if (runState.env.eof === undefined) {
        // Opcode not available in legacy contracts
        trap(ERROR.INVALID_OPCODE)
      } else {
        const value = BIGINT_0
        const [toAddr, inOffset, inLength] = runState.stack.popN(3)

        const gasLimit = runState.messageGasLimit!
        runState.messageGasLimit = undefined

        if (gasLimit === -BIGINT_1) {
          // Special case, abort doing any logic (this logic is defined in `gas.ts`), and put `1` on stack per spec
          runState.stack.push(BIGINT_1)
          runState.returnBytes = new Uint8Array(0)
          return
        }

        const toAddress = createAddressFromStackBigInt(toAddr)

        let data = new Uint8Array(0)
        if (inLength !== BIGINT_0) {
          data = runState.memory.read(Number(inOffset), Number(inLength), true)
        }

        const ret = await runState.interpreter.callStatic(gasLimit, toAddress, value, data)
        runState.stack.push(ret)
      }
    },
  ],
  // 0xf3: RETURN
  [
    0xf3,
    function (runState) {
      const [offset, length] = runState.stack.popN(2)
      let returnData = new Uint8Array(0)
      if (length !== BIGINT_0) {
        returnData = runState.memory.read(Number(offset), Number(length))
      }

      // For Synthesizer //
      const [offsetPt, lengthPt] = runState.stackPt.popN(2)
      const offsetNum = Number(offsetPt.value)
      const lengthNum = Number(lengthPt.value)
      const nChunks = Math.ceil(lengthNum / 32)
      for (let i = 0; i < nChunks; i++) {
        const chunkOffset = offsetNum + 32 * i
        const dataAliasInfos = runState.memoryPt.getDataAlias(chunkOffset, 32)
        runState.synthesizer.newPlacementRETURNs('RETURN', dataAliasInfos)
      }
      ////

      runState.interpreter.finish(returnData)
    },
  ],
  // 0xfd: REVERT
  [
    0xfd,
    function (runState) {
      const [offset, length] = runState.stack.popN(2)
      let returnData = new Uint8Array(0)
      if (length !== BIGINT_0) {
        returnData = runState.memory.read(Number(offset), Number(length))
      }
      runState.interpreter.revert(returnData)
    },
  ],
  // '0x70', range - other
  // 0xff: SELFDESTRUCT
  [
    0xff,
    async function (runState) {
      const selfdestructToAddressBigInt = runState.stack.pop()
      const selfdestructToAddress = createAddressFromStackBigInt(selfdestructToAddressBigInt)
      return runState.interpreter.selfDestruct(selfdestructToAddress)
    },
  ],
])

// Fill in rest of PUSHn, DUPn, SWAPn, LOGn for handlers
const pushFn = handlers.get(0x60)!
for (let i = 0x61; i <= 0x7f; i++) {
  handlers.set(i, pushFn)
}
const dupFn = handlers.get(0x80)!
for (let i = 0x81; i <= 0x8f; i++) {
  handlers.set(i, dupFn)
}
const swapFn = handlers.get(0x90)!
for (let i = 0x91; i <= 0x9f; i++) {
  handlers.set(i, swapFn)
}
const logFn = handlers.get(0xa0)!
for (let i = 0xa1; i <= 0xa4; i++) {
  handlers.set(i, logFn)
}
