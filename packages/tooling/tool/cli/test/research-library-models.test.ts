import {
  LibraryArtifact,
  LibraryCatalog,
  LibraryDerivation,
  LibrarySource,
  resolveLibraryRoot,
} from "@beep/repo-cli/commands/Research";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const source = {
  id: "source",
  kind: "web",
  canonicalUrl: "https://example.com",
  identity: "example",
  revision: "",
  repository: "",
  ownership: "external",
  locators: ["https://example.com"],
};
const artifact = {
  path: "objects/file",
  sha256: Str.repeat(64)("a"),
  bytes: 1,
  mediaType: "text/plain",
  role: "original",
};
const legacyCatalog = {
  schema: "beep.research.library/v1",
  documents: [],
  sources: [source],
  artifacts: [artifact],
  occurrences: [],
  captures: [],
  qualifications: [],
};

describe("research library models", () => {
  it.effect(
    "decodes v1 catalog JSON with public visibility and empty provenance collections",
    Effect.fnUntraced(function* () {
      const json = yield* S.encodeEffect(S.fromJsonString(S.Unknown))(legacyCatalog);
      const catalog = yield* S.decodeEffect(S.fromJsonString(LibraryCatalog))(json);
      expect(catalog).toBeInstanceOf(LibraryCatalog);
      expect(catalog.schema).toBe("beep.research.library/v1");
      expect(catalog.sources[0]).toBeInstanceOf(LibrarySource);
      expect(catalog.artifacts[0]).toBeInstanceOf(LibraryArtifact);
      expect(catalog.sources[0]?.accessClass).toBe("public");
      expect(catalog.artifacts[0]?.accessClass).toBe("public");
      expect(catalog.findings).toEqual([]);
      expect(catalog.derivations).toEqual([]);
      expect(catalog.modelRuns).toEqual([]);
    })
  );
  it.effect(
    "decodes the v2 catalog tag",
    Effect.fnUntraced(function* () {
      const catalog = yield* S.decodeUnknownEffect(LibraryCatalog)({
        ...legacyCatalog,
        schema: "beep.research.library/v2",
      });
      expect(catalog.schema).toBe("beep.research.library/v2");
    })
  );
  it.effect(
    "rejects negative derivation depth",
    Effect.fnUntraced(function* () {
      const value = {
        id: "edge",
        derivedId: "derived",
        sourceId: "source",
        intakeId: "2026-10-06",
        hopDepth: -1,
        recordedAt: "2026-11-06",
      };
      const rejected = yield* S.decodeEffect(LibraryDerivation)(value).pipe(Effect.isFailure);
      expect(rejected).toBe(true);
      const valid = yield* S.decodeEffect(LibraryDerivation)({ ...value, hopDepth: 0 });
      expect(valid.hopDepth).toBe(0);
    })
  );
});

const resolve = (flag: O.Option<string>, env: Readonly<Record<string, string>>) =>
  resolveLibraryRoot(flag).pipe(Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env)));

it.layer(Path.layer)("research library root resolution", (it) => {
  it.effect(
    "prefers an explicit flag without requiring HOME",
    Effect.fnUntraced(function* () {
      const resolved = yield* resolve(O.some("/flag"), {
        BEEP_RESEARCH_LIBRARY: "/configured",
        XDG_DATA_HOME: "/data",
      });
      expect(resolved).toBe("/flag");
    })
  );
  it.effect(
    "prefers BEEP_RESEARCH_LIBRARY over XDG without requiring HOME",
    Effect.fnUntraced(function* () {
      const resolved = yield* resolve(O.none(), { BEEP_RESEARCH_LIBRARY: "/configured", XDG_DATA_HOME: "/data" });
      expect(resolved).toBe("/configured");
    })
  );
  it.effect(
    "uses XDG_DATA_HOME before HOME",
    Effect.fnUntraced(function* () {
      const resolved = yield* resolve(O.none(), { XDG_DATA_HOME: "/data", HOME: "/user" });
      expect(resolved).toBe("/data/beep/research-library");
    })
  );
  it.effect(
    "falls back to the user's local data directory",
    Effect.fnUntraced(function* () {
      const resolved = yield* resolve(O.none(), { HOME: "/user" });
      expect(resolved).toBe("/user/.local/share/beep/research-library");
    })
  );
});
