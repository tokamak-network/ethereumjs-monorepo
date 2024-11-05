import { hexToBytes } from '@ethereumjs/util'

import { createEVM } from '../src/constructors.js'

const main = async () => {
  const evm = await createEVM()
  const res = await evm.runCode({ code: hexToBytes('0x6001600201') }) // PUSH1 01 -- simple bytecode to push 1 onto the stack
  console.log(res.executionGasUsed) // 3n
}

void main()
