# XRPL 테스트넷 통합 가이드

## 개요
이 대시보드는 더미데이터 대신 실제 XRPL 테스트넷의 거래 데이터를 사용하도록 개선되었습니다.

## 주요 변경사항

### 1. 새로운 파일들
- `src/lib/xrplService.ts`: XRPL 테스트넷 연결 및 데이터 조회 서비스
- `src/lib/walletManager.ts`: 지갑 시드 관리 및 주소 매핑
- `env.example`: 환경변수 설정 예시 파일

### 2. 수정된 파일들
- `src/MonitoringDashboard.tsx`: 실제 XRPL 데이터 사용으로 변경
- `src/MonitoringDashboard2.tsx`: LIVE_MODE에서 실제 XRPL 데이터 사용

## 설정 방법

### 1. 환경변수 설정
1. `env.example` 파일을 `.env`로 복사
2. 실제 테스트넷 지갑 시드로 값 변경

```bash
cp env.example .env
```

### 2. 테스트 지갑 생성 (개발용)
브라우저 콘솔에서 다음 함수를 실행하여 테스트 지갑을 생성할 수 있습니다:

```javascript
import { generateTestWallets } from './src/lib/walletManager'
generateTestWallets()
```

### 3. 지갑에 테스트 XRP 충전
XRPL 테스트넷 Faucet을 사용하여 각 지갑에 테스트 XRP를 충전하세요:
- 웹 Faucet: https://xrpl.org/xrp-testnet-faucet.html
- 또는 코드에서 `fundTestWallet(address)` 함수 사용

## 기능 설명

### XRPL 서비스 (`xrplService.ts`)
- **실시간 연결**: XRPL 테스트넷에 WebSocket으로 연결
- **거래 조회**: 계정별 거래 내역 실시간 조회
- **데이터 변환**: XRPL 거래 데이터를 대시보드 형식으로 변환
- **오류 처리**: 연결 실패 시 안전한 폴백 처리

### 지갑 관리자 (`walletManager.ts`)
- **환경변수 기반**: 시드를 환경변수에서 안전하게 로드
- **주소 매핑**: 시드에서 지갑 주소 자동 생성
- **검증 기능**: 지갑 구성 상태 확인
- **개발 도구**: 테스트 지갑 자동 생성

### 대시보드 기능
- **실시간 업데이트**: 30초마다 최신 거래 데이터 자동 갱신
- **로딩 상태**: XRPL 데이터 로딩 중 시각적 표시
- **오류 알림**: 연결 실패 시 사용자에게 알림
- **파트너 필터**: 선택된 파트너의 거래만 조회

## 사용 방법

### 1. 개발 서버 시작
```bash
npm run dev
```

### 2. 환경변수 확인
브라우저 콘솔에서 지갑 구성 상태를 확인할 수 있습니다:
```javascript
import { validateWalletConfiguration } from './src/lib/walletManager'
validateWalletConfiguration()
```

### 3. LIVE_MODE 활성화
`MonitoringDashboard2.tsx`에서 `LIVE_MODE`를 `true`로 설정하면 실제 XRPL 데이터를 사용합니다.

## 트러블슈팅

### 연결 문제
- XRPL 테스트넷 상태 확인: https://xrpl.org/xrp-testnet-faucet.html
- 방화벽에서 WebSocket 연결(wss://) 허용 확인
- 브라우저 콘솔에서 오류 메시지 확인

### 데이터 없음
- 지갑에 테스트 XRP가 충전되어 있는지 확인
- 파트너 지갑들 간에 실제 거래가 있는지 확인
- 테스트 거래를 직접 생성해보세요

### 환경변수 문제
- `.env` 파일이 프로젝트 루트에 있는지 확인
- 모든 `VITE_` 접두사가 올바른지 확인
- 시드 형식이 올바른지 확인 (sEd로 시작)

## 보안 주의사항
- **프로덕션 환경에서는 절대로 실제 XRP 시드를 사용하지 마세요**
- 환경변수 파일(`.env`)을 버전 관리에 포함하지 마세요
- 테스트넷 전용 시드만 사용하세요

## 추가 개발

### 새로운 파트너 추가
1. `walletManager.ts`에 새 지갑 시드 추가
2. `xrplService.ts`의 `TOSS_WALLET_SYSTEM.partners`에 파트너 정보 추가
3. 환경변수에 새 시드 추가

### 거래 생성 기능
실제 거래를 생성하려면 `/XRPL/xrpl/Payment/` 디렉토리의 코드를 참고하세요:
- `sendXRP.ts`: XRP 송금
- `sendIOU.ts`: IOU 토큰 송금

## 참고 자료
- XRPL 공식 문서: https://xrpl.org/
- XRPL JavaScript SDK: https://js.xrpl.org/
- XRPL 테스트넷 Faucet: https://xrpl.org/xrp-testnet-faucet.html
