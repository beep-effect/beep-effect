import { TsNativeApi, TsNativeConfig } from "@beep/repo-utils/TsNativeApi";
import { NodeServices } from "@effect/platform-node";
import { expect, layer } from "@effect/vitest";
import {
  isCallExpression,
  isExportDeclaration,
  isExternalModuleReference,
  isIdentifier,
  isImportDeclaration,
  isImportEqualsDeclaration,
  isStringLiteralLikeNode,
  SyntaxKind,
} from "@typescript/native/unstable/ast";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { Node } from "@typescript/native/unstable/ast";

const allowed = "@beep/party-use-cases";
const forbiddenModule = (specifier: string) =>
  Str.startsWith("@beep/party-")(specifier) &&
  specifier !== allowed &&
  !(Str.startsWith(`${allowed}/`)(specifier) && Str.length(specifier) > Str.length(allowed) + 1);
const forbiddenPackage = (name: string) => Str.startsWith("@beep/party-")(name) && name !== allowed;
const dependencies = S.Record(S.String, S.String);
const Manifest = S.Struct({ dependencies: S.optionalKey(dependencies), devDependencies: S.optionalKey(dependencies) });
const forbiddenManifest = (manifest: typeof Manifest.Type) =>
  A.filter([...R.keys(manifest.dependencies ?? {}), ...R.keys(manifest.devDependencies ?? {})], forbiddenPackage);

const moduleSpecifiers = Effect.fn("PartyBoundary.moduleSpecifiers")(function* (source: string) {
  const api = yield* TsNativeApi;
  const parsed = yield* api.parseSource("party-boundary.ts", source);
  const specifiers: Array<string> = [];
  const visit = (node: Node): void => {
    if (
      (isImportDeclaration(node) || isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined &&
      isStringLiteralLikeNode(node.moduleSpecifier)
    )
      specifiers.push(node.moduleSpecifier.text);
    if (
      isImportEqualsDeclaration(node) &&
      isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression !== undefined &&
      isStringLiteralLikeNode(node.moduleReference.expression)
    )
      specifiers.push(node.moduleReference.expression.text);
    if (isCallExpression(node)) {
      const argument = node.arguments[0];
      if (
        (node.expression.kind === SyntaxKind.ImportKeyword ||
          (isIdentifier(node.expression) && node.expression.text === "require")) &&
        argument !== undefined &&
        isStringLiteralLikeNode(argument)
      )
        specifiers.push(argument.text);
    }
    node.forEachChild(visit);
  };
  visit(parsed);
  return specifiers;
}, Effect.scoped);

const decodeManifest = S.decodeEffect(S.fromJsonString(Manifest));

const nativeLayer = TsNativeApi.layer(TsNativeConfig.make({ cwd: process.cwd(), tsconfig: "tsconfig.json" })).pipe(
  Layer.provideMerge(NodeServices.layer)
);

layer(nativeLayer, { timeout: "30 seconds" })("exact law-practice party boundary", (it) => {
  it.effect("accepts the bare port package and nonempty subpaths", () =>
    Effect.gen(function* () {
      const source = `import { ContactSource } from '@beep/party-use-cases';
      export {
        ContactCard
      } from "@beep/party-use-cases/ContactSource";
      void import('@beep/party-use-cases/ContactSource');
      require("@beep/party-use-cases");`;
      const found = yield* moduleSpecifiers(source);
      expect(found).toHaveLength(4);
      expect(A.filter(found, forbiddenModule)).toEqual([]);
    })
  );
  it.effect("finds forbidden syntax despite comments, mixed imports and quote styles", () =>
    Effect.gen(function* () {
      const source = `import { allowed } from "@beep/party-use-cases"; import { forbidden } from '@beep/party-domain';
      // @beep/party-use-cases does not grant an exception.
      export {
        hidden
      } from "@beep/party-use-cases-extra";
      void import('@beep/party-server/Ledger');
      require("@beep/party-domain/Claim");
      import legacy = require('@beep/party-tables');
      import trailing from '@beep/party-use-cases/';
      const text = "@beep/party-domain/not-an-import";
      /* import ignored from '@beep/party-domain/comment'; */`;
      expect(A.filter(yield* moduleSpecifiers(source), forbiddenModule)).toEqual([
        "@beep/party-domain",
        "@beep/party-use-cases-extra",
        "@beep/party-server/Ledger",
        "@beep/party-domain/Claim",
        "@beep/party-tables",
        "@beep/party-use-cases/",
      ]);
    })
  );
  it.effect("checks every source file but excludes test fixtures", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const files = A.filter(yield* fs.readDirectory("src", { recursive: true }), (file) =>
        /\.(?:[cm]?ts|tsx)$/u.test(file)
      );
      expect(files).toContain("PartyContactSource/PartyContactSource.layer.ts");
      const violations = yield* Effect.forEach(files, (file) =>
        Effect.gen(function* () {
          const specifiers = yield* moduleSpecifiers(yield* fs.readFileString(`src/${file}`));
          return A.map(A.filter(specifiers, forbiddenModule), (specifier) => ({ file, specifier }));
        })
      );
      expect(A.flatten(violations)).toEqual([]);
    })
  );
  it.effect("checks both manifest dependency sections with exact package names", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const manifest = yield* decodeManifest(yield* fs.readFileString("package.json"));
      expect(forbiddenManifest(manifest)).toEqual([]);
      for (const section of ["dependencies", "devDependencies"]) {
        expect(forbiddenManifest({ [section]: { "@beep/party-use-cases": "workspace:^" } })).toEqual([]);
        for (const name of [
          "@beep/party-domain",
          "@beep/party-server",
          "@beep/party-use-cases-extra",
          "@beep/party-use-cases/ContactSource",
        ]) {
          expect(forbiddenManifest({ [section]: { [name]: "workspace:^" } })).toEqual([name]);
        }
      }
    })
  );
});
