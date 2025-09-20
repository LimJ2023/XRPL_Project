import { Client, Wallet, Transaction } from "xrpl";
import * as dotenv from "dotenv";
import * as fs from "fs";
dotenv.config();

const toHex = (str: string) => Buffer.from(str).toString("hex");

async function createDomainAndCredentials() {
    const client = new Client("wss://s.devnet.rippletest.net:51233");
    await client.connect();
    console.log("\n🔗 [2단계] 도메인 및 자격 증명 생성 시작...");

    const regulator = Wallet.fromSeed(process.env.REGULATOR_SEED!);
    const participants = [
        Wallet.fromSeed(process.env.PGA_SEED!),
        Wallet.fromSeed(process.env.PGB_SEED!),
        Wallet.fromSeed(process.env.USER_A_SEED!),
        Wallet.fromSeed(process.env.USER_B_SEED!),
    ];

    // 1. Permissioned Domain 생성
    const domainSetTx: Transaction = {
        TransactionType: "PermissionedDomainSet",
        Account: regulator.address,
        AcceptedCredentials: [
            {
                Credential: {
                    Issuer: regulator.address,
                    CredentialType: toHex("KYC"),
                },
            },
        ],
    };
    const domainResult = await client.submitAndWait(domainSetTx, { wallet: regulator });
    const domainId = (domainResult.result.meta as any)?.AffectedNodes.find(
        (n: any) => n.CreatedNode?.LedgerEntryType === "PermissionedDomain"
    )?.CreatedNode?.LedgerIndex;

    fs.appendFileSync(".env", `DOMAIN_ID=${domainId}\n`);
    console.log(`✅ Permissioned Domain 생성 완료. Domain ID: ${domainId}`);

    // 2. 모든 참여자에게 KYC Credential 발급
    for (const p of participants) {
        const createCredentialTx: Transaction = {
            TransactionType: "CredentialCreate",
            Account: regulator.address,
            Subject: p.address,
            CredentialType: toHex("KYC"),
        };
        await client.submitAndWait(createCredentialTx, { wallet: regulator });
        console.log(`✅ ${p.address}에게 KYC 자격 증명을 발급했습니다.`);
    }

    await client.disconnect();
    console.log("🔌 연결이 종료되었습니다.");
}

createDomainAndCredentials();
