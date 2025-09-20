import { Client, Wallet } from "xrpl";
import * as dotenv from "dotenv";
dotenv.config();

async function checkLedgerState() {
    const client = new Client("wss://s.devnet.rippletest.net:51233");
    await client.connect();
    console.log("\n🔗 [6단계] 최종 원장 상태 확인 시작...");

    // ... (이전 `5_checkBalances.ts`의 잔액 확인 코드)

    // 도메인 및 오퍼 정보 확인
    const domain_id = process.env.DOMAIN_ID!;
    const user_a_address = Wallet.fromSeed(process.env.USER_A_SEED!).address;

    const domainInfo = await client.request({ command: "ledger_entry", index: domain_id });
    console.log("\n--- Permissioned Domain 정보 ---");
    console.log(JSON.stringify(domainInfo.result.node, null, 2));

    const offers = await client.request({ command: "account_offers", account: user_a_address });
    console.log("\n--- User A의 거래 오퍼 정보 ---");
    console.log(offers.result.offers);

    await client.disconnect();
    console.log("🔌 연결이 종료되었습니다.");
}

checkLedgerState();