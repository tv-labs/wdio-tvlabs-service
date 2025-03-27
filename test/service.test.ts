import { randomUUID } from 'crypto';
import TVLabsService, { type TVLabsCapabilities } from '../src/index.js';

const fakeTVLabsChannel = {
  connect: vi.fn(),
  newSession: vi.fn(),
};

vi.mock('../src/channel', () => {
  return {
    TVLabsChannel: vi.fn().mockImplementation(() => fakeTVLabsChannel),
  };
});

describe('TVLabsService', () => {
  it('should be a function', () => {
    expect(TVLabsService).toBeInstanceOf(Function);
  });

  it('can be instantiated', () => {
    const options = { apiKey: 'my-api-key' };
    const capabilities: TVLabsCapabilities = {
      'tvlabs:constraints': {
        platform_key: 'roku',
      },
      'tvlabs:build': '6277d0d7-71de-4f72-9427-aaaf831e0122',
    };
    const config = {};

    const service = new TVLabsService(options, capabilities, config);

    expect(service).toBeInstanceOf(TVLabsService);
  });

  describe('onPrepare', () => {
    it('does not throw if no multi-remote capabilities are provided', () => {
      const options = { apiKey: 'my-api-key' };
      const config = {};
      const capabilities: TVLabsCapabilities = {};

      const service = new TVLabsService(options, capabilities, config);

      expect(() => service.onPrepare(config, [capabilities])).not.toThrow();
    });

    it('throws if multi-remote capabilities are provided', () => {
      const options = { apiKey: 'my-api-key' };
      const config = {};
      const capabilities = {
        remoteOne: { capabilities: {} },
        remoteTwo: { capabilities: {} },
      };

      const service = new TVLabsService(options, {}, config);

      expect(() => service.onPrepare(config, capabilities)).toThrowError(
        'Multi-remote capabilities are not implemented. Contact TV Labs support if you are interested in this feature.',
      );
    });
  });

  describe('beforeSession', () => {
    it('requests a session and modifies the provided capabilities', async () => {
      const config = {};
      const specs: string[] = [];
      const cid = '';
      const sessionId = randomUUID();
      const options = { apiKey: 'my-api-key' };
      const capabilities: TVLabsCapabilities = {
        'tvlabs:constraints': {
          platform_key: 'roku',
        },
        'tvlabs:build': '6277d0d7-71de-4f72-9427-aaaf831e0122',
      };

      fakeTVLabsChannel.newSession.mockResolvedValue(sessionId);

      const service = new TVLabsService(options, capabilities, config);

      await service.beforeSession(config, capabilities, specs, cid);

      expect(fakeTVLabsChannel.connect).toHaveBeenCalled();
      expect(fakeTVLabsChannel.newSession).toHaveBeenCalledWith(
        capabilities,
        expect.any(Number),
      );
      expect(capabilities['tvlabs:session_id']).toEqual(sessionId);
    });
  });
});
