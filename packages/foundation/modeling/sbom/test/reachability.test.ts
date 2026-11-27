import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as R from "effect/Record";
import * as Str from "effect/String";
import manifest from "../package.json" with { type: "json" };
import { edgesOf, packageOf, runtimeClosure, sourceModules, sourceOf } from "./support/sourceGraph.ts";

const RUNTIME_WORKSPACE_PACKAGES = ["@beep/identity", "@beep/schema", "@beep/spdx"];

const MODULES = [
  "IdentityToken.ts",
  "InTotoStatement.ts",
  "NtiaReport.ts",
  "Sbom.ts",
  "SbomDocument.ts",
  "SbomMetadataSource.ts",
  "SigstoreBundle.ts",
  "SlsaProvenance.ts",
  "index.ts",
  "internal/admission.ts",
];

describe("the source walker", () => {
  it("reads every src module", () => {
    assert.deepStrictEqual(sourceModules, A.sort(MODULES, Str.Order));
  });

  it("keeps prose, doc examples, strings and erased edges out of the runtime graph", () => {
    const phantomBlockCommentFixture = A.join(
      [
        "// Prose naming a scope like @sigstore/* and a glob like src/* here.",
        'import { Schema } from "effect";',
        "/** A real doc comment, whose close is the phantom comment's close. */",
        ' * import { Hidden } from "@beep/hidden";',
        'import { License } from "@beep/spdx";',
        'import * as A from "effect/Array";',
        'import "./Sibling.ts";',
        "export const x = [Schema, License, A];",
        "export class ReadError {",
        '  message = `Failed to read package.json from "${this.path}"`;',
        "}",
        'import type { Package } from "@beep/package-json/Package";',
        'export type { Person } from "@beep/package-json/Person";',
        'export { Component, type Contact } from "./SbomDocument.ts";',
      ],
      "\n"
    );
    assert.deepStrictEqual(
      edgesOf(phantomBlockCommentFixture),
      {
        runtime: ["effect", "@beep/spdx", "effect/Array", "./SbomDocument.ts", "./Sibling.ts"],
        typeOnly: ["@beep/package-json/Package", "@beep/package-json/Person"],
      },
      "a /* in a line comment once opened a phantom block comment in a stripper; top-of-line reading stays immune"
    );
  });
});

describe("bundle reachability — the pure SBOM half never reaches network-bound signing", () => {
  it("the root barrel reaches every module and no @sigstore/*, node:* or package-json runtime edge", () => {
    const { modules, packages } = runtimeClosure("index.ts");
    assert.deepStrictEqual(modules, A.sort(MODULES, Str.Order));
    for (const specifier of packages) {
      assert.isFalse(
        Str.startsWith("@sigstore/")(specifier),
        `${specifier} leaks a dependency of the signer, deferred to @beep/sigstore`
      );
      assert.isFalse(Str.startsWith("node:")(specifier), `${specifier} is a Node builtin`);
      assert.notStrictEqual(packageOf(specifier), "@beep/package-json", "package-json is a type-only edge");
    }
  });

  it("the runtime workspace roots are exactly identity, schema and spdx", () => {
    const roots = A.dedupe(A.map(runtimeClosure("index.ts").packages, packageOf));
    assert.deepStrictEqual(
      A.sort(
        A.filter(roots, (root) => root !== "effect"),
        Str.Order
      ),
      RUNTIME_WORKSPACE_PACKAGES
    );
  });

  it("package-json is reached as a type only — the control for the absence above", () => {
    const typeOnly = A.filter(
      edgesOf(sourceOf("SbomMetadataSource.ts")).typeOnly,
      Str.startsWith("@beep/package-json")
    );
    assert.deepStrictEqual(
      A.sort(typeOnly, Str.Order),
      ["@beep/package-json/Package", "@beep/package-json/Person"],
      "the control: without it the absence could mean the walker never saw the edge"
    );
  });

  it("the bundle value and the identity contract reach nothing but effect and identity", () => {
    assert.deepStrictEqual(
      runtimeClosure("SigstoreBundle.ts").packages,
      ["@beep/identity/packages", "effect/Schema"],
      "a verifier that stores or forwards a bundle names its shape without loading the Fulcio transport"
    );
    assert.deepStrictEqual(runtimeClosure("IdentityToken.ts").packages, [
      "@beep/identity/packages",
      "effect/Context",
      "effect/Effect",
      "effect/Layer",
      "effect/Predicate",
      "effect/Redacted",
      "effect/Schema",
    ]);
  });

  it("the SBOM half reaches spdx, the kit packages it derives from and effect", () => {
    for (const entry of ["Sbom.ts", "SbomMetadataSource.ts"]) {
      assert.isTrue(A.contains(runtimeClosure(entry).packages, "@beep/spdx"), `${entry} derives from @beep/spdx`);
    }
    assert.deepStrictEqual(runtimeClosure("Sbom.ts").packages, [
      "@beep/identity/packages",
      "@beep/schema/LiteralKit",
      "@beep/spdx",
      "effect/Array",
      "effect/Effect",
      "effect/FileSystem",
      "effect/Function",
      "effect/Option",
      "effect/Order",
      "effect/Predicate",
      "effect/Record",
      "effect/Result",
      "effect/Schema",
      "effect/String",
    ]);
    assert.deepStrictEqual(runtimeClosure("SbomMetadataSource.ts").packages, [
      "@beep/identity/packages",
      "@beep/schema/LiteralKit",
      "@beep/spdx",
      "effect/Array",
      "effect/Function",
      "effect/Option",
      "effect/Predicate",
      "effect/Record",
      "effect/Schema",
      "effect/String",
    ]);
  });

  it("the statement, provenance and NTIA models reach nothing but effect and the kit", () => {
    assert.deepStrictEqual(
      runtimeClosure("InTotoStatement.ts").packages,
      [
        "@beep/identity/packages",
        "effect/Array",
        "effect/Effect",
        "effect/Function",
        "effect/Result",
        "effect/Schema",
        "effect/String",
      ],
      "this is what lets a verifier depend on the shapes alone"
    );
    assert.deepStrictEqual(runtimeClosure("SlsaProvenance.ts").packages, [
      "@beep/identity/packages",
      "effect/Schema",
      "effect/String",
    ]);
    assert.deepStrictEqual(runtimeClosure("NtiaReport.ts").packages, [
      "@beep/identity/packages",
      "@beep/schema/LiteralKit",
      "effect/Array",
      "effect/Function",
      "effect/Option",
      "effect/Schema",
      "effect/String",
    ]);
  });

  it("no src module names @sigstore/* even as a type", () => {
    for (const module of sourceModules) {
      const { runtime, typeOnly } = edgesOf(sourceOf(module));
      for (const specifier of A.appendAll(runtime, typeOnly)) {
        assert.isFalse(Str.startsWith("@sigstore/")(specifier), `${module} names ${specifier}`);
      }
    }
  });

  it("no src module reads the ambient process", () => {
    const TOP_OF_LINE_COMMENT = /^\s*(?:\/\/|\/\*\*?|\*).*$/gm;
    for (const module of sourceModules) {
      const code = Str.replace(TOP_OF_LINE_COMMENT, "")(sourceOf(module));
      assert.notMatch(
        code,
        /\bprocess\b/,
        `${module} reads the ambient process; an upstream GITHUB_SERVER_URL read wrote a literal undefined`
      );
    }
  });
});

describe("the manifest", () => {
  it("declares the package side-effect free", () => {
    assert.deepStrictEqual(
      manifest.sideEffects,
      [],
      "the walk proves no edge exists; without this a bundler must keep an unreferenced module"
    );
  });

  it("declares every runtime dependency", () => {
    const declared = R.keys(manifest.dependencies);
    for (const specifier of runtimeClosure("index.ts").packages) {
      assert.isTrue(
        A.contains(declared, packageOf(specifier)),
        `${specifier} is imported but not declared, which is how a closure rots`
      );
    }
  });
});
