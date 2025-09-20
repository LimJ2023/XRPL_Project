import { Client, Wallet, Transaction } from "xrpl";
import * as dotenv from "dotenv";
dotenv.config();

const toHex = (str: string) => Buffer.from(str).toString("hex");

async function acceptCredentials() {
    const client = new Client("wss://s.devnet.rippletest.net:51233");
    await client.connect();
    console.log("\n🔗 [3단계] 자격 증명 수락 시작...");

    const regulator = Wallet.fromSeed(process.env.REGULATOR_SEED!);
    const participants = [
        Wallet.fromSeed(process.env.PGA_SEED!),
        Wallet.fromSeed(process.env.PGB_SEED!),
        Wallet.fromSeed(process.env.USER_A_SEED!),
        Wallet.fromSeed(process.env.USER_B_SEED!),
    ];

    for (const p of participants) {
        const acceptTx: Transaction = {
            TransactionType: "CredentialAccept",
            Account: p.address,
            Issuer: regulator.address,
            CredentialType: toHex("KYC"),
        };
        await client.submitAndWait(acceptTx, { wallet: p });
        console.log(`✅ ${p.address}가 KYC 자격 증명을 수락했습니다.`);
    }

    await client.disconnect();
    console.log("🔌 연결이 종료되었습니다.");
}

acceptCredentials();