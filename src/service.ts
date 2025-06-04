import { SevereServiceError } from 'webdriverio';
import crypto from 'crypto';
import chalk from 'chalk';

import { TVLabsChannel } from './channel.js';
import { log } from './logger.js';

import type { Services, Capabilities, Options } from '@wdio/types';
import type { TVLabsCapabilities, TVLabsServiceOptions } from './types.js';

export default class TVLabsService implements Services.ServiceInstance {
  constructor(
    private _options: TVLabsServiceOptions,
    private _capabilities: Capabilities.ResolvedTestrunnerCapabilities,
    private _config: Options.WebdriverIO,
  ) {
    if (this.attachRequestId()) {
      this.setupRequestId();
    }
  }

  onPrepare(
    _config: Options.Testrunner,
    param: Capabilities.TestrunnerCapabilities,
  ) {
    if (!Array.isArray(param)) {
      throw new SevereServiceError(
        'Multi-remote capabilities are not implemented. Contact TV Labs support if you are interested in this feature.',
      );
    }
  }

  async beforeSession(
    _config: Omit<Options.Testrunner, 'capabilities'>,
    capabilities: TVLabsCapabilities,
    _specs: string[],
    _cid: string,
  ) {
    const channel = new TVLabsChannel(
      this.endpoint(),
      this.reconnectRetries(),
      this.apiKey(),
    );

    await channel.connect();

    capabilities['tvlabs:session_id'] = await channel.newSession(
      capabilities,
      this.retries(),
    );

    await channel.disconnect();
  }

  private setupRequestId() {
    const originalTransformRequest = this._config.transformRequest;

    this._config.transformRequest = (requestOptions: RequestInit) => {
      const requestId = crypto.randomUUID();
      const originalRequestOptions =
        typeof originalTransformRequest === 'function'
          ? originalTransformRequest(requestOptions)
          : requestOptions;

      if (typeof originalRequestOptions.headers === 'undefined') {
        originalRequestOptions.headers = <HeadersInit>{};
      }

      this.setRequestHeader(
        originalRequestOptions.headers,
        'x-request-id',
        requestId,
      );

      log.info(chalk.blue('ATTACHED REQUEST ID'), requestId);

      return originalRequestOptions;
    };
  }

  private setRequestHeader(
    headers: RequestInit['headers'],
    header: string,
    value: string,
  ) {
    if (headers instanceof Headers) {
      headers.set(header, value);
    } else if (typeof headers === 'object') {
      if (Array.isArray(headers)) {
        headers.push([header, value]);
      } else {
        headers[header] = value;
      }
    }
  }

  private endpoint(): string {
    return this._options.endpoint ?? 'wss://tvlabs.ai/appium';
  }

  private retries(): number {
    return this._options.retries ?? 3;
  }

  private apiKey(): string {
    return this._options.apiKey;
  }

  private attachRequestId(): boolean {
    return this._options.attachRequestId ?? true;
  }

  private reconnectRetries(): number {
    return this._options.reconnectRetries ?? 5;
  }
}
