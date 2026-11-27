import * as NodeURL from "node:url";
import * as NodeUtil from "node:util";
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
import { $EpistemicId } from "@beep/identity/packages";
import * as Pglite from "@beep/pglite";
import { makeDrizzle, makeDrizzleLayer, migrate } from "@beep/postgres";
import { it } from "@beep/test-runner";
import { makePgliteIntegrationGate, productEntityFixtureInput, provideScopedLayer } from "@beep/test-utils";
import { A } from "@beep/utils";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect } from "@effect/vitest";
import { assertSome, assertTrue } from "@effect/vitest/utils";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";

const migrationsFolder = NodeURL.fileURLToPath(new URL("../../../../_internal/db-admin/drizzle", import.meta.url));
const { shouldRunPgliteIntegration } = makePgliteIntegrationGate();

const TempDirServices = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);

const makePersistentLayer = (dataDir: string) =>
  makeDrizzleLayer().pipe(
    Layer.provideMerge(Pglite.makeLayer({ dataDir, extensions: { btree_gist }, relaxedDurability: true }))
  );

const decodeClaim = S.decodeUnknownEffect(CandidateClaim);
const decodeEvidence = S.decodeUnknownEffect(Evidence);
const decodeIdentity = S.decodeUnknownEffect(LogicalEdgeIdentity);
const decodeRecord = S.decodeUnknownEffect(RecordEdgeFact);
const decodeSupersede = S.decodeUnknownEffect(SupersedeEdgeFact);
const decodeAsOf = S.decodeUnknownEffect(EdgeAsOfQuery);
const decodeOutcomeInput = S.decodeUnknownEffect(ClaimGateOutcomeInput);

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

const asOf = Effect.fnUntraced(function* (
  identity: typeof LogicalEdgeIdentity.Encoded,
  validAt: number,
  knownAt: number
) {
  const decodedIdentity = yield* decodeIdentity(identity);
  return yield* decodeAsOf({ knownAt, logicalKey: logicalEdgeKey(decodedIdentity), validAt });
});

const factOf = (version: O.Option<{ readonly fact: Record<string, unknown> }>, key: string): O.Option<unknown> =>
  O.map(version, (value) => value.fact[key]);

const writeHistory = Effect.fnUntraced(function* () {
  const db = yield* makeDrizzle();
  yield* migrate(db, { migrationsFolder, migrationsSchema: "drizzle" });

  const argument = db.insert(DbSchema.candidateClaim);
  const decodedClaim = yield* decodeClaim({
    ...productEntityFixtureInput("EpistemicCandidateClaim", 1),
    fixtureKey: "claim.restart",
    lifecycle: "candidate",
    snapshot: {},
  });
  const fromResult1 = yield* Effect.fromResult(toCandidateClaimInsert(decodedClaim));
  const claimRows = yield* argument.values(fromResult1).returning();
  const argument1 = db.insert(DbSchema.evidence);
  const decodedEvidence = yield* decodeEvidence({
    ...productEntityFixtureInput("EpistemicEvidence", 1),
    artifactFixtureKey: "artifact.restart",
    span: {
      version: "evidence-position/v2",
      position: { endChar: 14, quote: "a claimed fact", startChar: 0 },
      extractorConfidence: {
        _tag: "Present",
        value: { _tag: "ReportedConfidence", value: 0.9, method: "synthetic-fixture" },
      },
    },
    spanFixtureKey: "span.restart",
  });
  const fromResult2 = yield* Effect.fromResult(toEvidenceInsert(decodedEvidence));
  const evidenceRows = yield* argument1.values(fromResult2).returning();
  const claimRow = yield* requireHead(claimRows, "the seeded candidate claim row");
  const evidenceRow = yield* requireHead(evidenceRows, "the seeded evidence row");
  const identity = encodedIdentity(claimRow.id, evidenceRow.id);

  const repository = yield* makeDrizzleEdgeAuthorityRepository();
  const decodedRecord = yield* decodeRecord({
    fact: { amount: "100" },
    identity,
    orgId: 1,
    recordedAt: 1_000,
    recordedBy: systemPrincipal,
    schemaVersion: "0.0.0",
    source: "Agent",
    validFrom: 1_000,
    validTo: null,
  });
  const former = yield* repository.record(decodedRecord);
  const decodedSupersede = yield* decodeSupersede({
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
  });
  const corrected = yield* repository.supersede(decodedSupersede);

  yield* TestClock.setTime(resolvedAtMillis);
  const dispositions = yield* makeDrizzleClaimDispositionRepository();
  const resolver = makeClaimGateOutcomeResolver(dispositions, makeClaimTransition());
  const decodedOutcomeInput = yield* decodeOutcomeInput({
    claim: {
      ...productEntityFixtureInput("EpistemicCandidateClaim", claimRow.id),
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
          focusNode: $EpistemicId.create("claim/restart").iri,
          message: "Expected at least 1 value(s) for evidence.",
          path: $EpistemicId.create("hasEvidenceQuote").iri,
          severity: "violation",
        },
      ],
    },
    resolvedBy: systemPrincipal,
    schemaVersion: "0.0.0",
    source: "Agent",
  });
  const outcome = yield* resolver.resolve(decodedOutcomeInput);

  expect(corrected.version).toBe(2);
  assertSome(corrected.supersedesId, former.id);
  pipe(outcome.disposition, O.isSome, assertTrue);

  return { claimId: outcome.claim.id, formerId: former.id, identity };
});

if (!shouldRunPgliteIntegration) {
  describe.skip("Epistemic EdgeAuthority restart proof", () => {});
} else {
  describe("Epistemic EdgeAuthority restart proof", { concurrent: false }, () => {
    it.layer(TempDirServices, { timeout: "10 seconds" })("native services", (it) => {
      it.effect(
        "history, lineage, dispositions, both as-of answers, and constraints survive a reopen",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tempDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-epistemic-restart-" });
          const dataDir = path.join(tempDir, "pgdata");

          const written = yield* writeHistory().pipe(provideScopedLayer(makePersistentLayer(dataDir)));

          yield* Effect.gen(function* () {
            const repository = yield* makeDrizzleEdgeAuthorityRepository();
            const dispositions = yield* makeDrizzleClaimDispositionRepository();

            const asOf1 = yield* asOf(written.identity, 1_500, 1_500);
            const before = yield* repository.readAsOf(asOf1);
            const asOf2 = yield* asOf(written.identity, 1_500, 2_500);
            const after = yield* repository.readAsOf(asOf2);
            assertSome(factOf(before, "amount"), "100");
            assertSome(factOf(after, "amount"), "150");

            const head = yield* pipe(
              after,
              O.match({
                onNone: () => Effect.die("expected the corrected head to survive the reopen"),
                onSome: Effect.succeed,
              })
            );
            expect(
              head.version,
              "the first scope's PGlite shut down and this one never migrates: the data files carry the history, fsync or not"
            ).toBe(2);
            assertSome(head.supersedesId, written.formerId);
            expect(DateTime.toEpochMillis(head.recordedAt)).toBe(2_000);

            const recorded = yield* dispositions.listByClaim(written.claimId);
            expect(A.map(recorded, (disposition) => disposition.status)).toStrictEqual(["rejected"]);
            expect(
              A.map(recorded, (disposition) => DateTime.toEpochMillis(disposition.resolvedAt)),
              "the resolver reads the clock for resolvedAt, pinned before the first scope resolved"
            ).toStrictEqual([resolvedAtMillis]);
            expect(
              A.map(recorded, (disposition) => A.map(disposition.violations, (violation) => violation.message))
            ).toStrictEqual([["Expected at least 1 value(s) for evidence."]]);

            const decodedRecord3 = yield* decodeRecord({
              fact: { amount: "999" },
              identity: written.identity,
              orgId: 1,
              recordedAt: 2_600,
              recordedBy: systemPrincipal,
              schemaVersion: "0.0.0",
              source: "Agent",
              validFrom: 1_200,
              validTo: 1_400,
            });
            const lastStatementConflict = yield* Effect.flip(repository.record(decodedRecord3));
            pipe(SupersessionConflict.is(lastStatementConflict), assertTrue);
            expect(
              NodeUtil.inspect(lastStatementConflict, { depth: 12 }),
              "the reopened database still enforces the exclusion constraint, not merely lists it"
            ).toContain("epistemic_edge_no_overlap");
          }).pipe(provideScopedLayer(makePersistentLayer(dataDir)));
        }),
        180_000
      );
    });
  });
}
