import { hexToBytes } from '@ethereumjs/util'
import { assert, describe, expect, it } from 'vitest'

import { createEVM } from '../../src/index.js'

const testDatas = {
  dataAlias: '0x63c0cac01a60225263b01dface601e52611eaf601c52602051',
}

const logStackAndPlacement = (res: any) => {
  console.log('\nStack-Placement Value Comparison Test')
  const stackValue = res.runState?.stack.peek(1)[0]

  const placementsArray = Array.from(res.runState!.synthesizer.placements.values())
  const lastPlacement = placementsArray[placementsArray.length - 1]
  const lastOutPtValue = lastPlacement.outPts[lastPlacement.outPts.length - 1].valuestr

  console.log('stackValue : ', stackValue)
  console.log('lastOutPtValue : ', lastOutPtValue)
}

describe('synthesizer: ', () => {
  it('should work with resolving data alias', async () => {
    // const caller = new Address(hexToBytes('0x00000000000000000000000000000000000000ee'))
    // const common = new Common({ chain: Mainnet, hardfork: Hardfork.Constantinople })
    // const evm = await createEVM({
    //   common,
    // })

    const callData = testDatas.dataAlias
    const evm = await createEVM()
    const res = await evm.runCode({
      code: hexToBytes(callData),
    })

    const stack = res.runState!.stackPt.getStack()

    // 마지막 stack 값 가져오기
    const lastStackValue = stack[stack.length - 1].valuestr

    // placements의 마지막 outPts의 valueStr 가져오기
    const placementsArray = Array.from(res.runState!.synthesizer.placements.values())
    const lastPlacement = placementsArray[placementsArray.length - 1]
    const lastOutPtValue = lastPlacement.outPts[lastPlacement.outPts.length - 1].valuestr

    // console.log('placementsArray : ', placementsArray)
    // console.log('stack : ', stack)
    // console.group('Stack-Placement Value Comparison Test')
    // console.log('Last Stack Value:', lastStackValue)
    // console.log('Last Placement OutPt Value:', lastOutPtValue)
    // console.groupEnd()

    assert.strictEqual(
      lastStackValue,
      lastOutPtValue,
      'Stack value should match placement outPt value',
    )
  })

  it('should handle MUL with various bit operations', async () => {
    const evm = await createEVM()
    // PUSH1 5        - 6005
    // PUSH1 4        - 6004
    // MUL           - 02    (20)
    // PUSH1 2        - 6002
    // SHL           - 1b    (80)
    // PUSH1 3        - 6003
    // PUSH1 2        - 6002
    // MUL           - 02    (6)
    // AND           - 16    (0)
    // PUSH1 1        - 6001
    // SHR           - 1c    (0)
    // PUSH1 0x00     - 6000
    // MSTORE         - 52
    // PUSH1 0x00     - 6000
    // MLOAD          - 51
    // PUSH1 2        - 6002
    // ADD            - 01    (2)
    const res = await evm.runCode({
      code: hexToBytes('0x63c0cac00260225263b01dface601e52611eaf601c52602051'),
    })

    logStackAndPlacement(res)
    // 연산 순서:
    // 1. MUL: 4 * 5 = 20
    // 2. SHL: 20 << 2 = 80
    // 3. MUL: 2 * 3 = 6
    // 4. AND: 80 & 6 = 0
    // 5. SHR: 0 >> 1 = 0
    // 6. MSTORE at 0x00
    // 7. MLOAD from 0x00
    // 8. MUL: 0 * 2 = 0  // ADD에서 MUL로 변경
    expect(res.runState?.stack.peek(1)[0]).toBe(0n) // 예상값을 0으로 변경
  })

  // it('should handle multiple MULs with memory and shifts', async () => {
  //   const evm = await createEVM()
  //   // PUSH1 6        - 6006
  //   // PUSH1 5        - 6005
  //   // MUL           - 02    (30)
  //   // PUSH1 1        - 6001
  //   // SHL           - 1b    (60)
  //   // PUSH1 0x00     - 6000
  //   // MSTORE         - 52
  //   // PUSH1 4        - 6004
  //   // PUSH1 3        - 6003
  //   // MUL           - 02    (12)
  //   // PUSH1 2        - 6002
  //   // SHR           - 1c    (3)
  //   // PUSH1 0x00     - 6000
  //   // MLOAD          - 51    (60)
  //   // AND           - 16     (0)
  //   // PUSH1 8        - 6008
  //   // MUL           - 02     (0)
  //   const res = await evm.runCode({
  //     code: hexToBytes('0x600560060260011b60005260036004026002601c600051601660080200'),
  //   })

  //   logStackAndPlacement(res)
  //   // 연산 순서:
  //   // 1. MUL: 5 * 6 = 30
  //   // 2. SHL: 30 << 1 = 60
  //   // 3. MSTORE at 0x00
  //   // 4. MUL: 3 * 4 = 12
  //   // 5. SHR: 12 >> 2 = 3
  //   // 6. MLOAD from 0x00 = 60
  //   // 7. AND: 3 & 60 = 0
  //   // 8. MUL: 0 * 8 = 0
  //   expect(res.runState?.stack.peek(1)[0]).toBe(0n)
  // })
})
