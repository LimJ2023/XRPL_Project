import { Client, Wallet } from 'xrpl'
import { getWalletAddresses } from './walletManager'

// XRPL 테스트넷 설정
const TESTNET_URL = "wss://s.devnet.rippletest.net:51233"

// 타입 정의
export type PaymentRecord = {
    id: string
    timestamp: string
    from: string
    to: string
    amount: number
    currency: string
    status: "success" | "failed" | "pending"
    partner: string
    txHash: string
}

export type PartnerStats = {
    partner: string
    totalTransactions: number
    successfulTransactions: number
    totalAmount: number
    avgAmount: number
    successRate: number
}

export type DashboardData = {
    payments: PaymentRecord[]
    stats: PartnerStats[]
}

// TOSS 지갑 시스템 설정 (환경변수 기반)
const walletAddresses = getWalletAddresses()

export const TOSS_WALLET_SYSTEM = {
    tossMain: walletAddresses.tossMain,
    partners: {
        "PayPay": {
            name: "PG",
            address: walletAddresses.payPay,
            logo: "/paypay.png",
            category: "디지털결제"
        },
        "편의점A": {
            name: "편의점A (세븐일레븐)",
            address: walletAddresses.convenienceA,
            logo: "/seveneleven.png",
            category: "편의점"
        },
        "편의점B": {
            name: "편의점B (cu)",
            address: walletAddresses.convenienceB,
            logo: "/cu.png",
            category: "편의점"
        },
        "은행A": {
            name: "은행A (신한)",
            address: walletAddresses.bankA,
            logo: "/shinhan.png",
            category: "은행"
        },
        "은행B": {
            name: "은행B (하나)",
            address: walletAddresses.bankB,
            logo: "/hana.png",
            category: "은행"
        },
        "온라인쇼핑A": {
            name: "온라인쇼핑A (쿠팡)",
            address: walletAddresses.ecommerceA,
            logo: "/cupang.png",
            category: "이커머스"
        }
    }
}

// XRPL 클라이언트 인스턴스 관리
class XRPLService {
    private client: Client | null = null
    private isConnecting = false

    async getClient(): Promise<Client> {
        if (this.client && this.client.isConnected()) {
            return this.client
        }

        if (this.isConnecting) {
            // 연결 중이면 잠시 대기
            await new Promise(resolve => setTimeout(resolve, 1000))
            return this.getClient()
        }

        this.isConnecting = true
        try {
            this.client = new Client(TESTNET_URL)
            await this.client.connect()
            console.log('✅ XRPL 테스트넷에 연결되었습니다')
            return this.client
        } catch (error) {
            console.error('❌ XRPL 연결 실패:', error)
            throw error
        } finally {
            this.isConnecting = false
        }
    }

    async disconnect() {
        if (this.client && this.client.isConnected()) {
            await this.client.disconnect()
            console.log('🔄 XRPL 연결이 종료되었습니다')
        }
    }

    // 계정의 거래 내역 조회
    async getAccountTransactions(address: string, limit: number = 100): Promise<any[]> {
        const client = await this.getClient()
        try {
            console.log(`🔍 계정 거래 내역 조회 시작: ${address}`)

            const response = await client.request({
                command: 'account_tx',
                account: address,
                limit: limit,
                ledger_index_max: -1,
                ledger_index_min: -1,
                forward: false // 최신 거래부터
            })

            const transactions = response.result.transactions || []
            console.log(`📊 ${address}에서 ${transactions.length}개의 거래를 조회했습니다`)

            // 첫 번째 거래 샘플 출력 (디버깅용)
            if (transactions.length > 0) {
                const firstTx = transactions[0] as any
                console.log('📄 첫 번째 거래 샘플:', {
                    hash: firstTx.tx?.hash,
                    type: firstTx.tx?.TransactionType,
                    account: firstTx.tx?.Account,
                    destination: firstTx.tx?.Destination,
                    amount: firstTx.tx?.Amount
                })
            }

            return transactions
        } catch (error) {
            console.error(`❌ ${address} 거래 내역 조회 실패:`, error)

            // 계정이 존재하지 않는 경우 확인
            const errorMessage = error instanceof Error ? error.message : String(error)
            if (errorMessage.includes('actNotFound')) {
                console.error(`⚠️ 계정이 존재하지 않습니다: ${address}`)
                console.error('💡 해결방법: 1) 지갑에 XRP가 있는지 확인 2) 주소가 올바른지 확인')
            }

            return []
        }
    }

    // 계정 잔액 조회
    async getAccountBalance(address: string): Promise<string> {
        const client = await this.getClient()
        try {
            const balance = await client.getXrpBalance(address)
            return balance.toString()
        } catch (error) {
            console.error(`❌ ${address} 잔액 조회 실패:`, error)
            return "0"
        }
    }

    // 계정 정보 조회
    async getAccountInfo(address: string): Promise<any> {
        const client = await this.getClient()
        try {
            const response = await client.request({
                command: 'account_info',
                account: address
            })
            return response.result.account_data
        } catch (error) {
            console.error(`❌ ${address} 계정 정보 조회 실패:`, error)
            return null
        }
    }
}

// 싱글톤 인스턴스
const xrplService = new XRPLService()

// meta.AffectedNodes에서 관련된 계정 주소들을 추출
function extractAccountsFromMeta(meta: any): string[] {
    try {
        if (!meta || !Array.isArray(meta.AffectedNodes)) return []
        const accounts = new Set<string>()

        for (const node of meta.AffectedNodes) {
            const inner = node.ModifiedNode || node.CreatedNode || node.DeletedNode
            if (!inner) continue
            const fields = inner.FinalFields || inner.NewFields || inner.PreviousFields || {}

            // AccountRoot, RippleState, PayChannel 등에서 주소 필드 후보 추출
            const candidateFields = [
                fields.Account,
                fields.Destination,
                fields.Owner,
                fields.LowLimit?.issuer,
                fields.HighLimit?.issuer,
                fields.Issuer,
            ]

            for (const c of candidateFields) {
                if (typeof c === 'string' && c.startsWith('r')) {
                    accounts.add(c)
                }
            }
        }
        return Array.from(accounts)
    } catch {
        return []
    }
}

// XRPL 거래 데이터를 PaymentRecord 형식으로 변환
function convertXrplTxToPaymentRecord(tx: any, partnerName: string): PaymentRecord {
    const transaction = tx.tx || tx
    const meta = tx.meta

    // 거래 상태 확인
    let status: "success" | "failed" | "pending" = "pending"
    if (meta) {
        status = meta.TransactionResult === "tesSUCCESS" ? "success" : "failed"
    }

    // 금액 변환: delivered_amount(신형) / DeliveredAmount(구형) 우선 사용
    let amount = 0
    const delivered = meta?.delivered_amount ?? meta?.DeliveredAmount
    const amountSource = delivered ?? transaction.Amount
    if (amountSource) {
        if (typeof amountSource === 'string') {
            if (amountSource !== 'unavailable') {
                amount = parseInt(amountSource) / 1_000_000
            }
        } else if (typeof amountSource === 'object') {
            // IOU 형식 { currency, issuer, value }
            const val = amountSource.value
            amount = typeof val === 'string' ? parseFloat(val) : Number(val || 0)
        }
    }

    // 타임스탬프 변환 (Ripple epoch to Unix timestamp)
    const rippleEpoch = 946684800 // 2000-01-01 00:00:00 UTC
    const timestamp = transaction.date ?
        new Date((transaction.date + rippleEpoch) * 1000).toISOString() :
        new Date().toISOString()

    return {
        id: transaction.hash || `tx_${Date.now()}`,
        timestamp,
        from: transaction.Account || "",
        to: transaction.Destination || "",
        amount: Math.round(amount * 100) / 100, // 소수점 2자리로 반올림
        currency: typeof transaction.Amount === 'object' ? transaction.Amount.currency : "XRP",
        status,
        partner: partnerName,
        txHash: transaction.hash || ""
    }
}

// 파트너 이름 찾기
function getPartnerName(address: string): string {
    const partner = Object.values(TOSS_WALLET_SYSTEM.partners).find(p => p.address === address)
    return partner ? partner.name : "Unknown Partner"
}

// TOSS 메인 지갑과 관련된 거래 조회
export async function fetchXrplPayments(selectedPartners: string[] = []): Promise<DashboardData> {
    try {
        console.log('🔍 XRPL 테스트넷에서 거래 데이터를 조회 중...')
        console.log('📍 TOSS 메인 지갑 주소:', TOSS_WALLET_SYSTEM.tossMain)
        console.log('📍 선택된 파트너들:', selectedPartners)

        // TOSS 메인 지갑의 거래 내역 조회
        const tossTransactions = await xrplService.getAccountTransactions(TOSS_WALLET_SYSTEM.tossMain, 200)
        console.log('📊 TOSS 지갑에서 조회된 총 거래 수:', tossTransactions.length)

        // 선택된 파트너들의 주소 목록
        const allPartnerKeys = Object.keys(TOSS_WALLET_SYSTEM.partners)
        const partnersToFilter = selectedPartners.length > 0 ? selectedPartners : allPartnerKeys
        const partnerAddresses = partnersToFilter.map(key =>
            TOSS_WALLET_SYSTEM.partners[key as keyof typeof TOSS_WALLET_SYSTEM.partners].address
        )

        console.log('🎯 필터링할 파트너 키들:', partnersToFilter)
        console.log('🎯 파트너 주소들:', partnerAddresses)

        // 파트너와 관련된 거래만 필터링 (tx 필드 + meta.AffectedNodes 모두 고려)
        const relevantTransactions = tossTransactions.filter(tx => {
            const transaction = tx.tx || tx
            const txAccount: string | undefined = transaction.Account
            const txDestination: string | undefined = transaction.Destination
            const metaAccounts = extractAccountsFromMeta(tx.meta)

            const involvesToss = [txAccount, txDestination, ...metaAccounts].some(a => a === TOSS_WALLET_SYSTEM.tossMain)
            const involvesPartner = [txAccount, txDestination, ...metaAccounts].some(a => partnerAddresses.includes(a || ''))

            const isRelevant = involvesToss && involvesPartner

            if (isRelevant) {
                console.log('✅ 관련 거래 발견:', {
                    hash: transaction.hash,
                    type: transaction.TransactionType,
                    from: txAccount,
                    to: txDestination,
                    metaAccounts: metaAccounts.slice(0, 5),
                })
            }

            return isRelevant
        })

        console.log('📊 필터링된 관련 거래 수:', relevantTransactions.length)

        // PaymentRecord 형식으로 변환
        const payments: PaymentRecord[] = relevantTransactions.map(tx => {
            const transaction = tx.tx || tx
            const txAccount: string | undefined = transaction.Account
            const txDestination: string | undefined = transaction.Destination
            const metaAccounts = extractAccountsFromMeta(tx.meta)

            let partnerAddress = ''
            if (txAccount === TOSS_WALLET_SYSTEM.tossMain && txDestination) {
                partnerAddress = txDestination
            } else if (txDestination === TOSS_WALLET_SYSTEM.tossMain && txAccount) {
                partnerAddress = txAccount
            } else {
                partnerAddress = metaAccounts.find(a => partnerAddresses.includes(a)) || ''
            }

            const partnerName = getPartnerName(partnerAddress)
            return convertXrplTxToPaymentRecord(tx, partnerName)
        })

        // 파트너별 통계 계산
        const stats: PartnerStats[] = partnersToFilter.map(partnerKey => {
            const partner = TOSS_WALLET_SYSTEM.partners[partnerKey as keyof typeof TOSS_WALLET_SYSTEM.partners]
            const partnerPayments = payments.filter(p => p.partner === partner.name)
            const successfulPayments = partnerPayments.filter(p => p.status === "success")
            const totalAmount = partnerPayments.reduce((sum, p) => sum + p.amount, 0)

            return {
                partner: partner.name,
                totalTransactions: partnerPayments.length,
                successfulTransactions: successfulPayments.length,
                totalAmount: Math.round(totalAmount * 100) / 100,
                avgAmount: partnerPayments.length > 0 ?
                    Math.round((totalAmount / partnerPayments.length) * 100) / 100 : 0,
                successRate: partnerPayments.length > 0 ?
                    Math.round((successfulPayments.length / partnerPayments.length) * 100) : 0
            }
        })

        console.log(`✅ ${payments.length}개의 거래를 조회했습니다`)

        // 각 파트너별 잔액도 확인해보기 (디버깅용)
        console.log('💰 지갑 잔액 확인:')
        try {
            const tossBalance = await xrplService.getAccountBalance(TOSS_WALLET_SYSTEM.tossMain)
            console.log(`  TOSS 메인: ${tossBalance} XRP`)

            for (const partnerKey of partnersToFilter.slice(0, 2)) { // 처음 2개만
                const partner = TOSS_WALLET_SYSTEM.partners[partnerKey as keyof typeof TOSS_WALLET_SYSTEM.partners]
                const balance = await xrplService.getAccountBalance(partner.address)
                console.log(`  ${partner.name}: ${balance} XRP`)
            }
        } catch (error) {
            console.error('잔액 조회 중 오류:', error)
        }

        return { payments, stats }

    } catch (error) {
        console.error('❌ XRPL 거래 데이터 조회 실패:', error)
        // 오류 발생 시 빈 데이터 반환
        return { payments: [], stats: [] }
    }
}

// 지갑 생성 (테스트용)
export async function createTestWallet(): Promise<{ address: string; seed: string }> {
    try {
        const wallet = Wallet.generate()
        console.log('🆕 테스트 지갑 생성:', wallet.address)
        return {
            address: wallet.address,
            seed: wallet.seed!
        }
    } catch (error) {
        console.error('❌ 지갑 생성 실패:', error)
        throw error
    }
}

// 지갑에 테스트 XRP 충전 (새 지갑 생성 후 충전)
export async function fundTestWallet(seed?: string): Promise<{ address: string; funded: boolean }> {
    try {
        const client = await xrplService.getClient()
        const wallet = seed ? Wallet.fromSeed(seed) : Wallet.generate()
        await client.fundWallet(wallet)
        console.log('💰 테스트 XRP 충전 완료:', wallet.address)
        return { address: wallet.address, funded: true }
    } catch (error) {
        console.error('❌ 테스트 XRP 충전 실패:', error)
        return { address: '', funded: false }
    }
}

// 서비스 정리
export async function cleanup() {
    await xrplService.disconnect()
}

export default xrplService
