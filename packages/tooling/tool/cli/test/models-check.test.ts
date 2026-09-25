import {
  CatalogModel,
  CatalogSnapshot,
  CodexModelsCache,
  ModelsCatalog,
  ModelsCatalogLive,
  ModelsCatalogSources,
  ModelsCheck,
  ModelsCheckLive,
  ModelsCheckOptions,
  ModelsCheckReport,
  ModelsLedger,
  ModelsLedgerLive,
  ModelsLocatorReaderLive,
  ModelsManifestStore,
  ModelsManifestStoreLive,
  ModelsTargetLocation,
  resolveTargetPath,
  seedModelsManifest,
  UpstreamCatalog,
} from "@beep/repo-cli/commands/Models";
import { fcRuns } from "@beep/test-utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { expect, layer } from "@effect/vitest";
import { assertNone, assertSome, strictEqual } from "@effect/vitest/utils";
import { Effect, FileSystem, Layer, Option as O, Path } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import {
  FixtureCatalogSources,
  FixtureCatalogSourcesWithoutProxy,
  readFixtureText,
} from "./helpers/models-fixtures.ts";
import type { DriftKind } from "@beep/repo-cli/commands/Models";

const encodeReport = S.encodeUnknownEffect(ModelsCheckReport);
const decodeReport = S.decodeUnknownEffect(ModelsCheckReport);

const stagedFixtures = ["locators.toml", "locators.xml", "locators.env", "locators.json", "locators.md", "locators.sh"];

const stageWorkspace = Effect.fnUntraced(function* (manifestFixture = "manifest.yaml") {
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
  yield* fs.writeFileString(manifestPath, yield* readFixtureText(manifestFixture));

  return { root, manifestPath };
});

const runCheckIn = Effect.fnUntraced(function* (manifestFixture: string, offline: boolean) {
  const workspace = yield* stageWorkspace(manifestFixture);
  const check = yield* ModelsCheck;
  const report = yield* check.run(
    ModelsCheckOptions.make({
      home: workspace.root,
      repo: workspace.root,
      manifestPath: workspace.manifestPath,
      offline,
    })
  );
  return { workspace, report };
});

const runCheck = (manifestFixture: string) => Effect.map(runCheckIn(manifestFixture, false), (run) => run.report);

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

layer(Layer.mergeAll(platform, models), { timeout: "30 seconds" })((it) => {
  it.effect.prop(
    "round trips schema-derived check reports",
    [ModelsCheckReport],
    Effect.fnUntraced(function* ([report]) {
      expect(yield* decodeReport(yield* encodeReport(report))).toEqual(report);
    }),
    { arbitrary: fcRuns(16) }
  );

  it.effect("excludes raw account and extension metadata from persisted snapshots and reports", () =>
    Effect.gen(function* () {
      const sources = yield* ModelsCatalogSources;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const rawOnly = "__raw_only_metadata__";
      const upstream = yield* S.decodeUnknownEffect(UpstreamCatalog)({
        "codex-pro": [{ id: "gpt-6-astra", extension: rawOnly, thinking: { levels: ["medium"], extension: rawOnly } }],
      });
      const codex = yield* S.decodeUnknownEffect(CodexModelsCache)({
        identity: { account: rawOnly },
        models: [
          {
            slug: "gpt-6-astra",
            extension: rawOnly,
            supported_reasoning_levels: [{ effort: "medium", extension: rawOnly }],
          },
        ],
      });
      expect(codex.identity).toEqual({ account: rawOnly });
      const { workspace, report } = yield* runCheckIn("manifest.yaml", false).pipe(
        Effect.provideService(ModelsCatalogSources, {
          ...sources,
          fetchUpstream: Effect.succeed(upstream),
          readCodexCache: () => Effect.succeedSome(codex),
        })
      );
      const persisted = yield* fs.readFileString(
        path.join(workspace.root, ".local", "state", "beep", "models", "latest.json")
      );
      expect(persisted).toContain("gpt-6-astra");
      expect(persisted).not.toContain(rawOnly);
      expect(yield* S.encodeUnknownEffect(S.fromJsonString(ModelsCheckReport))(report)).not.toContain(rawOnly);
    })
  );

  it.effect("validates a Codex binding against its cache ladder rather than upstream levels", () =>
    Effect.gen(function* () {
      const catalog = yield* ModelsCatalog;
      const snapshot = yield* catalog.snapshot({ home: "/home/op", offline: false });
      const restricted = CatalogSnapshot.make({
        ...snapshot,
        models: A.map(snapshot.models, (model) =>
          model.id === "gpt-6-astra" ? CatalogModel.make({ ...model, codexLevels: ["low"] }) : model
        ),
      });
      const report = yield* runCheck("manifest.yaml").pipe(
        Effect.provideService(ModelsCatalog, { snapshot: () => Effect.succeed(restricted) })
      );
      expect(kindsOf(report)).toContain("clean.toml:invalid-effort");
      assertSome(
        O.flatMap(
          A.findFirst(report.findings, (entry) => entry.targetId === "clean.toml"),
          (entry) => entry.current
        ),
        "gpt-6-astra"
      );
    })
  );

  it.effect("reports routable unbound Codex candidates without proposing hidden or already-bound slugs", () =>
    Effect.gen(function* () {
      const report = yield* runCheck("manifest.yaml");
      expect(report.candidates).toEqual(["gpt-5.6-luna", "gpt-5.6-sol"]);
    })
  );

  it("resolves a manifest path against either root", () => {
    const at = (root: "home" | "repo", path: string) =>
      resolveTargetPath(ModelsTargetLocation.make({ root, path, home: "/home/op", repo: "/repo" }));

    assertSome(at("home", "$HOME/.zshrc"), "/home/op/.zshrc");
    assertSome(at("home", ".config/beep/models.yaml"), "/home/op/.config/beep/models.yaml");
    assertSome(at("repo", "AGENTS.md"), "/repo/AGENTS.md");
    assertSome(at("repo", "docs/./runbooks/../README.md"), "/repo/docs/README.md");
  });

  it("refuses a manifest path that leaves its declared root", () => {
    const at = (root: "home" | "repo", path: string) =>
      resolveTargetPath(ModelsTargetLocation.make({ root, path, home: "/home/op", repo: "/repo" }));

    // A manifest is operator-written text; neither root may be escaped by
    // spelling, and a `repo` path is relative to the checkout and nothing else.
    assertNone(at("home", "$HOME/../etc/passwd"));
    assertNone(at("home", "../etc/passwd"));
    assertNone(at("repo", "../x"));
    assertNone(at("repo", "docs/../../x"));
    assertNone(at("repo", "/etc/passwd"));
  });

  it.effect("records only an online snapshot as the ledger baseline", () =>
    Effect.gen(function* () {
      const ledger = yield* ModelsLedger;

      // An offline snapshot has no upstream layer; recording it would turn the
      // next online run into a wall of phantom `added` models.
      const offline = yield* runCheckIn("manifest.yaml", true);
      assertNone(yield* ledger.latest(offline.workspace.root));

      const online = yield* runCheckIn("manifest.yaml", false);
      const recorded = yield* ledger.latest(online.workspace.root);
      strictEqual(O.isSome(recorded), true);
      strictEqual(online.report.diffScope, "full");

      // Against that online baseline — the SAME workspace, so the offline run
      // actually reads it — an offline run must not report the upstream-only
      // models it never fetched as `removed`, and must say the diff is
      // suppressed rather than leaving an empty diff to read as "catalog
      // stable".
      const check = yield* ModelsCheck;
      const offlineAgain = yield* check.run(
        ModelsCheckOptions.make({
          home: online.workspace.root,
          repo: online.workspace.root,
          manifestPath: online.workspace.manifestPath,
          offline: true,
        })
      );
      strictEqual(A.length(offlineAgain.diff.added), 0);
      strictEqual(A.length(offlineAgain.diff.removed), 0);
      strictEqual(A.length(offlineAgain.diff.levelsChanged), 0);
      strictEqual(offlineAgain.diffScope, "suppressed-offline");

      // The offline run neither recorded nor cleared the baseline.
      const afterOffline = yield* ledger.latest(online.workspace.root);
      strictEqual(O.isSome(afterOffline), true);
      strictEqual(
        O.getOrUndefined(O.map(afterOffline, (entry) => entry.summary.contentSha256)),
        O.getOrUndefined(O.map(recorded, (entry) => entry.summary.contentSha256))
      );
    })
  );

  it.effect("reports one finding per drift kind and stays clean where the file agrees", () =>
    Effect.gen(function* () {
      const report = yield* runCheck("manifest.yaml");

      strictEqual(report.hasDrift, true);
      const kinds = kindsOf(report);

      expect(kinds).toContain("stale.xml:stale");
      expect(kinds).toContain("missing.file:missing-file");
      expect(kinds).toContain("missing.locator:missing-locator");
      expect(kinds).toContain("unknown.model:unknown-model");
      assertSome(
        O.flatMap(
          A.findFirst(report.findings, (entry) => entry.targetId === "unknown.model"),
          (entry) => entry.current
        ),
        "claude-fable-5-1"
      );
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
    })
  );

  it.effect("round-trips the report through its encoded form", () =>
    Effect.gen(function* () {
      const report = yield* runCheck("manifest.yaml");

      const restored = yield* decodeReport(yield* encodeReport(report));
      strictEqual(restored.hasDrift, report.hasDrift);
      strictEqual(A.length(restored.findings), A.length(report.findings));
      strictEqual(restored.catalog.contentSha256, report.catalog.contentSha256);
      expect(A.map(restored.findings, (entry): DriftKind => entry.kind)).toEqual(
        A.map(report.findings, (entry): DriftKind => entry.kind)
      );
    }).pipe(Effect.scoped)
  );

  it.effect("flags a proxy-workflow binding the answered proxy overlay omits", () =>
    Effect.gen(function* () {
      const report = yield* runCheck("manifest-proxy.yaml");

      // The proxy overlay answered and does not list `claude-sonnet-5`, so the
      // binding names a model this box cannot route on that surface — even
      // though the file already holds the id the manifest asks for.
      expect(kindsOf(report)).toEqual(["proxy.env:unknown-model"]);
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

// An absent overlay is not drift: with no admitted proxy credential the check
// run cannot know whether a proxy-workflow model is routable, so it says
// nothing rather than reporting every binding as unknown.
const modelsWithoutProxy = Layer.mergeAll(
  ModelsCatalogLive,
  ModelsCheckLive,
  ModelsLedgerLive,
  ModelsLocatorReaderLive,
  ModelsManifestStoreLive,
  FixtureCatalogSourcesWithoutProxy
).pipe(Layer.provide(platform));

layer(Layer.mergeAll(platform, modelsWithoutProxy))((it) => {
  it.effect("stays silent on a proxy-workflow binding when the proxy overlay is absent", () =>
    Effect.gen(function* () {
      const report = yield* runCheck("manifest-proxy.yaml");

      strictEqual(report.hasDrift, false);
      expect(A.map(report.findings, (entry) => entry.targetId)).not.toContain("proxy.env");
    }).pipe(Effect.scoped)
  );
});
