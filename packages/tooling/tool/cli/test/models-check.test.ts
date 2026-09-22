import {
  ModelsCatalogLive,
  ModelsCheck,
  ModelsCheckLive,
  ModelsCheckOptions,
  ModelsCheckReport,
  ModelsLedgerLive,
  ModelsLocatorReaderLive,
  ModelsManifestStore,
  ModelsManifestStoreLive,
  ModelsTargetLocation,
  resolveTargetPath,
  seedModelsManifest,
} from "@beep/repo-cli/commands/Models";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { expect, layer } from "@effect/vitest";
import { assertSome, strictEqual } from "@effect/vitest/utils";
import { Effect, FileSystem, Layer, Option as O, Path } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { FixtureCatalogSources, readFixtureText } from "./helpers/models-fixtures.ts";
import type { DriftKind } from "@beep/repo-cli/commands/Models";

const encodeReport = S.encodeUnknownSync(ModelsCheckReport);
const decodeReport = S.decodeUnknownSync(ModelsCheckReport);

const stagedFixtures = ["locators.toml", "locators.xml", "locators.env", "locators.json", "locators.md", "locators.sh"];

const stageWorkspace = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({
    directory: process.cwd(),
    prefix: ".models-check-test-",
  });

  yield* Effect.forEach(
    stagedFixtures,
    (name) => Effect.flatMap(readFixtureText(name), (content) => fs.writeFileString(path.join(root, name), content)),
    { discard: true }
  );

  const manifestPath = path.join(root, "models.yaml");
  yield* fs.writeFileString(manifestPath, yield* readFixtureText("manifest.yaml"));

  return { root, manifestPath };
});

const kindsOf = (report: ModelsCheckReport): ReadonlyArray<string> =>
  A.dedupe(A.map(report.findings, (entry) => `${entry.targetId}:${entry.kind}`));

const platform = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer);
const models = Layer.mergeAll(
  ModelsCatalogLive,
  ModelsCheckLive,
  ModelsLedgerLive,
  ModelsLocatorReaderLive,
  ModelsManifestStoreLive,
  FixtureCatalogSources
).pipe(Layer.provide(platform));

layer(Layer.mergeAll(platform, models))((it) => {
  it("resolves a manifest path against either root", () => {
    strictEqual(
      resolveTargetPath(
        ModelsTargetLocation.make({ root: "home", path: "$HOME/.zshrc", home: "/home/op", repo: "/repo" })
      ),
      "/home/op/.zshrc"
    );
    strictEqual(
      resolveTargetPath(
        ModelsTargetLocation.make({ root: "repo", path: "AGENTS.md", home: "/home/op", repo: "/repo" })
      ),
      "/repo/AGENTS.md"
    );
  });

  it.effect("reports one finding per drift kind and stays clean where the file agrees", () =>
    Effect.gen(function* () {
      const workspace = yield* stageWorkspace();
      const check = yield* ModelsCheck;
      const report = yield* check.run(
        ModelsCheckOptions.make({
          home: workspace.root,
          repo: workspace.root,
          manifestPath: workspace.manifestPath,
          offline: false,
        })
      );

      strictEqual(report.hasDrift, true);
      const kinds = kindsOf(report);

      expect(kinds).toContain("stale.xml:stale");
      expect(kinds).toContain("missing.file:missing-file");
      expect(kinds).toContain("missing.locator:missing-locator");
      expect(kinds).toContain("unknown.model:unknown-model");
      expect(kinds).toContain("missing.block:missing-locator");
      expect(kinds).toContain("invalid.effort:invalid-effort");

      // A target whose file agrees with the manifest, an absent-but-optional
      // target, and a generated block that already holds the rendered table
      // each contribute nothing.
      expect(A.map(report.findings, (entry) => entry.targetId)).not.toContain("clean.toml");
      expect(A.map(report.findings, (entry) => entry.targetId)).not.toContain("optional.file");
      expect(A.map(report.findings, (entry) => entry.targetId)).not.toContain("clean.block");

      const stale = A.findFirst(report.findings, (entry) => entry.targetId === "stale.xml");
      assertSome(
        O.map(stale, (entry) => entry.expected),
        "gpt-6-astra"
      );
      assertSome(
        O.flatMap(stale, (entry) => entry.current),
        "gpt-5.6-sol"
      );
    }).pipe(Effect.scoped)
  );

  it.effect("round-trips the report through its encoded form", () =>
    Effect.gen(function* () {
      const workspace = yield* stageWorkspace();
      const check = yield* ModelsCheck;
      const report = yield* check.run(
        ModelsCheckOptions.make({
          home: workspace.root,
          repo: workspace.root,
          manifestPath: workspace.manifestPath,
          offline: false,
        })
      );

      const restored = decodeReport(encodeReport(report));
      strictEqual(restored.hasDrift, report.hasDrift);
      strictEqual(A.length(restored.findings), A.length(report.findings));
      strictEqual(restored.catalog.contentSha256, report.catalog.contentSha256);
      expect(A.map(restored.findings, (entry): DriftKind => entry.kind)).toEqual(
        A.map(report.findings, (entry): DriftKind => entry.kind)
      );
    }).pipe(Effect.scoped)
  );

  it.effect("seeds a manifest once and refuses to overwrite it", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({
        directory: process.cwd(),
        prefix: ".models-init-test-",
      });
      const store = yield* ModelsManifestStore;
      const target = path.join(root, "nested", "models.yaml");

      strictEqual(yield* store.init(target, seedModelsManifest), target);

      const loaded = yield* store.load(target);
      strictEqual(loaded.version, "beep-models/v1");
      strictEqual(A.length(loaded.bindings), A.length(seedModelsManifest.bindings));
      strictEqual(A.length(loaded.targets), A.length(seedModelsManifest.targets));

      const second = yield* Effect.result(store.init(target, seedModelsManifest));
      strictEqual(second._tag, "Failure");
    }).pipe(Effect.scoped)
  );
});
