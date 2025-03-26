import { SevereServiceError } from 'webdriverio';
import { TVLabsChannel } from './channel.js';

import type { Services, Capabilities, Options } from '@wdio/types';
import type { TVLabsCapabilities, TVLabsServiceOptions } from './types.js';

export default class TVLabsService implements Services.ServiceInstance {
  constructor(
    private _options: TVLabsServiceOptions,
    private _capabilities: Capabilities.ResolvedTestrunnerCapabilities,
    private _config: Options.WebdriverIO,
  ) {}

  async onPrepare(
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
