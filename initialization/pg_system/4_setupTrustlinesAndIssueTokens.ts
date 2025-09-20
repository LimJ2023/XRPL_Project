import { Client, Wallet, Payment } from "xrpl";
import * as dotenv from "dotenv";
dotenv.config();

const client = new Client("wss://s.devnet.rippletest.net:51233");

async function userTransaction() {
    await client.connect();
    console.log("\n🔗 [4단계] 사용자 간 거래 시작...");
    const pg_a_wallet = Wallet.fromSeed(process.env.PGA_SEED!);
    const user_a_wallet = Wallet.fromSeed(process.env.USER_A_SEED!);
    const user_b_wallet = Wallet.fromSeed(process.env.USER_B_SEED!);

    const pga_currency = "PGA";

    // User A -> User B에게 50 PGA 토큰 전송
    const user_payment: Payment = {
        TransactionType: "Payment",
        Account: user_a_wallet.address,
        Destination: user_b_wallet.address,
        Amount: {
            issuer: pg_a_wallet.address,
            currency: pga_currency,
            value: "50",
        },
    };

    const tx = await client.submitAndWait(user_payment, { wallet: user_a_wallet });
    console.log(
        `✅ User A가 User B에게 50 ${pga_currency}를 성공적으로 전송했습니다.`
    );
    console.log(`🔗 트랜잭션 해시: ${tx.result.hash}`);

    await client.disconnect();
    console.log("🔌 연결이 종료되었습니다.");
}

userTransaction();