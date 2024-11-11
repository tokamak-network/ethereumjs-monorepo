import { readdirSync } from 'fs'
import { extname, join } from 'path'

const pkg = process.argv[3]
if (!pkg) {
  throw new Error('Package argument must be passed')
}

const examplesPath = `../packages/${pkg}/examples/`
const path = join(__dirname, examplesPath)

const getExample = (fileName: string): Promise<NodeModule> | undefined => {
  if (extname(fileName) === '.cts' || extname(fileName) === '.ts') {
    return import(examplesPath + fileName)
  }
}

const main = async () => {
  const files = readdirSync(path)
  for (const file of files) {
    // console.log(file)
    // if (file !== 'fibonacci-synthesizer.ts') return
    const runner = getExample(file)
    if (runner !== undefined) {
      console.log(` ---- Run example: ${file} ----`)
      await runner
    }
  }
}

main()
