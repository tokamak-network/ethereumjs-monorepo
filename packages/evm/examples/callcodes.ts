// DEBUG=ethjs,evm:*,evm:*:* tsx callcodes.ts
import { Common, Mainnet } from '@ethereumjs/common'
import { SimpleStateManager } from '@ethereumjs/statemanager'

import { NobleBN254 } from '../src/precompiles/index.js'
import { EVMMockBlockchain } from '../src/types.js'

import { EVM } from '../src/index.js'

import type { EVMOpts } from '../src/index.js'

import { hexToBytes, Account, createAddressFromPrivateKey, randomBytes } from '@ethereumjs/util'

const main = async () => {
  const opts = {} as EVMOpts
  opts.bn254 = new NobleBN254()
  if (opts.common === undefined) {
    opts.common = new Common({ chain: Mainnet })
  }

  if (opts.blockchain === undefined) {
    opts.blockchain = new EVMMockBlockchain()
  }

  if (opts.stateManager === undefined) {
    opts.stateManager = new SimpleStateManager()
  }

  // State에 임의의 contract account 추가
  const anyBytes = new Uint8Array(32)
  anyBytes[31] = 1
  const address = createAddressFromPrivateKey(anyBytes)
  console.log(`Contract address: ${address.toString()}`) // 0x7e5f4552091a69125d5dfcb7b8c2659029395bdf
  const account = new Account(0n, 0xfffffn)
  await opts.stateManager.putAccount(address, account)

  const callcode = hexToBytes('0x600260010160205260206020f3')
  // contract account의 코드 정의
  await opts.stateManager.putCode(address, callcode)

  const evm = await new EVM(opts)
  const res = await evm.runCode({
    code: hexToBytes('0x6020602060006000737e5f4552091a69125d5dfcb7b8c2659029395bdf611388fa00'),
  })
  console.log(res.executionGasUsed) // 3n
}

void main()
