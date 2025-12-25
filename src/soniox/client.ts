import WebSocket from 'ws'
import { config } from '../config'
import { SonioxConfigMessage, SonioxResponse } from './types'

const SONIOX_ENDPOINT = 'wss://stt-rt.soniox.com/transcribe-websocket'

export function createSonioxConnection(
  languageHints: string[],
  onMessage: (data: SonioxResponse) => void,
  onError: (error: Error) => void,
  onClose: () => void,
  onReady: () => void
): WebSocket {
  const ws = new WebSocket(SONIOX_ENDPOINT)

  ws.on('open', () => {
    const configMessage: SonioxConfigMessage = {
      api_key: config.soniox.apiKey,
      model: 'stt-rt-v3',
      audio_format: 'pcm_s16le',
      sample_rate: 16000,
      num_channels: 1,
      language_hints: languageHints,
      enable_endpoint_detection: true,
    }
    console.log(configMessage)
    ws.send(JSON.stringify(configMessage))
    console.log('Soniox 연결 및 설정 전송 완료')
    onReady()
  })

  ws.on('message', (data: Buffer) => {
    try {
      const response: SonioxResponse = JSON.parse(data.toString())
      if (response.error_code) {
        console.error(
          `Soniox 에러: ${response.error_code} - ${response.error_message}`
        )
        onError(new Error(response.error_message || 'Unknown Soniox error'))
        return
      }
      onMessage(response)
    } catch (e) {
      console.error('Soniox 응답 파싱 실패:', e)
    }
  })

  ws.on('error', onError)
  ws.on('close', onClose)

  return ws
}
