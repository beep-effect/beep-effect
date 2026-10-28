import * as NodeURL from "node:url";
import { CandidateClaim, Evidence } from "@beep/epistemic-domain";
import { ClaimDisposition } from "@beep/epistemic-domain/entities/ClaimDisposition";
import { LogicalEdgeIdentity, logicalEdgeKey } from "@beep/epistemic-domain/values";
import { RetentionPolicy, RetentionQuery } from "@beep/epistemic-domain/values/Retention";
import { ClaimDispositionRepositoryDrizzle } from "@beep/epistemic-server/ClaimDisposition";
import { EdgeAuthorityRepositoryDrizzle } from "@beep/epistemic-server/EdgeAuthority";
import { RetentionAuthorityReaderDrizzle, rebuildRetentionStore } from "@beep/epistemic-server/Retention";
import { DbSchema } from "@beep/epistemic-tables";
import { toCandidateClaimInsert } from "@beep/epistemic-tables/entities/CandidateClaim";
import { toEvidenceInsert } from "@beep/epistemic-tables/entities/Evidence";
import { ClaimDispositionRepository } from "@beep/epistemic-use-cases/ClaimDisposition";
import { EdgeAuthorityRepository, RecordEdgeFact, SupersedeEdgeFact } from "@beep/epistemic-use-cases/EdgeAuthority";
import { RetentionCalibrationRegistry } from "@beep/epistemic-use-cases/Retention";
import { $EpistemicServerId } from "@beep/identity/packages";
import { makeDrizzle, makeDrizzleLayer, migrate } from "@beep/postgres";
import { it } from "@beep/test-runner";
import { makePgliteSqlTestLayer, productEntityFixtureInput, TestDatabaseInfo } from "@beep/test-utils";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect } from "@effect/vitest";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { asc } from "drizzle-orm";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const migrationsFolder = NodeURL.fileURLToPath(new URL("../../../_internal/db-admin/drizzle", import.meta.url));
const TestLayer = Layer.mergeAll(
  EdgeAuthorityRepositoryDrizzle,
  ClaimDispositionRepositoryDrizzle,
  RetentionAuthorityReaderDrizzle,
  RetentionCalibrationRegistry.inert,
  NodeServices.layer
).pipe(
  Layer.provideMerge(makeDrizzleLayer()),
  Layer.provideMerge(
    Layer.fresh(makePgliteSqlTestLayer({ inProcess: { extensions: { btree_gist } }, mode: "in-process" }))
  )
);
const decodeClaim = S.decodeUnknownEffect(CandidateClaim);
const decodeEvidence = S.decodeUnknownEffect(Evidence);
const decodeIdentity = S.decodeUnknownEffect(LogicalEdgeIdentity);
const decodeRecord = S.decodeUnknownEffect(RecordEdgeFact);
const decodeSupersede = S.decodeUnknownEffect(SupersedeEdgeFact);

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

const $I = $EpistemicServerId.create("test/RetentionAuthority.pglite.test");

// Generate ordered windows constructively; filtering equal size-zero integers exhausts the generator.
const PolicyPositive = RetentionPolicy.fields.hotThroughMillis.check(S.isLessThanOrEqualTo(1_000_000));
const PolicyArbitrary = Arbitrary.schema(
  S.Struct({
    hotThroughMillis: PolicyPositive,
    warmThroughMillis: PolicyPositive,
    coldThroughMillis: PolicyPositive,
    decayScaleMillis: PolicyPositive,
    payloadBudgetBytes: PolicyPositive,
  })
).pipe(
  Arbitrary.map((parts) =>
    RetentionPolicy.make({
      ...parts,
      warmThroughMillis: parts.hotThroughMillis + parts.warmThroughMillis,
      coldThroughMillis: parts.hotThroughMillis + parts.warmThroughMillis + parts.coldThroughMillis,
    })
  )
);

class RetentionScenario extends Context.Service<RetentionScenario, Effect.Success<ReturnType<typeof seedScenario>>>()(
  $I`RetentionScenario`
) {}
const SeededTestLayer = Layer.effect(
  RetentionScenario,
  Effect.gen(function* () {
    const scenario = yield* seedScenario(41);
    const repository = yield* EdgeAuthorityRepository;
    yield* repository.record(
      yield* recordFact({
        fact: { amount: "original" },
        identity: scenario.identity,
        recordedAt: 1000,
        validFrom: 1000,
      })
    );
    yield* repository.supersede(
      yield* supersedeFact({
        expectedVersion: 1,
        fact: { amount: "corrected amount" },
        identity: scenario.identity,
        recordedAt: 2000,
        validFrom: 1000,
      })
    );
    const dispositionRepository = yield* ClaimDispositionRepository;
    yield* dispositionRepository.record(
      yield* S.decodeUnknownEffect(ClaimDisposition)({
        ...productEntityFixtureInput("EpistemicClaimDisposition", 41),
        claimId: scenario.claimId,
        reason: "Synthetic rejection for projection drill",
        resolvedAt: 2000,
        resolvedBy: systemPrincipal,
        status: "rejected",
        violations: [],
      })
    );
    return scenario;
  })
).pipe(Layer.provideMerge(TestLayer));

describe("retention authority rebuild", { concurrent: false }, () => {
  it.layer(SeededTestLayer, { timeout: "120 seconds" })("migrated Postgres authority", (it) => {
    it.effect.prop(
      "rebuilds disposable retention bytes at two coordinates after full deletion without changing authority",
      [PolicyArbitrary],
      ([candidate]) =>
        Effect.gen(function* () {
          const scenario = yield* RetentionScenario;
          const db = yield* makeDrizzle();
          const beforeEdges = yield* db.select().from(edgeTable).orderBy(asc(edgeTable.id));
          const beforeDispositions = yield* db
            .select()
            .from(DbSchema.claimDisposition)
            .orderBy(asc(DbSchema.claimDisposition.id));
          const answers = yield* Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const temp = yield* fs.makeTempDirectoryScoped({ prefix: "retention-proof-" });
            const store = path.join(temp, "projections");
            const key = logicalEdgeKey(yield* decodeIdentity(scenario.identity));
            const answers = yield* Effect.forEach([1500, 2500], (knownAt) =>
              Effect.gen(function* () {
                const query = yield* S.decodeEffect(RetentionQuery)({
                  orgId: 1,
                  logicalKeys: [key],
                  validAt: 1500,
                  knownAt,
                  dispositions: [],
                });
                const report = yield* rebuildRetentionStore(store, query, O.some(candidate));
                expect(report.rows.length).toBe(1);
                expect(report.rows[0]?.version).toBe(knownAt === 1500 ? 1 : 2);
                expect(report.rows[0]?.sourceDisposition).toBe(knownAt === 1500 ? "unresolved" : "rejected");
                expect(report.admission.state).toBe("inert");
                const bytes = yield* fs.readFile(path.join(store, "report.json"));
                const text = yield* fs.readFile(path.join(store, "report.txt"));
                // Destroy the complete store, including an unrelated derived cache artifact.
                yield* fs.writeFileString(path.join(store, "derived.cache"), "disposable");
                yield* fs.remove(store, { recursive: true });
                expect(yield* fs.exists(store)).toBe(false);
                const rebuilt = yield* rebuildRetentionStore(store, query, O.some(candidate));
                expect(yield* fs.readFile(path.join(store, "report.json"))).toEqual(bytes);
                expect(yield* fs.readFile(path.join(store, "report.txt"))).toEqual(text);
                expect(rebuilt).toStrictEqual(report);
                expect(A.sort(yield* fs.readDirectory(store), Str.Order)).toEqual(["report.json", "report.txt"]);
                return report;
              })
            );
            return answers;
          }).pipe(Effect.scoped);
          expect(answers[0]?.payloadBytes).not.toBe(answers[1]?.payloadBytes);
          expect(yield* db.select().from(edgeTable).orderBy(asc(edgeTable.id))).toStrictEqual(beforeEdges);
          expect(
            yield* db.select().from(DbSchema.claimDisposition).orderBy(asc(DbSchema.claimDisposition.id))
          ).toStrictEqual(beforeDispositions);
        }),
      { timeout: 300_000 }
    );
  });
});
