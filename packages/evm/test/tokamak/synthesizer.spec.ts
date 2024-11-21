import { hexToBytes } from '@ethereumjs/util'
import { describe, expect, it } from 'vitest'

import { createEVM } from '../../src/index.js'

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

  // 마지막 stackPt 값 가져오기
  const stackPt = res.runState!.stackPt.getStack()

  // RETURN 연산 사용 여부 확인
  const isReturnOp = res.runState?.lastOp === 0xf3

  console.log('stack', res.runState.stack)
  console.log('stackPt : ', stackPt)

  const placementsArray = Array.from(res.runState!.synthesizer.placements.values())
  const lastPlacement = placementsArray[placementsArray.length - 1]

  console.log('lastPlacement', lastPlacement)

  const lastStackValue = stackPt[stackPt.length - 1].valuestr

  const lastOutPtValue = lastPlacement.outPts[lastPlacement.outPts.length - 1].valuestr

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
        bytecode: '0x600460EC5F0B05', // PUSH1 4, PUSH1 0xEC, PUSH0, SIGNEXTEND, SDIV, PUSH1 0x80, MSTORE
        description: 'should handle SDIV operation correctly',
        expected: '-5', // -20 / 4 = -5
      },
      {
        name: 'MOD',
        bytecode: '0x6003600A06', // PUSH1 3, PUSH1 0x0A, MOD, PUSH1 0xA0, MSTORE
        description: 'should handle MOD operation correctly',
        expected: (BigInt('0x0A') % BigInt('0x03')).toString(16), // 10 % 3 = 1
      },
      {
        name: 'SMOD',
        bytecode: '0x600360F65F0B07', // PUSH1 3, PUSH1 0xF6, PUSH0, SIGNEXTEND, SMOD, PUSH1 0xC0, MSTORE
        description: 'should handle SMOD operation correctly',
        expected: '-1', // -10 % 3 = -1
      },
      {
        name: 'ADDMOD',
        bytecode: '0x6007600360050808', // PUSH1 7, PUSH1 3, PUSH1 5, ADDMOD, PUSH1 0xE0, MSTORE
        description: 'should handle ADDMOD operation correctly',
        expected: ((BigInt('0x05') + BigInt('0x03')) % BigInt('0x07')).toString(16), // (5 + 3) % 7 = 1
      },
      {
        name: 'MULMOD',
        bytecode: '0x60066004600509', // PUSH1 6, PUSH1 4, PUSH1 5, MULMOD, PUSH2 0x100, MSTORE
        description: 'should handle MULMOD operation correctly',
        expected: ((BigInt('0x05') * BigInt('0x04')) % BigInt('0x06')).toString(16), // (5 * 4) % 6 = 2
      },
      {
        name: 'EXP',
        bytecode: '0x60036002610A', // PUSH1 3, PUSH1 2, PUSH2 0x120, MSTORE, EXP
        description: 'should handle EXP operation correctly',
        expected: (BigInt('0x02') ** BigInt('0x03')).toString(16), // 2 ** 3 = 8
      },
      {
        name: 'BASIC_ARITHMETIC_OPERATIONS',
        bytecode:
          '0x60056003016000526004600202602052600A6007036040526004601404606052600460EC5F0B056080526003600A0660A052600360F65F0B0760C0526007600360050860E0526006600460050961010052600360020A6101205261012051',
        description: 'should handle all operations correctly',
      },
    ]

    for (const testCase of testCases) {
      it(testCase.description, async function () {
        const evm = await createEVM()
        const res = await evm.runCode({
          code: hexToBytes(testCase.bytecode),
        })

        const { lastStackValue, lastOutPtValue } = logStackAndPlacement(res)

        expect(lastStackValue).toBe(lastOutPtValue)
      })
    }
  })

  describe('Comparison and bitwise operations', () => {
    const testCases = [
      {
        name: 'LT',
        bytecode: '0x6005600A10', // PUSH1 5, PUSH1 10, LT
        description: 'should handle LT operation correctly (10 < 5 = 0)',
        expected: '0',
      },
      {
        name: 'GT',
        bytecode: '0x600A60059011', // PUSH1 10, PUSH1 5, SWAP1, GT
        description: 'should handle GT operation correctly (10 > 5 = 1)',
        expected: '1',
      },
      {
        name: 'SLT',
        bytecode: '0x60FB5F0B60FD5F0B12', // -5 SLT -3
        description: 'should handle SLT operation correctly (-3 < -5 = 0)',
        expected: '0',
      },
      {
        name: 'SGT',
        bytecode: '0x60FB5F0B60FD5F0B13', // -5 SGT -3
        description: 'should handle SGT operation correctly (-3 > -5 = 1)',
        expected: '1',
      },
      {
        name: 'EQ',
        bytecode: '0x6001600114', // PUSH1 1, PUSH1 1, EQ
        description: 'should handle EQ operation correctly (1 == 1 = 1)',
        expected: '1',
      },
      {
        name: 'ISZERO',
        bytecode: '0x600015', // PUSH1 0, ISZERO
        description: 'should handle ISZERO operation correctly (0 == 0 = 1)',
        expected: '1',
      },
      {
        name: 'AND',
        bytecode: '0x6384C2A6E163123456781681', // AND operation
        description: 'should handle AND operation correctly',
        expected: (BigInt('0x84C2A6E1') & BigInt('0x12345678')).toString(16),
      },
      {
        name: 'OR',
        bytecode: '0x6384C2A6E163123456781781', // OR operation
        description: 'should handle OR operation correctly',
        expected: (BigInt('0x84C2A6E1') | BigInt('0x12345678')).toString(16),
      },
      {
        name: 'XOR',
        bytecode: '0x6384C2A6E16312345678188180', // XOR operation
        description: 'should handle XOR operation correctly',
        expected: (BigInt('0x84C2A6E1') ^ BigInt('0x12345678')).toString(16),
      },
      {
        name: 'NOT',
        bytecode: '0x6384C2A6E119', // NOT operation
        description: 'should handle NOT operation correctly',
        expected: (~BigInt('0x84C2A6E1')).toString(16),
      },
      {
        name: 'BYTE',
        bytecode: '0x6384C2A6E1601E1A', // BYTE operation (extract 30th byte)
        description: 'should handle BYTE operation correctly',
        expected: '15',
      },
      {
        name: 'SHL',
        bytecode: '0x600F60041B', // PUSH1 15, PUSH1 4, SHL
        description: 'should handle SHL operation correctly (15 << 4 = 240)',
        expected: (BigInt(15) << BigInt(4)).toString(),
      },
      {
        name: 'SHR',
        bytecode: '0x60F060041C', // PUSH1 240, PUSH1 4, SHR
        description: 'should handle SHR operation correctly (240 >> 4 = 15)',
        expected: (BigInt(240) >> BigInt(4)).toString(),
      },
      {
        name: 'SAR',
        bytecode: '0x60F05F0B60041D', // PUSH1 -16, PUSH1 4, SAR
        description: 'should handle SAR operation correctly (-16 >> 4 = -1)',
        expected: '-1',
      },
      {
        name: 'COMPARISON_AND_BITWISE_OPERATIONS',
        bytecode:
          '0x' +
          '6005600A10602052' + // 1. LT: 5 < 10 = 1
          '600A6005901160405260FB5f0b' + // 2. GT: 10 > 5 = 1
          '60FD5f0b81811260605213608052' + // 3-4. SLT & SGT
          '604051608051148060A052' + // 5. EQ
          '1560C052' + // 6. ISZERO
          '6384C2A6E1631234567881811660E052' + // 7. AND
          '81811761010052' + // 8. OR
          '188061012052' + // 9. XOR
          '198061014052' + // 10. NOT
          '601E1a806101605260041b80610180' + // 11-12. BYTE & SHL
          '5260041c6101A052' + // 13. SHR
          '610180515f0b60041d6101C052' +
          '6101C051',
        description: 'should handle all comparison and bitwise operations correctly',
      },
    ]

    for (const testCase of testCases) {
      it(testCase.description, async function () {
        const evm = await createEVM()
        const res = await evm.runCode({
          code: hexToBytes(testCase.bytecode),
        })

        const { lastStackValue, lastOutPtValue } = logStackAndPlacement(res)
        expect(lastStackValue).toBe(lastOutPtValue)
      })
    }
  })
})
