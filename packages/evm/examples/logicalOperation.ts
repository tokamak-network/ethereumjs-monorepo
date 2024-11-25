//DEBUG=ethjs,evm:ops:* tsx logicalOperation.ts
import { hexToBytes } from '@ethereumjs/util'

import { createEVM } from '../src/constructors.js'

const main = async () => {
  const evm = await createEVM()

  //   //단순 MUL 연산 테스트
  //   console.log('\nTesting Simple MUL Operations:')
  //   const simpleRes = await evm.runCode({
  //     code: hexToBytes('0x600360040200'), // PUSH1 3, PUSH1 4, MUL
  //   })

  //   const simpleStackValue = simpleRes.runState?.stack.peek(1)[0]
  //   console.log(`Simple MUL result (3 * 4): ${simpleStackValue}`)

  //복합 MUL 연산 테스트
  console.log('\nTesting Complex MUL Operations:')

  /**CODECOPY 실행 시점
{
    pc: 24,             // 프로그램 카운터
    op: "CODECOPY",     // 코드를 메모리로 복사하는 연산
    gas: "0xffffca",    // 남은 가스
    gasCost: "0x105",   // CODECOPY 연산의 가스 비용 (261)
    stack: [            // 현재 스택 상태
        "0x56b",        // destOffset: 메모리 목적지 오프셋
        "0x56b",        // offset: 코드에서의 시작 위치
        "0x1c",         // size: 복사할 크기 (28 바이트)
        "0x0"           // PUSH0로 추가된 값
    ],
    depth: 0
}
    */

  const calldata1 =
    '0x711e3215' + '0000000000000000000000000000000000000000000000000000000000000001' // uint256 1

  const runtimeCode =
    '0x608060405234801561000f575f80fd5b5060043610610034575f3560e01c8063711e321514610038578063ab3ae25514610068575b5f80fd5b610052600480360381019061004d9190610357565b610084565b60405161005f9190610391565b60405180910390f35b610082600480360381019061007d9190610357565b6100'

  const res = await evm.runCode({
    code: hexToBytes(runtimeCode),
    data: hexToBytes(calldata1),
  })

  // 결과 출력
  console.log('\nStack-Placement Value Comparison Test')
  console.log('stack : ', res.runState?.stack)
  console.log('stackPt : ', res.runState?.stackPt)

  console.log(res.runState!.synthesizer)

  const placementsArray = Array.from(res.runState!.synthesizer.placements.values())

  console.log('placementsArray : ', placementsArray)

  // const lastPlacement = placementsArray[placementsArray.length - 1]
  // const lastOutPtValue = lastPlacement.outPts[lastPlacement.outPts.length - 1].valuestr

  // console.log(`Last Placement OutPt Value: ${lastOutPtValue}`)

  //생성된 모든 서킷 출력
  console.log('\nGenerated Circuits:')
  let index = 1
  for (const placement of placementsArray) {
    console.log(`\nCircuit ${index}:`)
    console.log(`Operation: ${placement.name}`)
    console.log(`Number of inputs: ${placement.inPts.length}`)
    console.log(`Number of outputs: ${placement.outPts.length}`)
    console.log(
      'Placement details:',
      JSON.stringify(
        placement,
        (key, value) => (typeof value === 'bigint' ? value.toString() : value),
        2,
      ),
    )

    index++
  }
  console.log('last stackPt value : ')
}

void main().catch((error) => {
  console.log('****ERROR*****')
  console.error(error)
  process.exit(1)
})
