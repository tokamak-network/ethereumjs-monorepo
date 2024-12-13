/**
 * Run this file with:
 * DEBUG=ethjs,evm:*,evm:*:* tsx erc20-transferFrom.ts
 */
import { Account, Address, hexToBytes } from '@ethereumjs/util'
import { keccak256 } from 'ethereum-cryptography/keccak'

import { createEVM } from '../../../src/constructors.js'

// ERC20 contract bytecode
const contractCode = hexToBytes(
  '0x6080604052600436106101ac5760003560e01c...', // 여기에 전체 bytecode
)

const main = async () => {
  const evm = await createEVM()

  // 계정 설정
  const contractAddr = new Address(hexToBytes('0x1000000000000000000000000000000000000000'))
  const owner = new Address(hexToBytes('0x2000000000000000000000000000000000000000'))
  const spender = new Address(hexToBytes('0x3000000000000000000000000000000000000000'))
  const recipient = new Address(hexToBytes('0x4000000000000000000000000000000000000000'))

  // 컨트랙트 계정 생성
  await evm.stateManager.putAccount(contractAddr, new Account())

  // 컨트랙트 코드 배포
  await evm.stateManager.putCode(contractAddr, contractCode)

  // owner의 초기 잔액 설정
  const balanceSlot = '0x5'
  const ownerBalanceSlot = keccak256(
    hexToBytes(
      '0x' + owner.toString().slice(2).padStart(64, '0') + balanceSlot.slice(2).padStart(64, '0'),
    ),
  )
  await evm.stateManager.putStorage(
    contractAddr,
    ownerBalanceSlot,
    hexToBytes('0x' + '100'.padStart(64, '0')), // 100 tokens
  )

  // 1단계: approve 실행 (owner가 spender에게 권한 부여)
  const approveAmount = BigInt(50)
  await evm.runCode({
    caller: owner,
    to: contractAddr,
    code: contractCode,
    data: hexToBytes(
      '0x095ea7b3' + // approve function signature
        spender.toString().slice(2).padStart(64, '0') +
        approveAmount.toString(16).padStart(64, '0'),
    ),
  })

  // 2단계: transferFrom 실행 (spender가 owner의 토큰을 recipient에게 전송)
  const transferAmount = BigInt(30)
  const res = await evm.runCode({
    caller: spender,
    to: contractAddr,
    code: contractCode,
    data: hexToBytes(
      '0x23b872dd' + // transferFrom function signature
        owner.toString().slice(2).padStart(64, '0') +
        recipient.toString().slice(2).padStart(64, '0') +
        transferAmount.toString(16).padStart(64, '0'),
    ),
  })

  // 결과 확인
  console.log('\n=== Storage State ===')
  // allowance mapping의 slot: keccak256(spender + keccak256(owner + 0x6))
  const allowanceSlot = '0x6'
  const allowanceKey = keccak256(
    hexToBytes(
      '0x' +
        spender.toString().slice(2).padStart(64, '0') +
        keccak256(
          hexToBytes(
            '0x' +
              owner.toString().slice(2).padStart(64, '0') +
              allowanceSlot.slice(2).padStart(64, '0'),
          ),
        ).toString(),
    ),
  )

  const allowanceValue = await evm.stateManager.getStorage(contractAddr, allowanceKey)
  console.log('Remaining Allowance:', BigInt('0x' + allowanceValue.toString()))

  console.log('\n=== Circuit Placements ===')
  console.log(JSON.stringify(res.runState?.synthesizer.placements, null, 2))
}

void main()
