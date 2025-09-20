import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card"
import { Button } from "./components/ui/button"
import { Input } from "./components/ui/input"
import { Label } from "./components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs"
import { Badge } from "./components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "./components/ui/alert"
import { Loader2, ShieldAlert, Wallet, Send, Cable, RefreshCcw, DatabaseZap } from "lucide-react"
import { motion } from "framer-motion"
import { Client, Wallet as XWallet, isValidClassicAddress } from "xrpl"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

/**
 * XRPL PoC Dashboard (Toss ↔ PayPay)
 * - Testnet 전용 PoC 대시보드. 운영키/메인넷 금지!
 * - 기능: 연결, 잔액 조회, TrustLine 생성, 초기 유동성 전송, 결제 전송(서명 필요)
 */

const WS_DEFAULT = "wss://s.devnet.rippletest.net:51233"

function useXRPL() {
    const [endpoint, setEndpoint] = useState(WS_DEFAULT)
    const [client, setClient] = useState<Client | null>(null)
    const [connecting, setConnecting] = useState(false)
    const [connected, setConnected] = useState(false)
    const [networkInfo, setNetworkInfo] = useState<any>(null)

    const connect = async () => {
        if (client) return
        setConnecting(true)
        try {
            const c = new Client(endpoint)
            await c.connect()
            setClient(c)
            setConnected(true)
            const info = await c.request({ command: "server_info" })
            setNetworkInfo(info.result)
        } finally {
            setConnecting(false)
        }
    }

    const disconnect = async () => {
        try {
            await client?.disconnect()
        } finally {
            setClient(null)
            setConnected(false)
        }
    }

    return { endpoint, setEndpoint, client, connecting, connected, connect, disconnect, networkInfo }
}

type AddrForm = {
    issuer: string
    toss: string
    paypay: string
}

const SAMPLE: AddrForm = {
    issuer: "rL6UxaJR8WkyYmDzBtDP14t9vhCpLDyTDe",
    toss: "r3w8TK3M6tja6qXRJhZDhfsfhfRCK7s2MZ",
    paypay: "r3jF6kpULQUJwZsTTNzboZTr2zPRpNtQrU",
}

// XRPL 주소 유효성 검증 함수
const isValidXRPLAddress = (address: string): boolean => {
    if (!address || typeof address !== 'string') return false
    return isValidClassicAddress(address)
}

function useBalances(client: Client | null, addresses: AddrForm) {
    const [loading, setLoading] = useState(false)
    const [xrp, setXrp] = useState<Record<string, number>>({})
    const [lines, setLines] = useState<Record<string, any[]>>({})
    const [history, setHistory] = useState<{ t: string; label: string; xrp: number }[]>([])
    const [errors, setErrors] = useState<Record<string, string>>({})

    const fetchAll = async () => {
        if (!client) return
        setLoading(true)
        setErrors({})
        try {
            const outXrp: Record<string, number> = {}
            const outLines: Record<string, any[]> = {}
            const newErrors: Record<string, string> = {}

            for (const [label, acct] of Object.entries({ ISSUER: addresses.issuer, TOSS: addresses.toss, PAYPAY: addresses.paypay })) {
                // 빈 주소 건너뛰기
                if (!acct || acct.trim() === '') {
                    outXrp[label] = 0
                    outLines[label] = []
                    continue
                }

                // 주소 유효성 검증
                if (!isValidXRPLAddress(acct)) {
                    newErrors[label] = `잘못된 XRPL 주소 형식: ${acct}`
                    outXrp[label] = 0
                    outLines[label] = []
                    continue
                }

                try {
                    const info = await client.request({ command: "account_info", account: acct, ledger_index: "validated" })
                    const balDrops = Number(info.result.account_data.Balance || 0)
                    outXrp[label] = balDrops / 1_000_000
                } catch (e: any) {
                    // Account not found 또는 기타 에러 시 0으로 설정
                    console.warn(`${label} (${acct}) 계정 정보 조회 실패:`, e?.message || e)
                    if (e?.data?.error === 'actNotFound') {
                        newErrors[label] = `계정을 찾을 수 없음 (미활성화 상태일 수 있음)`
                    } else {
                        newErrors[label] = `조회 실패: ${e?.message || '알 수 없는 오류'}`
                    }
                    outXrp[label] = 0
                }

                try {
                    const ls = await client.request({ command: "account_lines", account: acct })
                    outLines[label] = ls.result.lines || []
                } catch (e) {
                    outLines[label] = []
                }
            }
            setXrp(outXrp)
            setLines(outLines)
            setErrors(newErrors)
            const t = new Date().toLocaleTimeString()
            setHistory((h) => [
                ...h.slice(-19),
                { t, label: "TOSS", xrp: outXrp.TOSS || 0 },
            ])
        } finally {
            setLoading(false)
        }
    }

    return { loading, xrp, lines, fetchAll, history, errors }
}

function Field({ id, label, value, onChange, placeholder }: any) {
    return (
        <div className="space-y-1">
            <Label htmlFor={id}>{label}</Label>
            <Input id={id} value={value} onChange={(e: any) => onChange(e.target.value)} placeholder={placeholder} className="font-mono" />
        </div>
    )
}

function KeyField({ id, label, value, onChange, placeholder }: any) {
    return (
        <div className="space-y-1">
            <Label htmlFor={id}>{label}</Label>
            <Input id={id} type="password" value={value} onChange={(e: any) => onChange(e.target.value)} placeholder={placeholder} className="font-mono" />
        </div>
    )
}

export default function XRPLPocDashboard() {
    const xrplc = useXRPL()
    const [addr, setAddr] = useState<AddrForm>(SAMPLE)
    const [currency, setCurrency] = useState("JPY")
    const [limit, setLimit] = useState("1000000")
    const [seedIssuer, setSeedIssuer] = useState("")
    const [seedToss, setSeedToss] = useState("")
    const [seedPaypay, setSeedPaypay] = useState("")
    const [seedToToss, setSeedToToss] = useState("500000")
    const [seedToPaypay, setSeedToPaypay] = useState("300000")
    const [payAmt, setPayAmt] = useState("12500")
    const [log, setLog] = useState<string>("")

    const append = (s: string) => setLog((L) => `${L}${s}\n`)

    const { loading, xrp, lines, fetchAll, history, errors } = useBalances(xrplc.client, addr)

    const lineText = (l: any) => `${l.currency}@${l.account || l.issuer}  bal=${l.balance}  limit=${l.limit}`

    const run = async (fn: () => Promise<any>, label: string) => {
        append(`▶ ${label} ...`)
        try {
            const r = await fn()
            append(`✅ ${label} OK`)
            return r
        } catch (e: any) {
            append(`❌ ${label} ERROR: ${e?.message || e}`)
            throw e
        }
    }

    const ensureTrust = async (holderSeed: string, holderAddr: string) => {
        if (!xrplc.client) throw new Error("Not connected")
        if (!holderSeed) throw new Error("Seed required (testnet only)")
        const holder = XWallet.fromSeed(holderSeed)
        if (holder.classicAddress !== holderAddr) {
            throw new Error("Seed/account mismatch. Check address vs seed.")
        }
        const lines = await xrplc.client.request({ command: "account_lines", account: holder.classicAddress })
        const exists = lines.result.lines.find((l: any) => l.currency === currency && (l.account === addr.issuer || l.issuer === addr.issuer))
        if (exists) return
        await xrplc.client.submitAndWait({
            TransactionType: "TrustSet",
            Account: holder.classicAddress,
            LimitAmount: { currency, issuer: addr.issuer, value: limit },
        }, { wallet: holder })
    }

    const sendIOU = async (fromSeed: string, fromAddr: string, toAddr: string, value: string) => {
        if (!xrplc.client) throw new Error("Not connected")
        if (!fromSeed) throw new Error("Seed required (testnet only)")
        const w = XWallet.fromSeed(fromSeed)
        if (w.classicAddress !== fromAddr) throw new Error("Seed/account mismatch")
        await xrplc.client.submitAndWait({
            TransactionType: "Payment",
            Account: w.classicAddress,
            Destination: toAddr,
            Amount: { currency, issuer: addr.issuer, value },
        }, { wallet: w })
    }

    const handleCreateTrustlines = async () => {
        await run(() => ensureTrust(seedToss, addr.toss), `Create TrustLine: TOSS ← ${currency}@ISSUER`)
        await run(() => ensureTrust(seedPaypay, addr.paypay), `Create TrustLine: PAYPAY ← ${currency}@ISSUER`)
        await fetchAll()
    }

    const handleSeedLiquidity = async () => {
        if (!seedIssuer) throw new Error("Issuer seed required")
        await run(() => sendIOU(seedIssuer, addr.issuer, addr.toss, seedToToss), `Seed Liquidity ISSUER→TOSS ${seedToToss} ${currency}`)
        await run(() => sendIOU(seedIssuer, addr.issuer, addr.paypay, seedToPaypay), `Seed Liquidity ISSUER→PAYPAY ${seedToPaypay} ${currency}`)
        await fetchAll()
    }

    const handlePay = async () => {
        await run(() => sendIOU(seedToss, addr.toss, addr.paypay, payAmt), `Payment TOSS→PAYPAY ${payAmt} ${currency}`)
        await fetchAll()
    }

    useEffect(() => {
        // auto-fetch balances after connect or address change
        if (xrplc.connected) {
            fetchAll()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [xrplc.connected, addr.issuer, addr.toss, addr.paypay])

    return (
        <div className="min-h-screen bg-neutral-50 p-6">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-6xl space-y-6">
                <header className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">XRPL PoC Dashboard — Toss ↔ PayPay</h1>
                        <p className="text-sm text-neutral-500">Testnet 전용. 실 키/메인넷 금지. Seeds는 브라우저 메모리에만 일시 저장됩니다.</p>
                    </div>
                    <Badge variant={xrplc.connected ? "default" : "secondary"} className="flex items-center gap-1">
                        <Cable className="h-4 w-4" /> {xrplc.connected ? "Connected" : "Disconnected"}
                    </Badge>
                </header>

                <Alert>
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>보안 경고</AlertTitle>
                    <AlertDescription>
                        이 화면은 데모/학습용입니다. <b>메인넷 키 절대 입력 금지</b>. Testnet 전용 시드만 사용하세요. 상용 환경에서는 서버 사이드 서명 또는 HSM을 사용해 키를 보호해야 합니다.
                    </AlertDescription>
                </Alert>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Cable className="h-5 w-5" /> 네트워크 연결</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Field id="ws" label="WebSocket Endpoint" value={xrplc.endpoint} onChange={xrplc.setEndpoint} placeholder={WS_DEFAULT} />
                            <div className="flex items-end gap-2">
                                {!xrplc.connected ? (
                                    <Button onClick={xrplc.connect} disabled={xrplc.connecting}>
                                        {xrplc.connecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Connect
                                    </Button>
                                ) : (
                                    <Button variant="secondary" onClick={xrplc.disconnect}>Disconnect</Button>
                                )}
                                <Button variant="outline" onClick={fetchAll} disabled={!xrplc.connected || loading}>
                                    <RefreshCcw className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="text-sm text-neutral-600 flex items-end">{xrplc.networkInfo ? `Ledger: ${xrplc.networkInfo.info?.validated_ledger?.seq}` : ""}</div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5" /> 주소 / 파라미터</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Field id="issuer" label="Issuer Address" value={addr.issuer} onChange={(v: string) => setAddr({ ...addr, issuer: v })} placeholder="r..." />
                            <Field id="toss" label="TOSS Address" value={addr.toss} onChange={(v: string) => setAddr({ ...addr, toss: v })} placeholder="r..." />
                            <Field id="paypay" label="PAYPAY Address" value={addr.paypay} onChange={(v: string) => setAddr({ ...addr, paypay: v })} placeholder="r..." />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <Field id="currency" label="IOU Currency" value={currency} onChange={setCurrency} placeholder="JPY" />
                            <Field id="limit" label="Trust Limit" value={limit} onChange={setLimit} placeholder="1000000" />
                            <Field id="seedToToss" label="Seed Liquidity to TOSS" value={seedToToss} onChange={setSeedToToss} placeholder="500000" />
                            <Field id="seedToPaypay" label="Seed Liquidity to PAYPAY" value={seedToPaypay} onChange={setSeedToPaypay} placeholder="300000" />
                        </div>
                    </CardContent>
                </Card>

                <Tabs defaultValue="balances">
                    <TabsList>
                        <TabsTrigger value="balances">Balances</TabsTrigger>
                        <TabsTrigger value="trust">TrustLines & Seed</TabsTrigger>
                        <TabsTrigger value="payment">Payment</TabsTrigger>
                        <TabsTrigger value="logs">Logs</TabsTrigger>
                    </TabsList>

                    <TabsContent value="balances" className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {(["ISSUER", "TOSS", "PAYPAY"] as const).map((k) => (
                                <Card key={k} className={errors[k] ? "border-red-200" : ""}>
                                    <CardHeader>
                                        <CardTitle className="text-sm">{k} — XRP</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {errors[k] ? (
                                            <div className="space-y-2">
                                                <div className="text-2xl font-semibold text-red-500">오류</div>
                                                <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                                                    {errors[k]}
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    <div className="text-2xl font-semibold">{xrp[k] ?? "-"} XRP</div>
                                                    {xrp[k] === 0 && (
                                                        <Badge variant="secondary" className="text-xs">
                                                            미활성화
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="mt-3 text-sm text-neutral-500">IOU Lines</div>
                                                <div className="mt-1 space-y-1 text-xs font-mono">
                                                    {(lines[k] || []).length === 0 ? <div className="text-neutral-400">(none)</div> : (lines[k] || []).map((l, i) => (
                                                        <div key={i}>{lineText(l)}</div>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm flex items-center gap-2"><DatabaseZap className="h-4 w-4" /> TOSS XRP Balance Trend (sample)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-56">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={history}>
                                            <defs>
                                                <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopOpacity={0.4} />
                                                    <stop offset="95%" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="t" hide />
                                            <YAxis allowDecimals={false} />
                                            <Tooltip />
                                            <Area type="monotone" dataKey="xrp" strokeWidth={2} fillOpacity={1} fill="url(#g)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>

                        {Object.values(xrp).some(v => v === 0) && (
                            <Alert>
                                <ShieldAlert className="h-4 w-4" />
                                <AlertTitle>계정 활성화 필요</AlertTitle>
                                <AlertDescription>
                                    일부 계정이 아직 활성화되지 않았습니다. XRPL 계정을 활성화하려면 최소 10 XRP를 해당 주소로 전송해야 합니다.
                                    테스트넷의 경우 <a href="https://xrpl.org/xrp-testnet-faucet.html" target="_blank" rel="noopener noreferrer" className="underline">테스트넷 Faucet</a>을 사용하세요.
                                </AlertDescription>
                            </Alert>
                        )}

                        <div className="flex justify-end">
                            <Button variant="outline" onClick={fetchAll} disabled={!xrplc.connected || loading}>
                                <RefreshCcw className="h-4 w-4 mr-2" /> Refresh Balances
                            </Button>
                        </div>
                    </TabsContent>

                    <TabsContent value="trust" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm">Seeds (Testnet only)</CardTitle>
                            </CardHeader>
                            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <KeyField id="seedIssuer" label="ISSUER Seed" value={seedIssuer} onChange={setSeedIssuer} placeholder="s... (testnet)" />
                                <KeyField id="seedToss" label="TOSS Seed" value={seedToss} onChange={setSeedToss} placeholder="s... (testnet)" />
                                <KeyField id="seedPaypay" label="PAYPAY Seed" value={seedPaypay} onChange={setSeedPaypay} placeholder="s... (testnet)" />
                            </CardContent>
                        </Card>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm">Create TrustLines</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="text-sm text-neutral-600">각 PG 계정에 {currency}@ISSUER TrustLine을 개설합니다.</div>
                                    <Button onClick={handleCreateTrustlines} disabled={!xrplc.connected}>
                                        Create TrustLines
                                    </Button>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm">Seed Liquidity (Issuer → PGs)</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Field id="seedToTossV" label="→ TOSS Amount" value={seedToToss} onChange={setSeedToToss} placeholder="500000" />
                                        <Field id="seedToPayV" label="→ PAYPAY Amount" value={seedToPaypay} onChange={setSeedToPaypay} placeholder="300000" />
                                    </div>
                                    <Button onClick={handleSeedLiquidity} disabled={!xrplc.connected}>
                                        Seed Liquidity
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="payment" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm flex items-center gap-2"><Send className="h-4 w-4" /> TOSS → PAYPAY Payment</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <Field id="payAmt" label={`Amount (${currency})`} value={payAmt} onChange={setPayAmt} placeholder="12500" />
                                    <div className="flex items-end">
                                        <Button onClick={handlePay} disabled={!xrplc.connected}>Send Payment</Button>
                                    </div>
                                </div>
                                <div className="text-xs text-neutral-500">서명은 로컬에서 테스트넷 시드로 수행됩니다.</div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="logs">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm">Activity Logs</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <pre className="h-64 overflow-auto rounded bg-neutral-950 text-neutral-100 p-3 text-xs whitespace-pre-wrap">{log || "(no logs)"}</pre>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </motion.div>
        </div>
    )
}
