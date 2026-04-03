# WebSocket API 가이드

Soniox (`@soniox/node` SDK) 기반 실시간 음성 인식(STT) + 번역 WebSocket API

## 연결

```
ws://localhost:8080
```

## 이벤트 흐름

```
클라이언트                                서버
    |                                       |
    |--- { event: 'connect' } ----------->|
    |<-- { event: 'connected' } ----------|
    |                                       |
    |--- { event: 'start_speech' } ------->|
    |<-- { event: 'speech_started' } ------|
    |                                       |
    |--- { event: 'audio_chunk' } -------->|
    |<-- { event: 'speech_result' } -------|  (실시간, isFinal: false)
    |<-- { event: 'translation_result' } --|  (Soniox 번역, isFinal: false)
    |                                       |
    |   (문장 완성 시)                       |
    |<-- { event: 'speech_result' } -------|  (isFinal: true)
    |<-- { event: 'translation_result' } --|  (Google 번역, isFinal: true)
    |                                       |
    |--- { event: 'stop_speech' } -------->|
    |<-- { event: 'speech_stopped' } ------|
```

## 클라이언트 → 서버 이벤트

### 1. connect
연결 초기화

```json
{
  "event": "connect"
}
```

### 2. start_speech
음성 인식 시작

```json
{
  "event": "start_speech",
  "data": {
    "languageCode": "ko-KR",
    "targetLanguageCode": "en-US",
    "translationMode": "standard",
    "sampleRateHertz": 16000
  }
}
```

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| languageCode | string | `ko-KR` | 발화 언어 코드 |
| targetLanguageCode | string | - | 번역 대상 언어 코드. 미입력 시 번역 비활성화 |
| translationMode | `standard` \| `advanced` | `standard` | `standard`: Gemini 2.5 Flash, `advanced`: Cloud Translation LLM |
| sampleRateHertz | number | `16000` | 오디오 샘플레이트 |

**번역 skip 조건**: `targetLanguageCode` 미입력 또는 발화언어 == 번역언어

### 3. audio_chunk
오디오 데이터 전송

```json
{
  "event": "audio_chunk",
  "data": {
    "audio": "Base64 인코딩된 오디오 데이터"
  }
}
```

**오디오 형식:**
- Encoding: LINEAR16 (PCM)
- Sample Rate: 16000 Hz (권장)
- Channels: 1 (모노)
- WAV 헤더 포함 시 자동 제거
- 최대 청크 크기: 64KB

### 4. stop_speech
음성 인식 종료

```json
{
  "event": "stop_speech"
}
```

---

## 서버 → 클라이언트 이벤트

### 1. connected
연결 완료

```json
{
  "event": "connected",
  "data": {
    "sessionId": "uuid-session-id",
    "message": "연결이 정상적으로 완료되었습니다.",
    "timestamp": 1703123456789
  },
  "success": true
}
```

### 2. speech_started
음성 인식 시작됨

```json
{
  "event": "speech_started",
  "data": {
    "message": "음성 인식이 시작되었습니다."
  },
  "success": true
}
```

### 3. speech_result
음성 인식 결과

```json
{
  "event": "speech_result",
  "data": {
    "transcript": "인식된 텍스트",
    "isFinal": false,
    "timestamp": 1703123456789
  },
  "success": true
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| transcript | string | 인식된 텍스트 |
| isFinal | boolean | `false`: 중간 결과 / `true`: 문장 완성 최종 결과 |
| timestamp | number | Unix timestamp (ms) |

### 4. translation_result
번역 결과

```json
{
  "event": "translation_result",
  "data": {
    "originalText": "원본 텍스트",
    "translatedText": "번역된 텍스트",
    "isFinal": false,
    "timestamp": 1703123456789
  },
  "success": true
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| originalText | string | 원본 텍스트 |
| translatedText | string | 번역된 텍스트 |
| isFinal | boolean | `false`: Soniox 실시간 번역 / `true`: Google/Gemini 최종 번역 |
| timestamp | number | Unix timestamp (ms) |

**번역 전략:**
- `isFinal: false` — Soniox 내장 번역 (단어 단위 실시간)
- `isFinal: true` — `translationMode`에 따라:
  - `standard`: Gemini 2.5 Flash (Vertex AI)
  - `advanced`: Cloud Translation LLM (`general/translation-llm`, us-central1)

### 5. speech_stopped
음성 인식 종료됨

```json
{
  "event": "speech_stopped",
  "data": {
    "message": "음성 인식이 종료되었습니다."
  },
  "success": true
}
```

### 6. error
에러 발생

```json
{
  "event": "error",
  "success": false,
  "error": {
    "code": "VAD_TIMEOUT",
    "message": "무음이 감지되어 세션이 종료되었습니다."
  }
}
```

**에러 코드:**

| 코드 | 설명 |
|------|------|
| `INVALID_MESSAGE` | 메시지 형식 오류 |
| `UNKNOWN_EVENT` | 알 수 없는 이벤트 |
| `SESSION_NOT_FOUND` | connect 이벤트 미전송 |
| `SESSION_ALREADY_ACTIVE` | 이미 활성 세션 존재 |
| `ORIGIN_REJECTED` | 허가되지 않은 Origin |
| `TOO_MANY_SESSIONS` | IP당 동시 세션 한도 초과 (최대 3) |
| `PAYLOAD_TOO_LARGE` | 오디오 청크 64KB 초과 |
| `VAD_TIMEOUT` | 30초 무음 감지 → 세션 자동 종료 |
| `SESSION_TIMEOUT` | 30분 세션 최대 시간 초과 → 자동 종료 |
| `STT_ERROR` | Soniox STT 오류 |
| `TRANSLATION_ERROR` | 번역 처리 오류 |
| `INTERNAL_ERROR` | 서버 내부 오류 |

---

## REST API

### GET /api/languages/stt
Soniox 지원 발화 언어 목록

```
GET /api/languages/stt
GET /api/languages/stt?q=korean
```

**응답:**
```json
{
  "languages": [
    { "code": "ko", "name": "Korean", "nativeName": "한국어" },
    { "code": "en", "name": "English", "nativeName": "English" }
  ]
}
```

### GET /api/languages/translation
Google Translate 지원 언어 목록 (24시간 캐시)

```
GET /api/languages/translation
GET /api/languages/translation?q=english
```

**응답:**
```json
{
  "languages": [
    { "code": "en", "name": "English", "nativeName": "English" },
    { "code": "ko", "name": "Korean", "nativeName": "Korean" }
  ]
}
```

Rate limit: 30 req/min per IP

### GET /health
헬스 체크 (@nestjs/terminus)

```json
{
  "status": "ok",
  "info": {},
  "error": {},
  "details": {}
}
```

---

## JavaScript 예제

```javascript
const ws = new WebSocket('ws://localhost:8080');

ws.onopen = () => {
  ws.send(JSON.stringify({ event: 'connect' }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  switch (msg.event) {
    case 'connected':
      console.log('연결됨:', msg.data.sessionId);
      ws.send(JSON.stringify({
        event: 'start_speech',
        data: {
          languageCode: 'ko-KR',
          targetLanguageCode: 'en-US',
          translationMode: 'standard',
        }
      }));
      break;

    case 'speech_started':
      console.log('음성 인식 시작');
      break;

    case 'speech_result':
      console.log(msg.data.isFinal ? '[최종]' : '[중간]', msg.data.transcript);
      break;

    case 'translation_result':
      console.log(msg.data.isFinal ? '[최종번역]' : '[실시간번역]', msg.data.translatedText);
      break;

    case 'speech_stopped':
      console.log('음성 인식 종료');
      break;

    case 'error':
      console.error(`에러 [${msg.error.code}]:`, msg.error.message);
      break;
  }
};

function sendAudioChunk(base64Audio) {
  ws.send(JSON.stringify({
    event: 'audio_chunk',
    data: { audio: base64Audio }
  }));
}

function stopSpeech() {
  ws.send(JSON.stringify({ event: 'stop_speech' }));
}
```

## 브라우저 마이크 녹음 예제

```javascript
async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true }
  });

  const audioContext = new AudioContext({ sampleRate: 16000 });
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);

  processor.onaudioprocess = (e) => {
    const inputData = e.inputBuffer.getChannelData(0);
    const pcmData = new Int16Array(inputData.length);
    for (let i = 0; i < inputData.length; i++) {
      pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
    }
    const base64 = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
    sendAudioChunk(base64);
  };

  source.connect(processor);
  processor.connect(audioContext.destination);
}
```

---

## 환경변수

| 변수 | 필수 | 설명 |
|------|------|------|
| `PORT` | N | 서버 포트 (기본: 8080) |
| `SONIOX_API_KEY` | Y | Soniox API 키 |
| `GOOGLE_PROJECT_ID` | Y | GCP 프로젝트 ID |
| `GOOGLE_CLIENT_EMAIL` | Y | 서비스 계정 이메일 |
| `GOOGLE_PRIVATE_KEY` | Y | 서비스 계정 Private Key (`\n` 이스케이프) |
| `ALLOWED_ORIGINS` | Y | 허용 Origin (쉼표 구분, 예: `chrome-extension://abc123`) |

---

## 보안

- **Origin 검증**: `ALLOWED_ORIGINS`에 등록된 Origin만 WebSocket 연결 허용
- **IP당 세션 제한**: 최대 3개 동시 세션
- **오디오 청크 크기 제한**: 64KB
- **VAD 타임아웃**: 30초 무음 시 자동 종료
- **세션 타임아웃**: 30분 최대 세션 시간
- **Rate Limiting**: REST API 30 req/min per IP (ThrottlerModule)
- **Helmet**: HTTP 보안 헤더 적용
