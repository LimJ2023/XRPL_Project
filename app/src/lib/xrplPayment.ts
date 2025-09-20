import { Client, Wallet, Payment } from "xrpl"

// XRPL 결제를 위한 설정
const XRPL_SERVER = "wss://s.devnet.rippletest.net:51233"

// XRP Reserve 설정 (기본 10 XRP + 객체당 2 XRP)
const BASE_RESERVE = 10_000_000 // 10 XRP in drops
const OWNER_RESERVE = 2_000_000 // 2 XRP in drops

// Toss와 PayPay의 XRPL 주소 (테스트넷용 유효한 주소)
// 실제 운영환경에서는 실제 지갑 주소로 교체해야 합니다.
const WALLET_ADDRESSES = {
    toss: process.env.NEXT_PUBLIC_TOSS_WALLET_ADDRESS || "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH", // 테스트넷 유효 주소
    paypay: process.env.NEXT_PUBLIC_PAYPAY_WALLET_ADDRESS || "rDNvpKTVkKxjqKYjU7zE7Y8gXqrJ9vdtME", // 테스트넷 유효 주소
}

export interface PaymentRequest {
    method: string // "toss" | "paypay" 등
    amount: number
    token: string // "XRP" | "USD.IOU" 등
    senderSeed?: string // 발신자 지갑 시드 (환경변수에서 가져올 예정)
}

export interface PaymentResult {
    success: boolean
    txHash?: string
    error?: string
    details?: any
}

export interface WalletInfo {
    address: string
    xrpBalance: number // XRP 단위
    xrpBalanceDrops: string // drops 단위
    ownerCount: number
    reserve: number // 예치금 (XRP 단위)
    availableBalance: number // 사용 가능한 잔액 (XRP 단위)
}

/**
 * 지갑 정보를 가져오는 함수
 */
export async function getWalletInfo(senderSeed: string): Promise<WalletInfo | null> {
    const client = new Client(XRPL_SERVER)

    try {
        await client.connect()
        const wallet = Wallet.fromSeed(senderSeed.trim())

        const accountInfo = await client.request({
            command: 'account_info',
            account: wallet.address
        })

        const balance = parseInt(accountInfo.result.account_data.Balance)
        const ownerCount = accountInfo.result.account_data.OwnerCount || 0
        const reserve = (BASE_RESERVE + (ownerCount * OWNER_RESERVE)) / 1_000_000
        const availableBalance = Math.max(0, (balance / 1_000_000) - reserve)

        return {
            address: wallet.address,
            xrpBalance: balance / 1_000_000,
            xrpBalanceDrops: balance.toString(),
            ownerCount,
            reserve,
            availableBalance
        }
    } catch (error) {
        console.error('지갑 정보 조회 실패:', error)
        return null
    } finally {
        await client.disconnect()
    }
}

/**
 * XRP 결제를 실행하는 함수
 */
export async function sendXRPPayment(
    destinationAddress: string,
    amount: number,
    senderSeed: string
): Promise<PaymentResult> {
    const client = new Client(XRPL_SERVER)

    try {
        await client.connect()

        const senderWallet = Wallet.fromSeed(senderSeed.trim())

        // 발신자 계정 정보 확인
        const accountInfo = await client.request({
            command: 'account_info',
            account: senderWallet.address
        })

        const balance = parseInt(accountInfo.result.account_data.Balance)
        const ownerCount = accountInfo.result.account_data.OwnerCount || 0
        const reserve = (BASE_RESERVE + (ownerCount * OWNER_RESERVE)) / 1_000_000
        const availableBalance = Math.max(0, (balance / 1_000_000) - reserve)

        // 사용 가능한 잔액 확인
        if (availableBalance < amount) {
            return {
                success: false,
                error: `잔액이 부족합니다. 사용 가능한 잔액: ${availableBalance.toFixed(6)} XRP, 요청 금액: ${amount} XRP (예치금 ${reserve} XRP 제외)`
            }
        }

        // XRP는 drops 단위로 전송 (1 XRP = 1,000,000 drops)
        const amountInDrops = (amount * 1_000_000).toString()

        const tx: Payment = {
            TransactionType: "Payment",
            Account: senderWallet.address,
            Destination: destinationAddress,
            Amount: amountInDrops
        }

        const prepared = await client.autofill(tx)
        const signed = senderWallet.sign(prepared)
        const result = await client.submitAndWait(signed.tx_blob)

        if (result.result.meta && typeof result.result.meta === 'object' &&
            'TransactionResult' in result.result.meta &&
            result.result.meta.TransactionResult === 'tesSUCCESS') {
            return {
                success: true,
                txHash: result.result.hash,
                details: result
            }
        } else {
            const errorCode = result.result.meta && typeof result.result.meta === 'object' &&
                'TransactionResult' in result.result.meta
                ? String(result.result.meta.TransactionResult)
                : 'Unknown error'

            // 구체적인 오류 메시지 제공
            let userFriendlyError = `트랜잭션 실패: ${errorCode}`

            switch (errorCode) {
                case 'tecUNFUNDED_PAYMENT':
                    userFriendlyError = `잔액이 부족합니다. XRP 잔액과 예치금(Reserve)을 확인해주세요.`
                    break
                case 'tecNO_DST':
                    userFriendlyError = `목적지 계정이 존재하지 않습니다. 계정이 활성화되어 있는지 확인해주세요.`
                    break
                case 'tecDST_TAG_NEEDED':
                    userFriendlyError = `목적지 태그(Destination Tag)가 필요합니다.`
                    break
                case 'tecNO_PERMISSION':
                    userFriendlyError = `권한이 없습니다. 계정 설정을 확인해주세요.`
                    break
                case 'tecPATH_DRY':
                    userFriendlyError = `결제 경로를 찾을 수 없습니다. 유동성이 부족할 수 있습니다.`
                    break
                case 'tecNO_LINE':
                    userFriendlyError = `Trust Line이 설정되지 않았습니다. IOU 토큰을 받기 위한 신뢰선을 설정해주세요.`
                    break
                default:
                    if (errorCode.startsWith('tec')) {
                        userFriendlyError = `트랜잭션이 실패했습니다. 오류 코드: ${errorCode}`
                    }
            }

            return {
                success: false,
                error: userFriendlyError,
                details: result
            }
        }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        }
    } finally {
        await client.disconnect()
    }
}

/**
 * IOU 결제를 실행하는 함수
 */
export async function sendIOUPayment(
    destinationAddress: string,
    amount: number,
    currency: string,
    issuerAddress: string,
    senderSeed: string
): Promise<PaymentResult> {
    const client = new Client(XRPL_SERVER)

    try {
        await client.connect()

        const senderWallet = Wallet.fromSeed(senderSeed.trim())

        const tx: Payment = {
            TransactionType: "Payment",
            Account: senderWallet.address,
            Destination: destinationAddress,
            Amount: {
                currency: currency,
                issuer: issuerAddress,
                value: amount.toString()
            }
        }

        const prepared = await client.autofill(tx)
        const signed = senderWallet.sign(prepared)
        const result = await client.submitAndWait(signed.tx_blob)

        if (result.result.meta && typeof result.result.meta === 'object' &&
            'TransactionResult' in result.result.meta &&
            result.result.meta.TransactionResult === 'tesSUCCESS') {
            return {
                success: true,
                txHash: result.result.hash,
                details: result
            }
        } else {
            const errorCode = result.result.meta && typeof result.result.meta === 'object' &&
                'TransactionResult' in result.result.meta
                ? String(result.result.meta.TransactionResult)
                : 'Unknown error'

            // 구체적인 오류 메시지 제공
            let userFriendlyError = `트랜잭션 실패: ${errorCode}`

            switch (errorCode) {
                case 'tecUNFUNDED_PAYMENT':
                    userFriendlyError = `잔액이 부족합니다. XRP 잔액과 예치금(Reserve)을 확인해주세요.`
                    break
                case 'tecNO_DST':
                    userFriendlyError = `목적지 계정이 존재하지 않습니다. 계정이 활성화되어 있는지 확인해주세요.`
                    break
                case 'tecDST_TAG_NEEDED':
                    userFriendlyError = `목적지 태그(Destination Tag)가 필요합니다.`
                    break
                case 'tecNO_PERMISSION':
                    userFriendlyError = `권한이 없습니다. 계정 설정을 확인해주세요.`
                    break
                case 'tecPATH_DRY':
                    userFriendlyError = `결제 경로를 찾을 수 없습니다. 유동성이 부족할 수 있습니다.`
                    break
                case 'tecNO_LINE':
                    userFriendlyError = `Trust Line이 설정되지 않았습니다. IOU 토큰을 받기 위한 신뢰선을 설정해주세요.`
                    break
                default:
                    if (errorCode.startsWith('tec')) {
                        userFriendlyError = `트랜잭션이 실패했습니다. 오류 코드: ${errorCode}`
                    }
            }

            return {
                success: false,
                error: userFriendlyError,
                details: result
            }
        }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        }
    } finally {
        await client.disconnect()
    }
}

/**
 * XRPL 주소 유효성을 검사하는 함수
 */
export function isValidXRPLAddress(address: string): boolean {
    // XRPL 주소는 'r'로 시작하고 25-34자 길이여야 함
    const xrplAddressRegex = /^r[1-9A-HJ-NP-Za-km-z]{24,33}$/
    return xrplAddressRegex.test(address)
}

/**
 * 결제 방법에 따른 지갑 주소를 반환
 */
export function getWalletAddress(method: string): string | null {
    let address: string | null = null

    switch (method.toLowerCase()) {
        case 'toss':
            address = WALLET_ADDRESSES.toss
            break
        case 'paypay':
            address = WALLET_ADDRESSES.paypay
            break
        default:
            return null
    }

    // 주소 유효성 검사
    if (address && isValidXRPLAddress(address)) {
        return address
    }

    return null
}

/**
 * 토큰 발행자 주소를 반환하는 함수
 */
export function getTokenIssuer(currency: string): string | null {
    const upperCurrency = currency.toUpperCase()

    switch (upperCurrency) {
        case 'USD':
            return process.env.NEXT_PUBLIC_USD_ISSUER_ADDRESS || "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH"
        case 'KRW':
            return process.env.NEXT_PUBLIC_KRW_ISSUER_ADDRESS || "rDNvpKTVkKxjqKYjU7zE7Y8gXqrJ9vdtME"
        case 'JPY':
            return process.env.NEXT_PUBLIC_JPY_ISSUER_ADDRESS || "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH"
        default:
            return null
    }
}

/**
 * 메인 결제 처리 함수
 */
export async function processPayment(request: PaymentRequest): Promise<PaymentResult> {
    const destinationAddress = getWalletAddress(request.method)

    if (!destinationAddress) {
        return {
            success: false,
            error: `지원하지 않는 결제 방법입니다: ${request.method}`
        }
    }

    if (!request.senderSeed) {
        return {
            success: false,
            error: '발신자 지갑 정보가 없습니다.'
        }
    }

    if (request.token === 'XRP') {
        return await sendXRPPayment(destinationAddress, request.amount, request.senderSeed)
    } else if (request.token.endsWith('.IOU')) {
        // IOU 처리 - 예: "USD.IOU" -> currency: "USD"
        const currency = request.token.replace('.IOU', '')
        const issuerAddress = getTokenIssuer(currency)

        if (!issuerAddress) {
            return {
                success: false,
                error: `지원하지 않는 IOU 토큰입니다: ${currency}. 지원되는 토큰: USD, KRW, JPY`
            }
        }

        return await sendIOUPayment(destinationAddress, request.amount, currency, issuerAddress, request.senderSeed)
    } else {
        return {
            success: false,
            error: `지원하지 않는 토큰 타입입니다: ${request.token}`
        }
    }
}
