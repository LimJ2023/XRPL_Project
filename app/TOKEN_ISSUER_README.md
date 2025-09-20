# XRPL Admin Token Issuer

Admin이 USD, JPY, KRW IOU 토큰을 발행하는 종합적인 시스템입니다.

## 주요 기능

- **Trust Line 설정**: 사용자가 IOU 토큰을 받기 위한 신뢰선 설정
- **토큰 발행**: Admin이 USD, JPY, KRW 토큰을 사용자에게 발행
- **다중 토큰 발행**: 여러 통화를 한 번에 발행
- **완전 자동화**: Trust Line 설정부터 토큰 발행까지 전체 프로세스 자동화

## 설치 및 설정

### 1. 환경변수 설정

`env.token.example` 파일을 참고하여 `.env` 파일을 생성하세요:

```bash
# .env 파일 생성
cp env.token.example .env
```

필수 환경변수:
- `ADMIN_SEED`: Admin 지갑의 시드 (토큰 발행자)
- `USER_SEED`: 사용자 지갑의 시드 (토큰 수신자)

### 2. 의존성 설치

```bash
npm install xrpl dotenv
```

## 사용 방법

### 1. 직접 실행 (전체 프로세스)

```bash
# TypeScript로 직접 실행
npx ts-node src/lib/adminTokenIssuer.ts
```

이 명령어는 다음 작업을 자동으로 수행합니다:
1. Admin 지갑 정보 확인
2. 모든 통화(USD, JPY, KRW)에 대한 Trust Line 설정
3. 각 통화별 토큰 발행 (USD: 1000, JPY: 100000, KRW: 1000000)

### 2. 개별 함수 사용

```typescript
import {
    setupTrustLine,
    issueToken,
    issueMultipleTokens,
    completeTokenIssuanceProcess
} from './src/lib/adminTokenIssuer'

// 1. 개별 Trust Line 설정
const trustResult = await setupTrustLine({
    currency: "USD",
    issuerAddress: "rAdminAddress...",
    limitAmount: "1000000",
    userSeed: "sUser..."
})

// 2. 개별 토큰 발행
const issueResult = await issueToken({
    currency: "USD",
    amount: "1000",
    recipientAddress: "rUserAddress...",
    adminSeed: "sAdmin..."
})

// 3. 다중 토큰 발행
const multiResults = await issueMultipleTokens(
    "rUserAddress...",
    "sAdmin...",
    {
        USD: "1000",
        JPY: "100000",
        KRW: "1000000"
    }
)

// 4. 완전한 프로세스 실행
await completeTokenIssuanceProcess(
    "sUser...",
    "sAdmin...",
    {
        USD: "1000",
        JPY: "100000"
    }
)
```

## 함수 설명

### Core Functions

#### `setupTrustLine(request: TrustLineSetupRequest)`
사용자가 특정 통화에 대한 Trust Line을 설정합니다.

**매개변수:**
- `currency`: 통화 코드 (USD, JPY, KRW)
- `issuerAddress`: 토큰 발행자 주소
- `limitAmount`: 신뢰 한도 금액
- `userSeed`: 사용자 지갑 시드

#### `issueToken(request: TokenIssueRequest)`
Admin이 특정 통화의 IOU 토큰을 발행합니다.

**매개변수:**
- `currency`: 통화 코드 (USD, JPY, KRW)
- `amount`: 발행할 토큰 양
- `recipientAddress`: 수신자 주소
- `adminSeed`: Admin 지갑 시드

#### `issueMultipleTokens(recipientAddress, adminSeed, amounts)`
여러 통화의 토큰을 한 번에 발행합니다.

#### `completeTokenIssuanceProcess(userSeed, adminSeed, amounts)`
Trust Line 설정부터 토큰 발행까지 전체 프로세스를 자동화합니다.

### Helper Functions

#### `getAdminWalletInfo(adminSeed)`
Admin 지갑의 정보를 조회합니다.

#### `setupAllTrustLines(userSeed, issuerAddress, limitAmount)`
모든 지원되는 통화에 대한 Trust Line을 설정합니다.

## 지원되는 통화

- **USD**: 미국 달러
- **JPY**: 일본 엔
- **KRW**: 한국 원

## 실행 예시

### 성공적인 실행 로그

```
🚀 완전한 토큰 발행 프로세스 시작

🏦 Admin 지갑 정보:
   주소: rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH
   XRP 잔액: 1000 XRP

👤 사용자 지갑: rDNvpKTVkKxjqKYjU7zE7Y8gXqrJ9vdtME

🔗 모든 통화 Trust Line 설정 시작
--- USD Trust Line 설정 중 ---
✅ USD Trust Line 설정 완료
--- JPY Trust Line 설정 중 ---
✅ JPY Trust Line 설정 완료
--- KRW Trust Line 설정 중 ---
✅ KRW Trust Line 설정 완료

🚀 다중 토큰 발행 시작
--- USD 토큰 발행 중 ---
✅ 1000 USD 토큰 발행 성공!
--- JPY 토큰 발행 중 ---
✅ 100000 JPY 토큰 발행 성공!
--- KRW 토큰 발행 중 ---
✅ 1000000 KRW 토큰 발행 성공!

📊 최종 결과 요약:
==========================================

USD:
  Trust Line: ✅ 성공
  토큰 발행: ✅ 성공
  발행량: 1000
  트랜잭션: ABC123...

JPY:
  Trust Line: ✅ 성공
  토큰 발행: ✅ 성공
  발행량: 100000
  트랜잭션: DEF456...

KRW:
  Trust Line: ✅ 성공
  토큰 발행: ✅ 성공
  발행량: 1000000
  트랜잭션: GHI789...

🎉 토큰 발행 프로세스 완료!
```

## 주의사항

1. **네트워크**: 현재 XRPL 테스트넷을 사용합니다 (`wss://s.devnet.rippletest.net:51233`)
2. **시드 보안**: 시드는 절대 공개하지 마세요. 환경변수로만 관리하세요.
3. **XRP 잔액**: Admin 계정에 충분한 XRP가 있어야 트랜잭션 수수료를 지불할 수 있습니다.
4. **Trust Line**: 토큰을 받기 전에 반드시 Trust Line을 설정해야 합니다.

## 오류 처리

일반적인 오류와 해결 방법:

- **`tecNO_LINE`**: Trust Line이 설정되지 않음 → Trust Line을 먼저 설정하세요
- **`tecUNFUNDED_PAYMENT`**: XRP 잔액 부족 → Admin 계정에 XRP를 충전하세요
- **`tecNO_DST`**: 수신자 계정이 존재하지 않음 → 올바른 주소를 확인하세요

## 라이센스

MIT License
