import { WebSocket } from 'ws';
import { Socket, type Channel } from 'phoenix';
import { SevereServiceError } from 'webdriverio';
import { Logger } from './logger.js';
import { getServiceInfo } from './utils.js';

import type {
  TVLabsCapabilities,
  TVLabsSocketParams,
  TVLabsSessionRequestEventHandler,
  TVLabsSessionRequestResponse,
  LogLevel,
} from './types.js';
import type { PhoenixChannelJoinResponse } from './phoenix.js';

export class TVLabsChannel {
  private socket: Socket;
  private lobbyTopic: Channel;
  private requestTopic?: Channel;
  private log: Logger;

  private readonly events = {
    SESSION_READY: 'session:ready',
    SESSION_FAILED: 'session:failed',
    REQUEST_CANCELED: 'request:canceled',
    REQUEST_FAILED: 'request:failed',
    REQUEST_FILLED: 'request:filled',
    REQUEST_MATCHING: 'request:matching',
  } as const;

  constructor(
    private endpoint: string,
    private maxReconnectRetries: number,
    private key: string,
    private logLevel: LogLevel = 'info',
  ) {
    this.log = new Logger('@tvlabs/wdio-channel', this.logLevel);
    this.socket = new Socket(this.endpoint, {
      transport: WebSocket,
      params: this.params(),
      reconnectAfterMs: this.reconnectAfterMs.bind(this),
    });

    this.socket.onError((...args) =>
      TVLabsChannel.logSocketError(this.log, ...args),
    );

    this.lobbyTopic = this.socket.channel('requests:lobby');
  }

  async disconnect(): Promise<void> {
    return new Promise((res, _rej) => {
      this.lobbyTopic.leave();
      this.requestTopic?.leave();
      this.socket.disconnect(() => res());
    });
  }

  async connect(): Promise<void> {
    try {
      this.log.debug('Connecting to TV Labs...');

      this.socket.connect();

      await this.join(this.lobbyTopic);

      this.log.debug('Connected to TV Labs!');
    } catch (error) {
      this.log.error('Error connecting to TV Labs:', error);
      throw new SevereServiceError(
        'Could not connect to TV Labs, please check your connection.',
      );
    }
  }

  async newSession(
    capabilities: TVLabsCapabilities,
    maxRetries: number,
    retry = 0,
  ): Promise<string> {
    try {
      const requestId = await this.requestSession(capabilities);
      const sessionId = await this.observeRequest(requestId);

      return sessionId;
    } catch {
      return this.handleRetry(capabilities, maxRetries, retry);
    }
  }

  private async handleRetry(
    capabilities: TVLabsCapabilities,
    maxRetries: number,
    retry: number,
  ): Promise<string> {
    if (retry < maxRetries) {
      this.log.warn(
        `Could not create a session, retrying (${retry + 1}/${maxRetries})`,
      );

      return this.newSession(capabilities, maxRetries, retry + 1);
    } else {
      throw new SevereServiceError(
        `Could not create a session after ${maxRetries} attempts.`,
      );
    }
  }

  private async observeRequest(requestId: string): Promise<string> {
    const cleanup = () => this.unobserveRequest();

    return new Promise<string>((res, rej) => {
      this.requestTopic = this.socket.channel(`requests:${requestId}`);

      const eventHandlers: Record<string, TVLabsSessionRequestEventHandler> = {
        // Information events
        [this.events.REQUEST_MATCHING]: ({ request_id }) => {
          this.log.info(`Session request ${request_id} matching...`);
        },
        [this.events.REQUEST_FILLED]: ({ session_id, request_id }) => {
          this.log.info(
            `Session request ${request_id} filled: ${this.tvlabsSessionLink(session_id)}`,
          );

          this.log.info('Waiting for device to be ready...');
        },

        // Failure events
        [this.events.SESSION_FAILED]: ({ session_id, reason }) => {
          this.log.error(`Session ${session_id} failed, reason: ${reason}`);
          rej(reason);
        },
        [this.events.REQUEST_CANCELED]: ({ request_id, reason }) => {
          this.log.info(
            `Session request ${request_id} canceled, reason: ${reason}`,
          );
          rej(reason);
        },
        [this.events.REQUEST_FAILED]: ({ request_id, reason }) => {
          this.log.info(
            `Session request ${request_id} failed, reason: ${reason}`,
          );
          rej(reason);
        },

        // Ready event
        [this.events.SESSION_READY]: ({ session_id }) => {
          this.log.info(`Session ${session_id} ready!`);
          res(session_id);
        },
      };

      Object.entries(eventHandlers).forEach(([event, handler]) => {
        this.requestTopic?.on(event, handler);
      });

      this.join(this.requestTopic).catch((err) => {
        rej(err);
      });
    }).finally(cleanup);
  }

  private unobserveRequest() {
    Object.values(this.events).forEach((event) => {
      this.requestTopic?.off(event);
    });

    this.requestTopic?.leave();

    this.requestTopic = undefined;
  }

  private async requestSession(
    capabilities: TVLabsCapabilities,
  ): Promise<string> {
    this.log.info('Requesting TV Labs session');

    try {
      const response = await this.push<TVLabsSessionRequestResponse>(
        this.lobbyTopic,
        'requests:create',
        { capabilities },
      );

      this.log.info(
        `Received session request ID: ${response.request_id}. Waiting for a match...`,
      );

      return response.request_id;
    } catch (error) {
      this.log.error('Error requesting session:', error);
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
    return {
      ...getServiceInfo(),
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

  private tvlabsSessionLink(sessionId: string) {
    return `https://tvlabs.ai/app/sessions/${sessionId}`;
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
}
