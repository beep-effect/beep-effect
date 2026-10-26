import { Lockfile } from "@beep/lockfiles/Lockfile";
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import {
  BunVersionState,
  buildBunReport,
  buildEffectReport,
  buildNodeReport,
  buildTurboReport,
  CategorySelectionService,
  CategorySelectionServiceLive,
  exactVersionFromSpecifier,
  extractBunArchiveChecksum,
  ReportRendererService,
  ReportRendererServiceLive,
  ResolverService,
  ResolverServiceLive,
  readLockfileResolvedVersion,
  resolveBunVersions,
  resolveEffectCatalog,
  resolveInstalledToolVersion,
  resolveNodeVersions,
  resolveTurboSchema,
  selectLatestDockerTag,
  TurboConfigFile,
  TurboSchemaState,
  UpdateApplierService,
  UpdateApplierServiceLive,
  updateCatalogEntry,
  updateJsoncSchemaUrl,
  updatePackageManagerField,
  updateVercelBunVersion,
  VersionCategoryReport,
  VersionDriftItem,
  VersionSyncOptions,
  VersionSyncReport,
  VersionSyncResolution,
} from "@beep/repo-cli/test/VersionSync";
import { FsUtilsLive } from "@beep/repo-utils";
import { SemVer } from "@beep/semver/SemVer";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { A } from "@beep/utils";
import { describe, expect, vi } from "@effect/vitest";
import { assertNone, assertSome, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const UnknownJson = S.fromJsonString(S.Unknown);

const coreText = (version: SemVer): string => `${version.major}.${version.minor}.${version.patch}`;
// A strict pin: the version without build metadata, which a Bun pin never carries.
const pinText = (version: SemVer): string =>
  A.isReadonlyArrayEmpty(version.prerelease)
    ? coreText(version)
    : `${coreText(version)}-${A.join(A.map(version.prerelease, String), ".")}`;
const decodeJsonEffect = S.decodeEffect(UnknownJson);

const encodeJson = S.encodeUnknownEffect(UnknownJson);

import * as Arbitrary from "effect/Arbitrary";

const decodeUnknownJson = S.decodeEffect(S.fromJsonString(S.Unknown));
const decodeBunVersionStateEffect = S.decodeEffect(BunVersionState);
const encodeBunVersionStateEffect = S.encodeEffect(BunVersionState);

import * as FetchHttpClient from "effect/http/FetchHttpClient";

const PlatformLayer = Layer.mergeAll(MemoryFileSystem.layer, Path.layer);

const VersionSyncTestLayer = Layer.mergeAll(
  PlatformLayer,
  FetchHttpClient.layer,
  UpdateApplierServiceLive,
  CategorySelectionServiceLive,
  ReportRendererServiceLive,
  ResolverServiceLive,
  FsUtilsLive.pipe(Layer.provide(PlatformLayer))
);

it.layer(VersionSyncTestLayer, { timeout: "30 seconds" })("VersionSync Effect Catalog", (it) => {
  describe("resolveEffectCatalog", () => {
    it.effect(
      "detects drift for lockstep Effect packages while ignoring non-lockstep Effect tools",
      Effect.fn(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectoryScoped();
        const packageJsonPath = path.join(tmpDir, "package.json");

        yield* fs.writeFileString(
          packageJsonPath,
          `${yield* encodeJson({
            name: "@beep/test-root",
            catalog: {
              effect: "^4.0.0-beta.28",
              "@effect/opentelemetry": "^4.0.0-beta.27",
              "@effect/platform-bun": "^4.0.0-beta.28",
              "@effect/vitest": "^4.0.0-beta.26",
              "@effect/tsgo": "^0.5.0",
            },
          })}\n`
        );

        const state = yield* resolveEffectCatalog(tmpDir);
        const report = buildEffectReport(state);

        expect(report.status).toBe("drift");
        report.latest.pipe(O.isSome, assertTrue);
        if (O.isSome(report.latest)) {
          expect(report.latest.value).toBe("^4.0.0-beta.28");
        }
        expect(report.items).toHaveLength(2);
        expect(A.map(report.items, (item) => item.field)).toEqual([
          "catalog.@effect/opentelemetry",
          "catalog.@effect/vitest",
        ]);
        expect(A.map(report.items, (item) => item.expected)).toEqual(["^4.0.0-beta.28", "^4.0.0-beta.28"]);
      })
    );

    it.effect(
      "rejects package.json JSONC: comments and trailing commas are not JSON",
      Effect.fn(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectoryScoped();
        const packageJsonPath = path.join(tmpDir, "package.json");

        // npm, Node and changesets read package.json with JSON.parse, so a
        // manifest only a JSONC parser accepts is broken for the toolchain;
        // the root catalog reader now fails on it instead of hiding it.
        yield* fs.writeFileString(
          packageJsonPath,
          `{
            // root catalog comment
            "name": "@beep/test-root",
            "catalog": {
              "effect": "^4.0.0-beta.28",
              "@effect/opentelemetry": "^4.0.0-beta.27",
            },
          }\n`
        );

        const error = yield* Effect.flip(resolveEffectCatalog(tmpDir));

        assertTrue(Str.startsWith("Failed to parse package.json")(error.message));
      })
    );
  });

  describe("snapshot catalog synchronization", () => {
    for (const repository of ["effect", "effect-smol"]) {
      it.effect(
        `normalizes ${repository} snapshots and preserves independently versioned tools`,
        Effect.fn(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = yield* fs.makeTempDirectoryScoped();
          const snapshot = (name: string) => `https://pkg.pr.new/Effect-TS/effect/${name}@c8349ed`;
          const independent = {
            "@effect/tsgo": "^0.5.0",
            "@effect/tsgo-linux-x64": "^0.5.0",
            "@effect/markdown-toc": "^0.1.0",
            "@effect/markdown-toc-cli": "^0.1.0",
            typescript: "^5.9.0",
          };
          const packageJsonPath = path.join(tmpDir, "package.json");
          yield* fs.writeFileString(
            packageJsonPath,
            yield* encodeJson({
              catalog: {
                effect: `https://pkg.pr.new/Effect-TS/${repository}/effect@c8349ed`,
                "@effect/vitest": "https://pkg.pr.new/Effect-TS/effect-smol/@effect/vitest@abcdef0",
                "@effect/platform-node": snapshot("@effect/platform-node"),
                ...independent,
              },
            })
          );
          const state = yield* resolveEffectCatalog(tmpDir);
          expect(A.map(state.packages, (pkg) => pkg.name)).toEqual([
            "@effect/platform-node",
            "@effect/vitest",
            "effect",
          ]);
          const report = buildEffectReport(state);
          expect(report.status).toBe("drift");
          expect(A.map(report.items, (item) => [item.field, item.expected])).toEqual([
            ["catalog.@effect/vitest", snapshot("@effect/vitest")],
            ...(repository === "effect-smol" ? [["catalog.effect", snapshot("effect")]] : []),
          ]);
          const updater = yield* UpdateApplierService;
          expect(
            yield* updater.apply(
              tmpDir,
              VersionSyncResolution.make({
                report: VersionSyncReport.make({ categories: [report], hasDrift: true }),
                nodeLocations: [],
              })
            )
          ).toBe(repository === "effect-smol" ? 2 : 1);
          const resolved = yield* resolveEffectCatalog(tmpDir);
          expect(buildEffectReport(resolved).status).toBe("ok");
          expect(A.map(resolved.packages, (pkg) => pkg.versionSpecifier)).toEqual([
            snapshot("@effect/platform-node"),
            snapshot("@effect/vitest"),
            snapshot("effect"),
          ]);
          const updated = yield* decodeJsonEffect(yield* fs.readFileString(packageJsonPath));
          expect(updated).toMatchObject({ catalog: independent });
        })
      );
    }
  });

  describe("updateCatalogEntry", () => {
    it.effect(
      "rewrites a root package.json catalog entry in place",
      Effect.fn(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectoryScoped();
        const packageJsonPath = path.join(tmpDir, "package.json");

        yield* fs.writeFileString(
          packageJsonPath,
          `${yield* encodeJson({
            name: "@beep/test-root",
            catalog: {
              effect: "^4.0.0-beta.28",
              "@effect/opentelemetry": "^4.0.0-beta.27",
            },
          })}\n`
        );

        const changed = yield* updateCatalogEntry(packageJsonPath, "@effect/opentelemetry", {
          versionSpecifier: "^4.0.0-beta.28",
        });
        const updated = yield* fs.readFileString(packageJsonPath);
        const decodedUpdated = (yield* decodeJsonEffect(updated)) as {
          readonly catalog: Record<string, string>;
        };

        expect(changed).toBe(true);
        expect(decodedUpdated.catalog["@effect/opentelemetry"]).toBe("^4.0.0-beta.28");
        expect(decodedUpdated.catalog.effect).toBe("^4.0.0-beta.28");
      })
    );
  });

  describe("PackageJsonUpdater byte preservation", () => {
    it.effect(
      "keeps a tab-indented manifest's indentation when it inserts packageManager",
      Effect.fn(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectoryScoped();
        const packageJsonPath = path.join(tmpDir, "package.json");

        // The retired jsonc edit always inserted 2-space lines.
        yield* fs.writeFileString(packageJsonPath, '{\n\t"name": "@beep/test-root"\n}\n');

        const changed = yield* updatePackageManagerField(packageJsonPath, "1.4.2");

        assertTrue(changed);
        strictEqual(
          yield* fs.readFileString(packageJsonPath),
          '{\n\t"name": "@beep/test-root",\n\t"packageManager": "bun@1.4.2"\n}\n'
        );
      })
    );

    it.effect(
      "refuses to invent a root catalog when the manifest declares none",
      Effect.fn(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectoryScoped();
        const packageJsonPath = path.join(tmpDir, "package.json");
        const original = '{\n  "name": "@beep/test-root"\n}\n';

        // Drift items come from an existing catalog; the retired jsonc edit
        // created `catalog` here, the kit edit fails instead.
        yield* fs.writeFileString(packageJsonPath, original);

        const error = yield* Effect.flip(updateCatalogEntry(packageJsonPath, "effect", { versionSpecifier: "^4.0.0" }));

        assertTrue(Str.startsWith(`Failed to update ${packageJsonPath}`)(error.message));
        strictEqual(yield* fs.readFileString(packageJsonPath), original);
      })
    );
  });

  describe("resolveNodeVersions", () => {
    it.effect(
      "parses GitHub workflow YAML through the shared schema codec after extraction to @beep/schema",
      Effect.fn(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectoryScoped();
        const workflowDir = path.join(tmpDir, ".github", "workflows");

        yield* fs.makeDirectory(workflowDir, { recursive: true });
        yield* fs.writeFileString(path.join(tmpDir, ".nvmrc"), "20.11.1\n");
        yield* fs.writeFileString(
          path.join(workflowDir, "ci.yml"),
          A.join(
            [
              "jobs:",
              "  test:",
              "    steps:",
              "      - uses: actions/setup-node@v4",
              "        with:",
              "          node-version: 18.19.0",
            ],
            "\n"
          )
        );

        const state = yield* resolveNodeVersions(tmpDir);
        const report = buildNodeReport(state);

        expect(state.nvmrc).toBe("20.11.1");
        expect(state.workflowLocations).toHaveLength(1);
        expect(state.workflowLocations[0]?.file).toBe(".github/workflows/ci.yml");
        expect(state.workflowLocations[0]?.currentValue).toBe("18.19.0");
        expect(state.workflowLocations[0]?.yamlPath).toEqual(["jobs", "test", "steps", 0, "with", "node-version"]);
        expect(report.status).toBe("drift");
        expect(report.items).toHaveLength(1);
        expect(report.items[0]?.expected).toBe("20.11.1");
      })
    );

    it.effect(
      "preserves the reviewed coverage runtime pins while reporting lookalike drift",
      Effect.fn(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectoryScoped();
        const workflowDir = path.join(tmpDir, ".github", "workflows");
        yield* fs.makeDirectory(workflowDir, { recursive: true });
        yield* fs.writeFileString(path.join(tmpDir, ".nvmrc"), "24.22.1\n");
        yield* fs.writeFileString(
          path.join(workflowDir, "check.yml"),
          A.join(
            [
              "jobs:",
              "  test-unit-shard:",
              "    steps:",
              "      - with:",
              '          node-version: "22.23.4"',
              "  coverage-regression:",
              "    steps:",
              "      - with:",
              '          node-version: "22.23.4"',
              "  ordinary-check:",
              "    steps:",
              "      - with:",
              '          node-version: "22.23.4"',
            ],
            "\n"
          )
        );
        const pinned = yield* resolveNodeVersions(tmpDir);
        expect(A.map(pinned.workflowLocations, (location) => location.jobName)).toEqual(["ordinary-check"]);
        expect(buildNodeReport(pinned).items).toHaveLength(1);

        yield* fs.writeFileString(
          path.join(workflowDir, "other.yml"),
          'jobs:\n  coverage-regression:\n    steps:\n      - with:\n          node-version: "22.23.4"\n'
        );
        yield* fs.writeFileString(
          path.join(workflowDir, "check.yml"),
          'jobs:\n  test-unit-shard:\n    steps:\n      - with:\n          node-version: "22.22.3"\n'
        );
        const drift = yield* resolveNodeVersions(tmpDir);
        expect(drift.workflowLocations).toHaveLength(2);
        const report = buildNodeReport(drift);
        expect(report.status).toBe("drift");
        expect(A.map(report.items, (item) => item.current)).toEqual(expect.arrayContaining(["22.22.3", "22.23.4"]));
        expect(A.map(report.items, (item) => item.expected)).toEqual(["24.22.1", "24.22.1"]);
      })
    );

    it.effect(
      "skips templated node-version values that fall back to .nvmrc at runtime",
      Effect.fn(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectoryScoped();
        const workflowDir = path.join(tmpDir, ".github", "workflows");

        yield* fs.makeDirectory(workflowDir, { recursive: true });
        yield* fs.writeFileString(path.join(tmpDir, ".nvmrc"), "20.11.1\n");
        yield* fs.writeFileString(
          path.join(workflowDir, "heavy.yml"),
          A.join(
            [
              "jobs:",
              "  lanes:",
              "    steps:",
              "      - uses: actions/setup-node@v4",
              "        with:",
              "          node-version: ${{ matrix.node_version || '' }}",
            ],
            "\n"
          )
        );

        const state = yield* resolveNodeVersions(tmpDir);
        const report = buildNodeReport(state);

        expect(state.workflowLocations).toHaveLength(0);
        expect(report.status).toBe("ok");
      })
    );
  });

  describe("buildBunReport", () => {
    {
      const equivalent = S.toEquivalence(BunVersionState);
      it.effect.prop(
        "round-trips schema-derived Bun version states",
        [Arbitrary.schema(BunVersionState)],
        Effect.fnUntraced(function* ([state]) {
          expect(equivalent(yield* decodeBunVersionStateEffect(yield* encodeBunVersionStateEffect(state)), state)).toBe(
            true
          );
        })
      );
    }

    it.effect(
      "resolves the root, Vercel, and runner archive Bun pins without network access",
      Effect.fn(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectoryScoped();
        const vercelDir = path.join(tmpDir, "apps", "oip-web");
        const digest = "2d03fb5fb83ac8b567aca0a281b2ce1a1a19d488f56c2968d88c3f25e92fe452";

        yield* fs.makeDirectory(vercelDir, { recursive: true });
        yield* fs.writeFileString(path.join(tmpDir, ".bun-version"), "1.4.0\n");
        yield* fs.writeFileString(
          path.join(tmpDir, "package.json"),
          `${yield* encodeJson({ packageManager: "bun@1.4.0" })}\n`
        );
        yield* fs.writeFileString(
          path.join(vercelDir, "vercel.json"),
          `${yield* encodeJson({
            installCommand: 'cd ../.. && npx --yes "bun@1.3.14" install --frozen-lockfile',
            buildCommand: "cd ../.. && npx --yes bun@1.3.14 run --cwd apps/oip-web build:pwa",
          })}\n`
        );
        yield* fs.writeFileString(path.join(tmpDir, ".bun-linux-x64.sha256"), `${digest}\n`);

        const state = yield* resolveBunVersions(tmpDir, true);

        expect(state.bunVersionFile).toBe("1.4.0");
        expect(state.packageManagerField).toBe("1.4.0");
        assertSome(state.vercelInstallVersion, "1.3.14");
        assertSome(state.vercelBuildVersion, "1.3.14");
        assertSome(state.bunArchiveSha256, digest);
        assertNone(state.expectedBunArchiveSha256);
      })
    );

    it.effect(
      "treats the Vercel and runner checksum files as optional",
      Effect.fn(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectoryScoped();

        yield* fs.writeFileString(path.join(tmpDir, ".bun-version"), "1.4.0\n");
        yield* fs.writeFileString(
          path.join(tmpDir, "package.json"),
          `${yield* encodeJson({ packageManager: "bun@1.4.0" })}\n`
        );

        const state = yield* resolveBunVersions(tmpDir, true);

        assertNone(state.vercelInstallVersion);
        assertNone(state.vercelBuildVersion);
        assertNone(state.bunArchiveSha256);
      })
    );

    it("uses semver precedence instead of lexicographic string ordering for local Bun pins", () => {
      const report = buildBunReport(
        BunVersionState.make({
          bunVersionFile: "1.10.0",
          packageManagerField: "1.9.0",
          latest: O.none(),
        })
      );

      expect(report.status).toBe("drift");
      expect(report.items).toHaveLength(1);
      expect(report.items[0]?.file).toBe("package.json");
      expect(report.items[0]?.expected).toBe("bun@1.10.0");
    });

    it("treats stable releases as newer than prereleases with the same core version", () => {
      const report = buildBunReport(
        BunVersionState.make({
          bunVersionFile: "1.10.0-beta.1",
          packageManagerField: "1.10.0",
          latest: O.none(),
        })
      );

      expect(report.status).toBe("drift");
      expect(report.items).toHaveLength(1);
      expect(report.items[0]?.file).toBe(".bun-version");
      expect(report.items[0]?.expected).toBe("1.10.0");
    });

    it("reports Vercel runtime pins and the runner archive checksum with Bun version drift", () => {
      const report = buildBunReport(
        BunVersionState.make({
          bunVersionFile: "1.4.0",
          packageManagerField: "1.4.0",
          vercelInstallVersion: O.some("1.3.14"),
          vercelBuildVersion: O.some("1.3.14"),
          bunArchiveSha256: O.some("old-digest"),
          expectedBunArchiveSha256: O.some("new-digest"),
          latest: O.none(),
        })
      );

      expect(report.status).toBe("drift");
      expect(A.map(report.items, (item) => [item.file, item.field, item.expected])).toEqual([
        ["apps/oip-web/vercel.json", "installCommand Bun version", "1.4.0"],
        ["apps/oip-web/vercel.json", "buildCommand Bun version", "1.4.0"],
        [".bun-linux-x64.sha256", "bun-linux-x64.zip sha256", "new-digest"],
      ]);
    });

    it("extracts the Linux x64 archive digest from Bun's checksum manifest", () => {
      const digest = "2d03fb5fb83ac8b567aca0a281b2ce1a1a19d488f56c2968d88c3f25e92fe452";
      assertSome(extractBunArchiveChecksum(`${digest}  bun-linux-x64.zip\n`), digest);
      assertNone(extractBunArchiveChecksum(`${digest}  bun-linux-aarch64.zip\n`));
    });

    const localTarget = (bunVersionFile: string, packageManagerField: string) =>
      A.map(
        buildBunReport(BunVersionState.make({ bunVersionFile, packageManagerField, latest: O.none() })).items,
        (item) => [item.file, item.expected]
      );

    it("reads local Bun pins through @beep/semver with an optional leading v and writes them canonical", () => {
      // The `v` spelling is itself drift: both pins are rewritten to the canonical version.
      expect(localTarget("v1.4.0", "1.3.9")).toEqual([
        [".bun-version", "1.4.0"],
        ["package.json", "bun@1.4.0"],
      ]);
      expect(localTarget("1.3.9", "v1.4.0")).toEqual([
        [".bun-version", "1.4.0"],
        ["package.json", "bun@1.4.0"],
      ]);
      expect(localTarget("1.4.0-rc.10", "1.4.0-rc.9")).toEqual([["package.json", "bun@1.4.0-rc.10"]]);
      expect(localTarget("1.4.0-alpha", "1.4.0-1")).toEqual([["package.json", "bun@1.4.0-alpha"]]);
    });

    it("treats non-SemVer local Bun pins as unparsed instead of comparing them", () => {
      // The pre-@beep/semver pattern read "01.5.0" as 1.5.0 and picked it; the kit rejects leading zeros.
      expect(localTarget("1.4.0", "01.5.0")).toEqual([["package.json", "bun@1.4.0"]]);
      // Build metadata is the integrity slot of a pin, never part of the version, so it does not parse.
      expect(localTarget("1.4.0", "1.5.0+sha256.abc")).toEqual([["package.json", "bun@1.4.0"]]);
      expect(localTarget("not-a-version", "also-not")).toEqual([["package.json", "bun@not-a-version"]]);
    });

    // The target `buildBunReport` writes: the package.json pin when `.bun-version` wins, else `.bun-version`.
    const selectedLocal = (bunVersionFile: string, packageManagerField: string): string =>
      O.match(
        A.head(buildBunReport(BunVersionState.make({ bunVersionFile, packageManagerField, latest: O.none() })).items),
        {
          onNone: () => bunVersionFile,
          onSome: (item) => (item.file === "package.json" ? Str.replace(/^bun@/, "")(item.expected) : item.expected),
        }
      );

    it.prop(
      "picks the SemVer.gte winner of two strict local Bun pins",
      { left: Arbitrary.schema(SemVer), right: Arbitrary.schema(SemVer) },
      ({ left, right }) => {
        const leftPin = pinText(left);
        const rightPin = pinText(right);
        // SemVer ordering ignores build metadata, so the generated values order as their pins do.
        const winner = SemVer.gte(left, right) ? leftPin : rightPin;
        expect(selectedLocal(leftPin, rightPin)).toBe(winner);
      },
      { arbitrary: fcRuns(100) }
    );
  });

  describe("selectLatestDockerTag", () => {
    const redis = { repository: "redis", tag: "8.10.2" };
    const pgvector = { repository: "pgvector/pgvector", tag: "pg17" };

    it("picks the newest pure version tag and skips suffixed, floating and prerelease tags", () => {
      assertSome(
        selectLatestDockerTag(redis, ["8.9.0", "8.10.2-alpine", "latest", "8.10.2", "8.11.0-rc1", "8"]),
        "8.10.2"
      );
      assertSome(
        selectLatestDockerTag({ repository: "grafana/otel-lgtm", tag: "0.37.0" }, ["v0.40.1", "0.40.0"]),
        "v0.40.1"
      );
      assertNone(selectLatestDockerTag(redis, ["latest", "8-alpine", "nightly"]));
    });

    it("keeps the first listed tag among equal versions", () => {
      assertSome(selectLatestDockerTag(redis, ["v8.10.2", "8.10.2"]), "v8.10.2");
      assertSome(selectLatestDockerTag(pgvector, ["pg17-v0.8.0", "pg17-v0.8.0-bookworm"]), "pg17-v0.8.0");
    });

    it("reads pgvector versions inside the current pg family", () => {
      assertSome(
        selectLatestDockerTag(pgvector, [
          "pg16-v0.9.0",
          "pg17-v0.8.0",
          "pg17-v0.8.1-bookworm",
          "pg17",
          "pg17-v0.9.0-rc1",
        ]),
        "pg17-v0.8.1-bookworm"
      );
      assertNone(selectLatestDockerTag(pgvector, ["pg16-v0.9.0", "pg17"]));
    });

    it("rejects version cores that are not SemVer", () => {
      // The pre-@beep/semver triples read "01" as 1; the kit rejects leading zeros and unsafe integers.
      assertSome(selectLatestDockerTag(redis, ["8.10.2", "8.10.03", "9007199254740992.0.0"]), "8.10.2");
      assertNone(selectLatestDockerTag(pgvector, ["pg17-v0.08.0"]));
    });

    it.prop(
      "selects the first tag holding the maximum stable version under SemVer.compare",
      { versions: Arbitrary.schema(S.Tuple([SemVer, S.Boolean]).pipe(S.Array)) },
      ({ versions }) => {
        const tags = A.map(versions, ([version, prefixed]) => `${prefixed ? "v" : ""}${coreText(version)}`);
        const cores = A.map(versions, ([version]) => SemVer.of(version.major, version.minor, version.patch));
        const expected = O.flatMap(SemVer.max(cores), (max) =>
          O.flatMap(
            A.findFirstIndex(cores, (core) => SemVer.equal(core, max)),
            (index) => A.get(tags, index)
          )
        );
        expect(selectLatestDockerTag(redis, tags)).toEqual(expected);
      },
      { arbitrary: fcRuns(100) }
    );
  });

  describe("updateVercelBunVersion", () => {
    it.effect(
      "updates the canonical Bun version without rewriting derived deployment commands",
      Effect.fn(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectoryScoped();
        const vercelDir = path.join(tmpDir, "apps", "oip-web");
        const vercelJsonPath = path.join(vercelDir, "vercel.json");
        const document = `${yield* encodeJson({
          installCommand: 'cd ../.. && npx --yes "bun@$(cat .bun-version)" install --frozen-lockfile',
          buildCommand: 'cd ../.. && npx --yes "bun@$(cat .bun-version)" run --cwd apps/oip-web build:pwa',
        })}\n`;

        yield* fs.makeDirectory(vercelDir, { recursive: true });
        yield* fs.writeFileString(path.join(tmpDir, ".bun-version"), "1.3.14\n");
        yield* fs.writeFileString(
          path.join(tmpDir, "package.json"),
          `${yield* encodeJson({ packageManager: "bun@1.4.0" })}\n`
        );
        yield* fs.writeFileString(vercelJsonPath, document);

        const report = buildBunReport(yield* resolveBunVersions(tmpDir, true));
        expect(A.map(report.items, (item) => item.file)).toEqual([".bun-version"]);
        const updater = yield* UpdateApplierService;
        expect(
          yield* updater.apply(
            tmpDir,
            VersionSyncResolution.make({
              report: VersionSyncReport.make({ categories: [report], hasDrift: true }),
              nodeLocations: [],
            })
          )
        ).toBe(1);
        expect(yield* fs.readFileString(path.join(tmpDir, ".bun-version"))).toBe("1.4.0\n");
        expect(buildBunReport(yield* resolveBunVersions(tmpDir, true)).status).toBe("ok");
        expect(yield* updateVercelBunVersion(vercelJsonPath, "installCommand", "1.4.0")).toBe(false);
        expect(yield* updateVercelBunVersion(vercelJsonPath, "buildCommand", "1.4.0")).toBe(false);
        expect(yield* fs.readFileString(vercelJsonPath)).toBe(document);
      })
    );

    it.effect(
      "updates install and build command pins while preserving the surrounding Vercel document",
      Effect.fn(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectoryScoped();
        const vercelJsonPath = path.join(tmpDir, "vercel.json");

        yield* fs.writeFileString(
          vercelJsonPath,
          `${yield* encodeJson({
            $schema: "https://openapi.vercel.sh/vercel.json",
            installCommand: 'cd ../.. && npx --yes "bun@1.3.14" install --frozen-lockfile',
            buildCommand: "cd ../.. && npx --yes bun@1.3.14 run --cwd apps/oip-web build:pwa",
          })}\n`
        );

        expect(yield* updateVercelBunVersion(vercelJsonPath, "installCommand", "1.4.0")).toBe(true);
        expect(yield* updateVercelBunVersion(vercelJsonPath, "buildCommand", "1.4.0")).toBe(true);
        expect(yield* updateVercelBunVersion(vercelJsonPath, "buildCommand", "1.4.0")).toBe(false);

        const updated = (yield* decodeUnknownJson(yield* fs.readFileString(vercelJsonPath))) as Record<string, unknown>;
        expect(updated.installCommand).toBe('cd ../.. && npx --yes "bun@1.4.0" install --frozen-lockfile');
        expect(updated.buildCommand).toBe("cd ../.. && npx --yes bun@1.4.0 run --cwd apps/oip-web build:pwa");
        expect(updated.$schema).toBe("https://openapi.vercel.sh/vercel.json");
      })
    );

    it.effect(
      "applies every Bun report update through the version-sync write service",
      Effect.fn(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectoryScoped();
        const vercelDir = path.join(tmpDir, "apps", "oip-web");

        yield* fs.makeDirectory(vercelDir, { recursive: true });
        yield* fs.writeFileString(path.join(tmpDir, ".bun-version"), "1.4.0\n");
        yield* fs.writeFileString(
          path.join(tmpDir, "package.json"),
          `${yield* encodeJson({ packageManager: "bun@1.4.0" })}\n`
        );
        yield* fs.writeFileString(path.join(tmpDir, ".bun-linux-x64.sha256"), "old-digest\n");
        yield* fs.writeFileString(
          path.join(vercelDir, "vercel.json"),
          `${yield* encodeJson({
            installCommand: "npx --yes bun@1.3.14 install --frozen-lockfile",
            buildCommand: "npx --yes bun@1.3.14 run build:pwa",
          })}\n`
        );

        const bunReport = buildBunReport(
          BunVersionState.make({
            bunVersionFile: "1.4.0",
            packageManagerField: "1.4.0",
            vercelInstallVersion: O.some("1.3.14"),
            vercelBuildVersion: O.some("1.3.14"),
            bunArchiveSha256: O.some("old-digest"),
            expectedBunArchiveSha256: O.some("new-digest"),
            latest: O.none(),
          })
        );
        const resolution = VersionSyncResolution.make({
          report: VersionSyncReport.make({ categories: [bunReport], hasDrift: true }),
          nodeLocations: [],
        });
        const updater = yield* UpdateApplierService;
        const applied = yield* updater.apply(tmpDir, resolution);

        expect(applied).toBe(3);
        expect(yield* fs.readFileString(path.join(tmpDir, ".bun-linux-x64.sha256"))).toBe("new-digest\n");
        const updatedVercel = (yield* decodeUnknownJson(
          yield* fs.readFileString(path.join(vercelDir, "vercel.json"))
        )) as Record<string, unknown>;
        expect(updatedVercel.installCommand).toBe("npx --yes bun@1.4.0 install --frozen-lockfile");
        expect(updatedVercel.buildCommand).toBe("npx --yes bun@1.4.0 run build:pwa");
      })
    );
  });
});

it.layer(VersionSyncTestLayer, { timeout: "30 seconds" })("VersionSync Turbo Schema", (it) => {
  const writeTurboWorkspace = Effect.fn(function* (tmpDir: string, options: { readonly lockfile: boolean }) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const appDir = path.join(tmpDir, "apps", "web");
    const libDir = path.join(tmpDir, "packages", "lib");
    const bareDir = path.join(tmpDir, "packages", "bare");

    yield* fs.makeDirectory(appDir, { recursive: true });
    yield* fs.makeDirectory(libDir, { recursive: true });
    yield* fs.makeDirectory(bareDir, { recursive: true });
    yield* fs.writeFileString(
      path.join(tmpDir, "package.json"),
      yield* encodeJson({
        name: "turbo-fixture",
        workspaces: ["apps/*", "packages/*"],
        catalog: { turbo: "^2.10.13" },
        devDependencies: { turbo: "catalog:" },
      })
    );
    if (options.lockfile) {
      // The lockfile resolves a newer patch than the catalog floor; the
      // installed binary is 2.10.14, so the schema pin must follow it.
      yield* fs.writeFileString(
        path.join(tmpDir, "bun.lock"),
        A.join(
          [
            "{",
            '  "lockfileVersion": 1,',
            '  "workspaces": { "": { "name": "turbo-fixture" } },',
            '  "packages": {',
            '    "turbo": ["turbo@2.10.14", "", { "bin": { "turbo": "bin/turbo" } }, "sha512-fixture"],',
            "  }",
            "}",
            "",
          ],
          "\n"
        )
      );
    }
    yield* fs.writeFileString(path.join(appDir, "package.json"), yield* encodeJson({ name: "@fixture/web" }));
    yield* fs.writeFileString(path.join(libDir, "package.json"), yield* encodeJson({ name: "@fixture/lib" }));
    yield* fs.writeFileString(path.join(bareDir, "package.json"), yield* encodeJson({ name: "@fixture/bare" }));
    yield* fs.writeFileString(
      path.join(tmpDir, "turbo.json"),
      A.join(
        [
          "{",
          "  // root pipeline",
          '  "$schema": "https://v2-10-2.turborepo.dev/schema.json",',
          '  "tasks": {}',
          "}",
          "",
        ],
        "\n"
      )
    );
    yield* fs.writeFileString(
      path.join(appDir, "turbo.json"),
      yield* encodeJson({ $schema: "https://turborepo.com/schema.json", extends: ["//"], tasks: {} })
    );
    yield* fs.writeFileString(
      path.join(libDir, "turbo.json"),
      yield* encodeJson({ $schema: "https://v2-10-13.turborepo.dev/schema.json", extends: ["//"], tasks: {} })
    );
    yield* fs.writeFileString(path.join(bareDir, "turbo.json"), yield* encodeJson({ extends: ["//"], tasks: {} }));
  });

  describe("resolveTurboSchema", () => {
    it.effect(
      "reports drift as URL pairs for every turbo.json whose $schema is not the lockfile-resolved turbo release URL",
      Effect.fn(function* () {
        const fs = yield* FileSystem.FileSystem;
        const tmpDir = yield* fs.makeTempDirectoryScoped();
        yield* writeTurboWorkspace(tmpDir, { lockfile: true });

        const state = yield* resolveTurboSchema(tmpDir);
        const report = buildTurboReport(state);

        expect(state.installedVersion).toBe("2.10.14");
        expect(A.map(state.files, (file) => file.file)).toEqual([
          "turbo.json",
          "apps/web/turbo.json",
          "packages/lib/turbo.json",
        ]);
        expect(report.category).toBe("turbo");
        expect(report.status).toBe("drift");
        assertSome(report.latest, "2.10.14");
        expect(A.map(report.items, (item) => [item.file, item.field, item.current, item.expected])).toEqual([
          [
            "turbo.json",
            "$schema",
            "https://v2-10-2.turborepo.dev/schema.json",
            "https://v2-10-14.turborepo.dev/schema.json",
          ],
          [
            "apps/web/turbo.json",
            "$schema",
            "https://turborepo.com/schema.json",
            "https://v2-10-14.turborepo.dev/schema.json",
          ],
          [
            "packages/lib/turbo.json",
            "$schema",
            "https://v2-10-13.turborepo.dev/schema.json",
            "https://v2-10-14.turborepo.dev/schema.json",
          ],
        ]);
      })
    );

    it.effect(
      "falls back to the range-stripped catalog pin when bun.lock has no turbo entry",
      Effect.fn(function* () {
        const fs = yield* FileSystem.FileSystem;
        const tmpDir = yield* fs.makeTempDirectoryScoped();
        yield* writeTurboWorkspace(tmpDir, { lockfile: false });

        const state = yield* resolveTurboSchema(tmpDir);
        const report = buildTurboReport(state);

        expect(state.installedVersion).toBe("2.10.13");
        expect(report.status).toBe("drift");
        expect(A.map(report.items, (item) => item.file)).toEqual(["turbo.json", "apps/web/turbo.json"]);
      })
    );

    it.effect(
      "refuses to synthesize a schema URL for a prerelease turbo version",
      Effect.fn(function* () {
        const report = buildTurboReport(
          TurboSchemaState.make({
            installedVersion: "2.11.0-canary.1",
            files: [
              TurboConfigFile.make({
                file: "turbo.json",
                schemaUrl: "https://v2-10-13.turborepo.dev/schema.json",
                schemaVersion: O.some("2.10.13"),
              }),
            ],
          })
        );

        expect(report.status).toBe("error");
        expect(report.items).toHaveLength(0);
        assertSome(report.error, "Unsupported turbo version specifier: 2.11.0-canary.1");
      })
    );
  });

  describe("UpdateApplierService turbo", () => {
    it.effect(
      "rewrites drifted turbo.json $schema URLs in place and preserves comments",
      Effect.fn(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectoryScoped();
        yield* writeTurboWorkspace(tmpDir, { lockfile: true });

        const report = buildTurboReport(yield* resolveTurboSchema(tmpDir));
        const resolution = VersionSyncResolution.make({
          report: VersionSyncReport.make({ categories: [report], hasDrift: true }),
          nodeLocations: [],
        });
        const updater = yield* UpdateApplierService;
        const applied = yield* updater.apply(tmpDir, resolution);

        expect(applied).toBe(3);

        const rootTurbo = yield* fs.readFileString(path.join(tmpDir, "turbo.json"));
        expect(rootTurbo).toContain("// root pipeline");
        expect(rootTurbo).toContain('"$schema": "https://v2-10-14.turborepo.dev/schema.json"');

        const appTurbo = (yield* decodeUnknownJson(
          yield* fs.readFileString(path.join(tmpDir, "apps", "web", "turbo.json"))
        )) as Record<string, unknown>;
        expect(appTurbo.$schema).toBe("https://v2-10-14.turborepo.dev/schema.json");

        const libTurbo = (yield* decodeUnknownJson(
          yield* fs.readFileString(path.join(tmpDir, "packages", "lib", "turbo.json"))
        )) as Record<string, unknown>;
        expect(libTurbo.$schema).toBe("https://v2-10-14.turborepo.dev/schema.json");

        const bareTurbo = (yield* decodeUnknownJson(
          yield* fs.readFileString(path.join(tmpDir, "packages", "bare", "turbo.json"))
        )) as Record<string, unknown>;
        expect(bareTurbo.$schema).toBeUndefined();

        const rerun = buildTurboReport(yield* resolveTurboSchema(tmpDir));
        expect(rerun.status).toBe("ok");
      })
    );
  });
});

it.layer(VersionSyncTestLayer, { timeout: "30 seconds" })("VersionSync report surface", (it) => {
  const driftItem = VersionDriftItem.make({
    file: "turbo.json",
    field: "$schema",
    current: "https://turborepo.com/schema.json",
    expected: "https://v2-10-14.turborepo.dev/schema.json",
    line: O.none(),
  });

  const allCategories: ReadonlyArray<VersionCategoryReport> = [
    VersionCategoryReport.cases.bun.make({ status: "ok", items: [], latest: O.some("1.4.2"), error: O.none() }),
    VersionCategoryReport.cases.node.make({ status: "unpinned", items: [], latest: O.none(), error: O.none() }),
    VersionCategoryReport.cases.docker.make({
      status: "error",
      items: [],
      latest: O.none(),
      error: O.some("registry unreachable"),
    }),
    VersionCategoryReport.cases.biome.make({ status: "ok", items: [], latest: O.some("2.5.6"), error: O.none() }),
    VersionCategoryReport.cases.effect.make({ status: "ok", items: [], latest: O.none(), error: O.none() }),
    VersionCategoryReport.cases.turbo.make({
      status: "drift",
      items: [driftItem],
      latest: O.some("2.10.14"),
      error: O.none(),
    }),
  ];

  const captureConsole = Effect.fnUntraced(function* <A, E, R>(program: Effect.Effect<A, E, R>) {
    const lines: Array<string> = [];
    const current = yield* Console.Console;
    const recording: Console.Console = {
      ...current,
      log: (...args: ReadonlyArray<unknown>) => {
        lines.push(Str.replace(/^\n+/, "")(A.join(A.map(args, String), " ")));
      },
    };
    yield* program.pipe(Effect.provideService(Console.Console, recording));
    return lines;
  });

  describe("ReportRendererService", () => {
    it.effect(
      "labels every category, prints drift rows as URL pairs, and tailors the footer to the mode",
      Effect.fn(function* () {
        const renderer = yield* ReportRendererService;
        const report = VersionSyncReport.make({ categories: allCategories, hasDrift: true });

        const check = yield* captureConsole(renderer.renderReport(report, "check"));
        expect(check).toContain("Turbo Schema:");
        expect(check).toContain("Bun Runtime:");
        expect(check).toContain("Node.js Runtime:");
        expect(check).toContain("Docker Images:");
        expect(check).toContain("Biome Schema:");
        expect(check).toContain("Effect Catalog:");
        expect(check).toContain(
          "  turbo.json $schema: https://turborepo.com/schema.json -> https://v2-10-14.turborepo.dev/schema.json"
        );
        expect(check).toContain("  Status: DRIFT");
        expect(check).toContain("  Status: UNPINNED");
        expect(check).toContain("  Error: registry unreachable");
        expect(check).toContain("Run `beep version-sync --write` to apply fixes.");

        const dryRun = yield* captureConsole(renderer.renderReport(report, "dry-run"));
        expect(dryRun).toContain("Run `beep version-sync --write` to apply these changes.");

        const write = yield* captureConsole(renderer.renderReport(report, "write"));
        expect(A.some(write, Str.startsWith("Run `beep version-sync"))).toBe(false);

        const clean = yield* captureConsole(
          renderer.renderReport(VersionSyncReport.make({ categories: [allCategories[0]!], hasDrift: false }), "check")
        );
        expect(clean).toContain("  Status: OK (no drift)");
        expect(clean).toContain("All versions are in sync.");
      })
    );
  });

  describe("CategorySelectionService", () => {
    const options = (overrides: Partial<Omit<VersionSyncOptions, "mode">>) =>
      VersionSyncOptions.cases.check.make({ ...overrides });

    it.effect(
      "checks every category without a filter and only the flagged category with one",
      Effect.fn(function* () {
        const selection = yield* CategorySelectionService;

        expect(selection.selectedCategories(options({}))).toEqual([
          "bun",
          "node",
          "docker",
          "biome",
          "effect",
          "turbo",
        ]);
        expect(selection.selectedCategories(options({ turboOnly: true }))).toEqual(["turbo"]);
        expect(selection.selectedCategories(options({ bunOnly: true, biomeOnly: true }))).toEqual(["bun", "biome"]);
        expect(selection.shouldCheck(options({ nodeOnly: true }), "docker")).toBe(false);
        expect(selection.shouldCheck(options({ dockerOnly: true }), "docker")).toBe(true);
        expect(selection.shouldCheck(options({ effectOnly: true }), "effect")).toBe(true);
      })
    );
  });
});

it.layer(VersionSyncTestLayer, { timeout: "30 seconds" })("VersionSync installed tool version", (it) => {
  describe("exactVersionFromSpecifier", () => {
    it("strips range prefixes and stringifies non-string specifiers", () => {
      expect(exactVersionFromSpecifier("^2.10.13")).toBe("2.10.13");
      expect(exactVersionFromSpecifier("~2.5.6")).toBe("2.5.6");
      expect(exactVersionFromSpecifier(">=1.0.0")).toBe("1.0.0");
      expect(exactVersionFromSpecifier(42)).toBe("42");
    });
  });

  describe("resolveInstalledToolVersion", () => {
    it.effect(
      "ignores a lockfile entry that is not a <name>@<version> specifier and falls back to devDependencies",
      Effect.fn(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectoryScoped();

        yield* fs.writeFileString(
          path.join(tmpDir, "package.json"),
          yield* encodeJson({ name: "fixture", devDependencies: { turbo: "~2.10.13" } })
        );
        yield* fs.writeFileString(
          path.join(tmpDir, "bun.lock"),
          yield* encodeJson({ lockfileVersion: 1, packages: { turbo: [{ unexpected: true }, ""] } })
        );

        assertNone(yield* readLockfileResolvedVersion(tmpDir, "turbo"));
        assertNone(yield* readLockfileResolvedVersion(tmpDir, "@biomejs/biome"));
        expect(yield* resolveInstalledToolVersion(tmpDir, "turbo")).toBe("2.10.13");
        expect(yield* resolveInstalledToolVersion(tmpDir, "@biomejs/biome")).toBe("");
      })
    );

    it.effect(
      "reads only the root registry install: workspaces, aliases and nested installs yield None",
      Effect.fn(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectoryScoped();

        yield* fs.writeFileString(
          path.join(tmpDir, "bun.lock"),
          yield* encodeJson({
            lockfileVersion: 1,
            workspaces: { "": { name: "fixture" }, "packages/turbo": { name: "turbo", version: "9.9.9" } },
            packages: {
              turbo: ["turbo@workspace:packages/turbo"],
              "@biomejs/biome": ["@biomejs/cli@2.4.4", "", {}],
              "other/effect": ["effect@4.0.4", "", {}],
              "string-width": ["string-width@5.1.2", "", {}],
            },
          })
        );

        assertNone(yield* readLockfileResolvedVersion(tmpDir, "turbo"));
        assertNone(yield* readLockfileResolvedVersion(tmpDir, "@biomejs/biome"));
        assertNone(yield* readLockfileResolvedVersion(tmpDir, "effect"));
        assertSome(yield* readLockfileResolvedVersion(tmpDir, "string-width"), "5.1.2");
      })
    );

    it.effect(
      "fails with a typed error when bun.lock is not JSONC",
      Effect.fn(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectoryScoped();

        yield* fs.writeFileString(path.join(tmpDir, "bun.lock"), "not json");

        const failure = yield* readLockfileResolvedVersion(tmpDir, "turbo").pipe(Effect.flip);
        expect(failure._tag).toBe("VersionSyncError");
        expect(failure.file).toBe("bun.lock");
      })
    );

    it.effect(
      "fails with a typed error when bun.lock is JSONC the lockfile kit rejects",
      Effect.fn(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectoryScoped();

        // The legacy `packages`-only decode accepted this and found turbo; the
        // kit rejects the unparseable integrity, so the read fails instead of
        // falling back to the catalog.
        yield* fs.writeFileString(
          path.join(tmpDir, "bun.lock"),
          yield* encodeJson({
            lockfileVersion: 1,
            workspaces: { "": { name: "fixture" } },
            packages: { turbo: ["turbo@2.10.14", "", {}, "not-an-integrity"] },
          })
        );

        const failure = yield* readLockfileResolvedVersion(tmpDir, "turbo").pipe(Effect.flip);
        expect(failure._tag).toBe("VersionSyncError");
        expect(failure.file).toBe("bun.lock");
      })
    );
  });

  describe("turbo error paths", () => {
    it("reports an unpinned turbo as a category error naming the lockfile first", () => {
      const report = buildTurboReport(TurboSchemaState.make({}));

      expect(report.status).toBe("ok");
      expect(report.items).toHaveLength(0);
      assertSome(report.error, "turbo not found in bun.lock, the root catalog, or devDependencies");
    });

    it.effect(
      "fails with a typed error when a workspace turbo.json is not JSONC",
      Effect.fn(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectoryScoped();
        const appDir = path.join(tmpDir, "apps", "web");

        yield* fs.makeDirectory(appDir, { recursive: true });
        yield* fs.writeFileString(
          path.join(tmpDir, "package.json"),
          yield* encodeJson({ name: "fixture", workspaces: ["apps/*"], catalog: { turbo: "2.10.13" } })
        );
        yield* fs.writeFileString(path.join(appDir, "package.json"), yield* encodeJson({ name: "@fixture/web" }));
        yield* fs.writeFileString(path.join(appDir, "turbo.json"), "{ not: valid");

        const failure = yield* resolveTurboSchema(tmpDir).pipe(Effect.flip);
        expect(failure._tag).toBe("VersionSyncError");
        expect(failure.file).toBe("apps/web/turbo.json");
      })
    );
  });

  describe("updateJsoncSchemaUrl", () => {
    it.effect(
      "rewrites once and reports no change when the URL is already pinned",
      Effect.fn(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectoryScoped();
        const file = path.join(tmpDir, "turbo.json");
        const url = "https://v2-10-14.turborepo.dev/schema.json";

        yield* fs.writeFileString(file, '{\n  // pinned\n  "$schema": "https://turborepo.com/schema.json"\n}\n');

        expect(yield* updateJsoncSchemaUrl(file, url)).toBe(true);
        expect(yield* updateJsoncSchemaUrl(file, url)).toBe(false);
        expect(yield* fs.readFileString(file)).toContain("// pinned");
      })
    );
  });
});

it.layer(VersionSyncTestLayer, { timeout: "30 seconds" })("VersionSync shared lockfile", (it) => {
  it.effect("parses bun.lock once per resolution run for Biome and Turbo", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped();
      yield* fs.writeFileString(path.join(root, "package.json"), yield* encodeJson({ name: "fixture" }));
      yield* fs.writeFileString(path.join(root, "biome.jsonc"), "{}");
      yield* fs.writeFileString(path.join(root, "turbo.json"), "{}");
      yield* fs.writeFileString(
        path.join(root, "bun.lock"),
        yield* encodeJson({
          lockfileVersion: 1,
          workspaces: { "": { name: "fixture" } },
          packages: {
            turbo: ["turbo@2.10.14", "", {}],
            "@biomejs/biome": ["@biomejs/biome@2.5.6", "", {}],
          },
        })
      );
      const parse = yield* Effect.acquireRelease(
        Effect.sync(() => vi.spyOn(Lockfile, "parse")),
        (spy) => Effect.sync(() => spy.mockRestore())
      );
      const resolver = yield* ResolverService;
      const options = VersionSyncOptions.cases.check.make({ biomeOnly: true, turboOnly: true, skipNetwork: true });
      for (const expectedCalls of [1, 2]) {
        const resolution = yield* resolver.resolve(root, options);
        expect(A.map(resolution.report.categories, (category) => category.category)).toEqual(["biome", "turbo"]);
        deepStrictEqual(
          A.map(resolution.report.categories, (category) => category.latest),
          [O.some("2.5.6"), O.some("2.10.14")]
        );
        expect(parse).toHaveBeenCalledTimes(expectedCalls);
      }
    })
  );
});
