import * as phoenix from 'phoenix';
import * as fs from 'node:fs';
import { randomUUID } from 'crypto';
import { BuildChannel } from '../../src/channels/build.js';
import { SevereServiceError } from 'webdriverio';

const fakeEndpoint = 'ws://localhost:12345';
const fakeApiKey = 'my-api-key';
const reconnectRetries = 5;
const testBuildPath = '/path/to/test.apk';
const testAppSlug = 'test-app';

vi.stubGlobal('fetch', vi.fn());

vi.mock('phoenix', () => {
  return {
    Socket: vi.fn().mockImplementation(() => fakeSocket),
  };
});

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
  statSync: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockReceive('ok', {});

  vi.mocked(fs.statSync).mockReturnValue({ size: 1024 } as fs.Stats);
  vi.mocked(fs.readFileSync).mockReturnValue(Buffer.from('fake-file-content'));

  vi.mocked(fetch).mockResolvedValue({
    ok: true,
    status: 200,
  } as Response);
});

describe('Build Channel', () => {
  it('should be a function', () => {
    expect(BuildChannel).toBeInstanceOf(Function);
  });

  it('can be instantiated', () => {
    const channel = new BuildChannel(
      fakeEndpoint,
      reconnectRetries,
      fakeApiKey,
    );

    expect(channel).toBeInstanceOf(BuildChannel);
  });

  it('calls connect and join on connect', async () => {
    const channel = new BuildChannel(
      fakeEndpoint,
      reconnectRetries,
      fakeApiKey,
    );

    await channel.connect();

    expect(vi.mocked(phoenix.Socket)).toHaveBeenCalledWith(
      fakeEndpoint,
      expect.objectContaining({
        params: {
          api_key: fakeApiKey,
          service_version: expect.not.stringMatching('unknown'),
          service_name: '@tvlabs/wdio-service',
        },
      }),
    );
    expect(fakeSocket.connect).toHaveBeenCalledOnce();
    expect(fakeChannel.join).toHaveBeenCalled();
  });

  it('can upload a build successfully', async () => {
    const buildId = randomUUID();
    const uploadUrl = 'https://storage.example.com/upload';
    const applicationId = 'com.example.app';

    const channel = new BuildChannel(
      fakeEndpoint,
      reconnectRetries,
      fakeApiKey,
    );

    await channel.connect();

    fakeChannel.push
      .mockImplementationOnce((_event) => {
        return {
          receive: vi.fn().mockImplementation((type, callback) => {
            if (type === 'ok') {
              callback({ url: uploadUrl, build_id: buildId });
            }
            return { receive: vi.fn().mockReturnThis() };
          }),
        };
      })
      .mockImplementationOnce((_event) => {
        return {
          receive: vi.fn().mockImplementation((type, callback) => {
            if (type === 'ok') {
              callback({ application_id: applicationId });
            }
            return { receive: vi.fn().mockReturnThis() };
          }),
        };
      });

    const result = await channel.uploadBuild(testBuildPath, testAppSlug);

    expect(result).toEqual(buildId);

    // Verify request_upload_url was called with correct metadata
    expect(fakeChannel.push).toHaveBeenCalledWith(
      'request_upload_url',
      expect.objectContaining({
        metadata: {
          filename: 'test.apk',
          type: 'application/vnd.android.package-archive',
          size: 1024,
        },
        application_slug: testAppSlug,
      }),
    );

    // Verify extract_build_info was called
    expect(fakeChannel.push).toHaveBeenCalledWith('extract_build_info', {});

    // Verify file was uploaded to the URL
    expect(fetch).toHaveBeenCalledWith(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Length': '1024',
      },
      body: expect.any(Buffer),
    });
  });

  it('can upload a build without app slug', async () => {
    const buildId = randomUUID();
    const uploadUrl = 'https://storage.example.com/upload';
    const applicationId = 'com.example.app';

    const channel = new BuildChannel(
      fakeEndpoint,
      reconnectRetries,
      fakeApiKey,
    );

    await channel.connect();

    fakeChannel.push
      .mockImplementationOnce((_event) => {
        return {
          receive: vi.fn().mockImplementation((type, callback) => {
            if (type === 'ok') {
              callback({ url: uploadUrl, build_id: buildId });
            }
            return { receive: vi.fn().mockReturnThis() };
          }),
        };
      })
      .mockImplementationOnce((_event) => {
        return {
          receive: vi.fn().mockImplementation((type, callback) => {
            if (type === 'ok') {
              callback({ application_id: applicationId });
            }
            return { receive: vi.fn().mockReturnThis() };
          }),
        };
      });

    const result = await channel.uploadBuild(testBuildPath);

    expect(result).toEqual(buildId);

    expect(fakeChannel.push).toHaveBeenCalledWith(
      'request_upload_url',
      expect.objectContaining({
        metadata: {
          filename: 'test.apk',
          type: 'application/vnd.android.package-archive',
          size: 1024,
        },
        application_slug: undefined,
      }),
    );
  });

  it('detects correct MIME types for different file extensions', async () => {
    const buildId = randomUUID();
    const uploadUrl = 'https://storage.example.com/upload';
    const applicationId = 'com.example.app';

    const channel = new BuildChannel(
      fakeEndpoint,
      reconnectRetries,
      fakeApiKey,
    );

    await channel.connect();

    // Mock successful responses for both calls
    fakeChannel.push.mockImplementation(() => ({
      receive: vi.fn().mockImplementation((type, callback) => {
        if (type === 'ok') {
          callback({
            url: uploadUrl,
            build_id: buildId,
            application_id: applicationId,
          });
        }
        return { receive: vi.fn().mockReturnThis() };
      }),
    }));

    // Test .zip file
    await channel.uploadBuild('/path/to/test.zip');
    expect(fakeChannel.push).toHaveBeenCalledWith(
      'request_upload_url',
      expect.objectContaining({
        metadata: expect.objectContaining({
          type: 'application/zip',
        }),
      }),
    );

    // Reset and test unknown extension
    vi.clearAllMocks();
    mockReceive('ok', {});
    fakeChannel.push.mockImplementation(() => ({
      receive: vi.fn().mockImplementation((type, callback) => {
        if (type === 'ok') {
          callback({
            url: uploadUrl,
            build_id: buildId,
            application_id: applicationId,
          });
        }
        return { receive: vi.fn().mockReturnThis() };
      }),
    }));

    await channel.uploadBuild('/path/to/test.unknown');
    expect(fakeChannel.push).toHaveBeenCalledWith(
      'request_upload_url',
      expect.objectContaining({
        metadata: expect.objectContaining({
          type: 'application/octet-stream',
        }),
      }),
    );
  });

  it('raises on failed lobby topic join', async () => {
    const channel = new BuildChannel(
      fakeEndpoint,
      reconnectRetries,
      fakeApiKey,
    );

    mockReceive('error', { response: 'unknown error' });

    await expect(() => channel.connect()).rejects.toThrow(SevereServiceError);
  });

  it('raises on topic join timeout', async () => {
    const channel = new BuildChannel(
      fakeEndpoint,
      reconnectRetries,
      fakeApiKey,
    );

    mockReceive('timeout', {});

    await expect(() => channel.connect()).rejects.toThrow(SevereServiceError);
  });

  it('raises on upload URL request timeout', async () => {
    const channel = new BuildChannel(
      fakeEndpoint,
      reconnectRetries,
      fakeApiKey,
    );

    await channel.connect();

    const mockReceiveChain = {
      receive: vi
        .fn()
        .mockImplementation((type: string, callback: () => void) => {
          if (type === 'timeout') {
            // Call the callback immediately to trigger the timeout behavior
            callback();
          }
          return mockReceiveChain;
        }),
    };

    fakeChannel.push.mockImplementation(() => mockReceiveChain);

    await expect(() => channel.uploadBuild(testBuildPath)).rejects.toThrow();
  });

  it('raises on upload URL request error', async () => {
    const channel = new BuildChannel(
      fakeEndpoint,
      reconnectRetries,
      fakeApiKey,
    );

    await channel.connect();

    const mockReceiveChain = {
      receive: vi
        .fn()
        .mockImplementation(
          (type: string, callback: (reason: string) => void) => {
            if (type === 'error') {
              // Call the callback immediately to trigger the error behavior
              callback('Mock error');
            }
            return mockReceiveChain;
          },
        ),
    };

    fakeChannel.push.mockImplementation(() => mockReceiveChain);

    await expect(() => channel.uploadBuild(testBuildPath)).rejects.toThrow();
  });

  it('raises on failed file upload to storage', async () => {
    const buildId = randomUUID();
    const uploadUrl = 'https://storage.example.com/upload';

    const channel = new BuildChannel(
      fakeEndpoint,
      reconnectRetries,
      fakeApiKey,
    );

    await channel.connect();

    // Mock successful request_upload_url
    fakeChannel.push.mockImplementation(() => ({
      receive: vi.fn().mockImplementation((type, callback) => {
        if (type === 'ok') {
          callback({ url: uploadUrl, build_id: buildId });
        }
        return { receive: vi.fn().mockReturnThis() };
      }),
    }));

    // Mock failed upload
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    await expect(() => channel.uploadBuild(testBuildPath)).rejects.toThrow(
      SevereServiceError,
    );
  });

  it('raises on extract build info timeout', async () => {
    const buildId = randomUUID();
    const uploadUrl = 'https://storage.example.com/upload';

    const channel = new BuildChannel(
      fakeEndpoint,
      reconnectRetries,
      fakeApiKey,
    );

    await channel.connect();

    fakeChannel.push
      .mockImplementationOnce((_event) => {
        return {
          receive: vi.fn().mockImplementation((type, callback) => {
            if (type === 'ok') {
              callback({ url: uploadUrl, build_id: buildId });
            }
            return { receive: vi.fn().mockReturnThis() };
          }),
        };
      })
      .mockImplementationOnce((_event) => {
        const mockReceiveChain = {
          receive: vi
            .fn()
            .mockImplementation((type: string, callback: () => void) => {
              if (type === 'timeout') {
                callback();
              }
              return mockReceiveChain;
            }),
        };
        return mockReceiveChain;
      });

    await expect(() => channel.uploadBuild(testBuildPath)).rejects.toThrow();
  });

  it('raises on extract build info error', async () => {
    const buildId = randomUUID();
    const uploadUrl = 'https://storage.example.com/upload';

    const channel = new BuildChannel(
      fakeEndpoint,
      reconnectRetries,
      fakeApiKey,
    );

    await channel.connect();

    fakeChannel.push
      .mockImplementationOnce((_event) => {
        return {
          receive: vi.fn().mockImplementation((type, callback) => {
            if (type === 'ok') {
              callback({ url: uploadUrl, build_id: buildId });
            }
            return { receive: vi.fn().mockReturnThis() };
          }),
        };
      })
      .mockImplementationOnce((_event) => {
        const mockReceiveChain = {
          receive: vi
            .fn()
            .mockImplementation(
              (type: string, callback: (reason: string) => void) => {
                if (type === 'error') {
                  callback('Mock error');
                }
                return mockReceiveChain;
              },
            ),
        };
        return mockReceiveChain;
      });

    await expect(() => channel.uploadBuild(testBuildPath)).rejects.toThrow();
  });

  it('raises on fetch network error', async () => {
    const buildId = randomUUID();
    const uploadUrl = 'https://storage.example.com/upload';

    const channel = new BuildChannel(
      fakeEndpoint,
      reconnectRetries,
      fakeApiKey,
    );

    await channel.connect();

    // Mock successful request_upload_url
    fakeChannel.push.mockImplementation(() => ({
      receive: vi.fn().mockImplementation((type, callback) => {
        if (type === 'ok') {
          callback({ url: uploadUrl, build_id: buildId });
        }
        return { receive: vi.fn().mockReturnThis() };
      }),
    }));

    // Mock network error
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

    await expect(() => channel.uploadBuild(testBuildPath)).rejects.toThrow();
  });
});

const fakeChannel = {
  join: vi.fn().mockReturnThis(),
  push: vi.fn().mockReturnThis(),
  leave: vi.fn().mockReturnThis(),
  receive: vi.fn().mockImplementation((event, callback) => {
    if (event === 'ok') {
      callback({});
    }
    return fakeChannel;
  }),
};

const fakeSocket = {
  connect: vi.fn(),
  channel: vi.fn(() => fakeChannel),
  onError: vi.fn(),
  disconnect: vi.fn((callback?: () => void) => callback?.()),
};

function mockReceive(event: string, response: object) {
  fakeChannel.receive.mockImplementation((e, callback) => {
    if (e === event) {
      callback(response);
    }
    return fakeChannel;
  });
}
