# XRPL 결제 시스템 사용 가이드

이 프로젝트는 XRPL(XRP Ledger)을 사용하여 Toss와 PayPay로 결제를 처리하는 시스템입니다.

## 🚀 기능

- **XRP 결제**: 네이티브 XRP 토큰으로 결제
- **IOU 결제**: 사용자 정의 토큰(USD, JPY, KRW 등)으로 결제
- **Toss & PayPay 지원**: Toss와 PayPay 지갑으로 직접 결제
- **실시간 결제 상태**: 트랜잭션 성공/실패 피드백
- **모바일 최적화**: 터치 친화적인 UI

## 📋 사전 준비사항

### 1. 의존성 설치
```bash
npm install xrpl dotenv
```

### 2. 환경 변수 설정
Next.js 환경에서 다음 환경변수들을 설정하세요:

```bash
# .env.local 파일 생성
NEXT_PUBLIC_TOSS_WALLET_ADDRESS=rTossActualWalletAddress...
NEXT_PUBLIC_PAYPAY_WALLET_ADDRESS=rPayPayActualWalletAddress...
```

### 3. XRPL 지갑 준비
- 테스트넷에서 지갑을 생성하고 XRP를 충전하세요
- 지갑 시드는 `sEd...` 형태로 시작합니다

## 🎯 사용 방법

### 1. 결제 수단 선택
- **Toss**: 한국의 토스 결제 시스템
- **PayPay**: 일본의 페이페이 결제 시스템
- 활성화된 결제 방법에는 녹색 점이 표시됩니다

### 2. 결제 정보 입력
- **금액**: 결제할 금액을 입력 (숫자만)
- **토큰 선택**: 
  - `XRP`: 네이티브 XRP 토큰
  - `USD.IOU`, `JPY.IOU`, `KRW.IOU`: 사용자 정의 토큰
- **지갑 시드**: XRPL 지갑 시드 입력 (보안 주의)

### 3. 결제 실행
- "XRPL로 결제하기" 버튼을 클릭
- 트랜잭션 처리 중에는 로딩 스피너가 표시됩니다
- 결제 완료 후 성공/실패 결과가 표시됩니다

## 🔧 기술 구조

### 주요 파일들
- `src/lib/xrplPayment.ts`: XRPL 결제 로직
- `src/app/UserPayment.tsx`: 사용자 결제 UI 컴포넌트

### 결제 플로우
1. 사용자가 결제 정보 입력
2. `processPayment()` 함수 호출
3. XRP/IOU에 따른 분기 처리
4. XRPL 네트워크에 트랜잭션 전송
5. 결과 반환 및 UI 업데이트

## ⚠️ 보안 고려사항

### 현재 구현 (데모용)
- 지갑 시드를 직접 입력받음
- 환경변수에 지갑 주소 저장

### 운영 환경 권장사항
- **하드웨어 지갑** 연동 (Ledger, Trezor)
- **지갑 연결 SDK** 사용 (XUMM, Gem Wallet)
- **서버 사이드** 지갑 관리
- **다중 서명** 지갑 사용
- **키 관리 서비스** (AWS KMS, HashiCorp Vault)

## 🌐 XRPL 네트워크

### 현재 설정
- **테스트넷**: `wss://s.devnet.rippletest.net:51233`
- 실제 자금이 사용되지 않는 개발/테스트 환경

### 메인넷 전환 시
```typescript
const XRPL_SERVER = "wss://xrplcluster.com" // 메인넷
```

## 🔍 트러블슈팅

### 일반적인 오류들

1. **지갑 연결 실패**
   - 지갑 시드 형식 확인 (`sEd...`로 시작)
   - 네트워크 연결 상태 확인

2. **결제 실패**
   - 잔액 부족 확인
   - 목적지 주소 유효성 확인
   - IOU의 경우 TrustLine 설정 확인

3. **환경변수 오류**
   - `.env.local` 파일 존재 확인
   - 환경변수 이름 정확성 확인
   - Next.js 서버 재시작

## 📚 추가 자료

- [XRPL 공식 문서](https://xrpl.org/)
- [XRPL JavaScript SDK](https://js.xrpl.org/)
- [XRPL Explorer](https://livenet.xrpl.org/) (메인넷)
- [XRPL Testnet Explorer](https://testnet.xrpl.org/) (테스트넷)

## 🤝 기여하기

버그 리포트나 기능 제안은 GitHub Issues를 통해 해주세요.

---

**주의**: 이 코드는 데모 목적으로 작성되었습니다. 운영 환경에서 사용하기 전에 보안 검토를 반드시 수행하세요.
