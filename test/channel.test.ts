import { describe, it, expect, vi, afterEach } from 'vitest';
import * as phoenix from 'phoenix';

import { TVLabsChannel } from '../src/channel';
import { TVLabsSessionRequestEventHandler } from '../src/types';

// const receiveMock = {
//   push: vi.fn().mockReturnThis(),
//   receive: vi.fn().mockImplementation((event, callback) => {
//     if (event === 'ok') {
//       callback({});
//     }

//     return this;
//   })
// }

function createFakeResponse(event: string, response: unknown) {
  return (e, callback) => {
    if (e === event) {
      callback(response);
    }

    return fakeChannel;
  }
}

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
    const channel = new TVLabsChannel('ws://localhost:12345', 5, 'my-api-key');

    await channel.connect();

    fakeChannel.receive.mockImplementation(createFakeResponse('new_session', {
      request_id: '1234567890'
    }));

    // const eventHandlers: Record<string, TVLabsSessionRequestEventHandler> = {};
    // fakeChannel.on.mockImplementation((event, handler) => {
    //   eventHandlers[event] = handler;
    //   return fakeChannel;
    // });

    const sessionId = await channel.newSession({
      'tvlabs:constraints': {
        'platform_key': 'roku',
      },
      'tvlabs:build': '6277d0d7-71de-4f72-9427-aaaf831e0122'
    }, 5, 0);

    expect(sessionId).toBeDefined();
    expect(fakeChannel.push).toHaveBeenCalledWith('new_session', expect.objectContaining({
      'tvlabs:constraints': {
        'platform_key': 'roku',
      },
      'tvlabs:build': '6277d0d7-71de-4f72-9427-aaaf831e0122'
    }));
  })
});
