import { Client, Wallet, Transaction } from "xrpl";
import * as dotenv from "dotenv";
dotenv.config();

async function createPermissionedOffer() {
    const client = new Client("wss://s.devnet.rippletest.net:51233");
    await client.connect();
    console.log("\n🔗 [5단계] 허가된 DEX 오퍼 생성 시작...");

    const pg_a_wallet = Wallet.fromSeed(process.env.PGA_SEED!);
    const user_a_wallet = Wallet.fromSeed(process.env.USER_A_SEED!);
    const domain_id = process.env.DOMAIN_ID!;

    // User A가 50 PGA를 50 XRP에 판매하는 오퍼 생성
    const offerTx: Transaction = {
        TransactionType: "OfferCreate",
        Account: user_a_wallet.address,
        TakerGets: "50000000", // 50 XRP (in drops)
        TakerPays: {
            issuer: pg_a_wallet.address,
            currency: "PGA",
            value: "50",
        },
        DomainID: domain_id, // 이 도메인에 속한 참여자만 거래 가능
    };

    const tx = await client.submitAndWait(offerTx, { wallet: user_a_wallet });
    console.log(`✅ User A가 허가된 도메인 내에서 거래 오퍼를 생성했습니다.`);
    console.log(`🔗 트랜잭션 해시: ${tx.result.hash}`);

    await client.disconnect();
    console.log("🔌 연결이 종료되었습니다.");
}

createPermissionedOffer();