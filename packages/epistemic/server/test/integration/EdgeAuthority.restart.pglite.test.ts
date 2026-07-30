// Restart proof (SPEC acceptance: history and reads survive process boundaries).
// Two scopes over ONE dataDir: the first writes through the real repository and the
// gate-outcome resolver, then PGlite shuts down with the scope; the second reopens the
// same directory and re-asks both axes, re-reads the lineage and the disposition, and
// re-provokes the exclusion constraint. Nothing is migrated in the second scope — if the
// answers come back, they came back off disk.
import { fileURLToPath } from "node:url";
import { inspect } from "node:util";
import { CandidateClaim, Evidence } from "@beep/epistemic-domain";
import { LogicalEdgeIdentity, logicalEdgeKey } from "@beep/epistemic-domain/values";
import { makeDrizzleClaimDispositionRepository, makeDrizzleEdgeAuthorityRepository } from "@beep/epistemic-server";
import { DbSchema } from "@beep/epistemic-tables";
import { toCandidateClaimInsert } from "@beep/epistemic-tables/entities/CandidateClaim";
import { toEvidenceInsert } from "@beep/epistemic-tables/entities/Evidence";
import { ClaimGateOutcomeInput, makeClaimGateOutcomeResolver } from "@beep/epistemic-use-cases/ClaimDisposition";
import { makeClaimTransition } from "@beep/epistemic-use-cases/ClaimLifecycle";
import {
  EdgeAsOfQuery,
  RecordEdgeFact,
  SupersedeEdgeFact,
  SupersessionConflict,
} from "@beep/epistemic-use-cases/EdgeAuthority";
import * as Pglite from "@beep/pglite";
import { makeDrizzle, makeDrizzleLayer, migrate } from "@beep/postgres";
import { baseEntityFixtureInput, makePgliteIntegrationGate, provideScopedLayer } from "@beep/test-utils";
import { A } from "@beep/utils";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { DateTime, Effect, FileSystem, Layer, Path, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { TestClock } from "effect/testing";

const migrationsFolder = fileURLToPath(new URL("../../../../_internal/db-admin/drizzle", import.meta.url));
const { shouldRunPgliteIntegration } = makePgliteIntegrationGate();

const TempDirServices = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);

// One persistent database per scope, reopened from the same directory. Relaxed durability
// keeps the proof fast; the point under test is that the data files carry the history, not
// that fsync happens on every commit.
const makePersistentLayer = (dataDir: string) =>
  makeDrizzleLayer().pipe(
    Layer.provideMerge(Pglite.makeLayer({ dataDir, extensions: { btree_gist }, relaxedDurability: true }))
  );

const decodeClaim = S.decodeUnknownSync(CandidateClaim);
const decodeEvidence = S.decodeUnknownSync(Evidence);
const decodeIdentity = S.decodeUnknownSync(LogicalEdgeIdentity);
const decodeRecord = S.decodeUnknownSync(RecordEdgeFact);
const decodeSupersede = S.decodeUnknownSync(SupersedeEdgeFact);
const decodeAsOf = S.decodeUnknownSync(EdgeAsOfQuery);
const decodeOutcomeInput = S.decodeUnknownSync(ClaimGateOutcomeInput);

const systemPrincipal = { component: "Runtime", kind: "System" } as const;
const resolvedAtMillis = 1_500;

const requireHead = <Row>(rows: ReadonlyArray<Row>, what: string): Effect.Effect<Row> =>
  pipe(
    rows,
    A.head,
    O.match({
      onNone: () => Effect.die(`expected ${what}`),
      onSome: Effect.succeed,
    })
  );

const encodedIdentity = (claimId: number, evidenceId: number) =>
  ({
    evidenceScope: null,
    matterScope: null,
    orgScope: "1",
    qualifiers: { scenario: "restart" },
    relation: "supports",
    source: { claimId, kind: "claim" },
    target: { evidenceId, kind: "evidence" },
  }) as const;

const asOf = (identity: typeof LogicalEdgeIdentity.Encoded, validAt: number, knownAt: number) =>
  decodeAsOf({ knownAt, logicalKey: logicalEdgeKey(decodeIdentity(identity)), validAt });

const factOf = (version: O.Option<{ readonly fact: Record<string, unknown> }>, key: string): O.Option<unknown> =>
  O.map(version, (value) => value.fact[key]);

/**
 * First scope: migrate, seed the endpoints, write one correction through the repository,
 * and record a rejected gate verdict. Answers with the identity and the ids the second
 * scope re-reads.
 */
const writeHistory = Effect.fnUntraced(function* () {
  const db = yield* makeDrizzle();
  yield* migrate(db, { migrationsFolder, migrationsSchema: "drizzle" });

  const claimRows = yield* db
    .insert(DbSchema.candidateClaim)
    .values(
      toCandidateClaimInsert(
        decodeClaim({
          ...baseEntityFixtureInput("EpistemicCandidateClaim", 1),
          fixtureKey: "claim.restart",
          lifecycle: "candidate",
          snapshot: {},
        })
      )
    )
    .returning();
  const evidenceRows = yield* db
    .insert(DbSchema.evidence)
    .values(
      toEvidenceInsert(
        decodeEvidence({
          ...baseEntityFixtureInput("EpistemicEvidence", 1),
          artifactFixtureKey: "artifact.restart",
          span: { confidence: 0.9, endChar: 14, quote: "a claimed fact", startChar: 0 },
          spanFixtureKey: "span.restart",
        })
      )
    )
    .returning();
  const claimRow = yield* requireHead(claimRows, "the seeded candidate claim row");
  const evidenceRow = yield* requireHead(evidenceRows, "the seeded evidence row");
  const identity = encodedIdentity(claimRow.id, evidenceRow.id);

  const repository = yield* makeDrizzleEdgeAuthorityRepository();
  const former = yield* repository.record(
    decodeRecord({
      fact: { amount: "100" },
      identity,
      orgId: 1,
      recordedAt: 1_000,
      recordedBy: systemPrincipal,
      schemaVersion: "0.0.0",
      source: "Agent",
      validFrom: 1_000,
      validTo: null,
    })
  );
  const corrected = yield* repository.supersede(
    decodeSupersede({
      expectedVersion: 1,
      fact: { amount: "150" },
      identity,
      orgId: 1,
      recordedAt: 2_000,
      recordedBy: systemPrincipal,
      schemaVersion: "0.0.0",
      source: "Agent",
      validFrom: 1_000,
      validTo: null,
    })
  );

  // The resolver reads the clock for `resolvedAt`; pinning it makes the surviving row
  // assertable rather than merely present.
  yield* TestClock.setTime(resolvedAtMillis);
  const dispositions = yield* makeDrizzleClaimDispositionRepository();
  const resolver = makeClaimGateOutcomeResolver(dispositions, makeClaimTransition());
  const outcome = yield* resolver.resolve(
    decodeOutcomeInput({
      claim: {
        ...baseEntityFixtureInput("EpistemicCandidateClaim", claimRow.id),
        fixtureKey: "claim.restart",
        lifecycle: "candidate",
        snapshot: {},
      },
      dispositionId: 1,
      dispositionPublicId: "epistemic_claim_disposition_a1",
      gateResult: {
        verdict: "rejected",
        violations: [
          {
            focusNode: "https://beep.dev/epistemic/claim/restart",
            message: "Expected at least 1 value(s) for evidence.",
            path: "https://beep.dev/epistemic/hasEvidenceQuote",
            severity: "violation",
          },
        ],
      },
      resolvedBy: systemPrincipal,
      schemaVersion: "0.0.0",
      source: "Agent",
    })
  );

  expect(corrected.version).toBe(2);
  expect(corrected.supersedesId).toStrictEqual(O.some(former.id));
  expect(O.isSome(outcome.disposition)).toBe(true);

  // The claim id travels back branded (the resolver hands the decoded claim through),
  // so the second scope can read the disposition without re-decoding a raw row id.
  return { claimId: outcome.claim.id, formerId: former.id, identity };
});

if (!shouldRunPgliteIntegration) {
  describe.skip("Epistemic EdgeAuthority restart proof", () => {});
} else {
  describe("Epistemic EdgeAuthority restart proof", { concurrent: false }, () => {
    it.effect(
      "history, lineage, dispositions, both as-of answers, and constraints survive a reopen",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tempDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-epistemic-restart-" });
        const dataDir = path.join(tempDir, "pgdata");

        const written = yield* writeHistory().pipe(provideScopedLayer(makePersistentLayer(dataDir)));

        // The first scope is closed here: PGlite has shut down and the only thing carrying
        // the history across is the directory.
        yield* Effect.gen(function* () {
          const repository = yield* makeDrizzleEdgeAuthorityRepository();
          const dispositions = yield* makeDrizzleClaimDispositionRepository();

          const before = yield* repository.readAsOf(asOf(written.identity, 1_500, 1_500));
          const after = yield* repository.readAsOf(asOf(written.identity, 1_500, 2_500));
          expect(factOf(before, "amount")).toStrictEqual(O.some("100"));
          expect(factOf(after, "amount")).toStrictEqual(O.some("150"));

          const head = yield* pipe(
            after,
            O.match({
              onNone: () => Effect.die("expected the corrected head to survive the reopen"),
              onSome: Effect.succeed,
            })
          );
          expect(head.version).toBe(2);
          expect(head.supersedesId).toStrictEqual(O.some(written.formerId));
          expect(DateTime.toEpochMillis(head.recordedAt)).toBe(2_000);

          const recorded = yield* dispositions.listByClaim(written.claimId);
          expect(A.map(recorded, (disposition) => disposition.status)).toStrictEqual(["rejected"]);
          expect(A.map(recorded, (disposition) => DateTime.toEpochMillis(disposition.resolvedAt))).toStrictEqual([
            resolvedAtMillis,
          ]);
          expect(
            A.map(recorded, (disposition) => A.map(disposition.violations, (violation) => violation.message))
          ).toStrictEqual([["Expected at least 1 value(s) for evidence."]]);

          // The constraint is live in the reopened database, not merely recorded in its
          // catalog: a closed interval overlapping the surviving open head is still
          // refused, and the refusal still arrives as the typed conflict. Probe stays
          // LAST — it aborts the surrounding transaction chain.
          const conflict = yield* Effect.flip(
            repository.record(
              decodeRecord({
                fact: { amount: "999" },
                identity: written.identity,
                orgId: 1,
                recordedAt: 2_600,
                recordedBy: systemPrincipal,
                schemaVersion: "0.0.0",
                source: "Agent",
                validFrom: 1_200,
                validTo: 1_400,
              })
            )
          );
          expect(SupersessionConflict.is(conflict)).toBe(true);
          expect(inspect(conflict, { depth: 12 })).toContain("epistemic_edge_no_overlap");
        }).pipe(provideScopedLayer(makePersistentLayer(dataDir)));
      }, provideScopedLayer(TempDirServices)),
      180_000
    );
  });
}
