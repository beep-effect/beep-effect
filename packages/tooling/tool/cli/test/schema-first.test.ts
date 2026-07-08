import {
  detectInterfaceReason,
  detectTypeAliasReason,
  fnSchemaEntryFromFunctionLike,
  getsomesStructEntryFromCallExpression,
  isSchemaCrispeningPolicyExempt,
  normalizationEntryFromCallExpression,
  nullReturnEntryFromFunctionLike,
  SchemaCrispeningPolicyDocument,
  SchemaFirstInventoryEntry,
  schemaCrispeningFamilyForFile,
  sourceTextHasSchemaArbitraryPropertyCoverage,
} from "@beep/repo-cli/commands/Lint";
import {
  createFileGenerationPlanService,
  FileGenerationPlanInput,
  GenerationAction,
  PlannedFile,
  PlannedSymlink,
} from "@beep/repo-cli/test/CreatePackage";
import { VersionSyncOptions } from "@beep/repo-cli/test/VersionSync";
import { isExcludedTypeScriptSourcePath } from "@beep/repo-utils/schemas/TypeScriptSourceExclusions";
import { A } from "@beep/utils";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { parse } from "jsonc-parser";
import { Project, SyntaxKind } from "ts-morph";
import { describe, expect, it } from "vitest";

// Top-level read keeps the on-disk policy binding synchronous inside the test
// body (the tests-tsgo lane rejects async test closures).
const committedPolicyText = await Bun.file(
  new URL("../../../../../standards/schema-crispening.policy.jsonc", import.meta.url)
).text();

describe("packages/tooling/tool/cli schema-first models", () => {
  it("applies decoding defaults for FileGenerationPlanInput.symlinks", () => {
    const decoded = S.decodeUnknownSync(FileGenerationPlanInput)({
      outputDir: "/tmp/demo",
      directories: ["src"],
      files: [{ relativePath: "src/index.ts", content: "export {};\n" }],
    });

    expect(decoded.symlinks).toEqual([]);
  });

  it("uses tagged-union helpers for GenerationAction", () => {
    const action = GenerationAction.cases["write-file"].make({
      relativePath: "src/index.ts",
      content: "export const x = 1;\n",
    });

    const summary = GenerationAction.match(action, {
      mkdir: ({ relativePath }) => `mkdir:${relativePath}`,
      "write-file": ({ relativePath }) => `write:${relativePath}`,
      symlink: ({ relativePath, target }) => `symlink:${relativePath}->${target}`,
    });

    expect(summary).toBe("write:src/index.ts");
  });

  it("creates deterministic plans via schema-backed input", () => {
    const service = createFileGenerationPlanService();
    const plan = service.createPlan(
      FileGenerationPlanInput.make({
        outputDir: "/tmp/demo",
        directories: ["src", "docs", "src"],
        files: [
          PlannedFile.make({ relativePath: "src/index.ts", content: "export {};\n" }),
          PlannedFile.make({ relativePath: "docs/index.md", content: "# docs\n" }),
        ],
        symlinks: [PlannedSymlink.make({ relativePath: "CLAUDE.md", target: "AGENTS.md" })],
      })
    );

    const preview = service.previewPlan(plan);

    expect(preview).toContain("write docs/index.md");
    expect(preview).toContain("write src/index.ts");
    expect(preview).toContain("symlink CLAUDE.md -> AGENTS.md");
  });

  it("exposes toTaggedUnion helpers for VersionSyncOptions", () => {
    const option = VersionSyncOptions.cases["dry-run"].make({
      skipNetwork: true,
      bunOnly: false,
      nodeOnly: false,
      dockerOnly: false,
      biomeOnly: false,
      effectOnly: false,
    });

    const modeLabel = VersionSyncOptions.match(option, {
      check: () => "check",
      write: () => "write",
      "dry-run": () => "dry-run",
    });

    expect(modeLabel).toBe("dry-run");
  });

  it("excludes generated docs examples from source-law scans", () => {
    expect(
      isExcludedTypeScriptSourcePath("packages/foundation/modeling/schema/docs/examples/src-Yaml.ts-example.ts")
    ).toBe(true);
    expect(isExcludedTypeScriptSourcePath("packages/foundation/modeling/schema/src/Yaml.ts")).toBe(false);
  });

  it("recognizes repo-owned schema arbitrary helpers as schema-derived property coverage", () => {
    expect(
      sourceTextHasSchemaArbitraryPropertyCoverage(
        [
          'import * as S from "effect/Schema";',
          'import { assertSchemaArbitraryDecodesToSelf } from "@beep/test-utils";',
          "const Worker = S.Struct({ id: S.String, retryCount: S.Int });",
          "assertSchemaArbitraryDecodesToSelf(Worker);",
        ].join("\n")
      )
    ).toBe(true);
    expect(
      sourceTextHasSchemaArbitraryPropertyCoverage("fc.property(fc.string(), (value) => value.length >= 0);")
    ).toBe(false);
    expect(
      sourceTextHasSchemaArbitraryPropertyCoverage(
        [
          'import * as fc from "fast-check";',
          'import * as S from "effect/Schema";',
          "const Worker = S.Struct({ id: S.String });",
          "const WorkerArbitrary = S.toArbitraryLazy(Worker);",
          "fc.property(WorkerArbitrary, (worker) => typeof worker.id === 'string');",
        ].join("\n")
      )
    ).toBe(true);
    expect(
      sourceTextHasSchemaArbitraryPropertyCoverage(
        [
          'import * as fc from "fast-check";',
          'import * as S from "effect/Schema";',
          "const Worker = S.Struct({ id: S.String });",
          "const WorkerArbitrary = S.toArbitrary(Worker);",
          "fc.property(fc.array(WorkerArbitrary), (workers) => workers.every((worker) => typeof worker.id === 'string'));",
        ].join("\n")
      )
    ).toBe(true);
    expect(sourceTextHasSchemaArbitraryPropertyCoverage("const WorkerArbitrary = S.toArbitraryLazy(Worker);")).toBe(
      false
    );
    expect(
      sourceTextHasSchemaArbitraryPropertyCoverage(
        'import { assertSchemaArbitraryDecodesToSelf } from "@beep/test-utils";'
      )
    ).toBe(false);
  });

  it("resolves schema-crispening wave families by path prefix", () => {
    expect(schemaCrispeningFamilyForFile("packages/foundation/modeling/schema/src/Foo.ts")).toEqual(
      O.some("foundation")
    );
    expect(schemaCrispeningFamilyForFile("packages/drivers/postgres/src/Foo.ts")).toEqual(O.some("drivers"));
    expect(schemaCrispeningFamilyForFile("packages/tooling/tool/cli/src/Foo.ts")).toEqual(O.some("tooling"));
    expect(schemaCrispeningFamilyForFile("apps/web/src/Foo.tsx")).toEqual(O.some("apps-slices"));
    expect(schemaCrispeningFamilyForFile("packages/agents/src/Foo.ts")).toEqual(O.some("apps-slices"));
    expect(schemaCrispeningFamilyForFile("packages/architecture-lab/src/Foo.ts")).toEqual(O.some("apps-slices"));
    expect(schemaCrispeningFamilyForFile("packages/epistemic/src/Foo.ts")).toEqual(O.some("apps-slices"));
    expect(schemaCrispeningFamilyForFile("packages/law-practice/src/Foo.ts")).toEqual(O.some("apps-slices"));
    expect(schemaCrispeningFamilyForFile("packages/workspace/src/Foo.ts")).toEqual(O.some("apps-slices"));
    // R4: packages/shared/** and infra/** are assigned families (apps-slices,
    // tooling respectively) — they are no longer unassigned/non-blocking.
    expect(schemaCrispeningFamilyForFile("packages/shared/kernel/src/Foo.ts")).toEqual(O.some("apps-slices"));
    expect(schemaCrispeningFamilyForFile("infra/pulumi/src/Foo.ts")).toEqual(O.some("tooling"));
    expect(O.isNone(schemaCrispeningFamilyForFile("README.md"))).toBe(true);
  });

  it("resolves every schema-first lint scan scope root to an assigned family", () => {
    // INCLUDED_GLOBS covers apps/**, packages/**, infra/** — every root below
    // must resolve to Some(family); none may fall through to family-unassigned.
    const scanScopeRoots: ReadonlyArray<readonly [string, string]> = [
      ["apps/web/src/Foo.tsx", "apps-slices"],
      ["packages/foundation/modeling/schema/src/Foo.ts", "foundation"],
      ["packages/drivers/postgres/src/Foo.ts", "drivers"],
      ["packages/tooling/tool/cli/src/Foo.ts", "tooling"],
      ["packages/agents/src/Foo.ts", "apps-slices"],
      ["packages/architecture-lab/src/Foo.ts", "apps-slices"],
      ["packages/epistemic/src/Foo.ts", "apps-slices"],
      ["packages/law-practice/src/Foo.ts", "apps-slices"],
      ["packages/shared/kernel/src/Foo.ts", "apps-slices"],
      ["packages/workspace/src/Foo.ts", "apps-slices"],
      ["infra/pulumi/src/Foo.ts", "tooling"],
    ];

    for (const [file, family] of scanScopeRoots) {
      const resolved = schemaCrispeningFamilyForFile(file);
      expect(O.isSome(resolved)).toBe(true);
      expect(resolved).toEqual(O.some(family));
    }
  });

  describe("isSchemaCrispeningPolicyExempt", () => {
    const trackedEntry = SchemaFirstInventoryEntry.make({
      file: "packages/foundation/modeling/schema/src/Foo.ts",
      symbol: "Foo",
      kind: "object-struct-schema",
      status: "advisory",
      ruleId: "SFV4-defaults",
      owner: "@beep/schema",
      reason: "test finding",
    });

    it("exempts nothing when the policy document is absent (fail-safe)", () => {
      expect(isSchemaCrispeningPolicyExempt(O.none())(trackedEntry)).toBe(false);
    });

    it("does not exempt an entry whose ruleId is not a policy-tracked card", () => {
      const policy = O.some(
        SchemaCrispeningPolicyDocument.make({
          schemaVersion: "schema-crispening-policy/v1",
          cards: ["SFV4-normalization"],
          families: { foundation: { blocking: false } },
          ownerOverrides: {},
        })
      );
      expect(isSchemaCrispeningPolicyExempt(policy)(trackedEntry)).toBe(false);
    });

    it("exempts a tracked card whose resolved family is non-blocking", () => {
      const policy = O.some(
        SchemaCrispeningPolicyDocument.make({
          schemaVersion: "schema-crispening-policy/v1",
          cards: ["SFV4-defaults"],
          families: { foundation: { blocking: false } },
          ownerOverrides: {},
        })
      );
      expect(isSchemaCrispeningPolicyExempt(policy)(trackedEntry)).toBe(true);
    });

    it("does not exempt a tracked card whose resolved family is blocking", () => {
      const policy = O.some(
        SchemaCrispeningPolicyDocument.make({
          schemaVersion: "schema-crispening-policy/v1",
          cards: ["SFV4-defaults"],
          families: { foundation: { blocking: true } },
          ownerOverrides: {},
        })
      );
      expect(isSchemaCrispeningPolicyExempt(policy)(trackedEntry)).toBe(false);
    });

    it("lets a blocking owner override win over a non-blocking family", () => {
      const policy = O.some(
        SchemaCrispeningPolicyDocument.make({
          schemaVersion: "schema-crispening-policy/v1",
          cards: ["SFV4-defaults"],
          families: { foundation: { blocking: false } },
          ownerOverrides: { "@beep/schema": { blocking: true } },
        })
      );
      expect(isSchemaCrispeningPolicyExempt(policy)(trackedEntry)).toBe(false);
    });

    it("R4: does not exempt a carded packages/shared entry now that it resolves to the blocking apps-slices family", () => {
      const sharedEntry = SchemaFirstInventoryEntry.make({
        ...trackedEntry,
        file: "packages/shared/kernel/src/Foo.ts",
      });
      const policy = O.some(
        SchemaCrispeningPolicyDocument.make({
          schemaVersion: "schema-crispening-policy/v1",
          cards: ["SFV4-defaults"],
          families: { "apps-slices": { blocking: true } },
          ownerOverrides: {},
        })
      );
      expect(isSchemaCrispeningPolicyExempt(policy)(sharedEntry)).toBe(false);
    });

    it("R4: does not exempt a carded infra entry now that it resolves to the blocking tooling family", () => {
      const infraEntry = SchemaFirstInventoryEntry.make({
        ...trackedEntry,
        file: "infra/pulumi/src/Foo.ts",
      });
      const policy = O.some(
        SchemaCrispeningPolicyDocument.make({
          schemaVersion: "schema-crispening-policy/v1",
          cards: ["SFV4-defaults"],
          families: { tooling: { blocking: true } },
          ownerOverrides: {},
        })
      );
      expect(isSchemaCrispeningPolicyExempt(policy)(infraEntry)).toBe(false);
    });
  });
});

describe("fnSchemaEntryFromFunctionLike", () => {
  it("fires for an exported function with an inline object parameter contract", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "fixture.ts",
      "export function updateWidget(input: { id: string; name: string }): void {}"
    );
    const [functionDeclaration] = sourceFile.getFunctions();
    const entry = fnSchemaEntryFromFunctionLike(functionDeclaration, { file: "fixture.ts", owner: "@beep/test" });

    expect(O.isSome(entry)).toBe(true);
    expect(O.map(entry, (found) => found.ruleId)).toEqual(O.some("SFV4-fn-schema"));
    expect(O.map(entry, (found) => found.symbol)).toEqual(O.some("updateWidget"));
    expect(O.map(entry, (found) => found.status)).toEqual(O.some("advisory"));
  });

  it("does not fire for a generic exported function", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "fixture.ts",
      ["export function identity<T>(input: { value: T }): T {", "  return input.value;", "}"].join("\n")
    );
    const [functionDeclaration] = sourceFile.getFunctions();
    const entry = fnSchemaEntryFromFunctionLike(functionDeclaration, { file: "fixture.ts", owner: "@beep/test" });

    expect(O.isNone(entry)).toBe(true);
  });
});

describe("normalizationEntryFromCallExpression", () => {
  it("fires for a trim() call inside a function body", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "fixture.ts",
      ["export function normalizeName(name: string): string {", "  return name.trim();", "}"].join("\n")
    );
    const [callExpression] = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    const entry = normalizationEntryFromCallExpression(callExpression, { file: "fixture.ts", owner: "@beep/test" });

    expect(O.isSome(entry)).toBe(true);
    expect(O.map(entry, (found) => found.ruleId)).toEqual(O.some("SFV4-normalization"));
    expect(O.map(entry, (found) => found.symbol)).toEqual(O.some("normalizeName.trim"));
  });

  it("does not fire for a module-top-level trim() call", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile("fixture.ts", 'const trimmed = "  hi  ".trim();');
    const [callExpression] = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    const entry = normalizationEntryFromCallExpression(callExpression, { file: "fixture.ts", owner: "@beep/test" });

    expect(O.isNone(entry)).toBe(true);
  });
});

describe("nullReturnEntryFromFunctionLike", () => {
  it("fires for an exported function with an explicit null return annotation", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "fixture.ts",
      ["export function findUser(id: string): string | null {", "  return null;", "}"].join("\n")
    );
    const [functionDeclaration] = sourceFile.getFunctions();
    const entry = nullReturnEntryFromFunctionLike(functionDeclaration, { file: "fixture.ts", owner: "@beep/test" });

    expect(O.isSome(entry)).toBe(true);
    expect(O.map(entry, (found) => found.ruleId)).toEqual(O.some("SFV4-null-return"));
    expect(O.map(entry, (found) => found.symbol)).toEqual(O.some("findUser"));
  });

  it("does not fire for a function without an explicit return annotation", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "fixture.ts",
      ["export function findUser(id: string) {", "  return null;", "}"].join("\n")
    );
    const [functionDeclaration] = sourceFile.getFunctions();
    const entry = nullReturnEntryFromFunctionLike(functionDeclaration, { file: "fixture.ts", owner: "@beep/test" });

    expect(O.isNone(entry)).toBe(true);
  });
});

describe("getsomesStructEntryFromCallExpression", () => {
  it("fires for R.getSomes over an inline Option-struct literal", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "fixture.ts",
      ["export function pickSomes() {", "  return R.getSomes({ a: 1, b: 2 });", "}"].join("\n")
    );
    const [callExpression] = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    const entry = getsomesStructEntryFromCallExpression(callExpression, { file: "fixture.ts", owner: "@beep/test" });

    expect(O.isSome(entry)).toBe(true);
    expect(O.map(entry, (found) => found.ruleId)).toEqual(O.some("SFV4-getsomes-struct"));
    expect(O.map(entry, (found) => found.symbol)).toEqual(O.some("pickSomes.R.getSomes"));
  });

  it("does not fire for R.getSomes over an identifier dictionary argument", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "fixture.ts",
      ["export function pickSomes(dict: Record<string, number>) {", "  return R.getSomes(dict);", "}"].join("\n")
    );
    const [callExpression] = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    const entry = getsomesStructEntryFromCallExpression(callExpression, { file: "fixture.ts", owner: "@beep/test" });

    expect(O.isNone(entry)).toBe(true);
  });
});

// G4/§5.7 family-flip ratchet: once a family's remediation wave is green, its
// novel lint cards flip non-blocking -> blocking in
// standards/schema-crispening.policy.jsonc. This fixture proves the flip both
// ways: a novel-card violation resolving to the flipped foundation family is
// counted (hard-fails lint), while the identical violation in a still-non-blocking
// family (drivers) stays fully exempt.
describe("G4 foundation family-flip regression fixture", () => {
  // One real SFV4-fn-schema violation (novel card), re-resolved against two wave
  // families by varying only the file path handed to the AST detector. Ties the
  // novel-card detector to the policy ratchet consumed by
  // collectSchemaFirstLintFindings / schemaFirstLintHasFailures.
  const fnSchemaViolationForFile = (file: string): SchemaFirstInventoryEntry => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "fixture.ts",
      "export function updateWidget(input: { id: string; name: string }): void {}"
    );
    const [functionDeclaration] = sourceFile.getFunctions();
    return O.getOrThrow(fnSchemaEntryFromFunctionLike(functionDeclaration, { file, owner: "@beep/fixture" }));
  };

  const foundationFile = "packages/foundation/modeling/schema/src/Fixture.ts";
  const driversFile = "packages/drivers/postgres/src/Fixture.ts";
  const toolingFile = "packages/tooling/library/repo-utils/src/Fixture.ts";
  const appsFile = "packages/workspace/domain/src/Fixture.ts";
  const foundationViolation = fnSchemaViolationForFile(foundationFile);
  const driversViolation = fnSchemaViolationForFile(driversFile);
  const toolingViolation = fnSchemaViolationForFile(toolingFile);
  const appsViolation = fnSchemaViolationForFile(appsFile);

  it("resolves the fixture paths to the flipped and still-exempt families", () => {
    expect(schemaCrispeningFamilyForFile(foundationFile)).toEqual(O.some("foundation"));
    expect(schemaCrispeningFamilyForFile(driversFile)).toEqual(O.some("drivers"));
    expect(foundationViolation.ruleId).toBe("SFV4-fn-schema");
    expect(driversViolation.ruleId).toBe("SFV4-fn-schema");
  });

  it("counts the foundation violation and exempts the drivers violation (flipped policy)", () => {
    // Mirrors the committed policy after the foundation flip: foundation blocking,
    // drivers still non-blocking. SFV4-fn-schema is a policy-tracked novel card.
    const policy = O.some(
      SchemaCrispeningPolicyDocument.make({
        schemaVersion: "schema-crispening-policy/v1",
        cards: ["SFV4-fn-schema"],
        families: { foundation: { blocking: true }, drivers: { blocking: false } },
        ownerOverrides: {},
      })
    );
    const isExempt = isSchemaCrispeningPolicyExempt(policy);

    // (a) foundation side: NOT exempt -> survives the collect filter -> counted.
    expect(isExempt(foundationViolation)).toBe(false);
    // (b) drivers side: exempt -> filtered out -> never counted.
    expect(isExempt(driversViolation)).toBe(true);

    // collectSchemaFirstLintFindings filters active advisories by !isExempt before
    // schemaFirstLintHasFailures flags a non-empty set; reproduce that filter to
    // prove only the foundation violation is counted (so lint hard-fails).
    const counted = A.filter([foundationViolation, driversViolation], (entry) => !isExempt(entry));
    expect(counted).toHaveLength(1);
    expect(counted[0]).toBe(foundationViolation);
  });

  it("keeps the same ratchet result against the real committed policy document", () => {
    // Bind the fixture to the on-disk policy: if a future edit reverts a
    // family flip, these assertions fail. Flipped so far: foundation, drivers.
    const policy = O.some(S.decodeUnknownSync(SchemaCrispeningPolicyDocument)(parse(committedPolicyText)));
    const isExempt = isSchemaCrispeningPolicyExempt(policy);

    expect(isExempt(foundationViolation)).toBe(false);
    expect(isExempt(driversViolation)).toBe(false);
    expect(schemaCrispeningFamilyForFile(toolingFile)).toEqual(O.some("tooling"));
    expect(isExempt(toolingViolation)).toBe(false);
    // All four families are flipped — the ratchet is fully closed.
    expect(schemaCrispeningFamilyForFile(appsFile)).toEqual(O.some("apps-slices"));
    expect(isExempt(appsViolation)).toBe(false);
    // A path outside every wave family resolves to no family and stays exempt
    // (PLAN: unassigned surfaces are non-blocking by construction).
    const unassignedViolation = fnSchemaViolationForFile("scripts/OneOff.ts");
    expect(O.isNone(schemaCrispeningFamilyForFile("scripts/OneOff.ts"))).toBe(true);
    expect(isExempt(unassignedViolation)).toBe(true);
  });
});

// R6-1: exported generic interface/type-alias whose extends clause resolves
// to S.declareConstructor/S.decodeTo/S.Bottom/VariantSchema.Field AND
// declares a Rebuild: this member goes silent (no inventory entry at all).
describe("R6-1: schema-infrastructure generic silent skip", () => {
  it("still flags a plain pure-data generic interface (no schema-base extends)", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile("fixture.ts", "export interface Box<A> { readonly value: A; }");
    const [declaration] = sourceFile.getInterfaces();

    const classification = detectInterfaceReason({ node: declaration, sourceFile, filePath: "fixture.ts" });

    expect(classification._tag).toBe("exception");
  });

  it("silently skips a generic interface extending declareConstructor with Rebuild: this", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "fixture.ts",
      [
        "export interface FooFromSelf<Key, Value>",
        "  extends S.declareConstructor<Foo<Key, Value>, Foo<Key, Value>, readonly [Key, Value], unknown> {",
        "  readonly key: Key;",
        "  readonly Rebuild: this;",
        "  readonly value: Value;",
        "}",
      ].join("\n")
    );
    const [declaration] = sourceFile.getInterfaces();

    const classification = detectInterfaceReason({ node: declaration, sourceFile, filePath: "fixture.ts" });

    expect(classification._tag).toBe("silent");
  });
});

// R6-2 + R11-2: an exported generic OR non-generic interface/type-literal
// whose every member is function/call-signature-typed (zero data fields)
// goes silent.
describe("R6-2/R11-2: all-function-member interface silent skip", () => {
  it("silently skips an all-function-member generic interface", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "fixture.ts",
      ["export interface Strategy<A> {", "  readonly run: (value: A) => string;", "}"].join("\n")
    );
    const [declaration] = sourceFile.getInterfaces();

    expect(detectInterfaceReason({ node: declaration, sourceFile, filePath: "fixture.ts" })._tag).toBe("silent");
  });

  it("still flags a generic interface with one data-typed field", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "fixture.ts",
      [
        "export interface StrategyWithData<A> {",
        "  readonly run: (value: A) => string;",
        "  readonly label: string;",
        "}",
      ].join("\n")
    );
    const [declaration] = sourceFile.getInterfaces();

    expect(detectInterfaceReason({ node: declaration, sourceFile, filePath: "fixture.ts" })._tag).toBe("exception");
  });

  it("silently skips a non-generic all-function-member interface (extends R6-2 to non-generic)", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "fixture.ts",
      ["export interface SendHandlerBox {", "  readonly run: (state: unknown) => boolean;", "}"].join("\n")
    );
    const [declaration] = sourceFile.getInterfaces();

    expect(detectInterfaceReason({ node: declaration, sourceFile, filePath: "fixture.ts" })._tag).toBe("silent");
  });
});

// R7: detectInterfaceReason's extends-branch no longer unconditionally
// short-circuits — it resolves extends targets and either silently skips
// (external), stays a tracked exception (schema-authoring infrastructure
// idiom), or composes own+inherited members and classifies exactly like a
// non-extends interface.
describe("R7: extends-clause resolution", () => {
  it("silently skips an interface extending an external (node_modules) type", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    // A global ambient declaration (no import/export) placed under a
    // node_modules-pathed file — isInNodeModules() is a path-string check
    // (ts-morph), so this stands in for React/d3/frimousse-style third-party
    // Props bases without needing a real npm install.
    project.createSourceFile(
      "/node_modules/external-lib/index.d.ts",
      ["interface GlobalComponentProps {", "  readonly onClick: () => void;", "}"].join("\n")
    );
    const sourceFile = project.createSourceFile(
      "fixture.tsx",
      ["export interface FixtureProps extends GlobalComponentProps {}"].join("\n")
    );
    const [declaration] = sourceFile.getInterfaces();

    expect(detectInterfaceReason({ node: declaration, sourceFile, filePath: "fixture.tsx" })._tag).toBe("silent");
  });

  it("classifies a repo-local pure-data extends target as a candidate", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "fixture.ts",
      [
        "export interface BaseData { readonly id: string; }",
        "export interface DerivedData extends BaseData { readonly name: string; }",
      ].join("\n")
    );
    const [, declaration] = sourceFile.getInterfaces();

    expect(detectInterfaceReason({ node: declaration, sourceFile, filePath: "fixture.ts" })._tag).toBe("candidate");
  });

  it("composes a repo-local extends target with function members and classifies by member safety (mixed -> candidate)", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "fixture.ts",
      [
        "export interface LocalPortShape { readonly identifier: string; readonly run: () => string; }",
        "export interface Repro extends LocalPortShape {}",
      ].join("\n")
    );
    const [, declaration] = sourceFile.getInterfaces();

    // Composed members = Repro's own (none) + LocalPortShape's own
    // (identifier: data, run: function) — a mixed shape with no
    // service-contract/curated-runtime-handle signal, so R11-4's gate
    // strengthening makes it a candidate (not the retired extends-clause
    // exception, and not silent — it has a genuine data field).
    expect(detectInterfaceReason({ node: declaration, sourceFile, filePath: "fixture.ts" })._tag).toBe("candidate");
  });

  // R13 (driver-ratified refinement of R7's schema-meta idiom): an empty own
  // body exists solely for the type/value dual-binding — driver-verified
  // against the real DateTimeInsert (Model.datetime.ts:133) — so it is
  // silent, not a tracked exception.
  it("R13: silently skips the schema-meta named-generic-instantiation idiom with an empty own body", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "fixture.ts",
      ["export interface DateTimeInsert extends VariantSchema.Field<{ select: unknown }> {}"].join("\n")
    );
    const [declaration] = sourceFile.getInterfaces();

    const classification = detectInterfaceReason({ node: declaration, sourceFile, filePath: "fixture.ts" });

    expect(classification._tag).toBe("silent");
  });

  it("R13: still classifies the same schema-meta base with an added data member via member composition", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "fixture.ts",
      [
        "export interface DateTimeInsertWithExtra extends VariantSchema.Field<{ select: unknown }> {",
        "  readonly extra: string;",
        "}",
      ].join("\n")
    );
    const [declaration] = sourceFile.getInterfaces();

    const classification = detectInterfaceReason({ node: declaration, sourceFile, filePath: "fixture.ts" });

    expect(classification._tag).toBe("candidate");
  });
});

// R11-1: isServiceContractShape runs BEFORE the member-safety/signals check.
describe("R11-1: service-contract shape silent skip", () => {
  it("silently skips a same-file Context.Service<Tag, Shape> shape", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "fixture.ts",
      [
        "export interface UsageRecordSinkShape { readonly id: string; readonly record: (event: unknown) => void; }",
        "export class UsageRecordSink extends Context.Service<UsageRecordSink, UsageRecordSinkShape>() {}",
      ].join("\n")
    );
    const [declaration] = sourceFile.getInterfaces();

    expect(detectInterfaceReason({ node: declaration, sourceFile, filePath: "fixture.ts" })._tag).toBe("silent");
  });

  it("classifies the identical mixed shape without any service-contract signal", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "fixture.ts",
      ["export interface NoSignalShape { readonly id: string; readonly record: (event: unknown) => void; }"].join("\n")
    );
    const [declaration] = sourceFile.getInterfaces();

    expect(detectInterfaceReason({ node: declaration, sourceFile, filePath: "fixture.ts" })._tag).toBe("candidate");
  });
});

// R11-4: mixed data+function interfaces with NO silent-skip signal are a
// CANDIDATE — the gate is strengthened; they used to be tolerated
// exceptions via the retired "non-schema signals" reason.
describe("R11-4: mixed shape gate strengthening", () => {
  it("classifies a mixed interface with no protecting signal as a candidate", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "fixture.ts",
      ["export interface MixedNoSignal { readonly total: number; readonly recompute: () => number; }"].join("\n")
    );
    const [declaration] = sourceFile.getInterfaces();

    expect(detectInterfaceReason({ node: declaration, sourceFile, filePath: "fixture.ts" })._tag).toBe("candidate");
  });
});

// R11-3: curated vendor/live-resource signals (already in
// NON_SCHEMA_SIGNAL_PATTERN) silently skip the whole interface when every
// member is either function-like or a curated signal.
describe("R11-3: curated runtime-handle silent skip", () => {
  it("silently skips an interface carrying a WinkMethods handle", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "fixture.ts",
      ["export interface WinkEngineRuntimeState { readonly nlp: WinkMethods; }"].join("\n")
    );
    const [declaration] = sourceFile.getInterfaces();

    expect(detectInterfaceReason({ node: declaration, sourceFile, filePath: "fixture.ts" })._tag).toBe("silent");
  });
});

// R11-5: Uint8Array removed from NON_SCHEMA_SIGNAL_PATTERN — a
// Uint8Array-typed field is convertible schema data (S.Uint8Array exists
// natively in v4), so it is now a candidate rather than a signals-exception.
describe("R11-5: Uint8Array is no longer a non-schema signal", () => {
  it("classifies a Uint8Array-field interface as a candidate", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "fixture.ts",
      ["export interface BytesShape { readonly bytes: Uint8Array; }"].join("\n")
    );
    const [declaration] = sourceFile.getInterfaces();

    expect(detectInterfaceReason({ node: declaration, sourceFile, filePath: "fixture.ts" })._tag).toBe("candidate");
  });

  it("classifies a Uint8Array-field type-literal alias as a candidate", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "fixture.ts",
      "export type BytesAlias = { readonly bytes: Uint8Array };"
    );
    const [declaration] = sourceFile.getTypeAliases();

    expect(detectTypeAliasReason({ node: declaration, sourceFile, filePath: "fixture.ts" })._tag).toBe("candidate");
  });
});

// R11-6: member-type safety checks resolve one level of a local type alias
// before the structural/textual tests — hiding a function type behind a
// named alias must not silence the check.
describe("R11-6: alias-indirection fix", () => {
  it("still detects a function member hidden behind a local type alias", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "fixture.ts",
      [
        "type Handler = (value: string) => void;",
        "export interface AllFunctionViaAlias {",
        "  readonly onEvent: Handler;",
        "  readonly onOther: () => void;",
        "}",
      ].join("\n")
    );
    const [declaration] = sourceFile.getInterfaces();

    // Without the one-level alias resolution, `onEvent: Handler` looks like
    // a safe/data field (a bare type reference), making this shape mixed
    // and thus a candidate; with the fix both members are function-like, so
    // the whole interface goes silent.
    expect(detectInterfaceReason({ node: declaration, sourceFile, filePath: "fixture.ts" })._tag).toBe("silent");
  });
});

// R14: curated in-code exclusion list (mirror of DualArity's
// PERMANENT_EXCLUSIONS) for the verified categorical-generic family
// (ops/reports/SF-1/sf-1-graphnode.md) — explicit, reviewable, driver-owned
// entries, not a blanket structural exemption.
describe("R14: categorical-generic family curated exclusion", () => {
  it("silently skips a curated categorical-generic exclusion by file+symbol", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const filePath = "packages/foundation/capability/nlp-processing/src/Graph/EffectGraph.ts";
    const sourceFile = project.createSourceFile(
      filePath,
      ["export interface GraphNode<A> {", "  readonly value: A;", "}"].join("\n")
    );
    const [declaration] = sourceFile.getInterfaces();

    expect(detectInterfaceReason({ node: declaration, sourceFile, filePath })._tag).toBe("silent");
  });

  it("still flags an unregistered generic interface with the identical pure-data shape", () => {
    // Same shape as GraphNode<A> above (one free-typed data field), but
    // neither the file path nor the symbol name is in
    // PERMANENT_SCHEMA_FIRST_EXCLUSIONS.
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "fixture.ts",
      ["export interface Box<A> {", "  readonly value: A;", "}"].join("\n")
    );
    const [declaration] = sourceFile.getInterfaces();

    expect(detectInterfaceReason({ node: declaration, sourceFile, filePath: "fixture.ts" })._tag).toBe("exception");
  });
});

// R14: factory-derived generic aliases (the TypedText pattern) — a generic
// type alias whose type node is an `S.Schema.Type<...>` TypeReference is
// schema-DERIVED, so flagging it as undecoded pure data is a category error.
describe("R14: factory-derived generic type alias silent skip", () => {
  it("silently skips a generic type alias whose type node is S.Schema.Type<...>", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "fixture.ts",
      [
        "const FooSchema = <K extends string>(kind: S.Schema<K>) => S.Struct({ kind });",
        "export type Foo<K extends string> = S.Schema.Type<ReturnType<typeof FooSchema<K>>>;",
      ].join("\n")
    );
    const [declaration] = sourceFile.getTypeAliases();

    expect(detectTypeAliasReason({ node: declaration, sourceFile, filePath: "fixture.ts" })._tag).toBe("silent");
  });

  it("still flags a plain pure-data generic type alias (no factory indirection)", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile("fixture.ts", "export type Box<A> = { readonly value: A };");
    const [declaration] = sourceFile.getTypeAliases();

    expect(detectTypeAliasReason({ node: declaration, sourceFile, filePath: "fixture.ts" })._tag).toBe("exception");
  });
});

// R15-1: S.Codec/S.Union/VariantSchema.Overridable join
// SCHEMA_INFRASTRUCTURE_EXTENDS_PATTERN (ops/reports/SF-1/sf-1-schema.md gap
// #1/#4).
describe("R15-1: S.Codec/S.Union/VariantSchema.Overridable join the schema-infrastructure pattern", () => {
  it("silently skips a generic interface extending S.Codec with Rebuild: this", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "fixture.ts",
      ["export interface FooCodec<A, I> extends S.Codec<A, I> {", "  readonly Rebuild: this;", "}"].join("\n")
    );
    const [declaration] = sourceFile.getInterfaces();

    expect(detectInterfaceReason({ node: declaration, sourceFile, filePath: "fixture.ts" })._tag).toBe("silent");
  });

  it("silently skips a generic interface extending VariantSchema.Overridable with Rebuild: this", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "fixture.ts",
      ["export interface FooOverridable<S> extends VariantSchema.Overridable<S> {", "  readonly Rebuild: this;", "}"].join(
        "\n"
      )
    );
    const [declaration] = sourceFile.getInterfaces();

    expect(detectInterfaceReason({ node: declaration, sourceFile, filePath: "fixture.ts" })._tag).toBe("silent");
  });

  it("still flags a generic interface extending an unrelated base with Rebuild: this", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "fixture.ts",
      [
        "export interface FooUnrelated<A> extends SomeOtherBase<A> {",
        "  readonly Rebuild: this;",
        "  readonly value: A;",
        "}",
      ].join("\n")
    );
    const [declaration] = sourceFile.getInterfaces();

    expect(detectInterfaceReason({ node: declaration, sourceFile, filePath: "fixture.ts" })._tag).toBe("exception");
  });
});

// R15-2: R13's isEmptyOrMetaOnlyOwnBody carve-out now also runs in the
// GENERIC branch of detectInterfaceReason (previously non-generic-extends
// only; ops/reports/SF-1/sf-1-schema.md gap #2).
describe("R15-2: empty-body carve-out reaches the generic branch", () => {
  it("silently skips a generic interface with an empty own body extending a schema-infra base (no Rebuild: this)", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "fixture.ts",
      ["export interface JsonFromStringLike<A> extends S.decodeTo<A, string> {}"].join("\n")
    );
    const [declaration] = sourceFile.getInterfaces();

    expect(detectInterfaceReason({ node: declaration, sourceFile, filePath: "fixture.ts" })._tag).toBe("silent");
  });

  it("still flags the same generic empty-body base with an added data member", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "fixture.ts",
      [
        "export interface JsonFromStringWithExtra<A> extends S.decodeTo<A, string> {",
        "  readonly extra: string;",
        "}",
      ].join("\n")
    );
    const [declaration] = sourceFile.getInterfaces();

    // Unlike the non-generic branch (which falls through to member
    // composition and can land on "candidate"), the generic branch's only
    // non-silent outcome is the tracked GENERIC_INTERFACE_EXCEPTION_REASON
    // exception — a real added data member keeps it there, it just isn't
    // silenced by the empty-body carve-out anymore.
    expect(detectInterfaceReason({ node: declaration, sourceFile, filePath: "fixture.ts" })._tag).toBe("exception");
  });
});

// R15-3: extends-clause target resolution now walks one level of local
// alias/interface indirection before the schema-infrastructure pattern test
// (ops/reports/SF-1/sf-1-schema.md gap #3).
describe("R15-3: one-level local-alias resolution for extends-clause targets", () => {
  it("silently skips a generic interface extending a local alias of a schema-infra base with Rebuild: this", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "fixture.ts",
      [
        "type EdgeTransform<Data> = S.decodeTo<Data, string>;",
        "export interface Edge<Data> extends EdgeTransform<Data> {",
        "  readonly Rebuild: this;",
        "}",
      ].join("\n")
    );
    const [declaration] = sourceFile.getInterfaces();

    expect(detectInterfaceReason({ node: declaration, sourceFile, filePath: "fixture.ts" })._tag).toBe("silent");
  });

  it("still flags a generic interface extending a local alias of an unrelated base with Rebuild: this", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "fixture.ts",
      [
        "type PlainAlias<Data> = { readonly data: Data };",
        "export interface PlainViaAlias<Data> extends PlainAlias<Data> {",
        "  readonly Rebuild: this;",
        "  readonly value: Data;",
        "}",
      ].join("\n")
    );
    const [declaration] = sourceFile.getInterfaces();

    expect(detectInterfaceReason({ node: declaration, sourceFile, filePath: "fixture.ts" })._tag).toBe("exception");
  });
});
