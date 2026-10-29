/** Offline synthetic calibration entrypoint; no database or approval configuration. */
import {
  RetentionEvaluation,
  RetentionPolicy,
  RetentionQuery,
  RetentionSnapshot,
} from "@beep/epistemic-domain/values/Retention";
import {
  evaluateRetentionCandidate,
  generateRetentionReport,
  RetentionAuthorityReader,
  RetentionCalibrationRegistry,
  RetentionUnavailable,
} from "@beep/epistemic-use-cases/Retention";
import { canonicalDetectionJson } from "@beep/epistemics/ContradictionDetection";
import { $EpistemicServerId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema/Sha256";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const $I = $EpistemicServerId.create("scripts/retention-calibrate");
const Inputs = S.Struct({
  snapshot: RetentionSnapshot,
  queries: S.Array(
    S.Struct({ id: S.NonEmptyString, split: S.Literals(["tuning", "held-out"]), query: RetentionQuery })
  ),
  candidates: S.Array(S.Struct({ id: S.NonEmptyString, input: S.Unknown })),
}).pipe($I.annoteSchema("Inputs", { description: "Frozen synthetic authority and candidate controls." }));
const Manifest = S.Struct({
  purpose: S.tag("synthetic"),
  sha256: Sha256Hex,
  protocolSha256: Sha256Hex,
  suppliedEdges: S.Int,
  usableEdges: S.Int,
  excludedEdges: S.Int,
  dispositionRecords: S.Int,
  queryCount: S.Int,
  independentLogicalIdentities: S.Int,
  productSamples: S.Literal(0),
  independentLabels: S.Literal(0),
  validCandidatesExpected: S.Int,
  invalidCandidatesExpected: S.Int,
}).pipe($I.annoteSchema("Manifest", { description: "Synthetic-only immutable input admission accounting." }));
const Protocol = S.Struct({
  id: S.tag("retention-calibration-synthetic-v1"),
  version: S.Literal(1),
  purpose: S.tag("synthetic-harness-only"),
  mechanism: S.tag("retention-v1"),
  agesMillis: S.Array(S.Int.check(S.isGreaterThanOrEqualTo(0))),
  organizations: S.Array(RetentionQuery.fields.orgId),
  splits: S.Array(S.Struct({ id: S.Literals(["tuning", "held-out"]), knownAt: S.Int, validAt: S.Int })),
  candidates: S.Struct({ central: RetentionPolicy }),
  minimumCoverage: S.Struct({
    uniqueEdges: S.Int,
    orgSplitStrata: S.Int,
    edgesPerStratum: S.Int,
    validCandidates: S.Int,
  }),
}).pipe($I.annoteSchema("Protocol", { description: "Executable frozen grid and one-factor candidate design." }));
const hash = Effect.fn("Calibration.hash")(function* (text: string) {
  const crypto = yield* Crypto.Crypto;
  return Hex.encode(yield* crypto.digest("SHA-256", new TextEncoder().encode(text)));
});
const requireEvidence = Effect.fn("Calibration.requireEvidence")(function* (condition: boolean, message: string) {
  if (!condition) return yield* RetentionUnavailable.make({ operation: "calibration", message });
});
const main = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const args = yield* S.decodeUnknownEffect(S.Struct({ packet: S.NonEmptyString, output: S.NonEmptyString }))({
    packet: process.argv[2],
    output: process.argv[3],
  });
  const inputText = yield* fs.readFileString(path.join(args.packet, "ops/fixture-v1.json"));
  const protocolText = yield* fs.readFileString(path.join(args.packet, "ops/protocol-v1.json"));
  const manifest = yield* S.decodeEffect(S.fromJsonString(Manifest))(
    yield* fs.readFileString(path.join(args.packet, "ops/dataset-v1.json"))
  );
  yield* requireEvidence(
    (yield* hash(inputText)) === manifest.sha256 && (yield* hash(protocolText)) === manifest.protocolSha256,
    "Frozen input or protocol digest mismatch"
  );
  const protocol = yield* S.decodeEffect(S.fromJsonString(Protocol))(protocolText);
  const input = yield* S.decodeEffect(S.fromJsonString(Inputs), { onExcessProperty: "error" })(inputText);
  const authorityBefore = canonicalDetectionJson(yield* S.encodeEffect(RetentionSnapshot)(input.snapshot));
  yield* requireEvidence(
    input.snapshot.edges.length === manifest.suppliedEdges &&
      manifest.usableEdges === manifest.suppliedEdges &&
      manifest.excludedEdges === 0 &&
      input.snapshot.dispositions.length === manifest.dispositionRecords &&
      input.queries.length === manifest.queryCount &&
      A.dedupe(A.map(input.snapshot.edges, (edge) => `${edge.orgId}:${edge.logicalKey}`)).length ===
        manifest.independentLogicalIdentities,
    "Frozen input accounting mismatch"
  );
  const candidates = A.map(input.candidates, (candidate) => ({
    id: candidate.id,
    policy: S.decodeUnknownOption(RetentionPolicy)(candidate.input),
    input: candidate.input,
  }));
  yield* requireEvidence(
    A.filter(candidates, (c) => O.isSome(c.policy)).length === manifest.validCandidatesExpected &&
      A.filter(candidates, (c) => O.isNone(c.policy)).length === manifest.invalidCandidatesExpected,
    "Candidate accounting mismatch"
  );
  const expectedCandidates = [
    { id: "central", policy: protocol.candidates.central },
    ...A.flatMap(R.keys(RetentionPolicy.fields), (field) =>
      A.map(
        [
          { numerator: 9, label: "minus-10pct" },
          { numerator: 11, label: "plus-10pct" },
        ],
        ({ numerator, label }) => ({
          id: `${field}-${label}`,
          policy: RetentionPolicy.make({
            ...protocol.candidates.central,
            [field]: N.round((protocol.candidates.central[field] * numerator) / 10, 0),
          }),
        })
      )
    ),
  ];
  const policyEqual = S.toEquivalence(RetentionPolicy);
  yield* requireEvidence(
    input.queries.length === protocol.minimumCoverage.orgSplitStrata &&
      input.queries.length === protocol.organizations.length * protocol.splits.length &&
      A.dedupe(A.map(input.queries, (q) => q.id)).length === input.queries.length &&
      A.dedupe(A.map(input.queries, (q) => `${q.query.orgId}:${q.split}`)).length === input.queries.length &&
      A.dedupe(A.map(candidates, (c) => c.id)).length === candidates.length &&
      manifest.independentLogicalIdentities === protocol.minimumCoverage.uniqueEdges &&
      manifest.validCandidatesExpected === protocol.minimumCoverage.validCandidates &&
      A.every(expectedCandidates, (expected) =>
        A.some(
          candidates,
          (c) => c.id === expected.id && O.exists(c.policy, (policy) => policyEqual(policy, expected.policy))
        )
      ),
    "Protocol grid, unique identities or registered candidate design mismatch"
  );
  for (const entry of input.queries) {
    yield* requireEvidence(
      A.contains(protocol.organizations, entry.query.orgId) &&
        A.some(
          protocol.splits,
          (split) =>
            split.id === entry.split &&
            split.knownAt === DateTime.toEpochMillis(entry.query.knownAt) &&
            split.validAt === DateTime.toEpochMillis(entry.query.validAt)
        ) &&
        entry.query.dispositions.length === 0 &&
        A.dedupe(entry.query.logicalKeys).length === entry.query.logicalKeys.length,
      "Query differs from frozen temporal/tenant split"
    );
  }
  const strata = yield* Effect.forEach(
    input.queries,
    Effect.fn("Calibration.stratum")(function* (entry) {
      const baseline = yield* generateRetentionReport(entry.query, O.none()).pipe(
        Effect.provideService(RetentionAuthorityReader, { read: () => Effect.succeed(input.snapshot) })
      );
      yield* requireEvidence(
        baseline.admission.state === "inert" &&
          baseline.visibleCount === protocol.minimumCoverage.edgesPerStratum &&
          A.dedupe(A.map(baseline.rows, (row) => row.logicalKey)).length === baseline.visibleCount &&
          A.dedupe(A.map(baseline.rows, (row) => row.edgeVersionId)).length === baseline.visibleCount &&
          S.toEquivalence(S.Array(S.Finite))(
            A.sort(
              A.map(baseline.rows, (row) => row.ageMillis),
              N.Order
            ),
            A.sort(protocol.agesMillis, N.Order)
          ),
        "Stratum differs from frozen coverage or age grid"
      );
      const attempts = yield* Effect.forEach(
        candidates,
        Effect.fn("Calibration.candidate")(function* (candidate) {
          if (O.isNone(candidate.policy))
            return { id: candidate.id, outcome: "schema-rejected", input: candidate.input };
          const attempt = yield* evaluateRetentionCandidate(baseline, candidate.policy.value).pipe(
            Effect.flatMap(S.encodeEffect(RetentionEvaluation)),
            Effect.result
          );
          return Result.match(attempt, {
            onFailure: () => ({
              id: candidate.id,
              outcome: "evaluation-failed",
              input: candidate.input,
              error: "Candidate evaluation or result validation failed; no accepted mechanical evidence",
            }),
            onSuccess: (evaluation) => ({ id: candidate.id, outcome: "evaluated", evaluation }),
          });
        }),
        { concurrency: 1 }
      );
      return {
        id: entry.id,
        split: entry.split,
        selectedQueryRows: baseline.visibleCount,
        selectedIdentities: A.map(baseline.rows, (row) => `${entry.query.orgId}:${row.logicalKey}`),
        attempts,
      };
    }),
    { concurrency: 1 }
  );
  yield* requireEvidence(
    authorityBefore === canonicalDetectionJson(yield* S.encodeEffect(RetentionSnapshot)(input.snapshot)),
    "Authority changed during evaluation"
  );
  const selectedIdentities = A.flatMap(strata, (stratum) => stratum.selectedIdentities);
  yield* requireEvidence(
    A.dedupe(selectedIdentities).length === selectedIdentities.length &&
      selectedIdentities.length === manifest.usableEdges,
    "Split leakage or unaccounted source edges"
  );
  const mechanicalPassed = A.every(strata, (stratum) =>
    A.every(stratum.attempts, (attempt) => attempt.outcome !== "evaluation-failed")
  );
  const result = `${canonicalDetectionJson({
    kind: "offline-calibration-bundle",
    mechanism: "retention-v1",
    datasetDigest: manifest.sha256,
    protocolDigest: manifest.protocolSha256,
    verdict: "insufficient-evidence",
    mechanicalPassed,
    independentSourceSamples: A.dedupe(selectedIdentities).length,
    selectedQueryRows: selectedIdentities.length,
    approvalState: "not-requested",
    productSamples: 0,
    independentLabels: 0,
    productionEligible: false,
    authorityDigest: yield* hash(authorityBefore),
    authorityUnchanged: true,
    strata,
  })}\n`;
  // Exclusive creation prevents overwriting unrelated output. Replay uses a fresh output file.
  yield* fs.writeFileString(args.output, result, { flag: "wx" });
  yield* requireEvidence(mechanicalPassed, "Failed candidate attempts retained in output bundle");
  yield* Console.log(`Offline bundle SHA-256 ${yield* hash(result)}; production remains inert.`);
}).pipe(
  Layer.effectDiscard,
  Layer.provide(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, RetentionCalibrationRegistry.inert)),
  Layer.build,
  Effect.scoped
);
NodeRuntime.runMain(main);
