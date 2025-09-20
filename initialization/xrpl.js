import xrpl from "xrpl"
import dotenv from "dotenv"
dotenv.config({ path: path.join(process.cwd(), ".env") })
import path from "path"

const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233")
await client.connect()

const issuer = xrpl.Wallet.fromSeed(process.env.ISSUER_SEED)   // Issuer 시드(테스트넷)
const pgKR   = xrpl.Wallet.fromSeed(process.env.PG_KR_SEED)
const pgSG   = xrpl.Wallet.fromSeed(process.env.PG_SG_SEED)

// 1) TrustLine (PG_KR -> Issuer / USD)
await client.submitAndWait({
  "TransactionType": "TrustSet",
  "Account": pgKR.classicAddress,
  "LimitAmount": { currency: "USD", issuer: issuer.classicAddress, value: "100000" }
}, { wallet: pgKR })

// 2) (옵션) RequireAuth면 Issuer가 승인(AllowTrust 방식은 XRPL에선 TrustSet 승인/거절로 표현)
// 3) Issuer가 초기 유동성(에어드랍 개념) 전송
await client.submitAndWait({
  "TransactionType": "Payment",
  "Account": issuer.classicAddress,
  "Destination": pgKR.classicAddress,
  "Amount": { currency: "USD", issuer: issuer.classicAddress, value: "5000" }
}, { wallet: issuer })

// 4) PG_KR → PG_SG 결제
await client.submitAndWait({
  "TransactionType": "Payment",
  "Account": pgKR.classicAddress,
  "Destination": pgSG.classicAddress,
  "Amount": { currency: "USD", issuer: issuer.classicAddress, value: "1250.00" }
}, { wallet: pgKR })

await client.disconnect()
