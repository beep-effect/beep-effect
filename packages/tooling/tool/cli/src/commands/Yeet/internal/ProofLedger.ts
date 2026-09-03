/**
 * Checkout-scoped append-only storage for proof facts and shadow decisions.
 *
 * **Details**
 *
 * The service is deliberately disconnected from Yeet lane execution. It can
 * record and classify proof evidence, but this module never skips or enforces
 * a lane. Each read tolerates malformed terminated rows and ignores an
 * unterminated tail as an append still in flight.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Context, DateTime, Effect, Order } from "effect";
import * as A from "effect/Array";
import { constFalse } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { appendContainedFileString, readContainedFileStringNoFollow } from "../../../internal/cli/FsGuards.ts";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { proofLedgerPathForCheckout } from "./ArtifactPaths.ts";
import {
  PROOF_FACT_SCHEMA_VERSION,
  ProofLedgerFactRow,
  ProofLedgerRow,
  ProofLedgerShadowRow,
  ProofOutcome,
  ProofReuseHit,
  ProofReuseMiss,
} from "./ProofFact.ts";
import type { FileSystem, Path } from "effect";
import type { ProofFact, ProofInputDigest, ProofReuseDecision } from "./ProofFact.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/ProofLedger");
const ProofLedgerRowJson = JsonStringCodec(ProofLedgerRow);
const isFactRow = S.is(ProofLedgerFactRow);
const isShadowRow = S.is(ProofLedgerShadowRow);
const isHit = S.is(ProofReuseHit);
const isAtOrBefore = Order.isLessThanOrEqualTo(Order.Number);

type LoadedProofLedger = {
  readonly malformedRows: number;
  readonly rows: ReadonlyArray<ProofLedgerRow>;
};

const terminatedPortion = (text: string): string =>
  Str.endsWith("\n")(text)
    ? text
    : O.match(Str.lastIndexOf("\n")(text), {
        onNone: () => "",
        onSome: (index) => Str.slice(0, index + 1)(text),
      });

const loadProofLedger = Effect.fn("Yeet.ProofLedger.load")(function* (
  repoRoot: string
): Effect.fn.Return<LoadedProofLedger, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const ledgerPath = yield* proofLedgerPathForCheckout(repoRoot);
  const read = yield* readContainedFileStringNoFollow(repoRoot, ledgerPath).pipe(
    Effect.mapError(YeetCommandError.new(`Failed to read proof ledger "${ledgerPath}".`))
  );
  if (!read.exists) {
    return { malformedRows: 0, rows: A.empty<ProofLedgerRow>() };
  }
  if (O.isNone(read.contents)) {
    return yield* YeetCommandError.make({
      message: `Proof ledger "${ledgerPath}" exists but is not a readable regular file.`,
      file: ledgerPath,
    });
  }
  const lines = A.filter(Str.split(terminatedPortion(read.contents.value), "\n"), Str.isNonEmpty);
  const rows = A.getSomes(A.map(lines, ProofLedgerRowJson.decodeOption));
  return { malformedRows: A.length(lines) - A.length(rows), rows };
});

const appendRow = Effect.fn("Yeet.ProofLedger.appendRow")(function* (
  repoRoot: string,
  row: ProofLedgerRow
): Effect.fn.Return<void, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const ledgerPath = yield* proofLedgerPathForCheckout(repoRoot);
  const read = yield* readContainedFileStringNoFollow(repoRoot, ledgerPath).pipe(
    Effect.mapError(YeetCommandError.new(`Failed to inspect proof ledger "${ledgerPath}" before appending.`))
  );
  if (read.exists && O.isNone(read.contents)) {
    return yield* YeetCommandError.make({
      message: `Proof ledger "${ledgerPath}" exists but is not a readable regular file.`,
      file: ledgerPath,
    });
  }
  const recoveryPrefix = O.match(read.contents, {
    onNone: () => "",
    onSome: (contents) => (Str.isNonEmpty(contents) && !Str.endsWith("\n")(contents) ? "\n" : ""),
  });
  const line = yield* ProofLedgerRowJson.encode(row).pipe(
    Effect.mapError(YeetCommandError.new("Failed to encode a proof ledger row."))
  );
  yield* appendContainedFileString(repoRoot, ledgerPath, `${recoveryPrefix}${line}\n`).pipe(
    Effect.mapError(YeetCommandError.new(`Failed to append proof ledger "${ledgerPath}".`))
  );
});

const factExpiredAt = (fact: ProofFact, now: DateTime.DateTime): boolean =>
  O.match(DateTime.make(fact.expiresAt), {
    onNone: () => true,
    onSome: (expiresAt) => isAtOrBefore(DateTime.toEpochMillis(expiresAt), DateTime.toEpochMillis(now)),
  });

const sameActionInputs = (left: ProofInputDigest, right: ProofInputDigest): boolean =>
  Str.Equivalence(left.laneId, right.laneId) &&
  Str.Equivalence(left.commandDigest, right.commandDigest) &&
  Str.Equivalence(left.inputDigest, right.inputDigest);

const sameReuseIdentity = (left: ProofInputDigest, right: ProofInputDigest): boolean =>
  sameActionInputs(left, right) &&
  Str.Equivalence(left.envProfile, right.envProfile) &&
  Str.Equivalence(left.epochDigest, right.epochDigest);

const miss = (key: string, reason: ProofReuseMiss["reason"]): ProofReuseMiss => ProofReuseMiss.make({ key, reason });

const decideExactFact = (fact: ProofFact, now: DateTime.DateTime): ProofReuseDecision =>
  ProofOutcome.$match(fact.outcome, {
    failed: () => miss(fact.key.key, "prior-failed"),
    passed: () =>
      factExpiredAt(fact, now)
        ? miss(fact.key.key, "expired")
        : ProofReuseHit.make({ key: fact.key.key, factRecordedAt: fact.recordedAt }),
  });

const decideRelatedFact = (key: ProofInputDigest, fact: ProofFact): ProofReuseDecision => {
  if (!Str.Equivalence(fact.key.epochDigest, key.epochDigest)) {
    return miss(key.key, "epoch-changed");
  }
  if (!Str.Equivalence(fact.key.envProfile, key.envProfile)) {
    return miss(key.key, "profile-mismatch");
  }
  return miss(key.key, "no-fact");
};

/**
 * Caller-owned safety predicate for the changed-package reuse tripwire.
 *
 * **Details**
 *
 * The ledger invokes this before consulting stored facts. A caller may close
 * over an Effect `HashSet` or other precomputed change model without making
 * storage responsible for package-graph policy.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ProofChangedPackageTripwire = (key: ProofInputDigest) => boolean;

/**
 * Operations exposed by the checkout proof ledger.
 *
 * @category services
 * @since 0.0.0
 */
export interface ProofLedgerShape {
  readonly disagreements: Effect.Effect<ReadonlyArray<ProofLedgerShadowRow>, YeetCommandError>;
  readonly expire: (now: DateTime.DateTime) => Effect.Effect<number, YeetCommandError>;
  readonly lookup: (
    key: ProofInputDigest,
    now: DateTime.DateTime
  ) => Effect.Effect<ProofReuseDecision, YeetCommandError>;
  readonly malformedRows: Effect.Effect<number, YeetCommandError>;
  readonly record: (fact: ProofFact) => Effect.Effect<void, YeetCommandError>;
  readonly recordShadow: (row: ProofLedgerShadowRow) => Effect.Effect<void, YeetCommandError>;
}

/**
 * Service key for a checkout's append-only proof ledger.
 *
 * **Details**
 *
 * `expire` reports how many persisted facts are logically expired at the
 * supplied instant; it never rewrites history. `lookup` independently checks
 * expiry, so callers do not need to run expiration first.
 *
 * **Example** (Construct a disconnected ledger service)
 *
 * ```ts
 * import { ProofLedger } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(ProofLedger.make("/repo"))) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ProofLedger extends Context.Service<ProofLedger, ProofLedgerShape>()($I`ProofLedger`, {
  make: Effect.fn("Yeet.ProofLedger.make")(function* (
    repoRoot: string,
    changedPackageTripwire: ProofChangedPackageTripwire = constFalse
  ): Effect.fn.Return<ProofLedgerShape, never, FileSystem.FileSystem | Path.Path> {
    const runtimeContext = yield* Effect.context<FileSystem.FileSystem | Path.Path>();
    return {
      record: Effect.fn("Yeet.ProofLedger.record")(function* (
        fact: ProofFact
      ): Effect.fn.Return<void, YeetCommandError> {
        yield* appendRow(repoRoot, ProofLedgerFactRow.make({ schemaVersion: PROOF_FACT_SCHEMA_VERSION, fact })).pipe(
          Effect.provide(runtimeContext)
        );
      }),
      recordShadow: Effect.fn("Yeet.ProofLedger.recordShadow")(function* (
        row: ProofLedgerShadowRow
      ): Effect.fn.Return<void, YeetCommandError> {
        yield* appendRow(repoRoot, row).pipe(Effect.provide(runtimeContext));
      }),
      lookup: Effect.fn("Yeet.ProofLedger.lookup")(function* (
        key: ProofInputDigest,
        now: DateTime.DateTime
      ): Effect.fn.Return<ProofReuseDecision, YeetCommandError> {
        if (Str.Equivalence(key.inputSource, "undeclared")) {
          return miss(key.key, "undeclared-inputs");
        }
        if (changedPackageTripwire(key)) {
          return miss(key.key, "changed-package-tripwire");
        }
        const loaded = yield* loadProofLedger(repoRoot).pipe(Effect.provide(runtimeContext));
        const facts = A.reverse(A.map(A.filter(loaded.rows, isFactRow), (row) => row.fact));
        const exact = A.findFirst(
          facts,
          (fact) =>
            Str.Equivalence(fact.key.key, key.key) &&
            sameReuseIdentity(fact.key, key) &&
            !Str.Equivalence(fact.key.inputSource, "undeclared") &&
            Str.Equivalence(fact.key.epochDigest, fact.epoch.digest)
        );
        if (O.isSome(exact)) {
          return decideExactFact(exact.value, now);
        }
        return O.match(
          A.findFirst(facts, (fact) => sameActionInputs(fact.key, key)),
          {
            onNone: () => miss(key.key, "no-fact"),
            onSome: (fact) => decideRelatedFact(key, fact),
          }
        );
      }),
      expire: Effect.fn("Yeet.ProofLedger.expire")(function* (
        now: DateTime.DateTime
      ): Effect.fn.Return<number, YeetCommandError> {
        const loaded = yield* loadProofLedger(repoRoot).pipe(Effect.provide(runtimeContext));
        return A.length(A.filter(A.filter(loaded.rows, isFactRow), (row) => factExpiredAt(row.fact, now)));
      }),
      disagreements: loadProofLedger(repoRoot).pipe(
        Effect.provide(runtimeContext),
        Effect.map((loaded) =>
          A.filter(
            A.filter(loaded.rows, isShadowRow),
            (row) => isHit(row.decision) && Str.Equivalence(row.observed, "failed")
          )
        ),
        Effect.withSpan("Yeet.ProofLedger.disagreements")
      ),
      malformedRows: loadProofLedger(repoRoot).pipe(
        Effect.provide(runtimeContext),
        Effect.map((loaded) => loaded.malformedRows),
        Effect.withSpan("Yeet.ProofLedger.malformedRows")
      ),
    };
  }),
}) {}
