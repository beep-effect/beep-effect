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

import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import {
  Clock,
  Context,
  Crypto,
  DateTime,
  Duration,
  Effect,
  Encoding,
  HashSet,
  Layer,
  Number as N,
  Schedule,
} from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { AuthenticationError, TicketExpiredError, TicketNotFoundError } from "../Domain/Error/Auth.ts";
import { ErrorMessage, Milliseconds } from "../Domain/Error/Base.ts";
import { TicketRecord } from "../Domain/Schema/Auth.ts";
import { StorageService } from "./Storage.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/Ticket");

const TicketStorageOperation = LiteralKit(["persist", "load", "remove", "list"]).pipe(
  $I.annoteSchema("TicketStorageOperation", {
    description: "Ticket persistence operations that can fail with TicketStorageError.",
  })
);

/**
 * Reports an infrastructure failure while storing or consuming a one-time ticket.
 *
 * **Example** (Inspect a ticket storage failure)
 *
 * ```ts
 * import { TicketStorageError } from "@effect-ontology/Service/Ticket"
 *
 * const error = TicketStorageError.make({
 *   message: "Ticket store is unavailable",
 *   operation: "persist",
 *   cause: new Error("disk full")
 * })
 * console.log(error._tag) // "TicketStorageError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class TicketStorageError extends S.TaggedError<TicketStorageError>($I`TicketStorageError`)(
  "TicketStorageError",
  {
    message: ErrorMessage.annotateKey({ description: "Opaque ticket-storage failure summary." }),
    operation: TicketStorageOperation.annotateKey({ description: "Storage operation that failed." }),
    cause: S.Defect({ includeStack: true }).annotateKey({ description: "Underlying storage or codec defect." }),
  },
  $I.annote("TicketStorageError", {
    description: "Typed infrastructure failure preserving one-time ticket storage semantics.",
  })
) {}

/** Default ticket lifetime. */
const DEFAULT_TTL = Duration.minutes(5);

/** Cleanup interval for expired tickets */
const CLEANUP_INTERVAL = Duration.minutes(1);

const ticketStorageKey = (ticket: string) => `ws-tickets/${ticket}`;

const ticketStorageError = (operation: typeof TicketStorageOperation.Type) => (cause: unknown) =>
  TicketStorageError.make({
    message: `Ticket ${operation} operation failed.`,
    operation,
    cause,
  });

const makeTicketService = Effect.gen(function* () {
  const storage = yield* StorageService;
  const crypto = yield* Crypto.Crypto;

  const generateSecureToken = Effect.fn("TicketService.generateSecureToken")(function* () {
    return Encoding.encodeBase64Url(yield* crypto.randomBytes(32));
  });

  const TicketRecordJson = S.fromJsonString(TicketRecord);

  const persistTicket = (ticket: string, record: TicketRecord) =>
    S.encodeEffect(TicketRecordJson)(record).pipe(
      Effect.flatMap((encoded) => storage.set(ticketStorageKey(ticket), encoded)),
      Effect.mapError(ticketStorageError("persist"))
    );

  const loadStoredTicket = (ticket: string) =>
    storage.getOption(ticketStorageKey(ticket)).pipe(
      Effect.flatMap(
        O.match({
          onNone: () => Effect.succeed(O.none<TicketRecord>()),
          onSome: (content) => S.decodeEffect(TicketRecordJson)(content).pipe(Effect.asSome),
        })
      ),
      Effect.mapError(ticketStorageError("load"))
    );

  const removeStoredTicket = (ticket: string) =>
    storage.remove(ticketStorageKey(ticket)).pipe(Effect.mapError(ticketStorageError("remove")));

  const listTicketKeys = storage.list("ws-tickets/").pipe(Effect.mapError(ticketStorageError("list")));

  const cleanup = Effect.gen(function* () {
    const keys = yield* listTicketKeys;
    const now = yield* Clock.currentTimeMillis;
    yield* Effect.forEach(
      keys,
      (key) =>
        storage.getOption(key).pipe(
          Effect.flatMap(
            O.match({
              onNone: () => Effect.void,
              onSome: (content) =>
                S.decodeEffect(TicketRecordJson)(content).pipe(
                  Effect.flatMap((record) =>
                    record.expiresAt.epochMilliseconds <= now ? storage.remove(key) : Effect.void
                  )
                ),
            })
          ),
          Effect.mapError(ticketStorageError("load")),
          Effect.catch((error) => Effect.logWarning("Ticket cleanup entry failed", { operation: error.operation }))
        ),
      { concurrency: 10, discard: true }
    );
  });

  yield* cleanup.pipe(
    Effect.catch((error) => Effect.logWarning("Ticket cleanup cycle failed", { operation: error.operation })),
    Effect.schedule(Schedule.fixed(CLEANUP_INTERVAL)),
    Effect.forkScoped
  );

  const createTicket = Effect.fn("TicketService.createTicket")(function* (
    ontologyId: string,
    apiKey: string,
    ttl: Duration.Duration = DEFAULT_TTL
  ) {
    const ticket = yield* generateSecureToken();
    const now = yield* Clock.currentTimeMillis;
    const expiresAt = now + Duration.toMillis(ttl);
    const record = yield* S.decodeEffect(TicketRecord)({ ticket, ontologyId, apiKey, createdAt: now, expiresAt }).pipe(
      Effect.mapError(() => AuthenticationError.make({ message: "Invalid ticket record", reason: "invalid" }))
    );
    yield* persistTicket(ticket, record);
    yield* Effect.logDebug(
      `Created ticket for ontology=${ontologyId} expires=${DateTime.formatIso(DateTime.makeUnsafe(expiresAt))}`
    );
    return { ticket, expiresAt, ttlSeconds: N.round(Duration.toSeconds(ttl)) };
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
      storage.getOption(key).pipe(
        Effect.flatMap(
          O.match({
            onNone: () => Effect.succeed(false),
            onSome: (content) =>
              S.decodeEffect(TicketRecordJson)(content).pipe(
                Effect.map((record) => record.expiresAt.epochMilliseconds > now)
              ),
          })
        ),
        Effect.mapError(ticketStorageError("load"))
      )
    );
    return A.length(A.filter(flags, P.isTruthy));
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
 * **Example** (Count active tickets)
 *
 * ```ts
 * import { BunCrypto } from "@effect/platform-bun"
 * import { Effect } from "effect"
 * import { TicketService } from "@effect-ontology/Service/Ticket"
 * import { StorageServiceTest } from "@effect-ontology/Service/Storage"
 *
 * const count = Effect.runSync(
 *   Effect.gen(function* () {
 *     const tickets = yield* TicketService
 *     return yield* tickets.getActiveCount
 *   }).pipe(Effect.provide(TicketService.Default), Effect.provide(StorageServiceTest), Effect.provide(BunCrypto.layer), Effect.orDie)
 * )
 * console.log(count) // 0
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
 * **Example** (Provide live ticket storage)
 *
 * ```ts
 * import { BunCrypto } from "@effect/platform-bun"
 * import { Effect } from "effect"
 * import { StorageServiceTest } from "@effect-ontology/Service/Storage"
 * import { TicketService, TicketServiceLive } from "@effect-ontology/Service/Ticket"
 *
 * const count = Effect.runSync(
 *   Effect.gen(function* () {
 *     const tickets = yield* TicketService
 *     return yield* tickets.getActiveCount
 *   }).pipe(Effect.provide(TicketServiceLive), Effect.provide(StorageServiceTest), Effect.provide(BunCrypto.layer), Effect.orDie)
 * )
 * console.log(count) // 0
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const TicketServiceLive = TicketService.Default;
