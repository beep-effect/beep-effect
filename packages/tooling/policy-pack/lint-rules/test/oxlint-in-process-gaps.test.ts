import plugin from "@beep/lint-rules/oxlint";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as P from "effect/Predicate";

type RuleName = keyof typeof plugin.rules;
type SourceText = (node: { readonly value?: string }) => string;

const identifier = (name: string) => ({ name, type: "Identifier" });
const literal = (value: string) => ({
  range: [0, value.length + 2],
  type: "Literal",
  value,
});
const member = (object: unknown, property: string) => ({
  computed: false,
  object,
  optional: false,
  property: identifier(property),
  type: "MemberExpression",
});
const namespaceImport = (source: string, local: string) =>
  ({
    importKind: "value",
    source: literal(source),
    specifiers: [{ local: identifier(local), type: "ImportNamespaceSpecifier" }],
    type: "ImportDeclaration",
  }) as never;

const singleQuoted: SourceText = (node) => `'${node.value ?? ""}'`;

/**
 * Instantiates a `create`-style oxlint rule against a fake rule context that
 * records every report, so the rule's visitor branches run in-process under
 * coverage instead of only through the spawned oxlint CLI harness.
 */
const createRule = (name: RuleName, filename: string, reports: Array<unknown>, getText: SourceText = singleQuoted) => {
  const rule = plugin.rules[name];
  if (P.isUndefined(rule) || !("create" in rule)) {
    throw new Error(`Expected ${name} to expose create`);
  }
  return rule.create({
    cwd: "/repo",
    filename,
    report: (finding: unknown) => {
      reports.push(finding);
    },
    sourceCode: { getText },
  } as never);
};

describe("oxlint rules in process", () => {
  it("reports relative javascript specifiers across import and export forms", () => {
    const reports: Array<unknown> = [];
    const rule = createRule("no-js-extension-imports", "/repo/packages/example/src/fixture.ts", reports);

    rule.ImportDeclaration?.({ source: literal("./ProviderInstance.service.js"), type: "ImportDeclaration" } as never);
    rule.ExportNamedDeclaration?.({ source: null, type: "ExportNamedDeclaration" } as never);
    rule.ImportExpression?.({ source: identifier("dynamic"), type: "ImportExpression" } as never);
    rule.ImportExpression?.({ source: literal("./dynamic.js"), type: "ImportExpression" } as never);
    rule.ExportAllDeclaration?.({ source: literal("./other.js"), type: "ExportAllDeclaration" } as never);
    rule.ImportDeclaration?.({ source: literal("effect"), type: "ImportDeclaration" } as never);
    rule.ImportDeclaration?.({ source: literal("./local.ts"), type: "ImportDeclaration" } as never);
    rule.ExportNamedDeclaration?.({ source: literal("./reexport.js"), type: "ExportNamedDeclaration" } as never);

    expect(reports).toHaveLength(4);
  });

  it("skips javascript sources and handles quote styles the fixer cannot rewrite", () => {
    const quotedReports: Array<unknown> = [];
    const unfixableReports: Array<unknown> = [];
    const skipped = createRule("no-js-extension-imports", "/repo/packages/example/src/fixture.js", []);
    const quoted = createRule(
      "no-js-extension-imports",
      "/repo/packages/example/src/fixture.ts",
      quotedReports,
      (node) => `"${node.value ?? ""}"`
    );
    const unfixable = createRule(
      "no-js-extension-imports",
      "/repo/packages/example/src/fixture.ts",
      unfixableReports,
      () => "./quoted.js"
    );

    quoted.ImportDeclaration?.({ source: literal("./quoted.js"), type: "ImportDeclaration" } as never);
    unfixable.ImportDeclaration?.({ source: literal("./quoted.js"), type: "ImportDeclaration" } as never);

    expect(skipped.ImportDeclaration).toBeUndefined();
    expect(quotedReports).toHaveLength(1);
    expect(quotedReports[0]).toHaveProperty("fix");
    expect(unfixableReports).toHaveLength(1);
    expect(unfixableReports[0]).not.toHaveProperty("fix");
  });

  it("reports non-namespace node builtin imports", () => {
    const reports: Array<unknown> = [];
    const rule = createRule("namespace-node-imports", "/repo/packages/example/src/fixture.ts", reports);

    rule.ImportDeclaration?.({
      source: literal("node:fs"),
      specifiers: [{ local: identifier("fs"), type: "ImportDefaultSpecifier" }],
      type: "ImportDeclaration",
    } as never);
    rule.ImportDeclaration?.(namespaceImport("node:fs/promises", "NodeFSP"));
    rule.ImportDeclaration?.(namespaceImport("effect", "Effect"));
    rule.ImportDeclaration?.({
      source: literal("node:fs"),
      specifiers: [
        { local: identifier("a"), type: "ImportSpecifier" },
        { local: identifier("b"), type: "ImportSpecifier" },
      ],
      type: "ImportDeclaration",
    } as never);

    expect(reports).toHaveLength(2);
  });

  it("reports a manual Effect runtime call inside a test file", () => {
    const reports: Array<unknown> = [];
    const rule = createRule(
      "no-manual-effect-runtime-in-tests",
      "/repo/packages/example/test/fixture.test.ts",
      reports
    );

    rule.ImportDeclaration?.(namespaceImport("effect/Effect", "Effect"));
    rule.CallExpression?.({ callee: member(identifier("Effect"), "runPromise"), type: "CallExpression" } as never);

    expect(reports).toHaveLength(1);
  });

  it("reports an instance field declared on an opaque schema class", () => {
    const reports: Array<unknown> = [];
    const rule = createRule("no-opaque-instance-fields", "/repo/packages/example/src/fixture.ts", reports);

    rule.ImportDeclaration?.(namespaceImport("effect/Schema", "S"));
    rule.ClassDeclaration?.({
      body: {
        body: [{ static: false, type: "PropertyDefinition" }],
        type: "ClassBody",
      },
      superClass: {
        callee: {
          callee: member(identifier("S"), "Opaque"),
          type: "CallExpression",
        },
        type: "CallExpression",
      },
      type: "ClassDeclaration",
    } as never);

    expect(reports).toHaveLength(1);
  });
});
