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
import {
  baseEntityFixtureInput,
  makePgliteIntegrationGate,
  makePgliteSqlTestLayer,
  TestDatabaseInfo,
} from "@beep/test-utils";
import { A } from "@beep/utils";
import { describe, expect, layer } from "@effect/vitest";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { and, eq, isNull } from "drizzle-orm";
import { DateTime, Effect, Layer, pipe } from "effect";
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

const decodeClaim = S.decodeUnknownSync(CandidateClaim);
const decodeEvidence = S.decodeUnknownSync(Evidence);
const decodeIdentity = S.decodeUnknownSync(LogicalEdgeIdentity);
const decodeRecord = S.decodeUnknownSync(RecordEdgeFact);
const decodeSupersede = S.decodeUnknownSync(SupersedeEdgeFact);
const decodeAsOf = S.decodeUnknownSync(EdgeAsOfQuery);
const decodeGateResult = S.decodeUnknownSync(ClaimGateResult);
const decodeOutcomeInput = S.decodeUnknownSync(ClaimGateOutcomeInput);

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

  const claim = decodeClaim({
    ...baseEntityFixtureInput("EpistemicCandidateClaim", scenario),
    fixtureKey: `claim.scenario-${scenario}`,
    lifecycle: "candidate",
    snapshot: {},
  });
  const evidence = decodeEvidence({
    ...baseEntityFixtureInput("EpistemicEvidence", scenario),
    artifactFixtureKey: `artifact.scenario-${scenario}`,
    span: { confidence: 0.9, endChar: 14, quote: "a claimed fact", startChar: 0 },
    spanFixtureKey: `span.scenario-${scenario}`,
  });

  const claimRows = yield* db.insert(DbSchema.candidateClaim).values(toCandidateClaimInsert(claim)).returning();
  const evidenceRows = yield* db.insert(DbSchema.evidence).values(toEvidenceInsert(evidence)).returning();
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

const recordFact = (input: {
  readonly identity: typeof LogicalEdgeIdentity.Encoded;
  readonly fact: Record<string, unknown>;
  readonly recordedAt: number;
  readonly validFrom: number;
  readonly validTo?: number;
}) =>
  decodeRecord({
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

const supersedeFact = (input: {
  readonly identity: typeof LogicalEdgeIdentity.Encoded;
  readonly expectedVersion: number;
  readonly fact: Record<string, unknown>;
  readonly recordedAt: number;
  readonly validFrom: number;
  readonly validTo?: number;
}) =>
  decodeSupersede({
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

const asOf = (identity: typeof LogicalEdgeIdentity.Encoded, validAt: number, knownAt: number) =>
  decodeAsOf({
    knownAt,
    logicalKey: logicalEdgeKey(decodeIdentity(identity)),
    validAt,
  });

const factOf = (version: O.Option<{ readonly fact: Record<string, unknown> }>, key: string): O.Option<unknown> =>
  O.map(version, (value) => value.fact[key]);

if (!shouldRunPgliteIntegration) {
  describe.skip("Epistemic EdgeAuthority repository PgLite integration", () => {});
} else {
  describe("Epistemic EdgeAuthority repository PgLite integration", { concurrent: false }, () => {
    layer(EdgeAuthorityTestLayer, { timeout: "5 minutes" })((it) => {
      it.effect(
        "records an open head and reads it back on both axes",
        Effect.fnUntraced(function* () {
          const scenario = yield* seedScenario(1);
          const repository = yield* EdgeAuthorityRepository;

          const head = yield* repository.record(
            recordFact({
              fact: { note: "cited in the office action" },
              identity: scenario.identity,
              recordedAt: 1_000,
              validFrom: 1_000,
            })
          );

          expect(head.version).toBe(1);
          expect(O.isNone(head.validTo)).toBe(true);
          expect(O.isNone(head.expiredAt)).toBe(true);
          expect(O.isNone(head.supersedesId)).toBe(true);
          expect(DateTime.toEpochMillis(head.validFrom)).toBe(1_000);
          expect(DateTime.toEpochMillis(head.recordedAt)).toBe(1_000);
          // Endpoints survive the flatten/unflatten round trip the columns force.
          const identity = decodeIdentity(scenario.identity);
          expect(unflattenEdgeSource(head)).toStrictEqual(O.some(identity.source));
          expect(unflattenEdgeTarget(head)).toStrictEqual(O.some(identity.target));

          const atRead = yield* repository.readAsOf(asOf(scenario.identity, 1_500, 1_500));
          expect(O.map(atRead, (version) => version.version)).toStrictEqual(O.some(1));

          // `readLatest` is the same predicate asked at now/now, so pinning the
          // clock is what makes "latest" a decidable assertion rather than a
          // wall-clock race.
          yield* TestClock.setTime(3_000);
          const latest = yield* repository.readLatest(head.logicalKey);
          expect(O.map(latest, (version) => version.version)).toStrictEqual(O.some(1));
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
            recordFact({
              fact: { amount: "100" },
              identity: scenario.identity,
              recordedAt: 1_000,
              validFrom: 1_000,
            })
          );
          const corrected = yield* repository.supersede(
            supersedeFact({
              expectedVersion: 1,
              fact: { amount: "150" },
              identity: scenario.identity,
              recordedAt: 2_000,
              validFrom: 1_000,
            })
          );

          expect(corrected.version).toBe(2);
          expect(corrected.supersedesId).toStrictEqual(O.some(former.id));

          const before = yield* repository.readAsOf(asOf(scenario.identity, 1_500, 1_500));
          const after = yield* repository.readAsOf(asOf(scenario.identity, 1_500, 2_500));
          const atValidFrom = yield* repository.readAsOf(asOf(scenario.identity, 1_000, 1_000));
          const beforeValidFrom = yield* repository.readAsOf(asOf(scenario.identity, 999, 2_500));

          expect(factOf(before, "amount")).toStrictEqual(O.some("100"));
          expect(factOf(after, "amount")).toStrictEqual(O.some("150"));
          expect(factOf(atValidFrom, "amount")).toStrictEqual(O.some("100"));
          expect(O.isNone(beforeValidFrom)).toBe(true);

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
          expect(A.map(A.map(openHeads, fromEdgeVersionRow), (version) => version.version)).toStrictEqual([2]);
        }),
        120_000
      );

      it.effect(
        "fact-became-false closes valid time at the invalidating instant, not at ingestion",
        Effect.fnUntraced(function* () {
          const scenario = yield* seedScenario(3);
          const repository = yield* EdgeAuthorityRepository;

          yield* repository.record(
            recordFact({
              fact: { state: "employed" },
              identity: scenario.identity,
              recordedAt: 1_000,
              validFrom: 1_000,
            })
          );
          const closed = yield* repository.supersede(
            supersedeFact({
              expectedVersion: 1,
              fact: { state: "employed" },
              identity: scenario.identity,
              recordedAt: 2_200,
              validFrom: 1_000,
              validTo: 1_800,
            })
          );

          expect(O.map(closed.validTo, DateTime.toEpochMillis)).toStrictEqual(O.some(1_800));

          const knownBefore = yield* repository.readAsOf(asOf(scenario.identity, 1_900, 2_100));
          const knownAfter = yield* repository.readAsOf(asOf(scenario.identity, 1_900, 2_300));
          const earlierValid = yield* repository.readAsOf(asOf(scenario.identity, 1_500, 2_300));
          const atValidTo = yield* repository.readAsOf(asOf(scenario.identity, 1_800, 2_300));
          const justBeforeValidTo = yield* repository.readAsOf(asOf(scenario.identity, 1_799, 2_300));

          expect(factOf(knownBefore, "state")).toStrictEqual(O.some("employed"));
          expect(O.isNone(knownAfter)).toBe(true);
          expect(factOf(earlierValid, "state")).toStrictEqual(O.some("employed"));
          expect(O.isNone(atValidTo)).toBe(true);
          expect(factOf(justBeforeValidTo, "state")).toStrictEqual(O.some("employed"));
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
            recordFact({
              fact: { state: "newer" },
              identity: scenario.identity,
              recordedAt: 2_000,
              validFrom: 2_000,
            })
          );
          const late = yield* repository.record(
            recordFact({
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
          expect(O.map(late.validTo, DateTime.toEpochMillis)).toStrictEqual(O.some(2_000));
          expect(O.isNone(late.supersedesId)).toBe(true);

          const openHeads = yield* db
            .select()
            .from(edgeTable)
            .where(
              and(eq(edgeTable.logicalKey, head.logicalKey), isNull(edgeTable.validTo), isNull(edgeTable.expiredAt))
            );
          expect(A.map(A.map(openHeads, fromEdgeVersionRow), (version) => version.version)).toStrictEqual([1]);

          const olderWindow = yield* repository.readAsOf(asOf(scenario.identity, 1_500, 3_000));
          const newerWindow = yield* repository.readAsOf(asOf(scenario.identity, 2_500, 3_000));
          const beforeLateArrival = yield* repository.readAsOf(asOf(scenario.identity, 1_500, 2_200));

          expect(factOf(olderWindow, "state")).toStrictEqual(O.some("older"));
          expect(factOf(newerWindow, "state")).toStrictEqual(O.some("newer"));
          expect(O.isNone(beforeLateArrival)).toBe(true);
        }),
        120_000
      );

      it.effect(
        "a disjoint earlier interval is a plain insert with no supersession side effects",
        Effect.fnUntraced(function* () {
          const scenario = yield* seedScenario(5);
          const repository = yield* EdgeAuthorityRepository;

          const head = yield* repository.record(
            recordFact({
              fact: { state: "current" },
              identity: scenario.identity,
              recordedAt: 2_000,
              validFrom: 2_000,
            })
          );
          const disjoint = yield* repository.record(
            recordFact({
              fact: { state: "historic" },
              identity: scenario.identity,
              recordedAt: 2_500,
              validFrom: 500,
              validTo: 900,
            })
          );

          // The command's own upper bound is already earlier than the head, so
          // the donor rule leaves it alone rather than stretching it to 2000.
          expect(O.map(disjoint.validTo, DateTime.toEpochMillis)).toStrictEqual(O.some(900));
          expect(O.isNone(disjoint.supersedesId)).toBe(true);
          expect(disjoint.version).toBe(2);

          const inGap = yield* repository.readAsOf(asOf(scenario.identity, 1_500, 3_000));
          const inDisjoint = yield* repository.readAsOf(asOf(scenario.identity, 700, 3_000));
          yield* TestClock.setTime(3_000);
          const latest = yield* repository.readLatest(head.logicalKey);

          expect(O.isNone(inGap)).toBe(true);
          expect(factOf(inDisjoint, "state")).toStrictEqual(O.some("historic"));
          expect(O.map(latest, (version) => version.version)).toStrictEqual(O.some(1));
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
              recordFact({
                fact: { state: "inverted" },
                identity: scenario.identity,
                recordedAt: 1_000,
                validFrom: 2_000,
                validTo: 1_000,
              })
            )
          );

          expect(EdgeConstraintViolation.is(violation)).toBe(true);
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
            recordFact({
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
              supersedeFact({
                expectedVersion: 2,
                fact: { amount: "150" },
                identity: scenario.identity,
                recordedAt: 2_000,
                validFrom: 1_000,
              })
            )
          );

          expect(SupersessionConflict.is(conflict)).toBe(true);
          expect(SupersessionConflict.is(conflict) ? conflict.observedVersion : O.none()).toStrictEqual(O.some(1));
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
              supersedeFact({
                expectedVersion: 1,
                fact: { amount: "150" },
                identity: scenario.identity,
                recordedAt: 2_000,
                validFrom: 1_000,
              })
            )
          );

          expect(SupersessionConflict.is(conflict)).toBe(true);
          expect(SupersessionConflict.is(conflict) ? conflict.observedVersion : O.some(0)).toStrictEqual(O.none());
        }),
        120_000
      );

      it.effect(
        "a second open head for one logical edge is rejected by a database backstop",
        Effect.fnUntraced(function* () {
          const scenario = yield* seedScenario(8);
          const repository = yield* EdgeAuthorityRepository;

          yield* repository.record(
            recordFact({
              fact: { state: "first" },
              identity: scenario.identity,
              recordedAt: 1_000,
              validFrom: 1_000,
            })
          );

          const conflict = yield* Effect.flip(
            repository.record(
              recordFact({
                fact: { state: "second" },
                identity: scenario.identity,
                recordedAt: 3_000,
                validFrom: 3_000,
              })
            )
          );

          expect(SupersessionConflict.is(conflict)).toBe(true);
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
            ...baseEntityFixtureInput("EpistemicCandidateClaim", scenario.claimId),
            fixtureKey: "claim.disposition.demo",
            lifecycle: "candidate",
            snapshot: {},
          };
          const rejected = decodeGateResult({
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
            decodeOutcomeInput({
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
          expect(O.map(outcome.disposition, (disposition) => disposition.status)).toStrictEqual(O.some("rejected"));

          const recorded = yield* dispositions.listByClaim(outcome.claim.id);
          expect(A.map(recorded, (disposition) => disposition.reason)).toStrictEqual([
            "Expected at least 1 value(s) for evidence.",
          ]);
          expect(
            A.map(recorded, (disposition) => A.map(disposition.violations, (violation) => violation.message))
          ).toStrictEqual([["Expected at least 1 value(s) for evidence."]]);

          const admitted = yield* resolver.resolve(
            decodeOutcomeInput({
              claim,
              dispositionId: 2,
              dispositionPublicId: `epistemic_claim_disposition_b${scenario.claimId}`,
              gateResult: { verdict: "admitted" },
              resolvedBy: systemPrincipal,
              schemaVersion: "0.0.0",
              source: "Agent",
            })
          );

          expect(O.isNone(admitted.disposition)).toBe(true);
          expect(admitted.claim.lifecycle).toBe("shape_valid");
          const afterAdmitted = yield* dispositions.listByClaim(outcome.claim.id);
          expect(A.length(afterAdmitted)).toBe(1);
        }),
        120_000
      );
    });
  });
}
