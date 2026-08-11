/**
 * Service: Ticket Service
 *
 * Single-use ticket management for WebSocket authentication.
 * Tickets are stored in memory and expire after a configurable TTL.
 *
 * @since 2.0.0
 * @module Service/Ticket
 */

import { Buffer } from "node:buffer";
import { $ScratchpadId } from "@beep/identity";
import { Clock, Context, Duration, Effect, HashMap, HashSet, Layer, Option, Random, Ref, Schedule } from "effect";
import * as DateTime from "effect/DateTime";
import * as P from "effect/Predicate";
import { AuthenticationError, TicketExpiredError, TicketNotFoundError } from "../Domain/Error/Auth.ts";
import { TicketRecord } from "../Domain/Schema/Auth.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/Ticket");

// =============================================================================
// Constants
// =============================================================================

/** Default ticket TTL in milliseconds (5 minutes) */
const DEFAULT_TTL_MS = 5 * 60 * 1000;

/** Cleanup interval for expired tickets */
const CLEANUP_INTERVAL_MS = 60 * 1000;

// =============================================================================
// Implementation
// =============================================================================

const generateSecureToken = Effect.gen(function* () {
  const bytes = new Uint8Array(32);
  for (let index = 0; index < bytes.length; index++) {
    bytes[index] = yield* Random.nextIntBetween(0, 256);
  }
  return Buffer.from(bytes).toString("base64url");
});

const makeTicketService = Effect.gen(function* () {
  const ticketsRef = yield* Ref.make(HashMap.empty<string, TicketRecord>());

  const cleanup = Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis;
    yield* Ref.update(
      ticketsRef,
      HashMap.filter((record) => record.expiresAt.epochMilliseconds > now)
    );
    yield* Effect.logDebug("Cleaned up expired tickets");
  });

  yield* cleanup.pipe(Effect.schedule(Schedule.fixed(Duration.millis(CLEANUP_INTERVAL_MS))), Effect.forkDetach);

  const createTicket = Effect.fn("TicketService.createTicket")(function* (
    ontologyId: string,
    apiKey: string,
    ttlMs: number = DEFAULT_TTL_MS
  ) {
    const ticket = yield* generateSecureToken;
    const now = yield* Clock.currentTimeMillis;
    const expiresAt = now + ttlMs;
    const record = TicketRecord.fromUnknown({ ticket, ontologyId, apiKey, createdAt: now, expiresAt });
    yield* Ref.update(ticketsRef, HashMap.set(ticket, record));
    yield* Effect.logDebug(
      `Created ticket for ontology=${ontologyId} expires=${DateTime.toDateUtc(DateTime.makeUnsafe(expiresAt)).toISOString()}`
    );
    return { ticket, expiresAt, ttlSeconds: Math.floor(ttlMs / 1000) };
  });

  const validateTicket = Effect.fn("TicketService.validateTicket")(function* (ticket: string) {
    const record = yield* Ref.modify(ticketsRef, (tickets) =>
      Option.match(HashMap.get(tickets, ticket), {
        onNone: () => [Option.none<TicketRecord>(), tickets] as const,
        onSome: (existing) => [Option.some(existing), HashMap.remove(tickets, ticket)] as const,
      })
    );
    if (Option.isNone(record)) {
      return yield* TicketNotFoundError.fromUnknown({ message: "Ticket not found or already used", ticket });
    }
    const now = yield* Clock.currentTimeMillis;
    if (record.value.expiresAt.epochMilliseconds < now) {
      return yield* TicketExpiredError.fromUnknown({
        message: "Ticket has expired",
        ticket,
        expiredAt: record.value.expiresAt.epochMilliseconds,
      });
    }
    yield* Effect.logDebug(`Validated ticket for ontology=${record.value.ontologyId}`);
    return record.value.ontologyId;
  });

  const hasTicket = Effect.fn("TicketService.hasTicket")(function* (ticket: string) {
    const record = HashMap.get(yield* Ref.get(ticketsRef), ticket);
    if (Option.isNone(record)) return false;
    return record.value.expiresAt.epochMilliseconds > (yield* Clock.currentTimeMillis);
  });

  const getActiveCount = Effect.gen(function* () {
    const tickets = yield* Ref.get(ticketsRef);
    const now = yield* Clock.currentTimeMillis;
    return HashMap.reduce(tickets, 0, (count, record) =>
      record.expiresAt.epochMilliseconds > now ? count + 1 : count
    );
  });

  const validateApiKey = Effect.fn("TicketService.validateApiKey")(function* (
    apiKey: string | undefined,
    validKeys: HashSet.HashSet<string>
  ) {
    if (P.isUndefined(apiKey)) {
      return yield* AuthenticationError.fromUnknown({ message: "Missing API key", reason: "missing" });
    }
    if (!HashSet.has(validKeys, apiKey)) {
      return yield* AuthenticationError.fromUnknown({ message: "Invalid API key", reason: "invalid" });
    }
    return apiKey;
  });

  return {
    createTicket,
    validateTicket,
    hasTicket,
    getActiveCount,
    validateApiKey,
  };
});

// =============================================================================
// Service Definition
// =============================================================================

export class TicketService extends Context.Service<TicketService>()($I`TicketService`, {
  make: makeTicketService,
}) {
  static readonly Default = Layer.effect(this, this.make);
}

export const TicketServiceLive = TicketService.Default;
