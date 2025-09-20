import { Wallet } from 'xrpl'

export async function createNewWallet() {
  try {
    // 1. 새 지갑 생성
    const newWallet = Wallet.generate()
    console.log('새 지갑 생성 완료')
    console.log(`주소: ${newWallet.address}`)
    console.log(`시드: ${newWallet.seed}`)
    console.log(`공개키: ${newWallet.publicKey}`) // 공개키는 주로 트랜잭션 서명/ Multisig(다중서명)에 쓰임
    return {
      wallet: newWallet,
      address: newWallet.address,
      seed: newWallet.seed!
    }
  } catch (error) {
    console.error('❌ 새 지갑 생성 실패:', error)
    throw new Error(`새 지갑 생성 실패: ${error}`)
  }
}

if (require.main === module) {
  createNewWallet()
} 
