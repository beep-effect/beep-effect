/**
 * Service: Ticket Service
 *
 * **Details**
 *
 * Single-use ticket management for WebSocket authentication.
 * Tickets are stored in shared StorageService so any replica can consume them.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { randomBytes } from "node:crypto";
import { $ScratchpadId } from "@beep/identity";
import { Clock, Context, DateTime, Duration, Effect, HashSet, Layer, Schedule } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { AuthenticationError, TicketExpiredError, TicketNotFoundError } from "../Domain/Error/Auth.ts";
import { Milliseconds } from "../Domain/Error/Base.ts";
import { TicketRecord } from "../Domain/Schema/Auth.ts";
import { StorageService } from "./Storage.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/Ticket");

/** Default ticket TTL in milliseconds (5 minutes) */
const DEFAULT_TTL_MS = 5 * 60 * 1000;

/** Cleanup interval for expired tickets */
const CLEANUP_INTERVAL_MS = 60 * 1000;

const generateSecureToken = Effect.sync(() => randomBytes(32).toString("base64url"));

const ticketStorageKey = (ticket: string) => `ws-tickets/${ticket}`;

const makeTicketService = Effect.gen(function* () {
  const storage = yield* StorageService;

  const TicketRecordJson = S.fromJsonString(TicketRecord);

  const persistTicket = (ticket: string, record: TicketRecord) =>
    S.encodeEffect(TicketRecordJson)(record).pipe(
      Effect.flatMap((encoded) => storage.set(ticketStorageKey(ticket), encoded)),
      Effect.ignore
    );

  const loadStoredTicket = (ticket: string) =>
    storage.get(ticketStorageKey(ticket)).pipe(
      Effect.flatMap((content) =>
        P.isUndefined(content)
          ? Effect.succeed(O.none<TicketRecord>())
          : S.decodeEffect(TicketRecordJson)(content).pipe(Effect.map(O.some))
      ),
      Effect.orElseSucceed(O.none<TicketRecord>)
    );

  const removeStoredTicket = (ticket: string) => storage.remove(ticketStorageKey(ticket)).pipe(Effect.ignore);

  const listTicketKeys = storage.list("ws-tickets/").pipe(Effect.orElseSucceed((): Array<string> => []));

  const cleanup = Effect.gen(function* () {
    const keys = yield* listTicketKeys;
    const now = yield* Clock.currentTimeMillis;
    yield* Effect.forEach(
      keys,
      (key) =>
        storage.get(key).pipe(
          Effect.flatMap((content) => {
            if (P.isUndefined(content)) {
              return Effect.void;
            }
            return S.decodeEffect(TicketRecordJson)(content).pipe(
              Effect.flatMap((record) =>
                record.expiresAt.epochMilliseconds <= now ? storage.remove(key) : Effect.void
              )
            );
          }),
          Effect.ignore
        ),
      { concurrency: 10, discard: true }
    );
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
    yield* persistTicket(ticket, record);
    yield* Effect.logDebug(
      `Created ticket for ontology=${ontologyId} expires=${DateTime.toDateUtc(DateTime.makeUnsafe(expiresAt)).toISOString()}`
    );
    return { ticket, expiresAt, ttlSeconds: Math.floor(ttlMs / 1000) };
  });

  const validateTicket = Effect.fn("TicketService.validateTicket")(function* (ticket: string) {
    const record = yield* loadStoredTicket(ticket);
    yield* removeStoredTicket(ticket);
    if (O.isNone(record)) {
      return yield* TicketNotFoundError.make({ message: "Ticket not found or already used", ticket });
    }
    const now = yield* Clock.currentTimeMillis;
    if (record.value.expiresAt.epochMilliseconds < now) {
      return yield* TicketExpiredError.make({
        message: "Ticket has expired",
        ticket,
        expiredAt: Milliseconds.make(record.value.expiresAt.epochMilliseconds),
      });
    }
    yield* Effect.logDebug(`Validated ticket for ontology=${record.value.ontologyId}`);
    return record.value.ontologyId;
  });

  const hasTicket = Effect.fn("TicketService.hasTicket")(function* (ticket: string) {
    const record = yield* loadStoredTicket(ticket);
    if (O.isNone(record)) return false;
    return record.value.expiresAt.epochMilliseconds > (yield* Clock.currentTimeMillis);
  });

  const getActiveCount = Effect.gen(function* () {
    const keys = yield* listTicketKeys;
    const now = yield* Clock.currentTimeMillis;
    const flags = yield* Effect.forEach(keys, (key) =>
      storage.get(key).pipe(
        Effect.flatMap((content) => {
          if (P.isUndefined(content)) {
            return Effect.succeed(false);
          }
          return S.decodeEffect(TicketRecordJson)(content).pipe(
            Effect.map((record) => record.expiresAt.epochMilliseconds > now)
          );
        }),
        Effect.orElseSucceed(() => false)
      )
    );
    return flags.filter((active) => active).length;
  });

  const validateApiKey = Effect.fn("TicketService.validateApiKey")(function* (
    apiKey: string | undefined,
    validKeys: HashSet.HashSet<string>
  ) {
    if (P.isUndefined(apiKey)) {
      return yield* AuthenticationError.make({ message: "Missing API key", reason: "missing" });
    }
    if (!HashSet.has(validKeys, apiKey)) {
      return yield* AuthenticationError.make({ message: "Invalid API key", reason: "invalid" });
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

/**
 * Provides the ticket service service capability.
 *
 * **Example** (Inspect ticket service)
 *
 * ```ts
 * import { TicketService } from "@effect-ontology/Service/Ticket"
 *
 * console.log(TicketService)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export class TicketService extends Context.Service<TicketService>()($I`TicketService`, {
  make: makeTicketService,
}) {
  static readonly Default = Layer.effect(this, this.make);
}

/**
 * Provides the Effect layer for ticket service live dependencies.
 *
 * **Example** (Inspect ticket service live)
 *
 * ```ts
 * import { TicketServiceLive } from "@effect-ontology/Service/Ticket"
 *
 * console.log(TicketServiceLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const TicketServiceLive = TicketService.Default;
