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

/**
 * Instantiates a `createOnce`-style oxlint rule against a fake rule context and runs its
 * `before` hook, so file-scoped state (shadow tracking, import bindings) starts clean.
 */
const createOnceRule = (name: RuleName, filename: string, reports: Array<unknown>) => {
  const rule = plugin.rules[name];
  if (P.isUndefined(rule) || !("createOnce" in rule) || P.isUndefined(rule.createOnce)) {
    throw new Error(`Expected ${name} to expose createOnce`);
  }
  const visitors = rule.createOnce({
    cwd: "/repo",
    filename,
    report: (finding: unknown) => {
      reports.push(finding);
    },
  } as never);
  visitors.before?.();
  return visitors;
};

const call = (callee: unknown, args: ReadonlyArray<unknown> = []) =>
  ({ arguments: args, callee, type: "CallExpression" }) as never;
const computedMember = (object: unknown, property: string) => ({
  computed: true,
  object,
  optional: false,
  property: literal(property),
  type: "MemberExpression",
});
const params = (...names: ReadonlyArray<string>) =>
  ({ params: [{ type: "ObjectPattern" }, ...names.map(identifier)], type: "FunctionDeclaration" }) as never;
const declarator = (id: unknown) => ({ id, type: "VariableDeclarator" }) as never;
const processExit = () => call(member(identifier("process"), "exit"));

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
  it("ignores process while a parameter binding shadows it in nested functions", () => {
    const reports: Array<unknown> = [];
    const rule = createOnceRule("no-direct-process-io", "/repo/packages/example/src/fixture.ts", reports);

    rule.CallExpression?.(processExit());

    // A parameter binding shadows `process` for the arrow and every nested function.
    rule.ArrowFunctionExpression?.(params("other", "process"));
    rule.CallExpression?.(processExit());
    rule.FunctionExpression?.(params());
    rule.CallExpression?.(processExit());
    rule["FunctionExpression:exit"]?.(params());
    rule["ArrowFunctionExpression:exit"]?.(params());
    rule.CallExpression?.(processExit());

    expect(reports).toHaveLength(2);
  });

  it("ignores Bun only inside the function whose declarator binds it", () => {
    const reports: Array<unknown> = [];
    const rule = createOnceRule("no-direct-process-io", "/repo/packages/example/src/fixture.ts", reports);

    // A declarator shadows only the names the rule tracks, and only inside its function.
    rule.FunctionDeclaration?.(params());
    rule.VariableDeclarator?.(declarator(identifier("Bun")));
    rule.VariableDeclarator?.(declarator({ type: "ObjectPattern" }));
    rule.VariableDeclarator?.(declarator(identifier("unrelated")));
    rule.CallExpression?.(call(member(identifier("Bun"), "exit")));
    rule.CallExpression?.(processExit());
    rule["FunctionDeclaration:exit"]?.(params());
    rule.CallExpression?.(call(member(identifier("Bun"), "exit")));

    expect(reports).toHaveLength(2);
  });

  it("keeps the module scope on an unbalanced function exit", () => {
    const reports: Array<unknown> = [];
    const rule = createOnceRule("no-direct-process-io", "/repo/packages/example/src/fixture.ts", reports);

    rule["FunctionDeclaration:exit"]?.(params());
    rule.CallExpression?.(call(member(identifier("Bun"), "exit")));

    expect(reports).toHaveLength(1);
  });

  it("reports wrapped, computed, and assigned process io in production files", () => {
    const reports: Array<unknown> = [];
    const rule = createOnceRule("no-direct-process-io", "/repo/packages/example/src/fixture.ts", reports);
    const wrappedProcess = {
      expression: { expression: identifier("process"), type: "TSNonNullExpression" },
      type: "ParenthesizedExpression",
    };
    const globalStderr = computedMember(member(identifier("globalThis"), "process"), "stderr");
    const bun = identifier("Bun");

    rule.CallExpression?.(call(member(wrappedProcess, "exit")));
    rule.CallExpression?.(call(member(globalStderr, "write"), [literal("err")]));
    rule.CallExpression?.(call(member(bun, "write"), [member(bun, "stdout"), literal("out")]));
    rule.CallExpression?.(call(member(bun, "write"), [literal("output.txt"), literal("data")]));
    rule.CallExpression?.(call(identifier("exit")));
    rule.AssignmentExpression?.({
      left: member(identifier("process"), "exitCode"),
      right: literal("1"),
      type: "AssignmentExpression",
    } as never);
    rule.UpdateExpression?.({ argument: member(identifier("process"), "exitCode"), type: "UpdateExpression" } as never);

    expect(reports).toHaveLength(5);
  });

  it("resets shadowed scopes between files", () => {
    const reports: Array<unknown> = [];
    const rule = createOnceRule("no-global-process-runtime", "/repo/packages/example/src/fixture.ts", reports);
    const platformRead = member(identifier("process"), "platform") as never;

    rule.FunctionDeclaration?.(params("process"));
    rule.MemberExpression?.(platformRead);
    rule.before?.();
    rule.MemberExpression?.(platformRead);

    expect(reports).toHaveLength(1);
  });

  it("classifies named, default, and type-only runtime imports in a test file", () => {
    const reports: Array<unknown> = [];
    const rule = createRule(
      "no-manual-effect-runtime-in-tests",
      "/repo/packages/example/test/fixture.test.ts",
      reports
    );

    rule.ImportDeclaration?.({
      importKind: "value",
      source: literal("effect"),
      specifiers: [
        { imported: identifier("Effect"), importKind: "value", local: identifier("Fx"), type: "ImportSpecifier" },
        { imported: identifier("Effect"), importKind: "type", local: identifier("T"), type: "ImportSpecifier" },
      ],
      type: "ImportDeclaration",
    } as never);
    rule.ImportDeclaration?.({
      importKind: "value",
      source: literal("effect/Effect"),
      specifiers: [{ local: identifier("EffectDefault"), type: "ImportDefaultSpecifier" }],
      type: "ImportDeclaration",
    } as never);
    rule.CallExpression?.(call(member(identifier("Fx"), "runPromise")));
    rule.CallExpression?.(call(member(identifier("EffectDefault"), "runSync")));
    rule.CallExpression?.(call(member(identifier("T"), "runSync")));

    expect(reports).toHaveLength(2);
  });
});
