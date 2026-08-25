# 09 — Errors across boundaries

Each hexagonal boundary translates errors. Driver/internal errors die in the adapter; port errors die in the use-case service; public action errors die in the protocol handler. The only failures crossing a boundary are the ones declared in that boundary's signature.

The executable proof target for this rule is `packages/architecture-lab/*`: `WorkItemRepositoryNotFound` is server-only, `WorkItemNotFound` is public, and `WorkItemUseCases` translates between them.

## 1. Taxonomy

Five kinds of failure live in the slice. Each has a fixed home and a fixed translator.

- **Actionable domain failures.** Defined in `domain/<concept>/<Concept>.errors.ts` as classes extending `S.TaggedError` directly. Use-cases may branch on them while enforcing domain behavior. Membership: `MembershipAlreadyRevoked`, `UnauthorizedRevoker`.
- **Port failures.** Defined in `use-cases/<Concept>/<Concept>.errors.ts` as server-only classes extending `S.TaggedError` directly and exported only from the use-case package's `/server` subpath. Use-cases branch on them; protocol callers do not. Membership repository: `MembershipRepositoryNotFound`, `MembershipRepositoryUnavailable`.
- **Public action failures.** Defined in `use-cases/<Concept>/<Concept>.errors.ts` as client-safe classes extending `S.TaggedError` directly and exported from `/public`. Protocol callers (HTTP handlers, RPC handlers, UI atoms) branch on them. Membership revoke: `MembershipNotFound`, `MembershipRevocationFailed`, `MembershipRevocationDenied`.
- **Internal failures.** Driver errors, network errors, deserialization errors, anything technical. These die at the boundary; they MUST NOT reach use-case callers as themselves.
- **Boundary protocol failures.** HTTP/RPC translation: public action failures map to `400`/`403`/`404`/`409` problem-detail bodies; internals map to `500` with a correlation ID and structured log.

````
domain          domain failures                 (domain/.errors.ts)
   v translated/consumed by use-cases
ports           port failures                   (use-cases server surface)
   v translated/consumed by use-cases
use-cases       public action failures          (use-cases public surface)
   v translated/consumed by protocol handlers
boundary        protocol shape (400/403/500 + body)
````

The arrow is always a translation, never a passthrough. A failure that escapes its declaration as itself is a doctrine violation (see section 6).

Every typed error class extends `S.TaggedError` from `effect/Schema` directly.
Use the package's `$I` composer when a distinct namespaced schema identifier is
wanted. When no distinct identifier is needed, omit it with
`S.TaggedError<Self>()("Tag", fields)`; never pass a bare identifier equal to
the tag. Cause-carrying errors declare
`cause: S.Defect({ includeStack: true })` explicitly.

### Declared field equivalence

Every `S.TaggedError` declaration adopts its declared field struct as its
equivalence by passing `$I.annoteError<Self>(identifier, extras?)` as its
annotations. Effect calls a declaration's `toEquivalence` hook with the derived
equivalence of its type parameters, and for a tagged error that single
parameter is the declared `TaggedStruct`; the record returned by `annoteError`
hands that equivalence back, so `S.toEquivalence(ErrorClass)` compares declared
diagnostic identity and ignores the `Error` runtime metadata the class
inherits. Nothing is derived by hand at the class: no field constants, no
comparator functions, no explicit schema type arguments. Packages that cannot
depend on `@beep/identity` write the same hook inline as
`toEquivalence: ([sameFields]) => sameFields` on a contextually typed
annotation object (`packages/ecosystem/effect-drizzle/src/core/Meta.ts`).

Opaque payloads declare their own identity rule at the schema layer: `Defect`
from `@beep/schema` is Effect's `S.Defect(options)` annotated with an
always-true equivalence, so a `cause` field stays payload and two errors that
differ only in their defect compare equal. Excluding a field from equivalence at
the class is not a pattern; the field's schema says whether it participates.
Tests consume `S.toEquivalence(ErrorClass)` and never install test-local
overrides.

## 2. Translation contract

Three rules, one per boundary.

- **Server adapters translate driver errors -> port-declared errors.** A `MembershipRepository.findById` port declares `MembershipRepositoryNotFound | MembershipRepositoryUnavailable` failures. The Drizzle adapter implementing it catches `PostgresError` and returns one of those declared errors. Driver errors do not escape the adapter.
- **Use-case services translate port errors -> public action errors.** `MembershipService.revoke` catches the port's `MembershipRepositoryNotFound` and rethrows as `MembershipNotFound` — an action-level meaning the protocol caller can branch on.
- **HTTP/RPC handlers translate public action errors -> protocol shape.** `Membership.http-handlers.ts` matches on the action errors and returns `403` for denials, `404` for not-found, etc. Anything not branched on hits a default `500` branch with a correlation ID.

A handler must never branch on a port error. A use-case must never branch on a driver error. If you need to, you have skipped a translator.

## 3. Naming convention

- For non-trivial translations, the translation lives in a `<Concept>.error-translation.ts` role file in the same package as the consumer: server-side adapter translations in `server`, HTTP translations alongside the handler files, etc.
- For single-call-site translations, inline `Effect.mapError` or `Effect.catchTag` is fine.
- The translation function shape: `(input: SourceError) => TargetError`. Pure. No Effects required — translation has no side effects. Logging the original is a separate concern wired around the translator (see section 6).

The presence of an `error-translation.ts` file is a signal that the translation has interesting policy. Inline translation is a signal that it does not.

## 4. Ports declare only port failures

A port's signature is `Effect.Effect<Result, Failures, never>`. `Failures` is a union of `S.TaggedError` class instances declared for that port boundary and exported only from the server-side use-case surface. Internal/technical errors are NOT in this union. They die in the adapter.

This rule is what lets use-cases write `Effect.catchTags` exhaustively against a fixed set of port failures — the union is closed and authored at the port. If a new technical mode appears in the adapter, it must either be translated to an existing port-declared error or motivate a new port-declared error and an explicit use-case translator update.

`R` stays `never` at the port boundary. Live requirements (FileSystem, PostgresClient, etc.) are introduced when the adapter Layer is composed, not declared in the port type.

## 5. Worked example: revoking a membership

The full chain. Each block is one boundary.

### a) Driver-level error (no translation yet)

````ts
// packages/drivers/postgres/src/Postgres.errors.ts (excerpt)
import { $PostgresId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $PostgresId.create("Postgres.errors");

/**
 * Technical Postgres driver failure scoped to a driver operation.
 *
 * @category errors
 * @since 0.0.0
 */
export class PostgresError extends S.TaggedError<PostgresError>(
  $I`PostgresError`
)(
  "PostgresError",
  {
    operation: S.String,
    sqlState: S.OptionFromOptionalKey(S.String),
    query: S.OptionFromOptionalKey(S.String),
    cause: S.Defect({ includeStack: true }),
  },
  $I.annote("PostgresError", {
    description: "Technical Postgres driver failure scoped to a driver operation.",
  })
) {}
````

This error is technical. It lives in the driver package and is invisible to anyone above the adapter.

### b) Port-declared errors (in use-cases)

````ts
// packages/iam/use-cases/src/Membership/Membership.errors.ts
import { $IamUseCasesId } from "@beep/identity";
import * as S from "effect/Schema";
import { MembershipId } from "@beep/iam-domain/Membership";

const $I = $IamUseCasesId.create("Membership.errors");

/**
 * Port-declared failure when the requested membership cannot be found.
 *
 * @category errors
 * @since 0.0.0
 */
export class MembershipRepositoryNotFound extends S.TaggedError<MembershipRepositoryNotFound>(
  $I`MembershipRepositoryNotFound`
)(
  "MembershipRepositoryNotFound",
  { membershipId: MembershipId },
  $I.annote("MembershipRepositoryNotFound", {
    description: "The requested membership does not exist.",
  })
) {}

/**
 * Port-declared failure when the membership repository is temporarily unreachable.
 *
 * @category errors
 * @since 0.0.0
 */
export class MembershipRepositoryUnavailable extends S.TaggedError<MembershipRepositoryUnavailable>(
  $I`MembershipRepositoryUnavailable`
)(
  "MembershipRepositoryUnavailable",
  { reason: S.String },
  $I.annote("MembershipRepositoryUnavailable", {
    description: "The membership repository is temporarily unreachable.",
  })
) {}
````

The port's `findById` then declares `Effect.Effect<Membership, MembershipRepositoryNotFound | MembershipRepositoryUnavailable>`. That union is the closed contract every adapter must honor.

### c) Adapter translation (server-side)

````ts
// packages/iam/server/src/Membership/Membership.repo.ts
import { Effect, pipe } from "effect";
import * as O from "effect/Option";
import type { Membership, MembershipId } from "@beep/iam-domain/Membership";
import {
  MembershipRepositoryNotFound,
  MembershipRepositoryUnavailable,
} from "@beep/iam-use-cases/Membership";

const findById = (
  id: MembershipId
): Effect.Effect<Membership, MembershipRepositoryNotFound | MembershipRepositoryUnavailable> =>
  pipe(
    runDrizzleQuery(id), // returns Effect.Effect<Membership, PostgresError>
    Effect.catchTag("PostgresError", (e) =>
      pipe(
        e.sqlState,
        O.filter((state) => state === "NO_DATA"),
        O.match({
          onNone: (): Effect.Effect<never, MembershipRepositoryNotFound | MembershipRepositoryUnavailable> =>
            Effect.fail(new MembershipRepositoryUnavailable({ reason: e.operation })),
          onSome: () => Effect.fail(new MembershipRepositoryNotFound({ membershipId: id })),
        })
      )
    )
  );
````

`PostgresError` is consumed inside the adapter and never re-emitted. The compiler now refuses to let `PostgresError` reach the use-case.

### d) Public action translation (use-case)

````ts
// packages/iam/use-cases/src/Membership/Membership.service.ts
import { Effect } from "effect";
import * as Match from "effect/Match";
import {
  MembershipNotFound,
  MembershipRevocationFailed,
} from "@beep/iam-use-cases/Membership";

const revoke = Effect.fn("Membership.revoke")(function* (cmd: RevokeMembership) {
  const m = yield* repo.findById(cmd.membershipId).pipe(
    Effect.mapError(
      Match.valueTags({
        MembershipRepositoryNotFound: (e) =>
          new MembershipNotFound({
            membershipId: e.membershipId,
          }),
        MembershipRepositoryUnavailable: () =>
          new MembershipRevocationFailed({ reason: "infrastructure" }),
      })
    )
  );
  // ... rest of the use-case: invariant checks, state transition, persist, emit event
  return m;
});
````

The use-case never names a port error in its return type. The public action union (`MembershipNotFound | MembershipRevocationDenied | MembershipRevocationFailed | ...`) is what the handler will see.

### e) Protocol translation (HTTP handler)

````ts
// packages/iam/server/src/Membership/Membership.http-handlers.ts
import { Effect } from "effect";
import { problemDetail } from "@beep/http-problem-detail";

const handler = Effect.fn("http.POST /v1/iam/memberships/:id/revoke")(
  function* (cmd: RevokeMembership, correlationId: string) {
    return yield* service.revoke(cmd).pipe(
      Effect.catchTags({
        MembershipRevocationDenied: (e) =>
          Effect.succeed(
            problemDetail({
              status: 403,
              type: "membership/denied",
              detail: e.reason,
              correlationId,
            })
          ),
        MembershipRevocationFailed: (e) =>
          Effect.andThen(
            Effect.logError("membership.revoke failed", {
              reason: e.reason,
              correlationId,
            }),
            Effect.succeed(
              problemDetail({ status: 500, type: "internal", correlationId })
            )
          ),
      })
    );
  }
);
````

`Effect.catchTags` is exhaustive against the public action-error union. The handler's return type is the protocol response — no action error escapes.

The exact transport helper (`problemDetail`, JSON shape, status mapping table) is defined once per protocol stack and reused. It is not invented per handler.

## 6. The "internal failure dies at the boundary" rule

A failure that escapes its boundary as itself is a doctrine violation. Concretely:

- A `PostgresError` returned by a port: violation. The adapter must translate.
- A `MembershipRepositoryNotFound` returned by a use-case service: violation. The service must translate to a public action error such as `MembershipNotFound`.
- A `MembershipRepositoryUnavailable` reaching an HTTP body: violation. The use-case must translate it to a public action error; the handler then converts that action error to `500` with a correlation ID and logs the original technical detail at the boundary where it died.

Two corollaries follow.

- **Logging is the dual of translation.** When a translator drops information (driver stack trace, SQL, retry count) it logs that information at the boundary it dies in. The translator returns a thin actionable error; the surrounding `Effect.tapError` or `Effect.catchTag` body emits the structured log. The two halves are co-located so the dropped detail is never lost — it is just not in the public error surface.
- **Defects are not failures.** `Effect.die` is reserved for invariant violations the program cannot recover from (impossible state, broken assumption). Defects bypass translation by design and surface as `500` with a different log level. If a translator needs to emit `Effect.die`, the precondition that produced the unexpected case is what to fix — not the translator.

The only failures crossing each boundary are the ones declared in that boundary's signature. The signature is the contract; everything else is implementation.

## See also

- `03-driver-boundaries.md` — where adapter translation lives (driver vs. server vs. tables responsibilities).
- `04-rich-domain-model.md` — the "Forbidden Effect dependencies" subsection: domain errors extend `S.TaggedError`, are not raw `Error`, and never carry transport details.
- `08-testing.md` — testing error paths: each translator has a test that asserts the source error becomes the expected target error.
