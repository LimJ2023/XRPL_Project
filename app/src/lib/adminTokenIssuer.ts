import { Client, Wallet, Payment, TrustSet } from "xrpl"
import dotenv from "dotenv"

// 환경변수 로드
dotenv.config()

// XRPL 테스트넷 서버
const XRPL_SERVER = "wss://s.devnet.rippletest.net:51233"

// 지원되는 통화 목록
export const SUPPORTED_CURRENCIES = {
    USD: "USD",
    JPY: "JPY",
    KRW: "KRW"
} as const

export type SupportedCurrency = keyof typeof SUPPORTED_CURRENCIES

export interface TokenIssueRequest {
    currency: SupportedCurrency
    amount: string
    recipientAddress: string
    adminSeed: string
}

export interface TokenIssueResult {
    success: boolean
    txHash?: string
    error?: string
    details?: {
        currency: string
        amount: string
        issuer: string
        recipient: string
    }
}

export interface TrustLineSetupRequest {
    currency: SupportedCurrency
    issuerAddress: string
    limitAmount: string
    userSeed: string
}

export interface TrustLineResult {
    success: boolean
    txHash?: string
    error?: string
    details?: {
        currency: string
        issuer: string
        limit: string
        user: string
    }
}

/**
 * Admin 지갑 정보를 확인하는 함수
 */
export async function getAdminWalletInfo(adminSeed: string) {
    const client = new Client(XRPL_SERVER)

    try {
        await client.connect()
        const adminWallet = Wallet.fromSeed(adminSeed.trim())

        const accountInfo = await client.request({
            command: 'account_info',
            account: adminWallet.address
        })

        const balance = parseInt(accountInfo.result.account_data.Balance)
        const ownerCount = accountInfo.result.account_data.OwnerCount || 0

        return {
            address: adminWallet.address,
            xrpBalance: balance / 1_000_000,
            ownerCount,
            sequence: accountInfo.result.account_data.Sequence
        }
    } catch (error) {
        console.error('Admin 지갑 정보 조회 실패:', error)
        return null
    } finally {
        await client.disconnect()
    }
}

/**
 * 사용자가 특정 통화에 대한 Trust Line을 설정하는 함수
 */
export async function setupTrustLine(request: TrustLineSetupRequest): Promise<TrustLineResult> {
    const client = new Client(XRPL_SERVER)

    try {
        await client.connect()
        console.log(`\n🔗 Trust Line 설정 시작: ${request.currency}`)

        const userWallet = Wallet.fromSeed(request.userSeed.trim())

        // Trust Line 설정 트랜잭션
        const trustSetTx: TrustSet = {
            TransactionType: "TrustSet",
            Account: userWallet.address,
            LimitAmount: {
                currency: request.currency,
                issuer: request.issuerAddress,
                value: request.limitAmount
            }
        }

        console.log(`📋 Trust Line 설정 내용:`)
        console.log(`   사용자: ${userWallet.address}`)
        console.log(`   발행자: ${request.issuerAddress}`)
        console.log(`   통화: ${request.currency}`)
        console.log(`   한도: ${request.limitAmount}`)

        const prepared = await client.autofill(trustSetTx)
        const signed = userWallet.sign(prepared)
        const result = await client.submitAndWait(signed.tx_blob)

        if (result.result.meta && typeof result.result.meta === 'object' &&
            'TransactionResult' in result.result.meta &&
            result.result.meta.TransactionResult === 'tesSUCCESS') {

            console.log(`✅ Trust Line 설정 성공!`)
            console.log(`🔗 트랜잭션 해시: ${result.result.hash}`)

            return {
                success: true,
                txHash: result.result.hash,
                details: {
                    currency: request.currency,
                    issuer: request.issuerAddress,
                    limit: request.limitAmount,
                    user: userWallet.address
                }
            }
        } else {
            const errorCode = result.result.meta && typeof result.result.meta === 'object' &&
                'TransactionResult' in result.result.meta
                ? String(result.result.meta.TransactionResult)
                : 'Unknown error'

            return {
                success: false,
                error: `Trust Line 설정 실패: ${errorCode}`
            }
        }
    } catch (error) {
        console.error('Trust Line 설정 중 오류:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        }
    } finally {
        await client.disconnect()
    }
}

/**
 * Admin이 특정 통화의 IOU 토큰을 발행하는 함수
 */
export async function issueToken(request: TokenIssueRequest): Promise<TokenIssueResult> {
    const client = new Client(XRPL_SERVER)

    try {
        await client.connect()
        console.log(`\n💰 토큰 발행 시작: ${request.amount} ${request.currency}`)

        const adminWallet = Wallet.fromSeed(request.adminSeed.trim())

        // Admin이 발행자가 되어 사용자에게 토큰을 전송
        const paymentTx: Payment = {
            TransactionType: "Payment",
            Account: adminWallet.address,
            Destination: request.recipientAddress,
            Amount: {
                currency: request.currency,
                issuer: adminWallet.address,
                value: request.amount
            }
        }

        console.log(`📋 토큰 발행 내용:`)
        console.log(`   발행자(Admin): ${adminWallet.address}`)
        console.log(`   수신자: ${request.recipientAddress}`)
        console.log(`   통화: ${request.currency}`)
        console.log(`   금액: ${request.amount}`)

        const prepared = await client.autofill(paymentTx)
        const signed = adminWallet.sign(prepared)
        const result = await client.submitAndWait(signed.tx_blob)

        if (result.result.meta && typeof result.result.meta === 'object' &&
            'TransactionResult' in result.result.meta &&
            result.result.meta.TransactionResult === 'tesSUCCESS') {

            console.log(`✅ ${request.amount} ${request.currency} 토큰 발행 성공!`)
            console.log(`🔗 트랜잭션 해시: ${result.result.hash}`)

            return {
                success: true,
                txHash: result.result.hash,
                details: {
                    currency: request.currency,
                    amount: request.amount,
                    issuer: adminWallet.address,
                    recipient: request.recipientAddress
                }
            }
        } else {
            const errorCode = result.result.meta && typeof result.result.meta === 'object' &&
                'TransactionResult' in result.result.meta
                ? String(result.result.meta.TransactionResult)
                : 'Unknown error'

            let userFriendlyError = `토큰 발행 실패: ${errorCode}`

            switch (errorCode) {
                case 'tecNO_LINE':
                    userFriendlyError = `수신자가 ${request.currency} 토큰에 대한 Trust Line을 설정하지 않았습니다. 먼저 Trust Line을 설정해주세요.`
                    break
                case 'tecUNFUNDED_PAYMENT':
                    userFriendlyError = `Admin 계정의 XRP 잔액이 부족합니다.`
                    break
                case 'tecNO_DST':
                    userFriendlyError = `수신자 계정이 존재하지 않습니다.`
                    break
            }

            return {
                success: false,
                error: userFriendlyError
            }
        }
    } catch (error) {
        console.error('토큰 발행 중 오류:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        }
    } finally {
        await client.disconnect()
    }
}

/**
 * Admin이 여러 통화의 토큰을 한 번에 발행하는 함수
 */
export async function issueMultipleTokens(
    recipientAddress: string,
    adminSeed: string,
    amounts: { [K in SupportedCurrency]?: string }
): Promise<{ [K in SupportedCurrency]?: TokenIssueResult }> {
    const results: { [K in SupportedCurrency]?: TokenIssueResult } = {}

    console.log(`\n🚀 다중 토큰 발행 시작`)
    console.log(`📍 수신자: ${recipientAddress}`)
    console.log(`💰 발행할 토큰:`, amounts)

    // 각 통화별로 순차적으로 발행
    for (const [currency, amount] of Object.entries(amounts)) {
        if (amount && amount !== "0") {
            console.log(`\n--- ${currency} 토큰 발행 중 ---`)

            const result = await issueToken({
                currency: currency as SupportedCurrency,
                amount,
                recipientAddress,
                adminSeed
            })

            results[currency as SupportedCurrency] = result

            if (result.success) {
                console.log(`✅ ${currency} 발행 완료`)
            } else {
                console.log(`❌ ${currency} 발행 실패: ${result.error}`)
            }

            // 다음 트랜잭션 전 잠시 대기
            await new Promise(resolve => setTimeout(resolve, 1000))
        }
    }

    console.log(`\n🎉 다중 토큰 발행 완료!`)
    return results
}

/**
 * 사용자가 모든 지원되는 통화에 대한 Trust Line을 설정하는 함수
 */
export async function setupAllTrustLines(
    userSeed: string,
    issuerAddress: string,
    limitAmount: string = "1000000"
): Promise<{ [K in SupportedCurrency]: TrustLineResult }> {
    const results: { [K in SupportedCurrency]: TrustLineResult } = {} as any

    console.log(`\n🔗 모든 통화 Trust Line 설정 시작`)
    console.log(`👤 사용자 지갑에서 설정`)
    console.log(`🏦 발행자: ${issuerAddress}`)
    console.log(`💰 한도: ${limitAmount}`)

    // 각 통화별로 Trust Line 설정
    for (const currency of Object.keys(SUPPORTED_CURRENCIES) as SupportedCurrency[]) {
        console.log(`\n--- ${currency} Trust Line 설정 중 ---`)

        const result = await setupTrustLine({
            currency,
            issuerAddress,
            limitAmount,
            userSeed
        })

        results[currency] = result

        if (result.success) {
            console.log(`✅ ${currency} Trust Line 설정 완료`)
        } else {
            console.log(`❌ ${currency} Trust Line 설정 실패: ${result.error}`)
        }

        // 다음 트랜잭션 전 잠시 대기
        await new Promise(resolve => setTimeout(resolve, 1000))
    }

    console.log(`\n🎉 모든 Trust Line 설정 완료!`)
    return results
}

/**
 * 완전한 토큰 발행 프로세스 (Trust Line 설정 + 토큰 발행)
 */
export async function completeTokenIssuanceProcess(
    userSeed: string,
    adminSeed: string,
    amounts: { [K in SupportedCurrency]?: string }
) {
    console.log(`\n🚀 완전한 토큰 발행 프로세스 시작`)

    // 1. Admin 지갑 정보 확인
    const adminInfo = await getAdminWalletInfo(adminSeed)
    if (!adminInfo) {
        console.log(`❌ Admin 지갑 정보를 가져올 수 없습니다.`)
        return
    }

    console.log(`\n🏦 Admin 지갑 정보:`)
    console.log(`   주소: ${adminInfo.address}`)
    console.log(`   XRP 잔액: ${adminInfo.xrpBalance} XRP`)

    // 2. 사용자 지갑 주소 확인
    const userWallet = Wallet.fromSeed(userSeed.trim())
    console.log(`\n👤 사용자 지갑: ${userWallet.address}`)

    // 3. 모든 통화에 대한 Trust Line 설정
    const trustLineResults = await setupAllTrustLines(
        userSeed,
        adminInfo.address,
        "1000000"
    )

    // 4. 성공한 Trust Line에 대해서만 토큰 발행
    const filteredAmounts: { [K in SupportedCurrency]?: string } = {}
    for (const [currency, result] of Object.entries(trustLineResults)) {
        if (result.success && amounts[currency as SupportedCurrency]) {
            filteredAmounts[currency as SupportedCurrency] = amounts[currency as SupportedCurrency]
        }
    }

    // 5. 토큰 발행
    if (Object.keys(filteredAmounts).length > 0) {
        const issueResults = await issueMultipleTokens(
            userWallet.address,
            adminSeed,
            filteredAmounts
        )

        // 6. 최종 결과 요약
        console.log(`\n📊 최종 결과 요약:`)
        console.log(`==========================================`)

        for (const currency of Object.keys(SUPPORTED_CURRENCIES) as SupportedCurrency[]) {
            const trustResult = trustLineResults[currency]
            const issueResult = issueResults[currency]

            console.log(`\n${currency}:`)
            console.log(`  Trust Line: ${trustResult.success ? '✅ 성공' : '❌ 실패'}`)
            if (issueResult) {
                console.log(`  토큰 발행: ${issueResult.success ? '✅ 성공' : '❌ 실패'}`)
                if (issueResult.success) {
                    console.log(`  발행량: ${issueResult.details?.amount}`)
                    console.log(`  트랜잭션: ${issueResult.txHash}`)
                }
            }
        }
    } else {
        console.log(`\n❌ 발행할 수 있는 토큰이 없습니다. Trust Line 설정을 확인해주세요.`)
    }

    console.log(`\n🎉 토큰 발행 프로세스 완료!`)
}

// 환경변수에서 시드를 가져오는 헬퍼 함수들
export function getAdminSeedFromEnv(): string | null {
    return process.env.ADMIN_SEED || process.env.NEXT_PUBLIC_ADMIN_SEED || null
}

export function getUserSeedFromEnv(): string | null {
    return process.env.USER_SEED || process.env.NEXT_PUBLIC_USER_SEED || null
}

// 메인 실행 함수 (직접 실행 시)
async function main() {
    const adminSeed = getAdminSeedFromEnv()
    const userSeed = getUserSeedFromEnv()

    if (!adminSeed || !userSeed) {
        console.error('❌ 환경변수에서 ADMIN_SEED 또는 USER_SEED를 찾을 수 없습니다.')
        console.log('필요한 환경변수:')
        console.log('- ADMIN_SEED: Admin 지갑의 시드')
        console.log('- USER_SEED: 사용자 지갑의 시드')
        process.exit(1)
    }

    // 발행할 토큰 양 설정
    const tokenAmounts = {
        USD: "1000",
        JPY: "100000",
        KRW: "1000000"
    }

    // 완전한 토큰 발행 프로세스 실행
    await completeTokenIssuanceProcess(userSeed, adminSeed, tokenAmounts)
}

// 직접 실행 시 메인 함수 호출
if (require.main === module) {
    main().catch(error => {
        console.error('❌ 프로세스 실행 중 오류:', error)
        process.exit(1)
    })
}
