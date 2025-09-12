import { type Channel } from 'phoenix';
import { SevereServiceError } from 'webdriverio';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { BaseChannel } from './base.js';

import type {
  TVLabsExtractBuildInfoResponse,
  TVLabsRequestUploadUrlResponse,
  TVLabsBuildMetadata,
  LogLevel,
} from '../types.js';

export class BuildChannel extends BaseChannel {
  private lobbyTopic: Channel;

  constructor(
    endpoint: string,
    maxReconnectRetries: number,
    key: string,
    logLevel: LogLevel = 'info',
  ) {
    super(
      endpoint,
      maxReconnectRetries,
      key,
      logLevel,
      '@tvlabs/build-channel',
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
        // @ts-expect-error - FIXME: fetch types are incorrect
        body: fs.createReadStream(filePath),
        duplex: 'half',
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
