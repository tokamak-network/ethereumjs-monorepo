import { hexToBytes } from '@ethereumjs/util'
import { describe, expect, it } from 'vitest'

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
  console.log('stack : ', stack)
  console.log('stackPt : ', res.runState!.stackPt)

  // RETURN 연산 사용 여부 확인
  const isReturnOp = res.runState?.lastOp === 0xf3

  // console.log('isReturnOp : ', isReturnOp)
  // console.log('stack', stack)
  // console.log('Stack length:', stack.length)

  const lastStackValue = isReturnOp
    ? stack[stack.length - 3]?.valuestr
    : stack[stack.length - 1].valuestr

  const placementsArray = Array.from(res.runState!.synthesizer.placements.values())
  const lastPlacement = placementsArray[placementsArray.length - 1]

  const lastOutPtValue = lastPlacement.outPts[lastPlacement.outPts.length - 1].valuestr

  console.log('lastPlacement : ', lastPlacement)
  console.log('lastStackValue : ', lastStackValue)
  console.log('lastOutPtValue : ', lastOutPtValue)

  const stringPlacements = mapToStr(res.runState!.synthesizer.placements)
  // console.log('******RESULT******')
  // console.log(`stack(str): ${'0x' + res.runState!.stack.peek(1)[0].toString(16)}`) // 3n
  // console.log(`stackPt: ${JSON.stringify(res.runState!.stackPt.getStack(), arrToStr, 2)}\n`) // 3n
  // console.log(`"placements": ${JSON.stringify(stringPlacements, null, 1)}`)

  return { lastStackValue, lastOutPtValue }
}

/**
 * 테스트 코드 케이스
 * @doc https://www.notion.so/tokamak/142d96a400a3807892a8dbbe59b6e077#142d96a400a380a8b11be727282c446d
 *
 *
 *  */

describe('synthesizer: ', () => {
  it('should work with resolving data alias', async () => {
    const evm = await createEVM()
    const res = await evm.runCode({
      code: hexToBytes(
        //바이트 코드로 명명
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

  describe('Basic arithmetic operations', () => {
    const testCases = [
      {
        name: 'ADD',
        bytecode: '0x6005600301', // PUSH1 5, PUSH1 3, ADD
        description: 'should handle ADD operation correctly',
        expected: '8', // 5 + 3 = 8
      },
      {
        name: 'MUL',
        bytecode: '0x6004600202', // PUSH1 4, PUSH1 2, MUL
        description: 'should handle MUL operation correctly',
        expected: '8', // 4 * 2 = 8
      },
      {
        name: 'SUB',
        bytecode: '0x600A600703', // PUSH1 10, PUSH1 7, SUB
        description: 'should handle SUB operation correctly',
        expected: '3', // 10 - 7 = 3
      },
      {
        name: 'DIV',
        bytecode: '0x6004601404', // PUSH1 4, PUSH1 20, DIV
        description: 'should handle DIV operation correctly',
        expected: '5', // 20 / 4 = 5
      },
      {
        name: 'AND',
        bytecode: '0x6384C2A6E1631234567816', // PUSH4 0x84C2A6E1, PUSH4 0x12345678, AND
        description: 'should handle AND operation correctly',
        expected: (BigInt('0x84C2A6E1') & BigInt('0x12345678')).toString(16),
      },
      {
        name: 'SDIV',
        bytecode: '0x600460EC5F0B05608052', // PUSH1 4, PUSH1 0xEC, PUSH0, SIGNEXTEND, SDIV, PUSH1 0x80, MSTORE
        description: 'should handle SDIV operation correctly',
        expected: '-5', // -20 / 4 = -5
      },
      {
        name: 'MOD',
        bytecode: '0x6003600A0660A052', // PUSH1 3, PUSH1 0x0A, MOD, PUSH1 0xA0, MSTORE
        description: 'should handle MOD operation correctly',
        expected: (BigInt('0x0A') % BigInt('0x03')).toString(16), // 10 % 3 = 1
      },
      {
        name: 'SMOD',
        bytecode: '0x600360F65F0B0760C052', // PUSH1 3, PUSH1 0xF6, PUSH0, SIGNEXTEND, SMOD, PUSH1 0xC0, MSTORE
        description: 'should handle SMOD operation correctly',
        expected: '-1', // -10 % 3 = -1
      },
      {
        name: 'ADDMOD',
        bytecode: '0x600760036005080860E052', // PUSH1 7, PUSH1 3, PUSH1 5, ADDMOD, PUSH1 0xE0, MSTORE
        description: 'should handle ADDMOD operation correctly',
        expected: ((BigInt('0x05') + BigInt('0x03')) % BigInt('0x07')).toString(16), // (5 + 3) % 7 = 1
      },
      {
        name: 'MULMOD',
        bytecode: '0x60066004600509610100052', // PUSH1 6, PUSH1 4, PUSH1 5, MULMOD, PUSH2 0x100, MSTORE
        description: 'should handle MULMOD operation correctly',
        expected: ((BigInt('0x05') * BigInt('0x04')) % BigInt('0x06')).toString(16), // (5 * 4) % 6 = 2
      },
      {
        name: 'EXP',
        bytecode: '0x60036002610120520A', // PUSH1 3, PUSH1 2, PUSH2 0x120, MSTORE, EXP
        description: 'should handle EXP operation correctly',
        expected: (BigInt('0x02') ** BigInt('0x03')).toString(16), // 2 ** 3 = 8
      },
      {
        name: 'ALL_OPERATIONS',
        bytecode:
          '0x' +
          '6005600301600052' + // ADD
          '6004600202602052' + // MUL
          '600A600703604052' + // SUB
          '6004601404606052' + // DIV
          '6384C2A6E1631234567816608052' + // AND
          '600460EC5F0B0560A052' + // SDIV
          '6003600A0660C052' + // MOD
          '600360F65F0B0760E052' + // SMOD
          '6007600360050861010052' + // ADDMOD
          '600660046005096101205261' + // MULMOD
          '60036002610140520A' + // EXP
          '600051602051604051606051608051' + // MLOAD all results
          '60A05160C05160E051610100516101205161014051', // MLOAD rest of results
        description: 'should handle all operations correctly',
        expected: '660', // 마지막 MLOAD의 결과
      },
      // {
      //   name: 'ALL_OPERATIONS',
      //   bytecode:
      //     '0x' +
      //     '6005600301600052' + // ADD operation and store
      //     '6004600202602052' + // MUL operation and store
      //     '600A600703604052' + // SUB operation and store
      //     '6004601404606052' + // DIV operation and store
      //     '6384C2A6E1631234567816608052' + // AND operation and store
      //     '600051602051604051606051608051', // MLOAD all results
      //   description: 'should handle all operations correctly',
      //   expected: '660', // AND 연산의 실제 결과값
      // },
    ]

    for (const testCase of testCases) {
      it(testCase.description, async function () {
        const evm = await createEVM()
        const res = await evm.runCode({
          code: hexToBytes(testCase.bytecode),
        })

        const { lastStackValue, lastOutPtValue } = logStackAndPlacement(res)

        console.log('lastStackValue:', lastStackValue)
        console.log('lastOutPtValue:', lastOutPtValue)

        expect(lastStackValue).toBe(lastOutPtValue)
      })
    }
  })

  // it('should handle 0x01 (ADD) - 0x1B (SIGNEXTEND)', async () => {
  //   const evm = await createEVM()
  //   const byteCode =
  //     '0x60056003016000526004600202602052600A6007036040526004601404606052602051604051606051'
  //   const res = await evm.runCode({
  //     code: hexToBytes(byteCode),
  //   })

  //   const { lastStackValue, lastOutPtValue } = logStackAndPlacement(res)

  //   expect(lastStackValue).toBe(lastOutPtValue)
  // })

  // it('should handle 0x0B (SIGNEXTEND) ~ 0x1D (SAR),', async () => {
  //   const evm = await createEVM()
  //   const byteCode =
  //     '0x6005600A10602052600A6005901160405260FB5f0b60FD5f0b81811260605213608052604051608051148060A0521560C0526384C2A6E1631234567881811660E05281811761010052188061012052198061014052601E1a806101605260041b806101805260041c6101A052610180515f0b60041d6101C0526101C06020f3'
  //   const res = await evm.runCode({
  //     code: hexToBytes(byteCode),
  //   })

  //   const { lastStackValue, lastOutPtValue } = logStackAndPlacement(res)

  //   expect(lastStackValue).toBe(lastOutPtValue)
  // })
})
