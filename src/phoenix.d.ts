import type { Socket as PhoenixSocket, MessageRef } from 'phoenix';

declare module 'phoenix' {
  interface Socket extends PhoenixSocket {
    onError(
      callback: (
        error: ErrorEvent,
        transport: new (endpoint: string) => object,
        establishedConnections: number,
      ) => void | Promise<void>,
    ): MessageRef;
  }
}

export type PhoenixChannelJoinResponse = {
  status?: string;
  response?: unknown;
};
