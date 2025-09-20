import { Wallet } from 'xrpl'

// 환경변수에서 지갑 시드를 안전하게 가져오는 함수들
export const getWalletSeeds = () => {
    return {
        // 핵심 지갑들은 기본 시드 제공 (테스트용)
        tossMain: import.meta.env.VITE_TOSS_WALLET_SEED || 'sEd7FEPXXFobbf1CBNDBCjgNNRPGaMN',
        payPay: import.meta.env.VITE_PAYPAY_WALLET_SEED || 'sEdTx8LBWymxoi4hVwNHCeDCKC8k5dK',

        // 나머지는 환경변수에서만 가져오고, 없으면 빈 문자열 (더미 주소 사용)
        convenienceA: import.meta.env.VITE_CONVENIENCE_A_SEED || '',
        convenienceB: import.meta.env.VITE_CONVENIENCE_B_SEED || '',
        bankA: import.meta.env.VITE_BANK_A_SEED || '',
        bankB: import.meta.env.VITE_BANK_B_SEED || '',
        ecommerceA: import.meta.env.VITE_ECOMMERCE_A_SEED || ''
    }
}

// 시드에서 지갑 객체 생성
export const createWalletFromSeed = (seed: string): Wallet | null => {
    try {
        if (!seed || seed.trim() === '') {
            console.warn('⚠️ 지갑 시드가 제공되지 않았습니다')
            return null
        }
        return Wallet.fromSeed(seed.trim())
    } catch (error) {
        console.error('❌ 지갑 생성 실패:', error)
        return null
    }
}

// 모든 지갑 생성
export const createWallets = () => {
    const seeds = getWalletSeeds()

    return {
        tossMain: seeds.tossMain ? createWalletFromSeed(seeds.tossMain) : null,
        payPay: seeds.payPay ? createWalletFromSeed(seeds.payPay) : null,
        convenienceA: seeds.convenienceA ? createWalletFromSeed(seeds.convenienceA) : null,
        convenienceB: seeds.convenienceB ? createWalletFromSeed(seeds.convenienceB) : null,
        bankA: seeds.bankA ? createWalletFromSeed(seeds.bankA) : null,
        bankB: seeds.bankB ? createWalletFromSeed(seeds.bankB) : null,
        ecommerceA: seeds.ecommerceA ? createWalletFromSeed(seeds.ecommerceA) : null
    }
}

// 지갑 주소 매핑 (시드가 있는 경우에만)
export const getWalletAddresses = () => {
    const wallets = createWallets()

    return {
        // 실제 시드에서 생성된 주소들 (기본 테스트 지갑)
        tossMain: wallets.tossMain?.address || "rL6UxaJR8WkyYmDzBtDP14t9vhCpLDyTDe", // 기본값
        payPay: wallets.payPay?.address || "r3jF6kpULQUJwZsTTNzboZTr2zPRpNtQrU", // 기본값

        // 더미 주소들 - 실제로는 거래가 없을 것임
        convenienceA: wallets.convenienceA?.address || "rsTPNoEaEaPPy1AfusedP9VstsZK8K1zqS",
        convenienceB: wallets.convenienceB?.address || "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH", // 실제 존재하는 테스트 주소
        bankA: wallets.bankA?.address || "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh", // 실제 존재하는 테스트 주소  
        bankB: wallets.bankB?.address || "rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY", // 실제 존재하는 테스트 주소
        ecommerceA: wallets.ecommerceA?.address || "rLNaPoKeeBjZe2qs6x52yVPZpZ8td4dc6w" // 실제 존재하는 테스트 주소
    }
}

// 새 테스트 지갑 생성 및 환경변수 출력 (개발용)
export const generateTestWallets = () => {
    console.log('🔧 테스트 지갑 생성 중...')

    const walletNames = [
        'VITE_TOSS_WALLET_SEED',
        'VITE_PAYPAY_WALLET_SEED',
        'VITE_CONVENIENCE_A_SEED',
        'VITE_CONVENIENCE_B_SEED',
        'VITE_BANK_A_SEED',
        'VITE_BANK_B_SEED',
        'VITE_ECOMMERCE_A_SEED'
    ]

    const envVars: string[] = []

    walletNames.forEach(name => {
        const wallet = Wallet.generate()
        envVars.push(`${name}=${wallet.seed}`)
        console.log(`${name}: ${wallet.address} (시드: ${wallet.seed})`)
    })

    console.log('\n📝 환경변수 설정:')
    envVars.forEach(env => console.log(env))

    return envVars
}

// 지갑 잔액 확인 헬퍼
export const validateWalletConfiguration = () => {
    console.log('🔧 지갑 구성 검증 시작...')
    const seeds = getWalletSeeds()
    const addresses = getWalletAddresses()
    const issues: string[] = []

    console.log('📋 환경변수에서 읽어온 시드들:')
    Object.entries(seeds).forEach(([key, seed]) => {
        console.log(`  ${key}: ${seed ? '설정됨' : '미설정'}`)

        if (!seed || seed.trim() === '') {
            issues.push(`❌ ${key} 시드가 설정되지 않았습니다`)
        } else {
            try {
                const wallet = Wallet.fromSeed(seed.trim())
                console.log(`✅ ${key}: ${wallet.address}`)
            } catch (error) {
                issues.push(`❌ ${key} 시드가 유효하지 않습니다: ${seed}`)
            }
        }
    })

    console.log('📋 실제 사용될 지갑 주소들:')
    Object.entries(addresses).forEach(([key, address]) => {
        const isFromSeed = seeds[key as keyof typeof seeds] ? '✅ 시드에서 생성' : '⚠️ 더미 주소 사용'
        console.log(`  ${key}: ${address} (${isFromSeed})`)
    })

    if (issues.length > 0) {
        console.warn('⚠️ 지갑 구성 문제:', issues)
        return false
    }

    console.log('✅ 모든 지갑이 올바르게 구성되었습니다')
    return true
}

export default {
    getWalletSeeds,
    createWalletFromSeed,
    createWallets,
    getWalletAddresses,
    generateTestWallets,
    validateWalletConfiguration
}
