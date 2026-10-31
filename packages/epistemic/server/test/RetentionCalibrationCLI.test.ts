import * as NodeURL from "node:url";
import { RetentionCalibration, RetentionQuery } from "@beep/epistemic-domain/values/Retention";
import { it } from "@beep/test-runner";
import * as NodeChildProcessSpawner from "@effect/platform-node/NodeChildProcessSpawner";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { expect } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";

const repository = NodeURL.fileURLToPath(new URL("../../../..", import.meta.url));
const QueryEntry = S.Struct({ id: S.String, split: S.String, query: RetentionQuery });
const Fixture = S.Struct({ snapshot: S.Unknown, candidates: S.Unknown, queries: S.Array(QueryEntry) });
const FixtureJson = S.fromJsonString(Fixture);
const SingleQuery = S.Tuple([S.toType(QueryEntry)]);
const Json = S.fromJsonString(S.Record(S.String, S.Unknown));
const run = Effect.fn("CalibrationCLITest.run")(function* (packet: string, output: string) {
  const path = yield* Path.Path;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const child = yield* spawner.spawn(
    ChildProcess.make(
      "bun",
      [path.join(repository, "packages/epistemic/server/scripts/retention-calibrate.ts"), packet, output],
      { cwd: repository }
    )
  );
  const [text, code] = yield* Effect.all([child.all.pipe(Stream.decodeText(), Stream.mkString), child.exitCode], {
    concurrency: 2,
  });
  return { text, code };
});
const copyPacket = Effect.fn("CalibrationCLITest.copyPacket")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const temp = yield* fs.makeTempDirectoryScoped({ prefix: "retention-calibration-test-" });
  const packet = path.join(temp, "packet");
  yield* fs.makeDirectory(path.join(packet, "ops"), { recursive: true });
  for (const file of ["fixture-v1.json", "protocol-v1.json", "dataset-v1.json"]) {
    yield* fs.copyFile(
      path.join(repository, "goals/epistemic-retention-policy-calibration/ops", file),
      path.join(packet, "ops", file)
    );
  }
  return { fs, path, temp, packet };
});

const assertUntrustedReceipt = Effect.fn("CalibrationCLITest.assertUntrustedReceipt")(function* (policyDigest: string) {
  const { fs, path, temp, packet } = yield* copyPacket();
  const fixturePath = path.join(packet, "ops/fixture-v1.json");
  const manifestPath = path.join(packet, "ops/dataset-v1.json");
  const fixture = yield* S.decodeEffect(Json)(yield* fs.readFileString(fixturePath));
  const manifest = yield* S.decodeEffect(Json)(yield* fs.readFileString(manifestPath));
  // Entirely synthetic untrusted fixture: the user principal does not attest to approval.
  // Schema validity must not promote caller data to trusted registry membership.
  const untrusted = yield* S.decodeUnknownEffect(RetentionCalibration)({
    policyDigest,
    datasetDigest: manifest.sha256,
    orgId: 1,
    mechanism: "retention-v1",
    sampleCount: 104,
    evaluationReport: "fixture://untrusted-report",
    approvedBy: { kind: "User", userId: 1 },
    approvedAt: 0,
    expiresAt: 40000,
    purpose: "production",
  });
  const text = yield* S.encodeEffect(Json)({
    ...fixture,
    calibration: yield* S.encodeEffect(RetentionCalibration)(untrusted),
  });
  yield* fs.writeFileString(fixturePath, text);
  const crypto = yield* Digest.Digest;
  yield* fs.writeFileString(
    manifestPath,
    yield* S.encodeEffect(Json)({
      ...manifest,
      sha256: Hex.encode(yield* crypto.digest(Digest.sha256, new TextEncoder().encode(text))),
    })
  );
  const output = path.join(temp, "bundle.json");
  const result = yield* run(packet, output);
  expect(result.code, result.text).not.toBe(0);
  expect(result.text).toContain("calibration");
  expect(yield* fs.exists(output)).toBe(false);
});

it.layer(
  Layer.provideMerge(
    NodeChildProcessSpawner.layer,
    Layer.mergeAll(NodeFileSystem.layer, NodePath.layer, NodeCrypto.layer)
  ),
  { timeout: "30 seconds", excludeTestServices: true }
)((it) => {
  it.effect("replays identical bundle bytes after deleting the complete owned output directory", () =>
    Effect.gen(function* () {
      const { fs, path, temp, packet } = yield* copyPacket();
      const store = path.join(temp, "output");
      yield* fs.makeDirectory(store);
      const first = yield* run(packet, path.join(store, "bundle.json"));
      expect(first.code, first.text).toBe(0);
      const bytes = yield* fs.readFileString(path.join(store, "bundle.json"));
      yield* fs.writeFileString(path.join(store, "unrelated-derived-cache"), "disposable");
      yield* fs.remove(store, { recursive: true });
      expect(yield* fs.exists(store)).toBe(false);
      yield* fs.makeDirectory(store);
      const second = yield* run(packet, path.join(store, "bundle.json"));
      expect(second.code, second.text).toBe(0);
      expect(yield* fs.readFileString(path.join(store, "bundle.json"))).toBe(bytes);
      expect(yield* fs.readDirectory(store)).toEqual(["bundle.json"]);
      const repeat = yield* run(packet, path.join(store, "bundle.json"));
      expect(repeat.code).not.toBe(0);
      expect(yield* fs.readFileString(path.join(store, "bundle.json"))).toBe(bytes);
    })
  );
  it.effect("refuses a complete matching-policy receipt without trusted membership", () =>
    assertUntrustedReceipt("edb7f5df1b46ebf063d933253c91fd497dcb84a604f1d7e350b4860f5e97a2d0")
  );
  it.effect.prop(
    "refuses schema-generated self-submitted receipts without trusted membership",
    [Arbitrary.schema(RetentionCalibration.fields.policyDigest)],
    ([policyDigest]) => assertUntrustedReceipt(policyDigest),
    { arbitrary: { runs: 5 } }
  );
  for (const [reason, submission] of [
    ["wrong-policy-digest", { policyDigest: "bad" }],
    ["wrong-org", { orgId: 2 }],
    ["wrong-mechanism", { mechanism: "retention-v2" }],
    ["synthetic", { purpose: "synthetic" }],
    ["self-submitted", { policyDigest: "edb7f5df1b46ebf063d933253c91fd497dcb84a604f1d7e350b4860f5e97a2d0" }],
    ["future", { approvedAt: 40000 }],
    ["expired", { expiresAt: 0 }],
    ["revoked", { revoked: true, knownAt: 1 }],
    ["missing-evidence", { evaluationReport: null }],
    ["unauthenticated", { approvedBy: null }],
  ] satisfies ReadonlyArray<readonly [string, Record<string, unknown>]>) {
    it.effect(`offline preflight refuses ${reason} receipt submissions`, () =>
      Effect.gen(function* () {
        const { fs, path, temp, packet } = yield* copyPacket();
        const fixturePath = path.join(packet, "ops/fixture-v1.json");
        const fixture = yield* S.decodeEffect(Json)(yield* fs.readFileString(fixturePath));
        // A fixture receipt is untrusted input, never registry membership. This input surface
        // excludes every receipt, including claims of human approval or historical validity.
        const text = yield* S.encodeEffect(Json)({ ...fixture, calibration: submission });
        yield* fs.writeFileString(fixturePath, text);
        const crypto = yield* Digest.Digest;
        const manifestPath = path.join(packet, "ops/dataset-v1.json");
        const manifest = yield* S.decodeEffect(Json)(yield* fs.readFileString(manifestPath));
        yield* fs.writeFileString(
          manifestPath,
          yield* S.encodeEffect(Json)({
            ...manifest,
            sha256: Hex.encode(yield* crypto.digest(Digest.sha256, new TextEncoder().encode(text))),
          })
        );
        const output = path.join(temp, "bundle.json");
        const result = yield* run(packet, output);
        expect(result.code, result.text).not.toBe(0);
        expect(result.text).toContain("calibration");
        expect(yield* fs.exists(output)).toBe(false);
      })
    );
  }
  for (const mode of ["digest", "duplicate-stratum", "temporal-split", "candidate-design"]) {
    it.effect(`rejects ${mode} corruption without writing accepted output`, () =>
      Effect.gen(function* () {
        const { fs, path, temp, packet } = yield* copyPacket();
        const fixturePath = path.join(packet, "ops/fixture-v1.json");
        const original = yield* fs.readFileString(fixturePath);
        const fixture = yield* S.decodeEffect(FixtureJson)(original);
        // Tuple decode makes the nonempty control explicit without a non-null assertion.
        const [query] = yield* S.decodeUnknownEffect(SingleQuery)([fixture.queries[0]]);
        const altered =
          mode === "duplicate-stratum"
            ? { ...fixture, queries: A.map(fixture.queries, () => query) }
            : mode === "temporal-split"
              ? {
                  ...fixture,
                  queries: A.map(fixture.queries, (q) => ({
                    ...q,
                    query: { ...q.query, knownAt: query.query.knownAt },
                  })),
                }
              : mode === "candidate-design"
                ? { ...fixture, candidates: [] }
                : fixture;
        const text = yield* S.encodeUnknownEffect(FixtureJson)(altered);
        yield* fs.writeFileString(fixturePath, text);
        if (mode !== "digest") {
          const crypto = yield* Digest.Digest;
          const manifestPath = path.join(packet, "ops/dataset-v1.json");
          const manifest = yield* S.decodeEffect(Json)(yield* fs.readFileString(manifestPath));
          yield* fs.writeFileString(
            manifestPath,
            yield* S.encodeEffect(Json)({
              ...manifest,
              sha256: Hex.encode(yield* crypto.digest(Digest.sha256, new TextEncoder().encode(text))),
            })
          );
        }
        const output = path.join(temp, "bundle.json");
        const result = yield* run(packet, output);
        expect(result.code, result.text).not.toBe(0);
        expect(yield* fs.exists(output)).toBe(false);
      })
    );
  }
});
