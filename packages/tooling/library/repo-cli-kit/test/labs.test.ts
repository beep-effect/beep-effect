import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import {
  decodeLabManifestJson,
  encodeLabManifestJson,
  isLabPostgresSchemaName,
  isLabsWorkspaceDir,
  isLabsWorkspacePath,
  LAB_MANIFEST_FILENAME,
  LABS_PATH_IGNORE_GLOB,
  LABS_TURBO_EXCLUDE_FILTER,
  LABS_TURBO_SELECT_FILTER,
  LABS_WORKSPACE_GLOB,
  LabDisposition,
  RETIRED_REGISTRY_PATH,
  readRetiredPackageNames,
} from "@beep/repo-cli-kit/cli/Labs/index";
import { describe, expect, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { identity } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const json = (value: unknown): string =>
  Result.getOrThrowWith(S.encodeUnknownResult(S.fromJsonString(S.Unknown))(value), identity);
const decodeJson = S.decodeUnknownEffect(S.fromJsonString(S.Unknown));

const manifestJson = (fields: Readonly<Record<string, unknown>>): string =>
  json({ schemaVersion: "lab-manifest/v1", purpose: "Try a thing.", created: "2026-11-01", ...fields });

describe("cli/Labs/LabManifest", () => {
  it.effect("decodes a manifest, keeps an absent schema as None, and round-trips through JSON", () =>
    Effect.gen(function* () {
      const bare = yield* decodeLabManifestJson(manifestJson({ disposition: "active" }));
      expect(bare.disposition).toBe("active");
      assertNone(bare.postgresSchema);

      const withSchema = yield* decodeLabManifestJson(
        manifestJson({ disposition: "promote", postgresSchema: "lab_try_thing" })
      );
      expect(O.getOrNull(withSchema.postgresSchema)).toBe("lab_try_thing");

      const encoded = yield* encodeLabManifestJson(withSchema);
      const resolved1 = yield* decodeJson(encoded);
      expect(resolved1).toEqual({
        schemaVersion: "lab-manifest/v1",
        purpose: "Try a thing.",
        created: "2026-11-01",
        disposition: "promote",
        postgresSchema: "lab_try_thing",
      });
    })
  );

  it.effect("rejects an unknown disposition and a schema outside the lab namespace", () =>
    Effect.gen(function* () {
      const badDisposition = yield* Effect.flip(decodeLabManifestJson(manifestJson({ disposition: "archived" })));
      expect(badDisposition._tag).toBe("SchemaError");
      const badSchema = yield* Effect.flip(
        decodeLabManifestJson(manifestJson({ disposition: "active", postgresSchema: "public" }))
      );
      expect(badSchema._tag).toBe("SchemaError");
    })
  );

  it("names the manifest file, the dispositions, and the lab schema namespace", () => {
    expect(LAB_MANIFEST_FILENAME).toBe("lab.manifest.json");
    expect(LabDisposition.literals).toEqual(["active", "promote", "expired"]);
    expect(isLabPostgresSchemaName("lab_a1")).toBe(true);
    expect(isLabPostgresSchemaName("lab_1a")).toBe(false);
    expect(isLabPostgresSchemaName("labs_a")).toBe(false);
  });
});

describe("cli/Labs/LabsWorkspace", () => {
  it("recognises the labs root and paths below it after normalisation", () => {
    expect(isLabsWorkspacePath("apps/labs")).toBe(true);
    expect(isLabsWorkspacePath("apps/labs/demo/src/index.ts")).toBe(true);
    expect(isLabsWorkspacePath("apps\\labs\\demo")).toBe(true);
    expect(isLabsWorkspacePath("apps/labsx/demo")).toBe(false);
    expect(isLabsWorkspacePath("apps/web")).toBe(false);
  });

  it("brands only directories strictly below the labs root", () => {
    expect(isLabsWorkspaceDir("apps/labs/demo")).toBe(true);
    expect(isLabsWorkspaceDir("apps/labs")).toBe(false);
    expect(isLabsWorkspaceDir("apps/web")).toBe(false);
  });

  it("derives the workspace globs and turbo filters from the labs root", () => {
    expect(LABS_WORKSPACE_GLOB).toBe("apps/labs/*");
    expect(LABS_PATH_IGNORE_GLOB).toBe("apps/labs/**");
    expect(LABS_TURBO_EXCLUDE_FILTER).toBe("--filter=!./apps/labs/**");
    expect(LABS_TURBO_SELECT_FILTER).toBe("--filter=./apps/labs/**");
  });
});

describe("cli/Labs/RetiredPackages", () => {
  it.layer(MemoryFileSystem.layer, { timeout: "10 seconds" })((it) => {
    it.effect("reads no names without a registry and every recorded name otherwise", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const resolved2 = yield* readRetiredPackageNames("/repo");
        expect(HashSet.size(resolved2)).toBe(0);

        yield* fs.makeDirectory("/repo/standards", { recursive: true });
        yield* fs.writeFileString(
          `/repo/${RETIRED_REGISTRY_PATH}`,
          json({
            packages: [
              { name: "@beep/old", rationale: "Folded into @beep/new." },
              { name: "@beep/gone", rationale: "Deleted." },
            ],
          })
        );
        const names = yield* readRetiredPackageNames("/repo");
        expect(HashSet.size(names)).toBe(2);
        expect(HashSet.has(names, "@beep/old")).toBe(true);
        expect(HashSet.has(names, "@beep/gone")).toBe(true);
      })
    );
  });

  it.layer(MemoryFileSystem.layer, { timeout: "10 seconds" })((it) => {
    it.effect("fails on a registry that does not match the schema", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.makeDirectory("/repo/standards", { recursive: true });
        yield* fs.writeFileString(`/repo/${RETIRED_REGISTRY_PATH}`, json({ packages: [{ name: "" }] }));
        const failure = yield* Effect.flip(readRetiredPackageNames("/repo"));
        expect(failure._tag).toBe("SchemaError");
      })
    );
  });
});
