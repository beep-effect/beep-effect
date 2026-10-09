# 12 — Observability

Slice boundaries are span boundaries. A protocol handler may be the trace root for an incoming request; the use-case command is the architectural root inside that request. Ports are child spans; adapters are grandchildren. Domain-semantic attributes attach in use-cases; technical attributes attach in adapters. The trace tree mirrors the architectural tree.

## 1. Slice boundaries are span boundaries

Each architectural boundary in a slice is a natural tracing boundary. The mapping is fixed.

- A use-case command call (`MembershipService.revoke(cmd)`) is the **architectural root span**. Its lifetime corresponds to the application action.
- Each port call from within a use-case is a **child span**. Driver-level work invoked by the adapter (Drizzle queries, HTTP calls, queue publishes) becomes grandchild spans automatically.
- HTTP/RPC handlers wrap their use-case call with a span named after the protocol operation (`http.POST /v1/iam/memberships/:id/revoke`); that protocol span may be the trace root for the request, and the use-case command span lives inside it.

This mapping makes traces readable without per-codebase tribal knowledge: the trace tree mirrors the architectural tree. If a trace looks flat, a layer is missing a span. If a trace looks tangled, a span is being attached at the wrong layer.

## 2. Span naming convention

Format: `<slice>.<concept>.<action>`.

- `iam.membership.revoke` — use-case command
- `iam.membership.find_by_id` — port operation, opened as a child span when the use-case invokes the port
- `billing.subscription.cancel_invoices` — cross-slice handler in `billing/server`, reacting to a shared event

Rules:

- Use snake_case for the action; this matches the convention used by most tracing backends.
- The slice and concept names match the package path. `packages/iam/...` -> `iam`; the `Membership` aggregate -> `membership`.
- HTTP/RPC handlers use the protocol operation name, not the slice name, for the wrapping span: `http.POST /v1/iam/memberships/:id/revoke`. The use-case span inside it carries the architectural name.
- Adapter-internal spans use a technical namespace (`db.query`, `http.request`, `queue.publish`). They never use the slice/concept namespace.

## 3. Attribute conventions

Domain-semantic attributes attach in use-cases. Technical attributes attach in adapters. The split is enforced by who imports what: a Drizzle adapter does not import `Membership`, so it cannot attach `iam.membership.actor.role`; a use-case service does not import `drizzle`, so it cannot attach `db.statement`.

**In use-cases (domain-semantic):**

- `iam.membership.id` — the aggregate ID
- `iam.membership.actor.role` — the role of the actor performing the action
- `iam.membership.outcome` — `revoked` / `denied` / `not_found`

**In adapters (technical):**

- `db.statement` — the SQL or query string
- `db.rows_affected` — for writes
- `http.status_code` — for HTTP-driver calls
- `queue.target` — for queue publishes

Rules:

- Domain attribute keys are namespaced by `<slice>.<concept>.<field>` and match the span naming.
- Technical keys follow the OpenTelemetry semantic conventions where they apply (`db.*`, `http.*`, `messaging.*`).
- A driver MUST NOT attach domain-semantic attributes (it does not know about `Membership`). Domain attributes only attach in code that imports from `domain` or `use-cases`.
- A use-case MUST NOT attach technical attributes (it does not know about Drizzle). The adapter attaches those when it executes the query.
- Attributes must be low-cardinality unless they are identifiers explicitly needed for tracing. Do not attach raw user input, secrets, large payloads, SQL parameter values, or PII.
- The happy path should normally emit spans and bounded attributes, not logs. Add logs when a boundary drops diagnostic detail, retries, falls back, or triggers an operator-relevant condition.

Attributes attach via `Effect.withSpan`'s `attributes` option (set at span open) or via `Effect.annotateCurrentSpan` (set during execution, e.g. on the success branch to record the outcome).

## 4. Logging vs tracing vs console

The three signals are not interchangeable.

- **Tracing** (`Effect.withSpan` + attributes): the durable structure of operations. Use for every use-case call, every port call, every adapter call. A trace answers "what happened in this request, in what order, with what context."
- **Logging** (`Effect.log` / `Effect.logDebug` / `Effect.logError`): structured diagnostics, intended for filtering and alerting. Use sparingly inside use-cases and adapters when something noteworthy happens (deprecation hits, retries triggered, fallbacks taken, error translations dropping detail). A log answers "this thing should grab someone's attention."
- **Console** (`Console.log` / `Console.error` from `effect/Console`): user-facing output for CLIs. Used in `tooling/tool/cli` and similar. NOT for application diagnostics. A console call answers "show this to the user."

Practically: a use-case's normal happy path emits zero logs and one span. The same use-case's error path emits one log (with the dropped technical detail) and one span (with `outcome=denied`). A CLI command emits `Console.log` for its result and `Effect.log` for any structured diagnostic the operator might filter on.

## 5. Worked example: revoking a membership

The same revocation flow used in `09-errors-across-boundaries.md`, annotated with spans and attributes at each layer.

### a) HTTP handler — protocol span wraps the use-case span

````ts
// packages/iam/server/src/Membership/Membership.http-handlers.ts
import * as Effect from "effect/Effect";
import { $IamServerId } from "@beep/identity"
const $I = $IamServerId.create("Membership.http-handlers")
void $I

/**
 * Wraps the protocol operation in a span, parses the request into the
 * use-case command, then opens the use-case span around `revoke`.
 *
 * @category combinators
 * @since 0.0.0
 *
 * @remarks
 * The outer `Effect.fn` span is the protocol layer. The inner
 * `Effect.withSpan` span is the architectural use-case layer. Domain
 * attributes attach inside, where the layer knows what they mean.
 */
export const revokeHandler = Effect.fn("http.POST /v1/iam/memberships/:id/revoke")(
  function* (req: RevokeMembershipRequest) {
    const cmd = yield* parseRevokeMembership(req)
    const result = yield* membershipService.revoke(cmd).pipe(
      Effect.withSpan("iam.membership.revoke", {
        attributes: {
          "iam.membership.id": cmd.membershipId,
          "iam.membership.actor.role": req.actor.role
        }
      })
    )
    return HttpResponse.ok(result)
  }
)
````

The outer `Effect.fn("http.POST ...")` opens the protocol span. The inner `Effect.withSpan("iam.membership.revoke", ...)` opens the use-case span as a child. Domain attributes attach on the use-case span — that is the layer that knows what they mean.

### b) Use-case — port call as a child span; outcome attached on success

````ts
// packages/iam/use-cases/src/Membership/Membership.service.ts
import * as Effect from "effect/Effect";
import { $IamUseCasesId } from "@beep/identity"
const $I = $IamUseCasesId.create("Membership.service")
void $I

/**
 * Use-case command. Opens a child span around the port call and records
 * the final outcome via `Effect.annotateCurrentSpan` on the success path.
 *
 * @category services
 * @since 0.0.0
 *
 * @remarks
 * Domain-semantic attributes attach here. The failure-path translator
 * attaches `iam.membership.outcome=denied` via `Effect.tapError` (see 09).
 */
export const revoke = Effect.fn("iam.membership.revoke")(function* (cmd: RevokeMembership) {
  const m = yield* repo.findById(cmd.membershipId).pipe(
    Effect.withSpan("iam.membership.find_by_id", {
      attributes: { "iam.membership.id": cmd.membershipId.value }
    })
  )
  // ... invariant checks, state transition, persist, emit event ...
  yield* Effect.annotateCurrentSpan("iam.membership.outcome", "revoked")
  return m
})
````

The use-case opens `iam.membership.find_by_id` around the port call. It records the final outcome via `Effect.annotateCurrentSpan` on the success path. On a failure path, the translator that produces `MembershipRevocationDenied` (see 09) uses `Effect.tapError` to attach `iam.membership.outcome=denied` and emit a structured log if the translation drops detail.

### c) Adapter — technical span with `db.*` attributes only

````ts
// packages/iam/server/src/Membership/Membership.repo.ts
import * as Effect from "effect/Effect";
import { $IamServerId } from "@beep/identity"
const $I = $IamServerId.create("Membership.repo")
void $I

/**
 * Adapter port operation. Opens a `db.query` span carrying technical
 * attributes only — never the slice or concept namespace.
 *
 * @category combinators
 * @since 0.0.0
 *
 * @remarks
 * The `db.query` span is a grandchild of the use-case span by virtue of
 * the call stack. Effect threads the parent span through the fiber; no
 * manual parenting is required.
 */
export const findById = (id: MembershipId) =>
  runDrizzleQuery(id).pipe(
    Effect.withSpan("db.query", {
      attributes: {
        "db.statement": "SELECT ... FROM memberships WHERE id = $1"
      }
    }),
    Effect.tap((rows) => Effect.annotateCurrentSpan("db.rows_returned", rows.length))
  )
````

The adapter never names `iam.membership.*` attributes. It owns the technical surface (`db.statement`, `db.rows_returned`) and nothing more. The `db.query` span is a grandchild of the use-case span by virtue of the call stack — no manual parenting required.

### d) Diagnostic logging on a translation that drops detail

````ts
// packages/iam/server/src/Membership/Membership.repo.ts (continued)
import * as Effect from "effect/Effect";
import { $IamServerId } from "@beep/identity"
const $I = $IamServerId.create("Membership.repo")
void $I

/**
 * Logs only the `PostgresError` branch — the branch that drops the
 * underlying technical detail when translating to a port-declared error.
 *
 * @category combinators
 * @since 0.0.0
 *
 * @remarks
 * The span carries the structural record; the log carries the dropped
 * diagnostic. They are co-located so the original detail is never lost.
 */
export const findByIdTranslated = (id: MembershipId) =>
  findById(id).pipe(
    Effect.tapError((e) =>
      e._tag === "PostgresError"
        ? Effect.logError("membership.find_by_id postgres failure", {
            "iam.membership.id": id.value,
            "db.sql_state": e.sqlState
          })
        : Effect.void
    ),
    translateRepoErrors // returns MembershipRepositoryNotFound | MembershipRepositoryUnavailable
  )
````

The log fires only on the `PostgresError` branch — the branch that drops the underlying technical detail when translating to a port-declared error. The span carries the structural record; the log carries the dropped diagnostic. They are co-located so the original detail is never lost.

## 6. Anti-patterns

- **Span name leaks the codepath.** `iam.membership.service.revoke_internal_helper` couples the trace to refactor-sensitive function names. Span names are at the architectural granularity (use-case action), not implementation granularity.
- **Adapter attaches domain attributes.** `db.rows_affected` is fine in an adapter; `iam.membership.actor.role` is not. Domain attributes attach upstream of the adapter.
- **Use-case attaches `db.statement`.** Same boundary violation in reverse — the use-case does not know about SQL.
- **Logging instead of tracing.** `Effect.log("revoking membership %s", id)` for every use-case call is the wrong primitive. Spans are the durable structure of operations; logs are exceptional events. If every call site emits a log, the log stream is a malformed trace.
- **Tracing instead of logging.** Wrapping a one-line warning in `Effect.withSpan` produces a span that has no children and conveys no structure. If the only purpose is to flag attention, use `Effect.logWarning` / `Effect.logError`.
- **`Console.log` for diagnostics.** `Console.log` writes to stdout for the user. For diagnostics, use `Effect.log`. CLI tools may emit both: `Console.log` for the rendered result, `Effect.log` for a structured record an operator could filter on.
- **Manual parenting with `withParentSpan`.** Effect threads the current span through the fiber automatically. Reaching for `Effect.withParentSpan` usually means a fiber boundary was crossed without re-establishing context — fix the fiber boundary, not the span.
- **One mega-span per request.** A single `Effect.withSpan("handle_request")` covering the entire flow defeats the architectural-mirror property. Open a span per boundary; let the trace tree show the slice structure.

## See also

- `04-rich-domain-model.md` — domain has no logger or tracer dependency. Spans are opened and attributes are attached in use-cases and adapters, never in domain code.
- `05-layer-composition.md` — slice-local layer composition keeps span and attribute namespaces aligned per slice; a `Tracer` Layer composed at the runtime root is shared by every slice without naming collisions.
- `08-testing.md` — testing the observability surface is part of the testing story: spans and attributes are observable outputs of a use-case, on equal footing with the returned value and the declared error union.
