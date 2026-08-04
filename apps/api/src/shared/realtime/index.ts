/**
 * Real-time delivery over WebSocket — S5-11 (FR-SOC-022, ADR-0016).
 *
 * Three problems, three answers:
 *
 * 1. **A browser cannot set an `Authorization` header on a WebSocket.** The upgrade request is
 *    issued by the platform, not by fetch. So a connection is authorized by a **ticket**: a
 *    short-lived, single-use, opaque string the client obtains over the ordinary authenticated
 *    API and then presents in the query string. An access token in a URL would end up in access
 *    logs, referrers and browser history; a ticket that dies on first use and after thirty seconds
 *    is worth almost nothing to whoever finds it there.
 * 2. **The recipient may be connected to a different replica.** Redis pub/sub carries the payload
 *    to every instance; each delivers only to sockets it holds. No sticky sessions, no shared
 *    socket table.
 * 3. **A socket that dies quietly still consumes a slot.** Every connection is pinged on an
 *    interval and dropped if it does not answer, because a half-open TCP connection through a
 *    load balancer looks exactly like an idle one.
 *
 * **This channel is a delivery optimisation and never an authority.** Everything it carries is
 * already readable over the REST API, which authorizes each read independently. The payloads here
 * deliberately carry no message body — a client is told *that* something changed and re-reads it
 * through an endpoint that checks whether it still may.
 */
import { randomBytes } from 'node:crypto';

import { WebSocketServer, type WebSocket } from 'ws';

import type { Logger } from '../logger/index.js';
import type { Server } from 'node:http';
import type { Redis } from 'ioredis';

/** Where a client connects. Distinct from `/api/v1` because it is not a versioned REST surface. */
export const REALTIME_PATH = '/ws';

/** Long enough to survive a slow page load, short enough that a leaked one is worthless. */
const TICKET_TTL_SECONDS = 30;

const PING_INTERVAL_MS = 30_000;

const CHANNEL_PREFIX = 'ws:account:';

/**
 * What the server tells a client. Deliberately thin: an id and a hint, never content.
 *
 * A payload carrying the message body would be a second read path with its own authorization to
 * get wrong — and would keep delivering to a socket opened before the sender blocked the
 * recipient. Telling the client only that a thread moved forces it back through the API, which
 * re-checks.
 */
export interface RealtimeEvent {
  type: 'message.created' | 'message.read';
  threadId: string;
}

export interface Realtime {
  /** Issues a ticket for an account. The caller must already have authenticated them. */
  issueTicket: (accountId: string) => Promise<{ ticket: string; expiresInSeconds: number }>;
  /** Delivers to every socket that account has open, on any replica. */
  publish: (accountId: string, event: RealtimeEvent) => Promise<void>;
  attach: (server: Server) => void;
  /** Sockets currently held by *this* process. Test and metrics use only. */
  localConnections: () => number;
  close: () => Promise<void>;
}

export interface RealtimeDeps {
  /** For tickets and publishing. Ordinary commands; must not be the subscriber. */
  redis: Redis;
  /**
   * Held in subscriber mode. ioredis forbids ordinary commands on a subscribed connection, so
   * this cannot be the same client as above — a single connection would make `issueTicket` throw
   * the moment the first socket connected.
   */
  subscriber: Redis;
  logger: Logger;
}

interface Connection {
  socket: WebSocket;
  accountId: string;
  alive: boolean;
}

export function createRealtime({ redis, subscriber, logger }: RealtimeDeps): Realtime {
  /** accountId → its open sockets on this process. A person may have several tabs. */
  const connections = new Map<string, Set<Connection>>();
  let wss: WebSocketServer | undefined;
  let heartbeat: NodeJS.Timeout | undefined;

  function ticketKey(ticket: string): string {
    return `ws:ticket:${ticket}`;
  }

  function deliver(accountId: string, raw: string): void {
    const sockets = connections.get(accountId);
    if (!sockets) return;

    for (const connection of sockets) {
      // readyState is checked rather than assumed: a socket can close between the pub/sub
      // callback and this line, and `send` on a closed socket throws.
      if (connection.socket.readyState === connection.socket.OPEN) {
        connection.socket.send(raw);
      }
    }
  }

  async function subscribeFor(accountId: string): Promise<void> {
    if (connections.get(accountId)?.size === 1) {
      await subscriber.subscribe(`${CHANNEL_PREFIX}${accountId}`);
    }
  }

  async function unsubscribeFor(accountId: string): Promise<void> {
    if (!connections.has(accountId)) {
      await subscriber.unsubscribe(`${CHANNEL_PREFIX}${accountId}`);
    }
  }

  subscriber.on('message', (channel: string, raw: string) => {
    deliver(channel.slice(CHANNEL_PREFIX.length), raw);
  });

  function register(accountId: string, connection: Connection): void {
    const existing = connections.get(accountId);
    if (existing) {
      existing.add(connection);
    } else {
      connections.set(accountId, new Set([connection]));
    }
  }

  function unregister(accountId: string, connection: Connection): void {
    const sockets = connections.get(accountId);
    if (!sockets) return;

    sockets.delete(connection);
    if (sockets.size === 0) connections.delete(accountId);
  }

  return {
    issueTicket: async (accountId) => {
      const ticket = randomBytes(32).toString('base64url');

      // The ticket is the key, not the value: nothing about the account is derivable from the
      // string itself, so one seen in a log is not even an account identifier.
      await redis.set(ticketKey(ticket), accountId, 'EX', TICKET_TTL_SECONDS);

      return { ticket, expiresInSeconds: TICKET_TTL_SECONDS };
    },

    publish: async (accountId, event) => {
      try {
        await redis.publish(`${CHANNEL_PREFIX}${accountId}`, JSON.stringify(event));
      } catch (error) {
        // The message is already saved. Failing the sender's request because a delivery hint
        // could not be sent would report an error for something that succeeded — the recipient
        // simply sees it on their next read, which is exactly the pre-websocket behaviour.
        logger.warn({ err: error, type: event.type }, 'Realtime publish failed');
      }
    },

    attach: (server) => {
      // `noServer` rather than letting ws own the HTTP server: the API serves REST on the same
      // port, and ws would otherwise reject or hijack upgrades on paths that are not ours.
      wss = new WebSocketServer({ noServer: true });

      server.on('upgrade', (request, socket, head) => {
        const url = new URL(request.url ?? '/', 'http://localhost');
        if (url.pathname !== REALTIME_PATH) return;

        const ticket = url.searchParams.get('ticket');

        void (async () => {
          // GETDEL makes the ticket single-use atomically. Read-then-delete would let two
          // connections race through the same ticket.
          const accountId = ticket ? await redis.getdel(ticketKey(ticket)) : null;

          if (!accountId) {
            // No body and no detail: an unauthenticated caller learns only that it failed.
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
          }

          wss?.handleUpgrade(request, socket, head, (ws) => {
            const connection: Connection = { socket: ws, accountId, alive: true };
            register(accountId, connection);
            void subscribeFor(accountId);

            ws.on('pong', () => {
              connection.alive = true;
            });

            // Nothing a client sends is acted on. Every write in this product goes through the
            // authorized REST API; accepting commands here would be a second, weaker door.
            ws.on('message', () => undefined);

            ws.on('close', () => {
              unregister(accountId, connection);
              void unsubscribeFor(accountId);
            });

            ws.on('error', (error) => {
              logger.warn({ err: error }, 'Realtime socket error');
            });
          });
        })().catch((error: unknown) => {
          logger.warn({ err: error }, 'Realtime upgrade failed');
          socket.destroy();
        });
      });

      heartbeat = setInterval(() => {
        for (const sockets of connections.values()) {
          for (const connection of sockets) {
            if (!connection.alive) {
              // Missed the last round trip. Terminate rather than close: a half-open socket will
              // not complete a closing handshake, and waiting for one leaks the slot.
              connection.socket.terminate();
              continue;
            }

            connection.alive = false;
            connection.socket.ping();
          }
        }
      }, PING_INTERVAL_MS);

      // Node keeps the process alive for a pending timer; a heartbeat must not be the reason a
      // worker-less API refuses to exit.
      heartbeat.unref();
    },

    localConnections: () => {
      let total = 0;
      for (const sockets of connections.values()) total += sockets.size;
      return total;
    },

    close: async () => {
      if (heartbeat) clearInterval(heartbeat);

      for (const sockets of connections.values()) {
        for (const connection of sockets) connection.socket.terminate();
      }
      connections.clear();

      await subscriber.unsubscribe();
      wss?.close();
    },
  };
}
