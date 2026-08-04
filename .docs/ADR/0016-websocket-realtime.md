# ADR-0016 — Real-time delivery over WebSocket, authorized by a single-use ticket

`Status: Accepted` · `Date: 2026-08-04` · Supersedes: — · Superseded by: —

> ADR numbering skips **0015**, which `Sprint/05-sprint-5.md` reserves for the payment-provider
> decision (S5-0a). Taking it here would break a reference that several documents already make.

## Context

`FR-SOC-022` (P2) asks for sub-second message delivery when both parties are online, instead of
polling. Messaging shipped in S4-7 and the web app reads it on navigation, so a recipient currently
learns about a message when they next load a page.

Three constraints shape the answer.

**A browser cannot set an `Authorization` header on a WebSocket.** The upgrade request is issued by
the platform, not by `fetch`, and the WebSocket API exposes no header parameter. Every option
therefore moves the credential somewhere other than a header.

**The recipient may be connected to a different replica than the sender's request landed on.** The
API is stateless and horizontally scaled; a socket table in one process is invisible to the others.

**The web app is a BFF.** The browser holds no API credential at all — `apps/web` keeps the access
token in an httpOnly cookie on its own origin and calls the API server-side. So whatever the
browser presents to the API must be obtained through the Next app first.

## Decision

**A WebSocket at `/ws` on the API, authorized by a short-lived single-use ticket, fanned out over
Redis pub/sub.**

1. The browser asks the Next app for a ticket; the Next app calls `POST /me/realtime-ticket` with
   its bearer token and returns the opaque string.
2. The browser opens `wss://api/ws?ticket=…`. The server `GETDEL`s the ticket — atomically, so two
   connections cannot race through one — and binds the socket to that account.
3. Sending a message publishes to `ws:account:<recipient>`. Every replica subscribes for the
   accounts it holds sockets for and delivers to those sockets only.

**The payload carries no content.** A frame says a thread moved (`{ type, threadId }`) and nothing
else. The client re-reads through the REST API, which authorizes the read.

## Why not the alternatives

**Access token in the query string.** Simplest, and the reason it is rejected is not theoretical:
URLs reach access logs, `Referer` headers, browser history and error trackers. An access token
there is valid for fifteen minutes against the whole API. A ticket is valid once, for thirty
seconds, for a socket that carries no writes.

**A cookie on the API origin.** Would work for a same-site deployment and does not work here: the
browser has no session with the API, only with the Next app. Creating one would give the browser a
second, differently-scoped credential — precisely what the BFF exists to avoid.

**`Sec-WebSocket-Protocol` as a credential channel.** A real technique, and it works, but it
overloads a negotiation header with a secret and still puts a long-lived token where proxies log
handshakes.

**Server-Sent Events.** Genuinely tempting: one direction is all this needs, it survives proxies
better, and it reconnects on its own. Rejected because it inherits the same auth problem (`EventSource`
cannot set headers either) without the ticket being any simpler, and because a WebSocket leaves the
door open for typing indicators and presence, which the social PRD already gestures at.

**Sticky sessions instead of pub/sub.** Would remove Redis from the path, and puts the constraint in
the load balancer instead — where nothing in this repository can test it, and where a deploy that
loses stickiness looks like intermittent message loss.

**Socket.IO.** Brings reconnection, rooms, and a fallback transport. Rejected for its own protocol
on both ends and a client bundle, for a P2 feature whose fallback is the polling that already works.

## Consequences

- **The channel is never an authority.** Everything it carries is readable over REST, which checks
  permission per request. A client that ignores every frame sees a correct, slightly staler product
  — which is the pre-S5-11 behaviour, and what happens today when Redis is down.
- **Two more Redis connections per replica.** ioredis refuses ordinary commands on a subscribed
  client, so tickets and publishing cannot share the subscriber.
- **Sockets are pinged every 30s and terminated when they miss.** A half-open connection through a
  load balancer is indistinguishable from an idle one, and holds its slot forever.
- **A deployment without Redis still works.** `presence` is optional throughout; messaging behaves
  exactly as it did in S4-7.
- **Nothing accepts client→server frames.** Inbound messages are ignored. Every write in this
  product goes through the authorized REST API; a command channel here would be a second, weaker
  door into the same data.
