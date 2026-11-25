import * as EpistemicsRoot from "@beep/epistemics";
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

const SOURCES = ImportGraph.fromGlob(
  import.meta.glob<string>("../src/**/*.ts", { query: "?raw", import: "default", eager: true }),
  { prefix: "../src/" }
);

const ADAPTER = "rdf/NanopubCodec.ts";

const runtimeClosure = (entry: string) => ImportGraph.closure({ sources: SOURCES, entry });

const sorted = (values: Iterable<string>): ReadonlyArray<string> => A.sort(A.fromIterable(values), Order.String);

const isAdapterModule = Str.startsWith("rdf/");

const isRdfSpecifier = (specifier: string): boolean =>
  specifier === "@beep/rdf" || Str.startsWith("@beep/rdf/")(specifier) || Str.includes("/rdf/")(specifier);

const BASE_ENTRIES = A.filter(
  SOURCES.pipe(HashMap.keys, sorted),
  (module) => !isAdapterModule(module) && !Str.startsWith("internal/")(module)
);

describe("@beep/epistemics import boundary", () => {
  it.effect("keeps @beep/rdf and every rdf adapter out of each base entry's runtime closure", () =>
    Effect.gen(function* () {
      expect(A.contains(BASE_ENTRIES, "index.ts")).toBe(true);
      expect(A.filter(SOURCES.pipe(HashMap.keys, sorted), isAdapterModule)).toStrictEqual([ADAPTER]);
      for (const entry of BASE_ENTRIES) {
        const closure = yield* runtimeClosure(entry);
        expect([entry, A.filter(closure.modules, isAdapterModule)]).toStrictEqual([entry, []]);
        expect([entry, A.filter(closure.packages, isRdfSpecifier)]).toStrictEqual([entry, []]);
      }
    })
  );

  it.effect("reaches @beep/rdf only from the nanopublication codec", () =>
    Effect.gen(function* () {
      const closure = yield* runtimeClosure(ADAPTER);
      expect(A.contains(closure.packages, "@beep/rdf/Rdf")).toBe(true);
    })
  );

  it.effect("does not re-export the codec from the package root", () =>
    Effect.gen(function* () {
      const imports = yield* ImportGraph.moduleImportsOf(SOURCES, "index.ts");
      expect(A.filter(sorted(imports), Str.includes("rdf/"))).toStrictEqual([]);
      const rootExports: ReadonlyArray<string> = R.keys(EpistemicsRoot);
      expect(
        A.filter(rootExports, (name) =>
          A.contains(["makeNanopubCodec", "NanopubId", "PublicationMetadata", "nanopubIris"], name)
        )
      ).toStrictEqual([]);
    })
  );

  it("serves the codec through the wildcard export and declares the rdf dependency", () => {
    expect(manifest.exports["./*"]).toBe("./src/*.ts");
    expect(manifest.publishConfig.exports["./*"]).toBe("./dist/*.js");
    expect(A.filter(R.keys(manifest.exports), Str.includes("rdf"))).toStrictEqual([]);
    expect(manifest.dependencies["@beep/rdf"]).toBe("workspace:^");
  });
});
