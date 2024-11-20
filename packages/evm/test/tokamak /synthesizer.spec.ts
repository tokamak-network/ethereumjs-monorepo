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
  // console.log('\nStack-Placement Value Comparison Test')

  // 마지막 stack 값 가져오기
  const stack = res.runState!.stackPt.getStack()
  // console.log('stack : ', stack)

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

/**
 * 테스트 코드 케이스
 *
 * 콜데이터 필요
 * 프로그램 3~4가지를 테스트 케이스로
 *
 * @problem
 *
 * 현재 synthesizer에는
 *
 *  */

describe('synthesizer: ', () => {
  // it('should work with resolving data alias', async () => {
  //   // const caller = new Address(hexToBytes('0x00000000000000000000000000000000000000ee'))
  //   // const common = new Common({ chain: Mainnet, hardfork: Hardfork.Constantinople })
  //   // const evm = await createEVM({
  //   //   common,
  //   // })

  //   const evm = await createEVM()
  //   const res = await evm.runCode({
  //     code: hexToBytes(
  //       //바이트 코드로 명명
  //       '0x' +
  //         '63' +
  //         'c0cac01a' + // PUSH4 (0x63) + 4바이트 값 push (0xc0cac01a)
  //         '60' +
  //         '22' + // PUSH1 (0x60) + 1바이트 값 push (0x22)
  //         '52' + // MSTORE (0x52)
  //         '63' +
  //         'b01dface' + // PUSH4 (0x63) + 4바이트 값 push (0xb01dface)
  //         '60' +
  //         '1e' + // PUSH1 (0x60) + 1바이트 값 push (0x1e)
  //         '52' + // MSTORE (0x52)
  //         '61' +
  //         '1eaf' + // PUSH2 (0x61) + 2바이트 값 push (0x1eaf)
  //         '60' +
  //         '1c' + // PUSH1 (0x60) + 1바이트 값 push (0x1c)
  //         '52' + // MSTORE (0x52)
  //         '60' +
  //         '20' + // PUSH1 (0x60) + 1바이트 값 push (0x20)
  //         '51', // MLOAD (0x51),
  //     ),
  //   })

  //   const { lastStackValue, lastOutPtValue } = logStackAndPlacement(res)

  //   expect(lastStackValue).toBe(lastOutPtValue)
  // })

  // it('should handle MUL with various bit operations', async () => {
  //   const evm = await createEVM()

  //   const res = await evm.runCode({
  //     code: hexToBytes(
  //       '0x' +
  //         '63' +
  //         'c0cac002' + // PUSH4 첫 번째 값
  //         '60' +
  //         '40' +
  //         '52' + // MSTORE
  //         '63' +
  //         'b01dface' + // PUSH4 두 번째 값
  //         '60' +
  //         '20' +
  //         '52' + // MSTORE
  //         '60' +
  //         '40' + // 첫 번째 값의 위치
  //         '51' + // MLOAD
  //         '60' +
  //         '20' + // 두 번째 값의 위치
  //         '51' + // MLOAD
  //         '02', // MUL 연산 추가
  //     ),
  //   })

  //   const { lastStackValue, lastOutPtValue } = logStackAndPlacement(res)

  //   expect(lastStackValue).toBe(lastOutPtValue)
  // })

  // it('should handle SUB with memory and shifts', async () => {
  //   const evm = await createEVM()

  //   const res = await evm.runCode({
  //     code: hexToBytes(
  //       '0x' +
  //         '63' +
  //         'c0cac002' + // PUSH4 첫 번째 값
  //         '60' +
  //         '40' +
  //         '52' + // MSTORE
  //         '63' +
  //         'b01dface' + // PUSH4 두 번째 값
  //         '60' +
  //         '20' +
  //         '52' + // MSTORE
  //         '60' +
  //         '40' + // 첫 번째 값의 위치
  //         '51' + // MLOAD
  //         '60' +
  //         '20' + // 두 번째 값의 위치
  //         '51' + // MLOAD
  //         '03' + // SUB 연산 추가'
  //         '6040' +
  //         '52',
  //     ),
  //   })

  //   const { lastStackValue, lastOutPtValue } = logStackAndPlacement(res)

  //   expect(lastStackValue).toBe(lastOutPtValue)
  // })

  // it('should handle 0x01 (ADD) - 0x1B (SIGNEXTEND)', async () => {
  //   const evm = await createEVM()

  //   const res = await evm.runCode({
  //     code: hexToBytes(
  //       '0x60056003016000526004600202602052600A6007036040526004601404606052600460EC5F0B056080526003600A0660A052600360F65F0B0760C0526007600360050860E0526006600460050961010052600360020A610120526101406000F3',
  //     ),
  //   })

  //   const { lastStackValue, lastOutPtValue } = logStackAndPlacement(res)

  //   expect(lastStackValue).toBe(lastOutPtValue)
  // })

  it('should handle 0x0B (SIGNEXTEND) ~ 0x1D (SAR),', async () => {
    const evm = await createEVM()

    // const res = await evm.runCode({
    //   code: hexToBytes(
    //     // '0x6005600A10602052600A6005901160405260FB5f0b60FD5f0b81811260605213608052604051608051148060A0521560C0526384C2A6E1631234567881811660E05281811761010052188061012052198061014052601E1a806101605260041b806101805260041c6101A052610180515f0b60041d6101C0526101C06020f3',
    //     '0x6005600A10602052600A6005901160405260FB5f0b60FD5f0b818112606052602051',
    //   ),
    // })

    // Test Group 1: LT, GT
    const testLtGt = '0x6005600A10602052600A60059011604052' + '604051' // MLOAD for verification
    // const res = await evm.runCode({
    //   code: hexToBytes(testLtGt),
    // })

    // PUSH1 values
    const PUSH1 = '60'
    const VAL_05 = '05'
    const VAL_0A = '0A'
    const VAL_20 = '20'
    const VAL_40 = '40'
    const VAL_60 = '60'
    const VAL_80 = '80'
    const VAL_FB = 'FB'
    const VAL_FD = 'FD'
    const VAL_00 = '5f' // alternative way to PUSH1 0x00

    // Operation codes
    const LT = '10'
    const GT = '11'
    const SLT = '12'
    const SGT = '13'
    const SWAP1 = '90'
    const DUP2 = '81'
    const MSTORE = '52'
    const SIGNEXTEND = '0b'
    const MLOAD = '51'

    // Combine into full bytecode
    const bytecode =
      '0x' +
      PUSH1 +
      VAL_05 + // PUSH1 0x05
      PUSH1 +
      VAL_0A + // PUSH1 0x0A
      LT + // LT
      PUSH1 +
      VAL_20 + // PUSH1 0x20
      MSTORE + // MSTORE
      PUSH1 +
      VAL_0A + // PUSH1 0x0A
      PUSH1 +
      VAL_05 + // PUSH1 0x05
      SWAP1 + // SWAP1
      GT + // GT
      PUSH1 +
      VAL_40 + // PUSH1 0x40
      MSTORE + // MSTORE
      PUSH1 +
      VAL_FB + // PUSH1 0xFB
      VAL_00 + // PUSH1 0x00
      SIGNEXTEND + // SIGNEXTEND
      PUSH1 +
      VAL_FD + // PUSH1 0xFD
      VAL_00 + // PUSH1 0x00
      SIGNEXTEND + // SIGNEXTEND
      DUP2 + // DUP2
      DUP2 + // DUP2
      SLT + // SLT
      PUSH1 +
      VAL_60 + // PUSH1 0x60
      MSTORE + // MSTORE
      SGT + // SGT
      PUSH1 +
      VAL_80 + // PUSH1 0x80
      MSTORE + // MSTORE
      // Add MLOADs to check results
      PUSH1 +
      VAL_20 + // PUSH1 0x20
      MLOAD + // MLOAD from 0x20 (LT result)
      PUSH1 +
      VAL_40 + // PUSH1 0x40
      MLOAD + // MLOAD from 0x40 (GT result)
      PUSH1 +
      VAL_60 + // PUSH1 0x60
      MLOAD + // MLOAD from 0x60 (SLT result)
      PUSH1 +
      VAL_80 + // PUSH1 0x80
      MLOAD // MLOAD from 0x80 (SGT result)

    // Test Group 2: SLT, SGT
    const testSltSgt = bytecode

    // Test Group 3: EQ, ISZERO, AND, OR, XOR, NOT, BYTE, SHL, SHR, SAR
    const testLogicOps =
      '0x6005600A10602052600A6005901160405260FB5f0b60FD5f0b81811260605213608052604051608051148060A0521560C0526384C2A6E1631234567881811660E05281811761010052188061012052198061014052601E1a806101605260041b806101805260041c6101A052610180515f0b60041d6101C0526101C06020f3'

    // 0x6005600A10602052600A6005901160405260FB5f0b60FD5f0b81811260605213608052604051608051148060A0521560C0526384C2A6E1631234567881811660E05281811761010052188061012052198061014052601E1a806101605260041b806101805260041c6101A052610180515f0b60041d6101C0526101C06020f3

    const res = await evm.runCode({
      code: hexToBytes(bytecode),
    })

    const { lastStackValue, lastOutPtValue } = logStackAndPlacement(res)

    expect(lastStackValue).toBe(lastOutPtValue)
  })
})
