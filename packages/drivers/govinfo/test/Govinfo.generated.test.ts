import * as OpenApiGenerator from "@effect/openapi-generator/OpenApiGenerator";
import * as BunServices from "@effect/platform-bun/BunServices";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { generateGovinfoSource } from "../scripts/generate.ts";

const EXPECTED_OPERATION_IDENTIFIERS = [
  "search",
  "relatedPackageDetails",
  "relatedVersionsDetails",
  "getPackagesByDateIssued",
  "getPackagesByDateIssued_1",
  "packageDetails",
  "getGranulesForPackage",
  "getGranuleContentDetail",
  "getCollectionSummary",
  "getModifiedCollections",
  "getModifiedCollections_1",
];

const generatorLayer = Layer.mergeAll(BunServices.layer, OpenApiGenerator.layerTransformerSchema);

const operationIdentifiers = (source: string): ReadonlyArray<string> =>
  pipe(
    source,
    Str.matchAll(/\.annotate\(OpenApi\.Identifier,\s*"([^"]+)"\)/gu),
    A.fromIterable,
    A.map((match) =>
      pipe(
        O.fromUndefinedOr(match[1]),
        O.getOrElse(() => Str.empty)
      )
    ),
    A.filter(Str.isNonEmpty)
  );

describe("GovInfo generated drift oracle", () => {
  it.effect("generates all operations without unsafe number or never schemas", () =>
    Effect.scoped(
      Layer.build(generatorLayer).pipe(
        Effect.flatMap((context) => generateGovinfoSource().pipe(Effect.provide(context))),
        Effect.tap((source) =>
          Effect.sync(() => {
            expect(operationIdentifiers(source)).toStrictEqual(EXPECTED_OPERATION_IDENTIFIERS);
            expect(pipe(source, Str.includes("Schema.Number("))).toBe(false);
            expect(pipe(source, Str.includes("Schema.Never"))).toBe(false);
          })
        )
      )
    )
  );
});
