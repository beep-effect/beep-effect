/**
 * Service: Ticket Service
 *
 * Single-use ticket management for WebSocket authentication.
 * Tickets are stored in memory and expire after a configurable TTL.
 *
 * @since 2.0.0
 * @module Service/Ticket
 */

import { Clock, Duration, Effect, HashMap, HashSet, Option, Ref, Schedule, Context, Layer } from "effect"
import { Buffer } from "node:buffer"
import { AuthenticationError, TicketExpiredError, TicketNotFoundError } from "../Domain/Error/Auth.ts"
import { TicketRecord } from "../Domain/Schema/Auth.ts"
import { $ScratchpadId } from "@beep/identity";
const $I = $ScratchpadId.create("effect-ontology/Service/Ticket");

// =============================================================================
// Constants
// =============================================================================

/** Default ticket TTL in milliseconds (5 minutes) */
const DEFAULT_TTL_MS = 5 * 60 * 1000

/** Cleanup interval for expired tickets */
const CLEANUP_INTERVAL_MS = 60 * 1000

// =============================================================================
// Implementation
// =============================================================================

const generateSecureToken = Effect.sync(() => {
  // Generate 32 random bytes and encode as base64url
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Buffer.from(bytes).toString("base64url")
})

const makeTicketService = Effect.gen(function*() {
  const ticketsRef = yield* Ref.make(HashMap.empty<string, TicketRecord>())

  // Background cleanup fiber for expired tickets
  const cleanup = Effect.gen(function*() {
    const now = yield* Clock.currentTimeMillis
    yield* Ref.update(ticketsRef, (tickets) =>
      HashMap.filter(tickets, (record) => record.expiresAt.epochMilliseconds > now)
    )
    yield* Effect.logDebug("Cleaned up expired tickets")
  })

  // Start background cleanup (runs every minute)
  yield* cleanup.pipe(
    Effect.schedule(Schedule.fixed(Duration.millis(CLEANUP_INTERVAL_MS))),
    Effect.forkDetach
  )

  return {
    /**
     * Create a new single-use ticket for WebSocket authentication.
     *
     * @param ontologyId - The ontology ID the ticket grants access to
     * @param apiKey - The API key that created this ticket (for audit)
     * @param ttlMs - Time-to-live in milliseconds (default: 5 minutes)
     * @returns Ticket token, expiration timestamp, and TTL
     */
    createTicket: (ontologyId: string, apiKey: string, ttlMs: number = DEFAULT_TTL_MS) =>
      Effect.gen(function*() {
        const ticket = yield* generateSecureToken
        const now = yield* Clock.currentTimeMillis
        const expiresAt = now + ttlMs

        const record = TicketRecord.fromUnknown({
          ticket,
          ontologyId,
          apiKey,
          createdAt: now,
          expiresAt
        })

        yield* Ref.update(ticketsRef, (tickets) => HashMap.set(tickets, ticket, record))
        yield* Effect.logDebug(`Created ticket for ontology=${ontologyId} expires=${new Date(expiresAt).toISOString()}`)

        return {
          ticket,
          expiresAt,
          ttlSeconds: Math.floor(ttlMs / 1000)
        }
      }),

    /**
     * Validate and consume a ticket (single-use).
     *
     * @param ticket - The ticket token to validate
     * @returns The ontology ID the ticket grants access to
     * @throws TicketNotFoundError if ticket doesn't exist
     * @throws TicketExpiredError if ticket has expired
     */
    validateTicket: (ticket: string) =>
      Effect.gen(function*() {
        // Atomically get and remove ticket (single-use)
        const record = yield* Ref.modify(ticketsRef, (tickets) => {
          const existing = HashMap.get(tickets, ticket)
          if (Option.isNone(existing)) {
            return [Option.none<TicketRecord>(), tickets]
          }
          // Remove ticket (single-use)
          return [Option.some(existing.value), HashMap.remove(tickets, ticket)]
        })

        if (Option.isNone(record)) {
          return yield* Effect.fail(
            TicketNotFoundError.make({
              message: "Ticket not found or already used",
              ticket
            })
          )
        }

        const now = yield* Clock.currentTimeMillis
        if (record.value.expiresAt.epochMilliseconds < now) {
          return yield* Effect.fail(
            TicketExpiredError.fromUnknown({
              message: "Ticket has expired",
              ticket,
              expiredAt: record.value.expiresAt.epochMilliseconds
            })
          )
        }

        yield* Effect.logDebug(`Validated ticket for ontology=${record.value.ontologyId}`)
        return record.value.ontologyId
      }),

    /**
     * Check if a ticket exists without consuming it.
     * Useful for debugging/monitoring.
     *
     * @param ticket - The ticket token to check
     * @returns True if ticket exists and is valid
     */
    hasTicket: (ticket: string) =>
      Effect.gen(function*() {
        const tickets = yield* Ref.get(ticketsRef)
        const record = HashMap.get(tickets, ticket)
        if (Option.isNone(record)) return false

        const now = yield* Clock.currentTimeMillis
        return record.value.expiresAt.epochMilliseconds > now
      }),

    /**
     * Get count of active tickets (for monitoring).
     */
    getActiveCount: () =>
      Effect.gen(function*() {
        const tickets = yield* Ref.get(ticketsRef)
        const now = yield* Clock.currentTimeMillis
        return HashMap.reduce(
          tickets,
          0,
          (count, record) => record.expiresAt.epochMilliseconds > now ? count + 1 : count
        )
      }),

    /**
     * Validate an API key against configured keys.
     * Returns success if key is valid, fails with AuthenticationError otherwise.
     *
     * @param apiKey - The API key to validate
     * @param validKeys - Set of valid API keys
     */
    validateApiKey: (apiKey: string | undefined, validKeys: HashSet.HashSet<string>) =>
      Effect.gen(function*() {
        if (!apiKey) {
          return yield* Effect.fail(
            AuthenticationError.make({
              message: "Missing API key",
              reason: "missing"
            })
          )
        }

        if (!HashSet.has(validKeys, apiKey)) {
          return yield* Effect.fail(
            AuthenticationError.make({
              message: "Invalid API key",
              reason: "invalid"
            })
          )
        }

        return apiKey
      })
  }
})

// =============================================================================
// Service Definition
// =============================================================================

export class TicketService extends Context.Service<TicketService>()(
  $I`TicketService`,
  {
    make: makeTicketService,
  }
) {
    static readonly Default = Layer.effect(this, this.make);
}

export const TicketServiceLive = TicketService.Default
