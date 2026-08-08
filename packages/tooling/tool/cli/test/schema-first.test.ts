import {
  createFileGenerationPlanService,
  FileGenerationPlanInput,
  GenerationAction,
  PlannedFile,
  PlannedSymlink,
} from "@beep/repo-cli/test/CreatePackage";
import {
  fnSchemaEntryFromFunctionLike,
  getsomesStructEntryFromCallExpression,
  isSchemaCrispeningPolicyExempt,
  normalizationEntryFromCallExpression,
  nullReturnEntryFromFunctionLike,
  SchemaCrispeningPolicyDocument,
  SchemaFirstInventoryEntry,
  schemaCrispeningFamilyForFile,
  sourceTextHasSchemaArbitraryPropertyCoverage,
} from "@beep/repo-cli/test/Lint";
import { VersionSyncOptions } from "@beep/repo-cli/test/VersionSync";
import { isExcludedTypeScriptSourcePath } from "@beep/repo-utils/schemas/TypeScriptSourceExclusions";
import { A } from "@beep/utils";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { parse } from "jsonc-parser";
import { Project, SyntaxKind, ts } from "ts-morph";
import { describe, expect, it } from "vitest";

const committedPolicyText = O.getOrElse(
  O.liftPredicate(
    ts.sys.readFile(new URL("../../../../../standards/schema-crispening.policy.jsonc", import.meta.url).pathname),
    P.isString
  ),
  () => ""
);

describe("packages/tooling/tool/cli schema-first models", () => {
  it("applies decoding defaults for FileGenerationPlanInput.symlinks", () => {
    const decoded = S.decodeSync(FileGenerationPlanInput)({
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
    expect(O.isNone(schemaCrispeningFamilyForFile("packages/shared/kernel/src/Foo.ts"))).toBe(true);
    expect(O.isNone(schemaCrispeningFamilyForFile("infra/pulumi/src/Foo.ts"))).toBe(true);
    expect(O.isNone(schemaCrispeningFamilyForFile("README.md"))).toBe(true);
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

    it("treats an unassigned family (e.g. packages/shared) as non-blocking, hence exempt", () => {
      const sharedEntry = SchemaFirstInventoryEntry.make({
        ...trackedEntry,
        file: "packages/shared/kernel/src/Foo.ts",
      });
      const policy = O.some(
        SchemaCrispeningPolicyDocument.make({
          schemaVersion: "schema-crispening-policy/v1",
          cards: ["SFV4-defaults"],
          families: {},
          ownerOverrides: {},
        })
      );
      expect(isSchemaCrispeningPolicyExempt(policy)(sharedEntry)).toBe(true);
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
    const entry = fnSchemaEntryFromFunctionLike({ file: "fixture.ts", owner: "@beep/test" })(functionDeclaration);

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
  it("fires for a trim() call beside a schema decode in the same exported function", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "fixture.ts",
      [
        'import * as S from "effect/Schema";',
        "const Name = S.String;",
        "export function normalizeName(input: unknown): string {",
        "  return S.decodeUnknownSync(Name)(input).trim();",
        "}",
      ].join("\n")
    );
    const callExpression = sourceFile
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .find((candidate) => candidate.getExpression().getText().endsWith(".trim"));
    if (callExpression === undefined) {
      throw new Error("Expected trim call expression fixture.");
    }
    const entry = normalizationEntryFromCallExpression({ file: "fixture.ts", owner: "@beep/test" })(callExpression);

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
    const entry = nullReturnEntryFromFunctionLike({ file: "fixture.ts", owner: "@beep/test" })(functionDeclaration);

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
    const entry = nullReturnEntryFromFunctionLike(functionDeclaration, {
      file: "fixture.ts",
      owner: "@beep/test",
    });

    expect(O.isNone(entry)).toBe(true);
  });

  it("does not fire when nullish values are carried inside an approved return wrapper", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile(
      "fixture.ts",
      [
        "export function effectful(): Effect.Effect<string | undefined> { return Effect.void; }",
        "export function optional(): O.Option<string | null> { return O.none(); }",
        "export function result(): Result.Result<string | undefined> { return Result.succeed(undefined); }",
        "export function exited(): Exit.Exit<string | null> { return Exit.succeed(null); }",
      ].join("\n")
    );

    for (const functionDeclaration of sourceFile.getFunctions()) {
      const entry = nullReturnEntryFromFunctionLike(functionDeclaration, {
        file: "fixture.ts",
        owner: "@beep/test",
      });
      expect(O.isNone(entry)).toBe(true);
    }
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
    const entry = getsomesStructEntryFromCallExpression({ file: "fixture.ts", owner: "@beep/test" })(callExpression);

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
    const entry = getsomesStructEntryFromCallExpression(callExpression, {
      file: "fixture.ts",
      owner: "@beep/test",
    });

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
