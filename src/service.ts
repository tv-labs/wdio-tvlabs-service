import { SevereServiceError } from 'webdriverio';
import { TVLabsChannel } from './channel.js';
import crypto from 'crypto';
import { log } from './logger.js';
import chalk from 'chalk';

import type { Services, Capabilities, Options } from '@wdio/types';
import type { TVLabsCapabilities, TVLabsServiceOptions } from './types.js';

export default class TVLabsService implements Services.ServiceInstance {
  constructor(
    private _options: TVLabsServiceOptions,
    private _capabilities: Capabilities.ResolvedTestrunnerCapabilities,
    private _config: Options.WebdriverIO,
  ) {
    this.setupRequestId();
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
      
      this.setRequestHeader(requestOptions.headers, 'x-request-id', requestId);
      
      log.info(chalk.blue('REQUEST ID'), requestId);

      return typeof originalTransformRequest === 'function'
        ? originalTransformRequest(requestOptions)
        : requestOptions;
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
    return this._options.endpoint || 'wss://tvlabs.ai/appium';
  }

  private retries(): number {
    return this._options.retries || 3;
  }

  private apiKey(): string {
    return this._options.apiKey;
  }

  private reconnectRetries(): number {
    return this._options.reconnectRetries || 5;
  }
}
