import { CreatePackageIdentityRegistration } from "@beep/repo-cli/commands/CreatePackage/internal/IdentityRegistration";
import {
  LAB_COMPOSERS_END_MARKER,
  LAB_COMPOSERS_START_MARKER,
  LAB_EXPORTS_END_MARKER,
  LAB_EXPORTS_START_MARKER,
  LabIdentitySegment,
} from "@beep/repo-cli/commands/CreatePackage/internal/LabIdentitySegment";
import { TSMorphServiceLive } from "@beep/repo-utils";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { it } from "@beep/test-runner";
import { provideScopedLayer } from "@beep/test-utils";
import { Str } from "@beep/utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { withTempWorkingDirectory } from "./support/CommandTest.ts";

const encodeJson = flow(S.encodeUnknownResult(S.fromJsonString(S.Unknown)), Result.getOrThrow);

const removalLayer = Layer.mergeAll(
  NodeServices.layer,
  NodeCrypto.layer,
  TSMorphServiceLive.pipe(Layer.provide(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer))),
  FsUtilsLive.pipe(Layer.provide(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer)))
);

const REGISTRY_FIXTURE = A.join(
  [
    'const composers = $I.compose("alpha", "target-pkg", "langextract");',
    LAB_COMPOSERS_START_MARKER,
    'const generatedLabComposers = $I.compose("gamma-lab");',
    LAB_COMPOSERS_END_MARKER,
    'const labComposers = $I.compose("gamma");',
    "export const $AlphaId = composers.$AlphaId;",
    'export const $TargetPkgId: Identity.IdentityComposer<"@beep/target-pkg"> = composers.$TargetPkgId;',
    'export const $LangExtractId: Identity.IdentityComposer<"@beep/langextract"> = composers.$LangextractId;',
    "export const $GammaId = composers.$GammaId;",
    LAB_EXPORTS_START_MARKER,
    'export const $GammaLabId: Identity.IdentityComposer<"@beep/gamma-lab"> = composers.$GammaLabId;',
    LAB_EXPORTS_END_MARKER,
    "const internalNote = buildInternalNote();",
    "export const registryHelpers = buildRegistryHelpers();",
    "",
  ],
  "\n"
);

const withRegistry = <A, E, R>(registry: string, use: Effect.Effect<A, E, R>) =>
  withTempWorkingDirectory(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      yield* fs.writeFileString("bun.lock", "");
      yield* fs.writeFileString("tsconfig.json", '{ "compilerOptions": {} }\n');
      yield* fs.writeFileString("packages.ts", registry);
      return yield* use;
    })
  ).pipe(provideScopedLayer(removalLayer));

const removeFrom = (registry: string, packageName: string) =>
  withRegistry(
    registry,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      yield* CreatePackageIdentityRegistration.removeIdentityPackageRegistration("packages.ts", packageName);
      return yield* fs.readFileString("packages.ts");
    })
  );

const runRemoval = (packageName: string) => removeFrom(REGISTRY_FIXTURE, packageName);

// `$CourtlistenerIdentityId` extends `$CourtlistenerId`, so only whole-token
// matching tells the two registrations apart.
const PREFIX_SIBLING_REGISTRY = A.join(
  [
    'const composers = $I.compose("courtlistener", "courtlistener-identity");',
    'export const $CourtlistenerId: Identity.IdentityComposer<"@beep/courtlistener"> = composers.$CourtlistenerId;',
    'export const $CourtlistenerIdentityId: Identity.IdentityComposer<"@beep/courtlistener-identity"> = composers.$CourtlistenerIdentityId;',
    "",
  ],
  "\n"
);

describe("identity registration removal", () => {
  it.effect("removes the compose slug, typed export, and nothing else", () =>
    Effect.gen(function* () {
      const next = yield* runRemoval("target-pkg");
      expect(Str.includes('"target-pkg"')(next)).toBe(false);
      expect(Str.includes("$TargetPkgId")(next)).toBe(false);
      expect(Str.includes('"alpha"')(next)).toBe(true);
      expect(Str.includes("$AlphaId")(next)).toBe(true);
      expect(Str.includes('"gamma"')(next)).toBe(true);
      expect(Str.includes("$GammaId")(next)).toBe(true);
    })
  );

  it.effect("removes manual casing aliases through their composer initializer", () =>
    Effect.gen(function* () {
      const next = yield* runRemoval("langextract");
      expect(Str.includes('"langextract"')(next)).toBe(false);
      expect(Str.includes("$LangExtractId")(next)).toBe(false);
      expect(Str.includes("$LangextractId")(next)).toBe(false);
      expect(Str.includes("$AlphaId")(next)).toBe(true);
    })
  );

  it.effect("keeps a prefix-sharing sibling export when removing a package", () =>
    Effect.gen(function* () {
      const next = yield* removeFrom(PREFIX_SIBLING_REGISTRY, "courtlistener");
      expect(next).toBe(
        A.join(
          [
            'const composers = $I.compose("courtlistener-identity");',
            'export const $CourtlistenerIdentityId: Identity.IdentityComposer<"@beep/courtlistener-identity"> = composers.$CourtlistenerIdentityId;',
            "",
          ],
          "\n"
        )
      );
    })
  );

  it.effect("needs a registration when only a prefix-sharing sibling export exists", () =>
    Effect.gen(function* () {
      const courtlistenerNeeded = CreatePackageIdentityRegistration.identityPackageRegistrationNeeded(
        ".",
        "packages.ts",
        "courtlistener"
      );
      const siblingOnly = A.join(
        [
          'const composers = $I.compose("courtlistener", "courtlistener-identity");',
          "export const $CourtlistenerIdentityId = composers.$CourtlistenerIdentityId;",
          "",
        ],
        "\n"
      );
      expect(yield* withRegistry(siblingOnly, courtlistenerNeeded)).toBe(true);
      expect(yield* withRegistry(PREFIX_SIBLING_REGISTRY, courtlistenerNeeded)).toBe(false);
    })
  );

  it.effect("leaves the registry untouched when the slug is absent", () =>
    Effect.gen(function* () {
      const next = yield* runRemoval("missing-slug");
      expect(Str.includes('"alpha"')(next)).toBe(true);
      expect(Str.includes('"target-pkg"')(next)).toBe(true);
      expect(Str.includes("$LangExtractId")(next)).toBe(true);
      expect(Str.includes("$GammaId")(next)).toBe(true);
    })
  );

  it("reads composer slugs across every compose group including the labs group", () => {
    expect(CreatePackageIdentityRegistration.registeredIdentityComposerSlugs(REGISTRY_FIXTURE)).toEqual([
      "alpha",
      "gamma",
      "gamma-lab",
      "langextract",
      "target-pkg",
    ]);
  });

  it("reads export slugs including manual casing aliases and labs exports", () => {
    expect(CreatePackageIdentityRegistration.registeredIdentityExportSlugs(REGISTRY_FIXTURE)).toEqual([
      "alpha",
      "gamma",
      "gamma-lab",
      "langextract",
      "target-pkg",
    ]);
  });

  it.effect("removes a lab registration through the every-compose-group path, keeping the markers", () =>
    Effect.gen(function* () {
      const next = yield* runRemoval("gamma-lab");
      expect(Str.includes('"gamma-lab"')(next)).toBe(false);
      expect(Str.includes("$GammaLabId")(next)).toBe(false);
      expect(Str.includes(LAB_COMPOSERS_START_MARKER)(next)).toBe(true);
      expect(Str.includes(LAB_COMPOSERS_END_MARKER)(next)).toBe(true);
      expect(Str.includes(LAB_EXPORTS_START_MARKER)(next)).toBe(true);
      expect(Str.includes(LAB_EXPORTS_END_MARKER)(next)).toBe(true);
      expect(Str.includes('"gamma"')(next)).toBe(true);
      expect(Str.includes("$GammaId")(next)).toBe(true);
    })
  );

  it.layer(removalLayer, { timeout: "30 seconds" })((it) => {
    it.effect("regenerates the empty labs state after the last lab is gone from the catalog", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped();
        yield* fs.writeFileString(path.join(root, "bun.lock"), "");
        yield* fs.writeFileString(
          path.join(root, "package.json"),
          `${encodeJson({
            name: "fixture-root",
            private: true,
            type: "module",
            workspaces: ["packages/*", "apps/labs/*"],
          })}\n`
        );
        yield* fs.makeDirectory(path.join(root, "packages", "identity", "src"), { recursive: true });
        yield* fs.writeFileString(
          path.join(root, "packages", "identity", "package.json"),
          `${encodeJson({ name: "@beep/identity", version: "0.0.0", type: "module" })}\n`
        );
        yield* fs.writeFileString(path.join(root, "packages", "identity", "src", "packages.ts"), REGISTRY_FIXTURE);

        const result = yield* LabIdentitySegment.syncLabIdentitySegment(root);
        const next = yield* fs.readFileString(path.join(root, "packages", "identity", "src", "packages.ts"));

        expect(result.changed).toBe(true);
        expect(result.state.expectedSlugs).toEqual([]);
        expect(Str.includes("const generatedLabComposers = {};")(next)).toBe(true);
        expect(Str.includes('"gamma-lab"')(next)).toBe(false);
        expect(Str.includes("$GammaLabId")(next)).toBe(false);
        expect(Str.includes(LAB_COMPOSERS_START_MARKER)(next)).toBe(true);
        expect(Str.includes(LAB_EXPORTS_END_MARKER)(next)).toBe(true);
      })
    );
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

  it.layer(removalLayer, { timeout: "30 seconds" })((it) => {
    it.effect("fails to resolve the registry path when no identity workspace exists", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped();
        yield* fs.writeFileString(path.join(root, "bun.lock"), "");
        yield* fs.writeFileString(
          path.join(root, "package.json"),
          '{ "name": "fixture", "private": true, "workspaces": [] }\n'
        );

        const exit = yield* Effect.exit(CreatePackageIdentityRegistration.resolveIdentityPackagesFilePath(root));
        expect(exit._tag).toBe("Failure");
      })
    );
  });
});
