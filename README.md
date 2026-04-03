# STT Translator Server

실시간 음성 인식(STT)과 다중 모델 번역을 제공하는 NestJS WebSocket 서버.
Chrome 확장프로그램 [Tab Translator](https://chromewebstore.google.com/detail/tab-translator/ellmimobokloigiacmkkojdnppfldbgc)의 백엔드 서버로 사용됩니다.

## 주요 기능

- **실시간 음성 인식**: Soniox STT SDK를 통한 스트리밍 음성 인식
- **자동 언어 감지**: 소스 언어 자동 감지 지원
- **다중 모델 번역**: OpenRouter를 통해 11개 LLM 모델 지원
- **실시간 문장 분리**: 외부 마이크로서비스를 통한 문장 단위 번역

## 지원 번역 모델

| 모델 | 카테고리 | 유형 |
|---|---|---|
| Gemma 3n | Free | 무료 |
| GPT-4.1 Nano | Fast | 유료 |
| GPT-5 Nano | Fast | 유료 |
| Claude Haiku 4.5 | Fast | 유료 |
| Mistral Small | Fast | 유료 |
| Gemini 2.5 Flash-Lite | Fast | 유료 |
| Gemini 3 Flash | Fast | 유료 |
| Gemini 2.5 Flash | Premium | 유료 |
| GPT-4.1 Mini | Premium | 유료 |
| Claude Sonnet 4.5 | Premium | 유료 |
| Llama 3.3 70B | Premium | 유료 |

## 기술 스택

- **Runtime**: Node.js 20, NestJS
- **WebSocket**: ws (native)
- **STT**: Soniox
- **번역**: OpenRouter + Vercel AI SDK
- **배포**: Google Cloud Run, Cloud Build
- **시크릿 관리**: Google Secret Manager

## 프로젝트 구조

```
src/
├── config/          # 환경변수 설정 및 검증
├── health/          # 헬스체크 엔드포인트
├── speech/          # WebSocket 게이트웨이 (핵심 로직)
├── soniox/          # Soniox STT 서비스
├── translate/       # 번역 서비스 (OpenRouter)
├── languages/       # 지원 언어 목록
├── sentence/        # 문장 분리 서비스 클라이언트
└── common/          # 공통 유틸, 에러 코드
```

## 로컬 개발

### 환경변수 설정

```bash
cp .env.example .env
```

```env
PORT=8080
SONIOX_API_KEY=your-soniox-key
OPENROUTER_API_KEY=your-openrouter-key
SENTENCE_SPLITTER_URL=http://localhost:8001
ALLOWED_ORIGINS=chrome-extension://your-extension-id
```

### 실행

```bash
pnpm install
pnpm start:dev
```

### 테스트

```bash
pnpm test
```

## API 엔드포인트

### REST

| Method | Path | 설명 |
|---|---|---|
| GET | `/health` | 헬스체크 |
| GET | `/api/translate/models` | 지원 번역 모델 목록 |
| GET | `/api/languages/translation` | 지원 언어 목록 |

### WebSocket

| Client -> Server | 설명 |
|---|---|
| `start_speech` | 음성 인식 세션 시작 |
| `audio_chunk` | 오디오 데이터 전송 |
| `stop_speech` | 음성 인식 중지 |

| Server -> Client | 설명 |
|---|---|
| `connected` | 연결 성공 |
| `speech_started` | 세션 시작 확인 |
| `speech_result` | STT 결과 (중간/최종) |
| `translation_result` | 번역 결과 |
| `error` | 에러 |

자세한 WebSocket API 명세는 [WEBSOCKET_API.md](./WEBSOCKET_API.md)를 참고하세요.

## 배포

Cloud Build를 통해 Google Cloud Run에 자동 배포됩니다.

```bash
gcloud builds submit --config=cloudbuild.yaml \
  --project=your-project-id \
  --substitutions=COMMIT_SHA=$(git rev-parse --short HEAD)
```

### 사전 설정

1. **Artifact Registry** 레포지토리 생성
2. **Secret Manager**에 API 키 등록:
   - `SONIOX_API_KEY`
   - `OPENROUTER_API_KEY`
3. Cloud Run 서비스 계정에 Secret 접근 권한 부여

### 배포 스펙

- 리전: `asia-northeast3` (서울)
- 메모리: 512Mi / CPU: 1
- 오토스케일링: 0~10 인스턴스
- WebSocket 타임아웃: 3600초
