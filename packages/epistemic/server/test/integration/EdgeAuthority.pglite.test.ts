import { fileURLToPath } from "node:url";
import { inspect } from "node:util";
import { CandidateClaim, Evidence } from "@beep/epistemic-domain";
import { unflattenEdgeSource, unflattenEdgeTarget } from "@beep/epistemic-domain/entities/EdgeVersion";
import { ClaimGateResult, LogicalEdgeIdentity, logicalEdgeKey } from "@beep/epistemic-domain/values";
import { EpistemicServerDrizzleLive } from "@beep/epistemic-server/layer";
import { DbSchema } from "@beep/epistemic-tables";
import { toCandidateClaimInsert } from "@beep/epistemic-tables/entities/CandidateClaim";
import { fromEdgeVersionRow } from "@beep/epistemic-tables/entities/EdgeVersion";
import { toEvidenceInsert } from "@beep/epistemic-tables/entities/Evidence";
import {
  ClaimDispositionRepository,
  ClaimGateOutcomeInput,
  ClaimGateOutcomeResolver,
} from "@beep/epistemic-use-cases/ClaimDisposition";
import {
  EdgeAsOfQuery,
  EdgeAuthorityRepository,
  EdgeConstraintViolation,
  RecordEdgeFact,
  SupersedeEdgeFact,
  SupersessionConflict,
} from "@beep/epistemic-use-cases/EdgeAuthority";
import { makeDrizzle, makeDrizzleLayer, migrate } from "@beep/postgres";
import { it } from "@beep/test-runner";
import {
  makePgliteIntegrationGate,
  makePgliteSqlTestLayer,
  productEntityFixtureInput,
  TestDatabaseInfo,
} from "@beep/test-utils";
import { A } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { and, eq, isNull } from "drizzle-orm";
import { DateTime, Effect, Layer, pipe, Result } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { TestClock } from "effect/testing";

const migrationsFolder = fileURLToPath(new URL("../../../../_internal/db-admin/drizzle", import.meta.url));
const { shouldRunPgliteIntegration } = makePgliteIntegrationGate();

// The db-admin drizzle folder creates `btree_gist` for the edge exclusion
// constraint, which the shared external pglite-socket lane cannot load, so this
// suite is pinned to the in-process driver with the bundled extension.
const makeMigrationCapableLayer = () =>
  Layer.fresh(makePgliteSqlTestLayer({ inProcess: { extensions: { btree_gist } }, mode: "in-process" }));

const EdgeAuthorityTestLayer = EpistemicServerDrizzleLive.pipe(
  Layer.provideMerge(makeDrizzleLayer()),
  Layer.provideMerge(makeMigrationCapableLayer())
);

const decodeClaim = S.decodeUnknownEffect(CandidateClaim);
const decodeEvidence = S.decodeUnknownEffect(Evidence);
const decodeIdentity = S.decodeUnknownEffect(LogicalEdgeIdentity);
const decodeRecord = S.decodeUnknownEffect(RecordEdgeFact);
const decodeSupersede = S.decodeUnknownEffect(SupersedeEdgeFact);
const decodeAsOf = S.decodeUnknownEffect(EdgeAsOfQuery);
const decodeGateResult = S.decodeUnknownEffect(ClaimGateResult);
const decodeOutcomeInput = S.decodeUnknownEffect(ClaimGateOutcomeInput);

const systemPrincipal = { component: "Runtime", kind: "System" } as const;
const edgeTable = DbSchema.edgeVersion;

const migrateEpistemicEdge = Effect.fnUntraced(function* () {
  const info = yield* TestDatabaseInfo;
  const db = yield* makeDrizzle();
  const migrationsSchema = pipe(
    info.schema,
    O.getOrElse(() => "drizzle")
  );

  yield* migrate(db, { migrationsFolder, migrationsSchema });
});

const requireHead = <Row>(rows: ReadonlyArray<Row>, what: string): Effect.Effect<Row> =>
  pipe(
    rows,
    A.head,
    O.match({
      onNone: () => Effect.die(`expected ${what}`),
      onSome: Effect.succeed,
    })
  );

/**
 * Insert the claim and evidence rows the edge endpoints point at, and answer
 * with the identity every command in one scenario shares. Each scenario seeds
 * its own endpoints, so the database-assigned ids differ and the digest — and
 * therefore the logical edge — is scenario-local even though the suite shares
 * one database.
 */
const seedScenario = Effect.fnUntraced(function* (scenario: number) {
  yield* migrateEpistemicEdge();
  const db = yield* makeDrizzle();

  const claim = yield* decodeClaim({
    ...productEntityFixtureInput("EpistemicCandidateClaim", scenario),
    fixtureKey: `claim.scenario-${scenario}`,
    lifecycle: "candidate",
    snapshot: {},
  });
  const evidence = yield* decodeEvidence({
    ...productEntityFixtureInput("EpistemicEvidence", scenario),
    artifactFixtureKey: `artifact.scenario-${scenario}`,
    span: { confidence: 0.9, endChar: 14, quote: "a claimed fact", startChar: 0 },
    spanFixtureKey: `span.scenario-${scenario}`,
  });

  const claimInsert = yield* Effect.fromResult(toCandidateClaimInsert(claim));
  const claimRows = yield* db.insert(DbSchema.candidateClaim).values(claimInsert).returning();
  const evidenceInsert = yield* Effect.fromResult(toEvidenceInsert(evidence));
  const evidenceRows = yield* db.insert(DbSchema.evidence).values(evidenceInsert).returning();
  const claimRow = yield* requireHead(claimRows, "the seeded candidate claim row");
  const evidenceRow = yield* requireHead(evidenceRows, "the seeded evidence row");

  const identity = {
    evidenceScope: null,
    matterScope: null,
    orgScope: "1",
    qualifiers: { scenario: `scenario-${scenario}` },
    relation: "supports",
    source: { claimId: claimRow.id, kind: "claim" },
    target: { evidenceId: evidenceRow.id, kind: "evidence" },
  } as const;

  return { claimId: claimRow.id, evidenceId: evidenceRow.id, identity };
});

const recordFact = Effect.fnUntraced(function* (input: {
  readonly identity: typeof LogicalEdgeIdentity.Encoded;
  readonly fact: Record<string, unknown>;
  readonly recordedAt: number;
  readonly validFrom: number;
  readonly validTo?: number;
}) {
  return yield* decodeRecord({
    fact: input.fact,
    identity: input.identity,
    orgId: 1,
    recordedAt: input.recordedAt,
    recordedBy: systemPrincipal,
    schemaVersion: "0.0.0",
    source: "Agent",
    validFrom: input.validFrom,
    validTo: input.validTo ?? null,
  });
});

const supersedeFact = Effect.fnUntraced(function* (input: {
  readonly identity: typeof LogicalEdgeIdentity.Encoded;
  readonly expectedVersion: number;
  readonly fact: Record<string, unknown>;
  readonly recordedAt: number;
  readonly validFrom: number;
  readonly validTo?: number;
}) {
  return yield* decodeSupersede({
    expectedVersion: input.expectedVersion,
    fact: input.fact,
    identity: input.identity,
    orgId: 1,
    recordedAt: input.recordedAt,
    recordedBy: systemPrincipal,
    schemaVersion: "0.0.0",
    source: "Agent",
    validFrom: input.validFrom,
    validTo: input.validTo ?? null,
  });
});

const asOf = Effect.fnUntraced(function* (
  identity: typeof LogicalEdgeIdentity.Encoded,
  validAt: number,
  knownAt: number
) {
  return yield* decodeAsOf({
    knownAt,
    logicalKey: logicalEdgeKey(yield* decodeIdentity(identity)),
    validAt,
  });
});

const factOf = (version: O.Option<{ readonly fact: Record<string, unknown> }>, key: string): O.Option<unknown> =>
  O.map(version, (value) => value.fact[key]);

if (!shouldRunPgliteIntegration) {
  describe.skip("Epistemic EdgeAuthority repository PgLite integration", () => {});
} else {
  describe("Epistemic EdgeAuthority repository PgLite integration", { concurrent: false }, () => {
    it.layer(EdgeAuthorityTestLayer, { timeout: "5 minutes" })((it) => {
      it.effect(
        "records an open head and reads it back on both axes",
        Effect.fnUntraced(function* () {
          const scenario = yield* seedScenario(1);
          const repository = yield* EdgeAuthorityRepository;

          const head = yield* repository.record(
            yield* recordFact({
              fact: { note: "cited in the office action" },
              identity: scenario.identity,
              recordedAt: 1_000,
              validFrom: 1_000,
            })
          );

          expect(head.version).toBe(1);
          assertNone(head.validTo);
          assertNone(head.expiredAt);
          assertNone(head.supersedesId);
          expect(DateTime.toEpochMillis(head.validFrom)).toBe(1_000);
          expect(DateTime.toEpochMillis(head.recordedAt)).toBe(1_000);
          // Endpoints survive the flatten/unflatten round trip the columns force.
          const identity = yield* decodeIdentity(scenario.identity);
          assertSome(unflattenEdgeSource(head), identity.source);
          assertSome(unflattenEdgeTarget(head), identity.target);

          const atRead = yield* repository.readAsOf(yield* asOf(scenario.identity, 1_500, 1_500));
          assertSome<number>(
            O.map(atRead, (version) => version.version),
            1
          );

          // `readLatest` is the same predicate asked at now/now, so pinning the
          // clock is what makes "latest" a decidable assertion rather than a
          // wall-clock race.
          yield* TestClock.setTime(3_000);
          const latest = yield* repository.readLatest(head.logicalKey);
          assertSome<number>(
            O.map(latest, (version) => version.version),
            1
          );
        }),
        120_000
      );

      it.effect(
        "retroactive correction answers former and corrected facts at one valid instant",
        Effect.fnUntraced(function* () {
          const scenario = yield* seedScenario(2);
          const repository = yield* EdgeAuthorityRepository;
          const db = yield* makeDrizzle();

          const former = yield* repository.record(
            yield* recordFact({
              fact: { amount: "100" },
              identity: scenario.identity,
              recordedAt: 1_000,
              validFrom: 1_000,
            })
          );
          const corrected = yield* repository.supersede(
            yield* supersedeFact({
              expectedVersion: 1,
              fact: { amount: "150" },
              identity: scenario.identity,
              recordedAt: 2_000,
              validFrom: 1_000,
            })
          );

          expect(corrected.version).toBe(2);
          assertSome(corrected.supersedesId, former.id);

          const before = yield* repository.readAsOf(yield* asOf(scenario.identity, 1_500, 1_500));
          const after = yield* repository.readAsOf(yield* asOf(scenario.identity, 1_500, 2_500));
          const atValidFrom = yield* repository.readAsOf(yield* asOf(scenario.identity, 1_000, 1_000));
          const beforeValidFrom = yield* repository.readAsOf(yield* asOf(scenario.identity, 999, 2_500));

          assertSome(factOf(before, "amount"), "100");
          assertSome(factOf(after, "amount"), "150");
          assertSome(factOf(atValidFrom, "amount"), "100");
          assertNone(beforeValidFrom);

          const openHeads = yield* db
            .select()
            .from(edgeTable)
            .where(
              and(
                eq(edgeTable.logicalKey, corrected.logicalKey),
                isNull(edgeTable.validTo),
                isNull(edgeTable.expiredAt)
              )
            );
          const openVersions = yield* Effect.fromResult(Result.all(A.map(openHeads, fromEdgeVersionRow)));
          expect(A.map(openVersions, (version) => version.version)).toStrictEqual([2]);
        }),
        120_000
      );

      it.effect(
        "fact-became-false closes valid time at the invalidating instant, not at ingestion",
        Effect.fnUntraced(function* () {
          const scenario = yield* seedScenario(3);
          const repository = yield* EdgeAuthorityRepository;

          yield* repository.record(
            yield* recordFact({
              fact: { state: "employed" },
              identity: scenario.identity,
              recordedAt: 1_000,
              validFrom: 1_000,
            })
          );
          const closed = yield* repository.supersede(
            yield* supersedeFact({
              expectedVersion: 1,
              fact: { state: "employed" },
              identity: scenario.identity,
              recordedAt: 2_200,
              validFrom: 1_000,
              validTo: 1_800,
            })
          );

          assertSome(O.map(closed.validTo, DateTime.toEpochMillis), 1_800);

          const knownBefore = yield* repository.readAsOf(yield* asOf(scenario.identity, 1_900, 2_100));
          const knownAfter = yield* repository.readAsOf(yield* asOf(scenario.identity, 1_900, 2_300));
          const earlierValid = yield* repository.readAsOf(yield* asOf(scenario.identity, 1_500, 2_300));
          const atValidTo = yield* repository.readAsOf(yield* asOf(scenario.identity, 1_800, 2_300));
          const justBeforeValidTo = yield* repository.readAsOf(yield* asOf(scenario.identity, 1_799, 2_300));

          assertSome(factOf(knownBefore, "state"), "employed");
          assertNone(knownAfter);
          assertSome(factOf(earlierValid, "state"), "employed");
          assertNone(atValidTo);
          assertSome(factOf(justBeforeValidTo, "state"), "employed");
        }),
        120_000
      );

      it.effect(
        "late-arriving older fact inserts already closed without displacing the head",
        Effect.fnUntraced(function* () {
          const scenario = yield* seedScenario(4);
          const repository = yield* EdgeAuthorityRepository;
          const db = yield* makeDrizzle();

          const head = yield* repository.record(
            yield* recordFact({
              fact: { state: "newer" },
              identity: scenario.identity,
              recordedAt: 2_000,
              validFrom: 2_000,
            })
          );
          const late = yield* repository.record(
            yield* recordFact({
              fact: { state: "older" },
              identity: scenario.identity,
              recordedAt: 2_500,
              validFrom: 1_000,
            })
          );

          expect(late.version).toBe(2);
          // Closed at the standing head's valid_from even though the command
          // named no upper bound, and carrying no lineage: a late arrival is not
          // a correction of the fact it precedes.
          assertSome(O.map(late.validTo, DateTime.toEpochMillis), 2_000);
          assertNone(late.supersedesId);

          const openHeads = yield* db
            .select()
            .from(edgeTable)
            .where(
              and(eq(edgeTable.logicalKey, head.logicalKey), isNull(edgeTable.validTo), isNull(edgeTable.expiredAt))
            );
          const openVersions = yield* Effect.fromResult(Result.all(A.map(openHeads, fromEdgeVersionRow)));
          expect(A.map(openVersions, (version) => version.version)).toStrictEqual([1]);

          const olderWindow = yield* repository.readAsOf(yield* asOf(scenario.identity, 1_500, 3_000));
          const newerWindow = yield* repository.readAsOf(yield* asOf(scenario.identity, 2_500, 3_000));
          const beforeLateArrival = yield* repository.readAsOf(yield* asOf(scenario.identity, 1_500, 2_200));

          assertSome(factOf(olderWindow, "state"), "older");
          assertSome(factOf(newerWindow, "state"), "newer");
          assertNone(beforeLateArrival);
        }),
        120_000
      );

      it.effect(
        "a disjoint earlier interval is a plain insert with no supersession side effects",
        Effect.fnUntraced(function* () {
          const scenario = yield* seedScenario(5);
          const repository = yield* EdgeAuthorityRepository;

          const head = yield* repository.record(
            yield* recordFact({
              fact: { state: "current" },
              identity: scenario.identity,
              recordedAt: 2_000,
              validFrom: 2_000,
            })
          );
          const disjoint = yield* repository.record(
            yield* recordFact({
              fact: { state: "historic" },
              identity: scenario.identity,
              recordedAt: 2_500,
              validFrom: 500,
              validTo: 900,
            })
          );

          // The command's own upper bound is already earlier than the head, so
          // the donor rule leaves it alone rather than stretching it to 2000.
          assertSome(O.map(disjoint.validTo, DateTime.toEpochMillis), 900);
          assertNone(disjoint.supersedesId);
          expect(disjoint.version).toBe(2);

          const inGap = yield* repository.readAsOf(yield* asOf(scenario.identity, 1_500, 3_000));
          const inDisjoint = yield* repository.readAsOf(yield* asOf(scenario.identity, 700, 3_000));
          yield* TestClock.setTime(3_000);
          const latest = yield* repository.readLatest(head.logicalKey);

          assertNone(inGap);
          assertSome(factOf(inDisjoint, "state"), "historic");
          assertSome<number>(
            O.map(latest, (version) => version.version),
            1
          );
        }),
        120_000
      );

      it.effect(
        "a malformed interval is refused as a named constraint violation, not a conflict",
        Effect.fnUntraced(function* () {
          const scenario = yield* seedScenario(10);
          const repository = yield* EdgeAuthorityRepository;

          // An inverted valid interval is a malformed write rather than a lost
          // race, so it must NOT collapse into the conflict the two backstops
          // raise — it names the CHECK that caught it.
          const violation = yield* Effect.flip(
            repository.record(
              yield* recordFact({
                fact: { state: "inverted" },
                identity: scenario.identity,
                recordedAt: 1_000,
                validFrom: 2_000,
                validTo: 1_000,
              })
            )
          );

          pipe(EdgeConstraintViolation.is(violation), assertTrue);
          expect(EdgeConstraintViolation.is(violation) ? violation.constraintName : "").toBe(
            "epistemic_edge_valid_ordered"
          );
          expect(EdgeConstraintViolation.is(violation) ? violation.operation : "").toBe("record");
        }),
        120_000
      );

      it.effect(
        "a stale expectedVersion is refused as a supersession conflict",
        Effect.fnUntraced(function* () {
          const scenario = yield* seedScenario(6);
          const repository = yield* EdgeAuthorityRepository;

          yield* repository.record(
            yield* recordFact({
              fact: { amount: "100" },
              identity: scenario.identity,
              recordedAt: 1_000,
              validFrom: 1_000,
            })
          );

          // The rejection probe stays LAST in its effect: a failed statement
          // aborts the surrounding pglite transaction chain.
          const conflict = yield* Effect.flip(
            repository.supersede(
              yield* supersedeFact({
                expectedVersion: 2,
                fact: { amount: "150" },
                identity: scenario.identity,
                recordedAt: 2_000,
                validFrom: 1_000,
              })
            )
          );

          pipe(SupersessionConflict.is(conflict), assertTrue);
          assertSome<number>(SupersessionConflict.is(conflict) ? conflict.observedVersion : O.none(), 1);
        }),
        120_000
      );

      it.effect(
        "superseding an edge with no current head loses the lock",
        Effect.fnUntraced(function* () {
          const scenario = yield* seedScenario(7);
          const repository = yield* EdgeAuthorityRepository;

          const conflict = yield* Effect.flip(
            repository.supersede(
              yield* supersedeFact({
                expectedVersion: 1,
                fact: { amount: "150" },
                identity: scenario.identity,
                recordedAt: 2_000,
                validFrom: 1_000,
              })
            )
          );

          pipe(SupersessionConflict.is(conflict), assertTrue);
          assertNone(SupersessionConflict.is(conflict) ? conflict.observedVersion : O.some(0));
        }),
        120_000
      );

      it.effect(
        "a second open head for one logical edge is rejected by a database backstop",
        Effect.fnUntraced(function* () {
          const scenario = yield* seedScenario(8);
          const repository = yield* EdgeAuthorityRepository;

          yield* repository.record(
            yield* recordFact({
              fact: { state: "first" },
              identity: scenario.identity,
              recordedAt: 1_000,
              validFrom: 1_000,
            })
          );

          const conflict = yield* Effect.flip(
            repository.record(
              yield* recordFact({
                fact: { state: "second" },
                identity: scenario.identity,
                recordedAt: 3_000,
                validFrom: 3_000,
              })
            )
          );

          pipe(SupersessionConflict.is(conflict), assertTrue);
          expect(inspect(conflict, { depth: 12 })).toMatch(/epistemic_edge_(?:open_head_idx|no_overlap)/u);
        }),
        120_000
      );

      it.effect(
        "a rejected gate verdict lands as a durable disposition and leaves the claim alone",
        Effect.fnUntraced(function* () {
          const scenario = yield* seedScenario(9);
          const resolver = yield* ClaimGateOutcomeResolver;
          const dispositions = yield* ClaimDispositionRepository;

          const claim = {
            ...productEntityFixtureInput("EpistemicCandidateClaim", scenario.claimId),
            fixtureKey: "claim.disposition.demo",
            lifecycle: "candidate",
            snapshot: {},
          };
          const rejected = yield* decodeGateResult({
            verdict: "rejected",
            violations: [
              {
                focusNode: "https://beep.dev/epistemic/claim/patentability",
                message: "Expected at least 1 value(s) for evidence.",
                path: "https://beep.dev/epistemic/hasEvidenceQuote",
                severity: "violation",
              },
            ],
          });

          const outcome = yield* resolver.resolve(
            yield* decodeOutcomeInput({
              claim,
              dispositionId: 1,
              dispositionPublicId: `epistemic_claim_disposition_a${scenario.claimId}`,
              gateResult: rejected,
              resolvedBy: systemPrincipal,
              schemaVersion: "0.0.0",
              source: "Agent",
            })
          );

          expect(outcome.claim.lifecycle).toBe("candidate");
          assertSome(
            O.map(outcome.disposition, (disposition) => disposition.status),
            "rejected"
          );

          const recorded = yield* dispositions.listByClaim(outcome.claim.id);
          expect(A.map(recorded, (disposition) => disposition.reason)).toStrictEqual([
            "Expected at least 1 value(s) for evidence.",
          ]);
          expect(
            A.map(recorded, (disposition) => A.map(disposition.violations, (violation) => violation.message))
          ).toStrictEqual([["Expected at least 1 value(s) for evidence."]]);

          const admitted = yield* resolver.resolve(
            yield* decodeOutcomeInput({
              claim,
              dispositionId: 2,
              dispositionPublicId: `epistemic_claim_disposition_b${scenario.claimId}`,
              gateResult: { verdict: "admitted" },
              resolvedBy: systemPrincipal,
              schemaVersion: "0.0.0",
              source: "Agent",
            })
          );

          assertNone(admitted.disposition);
          expect(admitted.claim.lifecycle).toBe("shape_valid");
          const afterAdmitted = yield* dispositions.listByClaim(outcome.claim.id);
          expect(A.length(afterAdmitted)).toBe(1);
        }),
        120_000
      );
    });
  });
}
