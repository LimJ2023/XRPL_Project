/**
 * XRPL PoC: Toss(KR) ↔ PayPay(JP) 결제 시나리오
 * ---------------------------------------------------------
 * - 공통 발행자(Issuer)가 JPY IOU를 발행하고, 두 PG(TOSS_KR, PAYPAY_JP)가 TrustLine 개설 후 송금
 * - 순서: 연결 → TrustLine → 초기 유동성(발행자→PG) → PG간 결제 → 잔액 리포트
 * - 안전을 위해 Testnet 전용, 실제 운영에선 키보관·규제·회계 절차 필수
 *
 * 실행 전 준비:
 * 1) `npm i xrpl dotenv`
 * 2) .env 파일에 아래 시크릿 채우기
 * 3) `ts-node XRPL_PoC_Toss_PayPay.ts` 혹은 빌드 후 `node dist/...`
 */

import 'dotenv/config'
import { Client, TxResponse, Wallet } from 'xrpl'

// ======== 설정값 ========
const WS_ENDPOINT = 'wss://s.devnet.rippletest.net:51233' // XRPL Testnet
const CURRENCY = 'JPY'                                     // 발행 통화코드(3~40자), 파일럿은 3글자 권장

// 테스트 금액(자유 조정)
const TRUST_LIMIT = '1000000'  // 각 PG가 신뢰할 한도 (예: 1,000,000 JPY)
const SEED_ISSUE_TO_TOSS = '500000' // Issuer → TOSS 초기 유동성
const SEED_ISSUE_TO_PAYP = '300000' // Issuer → PAYPAY 초기 유동성
const PAYMENT_AMOUNT = '12500'      // TOSS → PAYPAY 결제 금액

// ======== 유틸 ========
function env(name: string): string {
    const v = process.env[name]
    if (!v) throw new Error(`Missing env: ${name}`)
    return v
}

function nowIso(): string {
    return new Date().toISOString()
}

function banner(label: string) {
    console.log(`\n=== ${label} @ ${nowIso()} ===`)
}

function durationMs(start: number): string {
    return `${Date.now() - start}ms`
}

function summarizeTxResponse(resp: any) {
    const r: any = resp && (resp as any).result ? (resp as any).result : resp
    const hash = r?.hash || r?.tx_json?.hash
    const engineResult = r?.engine_result || r?.meta?.TransactionResult
    const engineResultCode = r?.engine_result_code
    const engineResultMessage = r?.engine_result_message
    const validated = r?.validated
    const ledgerIndex = r?.ledger_index || r?.ledger_current_index || r?.tx_json?.ledger_index
    return { hash, engineResult, engineResultCode, engineResultMessage, validated, ledgerIndex }
}

async function submitAndWait(client: Client, tx: any, wallet: Wallet) {
    banner(`TX ${tx.TransactionType} PREPARE`)
    const t0 = Date.now()
    const prepared = await client.autofill(tx)
    console.log('[prepared]', {
        TransactionType: prepared.TransactionType,
        Account: prepared.Account,
        Sequence: prepared.Sequence,
        Fee: prepared.Fee,
        LastLedgerSequence: prepared.LastLedgerSequence,
    })

    const signed = wallet.sign(prepared)
    console.log('[signed]', { hash: signed.hash })

    const result = await client.submitAndWait(signed.tx_blob)
    const summary = summarizeTxResponse(result)
    console.log('[result.summary]', { ...summary, elapsed: durationMs(t0) })

    if (summary.engineResult && summary.engineResult !== 'tesSUCCESS') {
        console.log('! Non-success engine_result. Full result follows:')
        console.log(JSON.stringify(result, null, 2))
    }

    return result as TxResponse
}

function fmtLine(line: any) {
    // account_lines 응답에서 잔액·한도 포맷 간단 정리
    const bal = line.balance
    const limit = line.limit
    const issuer = line.account || line.account_frozen || line.limit_peer || line.issuer
    return `${line.currency}@${issuer}  balance=${bal} / limit=${limit}`
}

async function reportBalances(client: Client, label: string, address: string) {
    const acct = await client.request({ command: 'account_info', account: address, ledger_index: 'validated' })
    const xrpBalanceDrops = acct.result.account_data.Balance
    const xrp = Number(xrpBalanceDrops) / 1_000_000

    const lines = await client.request({ command: 'account_lines', account: address })
    console.log(`\n[${label}] ${address}`)
    console.log(`- XRP: ${xrp} XRP`)
    if (lines.result.lines.length === 0) {
        console.log('- IOU lines: (none)')
    } else {
        console.log(`- IOU lines: ${lines.result.lines.length}`)
        for (const l of lines.result.lines) {
            console.log('  -', fmtLine(l))
        }
    }
}

async function ensureTrustLine(client: Client, holder: Wallet, issuerAddress: string, currency: string, limit: string) {
    // 이미 동일 통화·발행자 라인이 존재하면 스킵
    const lines = await client.request({ command: 'account_lines', account: holder.classicAddress })
    const exists = lines.result.lines.find((l: any) => l.currency === currency && (l.account === issuerAddress || l.issuer === issuerAddress))
    if (exists) {
        console.log(`TrustLine already exists for ${currency}@${issuerAddress} on ${holder.classicAddress}`)
        return
    }
    console.log(`Creating TrustLine ${currency}@${issuerAddress} (limit=${limit}) for ${holder.classicAddress}`)
    await submitAndWait(client, {
        TransactionType: 'TrustSet',
        Account: holder.classicAddress,
        LimitAmount: {
            currency,
            issuer: issuerAddress,
            value: limit,
        },
    }, holder)
}

async function sendIOU(client: Client, from: Wallet, toAddress: string, issuerAddress: string, currency: string, value: string) {
    console.log(`Payment IOU ${value} ${currency} (${issuerAddress})  from ${from.classicAddress} → ${toAddress}`)
    await submitAndWait(client, {
        TransactionType: 'Payment',
        Account: from.classicAddress,
        Destination: toAddress,
        Amount: { currency, issuer: issuerAddress, value },
    }, from)
}

async function main() {
    const client = new Client(WS_ENDPOINT)
    banner('CONNECT')
    await client.connect()
    console.log('Connected:', WS_ENDPOINT)

    // 지갑 로드(테스트넷)
    const ISSUER = Wallet.fromSeed(env('ISSUER_SEED'))
    const TOSS_KR = Wallet.fromSeed(env('TOSS_KR_SEED'))
    const PAYPAY_JP = Wallet.fromSeed(env('PAYPAY_JP_SEED'))

    console.log('Issuer:', ISSUER.classicAddress)
    console.log('TOSS_KR:', TOSS_KR.classicAddress)
    console.log('PAYPAY_JP:', PAYPAY_JP.classicAddress)

    // 리포트(초기)
    banner('INIT BALANCES')
    await reportBalances(client, 'INIT/ISSUER', ISSUER.classicAddress)
    await reportBalances(client, 'INIT/TOSS_KR', TOSS_KR.classicAddress)
    await reportBalances(client, 'INIT/PAYPAY_JP', PAYPAY_JP.classicAddress)

    // 1) TrustLine 개설 (두 PG 모두 Issuer의 JPY 수취 허용)
    banner('TRUSTLINE SETUP')
    await ensureTrustLine(client, TOSS_KR, ISSUER.classicAddress, CURRENCY, TRUST_LIMIT)
    await ensureTrustLine(client, PAYPAY_JP, ISSUER.classicAddress, CURRENCY, TRUST_LIMIT)

    // 2) 초기 유동성 (Issuer → PG들)
    banner('SEED LIQUIDITY')
    await sendIOU(client, ISSUER, TOSS_KR.classicAddress, ISSUER.classicAddress, CURRENCY, SEED_ISSUE_TO_TOSS)
    await sendIOU(client, ISSUER, PAYPAY_JP.classicAddress, ISSUER.classicAddress, CURRENCY, SEED_ISSUE_TO_PAYP)

    await reportBalances(client, 'AFTER_SEED/TOSS_KR', TOSS_KR.classicAddress)
    await reportBalances(client, 'AFTER_SEED/PAYPAY_JP', PAYPAY_JP.classicAddress)

    // 3) 결제 (TOSS_KR → PAYPAY_JP)
    banner('PAYMENT TOSS_KR → PAYPAY_JP')
    await sendIOU(client, TOSS_KR, PAYPAY_JP.classicAddress, ISSUER.classicAddress, CURRENCY, PAYMENT_AMOUNT)

    // 4) 잔액 리포트
    banner('FINAL BALANCES')
    await reportBalances(client, 'FINAL/TOSS_KR', TOSS_KR.classicAddress)
    await reportBalances(client, 'FINAL/PAYPAY_JP', PAYPAY_JP.classicAddress)

    // 5) (옵션) 일일 순액 보고서는 account_tx/ledger 분석으로 CSV 생성 가능. PoC에선 생략.

    banner('DISCONNECT')
    await client.disconnect()
    console.log('Disconnected')
}

main().catch(e => {
    console.error(e)
    process.exit(1)
})
