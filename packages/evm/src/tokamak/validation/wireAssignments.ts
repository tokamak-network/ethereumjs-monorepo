import { readFileSync } from 'fs'
// @ts-ignore
import { builder } from '../utils/witness_calculator.js'
import path from 'path'
import { PlacementInstances } from '../types/synthesizer.js'
import appRootPath from 'app-root-path'

export const checkInstances = async (instances: PlacementInstances): Promise<void> => {
  //console.log("Usage: tsx generate_witness.ts <file.wasm> <input.json> <output.wtns>")
  const dir = 'packages/evm/src/tokamak/resources/subcircuitLibrary'
  const reuseBuffer = new Map()
  for (const [placementInd, instance] of instances.entries()) {
    const id = instance.subcircuitId

    let buffer
    if (reuseBuffer.has(id)) {
      buffer = reuseBuffer.get(id)
    } else {
      const targetWasmPath = path.resolve(appRootPath.path, dir, `subcircuit${id}.wasm`)
      try {
        buffer = readFileSync(targetWasmPath)
      } catch (err) {
        throw new Error(`Error while reading subcircuit${id}.wasm`)
      }
      reuseBuffer.set(id, buffer)
    }
    const ins = { in: instance.inValues }

    const witnessCalculator = await builder(buffer)
    const witness = await witnessCalculator.calculateWitness(ins, 0)
    for (let i = 1; i <= instance.outValues.length; i++) {
      if (witness[i] !== BigInt(instance.outValues[i - 1])) {
        throw new Error(
          `Instance check failed in the placement ${instance.instructionName} (index = ${placementInd})`,
        )
      }
    }
  }
}
