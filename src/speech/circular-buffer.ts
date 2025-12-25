/**
 * 링 버퍼 (Circular Buffer)
 * 스트림 재시작 시 오디오 연속성 보장을 위한 고정 크기 버퍼
 */
export class CircularBuffer {
  private buffer: Buffer;
  private writePos: number = 0;
  private isFull: boolean = false;

  constructor(private capacity: number) {
    this.buffer = Buffer.alloc(capacity);
  }

  /**
   * 데이터를 버퍼에 쓰기
   * 버퍼가 가득 차면 가장 오래된 데이터부터 덮어씀
   */
  write(data: Buffer): void {
    for (let i = 0; i < data.length; i++) {
      this.buffer[this.writePos] = data[i];
      this.writePos = (this.writePos + 1) % this.capacity;
      if (this.writePos === 0) {
        this.isFull = true;
      }
    }
  }

  /**
   * 버퍼에 저장된 모든 데이터를 순서대로 반환
   */
  getAll(): Buffer {
    if (!this.isFull) {
      return this.buffer.subarray(0, this.writePos);
    }

    // 원형 버퍼에서 순서대로 데이터 추출
    const result = Buffer.alloc(this.capacity);
    const firstPart = this.buffer.subarray(this.writePos);
    const secondPart = this.buffer.subarray(0, this.writePos);
    firstPart.copy(result, 0);
    secondPart.copy(result, firstPart.length);
    return result;
  }

  /**
   * 버퍼 초기화
   */
  clear(): void {
    this.writePos = 0;
    this.isFull = false;
  }

  /**
   * 현재 버퍼에 저장된 데이터 크기
   */
  get size(): number {
    return this.isFull ? this.capacity : this.writePos;
  }
}
