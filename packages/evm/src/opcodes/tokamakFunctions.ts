import type { RunState } from '../interpreter.js'
import type { Common } from '@ethereumjs/common'

export interface SyncOpHandler {
  (runState: RunState, common: Common): void
}

export interface AsyncOpHandler {
  (runState: RunState, common: Common): Promise<void>
}
export type TokamakOpHandler = SyncOpHandler | AsyncOpHandler

// the opcode functions
export const tokamakHandlers: Map<number, TokamakOpHandler> = new Map([
  // 0x00: STOP
  [0x00, function () {}],
  // 0x01: ADD
  [0x01, function () {}],
  // 0x02: MUL
  [0x02, function () {}],
  // 0x03: SUB
  [0x03, function () {}],
  // 0x04: DIV
  [0x04, function () {}],
  // 0x05: SDIV
  [0x05, function () {}],
  // 0x06: MOD
  [0x06, function () {}],
  // 0x07: SMOD
  [0x07, function () {}],
  // 0x08: ADDMOD
  [0x08, function () {}],
  // 0x09: MULMOD
  [0x09, function () {}],
  // 0x0a: EXP
  [0x0a, function () {}],
  // 0x0b: SIGNEXTEND
  [0x0b, function () {}],
  // 0x10: LT
  [0x10, function () {}],
  // 0x11: GT
  [0x11, function () {}],
  // 0x12: SLT
  [0x12, function () {}],
  // 0x13: SGT
  [0x13, function () {}],
  // 0x14: EQ
  [0x14, function () {}],
  // 0x15: ISZERO
  [0x15, function () {}],
  // 0x16: AND
  [0x16, function () {}],
  // 0x17: OR
  [0x17, function () {}],
  // 0x18: XOR
  [0x18, function () {}],
  // 0x19: NOT
  [0x19, function () {}],
  // 0x1a: BYTE
  [0x1a, function () {}],
  // 0x1b: SHL
  [0x1b, function () {}],
  // 0x1c: SHR
  [0x1c, function () {}],
  // 0x1d: SAR
  [0x1d, function () {}],
  // 0x20: SHA3
  [0x20, function () {}],
  // 0x30: ADDRESS
  [0x30, function () {}],
  // 0x31: BALANCE
  [0x31, function () {}],
  // 0x32: ORIGIN
  [0x32, function () {}],
  // 0x33: CALLER
  [0x33, function () {}],
  // 0x34: CALLVALUE
  [0x34, function () {}],
  // 0x35: CALLDATALOAD
  [0x35, function () {}],
  // 0x36: CALLDATASIZE
  [0x36, function () {}],
  // 0x37: CALLDATACOPY
  [0x37, function () {}],
  // 0x38: CODESIZE
  [0x38, function () {}],
  // 0x39: CODECOPY
  [0x39, function () {}],
  // 0x3a: GASPRICE
  [0x3a, function () {}],
  // 0x3b: EXTCODESIZE
  [0x3b, function () {}],
  // 0x3c: EXTCODECOPY
  [0x3c, function () {}],
  // 0x3d: RETURNDATASIZE
  [0x3d, function () {}],
  // 0x3e: RETURNDATACOPY
  [0x3e, function () {}],
  // 0x3f: EXTCODEHASH
  [0x3f, function () {}],
  // 0x40: BLOCKHASH
  [0x40, function () {}],
  // 0x41: COINBASE
  [0x41, function () {}],
  // 0x42: TIMESTAMP
  [0x42, function () {}],
  // 0x43: NUMBER
  [0x43, function () {}],
  // 0x44: DIFFICULTY
  [0x44, function () {}],
  // 0x45: GASLIMIT
  [0x45, function () {}],
  // 0x46: CHAINID
  [0x46, function () {}],
  // 0x47: SELFBALANCE
  [0x47, function () {}],
  // 0x48: BASEFEE
  [0x48, function () {}],
  // 0x50: POP
  [0x50, function () {}],
  // 0x51: MLOAD
  [0x51, function () {}],
  // 0x52: MSTORE
  [0x52, function () {}],
  // 0x53: MSTORE8
  [0x53, function () {}],
  // 0x54: SLOAD
  [0x54, function () {}],
  // 0x55: SSTORE
  [0x55, function () {}],
  // 0x56: JUMP
  [0x56, function () {}],
  // 0x57: JUMPI
  [0x57, function () {}],
  // 0x58: PC
  [0x58, function () {}],
  // 0x59: MSIZE
  [0x59, function () {}],
  // 0x5a: GAS
  [0x5a, function () {}],
  // 0x5b: JUMPDEST
  [0x5b, function () {}],
  // 0x5f: PUSH0
  [0x5f, function () {}],
  // 0x60: PUSH1
  [0x60, function () {}],
  // 0x61: PUSH2
  [0x61, function () {}],
  // 0x62: PUSH3
  [0x62, function () {}],
  // 0x63: PUSH4
  [0x63, function () {}],
  // 0x64: PUSH5
  [0x64, function () {}],
  // 0x65: PUSH6
  [0x65, function () {}],
  // 0x66: PUSH7
  [0x66, function () {}],
  // 0x67: PUSH8
  [0x67, function () {}],
  // 0x68: PUSH9
  [0x68, function () {}],
  // 0x69: PUSH10
  [0x69, function () {}],
  // 0x6a: PUSH11
  [0x6a, function () {}],
  // 0x6b: PUSH12
  [0x6b, function () {}],
  // 0x6c: PUSH13
  [0x6c, function () {}],
  // 0x6d: PUSH14
  [0x6d, function () {}],
  // 0x6e: PUSH15
  [0x6e, function () {}],
  // 0x6f: PUSH16
  [0x6f, function () {}],
  // 0x70: PUSH17
  [0x70, function () {}],
  // 0x71: PUSH18
  [0x71, function () {}],
  // 0x72: PUSH19
  [0x72, function () {}],
  // 0x73: PUSH20
  [0x73, function () {}],
  // 0x74: PUSH21
  [0x74, function () {}],
  // 0x75: PUSH22
  [0x75, function () {}],
  // 0x76: PUSH23
  [0x76, function () {}],
  // 0x77: PUSH24
  [0x77, function () {}],
  // 0x78: PUSH25
  [0x78, function () {}],
  // 0x79: PUSH26
  [0x79, function () {}],
  // 0x7a: PUSH27
  [0x7a, function () {}],
  // 0x7b: PUSH28
  [0x7b, function () {}],
  // 0x7c: PUSH29
  [0x7c, function () {}],
  // 0x7d: PUSH30
  [0x7d, function () {}],
  // 0x7e: PUSH31
  [0x7e, function () {}],
  // 0x7f: PUSH32
  [0x7f, function () {}],
  // 0x80: DUP1
  [0x80, function () {}],
  // 0x81: DUP2
  [0x81, function () {}],
  // 0x82: DUP3
  [0x82, function () {}],
  // 0x83: DUP4
  [0x83, function () {}],
  // 0x84: DUP5
  [0x84, function () {}],
  // 0x85: DUP6
  [0x85, function () {}],
  // 0x86: DUP7
  [0x86, function () {}],
  // 0x87: DUP8
  [0x87, function () {}],
  // 0x88: DUP9
  [0x88, function () {}],
  // 0x89: DUP10
  [0x89, function () {}],
  // 0x8a: DUP11
  [0x8a, function () {}],
  // 0x8b: DUP12
  [0x8b, function () {}],
  // 0x8c: DUP13
  [0x8c, function () {}],
  // 0x8d: DUP14
  [0x8d, function () {}],
  // 0x8e: DUP15
  [0x8e, function () {}],
  // 0x8f: DUP16
  [0x8f, function () {}],
  // 0x90: SWAP1
  [0x90, function () {}],
  // 0x91: SWAP2
  [0x91, function () {}],
  // 0x92: SWAP3
  [0x92, function () {}],
  // 0x93: SWAP4
  [0x93, function () {}],
  // 0x94: SWAP5
  [0x94, function () {}],
  // 0x95: SWAP6
  [0x95, function () {}],
  // 0x96: SWAP7
  [0x96, function () {}],
  // 0x97: SWAP8
  [0x97, function () {}],
  // 0x98: SWAP9
  [0x98, function () {}],
  // 0x99: SWAP10
  [0x99, function () {}],
  // 0x9a: SWAP11
  [0x9a, function () {}],
  // 0x9b: SWAP12
  [0x9b, function () {}],
  // 0x9c: SWAP13
  [0x9c, function () {}],
  // 0x9d: SWAP14
  [0x9d, function () {}],
  // 0x9e: SWAP15
  [0x9e, function () {}],
  // 0x9f: SWAP16
  [0x9f, function () {}],
  // 0xa0: LOG0
  [0xa0, function () {}],
  // 0xa1: LOG1
  [0xa1, function () {}],
  // 0xa2: LOG2
  [0xa2, function () {}],
  // 0xa3: LOG3
  [0xa3, function () {}],
  // 0xa4: LOG4
  [0xa4, function () {}],
  // 0xf0: CREATE
  [0xf0, function () {}],
  // 0xf1: CALL
  [0xf1, function () {}],
  // 0xf2: CALLCODE
  [0xf2, function () {}],
  // 0xf3: RETURN
  [0xf3, function () {}],
  // 0xf4: DELEGATECALL
  [0xf4, function () {}],
  // 0xf5: CREATE2
  [0xf5, function () {}],
  // 0xfa: STATICCALL
  [0xfa, function () {}],
  // 0xfd: REVERT
  [0xfd, function () {}],
  // 0xfe: INVALID
  [0xfe, function () {}],
  // 0xff: SELFDESTRUCT
  [0xff, function () {}],
])
