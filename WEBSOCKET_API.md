# WebSocket API 가이드

Google Cloud Speech-to-Text 기반 실시간 음성 인식 WebSocket API

## 연결

```
ws://localhost:3000
```

## 이벤트 흐름

```
클라이언트                              서버
    |                                    |
    |--- { event: 'connect' } --------->|
    |<-- { event: 'connected' } --------|
    |                                    |
    |--- { event: 'start_speech' } ---->|
    |<-- { event: 'speech_started' } ---|
    |                                    |
    |--- { event: 'audio_chunk' } ----->|
    |<-- { event: 'speech_result' } ----|  (실시간 반복)
    |                                    |
    |--- { event: 'stop_speech' } ----->|
    |<-- { event: 'speech_stopped' } ---|
```

## 클라이언트 → 서버 이벤트

### 1. connect
연결 초기화

```json
{
  "event": "connect",
  "data": {
    "clientId": "optional-client-id"
  }
}
```

### 2. start_speech
음성 인식 시작

```json
{
  "event": "start_speech",
  "data": {
    "languageCode": "ko-KR",
    "sampleRateHertz": 16000
  }
}
```

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| languageCode | string | ko-KR | 인식 언어 코드 |
| sampleRateHertz | number | 16000 | 샘플레이트 |

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
- Sample Rate: 16000 Hz (기본값)
- Channels: 1 (모노)
- WAV 헤더는 자동으로 제거됨

### 4. stop_speech
음성 인식 종료

```json
{
  "event": "stop_speech"
}
```

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
음성 인식 결과 (실시간)

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
| isFinal | boolean | true: 최종 결과, false: 중간 결과 |
| timestamp | number | Unix timestamp (ms) |

**isFinal 설명:**
- `false`: 사용자가 말하는 중간 결과 (변경될 수 있음)
- `true`: 문장이 완성된 최종 결과

### 4. speech_stopped
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

### 5. error
에러 발생

```json
{
  "event": "error",
  "success": false,
  "error": "에러 메시지"
}
```

## JavaScript 예제

```javascript
const ws = new WebSocket('ws://localhost:3000');

let sessionId = null;

ws.onopen = () => {
  // 1. 연결 요청
  ws.send(JSON.stringify({ event: 'connect' }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  switch (msg.event) {
    case 'connected':
      sessionId = msg.data.sessionId;
      console.log('연결됨:', sessionId);
      break;

    case 'speech_started':
      console.log('음성 인식 시작');
      break;

    case 'speech_result':
      const { transcript, isFinal } = msg.data;
      if (isFinal) {
        console.log('최종:', transcript);
      } else {
        console.log('중간:', transcript);
      }
      break;

    case 'speech_stopped':
      console.log('음성 인식 종료');
      break;

    case 'error':
      console.error('에러:', msg.error);
      break;
  }
};

// 음성 인식 시작
function startSpeech(languageCode = 'ko-KR') {
  ws.send(JSON.stringify({
    event: 'start_speech',
    data: { languageCode }
  }));
}

// 오디오 데이터 전송
function sendAudioChunk(base64Audio) {
  ws.send(JSON.stringify({
    event: 'audio_chunk',
    data: { audio: base64Audio }
  }));
}

// 음성 인식 종료
function stopSpeech() {
  ws.send(JSON.stringify({ event: 'stop_speech' }));
}
```

## 브라우저 마이크 녹음 예제

```javascript
async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      sampleRate: 16000,
      channelCount: 1,
      echoCancellation: true
    }
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

  startSpeech('ko-KR');
}
```

## 지원 언어

REST API로 지원 언어 목록을 조회할 수 있습니다:

```
GET /api/languages
GET /api/languages?q=korean
```
