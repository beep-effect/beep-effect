// The OA codec stays behind its own subpath: no module outside `src/rdf/` reaches `@beep/rdf` in its runtime import
// closure, the package root does not re-export the adapter, and the manifest declares no rdf-only export (decision
// p3-oa-adapter-subpath). A barrel run that adds the adapter to `index.ts` fails here.

import * as AnnotationRoot from "@beep/annotation";
import { it } from "@beep/test-runner";
import * as ImportGraph from "@beep/test-utils/ImportGraph";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Str from "effect/String";
import manifest from "../package.json" with { type: "json" };

declare global {
  interface ImportMeta {
    glob<T>(
      pattern: string,
      options: { readonly query: "?raw"; readonly import: "default"; readonly eager: true }
    ): Readonly<Record<string, T>>;
  }
}

// Every package source module's text, keyed by its path under `src/`. Vite inlines the raw text at transform time,
// so the walk needs no filesystem.
const SOURCES = ImportGraph.fromGlob(
  import.meta.glob<string>("../src/**/*.ts", { query: "?raw", import: "default", eager: true }),
  { prefix: "../src/" }
);

const runtimeClosure = (entry: string) => ImportGraph.closure({ sources: SOURCES, entry });

const sorted = (values: Iterable<string>): ReadonlyArray<string> => A.sort(A.fromIterable(values), Order.String);

const isAdapterModule = Str.startsWith("rdf/");

const isRdfSpecifier = (specifier: string): boolean =>
  specifier === "@beep/rdf" || Str.startsWith("@beep/rdf/")(specifier);

// Every public module outside the adapter subpath and the internals.
const BASE_ENTRIES = A.filter(
  SOURCES.pipe(HashMap.keys, sorted),
  (module) => !isAdapterModule(module) && !Str.startsWith("internal/")(module)
);

describe("@beep/annotation import boundary", () => {
  it.effect("keeps @beep/rdf and the adapter out of every base module's runtime closure", () =>
    Effect.gen(function* () {
      expect(A.contains(BASE_ENTRIES, "index.ts")).toBe(true);
      for (const entry of BASE_ENTRIES) {
        const closure = yield* runtimeClosure(entry);
        expect([entry, A.filter(closure.modules, isAdapterModule)]).toStrictEqual([entry, []]);
        expect([entry, A.filter(closure.packages, isRdfSpecifier)]).toStrictEqual([entry, []]);
      }
    })
  );

  it.effect("sees @beep/rdf in the adapter's own closure", () =>
    Effect.gen(function* () {
      const closure = yield* runtimeClosure("rdf/OaCodec.ts");
      expect(A.some(closure.packages, isRdfSpecifier)).toBe(true);
    })
  );

  it.effect("does not re-export the adapter from the package root", () =>
    Effect.gen(function* () {
      const imports = yield* ImportGraph.moduleImportsOf(SOURCES, "index.ts");
      expect(A.filter(sorted(imports), (module) => Str.includes("rdf/")(module))).toStrictEqual([]);
      const rootExports: ReadonlyArray<string> = R.keys(AnnotationRoot);
      expect(A.filter(rootExports, (name) => A.contains(["encodeOa", "decodeOa", "normalize"], name))).toStrictEqual(
        []
      );
    })
  );

  it("serves the adapter through the wildcard export and declares no rdf-only export", () => {
    const declared = sorted([".", "./*", "./internal/*", "./package.json"]);
    expect(sorted(R.keys(manifest.exports))).toStrictEqual(declared);
    expect(sorted(R.keys(manifest.publishConfig.exports))).toStrictEqual(declared);
    expect(manifest.exports["./*"]).toBe("./src/*.ts");
    expect(manifest.dependencies["@beep/rdf"]).toBe("workspace:^");
  });
});
