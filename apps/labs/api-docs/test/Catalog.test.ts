import { it } from "@beep/test-runner";
import * as BunServices from "@effect/platform-bun/BunServices";
import { describe, expect } from "@effect/vitest";
import { Effect, FileSystem, HashSet } from "effect";
import * as A from "effect/Array";
import { OpenApi } from "effect/http-api";
import { Catalog, resolveCatalogSpecPath } from "@/Catalog";
import { CatalogSource } from "@/Catalog.models";

const isContractSource = CatalogSource.$is("ContractSource");
const isSpecSource = CatalogSource.$is("SpecSource");

const sources = A.map(Catalog, (entry) => entry.source);
const contractSources = A.filter(sources, isContractSource);
const specSources = A.filter(sources, isSpecSource);

const verifySpecFilesExist = Effect.fn("ApiDocs.test.verifySpecFilesExist")(function* () {
  const fs = yield* FileSystem.FileSystem;
  yield* Effect.forEach(
    specSources,
    (source) =>
      resolveCatalogSpecPath(source.specPath).pipe(
        Effect.flatMap(fs.exists),
        Effect.map((exists) => expect(exists, source.specPath).toBe(true))
      ),
    { concurrency: "unbounded" }
  );
});

describe("API docs catalog", () => {
  it("contains nine entries with unique slugs", () => {
    const slugs = A.map(Catalog, (entry) => entry.meta.slug);

    expect(A.length(Catalog)).toBe(9);
    expect(HashSet.size(HashSet.fromIterable(slugs))).toBe(A.length(slugs));
  });

  it.layer(BunServices.layer, { timeout: "10 seconds" })("committed spec files", (it) => {
    it.effect("references committed spec files that exist", verifySpecFilesExist);
  });

  it("generates OpenAPI for all four contract entries", () => {
    expect(A.length(contractSources)).toBe(4);
    A.forEach(contractSources, (source) => {
      source.withApi((api) => expect(() => OpenApi.fromApi(api)).not.toThrow());
    });
  });
});
