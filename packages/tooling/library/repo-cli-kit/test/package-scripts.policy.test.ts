import {
  buildServedCheck,
  CheckerEngineExemption,
  DECLARATION_ONLY_BUILD_COMMAND,
  ImplScriptDrift,
  JavaScriptBuildOverride,
  OwnSourceCheckOverride,
  RetiredScriptName,
  retiredImplScripts,
  ScriptsRecord,
  scriptsBlockFromRecord,
} from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas";
import { DerivationEvidence, PackageScriptsPolicy } from "@beep/repo-cli-kit/package-scripts/PackageScriptsPolicy";
import { FsUtilsLive, jsonStringifyPretty } from "@beep/repo-utils";
import { fcRuns } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import type { PackageKind } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas";

const platform = FsUtilsLive.pipe(Layer.provideMerge(NodeServices.layer));
const codecFor = (kind: PackageKind) => {
  const codec = scriptsBlockFromRecord(kind);
  return { decode: S.decodeEffect(codec), encode: S.encodeEffect(codec) };
};
const codecs = {
  app: codecFor("app"),
  infra: codecFor("infra"),
  library: codecFor("library"),
  lab: codecFor("lab"),
  tool: codecFor("tool"),
};
const decodeManifest = S.decodeEffect(S.fromJsonString(S.Struct({ scripts: S.Record(S.String, S.String) })));
const decodeAppResult = S.decodeResult(scriptsBlockFromRecord("app"));
const noEvidence = DerivationEvidence.make({
  doctestOwners: HashSet.empty(),
  bypassingConfigs: HashSet.empty(),
  generators: HashSet.empty(),
  javaScriptBuilds: HashSet.empty(),
  ownSourceChecks: HashSet.empty(),
});
const isRetiredScriptName = S.is(RetiredScriptName);
const isRetiredAppImpl = (name: string, value: string) =>
  A.some(retiredImplScripts, (row) => row.kind === "app" && row.name === name && row.value === value);
// A check whose first segment the (possibly just retired) build program now serves.
const isServedCheck = (impls: HashMap.HashMap<string, string>, name: string, value: string) =>
  name === "beep:check" &&
  O.isSome(O.flatMap(HashMap.get(impls, "beep:build"), (build) => buildServedCheck(value, build)));
// The per-package Turbo override every package whose build is not declaration-only carries.
const checkOffOwnBuild = { extends: ["//"], tasks: { check: { dependsOn: ["^build"] } } };
const fixture = Effect.fn("fixture")(function* (files: Readonly<Record<string, unknown>>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "package-scripts-" });
  for (const [file, value] of R.toEntries(files)) {
    const target = path.join(root, file);
    yield* fs.makeDirectory(path.dirname(target), { recursive: true });
    yield* fs.writeFileString(target, P.isString(value) ? value : yield* jsonStringifyPretty(value));
  }
  return root;
});
const base = {
  coverage: "custom coverage",
  build: "wrong",
  "beep:build": "owned build",
  "beep:custom": "owned extra",
  dev: "owned dev",
};

describe("package scripts policy", () => {
  it.layer(platform, { timeout: "30 seconds" })((it) => {
    it.effect.prop(
      "repairs schema-derived records idempotently while preserving free tiers",
      { scripts: ScriptsRecord },
      ({ scripts }) =>
        Effect.gen(function* () {
          const policy = yield* PackageScriptsPolicy.make("/repo");
          const actual = Result.getOrThrow(decodeAppResult(scripts));
          const expected = policy.expected("app", actual, noEvidence);
          expect(expected.extras).toEqual(HashMap.filter(actual.extras, (_, key) => !isRetiredScriptName(key)));
          for (const [key, value] of actual.impls)
            if (!isRetiredAppImpl(key, value) && !isServedCheck(expected.impls, key, value))
              assertSome(HashMap.get(expected.impls, key), value);
          expect(policy.diff(expected, policy.expected("app", expected, noEvidence))).toEqual([]);
        }),
      { arbitrary: fcRuns(100) }
    );
  });

  it.layer(platform, { timeout: "30 seconds" })((it) => {
    it.effect(
      "retains app and infra docgen, optional parallel tasks, implementation values and extras",
      Effect.fnUntraced(function* () {
        const policy = yield* PackageScriptsPolicy.make("/repo");
        for (const kind of ["app", "infra", "library"] as const) {
          const codec = O.getOrThrow(R.get(codecs, kind));
          const actual = yield* codec.decode({
            ...base,
            docgen: "legacy docgen",
            "beep:docgen": "custom docgen",
            "test:integration:parallel": "legacy parallel",
          });
          const expected = policy.expected(kind, actual, noEvidence);
          const record = yield* codec.encode(expected);
          expect(record.docgen).toBe("bun run beep:docgen");
          expect(record["beep:docgen"]).toBe("custom docgen");
          expect(record["beep:build"]).toBe("owned build");
          expect(record["beep:custom"]).toBe("owned extra");
          expect(record.dev).toBe("owned dev");
          expect(record.coverage).toBe(kind === "infra" ? "bun run beep:coverage" : "custom coverage");
          if (kind === "infra") {
            expect(record["beep:coverage"]).toBe("custom coverage");
          }
          if (kind !== "infra") expect(record["test:integration:parallel"]).toBe("bun run beep:test:integration");
          expect(record["lint:laws"]).toBe("beep-cli lint laws --package .");
          expect(record["lint:deprecated-apis"]).toBe("beep-cli lint deprecated-apis --package .");
          expect(policy.diff(expected, policy.expected(kind, expected, noEvidence))).toEqual([]);
        }
      })
    );
  });
  it.layer(platform, { timeout: "30 seconds" })((it) => {
    it.effect(
      "reports literal negative drift and stamps missing implementations only",
      Effect.fnUntraced(function* () {
        const policy = yield* PackageScriptsPolicy.make("/repo");
        const actual = yield* O.getOrThrow(R.get(codecs, "lab")).decode({
          ...base,
          docgen: "forbidden",
          codegen: "echo 'no codegen needed'",
        });
        const expected = policy.expected("lab", actual, noEvidence);
        const drift = policy.diff(actual, expected);
        expect(drift).toContainEqual({
          _tag: "wrong-binding",
          name: "build",
          expected: "bun run beep:build",
          actual: "wrong",
        });
        expect(drift).toContainEqual({ _tag: "unexpected-task", name: "docgen" });
        expect(drift).toContainEqual({ _tag: "placeholder", name: "codegen", actual: "echo 'no codegen needed'" });
        expect(drift).toContainEqual({ _tag: "missing-impl", name: "beep:check" });
        const record = yield* O.getOrThrow(R.get(codecs, "lab")).encode(expected);
        expect(record["lint:jsdoc"]).toBeUndefined();
        expect(record["beep:check"]).toBe("tsrs -p tsconfig.check.json");
      })
    );
  });
  it.layer(platform, { timeout: "30 seconds" })((it) => {
    it.effect(
      "writes idempotently, ignores non-workspaces and fixture markers, preserves exempt bytes",
      Effect.fnUntraced(function* () {
        const root = yield* fixture({
          "package.json": { name: "root", workspaces: ["packages/*", "apps/*", "infra", "scratchpad"] },
          "packages/a/package.json": { name: "@beep/a", scripts: base },
          "packages/a/turbo.json": checkOffOwnBuild,
          "packages/a/src/index.ts": "export const x = 1;",
          "packages/a/test/fixtures/src/example.ts": "import.meta.vitest",
          "packages/a/src/index.d.ts": "import.meta.vitest",
          "packages/b/package.json": { name: "@beep/b", scripts: base },
          "packages/b/turbo.json": checkOffOwnBuild,
          "packages/b/src/index.ts": "// import.meta.vitest",
          "packages/b/vitest.config.ts": "import shared from '../../../vitest.shared.ts'",
          "infra/package.json": { name: "@beep/infra", scripts: base },
          "infra/turbo.json": checkOffOwnBuild,
          "infra/lambda/x/package.json": { scripts: { docgen: "out of domain" } },
          "scratchpad/package.json": { name: "scratchpad", scripts: { docgen: "exempt", "lint:laws": "owned" } },
        });
        const fs = yield* FileSystem.FileSystem;
        const before = yield* fs.readFileString(`${root}/scratchpad/package.json`);
        const policy = yield* PackageScriptsPolicy.make(root);
        const pipe1 = yield* policy.kindOf("infra/lambda/x/package.json").pipe(Effect.isFailure);
        expect(pipe1).toBe(true);
        const kindOf2 = yield* policy.kindOf("infra/package.json");
        expect(kindOf2).toBe("infra");
        const initial = yield* policy.check(root);
        expect(initial.manifests).toBe(4);
        expect(HashMap.size(initial.drift)).toBe(3);
        const written = yield* policy.write(root);
        expect(HashSet.size(written.written)).toBe(3);
        expect(HashMap.size(written.drift)).toBe(0);
        expect(HashSet.size((yield* policy.write(root)).written)).toBe(0);
        expect(HashMap.size((yield* policy.check(root)).drift)).toBe(0);
        const a = yield* fs.readFileString(`${root}/packages/a/package.json`);
        const b = yield* fs.readFileString(`${root}/packages/b/package.json`);
        expect(a).not.toContain('"doctest"');
        expect(b).toContain('"doctest": "bun run beep:doctest"');
        expect(b).toContain('"beep:doctest": "BEEP_VITEST_DOCTEST=1 bunx vitest run"');
        const readFileString3 = yield* fs.readFileString(`${root}/scratchpad/package.json`);
        expect(readFileString3).toBe(before);
        const readFileString4 = yield* fs.readFileString(`${root}/infra/lambda/x/package.json`);
        expect(readFileString4).toContain("out of domain");
      })
    );
  });
  it.layer(platform, { timeout: "30 seconds" })((it) => {
    it.effect(
      "requires a turbo.json build.outputs override for noEmit builds",
      Effect.fnUntraced(function* () {
        const noEmit = { ...base, "beep:build": "tsrs -p tsconfig.check.json" };
        const root = yield* fixture({
          "package.json": { name: "root", workspaces: ["apps/*"] },
          "apps/bare/package.json": { name: "@beep/bare", scripts: noEmit },
          "apps/stale/package.json": { name: "@beep/stale", scripts: noEmit },
          "apps/stale/turbo.json": { extends: ["//"], tasks: { build: { outputs: ["dist/**"] } } },
          "apps/covered/package.json": { name: "@beep/covered", scripts: noEmit },
          "apps/covered/turbo.json": {
            extends: ["//"],
            tasks: { build: { outputs: [] }, check: { dependsOn: ["^build"] } },
          },
          "apps/emitting/package.json": { name: "@beep/emitting", scripts: base },
          "apps/emitting/turbo.json": checkOffOwnBuild,
        });
        const policy = yield* PackageScriptsPolicy.make(root);
        const report = yield* policy.write(root);
        const conflict = {
          _tag: "derivation-conflict",
          name: "build",
          reason: "noEmit build needs turbo.json with tasks.build.outputs: [] (bun run beep create-package emits it)",
        };
        expect(HashMap.get(report.drift, "apps/bare/package.json").pipe(O.getOrElse(() => []))).toContainEqual(
          conflict
        );
        expect(HashMap.get(report.drift, "apps/stale/package.json").pipe(O.getOrElse(() => []))).toContainEqual(
          conflict
        );
        expect(HashMap.has(report.drift, "apps/covered/package.json")).toBe(false);
        expect(HashMap.has(report.drift, "apps/emitting/package.json")).toBe(false);
      })
    );
    it.effect(
      "keeps impl differences advisory in check and write while ignoring matching, missing and exempt impls",
      Effect.fnUntraced(function* () {
        const root = yield* fixture({
          "package.json": { name: "root", workspaces: ["packages/*", "scratchpad"] },
          "packages/a/package.json": { name: "@beep/a", scripts: { coverage: "owned coverage" } },
          "scratchpad/package.json": { name: "scratchpad", scripts: { "beep:check": "custom exempt" } },
        });
        const fs = yield* FileSystem.FileSystem;
        const policy = yield* PackageScriptsPolicy.make(root);
        const initial = yield* policy.check(root);
        expect(HashMap.size(initial.implDrift)).toBe(0);
        yield* policy.write(root);
        const file = `${root}/packages/a/package.json`;
        const readFileString5 = yield* fs.readFileString(file);
        const manifest = yield* decodeManifest(readFileString5);
        const jsonStringifyPretty6 = yield* jsonStringifyPretty({
          name: "@beep/a",
          scripts: { ...manifest.scripts, "beep:check": "tsrs --extendedDiagnostics -p tsconfig.check.json" },
        });
        yield* fs.writeFileString(file, jsonStringifyPretty6);
        const before = yield* fs.readFileString(file);
        for (const report of [yield* policy.check(root), yield* policy.write(root)]) {
          expect(HashMap.size(report.drift)).toBe(0);
          expect(HashMap.size(report.implDrift)).toBe(1);
          assertSome(HashMap.get(report.implDrift, "packages/a/package.json"), [
            // Flags before the program are package-owned: never rewritten, compared with the served default.
            ImplScriptDrift.make({
              name: "beep:check",
              actual: "tsrs --extendedDiagnostics -p tsconfig.check.json",
              expected: `${DECLARATION_ONLY_BUILD_COMMAND} && bun run beep:check:tests`,
            }),
          ]);
          expect(HashSet.size(report.written)).toBe(0);
        }
        const readFileString7 = yield* fs.readFileString(file);
        expect(readFileString7).toBe(before);
      })
    );
  });
  it.layer(platform, { timeout: "30 seconds" })((it) => {
    const regressed = {
      coverage: "owned coverage",
      "beep:build": "NODE_ENV=production tsc -p tsconfig.json && bun run babel",
      "beep:check": "tsgo -p tsconfig.check.json && bun run beep:check:tests",
      "beep:check:tests": "bunx --bun --no-install tsgo -p tsconfig.test.json --noEmit",
      "beep:check:cwd": "bun run --cwd . tsgo -p tsconfig.check.json",
      "beep:check:flags":
        "bunx -p typescript tsc -p a.json && bunx --package @typescript/native-preview tsgo -p b.json",
      "beep:check:wrappers": "env NODE_ENV=production tsc -p a.json; node node_modules/typescript/bin/tsc -p b.json",
      "beep:check:assigned": "TSC=tsgo bun run beep:check:tests",
      "beep:check:entry": "node node_modules/typescript/lib/tsc.js -p a.json",
      "beep:check:versioned": "npx tsc@5.9.3 -p a.json && bunx tsgo@latest -p b.json",
      "beep:check:package":
        "bunx @typescript/native-preview@7.0.0-dev -p a.json; bunx @typescript/native-preview -p b.json",
    };
    const customized = {
      coverage: "owned coverage",
      "beep:build": "vite build",
      "beep:check": "tsrs -p tsconfig.check.json && bunx --bun --no-install tsrs -p scripts/tsconfig.json",
      "beep:check:stories": "tsrs -p tsconfig.stories.json --noEmit",
      "beep:check:pinned": "bunx tsrs@0.8.0 -p tsconfig.json && node node_modules/tsrs/bin/tsrs.js -p a.json",
      "typecheck:legacy": "tsgo -p tsconfig.json",
    };
    const checkerFixture = () =>
      fixture({
        "package.json": { name: "root", workspaces: ["packages/*"] },
        "packages/regressed/package.json": { name: "@beep/regressed", scripts: regressed },
        "packages/regressed/turbo.json": checkOffOwnBuild,
        "packages/customized/package.json": { name: "@beep/customized", scripts: customized },
        "packages/customized/turbo.json": checkOffOwnBuild,
      });
    const row = (name: keyof typeof regressed, engine: "tsc" | "tsgo") => ({
      _tag: "checker-engine",
      name,
      engine,
      actual: regressed[name],
    });
    const allRows = [
      row("beep:build", "tsc"),
      row("beep:check", "tsgo"),
      row("beep:check:assigned", "tsgo"),
      row("beep:check:cwd", "tsgo"),
      row("beep:check:entry", "tsc"),
      row("beep:check:flags", "tsc"),
      row("beep:check:flags", "tsgo"),
      row("beep:check:package", "tsgo"),
      row("beep:check:tests", "tsgo"),
      row("beep:check:versioned", "tsc"),
      row("beep:check:versioned", "tsgo"),
      row("beep:check:wrappers", "tsc"),
    ];
    const checkerRows = (report: { readonly drift: HashMap.HashMap<string, ReadonlyArray<unknown>> }) =>
      HashMap.get(report.drift, "packages/regressed/package.json").pipe(O.getOrElse(() => []));
    it.effect(
      "fails beep:build and beep:check scripts that run a checker other than tsrs",
      Effect.fnUntraced(function* () {
        const root = yield* checkerFixture();
        const policy = yield* PackageScriptsPolicy.make(root);
        yield* policy.write(root);
        for (const report of [yield* policy.check(root), yield* policy.write(root)]) {
          expect(checkerRows(report)).toEqual(allRows);
          expect(HashMap.has(report.drift, "packages/customized/package.json")).toBe(false);
        }
      })
    );
    it.effect(
      "accepts a non-tsrs checker only through a matching exemption row",
      Effect.fnUntraced(function* () {
        const root = yield* checkerFixture();
        const exemptions = [
          CheckerEngineExemption.make({
            manifest: "packages/regressed/package.json",
            script: "beep:check",
            engine: "tsgo",
            reason: "tsrs rejects a valid program in this package",
          }),
          CheckerEngineExemption.make({
            manifest: "packages/regressed/package.json",
            script: "beep:build",
            engine: "tsgo",
            reason: "exempts tsgo only, so the tsc build still fails",
          }),
          CheckerEngineExemption.make({
            manifest: "packages/customized/package.json",
            script: "beep:check:tests",
            engine: "tsgo",
            reason: "names another manifest, so it cannot cover the regressed package",
          }),
        ];
        const policy = yield* PackageScriptsPolicy.make(root, exemptions);
        yield* policy.write(root);
        const check8 = yield* policy.check(root);
        expect(checkerRows(check8)).toEqual(A.filter(allRows, (entry) => entry.name !== "beep:check"));
      })
    );
  });
  it.layer(platform, { timeout: "30 seconds" })((it) => {
    const babelBuild = {
      coverage: "owned coverage",
      babel: "babel dist --plugins annotate-pure-calls --out-dir dist --source-maps",
      "beep:build": "tsrs -p tsconfig.json && bun run babel",
    };
    const retirementFixture = () =>
      fixture({
        "package.json": { name: "root", workspaces: ["packages/*", "apps/*"] },
        "packages/babel/package.json": { name: "@beep/babel", scripts: babelBuild },
        "packages/javascript/package.json": {
          name: "@beep/javascript",
          scripts: { coverage: "owned coverage", "beep:build": "tsrs -p tsconfig.json" },
        },
        "packages/javascript/turbo.json": checkOffOwnBuild,
        "packages/codegen/package.json": {
          name: "@beep/codegen",
          scripts: { ...babelBuild, "beep:build": "bun run codegen && tsrs -p tsconfig.json && bun run babel" },
        },
        "packages/owned/package.json": {
          name: "@beep/owned",
          scripts: { coverage: "owned coverage", "beep:build": "tsrs -p tsconfig.json --listEmittedFiles" },
        },
        "packages/owned/turbo.json": checkOffOwnBuild,
        "apps/library-shaped/package.json": { name: "@beep/library-shaped", scripts: babelBuild },
        "packages/legacy/package.json": {
          name: "@beep/legacy",
          scripts: { coverage: "owned coverage", babel: babelBuild.babel, build: babelBuild["beep:build"] },
        },
      });
    const buildOf = Effect.fnUntraced(function* (root: string, dir: string) {
      const fs = yield* FileSystem.FileSystem;
      const text = yield* fs.readFileString(`${root}/${dir}/package.json`);
      const manifest = yield* decodeManifest(text);
      return manifest.scripts;
    });
    it.effect(
      "fails retired Babel builds and the babel script, then writes declaration-only builds",
      Effect.fnUntraced(function* () {
        const root = yield* retirementFixture();
        const policy = yield* PackageScriptsPolicy.make(root);
        const initial = yield* policy.check(root);
        expect(HashMap.get(initial.drift, "packages/babel/package.json").pipe(O.getOrElse(() => []))).toEqual(
          expect.arrayContaining([
            {
              _tag: "retired-impl",
              name: "beep:build",
              expected: "tsrs -p tsconfig.json --emitDeclarationOnly",
              actual: "tsrs -p tsconfig.json && bun run babel",
            },
            { _tag: "retired-script", name: "babel", actual: babelBuild.babel },
          ])
        );
        yield* policy.write(root);
        expect(HashMap.size((yield* policy.check(root)).drift)).toBe(0);
        expect(HashSet.size((yield* policy.write(root)).written)).toBe(0);
        const declarationOnly = "tsrs -p tsconfig.json --emitDeclarationOnly";
        // `packages/legacy` held the Babel build in its task: the seeded implementation is retired in the same pass.
        for (const dir of ["packages/babel", "packages/javascript", "apps/library-shaped", "packages/legacy"]) {
          const scripts = yield* buildOf(root, dir);
          expect(scripts["beep:build"]).toBe(declarationOnly);
          expect(scripts).not.toHaveProperty("babel");
        }
        const codegen = yield* buildOf(root, "packages/codegen");
        expect(codegen["beep:build"]).toBe(`bun run codegen && ${declarationOnly}`);
        expect(codegen).not.toHaveProperty("babel");
        const owned = yield* buildOf(root, "packages/owned");
        expect(owned["beep:build"]).toBe("tsrs -p tsconfig.json --listEmittedFiles");
      })
    );
    it.effect(
      "keeps a JavaScript-emitting build only for a manifest named by an override row",
      Effect.fnUntraced(function* () {
        const root = yield* retirementFixture();
        const overrides = [
          JavaScriptBuildOverride.make({
            manifest: "packages/javascript/package.json",
            reason: "a worker image runs dist/main.js",
          }),
        ];
        const policy = yield* PackageScriptsPolicy.make(root, [], overrides);
        yield* policy.write(root);
        const report = yield* policy.check(root);
        expect(HashMap.size(report.drift)).toBe(0);
        const javascript = yield* buildOf(root, "packages/javascript");
        expect(javascript["beep:build"]).toBe("tsrs -p tsconfig.json");
        const babel = yield* buildOf(root, "packages/babel");
        expect(babel["beep:build"]).toBe("tsrs -p tsconfig.json --emitDeclarationOnly");
      })
    );
  });
  it.layer(platform, { timeout: "30 seconds" })((it) => {
    it.effect(
      "reports bypass conflicts, unowned marked sources and deleted generator scripts",
      Effect.fnUntraced(function* () {
        const root = yield* fixture({
          "package.json": { name: "root", workspaces: ["apps/*", "packages/drivers/*"] },
          "apps/storybook/package.json": { name: "@beep/storybook", scripts: {} },
          "apps/storybook/src/index.ts": "import.meta.vitest",
          "apps/storybook/vitest.config.ts": "export default {}",
          "packages/orphan/src/index.ts": "import.meta.vitest",
          "packages/drivers/box/package.json": { name: "@beep/box", scripts: base },
        });
        const policy = yield* PackageScriptsPolicy.make(root);
        const report = yield* policy.write(root);
        const rows = report.drift.pipe(HashMap.values, A.fromIterable, A.flatten);
        expect(rows).toContainEqual({ _tag: "missing-task", name: "codegen" });
        expect(rows).toContainEqual({
          _tag: "derivation-conflict",
          name: "doctest",
          reason: "Marked source has no workspace owner",
        });
        expect(rows).toContainEqual({
          _tag: "derivation-conflict",
          name: "doctest",
          reason: "Marked sources use a vitest config that bypasses vitest.shared.ts",
        });
        const fs = yield* FileSystem.FileSystem;
        const storybook = yield* fs.readFileString(`${root}/apps/storybook/package.json`);
        expect(storybook).not.toContain('"doctest":');
        expect(storybook).not.toContain('"beep:doctest":');
      })
    );
  });
  it.layer(platform, { timeout: "30 seconds" })((it) => {
    it.effect(
      "seeds the docgen tool implementation from its direct script and preserves it on repeat writes",
      Effect.fnUntraced(function* () {
        const root = yield* fixture({
          "package.json": { name: "root", workspaces: ["packages/tooling/tool/*"] },
          "packages/tooling/tool/docgen/package.json": {
            name: "@beep/docgen",
            scripts: { coverage: "owned coverage", docgen: "bun run src/bin.ts" },
          },
        });
        const fs = yield* FileSystem.FileSystem;
        const policy = yield* PackageScriptsPolicy.make(root);
        const report = yield* policy.write(root);
        expect(HashMap.size(report.drift)).toBe(0);
        const file = `${root}/packages/tooling/tool/docgen/package.json`;
        const first = yield* fs.readFileString(file);
        const manifest = yield* decodeManifest(first);
        expect(manifest.scripts.docgen).toBe("bun run beep:docgen");
        expect(manifest.scripts["beep:docgen"]).toBe("bun run src/bin.ts");
        expect(HashSet.size((yield* policy.write(root)).written)).toBe(0);
        const readFileString9 = yield* fs.readFileString(file);
        expect(readFileString9).toBe(first);
        for (const scripts of [{}, { docgen: "bun run beep:docgen" }]) {
          const codec = O.getOrThrow(R.get(codecs, "tool"));
          const actual = yield* codec.decode(scripts);
          const expected = yield* codec.encode(policy.expected("tool", actual, noEvidence));
          expect(expected["beep:docgen"]).toBe("bunx --bun --no-install docgen");
        }
      })
    );
  });
  it.layer(platform, { timeout: "30 seconds" })((it) => {
    it.effect(
      "recognizes gov-legal-mcp as a generator independently of script presence",
      Effect.fnUntraced(function* () {
        const root = yield* fixture({
          "package.json": { name: "root", workspaces: ["packages/drivers/*"] },
          "packages/drivers/gov-legal-mcp/package.json": {
            name: "@beep/gov-legal-mcp",
            scripts: {
              coverage: "owned coverage",
              codegen: "bun run generate",
              generate: "bun run scripts/generate.ts",
            },
          },
        });
        const fs = yield* FileSystem.FileSystem;
        const policy = yield* PackageScriptsPolicy.make(root);
        const report = yield* policy.write(root);
        expect(HashMap.size(report.drift)).toBe(0);
        const file = `${root}/packages/drivers/gov-legal-mcp/package.json`;
        const readFileString10 = yield* fs.readFileString(file);
        const manifest = yield* decodeManifest(readFileString10);
        expect(manifest.scripts.codegen).toBe("bun run generate");
        expect(manifest.scripts.generate).toBe("bun run scripts/generate.ts");
        const jsonStringifyPretty11 = yield* jsonStringifyPretty({
          name: "@beep/gov-legal-mcp",
          scripts: R.remove(manifest.scripts, "codegen"),
        });
        yield* fs.writeFileString(file, jsonStringifyPretty11);
        const missing = yield* policy.check(root);
        assertSome(HashMap.get(missing.drift, "packages/drivers/gov-legal-mcp/package.json"), [
          { _tag: "missing-task", name: "codegen" },
        ]);
      })
    );
  });
  it.layer(platform, { timeout: "30 seconds" })((it) => {
    const declarationOnly = { coverage: "owned coverage", "beep:build": DECLARATION_ONLY_BUILD_COMMAND };
    const servedFixture = () =>
      fixture({
        "package.json": { name: "root", workspaces: ["packages/*", "apps/*"] },
        "packages/library/package.json": {
          name: "@beep/library",
          scripts: { ...declarationOnly, "beep:check": "tsrs -p tsconfig.check.json && bun run beep:check:tests" },
        },
        "packages/codegen/package.json": {
          name: "@beep/codegen",
          scripts: {
            coverage: "owned coverage",
            "beep:build": `bun run codegen && ${DECLARATION_ONLY_BUILD_COMMAND}`,
            "beep:check": "tsrs -p tsconfig.check.json&&bun run beep:check:scripts",
          },
        },
        "packages/flagged/package.json": {
          name: "@beep/flagged",
          scripts: {
            ...declarationOnly,
            "beep:check":
              "tsrs -p tsconfig.check.json --checkerCostCache a.cache --pretty false && tsrs -p test/tsconfig.json --checkerCostCache b.cache",
          },
        },
        "packages/wide/package.json": {
          name: "@beep/wide",
          scripts: { ...declarationOnly, "beep:check": "tsrs -p tsconfig.check.json && bun run beep:check:tests" },
        },
        "packages/babel/package.json": {
          name: "@beep/babel",
          scripts: {
            coverage: "owned coverage",
            "beep:build": "tsrs -p tsconfig.json && bun run babel",
            "beep:check": "tsrs -p tsconfig.check.json && bun run beep:check:tests",
          },
        },
        "apps/noemit/package.json": {
          name: "@beep/noemit",
          scripts: { "beep:build": "tsrs -p tsconfig.check.json", "beep:check": "tsrs -p tsconfig.check.json" },
        },
        "apps/noemit/turbo.json": {
          extends: ["//"],
          tasks: { build: { outputs: [] }, check: { dependsOn: ["^build"] } },
        },
      });
    const scriptsOf = Effect.fnUntraced(function* (root: string, dir: string) {
      const fs = yield* FileSystem.FileSystem;
      const text = yield* fs.readFileString(`${root}/${dir}/package.json`);
      return (yield* decodeManifest(text)).scripts;
    });
    const wide = OwnSourceCheckOverride.make({
      manifest: "packages/wide/package.json",
      reason: "tsconfig.check.json adds scripts to include",
    });
    it.effect(
      "leads a declaration-only check with its build, carries its flags, and keeps overrides and other builds",
      Effect.fnUntraced(function* () {
        const root = yield* servedFixture();
        const policy = yield* PackageScriptsPolicy.make(root, [], [], [wide]);
        const initial = yield* policy.check(root);
        const checkRows = (dir: string) =>
          A.filter(
            HashMap.get(initial.drift, `${dir}/package.json`).pipe(O.getOrElse(() => [])),
            (row) => row._tag === "retired-impl" && row.name === "beep:check"
          );
        expect(checkRows("packages/library")).toEqual([
          {
            _tag: "retired-impl",
            name: "beep:check",
            expected: `${DECLARATION_ONLY_BUILD_COMMAND} && bun run beep:check:tests`,
            actual: "tsrs -p tsconfig.check.json && bun run beep:check:tests",
          },
        ]);
        // Flags of the first segment follow the build command in the same order; the later segment is untouched.
        const flaggedServed = `${DECLARATION_ONLY_BUILD_COMMAND} --checkerCostCache a.cache --pretty false && tsrs -p test/tsconfig.json --checkerCostCache b.cache`;
        expect(checkRows("packages/flagged")).toEqual([
          {
            _tag: "retired-impl",
            name: "beep:check",
            expected: flaggedServed,
            actual:
              "tsrs -p tsconfig.check.json --checkerCostCache a.cache --pretty false && tsrs -p test/tsconfig.json --checkerCostCache b.cache",
          },
        ]);
        for (const dir of ["packages/wide", "apps/noemit"]) expect(checkRows(dir), dir).toEqual([]);
        yield* policy.write(root);
        expect(HashMap.size((yield* policy.check(root)).drift)).toBe(0);
        expect(HashSet.size((yield* policy.write(root)).written)).toBe(0);
        const library = yield* scriptsOf(root, "packages/library");
        expect(library["beep:check"]).toBe(`${DECLARATION_ONLY_BUILD_COMMAND} && bun run beep:check:tests`);
        // Later segments keep their spelling; only the leading segment changes.
        const codegen = yield* scriptsOf(root, "packages/codegen");
        expect(codegen["beep:check"]).toBe(`${DECLARATION_ONLY_BUILD_COMMAND}&&bun run beep:check:scripts`);
        // The Babel build retires to the declaration-only build and serves the check in the same pass.
        const babel = yield* scriptsOf(root, "packages/babel");
        expect(babel["beep:build"]).toBe(DECLARATION_ONLY_BUILD_COMMAND);
        expect(babel["beep:check"]).toBe(`${DECLARATION_ONLY_BUILD_COMMAND} && bun run beep:check:tests`);
        const flagged = yield* scriptsOf(root, "packages/flagged");
        expect(flagged["beep:check"]).toBe(flaggedServed);
        const kept = yield* scriptsOf(root, "packages/wide");
        expect(kept["beep:check"]).toBe("tsrs -p tsconfig.check.json && bun run beep:check:tests");
        const noemit = yield* scriptsOf(root, "apps/noemit");
        expect(noemit["beep:check"]).toBe("tsrs -p tsconfig.check.json");
      })
    );
    it.effect(
      "rewrites the overridden package too once its own-source check override is removed",
      Effect.fnUntraced(function* () {
        const root = yield* servedFixture();
        const policy = yield* PackageScriptsPolicy.make(root, [], [], []);
        yield* policy.write(root);
        const served = yield* scriptsOf(root, "packages/wide");
        expect(served["beep:check"]).toBe(`${DECLARATION_ONLY_BUILD_COMMAND} && bun run beep:check:tests`);
      })
    );
  });
  it.layer(platform, { timeout: "30 seconds" })((it) => {
    const conflict = {
      _tag: "derivation-conflict",
      name: "check",
      reason:
        'check of a build that is not declaration-only needs turbo.json with tasks.check.dependsOn: ["^build"] (bun run beep create-package emits it)',
    };
    const checked = { coverage: "owned coverage", "beep:check": "tsrs -p tsconfig.check.json" };
    const rowsOf = (report: { readonly drift: HashMap.HashMap<string, ReadonlyArray<unknown>> }, dir: string) =>
      HashMap.get(report.drift, `${dir}/package.json`).pipe(O.getOrElse(() => []));
    it.effect(
      "requires a check that does not depend on the package's own build when the build is not declaration-only",
      Effect.fnUntraced(function* () {
        const root = yield* fixture({
          "package.json": { name: "root", workspaces: ["packages/*"] },
          // A package flipped from the declaration-only build to a bundler, with no Turbo override.
          "packages/flipped/package.json": {
            name: "@beep/flipped",
            scripts: { ...checked, "beep:build": "vite build" },
          },
          "packages/extended/package.json": {
            name: "@beep/extended",
            scripts: { ...checked, "beep:build": "vite build" },
          },
          "packages/extended/turbo.json": {
            extends: ["//"],
            tasks: { check: { dependsOn: ["$TURBO_EXTENDS$", "@beep/other#check"] } },
          },
          "packages/own/package.json": { name: "@beep/own", scripts: { ...checked, "beep:build": "next build" } },
          "packages/own/turbo.json": { extends: ["//"], tasks: { check: { dependsOn: ["^build", "build"] } } },
          "packages/upstream-only/package.json": {
            name: "@beep/upstream-only",
            scripts: { ...checked, "beep:build": "vite build" },
          },
          "packages/upstream-only/turbo.json": {
            extends: ["//"],
            tasks: { check: { dependsOn: ["^build", "@beep/other#check"] } },
          },
          "packages/declaration-only/package.json": {
            name: "@beep/declaration-only",
            scripts: { coverage: "owned coverage", "beep:build": DECLARATION_ONLY_BUILD_COMMAND },
          },
        });
        const policy = yield* PackageScriptsPolicy.make(root);
        for (const report of [yield* policy.check(root), yield* policy.write(root)]) {
          for (const dir of ["packages/flipped", "packages/extended", "packages/own"])
            expect(rowsOf(report, dir), dir).toContainEqual(conflict);
          for (const dir of ["packages/upstream-only", "packages/declaration-only"])
            expect(rowsOf(report, dir), dir).not.toContainEqual(conflict);
        }
      })
    );
  });
});
