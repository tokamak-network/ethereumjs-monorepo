//DEBUG=ethjs,evm:ops:* tsx resolvingDataAlias.ts
import { hexToBytes } from '@ethereumjs/util'

import { createEVM } from '../src/constructors.js'
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

const main = async () => {
  const evm = await createEVM()
  console.log('hex to bytes: ', hexToBytes('0x63c0cac01a60225263b01dface601e52611eaf601c52602051'))
  const res = await evm.runCode({
    code: hexToBytes('0x63c0cac01a60225263b01dface601e52611eaf601c52602051'),
  })

  const stringPlacements = mapToStr(res.runState!.synthesizer.placements)
  console.log(`stack(str): ${'0x' + res.runState!.stack.peek(1)[0].toString(16)}`) // 3n
  console.log(`stackPt: ${JSON.stringify(res.runState!.stackPt.getStack(), arrToStr, 2)}\n`) // 3n
  console.log(`"placements": ${JSON.stringify(stringPlacements, null, 1)}`)
}

void main()
