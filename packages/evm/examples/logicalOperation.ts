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
  const res = await evm.runCode({
    code: hexToBytes('0x600460EC5F0B056080528051'),
  })

  // 결과 출력
  console.log('\nStack-Placement Value Comparison Test')
  console.log('stack : ', res.runState?.stack)
  console.log('stackPt : ', res.runState?.stackPt)
  console.log('go')

  console.log('goeee')
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
  console.error(error)
  process.exit(1)
})
