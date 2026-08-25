import { CodegenKit, GenerateConfig } from "@beep/codegen-kit";
import * as BunServices from "@effect/platform-bun/BunServices";
import { expect, layer } from "@effect/vitest";
import { Effect, FileSystem, Layer, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { FetchHttpClient } from "effect/unstable/http";

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

const packageRoot = `${import.meta.dirname}/..`;
const generatedHeader = `/**
 * Generated from the checked-in GovInfo OpenAPI document.
 *
 * This package-private module is a drift oracle for the hand-written GovInfo
 * contracts. Do not import it from package source or edit it by hand.
 *
 * @packageDocumentation
 * @since 0.0.0
 */`;
const platform = Layer.merge(BunServices.layer, FetchHttpClient.layer);
const generatorLayer = Layer.merge(platform, CodegenKit.layer().pipe(Layer.provide(platform)));
const generateConfig = GenerateConfig.make({
  packageName: "@beep/govinfo",
  name: "GovinfoApi",
  identity: { composer: "$GovinfoId", moduleId: "_generated/Govinfo.gen" },
  source: {
    _tag: "url",
    url: "https://api.govinfo.gov/api-docs",
    pin: "2.0",
    cachePath: `${packageRoot}/openapi.json`,
  },
  dialect: "openapi-3.0",
  format: "httpapi",
  output: { path: `${packageRoot}/src/_generated/Govinfo.gen.ts`, header: generatedHeader },
});

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

layer(generatorLayer)("GovInfo generated drift oracle", (it) => {
  it.effect("is current and retains every operation without unsafe number or never schemas", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const kit = yield* CodegenKit;
      yield* kit.run(generateConfig, "check");
      const source = yield* fs.readFileString(generateConfig.output.path);

      expect(operationIdentifiers(source)).toStrictEqual(EXPECTED_OPERATION_IDENTIFIERS);
      expect(pipe(source, Str.includes("S.Number("))).toBe(false);
      expect(pipe(source, Str.includes("S.Never"))).toBe(false);
      expect(source).toContain("export class GovinfoApi extends HttpApi.make");
    })
  );
});
