import { randomInt, randomUUID } from 'crypto';
import { SevereServiceError } from 'webdriverio';
import TVLabsService, { type TVLabsCapabilities } from '../src/index.js';
import { TVLabsChannel } from '../src/channel.js';

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

    it('passes set options to the channel', async () => {
      const config = {};
      const specs: string[] = [];
      const cid = '';
      const capabilities: TVLabsCapabilities = {};
      const options = {
        apiKey: randomUUID(),
        retries: randomInt(1, 10),
        reconnectRetries: randomInt(1, 10),
        endpoint: randomUUID(),
      };

      const service = new TVLabsService(options, capabilities, config);

      await service.beforeSession(config, capabilities, specs, cid);

      expect(vi.mocked(TVLabsChannel)).toHaveBeenCalledWith(
        options.endpoint,
        options.reconnectRetries,
        options.apiKey,
      );
      expect(fakeTVLabsChannel.newSession).toHaveBeenCalledWith(
        capabilities,
        options.retries,
      );
    });

    it('bubbles any errors from the channel', async () => {
      const config = {};
      const specs: string[] = [];
      const cid = '';
      const options = { apiKey: 'my-api-key' };
      const capabilities: TVLabsCapabilities = {};

      fakeTVLabsChannel.newSession.mockRejectedValue(
        new SevereServiceError('Could not create a new session.'),
      );

      const service = new TVLabsService(options, capabilities, config);

      await expect(
        service.beforeSession(config, capabilities, specs, cid),
      ).rejects.toThrow('Could not create a new session.');
    });
  });
});

const fakeTVLabsChannel = {
  connect: vi.fn(),
  newSession: vi.fn(),
};
