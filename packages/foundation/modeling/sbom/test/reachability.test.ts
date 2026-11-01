// The confinement invariant, as a test rather than a promise.
//
// Emitting an SBOM is pure computation over a manifest; signing is
// network-bound cryptography against Fulcio and Rekor. This package is the
// first half only: the Sigstore signer is deferred as `@beep/sigstore`, so
// no module here may reach `@sigstore/*`, a `node:*`
// builtin, or the runtime half of `@beep/package-json`.
//
// The claim is checked structurally, by walking the RUNTIME import graph of
// `src` from Vite-inlined source text (`test/support/sourceGraph.ts`). What
// this does not prove is that a downstream bundler drops an unreferenced
// module; that rests on `"sideEffects": []` (asserted below) plus module-per-
// file output. What it does prove is the part this package controls: no edge
// exists.

import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as R from "effect/Record";
import * as Str from "effect/String";
import manifest from "../package.json" with { type: "json" };
import { edgesOf, packageOf, runtimeClosure, sourceModules, sourceOf } from "./support/sourceGraph.ts";

/** The workspace packages the runtime closure may reach, besides `effect`. */
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
    // The parser's own regression fixture, self-contained so it cannot be
    // reworded away. A `/*` inside a LINE comment once opened a phantom block
    // comment in a stripper and hid every import after it; this walker reads
    // only top-of-line statements, so the fixture pins that it stays immune.
    const fixture = A.join(
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
    assert.deepStrictEqual(edgesOf(fixture), {
      runtime: ["effect", "@beep/spdx", "effect/Array", "./SbomDocument.ts", "./Sibling.ts"],
      typeOnly: ["@beep/package-json/Package", "@beep/package-json/Person"],
    });
  });
});

describe("bundle reachability", () => {
  it("the root barrel reaches every module and no @sigstore/*, node:* or package-json runtime edge", () => {
    const { modules, packages } = runtimeClosure("index.ts");
    assert.deepStrictEqual(modules, A.sort(MODULES, Str.Order));
    for (const specifier of packages) {
      assert.isFalse(Str.startsWith("@sigstore/")(specifier), `${specifier} leaks the signer's dependency`);
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
    // Without this control the absence could mean the walker never saw the
    // edge. `SbomMetadataSource` names `Package` and `Person` through leaves.
    const typeOnly = A.filter(
      edgesOf(sourceOf("SbomMetadataSource.ts")).typeOnly,
      Str.startsWith("@beep/package-json")
    );
    assert.deepStrictEqual(A.sort(typeOnly, Str.Order), ["@beep/package-json/Package", "@beep/package-json/Person"]);
  });

  it("the bundle value and the identity contract reach nothing but effect and identity", () => {
    // `SigstoreBundle` and `IdentityToken` are their own modules precisely so a
    // verifier, or anything that stores or forwards a bundle, can name the shape
    // without loading Fulcio's transport.
    assert.deepStrictEqual(runtimeClosure("SigstoreBundle.ts").packages, ["@beep/identity/packages", "effect/Schema"]);
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
    // This is what lets a VERIFIER depend on the shapes alone.
    assert.deepStrictEqual(runtimeClosure("InTotoStatement.ts").packages, [
      "@beep/identity/packages",
      "effect/Array",
      "effect/Effect",
      "effect/Function",
      "effect/Result",
      "effect/Schema",
      "effect/String",
    ]);
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
    // `SlsaProvenance` takes `serverUrl` as a field because upstream's
    // `process.env.GITHUB_SERVER_URL` read wrote the literal `undefined` into
    // every URL when the variable was unset. Comments may name `process`;
    // code may not, so only top-of-line comment and doc lines are dropped.
    const COMMENT_LINE = /^\s*(?:\/\/|\/\*\*?|\*).*$/gm;
    for (const module of sourceModules) {
      const code = Str.replace(COMMENT_LINE, "")(sourceOf(module));
      assert.notMatch(code, /\bprocess\b/, `${module} reads the ambient process`);
    }
  });
});

describe("the manifest", () => {
  it("declares the package side-effect free", () => {
    // The other half of the mechanism: without it a bundler must assume
    // evaluating an unreferenced module matters, and keeps it.
    assert.deepStrictEqual(manifest.sideEffects, []);
  });

  it("declares every runtime dependency", () => {
    // A package you import but do not declare is how a closure rots.
    const declared = R.keys(manifest.dependencies);
    for (const specifier of runtimeClosure("index.ts").packages) {
      assert.isTrue(A.contains(declared, packageOf(specifier)), `${specifier} is imported but not declared`);
    }
  });
});
