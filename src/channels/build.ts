import { WebSocket } from 'ws';
import { Socket, type Channel } from 'phoenix';
import { SevereServiceError } from 'webdriverio';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { Logger } from '../logger.js';
import { getServiceInfo } from '../utils.js';

import type {
  TVLabsSocketParams,
  TVLabsExtractBuildInfoResponse,
  TVLabsRequestUploadUrlResponse,
  TVLabsBuildMetadata,
  LogLevel,
} from '../types.js';
import type { PhoenixChannelJoinResponse } from '../phoenix.js';

export class BuildChannel {
  private socket: Socket;
  private lobbyTopic: Channel;
  private log: Logger;

  constructor(
    private endpoint: string,
    private maxReconnectRetries: number,
    private key: string,
    private logLevel: LogLevel = 'info',
  ) {
    this.log = new Logger('@tvlabs/build-channel', this.logLevel);

    this.socket = new Socket(this.endpoint, {
      transport: WebSocket,
      params: this.params(),
      reconnectAfterMs: this.reconnectAfterMs.bind(this),
    });

    this.socket.onError((...args) =>
      BuildChannel.logSocketError(this.log, ...args),
    );

    this.lobbyTopic = this.socket.channel('upload:lobby');
  }

  async disconnect(): Promise<void> {
    return new Promise((res, _rej) => {
      this.lobbyTopic.leave();
      this.socket.disconnect(() => res());
    });
  }

  async connect(): Promise<void> {
    try {
      this.log.debug('Connecting to build channel...');

      this.socket.connect();

      await this.join(this.lobbyTopic);

      this.log.debug('Connected to build channel!');
    } catch (error) {
      this.log.error('Error connecting to build channel:', error);
      throw new SevereServiceError(
        'Could not connect to build channel, please check your connection.',
      );
    }
  }

  async uploadBuild(buildPath: string, appSlug?: string): Promise<string> {
    const metadata = this.getFileMetadata(buildPath);

    this.log.info(
      `Requesting upload for build ${metadata.filename} (${metadata.type}, ${metadata.size} bytes)`,
    );

    const { url, build_id } = await this.requestUploadUrl(metadata, appSlug);

    this.log.info('Uploading build...');

    await this.uploadToUrl(url, buildPath, metadata);

    const { application_id } = await this.extractBuildInfo();

    this.log.info(`Build "${application_id}" processed successfully`);

    return build_id;
  }

  private async requestUploadUrl(
    metadata: TVLabsBuildMetadata,
    appSlug: string | undefined,
  ) {
    try {
      return await this.push<TVLabsRequestUploadUrlResponse>(
        this.lobbyTopic,
        'request_upload_url',
        { metadata, application_slug: appSlug },
      );
    } catch (error) {
      this.log.error('Error requesting upload URL:', error);
      throw error;
    }
  }

  private async uploadToUrl(
    url: string,
    filePath: string,
    metadata: TVLabsBuildMetadata,
  ): Promise<void> {
    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': metadata.type,
          'Content-Length': String(metadata.size),
        },
        // Can we use a stream here?
        body: fs.readFileSync(filePath),
      });

      if (!response.ok) {
        throw new SevereServiceError(
          `Failed to upload build to storage, got ${response.status}`,
        );
      }

      this.log.info('Upload complete');
    } catch (error) {
      this.log.error('Error uploading build:', error);
      throw error;
    }
  }

  private async extractBuildInfo() {
    this.log.info('Processing uploaded build...');

    try {
      return await this.push<TVLabsExtractBuildInfoResponse>(
        this.lobbyTopic,
        'extract_build_info',
        {},
      );
    } catch (error) {
      this.log.error('Error processing build:', error);
      throw error;
    }
  }

  private async join(topic: Channel): Promise<void> {
    return new Promise((res, rej) => {
      topic
        .join()
        .receive('ok', (_resp: PhoenixChannelJoinResponse) => {
          res();
        })
        .receive('error', ({ response }: PhoenixChannelJoinResponse) => {
          rej('Failed to join topic: ' + response);
        })
        .receive('timeout', () => {
          rej('timeout');
        });
    });
  }

  private async push<T>(
    topic: Channel,
    event: string,
    payload: object,
  ): Promise<T> {
    return new Promise((res, rej) => {
      topic
        .push(event, payload)
        .receive('ok', (msg: T) => {
          res(msg);
        })
        .receive('error', (reason: string) => {
          rej(reason);
        })
        .receive('timeout', () => {
          rej('timeout');
        });
    });
  }

  private params(): TVLabsSocketParams {
    const serviceInfo = getServiceInfo();

    this.log.debug('Info:', serviceInfo);

    return {
      ...serviceInfo,
      api_key: this.key,
    };
  }

  private reconnectAfterMs(tries: number) {
    if (tries > this.maxReconnectRetries) {
      throw new SevereServiceError(
        'Could not connect to TV Labs, please check your connection.',
      );
    }

    const wait = [0, 1000, 3000, 5000][tries] || 10000;

    this.log.info(
      `[${tries}/${this.maxReconnectRetries}] Waiting ${wait}ms before re-attempting to connect...`,
    );

    return wait;
  }

  private static logSocketError(
    log: Logger,
    event: ErrorEvent,
    _transport: new (endpoint: string) => object,
    _establishedConnections: number,
  ) {
    const error = event.error;

    log.error('Socket error:', error || event);
  }

  private getFileMetadata(buildPath: string): TVLabsBuildMetadata {
    const filename = path.basename(buildPath);
    const size = fs.statSync(buildPath).size;
    const type = this.detectMimeType(filename);
    return { filename, type, size };
  }

  private detectMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    switch (ext) {
      case '.apk':
        return 'application/vnd.android.package-archive';
      case '.zip':
        return 'application/zip';
      default:
        return 'application/octet-stream';
    }
  }
}
