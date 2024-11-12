import { hexToBytes } from '@ethereumjs/util'
import { assert, describe, expect, it } from 'vitest'

import { createEVM } from '../../src/index.js'

function arrToStr(key: string, value: any) {
  return typeof value === 'bigint' ? value.toString() : value
}

const mapToStr = (map: Map<any, any>) => {
  return Object.fromEntries(
    Array.from(map, ([key, value]) => [
      key,
      JSON.parse(JSON.stringify(value, (k, v) => (typeof v === 'bigint' ? v.toString() : v))),
    ]),
  )
}

const logStackAndPlacement = (res: any) => {
  console.log('\nStack-Placement Value Comparison Test')

  // 마지막 stack 값 가져오기
  const stack = res.runState!.stackPt.getStack()
  const lastStackValue = stack[stack.length - 1].valuestr

  const placementsArray = Array.from(res.runState!.synthesizer.placements.values())
  const lastPlacement = placementsArray[placementsArray.length - 1]
  const lastOutPtValue = lastPlacement.outPts[lastPlacement.outPts.length - 1].valuestr

  console.log('lastStackValue : ', lastStackValue)
  console.log('lastOutPtValue : ', lastOutPtValue)

  const stringPlacements = mapToStr(res.runState!.synthesizer.placements)
  console.log('******RESULT******')
  console.log(`stack(str): ${'0x' + res.runState!.stack.peek(1)[0].toString(16)}`) // 3n
  console.log(`stackPt: ${JSON.stringify(res.runState!.stackPt.getStack(), arrToStr, 2)}\n`) // 3n
  console.log(`"placements": ${JSON.stringify(stringPlacements, null, 1)}`)

  return { lastStackValue, lastOutPtValue }
}

describe('synthesizer: ', () => {
  it('should work with resolving data alias', async () => {
    // const caller = new Address(hexToBytes('0x00000000000000000000000000000000000000ee'))
    // const common = new Common({ chain: Mainnet, hardfork: Hardfork.Constantinople })
    // const evm = await createEVM({
    //   common,
    // })

    const evm = await createEVM()
    const res = await evm.runCode({
      code: hexToBytes(
        '0x' +
          '63' +
          'c0cac01a' + // PUSH4 (0x63) + 4바이트 값 push (0xc0cac01a)
          '60' +
          '22' + // PUSH1 (0x60) + 1바이트 값 push (0x22)
          '52' + // MSTORE (0x52)
          '63' +
          'b01dface' + // PUSH4 (0x63) + 4바이트 값 push (0xb01dface)
          '60' +
          '1e' + // PUSH1 (0x60) + 1바이트 값 push (0x1e)
          '52' + // MSTORE (0x52)
          '61' +
          '1eaf' + // PUSH2 (0x61) + 2바이트 값 push (0x1eaf)
          '60' +
          '1c' + // PUSH1 (0x60) + 1바이트 값 push (0x1c)
          '52' + // MSTORE (0x52)
          '60' +
          '20' + // PUSH1 (0x60) + 1바이트 값 push (0x20)
          '51', // MLOAD (0x51),
      ),
    })

    const { lastStackValue, lastOutPtValue } = logStackAndPlacement(res)

    expect(lastStackValue).toBe(lastOutPtValue)
  })

  it('should handle MUL with various bit operations', async () => {
    const evm = await createEVM()

    const res = await evm.runCode({
      code: hexToBytes(
        '0x' +
          '63' +
          'c0cac002' + // PUSH4 첫 번째 값
          '60' +
          '40' +
          '52' + // MSTORE
          '63' +
          'b01dface' + // PUSH4 두 번째 값
          '60' +
          '20' +
          '52' + // MSTORE
          '60' +
          '40' + // 첫 번째 값의 위치
          '51' + // MLOAD
          '60' +
          '20' + // 두 번째 값의 위치
          '51' + // MLOAD
          '02', // MUL 연산 추가
      ),
    })

    const { lastStackValue, lastOutPtValue } = logStackAndPlacement(res)

    expect(lastStackValue).toBe(lastOutPtValue)
  })

  it('should handle SUB with memory and shifts', async () => {
    const evm = await createEVM()

    const res = await evm.runCode({
      code: hexToBytes(
        '0x' +
          '63' +
          'c0cac002' + // PUSH4 첫 번째 값
          '60' +
          '40' +
          '52' + // MSTORE
          '63' +
          'b01dface' + // PUSH4 두 번째 값
          '60' +
          '20' +
          '52' + // MSTORE
          '60' +
          '40' + // 첫 번째 값의 위치
          '51' + // MLOAD
          '60' +
          '20' + // 두 번째 값의 위치
          '51' + // MLOAD
          '03', // SUB 연산 추가
      ),
    })

    const { lastStackValue, lastOutPtValue } = logStackAndPlacement(res)

    expect(lastStackValue).toBe(lastOutPtValue)
  })
})
