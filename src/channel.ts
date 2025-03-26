import { Socket, type Channel } from 'phoenix';
import WebSocket from 'ws';
import logger from '@wdio/logger';
import { SevereServiceError } from 'webdriverio';

import type {
  TVLabsCapabilities,
  TVLabsSessionChannelParams,
  TVLabsSessionRequestEventHandler,
  TVLabsSessionRequestResponse,
} from './types.js';
import type { PhoenixChannelJoinResponse } from './phoenix.js';

const log = logger('TVLabsChannel');

export class TVLabsChannel {
  private socket: Socket;
  private lobbyTopic: Channel;
  private requestTopic?: Channel;

  private readonly events = {
    SESSION_READY: 'session:ready',
    SESSION_FAILED: 'session:failed',
    REQUEST_CANCELED: 'request:canceled',
    REQUEST_FAILED: 'request:failed',
    REQUEST_FILLED: 'request:filled',
    REQUEST_MATCHING: 'request:matching',
  } as const;

  constructor(
    private endpoint: string = 'ws://localhost:4000/appium',
    private maxReconnectRetries: number,
    private key: string,
  ) {
    this.socket = new Socket(this.endpoint, {
      transport: WebSocket,
      params: this.params(),
      reconnectAfterMs: this.reconnectAfterMs.bind(this),
    });

    this.socket.onError(this.logSocketError);

    this.lobbyTopic = this.socket.channel('requests:lobby');
  }

  async connect(): Promise<void> {
    this.socket.connect();

    await this.join(this.lobbyTopic);
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
      log.warn(
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
        [this.events.SESSION_READY]: ({ session_id }) => {
          log.info(`Session ${session_id} ready!`);
          res(session_id);
        },
        [this.events.SESSION_FAILED]: ({ session_id, reason }) => {
          log.error(`Session ${session_id} failed, reason: ${reason}`);
          rej(reason);
        },
        [this.events.REQUEST_CANCELED]: ({ request_id, reason }) => {
          log.info(`Session request ${request_id} canceled, reason: ${reason}`);
          rej(reason);
        },
        [this.events.REQUEST_FAILED]: ({ request_id, reason }) => {
          log.info(`Session request ${request_id} failed, reason: ${reason}`);
          rej(reason);
        },
        [this.events.REQUEST_FILLED]: ({ session_id, request_id }) => {
          log.info(
            `Session request ${request_id} filled, session ID: ${session_id}. Waiting for device to be ready...`,
          );
        },
        [this.events.REQUEST_MATCHING]: ({ request_id }) => {
          log.info(`Session request ${request_id} matching...`);
        },
      };

      Object.entries(eventHandlers).forEach(([event, handler]) => {
        this.requestTopic?.on(event, handler);
      })

      this.join(this.requestTopic).catch((err) => {
        log.error('Error joining request topic:', err);
        rej(err);
      });
    }).finally(cleanup);
  }

  private unobserveRequest() {
    Object.values(this.events).forEach((event) => {
      this.requestTopic?.off(event);
    })

    this.requestTopic?.leave();

    this.requestTopic = undefined;
  }

  private async requestSession(
    capabilities: TVLabsCapabilities,
  ): Promise<string> {
    try {
      const response = await this.push<TVLabsSessionRequestResponse>(
        this.lobbyTopic,
        'requests:create',
        { capabilities },
      );

      log.info('Received session request ID:', response.request_id);

      return response.request_id;
    } catch (error) {
      log.error('Error requesting session:', error);
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
          rej(response);
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

  private params(): TVLabsSessionChannelParams {
    return {
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

    log.info(
      `[${tries}/${this.maxReconnectRetries}] Waiting ${wait}ms before re-attempting to connect...`,
    );

    return wait;
  }

  private logSocketError(
    event: ErrorEvent,
    _transport: new (endpoint: string) => object,
    _establishedConnections: number,
  ) {
    const error = event.error;
    const code = error && error.code;

    log.error('Socket error:', code || error || event);
  }
}
