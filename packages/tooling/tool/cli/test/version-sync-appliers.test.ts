import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import {
  countItemUpdates,
  TURBO_SCHEMA_FIELD,
  UpdateApplierService,
  UpdateApplierServiceLive,
  VersionCategoryReport,
  VersionDriftItem,
  VersionSyncError,
  VersionSyncReport,
  VersionSyncResolution,
} from "@beep/repo-cli/test/VersionSync";
import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import { strictEqual } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Str from "effect/String";

const AppliersTestLayer = Layer.mergeAll(MemoryFileSystem.layer, Path.layer, UpdateApplierServiceLive);

const EFFECT_4_1_1_COMMIT = "bc492f0965dc0f6a83cefd141071c5ead10f7efa";
const EFFECT_4_1_0_COMMIT = "9a91b1926a5fbfaffd302a7a41a94d4d53a1154e";

const driftItem = (file: string, field: string, current: string, expected: string): VersionDriftItem =>
  VersionDriftItem.make({ file, field, current, expected, line: O.none() });

const resolutionOf = (report: VersionCategoryReport): VersionSyncResolution =>
  VersionSyncResolution.make({
    report: VersionSyncReport.make({ categories: [report], hasDrift: true }),
    nodeLocations: [],
  });

const applyReport = Effect.fn(function* (repoRoot: string, report: VersionCategoryReport) {
  const updater = yield* UpdateApplierService;
  return yield* updater.apply(repoRoot, resolutionOf(report));
});

const makeRepo = Effect.fn(function* (files: Readonly<Record<string, string>>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped();
  for (const [relative, content] of R.toEntries(files)) {
    const filePath = path.join(root, relative);
    yield* fs.makeDirectory(path.dirname(filePath), { recursive: true });
    yield* fs.writeFileString(filePath, content);
  }
  const read = (relative: string) => fs.readFileString(path.join(root, relative));
  return { root, read };
});

const biomeSchema = (version: string) => `https://biomejs.dev/schemas/${version}/schema.json`;
const turboSchema = "https://v2-10-14.turborepo.dev/schema.json";

it.layer(AppliersTestLayer, { timeout: "30 seconds" })("VersionSync update appliers", (it) => {
  describe("countItemUpdates", () => {
    it.effect(
      "gives 0 for an empty report without calling the updater",
      Effect.fn(function* () {
        const calls: Array<string> = [];
        const report = VersionCategoryReport.cases.effect.make({ status: "ok", items: [] });
        const count = yield* countItemUpdates(report, (item) => {
          calls.push(item.field);
          return Effect.succeed(true);
        });
        strictEqual(count, 0);
        expect(calls).toEqual([]);
      })
    );

    it.effect(
      "runs items in report order and counts only the items that changed a file",
      Effect.fn(function* () {
        const calls: Array<string> = [];
        const report = VersionCategoryReport.cases.effect.make({
          status: "drift",
          items: A.map(["changed-1", "unchanged", "changed-2", "unmatched"], (field) =>
            driftItem("package.json", field, "1", "2")
          ),
        });
        const count = yield* countItemUpdates(report, (item) => {
          calls.push(item.field);
          return Effect.succeed(Str.startsWith("changed")(item.field));
        });
        strictEqual(count, 2);
        expect(calls).toEqual(["changed-1", "unchanged", "changed-2", "unmatched"]);
      })
    );

    it.effect(
      "stops at the first failing updater",
      Effect.fn(function* () {
        const calls: Array<string> = [];
        const report = VersionCategoryReport.cases.effect.make({
          status: "drift",
          items: A.map(["first", "fails", "never"], (field) => driftItem("package.json", field, "1", "2")),
        });
        const error = yield* Effect.flip(
          countItemUpdates(report, (item) => {
            calls.push(item.field);
            return item.field === "fails"
              ? Effect.fail(VersionSyncError.make({ message: "boom", file: "package.json" }))
              : Effect.succeed(true);
          })
        );
        strictEqual(error.message, "boom");
        expect(calls).toEqual(["first", "fails"]);
      })
    );
  });

  describe("Bun applier", () => {
    it.effect(
      "gives 0 for an empty report",
      Effect.fn(function* () {
        const { root } = yield* makeRepo({ ".bun-version": "1.3.0\n" });
        const applyReport1 = yield* applyReport(
          root,
          VersionCategoryReport.cases.bun.make({ status: "ok", items: [] })
        );
        strictEqual(applyReport1, 0);
      })
    );

    it.effect(
      "counts changed files only, ignoring unchanged and unmatched items",
      Effect.fn(function* () {
        const { root, read } = yield* makeRepo({
          ".bun-version": "1.3.0\n",
          "package.json": '{"packageManager":"bun@1.4.0"}\n',
        });
        const report = VersionCategoryReport.cases.bun.make({
          status: "drift",
          items: [
            driftItem(".bun-version", "version", "1.3.0", "1.4.0"),
            driftItem("package.json", "packageManager", "bun@1.4.0", "bun@1.4.0"),
            driftItem("unknown.txt", "version", "1", "2"),
          ],
        });
        const applyReport2 = yield* applyReport(root, report);
        strictEqual(applyReport2, 1);
        const read3 = yield* read(".bun-version");
        strictEqual(read3, "1.4.0\n");
      })
    );

    it.effect(
      "fails at the first failing item and leaves later items unapplied",
      Effect.fn(function* () {
        const { root, read } = yield* makeRepo({ ".bun-version": "1.3.0\n" });
        const report = VersionCategoryReport.cases.bun.make({
          status: "drift",
          items: [
            driftItem("package.json", "packageManager", "bun@1.3.0", "bun@1.4.0"),
            driftItem(".bun-version", "version", "1.3.0", "1.4.0"),
          ],
        });
        const error = yield* Effect.flip(applyReport(root, report));
        expect(error.message).toContain("package.json");
        const read4 = yield* read(".bun-version");
        strictEqual(read4, "1.3.0\n");
      })
    );
  });

  describe("Biome applier", () => {
    it.effect(
      "gives 0 for an empty report",
      Effect.fn(function* () {
        const { root } = yield* makeRepo({});
        const applyReport5 = yield* applyReport(
          root,
          VersionCategoryReport.cases.biome.make({ status: "ok", items: [] })
        );
        strictEqual(applyReport5, 0);
      })
    );

    it.effect(
      "rewrites the schema version, ignores unmatched fields, and counts 0 once in sync",
      Effect.fn(function* () {
        const { root, read } = yield* makeRepo({
          "biome.jsonc": `{\n  // keep me\n  "$schema": "${biomeSchema("2.5.5")}"\n}\n`,
        });
        const report = VersionCategoryReport.cases.biome.make({
          status: "drift",
          items: [
            driftItem("biome.jsonc", "$schema version", "2.5.5", "2.5.6"),
            driftItem("biome.jsonc", "formatter.lineWidth", "80", "120"),
          ],
        });
        const applyReport6 = yield* applyReport(root, report);
        strictEqual(applyReport6, 1);
        const updated = yield* read("biome.jsonc");
        expect(updated).toContain(`"$schema": "${biomeSchema("2.5.6")}"`);
        expect(updated).toContain("// keep me");
        const applyReport7 = yield* applyReport(root, report);
        strictEqual(applyReport7, 0);
      })
    );
  });

  describe("Turbo applier", () => {
    it.effect(
      "gives 0 for an empty report",
      Effect.fn(function* () {
        const { root } = yield* makeRepo({});
        const applyReport8 = yield* applyReport(
          root,
          VersionCategoryReport.cases.turbo.make({ status: "ok", items: [] })
        );
        strictEqual(applyReport8, 0);
      })
    );

    it.effect(
      "counts drifted schema files, skipping other fields and files already in sync",
      Effect.fn(function* () {
        const { root, read } = yield* makeRepo({
          "turbo.json": `{ "$schema": "https://turborepo.com/schema.json" }\n`,
          "apps/web/turbo.json": `{ "$schema": "${turboSchema}" }\n`,
        });
        const report = VersionCategoryReport.cases.turbo.make({
          status: "drift",
          items: [
            driftItem("turbo.json", TURBO_SCHEMA_FIELD, "https://turborepo.com/schema.json", turboSchema),
            driftItem("apps/web/turbo.json", TURBO_SCHEMA_FIELD, turboSchema, turboSchema),
            driftItem("turbo.json", "tasks", "{}", "{}"),
          ],
        });
        const applyReport9 = yield* applyReport(root, report);
        strictEqual(applyReport9, 1);
        const read10 = yield* read("turbo.json");
        expect(read10).toContain(turboSchema);
      })
    );
  });

  describe("Effect applier", () => {
    const manifest = A.join(
      [
        "{",
        '  "catalog": {',
        '    "effect": "4.1.1",',
        '    "@effect/vitest": "4.1.0"',
        "  },",
        '  "overrides": {',
        '    "effect": "4.1.0"',
        "  },",
        '  "config": {',
        '    "effectSource": {',
        '      "version": "4.1.0",',
        `      "commit": "${EFFECT_4_1_0_COMMIT}"`,
        "    }",
        "  }",
        "}",
        "",
      ],
      "\n"
    );

    it.effect(
      "gives 0 for an empty report",
      Effect.fn(function* () {
        const { root } = yield* makeRepo({ "package.json": manifest });
        const applyReport11 = yield* applyReport(
          root,
          VersionCategoryReport.cases.effect.make({ status: "ok", items: [] })
        );
        strictEqual(applyReport11, 0);
      })
    );

    it.effect(
      "skips config.effectSource items on an errored report but still applies catalog items",
      Effect.fn(function* () {
        const { root, read } = yield* makeRepo({ "package.json": manifest });
        const report = VersionCategoryReport.cases.effect.make({
          status: "error",
          error: O.some("release commit unresolved"),
          items: [
            driftItem("package.json", "config.effectSource.version", "4.1.0", "4.1.1"),
            driftItem("package.json", "catalog.@effect/vitest", "4.1.0", "4.1.1"),
          ],
        });
        const applyReport12 = yield* applyReport(root, report);
        strictEqual(applyReport12, 1);
        const read13 = yield* read("package.json");
        strictEqual(read13, Str.replace(`"@effect/vitest": "4.1.0"`, `"@effect/vitest": "4.1.1"`)(manifest));
      })
    );

    it.effect(
      "ignores an empty catalog dependency and non-catalog fields, and counts unchanged entries as 0",
      Effect.fn(function* () {
        const { root, read } = yield* makeRepo({ "package.json": manifest });
        const report = VersionCategoryReport.cases.effect.make({
          status: "drift",
          items: [
            driftItem("package.json", "catalog.", "", "4.1.1"),
            driftItem("package.json", "overrides.effect", "4.1.0", "4.1.1"),
            driftItem("package.json", "catalog.effect", "4.1.1", "4.1.1"),
          ],
        });
        const applyReport14 = yield* applyReport(root, report);
        strictEqual(applyReport14, 0);
        const read15 = yield* read("package.json");
        strictEqual(read15, manifest);
      })
    );

    it.effect(
      "writes config.effectSource items when the report carries no error",
      Effect.fn(function* () {
        const { root, read } = yield* makeRepo({ "package.json": manifest });
        const report = VersionCategoryReport.cases.effect.make({
          status: "drift",
          items: [
            driftItem("package.json", "config.effectSource.version", "4.1.0", "4.1.1"),
            driftItem("package.json", "config.effectSource.commit", EFFECT_4_1_0_COMMIT, EFFECT_4_1_1_COMMIT),
          ],
        });
        const applyReport16 = yield* applyReport(root, report);
        strictEqual(applyReport16, 2);
        const read17 = yield* read("package.json");
        strictEqual(
          read17,
          pipe(
            manifest,
            Str.replace(`"version": "4.1.0"`, `"version": "4.1.1"`),
            Str.replace(`"commit": "${EFFECT_4_1_0_COMMIT}"`, `"commit": "${EFFECT_4_1_1_COMMIT}"`)
          )
        );
      })
    );
  });
});
