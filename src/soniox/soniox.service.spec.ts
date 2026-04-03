import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SonioxService } from './soniox.service';

const mockSendAudio = jest.fn();
const mockClose = jest.fn();
const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockOn = jest.fn();

let mockSessionState = 'connected';

const mockSession = {
  sendAudio: mockSendAudio,
  close: mockClose,
  connect: mockConnect,
  on: mockOn,
  get state() {
    return mockSessionState;
  },
};

jest.mock('@soniox/node', () => ({
  SonioxNodeClient: jest.fn().mockImplementation(() => ({
    realtime: {
      stt: jest.fn().mockReturnValue(mockSession),
    },
  })),
}));

describe('SonioxService', () => {
  let service: SonioxService;

  beforeEach(async () => {
    mockSessionState = 'connected';
    mockOn.mockReset();
    mockConnect.mockReset().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SonioxService,
        {
          provide: ConfigService,
          useValue: { get: () => 'test-api-key' },
        },
      ],
    }).compile();

    service = module.get<SonioxService>(SonioxService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('createSession', () => {
    it('세션을 생성하고 onReady를 호출한다', async () => {
      jest.useFakeTimers();
      const onReady = jest.fn();

      await service.createSession(
        'session-1', ['ko'], 'en',
        jest.fn(), onReady, jest.fn(), jest.fn(), jest.fn(), jest.fn(),
      );

      expect(onReady).toHaveBeenCalled();
      expect(mockConnect).toHaveBeenCalled();
      expect(mockOn).toHaveBeenCalledWith('result', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('endpoint', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('error', expect.any(Function));
      jest.useRealTimers();
    });

    it('연결 실패 시 onError를 호출한다', async () => {
      mockConnect.mockRejectedValueOnce(new Error('connection failed'));
      const onError = jest.fn();

      await service.createSession(
        'session-fail', ['ko'], undefined,
        jest.fn(), jest.fn(), jest.fn(), jest.fn(), jest.fn(), onError,
      );

      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'connection failed' }));
    });
  });

  describe('writeAudio', () => {
    it('활성 세션에 오디오를 전송한다', async () => {
      jest.useFakeTimers();
      await service.createSession(
        'session-2', ['ko'], undefined,
        jest.fn(), jest.fn(), jest.fn(), jest.fn(), jest.fn(), jest.fn(),
      );

      const audio = Buffer.from([0x01, 0x02]);
      service.writeAudio('session-2', audio);
      expect(mockSendAudio).toHaveBeenCalledWith(audio);
      jest.useRealTimers();
    });

    it('없는 세션은 무시한다', () => {
      service.writeAudio('no-session', Buffer.alloc(4));
      expect(mockSendAudio).not.toHaveBeenCalled();
    });
  });

  describe('closeSession', () => {
    it('세션을 종료한다', async () => {
      jest.useFakeTimers();
      await service.createSession(
        'session-3', ['ko'], undefined,
        jest.fn(), jest.fn(), jest.fn(), jest.fn(), jest.fn(), jest.fn(),
      );

      service.closeSession('session-3');
      expect(mockClose).toHaveBeenCalled();
      jest.useRealTimers();
    });

    it('없는 세션 종료는 무시한다', () => {
      expect(() => service.closeSession('no-session')).not.toThrow();
    });
  });
});
