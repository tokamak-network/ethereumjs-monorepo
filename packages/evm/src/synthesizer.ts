import { EVM } from './evm.js'

type SubcircuitCode = {
  subcircuitId: number
  nWire: number
  outIdx: number
  nOut: number
  inIdx: number
  nIn: number
}
type SubcircuitId = {
  code: number
  name: string
  nWire: number
  outIdx: number
  nOut: number
  inIdx: number
  nIn: number
}

export class Synthesizer extends EVM {
  protected readonly _subcircuitsOpcode: SubcircuitCode[]
  protected readonly _subcircuitsID: SubcircuitId[]

  private constructor(evmInstance: EVM) {
    super(evmInstance) // EVM 인스턴스를 기반으로 초기화
    this._subcircuitsID = []
    this._subcircuitsOpcode = []
  }

  // 비동기 팩토리 메서드
  public static async create(evmInstance: EVM): Promise<Synthesizer> {
    // const opts: EVMOpts = {
    //   opcodes: evmInstance['_opcodes'], // _opcodes 속성을 추출
    //   // 다른 필요한 옵션들을 추가
    // }
    return new Synthesizer(evmInstance)
  }

  public async runCode(options: any) {
    console.log('Synthesizer runCode called')
    return super.runCode(options)
  }
}
