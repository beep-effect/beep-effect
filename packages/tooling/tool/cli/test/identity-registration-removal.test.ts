import { CreatePackageIdentityRegistration } from "@beep/repo-cli/commands/CreatePackage/internal/IdentityRegistration";
import { TSMorphServiceLive } from "@beep/repo-utils";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { provideScopedLayer } from "@beep/test-utils";
import { Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { withTempWorkingDirectory } from "./support/CommandTest.ts";

const removalLayer = Layer.mergeAll(
  NodeServices.layer,
  TSMorphServiceLive.pipe(Layer.provide(NodeServices.layer)),
  FsUtilsLive.pipe(Layer.provide(NodeServices.layer))
);

const REGISTRY_FIXTURE = [
  'const composers = $I.compose("alpha", "target-pkg", "langextract");',
  'const labComposers = $I.compose("gamma");',
  "export const $AlphaId = composers.$AlphaId;",
  'export const $TargetPkgId: Identity.IdentityComposer<"@beep/target-pkg"> = composers.$TargetPkgId;',
  'export const $LangExtractId: Identity.IdentityComposer<"@beep/langextract"> = composers.$LangextractId;',
  "export const $GammaId = composers.$GammaId;",
  "const internalNote = buildInternalNote();",
  "export const registryHelpers = buildRegistryHelpers();",
  "",
].join("\n");

const runRemoval = (packageName: string) =>
  withTempWorkingDirectory(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      yield* fs.writeFileString("bun.lock", "");
      yield* fs.writeFileString("tsconfig.json", '{ "compilerOptions": {} }\n');
      yield* fs.writeFileString("packages.ts", REGISTRY_FIXTURE);
      yield* CreatePackageIdentityRegistration.removeIdentityPackageRegistration("packages.ts", packageName);
      return yield* fs.readFileString("packages.ts");
    })
  ).pipe(provideScopedLayer(removalLayer));

describe("identity registration removal", () => {
  it("removes the compose slug, typed export, and nothing else", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const next = yield* runRemoval("target-pkg");
        expect(Str.includes('"target-pkg"')(next)).toBe(false);
        expect(Str.includes("$TargetPkgId")(next)).toBe(false);
        expect(Str.includes('"alpha"')(next)).toBe(true);
        expect(Str.includes("$AlphaId")(next)).toBe(true);
        expect(Str.includes('"gamma"')(next)).toBe(true);
        expect(Str.includes("$GammaId")(next)).toBe(true);
      })
    ));

  it("removes manual casing aliases through their composer initializer", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const next = yield* runRemoval("langextract");
        expect(Str.includes('"langextract"')(next)).toBe(false);
        expect(Str.includes("$LangExtractId")(next)).toBe(false);
        expect(Str.includes("$LangextractId")(next)).toBe(false);
        expect(Str.includes("$AlphaId")(next)).toBe(true);
      })
    ));

  it("leaves the registry untouched when the slug is absent", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const next = yield* runRemoval("missing-slug");
        expect(Str.includes('"alpha"')(next)).toBe(true);
        expect(Str.includes('"target-pkg"')(next)).toBe(true);
        expect(Str.includes("$LangExtractId")(next)).toBe(true);
        expect(Str.includes("$GammaId")(next)).toBe(true);
      })
    ));

  it("reads composer slugs across every compose group", () => {
    expect(CreatePackageIdentityRegistration.registeredIdentityComposerSlugs(REGISTRY_FIXTURE)).toEqual([
      "alpha",
      "gamma",
      "langextract",
      "target-pkg",
    ]);
  });

  it("reads export slugs including manual casing aliases", () => {
    expect(CreatePackageIdentityRegistration.registeredIdentityExportSlugs(REGISTRY_FIXTURE)).toEqual([
      "alpha",
      "gamma",
      "langextract",
      "target-pkg",
    ]);
  });

  it("filters slugs missing a compose segment or dedicated export", () => {
    expect(
      CreatePackageIdentityRegistration.missingIdentityRegistrations(REGISTRY_FIXTURE, ["alpha", "ghost"])
    ).toEqual(["ghost"]);
  });

  it("matches dedicated exports case-insensitively through the accessor pattern", () => {
    const pattern = CreatePackageIdentityRegistration.accessorExportPattern("langextract");
    expect(pattern.test("export const $LangExtractId")).toBe(true);
    expect(pattern.test("export const $OtherId")).toBe(false);
  });

  it("fails to resolve the registry path when no identity workspace exists", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* fs.writeFileString("bun.lock", "");
          yield* fs.writeFileString("package.json", '{ "name": "fixture", "private": true, "workspaces": [] }\n');

          const exit = yield* Effect.exit(CreatePackageIdentityRegistration.resolveIdentityPackagesFilePath("."));
          expect(exit._tag).toBe("Failure");
        })
      ).pipe(provideScopedLayer(removalLayer))
    ));
});
