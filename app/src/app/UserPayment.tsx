"use client"
import React, { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import Image from "next/image"
import { processPayment, PaymentRequest, PaymentResult, getWalletInfo, WalletInfo } from "@/lib/xrplPayment"

/**
 * Customer Checkout Screen (Mobile-first)
 * - 결제수단 그리드 선택
 * - 결제 금액 입력
 * - 토큰 선택(XRP / IOU)
 * - "Pay Now" CTA
 */

type PayMethod = {
    id: string
    label: string
    url?: string
    enabled?: boolean
}

const METHODS: PayMethod[] = [
    { id: "toss", label: "Toss", url: "/toss.png", enabled: true },
    { id: "paypay", label: "PayPay", url: "/paypay.png", enabled: true },
    { id: "paynow", label: "PayNow", enabled: false },
    { id: "linepay", label: "LINE Pay", enabled: false },
    { id: "alipay", label: "Alipay", enabled: false },
    { id: "paypal", label: "PayPal", enabled: false },
    { id: "jp_pay", label: "Pay", enabled: false },
    { id: "zero", label: "Zero", enabled: false },
    { id: "wechat", label: "WeChat", enabled: false },
    { id: "venmo", label: "Venmo", enabled: false },
    { id: "dpay", label: "d Pay", enabled: false },
    { id: "vnpay", label: "VNPay", enabled: false },
    { id: "momo", label: "MoMo", enabled: false },
    { id: "rakuten", label: "R Pay", enabled: false },
    { id: "zalopay", label: "ZaloPay", enabled: false },
    { id: "revolut", label: "Revolut", enabled: false },
]

const TOKENS = [
    { id: "XRP", label: "XRP (native)" },
    { id: "USD.IOU", label: "USD (IOU)" },
    { id: "JPY.IOU", label: "JPY (IOU)" },
    { id: "KRW.IOU", label: "KRW (IOU)" },
]

export default function PaymentCheckout({ onBack, onSubmit }: { onBack?: () => void; onSubmit?: (p: { method: string; amount: number; token: string }) => void }) {
    const [method, setMethod] = useState<string>("paypay")
    const [amount, setAmount] = useState<string>("10000")
    const [token, setToken] = useState<string>("XRP")
    const [busy, setBusy] = useState(false)
    const [locked, setLocked] = useState(false)
    const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null)
    const [userSeed, setUserSeed] = useState<string>("")
    const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null)
    const [checkingWallet, setCheckingWallet] = useState(false)

    const canPay = useMemo(() => {
        const val = Number(amount.replace(/[^0-9.]/g, ""))
        return !!method && !!token && val > 0 && !busy && !!userSeed.trim() && !locked
    }, [method, token, amount, busy, userSeed, locked])

    // 지갑 정보 확인 함수
    const checkWallet = async () => {
        if (!userSeed.trim()) return

        setCheckingWallet(true)
        try {
            const info = await getWalletInfo(userSeed.trim())
            setWalletInfo(info)
        } catch (error) {
            console.error('지갑 정보 확인 실패:', error)
            setWalletInfo(null)
        } finally {
            setCheckingWallet(false)
        }
    }

    // 지갑 시드가 변경될 때 지갑 정보 초기화
    const handleSeedChange = (value: string) => {
        setUserSeed(value)
        setWalletInfo(null)
        setPaymentResult(null)
    }

    const submit = async () => {
        if (!canPay) return
        setLocked(true)
        setBusy(true)
        setPaymentResult(null)

        try {
            const amt = Number(amount.replace(/[^0-9.]/g, ""))

            // XRPL 결제 요청 준비
            const paymentRequest: PaymentRequest = {
                method: method,
                amount: amt,
                token: token,
                senderSeed: userSeed.trim()
            }

            // XRPL 결제 실행
            const result = await processPayment(paymentRequest)
            setPaymentResult(result)

            // 기존 onSubmit 콜백도 호출
            onSubmit?.({ method, amount: amt, token })

        } catch (error) {
            setPaymentResult({
                success: false,
                error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
            })
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Enhanced Mobile Top Bar */}
            <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
                <div className="mx-auto max-w-sm px-5 py-4 flex items-center gap-4">
                    <button
                        aria-label="Back"
                        onClick={onBack}
                        className="p-2 -ml-3 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors touch-manipulation"
                    >
                        <ArrowLeft className="h-6 w-6 text-gray-700" />
                    </button>
                    <div className="text-lg font-semibold text-gray-900">결제하기</div>
                </div>
            </div>

            {/* Enhanced Body */}
            <div className="mx-auto max-w-sm px-5 py-6 space-y-8">
                {/* Enhanced Methods Grid */}
                <section className="space-y-4">
                    <h2 className="text-sm font-medium text-gray-700 mb-3">결제 수단 선택</h2>
                    <div className="grid grid-cols-4 gap-3">
                        {METHODS.map((m) => {
                            const active = method === m.id
                            const isEnabled = m.enabled !== false
                            return (
                                <button
                                    key={m.id}
                                    onClick={() => isEnabled && setMethod(m.id)}
                                    disabled={!isEnabled}
                                    className={[
                                        "relative aspect-square w-full rounded-xl border-2 flex items-center justify-center text-xs font-medium transition-all duration-200 touch-manipulation",
                                        !isEnabled
                                            ? "border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed opacity-50"
                                            : active
                                                ? "border-orange-500 bg-orange-50 ring-2 ring-orange-200 shadow-md active:scale-95"
                                                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 active:bg-gray-100 active:scale-95",
                                    ].join(" ")}
                                    style={{ minHeight: "64px" }}
                                >
                                    {m.url ? (
                                        <Image
                                            src={m.url}
                                            alt={m.label}
                                            width={24}
                                            height={24}
                                            className={[
                                                "w-8 h-8",
                                                !isEnabled ? "grayscale opacity-50" : ""
                                            ].join(" ")}
                                        />
                                    ) : (
                                        <span className={
                                            !isEnabled
                                                ? "text-gray-300 text-[10px] leading-tight"
                                                : active
                                                    ? "text-orange-700"
                                                    : "text-gray-500 text-[10px] leading-tight"
                                        }>
                                            {m.label}
                                        </span>
                                    )}
                                    {isEnabled && (m.id === 'toss' || m.id === 'paypay') && (
                                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                </section>

                {/* Enhanced Amount Input */}
                <section className="space-y-3">
                    <Label className="text-sm font-medium text-gray-700">결제 금액</Label>
                    <Input
                        inputMode="numeric"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="10,000"
                        className="h-14 text-lg font-medium rounded-xl border-gray-200 focus:border-orange-400 focus:ring-orange-200 bg-white"
                    />
                </section>

                {/* Enhanced Token Selection */}
                <section className="space-y-3">
                    <Label className="text-sm font-medium text-gray-700">결제 방법 선택</Label>
                    <Select value={token} onValueChange={setToken}>
                        <SelectTrigger className="h-14 text-lg rounded-xl border-gray-200 focus:border-orange-400 focus:ring-orange-200 bg-white">
                            <SelectValue placeholder="토큰을 선택하세요" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            {TOKENS.map((t) => (
                                <SelectItem key={t.id} value={t.id} className="text-base py-3">
                                    {t.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </section>

                {/* Wallet Seed Input */}
                <section className="space-y-3">
                    <Label className="text-sm font-medium text-gray-700">지갑 시드 (보안)</Label>
                    <div className="flex gap-2">
                        <Input
                            type="password"
                            value={userSeed}
                            onChange={(e) => handleSeedChange(e.target.value)}
                            placeholder="sEd... (XRPL 지갑 시드를 입력하세요)"
                            className="h-14 text-lg font-mono rounded-xl border-gray-200 focus:border-orange-400 focus:ring-orange-200 bg-white"
                        />
                        <Button
                            type="button"
                            onClick={checkWallet}
                            disabled={!userSeed.trim() || checkingWallet}
                            className="h-14 px-4 rounded-xl bg-blue-500 hover:bg-blue-600 text-white"
                        >
                            {checkingWallet ? '확인중...' : '지갑확인'}
                        </Button>
                    </div>

                    {/* 지갑 정보 표시 */}
                    {walletInfo && (
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                            <h4 className="text-sm font-semibold text-blue-800 mb-2">지갑 정보</h4>
                            <div className="space-y-1 text-xs text-blue-700">
                                <p><span className="font-medium">주소:</span> {walletInfo.address}</p>
                                <p><span className="font-medium">XRP 잔액:</span> {walletInfo.xrpBalance.toFixed(6)} XRP</p>
                                <p><span className="font-medium">예치금:</span> {walletInfo.reserve.toFixed(6)} XRP</p>
                                <p><span className="font-medium">사용 가능:</span> <span className={walletInfo.availableBalance > 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>{walletInfo.availableBalance.toFixed(6)} XRP</span></p>
                            </div>
                        </div>
                    )}

                    <p className="text-xs text-gray-500">
                        ⚠️ 데모용입니다. 실제 운영환경에서는 보안이 강화된 지갑 연동을 사용해야 합니다.
                    </p>
                </section>

                {/* Payment Result */}
                {paymentResult && (
                    <section className="space-y-3">
                        <div className={[
                            "p-4 rounded-xl border-2",
                            paymentResult.success
                                ? "bg-green-50 border-green-200"
                                : "bg-red-50 border-red-200"
                        ].join(" ")}>
                            <div className="flex items-center gap-3 mb-2">
                                {paymentResult.success ? (
                                    <CheckCircle className="h-6 w-6 text-green-600" />
                                ) : (
                                    <XCircle className="h-6 w-6 text-red-600" />
                                )}
                                <h3 className={[
                                    "font-semibold",
                                    paymentResult.success ? "text-green-800" : "text-red-800"
                                ].join(" ")}>
                                    {paymentResult.success ? "결제 성공!" : "결제 실패"}
                                </h3>
                            </div>

                            {paymentResult.success && paymentResult.txHash && (
                                <div className="space-y-2">
                                    <p className="text-sm text-green-700">
                                        트랜잭션이 성공적으로 처리되었습니다.
                                    </p>
                                    <p className="text-xs text-green-600 font-mono break-all">
                                        TX: {paymentResult.txHash}
                                    </p>
                                </div>
                            )}

                            {!paymentResult.success && paymentResult.error && (
                                <p className="text-sm text-red-700">
                                    {paymentResult.error}
                                </p>
                            )}
                        </div>
                    </section>
                )}

                {/* Enhanced Pay Button */}
                <div className="pt-4">
                    <Button
                        onClick={submit}
                        disabled={!canPay}
                        className={[
                            "w-full h-14 text-lg font-semibold rounded-xl transition-all duration-200 touch-manipulation active:scale-[0.98]",
                            canPay
                                ? "bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white shadow-lg"
                                : "bg-gray-300 text-gray-500 cursor-not-allowed"
                        ].join(" ")}
                    >
                        {busy ? (
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                XRPL 결제 처리중...
                            </div>
                        ) : (
                            "XRPL로 결제하기"
                        )}
                    </Button>
                </div>

                {/* Safe area for mobile devices */}
                <div className="h-8 md:h-4" />
            </div>
        </div>
    )
}
