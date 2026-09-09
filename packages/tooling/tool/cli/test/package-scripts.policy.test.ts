import {
  DerivationEvidence,
  PackageScriptsPolicy,
  policyToolsFingerprint,
  scriptsBlockFromRecord,
} from "@beep/repo-cli/test/PackageScripts";
import { FsUtilsLive, jsonStringifyPretty } from "@beep/repo-utils";
import { BunServices } from "@effect/platform-bun";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const platform = FsUtilsLive.pipe(Layer.provideMerge(BunServices.layer));
const noEvidence = DerivationEvidence.make({
  doctestOwners: HashSet.empty(),
  bypassingConfigs: HashSet.empty(),
  generators: HashSet.empty(),
});
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
const run = <A, E, R>(effect: Effect.Effect<A, E, R>) => effect.pipe(Effect.provide(platform), Effect.scoped);

describe("package scripts policy", () => {
  it.effect("retains app and infra docgen, optional parallel tasks, implementation values and extras", () =>
    run(
      Effect.gen(function* () {
        const policy = yield* PackageScriptsPolicy.make("/repo");
        for (const kind of ["app", "infra", "library"] as const) {
          const codec = scriptsBlockFromRecord(kind);
          const actual = yield* S.decodeEffect(codec)({
            ...base,
            docgen: "legacy docgen",
            "beep:docgen": "custom docgen",
            "test:integration:parallel": "legacy parallel",
          });
          const expected = policy.expected(kind, actual, noEvidence);
          const record = yield* S.encodeEffect(codec)(expected);
          expect(record.docgen).toBe("bun run beep:docgen");
          expect(record["beep:docgen"]).toBe("custom docgen");
          expect(record["beep:build"]).toBe("owned build");
          expect(record["beep:custom"]).toBe("owned extra");
          expect(record.dev).toBe("owned dev");
          expect(record.coverage).toBe("custom coverage");
          if (kind !== "infra") expect(record["test:integration:parallel"]).toBe("bun run beep:test:integration");
          expect(record["lint:laws"]).toBe("beep-cli lint laws --package .");
          expect(record["lint:deprecated-apis"]).toBe("beep-cli lint deprecated-apis --package .");
          expect(policy.diff(expected, policy.expected(kind, expected, noEvidence))).toEqual([]);
        }
      })
    )
  );
  it.effect("reports literal negative drift and stamps missing implementations only", () =>
    run(
      Effect.gen(function* () {
        const policy = yield* PackageScriptsPolicy.make("/repo");
        const actual = yield* S.decodeEffect(scriptsBlockFromRecord("lab"))({
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
        const record = yield* S.encodeEffect(scriptsBlockFromRecord("lab"))(expected);
        expect(record["lint:jsdoc"]).toBeUndefined();
        expect(record["beep:check"]).toBe("tsgo -p tsconfig.check.json && tsc -p tsconfig.json --noEmit");
      })
    )
  );
  it.effect("writes idempotently, ignores non-workspaces and fixture markers, preserves exempt bytes", () =>
    run(
      Effect.gen(function* () {
        const root = yield* fixture({
          "package.json": { name: "root", workspaces: ["packages/*", "apps/*", "infra", "scratchpad"] },
          "packages/a/package.json": { name: "@beep/a", scripts: base },
          "packages/a/src/index.ts": "export const x = 1;",
          "packages/a/test/fixtures/src/example.ts": "import.meta.vitest",
          "packages/a/src/index.d.ts": "import.meta.vitest",
          "packages/b/package.json": { name: "@beep/b", scripts: base },
          "packages/b/src/index.ts": "// import.meta.vitest",
          "packages/b/vitest.config.ts": "import shared from '../../../vitest.shared.ts'",
          "infra/package.json": { name: "@beep/infra", scripts: base },
          "infra/lambda/x/package.json": { scripts: { docgen: "out of domain" } },
          "scratchpad/package.json": { name: "scratchpad", scripts: { docgen: "exempt", "lint:laws": "owned" } },
        });
        const fs = yield* FileSystem.FileSystem;
        const before = yield* fs.readFileString(`${root}/scratchpad/package.json`);
        const policy = yield* PackageScriptsPolicy.make(root);
        expect(yield* policy.kindOf("infra/lambda/x/package.json").pipe(Effect.isFailure)).toBe(true);
        expect(yield* policy.kindOf("infra/package.json")).toBe("infra");
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
        expect(b).toContain('"beep:doctest": "BEEP_VITEST_DOCTEST=1 bunx --bun vitest run"');
        expect(yield* fs.readFileString(`${root}/scratchpad/package.json`)).toBe(before);
        expect(yield* fs.readFileString(`${root}/infra/lambda/x/package.json`)).toContain("out of domain");
      })
    )
  );
  it.effect("reports bypass conflicts, unowned marked sources and deleted generator scripts", () =>
    run(
      Effect.gen(function* () {
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
      })
    )
  );
  it.effect("fingerprints transitive dependency sources and root configs with fresh closure discovery", () =>
    run(
      Effect.gen(function* () {
        const files: Record<string, unknown> = {
          "package.json": { name: "root", workspaces: ["packages/*"] },
          "packages/cli/package.json": { name: "@beep/repo-cli", dependencies: { "@beep/helper": "workspace:*" } },
          "packages/cli/src/index.ts": "cli",
          "packages/helper/package.json": { name: "@beep/helper", dependencies: { "@beep/nested": "workspace:*" } },
          "packages/helper/src/index.ts": "helper",
          "packages/nested/package.json": { name: "@beep/nested" },
          "packages/nested/src/index.ts": "nested",
          "packages/unrelated/package.json": { name: "@beep/unrelated" },
          "packages/unrelated/src/index.ts": "unrelated",
        };
        for (const name of [
          "eslint.config.mjs",
          "tsdoc.json",
          ".oxlintrc.json",
          "_typos.toml",
          "knip.jsonc",
          ".fallowrc.jsonc",
          "biome.jsonc",
          "tsconfig.base.json",
          "tsconfig.json",
        ])
          files[name] = "config";
        const root = yield* fixture(files);
        const fs = yield* FileSystem.FileSystem;
        const first = yield* policyToolsFingerprint(root);
        expect(first.inputs).toContain("packages/nested/src/**");
        expect(first.inputs).not.toContain("packages/unrelated/src/**");
        expect((yield* policyToolsFingerprint(root)).digest).toBe(first.digest);
        yield* fs.writeFileString(`${root}/packages/unrelated/src/index.ts`, "unrelated edit");
        expect((yield* policyToolsFingerprint(root)).digest).toBe(first.digest);
        yield* fs.writeFileString(`${root}/packages/nested/src/index.ts`, "nested edit");
        const second = yield* policyToolsFingerprint(root);
        expect(second.digest).not.toBe(first.digest);
        yield* fs.writeFileString(`${root}/eslint.config.mjs`, "config edit");
        expect((yield* policyToolsFingerprint(root)).digest).not.toBe(second.digest);
      })
    )
  );
});
