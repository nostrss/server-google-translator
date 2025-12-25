import { Duplex } from 'stream'
import { CircularBuffer } from './circular-buffer'

/**
 * 스트림 재시작 관련 상수
 */
export const STREAM_RESTART_CONSTANTS = {
  /** 스트림 최대 지속 시간 (5분) */
  MAX_STREAM_DURATION_MS: 5 * 60 * 1000,
  /** 재시작 시점 (4분 30초) */
  RESTART_THRESHOLD_MS: 4.5 * 60 * 1000,
  /** 오디오 버퍼 지속 시간 (1.5초) */
  AUDIO_BUFFER_DURATION_MS: 1500,
  /** 초당 오디오 바이트 수 (16kHz, 16bit) */
  AUDIO_BYTES_PER_SECOND: 32000,
  /** Google STT V2 API 최대 오디오 청크 크기 */
  MAX_AUDIO_CHUNK_SIZE: 25600,
} as const

export interface SpeechConfigV2 {
  languageCodes: string[]
  model: string
}

export interface SpeechSession {
  sessionId: string
  recognizeStream: Duplex | null
  isActive: boolean
  createdAt: number
  config: SpeechConfigV2
  configSent: boolean
  /** 현재 스트림 시작 시간 */
  streamStartTime: number
  /** 재시작 타이머 */
  restartTimer: NodeJS.Timeout | null
  /** 오디오 링 버퍼 */
  audioBuffer: CircularBuffer
  /** 결과 콜백 (재시작 시 필요) */
  onResult?: SpeechResultCallback
  /** 에러 콜백 (클라이언트 알림용) */
  onError?: SpeechErrorCallback
  /** 스트림 전환 중 플래그 */
  isTransitioning: boolean
  /** 스트림 세대 번호 (중복 결과 방지) */
  streamGeneration: number
}

export const speechSessions = new Map<string, SpeechSession>()

export type SpeechResultCallback = (
  transcript: string,
  isFinal: boolean
) => void
export type SpeechErrorCallback = (error: string) => void

export interface StreamingRecognizeResponseV2 {
  results?: Array<{
    alternatives?: Array<{
      transcript?: string
      confidence?: number
    }>
    isFinal?: boolean
  }>
  speechEventType?: string
}
