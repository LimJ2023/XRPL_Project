import { Client, Wallet } from "xrpl";
import * as fs from "fs";

const client = new Client("wss://s.devnet.rippletest.net:51233");

async function setupWallets() {
    await client.connect();
    console.log("🔗 [1단계] XRPL Devnet에 연결되었습니다.");

    const regulator_wallet = Wallet.generate();
    const pg_a_wallet = Wallet.generate();
    const pg_b_wallet = Wallet.generate();
    const user_a_wallet = Wallet.generate();
    const user_b_wallet = Wallet.generate();

    console.log("✅ 지갑 생성 완료");
    console.log("Regulator:", regulator_wallet.address);
    console.log("PG A:", pg_a_wallet.address);
    // ... (나머지 주소 출력)

    console.log("⏳ 계정을 활성화하고 있습니다... (각 10-20초 소요)");
    await Promise.all([
        client.fundWallet(regulator_wallet),
        client.fundWallet(pg_a_wallet),
        client.fundWallet(pg_b_wallet),
        client.fundWallet(user_a_wallet),
        client.fundWallet(user_b_wallet),
    ]);
    console.log("✅ 모든 지갑이 Devnet Faucet으로 활성화되었습니다.");

    const envContent = `REGULATOR_SEED=${regulator_wallet.seed}\nPGA_SEED=${pg_a_wallet.seed}\nPGB_SEED=${pg_b_wallet.seed}\nUSER_A_SEED=${user_a_wallet.seed}\nUSER_B_SEED=${user_b_wallet.seed}\n`;
    fs.writeFileSync(".env", envContent);
    console.log("🔑 지갑 시드 정보가 .env 파일에 저장되었습니다.");

    await client.disconnect();
    console.log("🔌 연결이 종료되었습니다.");
}

setupWallets();
