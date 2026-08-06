import {
  BunVersionState,
  buildBunReport,
  buildEffectReport,
  buildNodeReport,
  resolveEffectCatalog,
  resolveNodeVersions,
  updateCatalogEntry,
} from "@beep/repo-cli/test/VersionSync";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const encodeJson = S.encodeUnknownSync(S.fromJsonString(S.Unknown));

layer(NodeServices.layer)("VersionSync Effect Catalog", (it) => {
  describe("resolveEffectCatalog", () => {
    it.effect(
      "detects drift for lockstep Effect packages while ignoring non-lockstep Effect tools",
      Effect.fn(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectory();
        const packageJsonPath = path.join(tmpDir, "package.json");

        yield* fs.writeFileString(
          packageJsonPath,
          `${encodeJson({
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
        expect(O.isSome(report.latest)).toBe(true);
        if (O.isSome(report.latest)) {
          expect(report.latest.value).toBe("^4.0.0-beta.28");
        }
        expect(report.items).toHaveLength(2);
        expect(A.map(report.items, (item) => item.field)).toEqual([
          "catalog.@effect/opentelemetry",
          "catalog.@effect/vitest",
        ]);
        expect(A.map(report.items, (item) => item.expected)).toEqual(["^4.0.0-beta.28", "^4.0.0-beta.28"]);

        yield* fs.remove(tmpDir, { recursive: true });
      })
    );

    it.effect(
      "parses package.json JSONC with comments and trailing commas through the shared schema module",
      Effect.fn(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectory();
        const packageJsonPath = path.join(tmpDir, "package.json");

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

        const state = yield* resolveEffectCatalog(tmpDir);
        const report = buildEffectReport(state);

        expect(report.status).toBe("drift");
        expect(report.items).toHaveLength(1);
        expect(report.items[0]?.field).toBe("catalog.@effect/opentelemetry");
        expect(report.items[0]?.expected).toBe("^4.0.0-beta.28");

        yield* fs.remove(tmpDir, { recursive: true });
      })
    );
  });

  describe("updateCatalogEntry", () => {
    it.effect(
      "rewrites a root package.json catalog entry in place",
      Effect.fn(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectory();
        const packageJsonPath = path.join(tmpDir, "package.json");

        yield* fs.writeFileString(
          packageJsonPath,
          `${encodeJson({
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
        const decodedUpdated = (yield* S.decodeUnknownEffect(S.fromJsonString(S.Unknown))(updated)) as {
          readonly catalog: Record<string, string>;
        };

        expect(changed).toBe(true);
        expect(decodedUpdated.catalog["@effect/opentelemetry"]).toBe("^4.0.0-beta.28");
        expect(decodedUpdated.catalog.effect).toBe("^4.0.0-beta.28");

        yield* fs.remove(tmpDir, { recursive: true });
      })
    );
  });

  describe("resolveNodeVersions", () => {
    it.effect(
      "parses GitHub workflow YAML through the shared schema codec after extraction to @beep/schema",
      Effect.fn(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectory();
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

        yield* fs.remove(tmpDir, { recursive: true });
      })
    );
  });

  describe("buildBunReport", () => {
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
  });
});
