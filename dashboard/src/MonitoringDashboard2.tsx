import React, { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card"
import { Badge } from "./components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "./components/ui/alert"
import { Separator } from "./components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./components/ui/table"
import { Button } from "./components/ui/button"
import { TrendingUp, Users, CreditCard, CheckCircle, XCircle, Clock, Wallet, Filter } from "lucide-react"
import type { DashboardData, PaymentRecord, PartnerStats } from "./lib/xrplService"
import { TOSS_WALLET_SYSTEM, fetchXrplPayments } from "./lib/xrplService"

// NOTE: 라이브 XRPL 연동을 쓰려면 아래 주석 해제 후 `npm i xrpl`
// import xrpl from "xrpl"

/**
 * TOSS 결제 모니터링 대시보드 (리팩토링)
 * -------------------------------------
 * - 기본 뷰: TOSS(메인 월렛) 기준, PayPay와의 거래 중심으로 표시
 * - 파트너/카테고리 필터 + 방향(수신/발신/전체) 필터
 * - LIVE_MODE 토글: 더미데이터 ↔ XRPL Devnet 실시간
 */

// XRPL 연결 주소는 xrplService에서 관리합니다

// 시스템 월렛 및 파트너 정의는 xrplService의 TOSS_WALLET_SYSTEM 사용

// 타입은 xrplService에서 import

const categories = ["전체", "디지털결제", "편의점", "은행", "이커머스"] as const

type Direction = "all" | "incoming" | "outgoing"

// === 유틸 ===
const trunc = (s: string, n = 8) => (s?.length > 2 * n ? `${s.slice(0, n)}…${s.slice(-n)}` : s)
// 시간 변환 유틸 불필요 (xrplService에서 처리)

// === 더미 데이터 ===
function generateMockData(selectedPartners: string[] = []): DashboardData {
    const allPartnerKeys = Object.keys(TOSS_WALLET_SYSTEM.partners)
    const partnersToGenerate = selectedPartners.length > 0 ? selectedPartners : allPartnerKeys
    const payments: PaymentRecord[] = []

    for (let i = 0; i < 200; i++) {
        const partnerKey = partnersToGenerate[Math.floor(Math.random() * partnersToGenerate.length)] as keyof typeof TOSS_WALLET_SYSTEM.partners
        const partner = TOSS_WALLET_SYSTEM.partners[partnerKey]
        const isSuccess = Math.random() > 0.03 // 97% 성공률
        const amount = Math.floor(Math.random() * 100000) + 500
        const hoursAgo = Math.floor(Math.random() * 24)
        const timestamp = new Date(Date.now() - hoursAgo * 60 * 60 * 1000)
        const isIncoming = Math.random() > 0.3 // 70% 수신

        payments.push({
            id: `tx_${i}`,
            timestamp: timestamp.toISOString(),
            from: isIncoming ? partner.address : TOSS_WALLET_SYSTEM.tossMain,
            to: isIncoming ? TOSS_WALLET_SYSTEM.tossMain : partner.address,
            amount,
            currency: "JPY",
            status: isSuccess ? "success" : Math.random() > 0.7 ? "failed" : "pending",
            partner: partner.name,
            txHash: `0x${Math.random().toString(16).slice(2, 18)}...`,
        })
    }

    const stats: PartnerStats[] = partnersToGenerate.map((k) => {
        const partner = TOSS_WALLET_SYSTEM.partners[k as keyof typeof TOSS_WALLET_SYSTEM.partners]
        const partnerPayments = payments.filter((p) => p.partner === partner.name)
        const successful = partnerPayments.filter((p) => p.status === "success")
        const totalAmount = successful.reduce((sum, p) => sum + p.amount, 0)

        return {
            partner: partner.name,
            totalTransactions: partnerPayments.length,
            successfulTransactions: successful.length,
            totalAmount,
            avgAmount: successful.length > 0 ? Math.floor(totalAmount / successful.length) : 0,
            successRate: partnerPayments.length > 0 ? (successful.length / partnerPayments.length) * 100 : 0,
        }
    })

    return { payments: payments.sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp)), stats }
}

// 라이브 조회는 xrplService.fetchXrplPayments 사용

// === 메인 컴포넌트 ===
const LIVE_MODE = (import.meta.env.VITE_LIVE_MODE ?? "true") === "true" // true: XRPL 라이브, false: 더미 데이터

export default function MonitoringDashboard() {
    const [data, setData] = useState<DashboardData>({ payments: [], stats: [] })
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
    const [selectedPartners, setSelectedPartners] = useState<string[]>(["PayPay"]) // 기본 PayPay
    const [selectedCategory, setSelectedCategory] = useState<string>("디지털결제")
    const [direction, setDirection] = useState<Direction>("all")

    // 카테고리에 따른 파트너 키 배열
    const getPartnersByCategory = (category: string) => {
        if (category === "전체") return Object.keys(TOSS_WALLET_SYSTEM.partners)
        return Object.keys(TOSS_WALLET_SYSTEM.partners).filter(
            (key) => TOSS_WALLET_SYSTEM.partners[key as keyof typeof TOSS_WALLET_SYSTEM.partners].category === category
        )
    }

    const togglePartner = (partnerKey: string) => {
        setSelectedPartners((prev) => (prev.includes(partnerKey) ? prev.filter((p) => p !== partnerKey) : [...prev, partnerKey]))
    }

    const handleCategoryChange = (category: string) => {
        setSelectedCategory(category)
        setSelectedPartners(getPartnersByCategory(category))
    }

    // 데이터 갱신
    useEffect(() => {
        let stop = false
        const updateData = async () => {
            if (stop) return
            try {
                if (LIVE_MODE) {
                    const live = await fetchXrplPayments(selectedPartners)
                    setData(live)
                    // (샘플 실행 편의를 위해 라이브 호출은 주석 처리)
                    // setData(generateMockData(selectedPartners))
                } else {
                    setData(generateMockData(selectedPartners))
                }
            } finally {
                setLastUpdated(new Date())
            }
        }

        updateData()
        const interval = setInterval(updateData, 30_000)
        return () => {
            stop = true
            clearInterval(interval)
        }
    }, [selectedPartners])

    // 방향 필터 도우미
    const isIncoming = (p: PaymentRecord) => p.to === TOSS_WALLET_SYSTEM.tossMain
    const isOutgoing = (p: PaymentRecord) => p.from === TOSS_WALLET_SYSTEM.tossMain

    // 파트너/방향 필터가 적용된 결제 목록
    const filteredPayments = useMemo(() => {
        const selectedKeys = selectedPartners.length ? selectedPartners : Object.keys(TOSS_WALLET_SYSTEM.partners)

        const includesSelectedPartner = (partnerDisplayName: string) => {
            const foundKey = Object.entries(TOSS_WALLET_SYSTEM.partners).find(([, v]) => v.name === partnerDisplayName)?.[0]
            return foundKey ? selectedKeys.includes(foundKey) : false
        }

        return data.payments
            .filter((p) => selectedKeys.length === 0 || includesSelectedPartner(p.partner))
            .filter((p) => (direction === "all" ? true : direction === "incoming" ? isIncoming(p) : isOutgoing(p)))
    }, [data.payments, selectedPartners, direction])

    // KPI는 현재 필터 결과 기반으로 표시
    const totalStats = useMemo(() => {
        const success = filteredPayments.filter((p) => p.status === "success").length
        const failed = filteredPayments.filter((p) => p.status === "failed").length
        const pending = filteredPayments.filter((p) => p.status === "pending").length
        const volume = filteredPayments.filter((p) => p.status === "success").reduce((sum, p) => sum + p.amount, 0)

        return {
            totalTransactions: filteredPayments.length,
            successfulTransactions: success,
            failedTransactions: failed,
            pendingTransactions: pending,
            totalVolume: volume,
            overallSuccessRate: filteredPayments.length ? (success / filteredPayments.length) * 100 : 0,
        }
    }, [filteredPayments])

    // 파트너별 카드: 현재 선택 파트너만 표시 (데이터는 generateMockData가 선택에 맞춰 생성)
    const partnerCards = useMemo(() => {
        const selectedKeys = selectedPartners.length ? selectedPartners : Object.keys(TOSS_WALLET_SYSTEM.partners)
        const selectedNames = new Set<string>(
            selectedKeys.map((k) => TOSS_WALLET_SYSTEM.partners[k as keyof typeof TOSS_WALLET_SYSTEM.partners].name)
        )
        return data.stats.filter((s) => selectedNames.has(s.partner))
    }, [data.stats, selectedPartners])

    return (
        <div className="min-h-screen bg-neutral-50">
            {/* Topbar */}
            <div className="border-b bg-white">
                <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">토스</div>
                        <div className="font-medium">TOSS 결제 모니터링 대시보드</div>
                        <Badge variant="secondary" className="ml-2">{LIVE_MODE ? "실시간(Devnet)" : "실시간(모의)"}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-neutral-600">
                        <Clock className="h-4 w-4" /> 마지막 업데이트: {lastUpdated.toLocaleTimeString()}
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="mx-auto max-w-7xl px-6 py-6 space-y-6">
                <Alert>
                    <Wallet className="h-4 w-4" />
                    <AlertTitle>TOSS 메인월렛 모니터링</AlertTitle>
                    <AlertDescription>
                        TOSS 메인월렛과 거래 파트너들 간의 XRPL 결제 현황을 실시간으로 모니터링합니다. (기본 파트너: PayPay)
                    </AlertDescription>
                </Alert>

                {/* 거래 파트너 선택 섹션 */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Filter className="h-5 w-5" /> 거래 파트너 선택
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* 카테고리 선택 */}
                        <div className="flex flex-wrap gap-2">
                            {categories.map((category) => (
                                <Button
                                    key={category}
                                    variant={selectedCategory === category ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => handleCategoryChange(category)}
                                    className="h-8"
                                >
                                    {category}
                                </Button>
                            ))}
                        </div>

                        {/* 파트너 선택 */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                            {Object.entries(TOSS_WALLET_SYSTEM.partners).map(([key, partner]) => (
                                <Button
                                    key={key}
                                    variant={selectedPartners.includes(key) ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => togglePartner(key)}
                                    className="h-16 flex-col gap-1 text-xs"
                                >
                                    <img src={partner.logo} alt={partner.name} width={20} height={20} />
                                    <span className="font-medium">{partner.name.split(" ")[0]}</span>
                                </Button>
                            ))}
                        </div>

                        <div className="text-sm text-neutral-600">
                            선택된 파트너: {selectedPartners.length === 0 ? "전체" : `${selectedPartners.length}개`}
                        </div>
                    </CardContent>
                </Card>

                {/* 전체 KPI (필터 적용 결과 기준) */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <KpiCard title="총 결제 건수" value={totalStats.totalTransactions.toLocaleString()} icon={<CreditCard className="h-5 w-5" />} trend="+12.5%" />
                    <KpiCard title="총 결제 금액 (통화혼합)" value={totalStats.totalVolume.toLocaleString()} icon={<TrendingUp className="h-5 w-5" />} trend="+8.3%" />
                    <KpiCard title="전체 성공률" value={`${totalStats.overallSuccessRate.toFixed(1)}%`} icon={<CheckCircle className="h-5 w-5" />} trend="+0.2%" />
                    <KpiCard title="실패 건수" value={totalStats.failedTransactions.toString()} icon={<XCircle className="h-5 w-5" />} trend="-5.1%" isNegative />
                </div>

                {/* 파트너별 통계 카드 */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" /> 선택된 파트너별 결제 통계
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {partnerCards.length === 0 ? (
                            <div className="text-center py-8 text-neutral-500">파트너를 선택해주세요</div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {partnerCards.map((stat) => {
                                    const partnerInfo = Object.values(TOSS_WALLET_SYSTEM.partners).find((p) => p.name === stat.partner)
                                    return (
                                        <div key={stat.partner} className="border rounded-lg p-4 space-y-3 bg-white">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <img src={partnerInfo?.logo} alt={partnerInfo?.name} width={20} height={20} />
                                                    <div>
                                                        <h3 className="font-semibold text-sm">{stat.partner}</h3>
                                                        <p className="text-xs text-neutral-500">{partnerInfo?.category}</p>
                                                    </div>
                                                </div>
                                                <Badge variant={stat.successRate > 95 ? "default" : "destructive"}>{stat.successRate.toFixed(1)}%</Badge>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 text-sm">
                                                <div>
                                                    <div className="text-neutral-600">총 거래</div>
                                                    <div className="font-semibold">{stat.totalTransactions.toLocaleString()}건</div>
                                                </div>
                                                <div>
                                                    <div className="text-neutral-600">성공</div>
                                                    <div className="font-semibold text-green-600">{stat.successfulTransactions.toLocaleString()}건</div>
                                                </div>
                                                <div>
                                                    <div className="text-neutral-600">총 금액</div>
                                                    <div className="font-semibold">{stat.totalAmount.toLocaleString()}</div>
                                                </div>
                                                <div>
                                                    <div className="text-neutral-600">평균 금액</div>
                                                    <div className="font-semibold">{stat.avgAmount.toLocaleString()}</div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* 방향 필터 */}
                <div className="flex gap-2">
                    <Button variant={direction === "all" ? "default" : "outline"} size="sm" onClick={() => setDirection("all")}>
                        전체
                    </Button>
                    <Button variant={direction === "incoming" ? "default" : "outline"} size="sm" onClick={() => setDirection("incoming")}>
                        수신 (TOSS ← 파트너)
                    </Button>
                    <Button variant={direction === "outgoing" ? "default" : "outline"} size="sm" onClick={() => setDirection("outgoing")}>
                        발신 (TOSS → 파트너)
                    </Button>
                </div>

                {/* 최근 결제 내역 */}
                <Card>
                    <CardHeader>
                        <CardTitle>최근 결제 내역 (최근 20건)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>시간</TableHead>
                                    <TableHead>파트너</TableHead>
                                    {/* <TableHead>From → To</TableHead> */}
                                    <TableHead className="text-right">금액</TableHead>
                                    <TableHead>통화</TableHead>
                                    <TableHead>상태</TableHead>
                                    <TableHead>Tx Hash</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredPayments.slice(0, 20).map((payment) => (
                                    <TableRow key={payment.id}>
                                        <TableCell className="text-xs text-neutral-600">{new Date(payment.timestamp).toLocaleString()}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{payment.partner}</Badge>
                                        </TableCell>
                                        {/* <TableCell className="font-mono text-xs">{trunc(payment.from)} → {trunc(payment.to)}</TableCell> */}
                                        <TableCell className="text-right font-medium">{payment.amount.toLocaleString()}</TableCell>
                                        <TableCell>{payment.currency}</TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={payment.status === "success" ? "default" : payment.status === "failed" ? "destructive" : "secondary"}
                                            >
                                                {payment.status === "success" ? "성공" : payment.status === "failed" ? "실패" : "대기중"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">{trunc(payment.txHash, 6)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* 상태 정보 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">모니터링 주소</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-xs">
                            <div>
                                <div className="text-neutral-600">TOSS 메인 지갑</div>
                                <div className="font-mono">{trunc(TOSS_WALLET_SYSTEM.tossMain)}</div>
                            </div>
                            <Separator />
                            <div className="space-y-2">
                                <div className="text-neutral-600">연결된 파트너 지갑</div>
                                {selectedPartners.length === 0 ? (
                                    <div className="text-neutral-400 italic">파트너를 선택해주세요</div>
                                ) : (
                                    selectedPartners.slice(0, 3).map((partnerKey) => {
                                        const partner = TOSS_WALLET_SYSTEM.partners[partnerKey as keyof typeof TOSS_WALLET_SYSTEM.partners]
                                        return (
                                            <div key={partnerKey}>
                                                <div className="text-neutral-600 flex items-center gap-2">
                                                    <img src={partner.logo} alt={partner.name} width={16} height={16} /> {partner.name}
                                                </div>
                                                <div className="font-mono">{trunc(partner.address)}</div>
                                            </div>
                                        )
                                    })
                                )}
                                {selectedPartners.length > 3 && (
                                    <div className="text-neutral-400 italic">및 {selectedPartners.length - 3}개 더...</div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">성공/실패 현황 (필터 적용)</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-green-600">성공</span>
                                <span className="font-semibold">{totalStats.successfulTransactions}건</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-red-600">실패</span>
                                <span className="font-semibold">{totalStats.failedTransactions}건</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-yellow-600">대기중</span>
                                <span className="font-semibold">{totalStats.pendingTransactions}건</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">TOSS 시스템 상태</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span>XRPL 네트워크</span>
                                <Badge variant="default">정상</Badge>
                            </div>
                            <div className="flex justify-between">
                                <span>TOSS 메인월렛</span>
                                <Badge variant="default">활성화</Badge>
                            </div>
                            <div className="flex justify-between">
                                <span>파트너 연결</span>
                                <Badge variant="default">{selectedPartners.length}개 연결</Badge>
                            </div>
                            <div className="flex justify-between">
                                <span>실시간 모니터링</span>
                                <Badge variant="default">정상</Badge>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}

function KpiCard({
    title,
    value,
    icon,
    trend,
    isNegative = false,
}: {
    title: string
    value: React.ReactNode
    icon?: React.ReactNode
    trend?: string
    isNegative?: boolean
}) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-neutral-600">{title}</CardTitle>
                {icon && <div className="text-neutral-400">{icon}</div>}
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                {trend && <p className={`text-xs ${isNegative ? "text-red-600" : "text-green-600"} mt-1`}>{trend} 지난 24시간 대비</p>}
            </CardContent>
        </Card>
    )
}
