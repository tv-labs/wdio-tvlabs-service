import { describe, it, expect, vi, afterEach } from 'vitest';
import * as phoenix from 'phoenix';
import { randomUUID } from 'crypto';

import { TVLabsChannel } from '../src/channel';

vi.mock('phoenix', () => {
  return {
    Socket: vi.fn().mockImplementation(() => fakeSocket)
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('TV Labs Channel', () => {
  it('should be a function', () => {
    expect(TVLabsChannel).toBeInstanceOf(Function);
  });

  it('can be instantiated', () => {
    const channel = new TVLabsChannel('ws://localhost:12345', 5, 'my-api-key');

    expect(channel).toBeInstanceOf(TVLabsChannel);
  });

  it('calls connect and join on connect', async () => {
    const channel = new TVLabsChannel('ws://localhost:12345', 5, 'my-api-key');

    await channel.connect();

    expect(vi.mocked(phoenix.Socket)).toHaveBeenCalledWith('ws://localhost:12345', expect.objectContaining({
      params: {
        api_key: 'my-api-key',
      },
    }));
    expect(fakeSocket.connect).toHaveBeenCalledOnce();
    expect(fakeChannel.join).toHaveBeenCalled();
  });

  it('can create a new session', async () => {
    const requestId = randomUUID();
    const sessionId = randomUUID();

    const channel = new TVLabsChannel('ws://localhost:12345', 5, 'my-api-key');

    await channel.connect();

    mockSuccessfulRequest(requestId, sessionId);

    const result = await channel.newSession({
      'tvlabs:constraints': {
        'platform_key': 'roku',
      },
      'tvlabs:build': '6277d0d7-71de-4f72-9427-aaaf831e0122'
    }, 5, 0);

    expect(result).toEqual(sessionId);
    expect(fakeChannel.push).toHaveBeenCalledWith('requests:create', expect.objectContaining({
      capabilities: {
        'tvlabs:constraints': {
          'platform_key': 'roku',
        },
        'tvlabs:build': '6277d0d7-71de-4f72-9427-aaaf831e0122'
      }
    }));
  })
});

const fakeChannel = {
  join: vi.fn().mockReturnThis(),
  push: vi.fn().mockReturnThis(),
  on: vi.fn().mockReturnThis(),
  off: vi.fn().mockReturnThis(),
  leave: vi.fn().mockReturnThis(),
  receive: vi.fn().mockImplementation((event, callback) => {
    if (event === 'ok') {
      callback({});
    }

    return this;
  })
};

const fakeSocket = {
  connect: vi.fn(),
  channel: vi.fn(() => fakeChannel),
  onError: vi.fn(),
};

function mockSuccessfulRequest(requestId: string, sessionId: string) {
  fakeChannel.receive.mockImplementation((e, callback) => {
    if (e === 'ok') {
      callback({ request_id: requestId });
    }

    return fakeChannel;
  });

  fakeChannel.on.mockImplementation((event, handler) => {
    if (event === 'session:ready') {
      handler({
        request_id: requestId,
        session_id: sessionId,
      });
    }

    return fakeChannel;
  });
}

// function mockFailedRequest(requestId: string) {
//   fakeChannel.receive.mockImplementation((e, callback) => {
//     if (e === 'ok') {
//       callback({ request_id: requestId });
//     }

//     return fakeChannel;
//   });

//   fakeChannel.on.mockImplementation((event, handler) => {
//     if (event === 'request:failed') {
//       handler({
//         request_id: requestId,
//         reason: 'Request failed'
//       });
//     }

//     return fakeChannel;
//   });
// }