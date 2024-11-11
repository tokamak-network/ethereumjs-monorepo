import { hexToBytes } from '@ethereumjs/util'
import { assert, describe, it } from 'vitest'

import { createEVM } from '../../src/index.js'

const testDatas = {
  dataAlias: '0x63c0cac01a60225263b01dface601e52611eaf601c52602051',
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
})
