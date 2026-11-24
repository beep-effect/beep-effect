import { docsRule } from "@beep/lint-rules/oxlint-docs";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as P from "effect/Predicate";

const declarationSelector =
  ":matches(FunctionDeclaration, ClassDeclaration, VariableDeclaration, TSTypeAliasDeclaration, TSInterfaceDeclaration)";

type Node = Record<string, unknown>;
type Hook = (node?: Node) => void;

const identifier = (name: string): Node => ({ name, type: "Identifier" });
const literal = (value: string): Node => ({ type: "Literal", value });
const template = (value: string): Node => ({
  expressions: [],
  quasis: [{ type: "TemplateElement", value: { cooked: value, raw: value } }],
  type: "TemplateLiteral",
});
const callee = (method: string, computed = false): Node => ({
  computed,
  object: identifier("$I"),
  optional: false,
  property: identifier(method),
  type: "MemberExpression",
});
const option = (key: Node, value: Node): Node => ({ computed: false, key, type: "Property", value });

const run = (call: Node): ReadonlyArray<unknown> => {
  const reports: Array<unknown> = [];
  const program: Node = { type: "Program" };
  const valueExport: Node = { parent: program, type: "ExportNamedDeclaration" };
  const valueDeclaration: Node = { parent: valueExport, type: "VariableDeclaration" };
  const declarator: Node = { id: identifier("Port"), init: call, parent: valueDeclaration, type: "VariableDeclarator" };
  valueDeclaration.declarations = [declarator];
  call.parent = declarator;
  const typeExport: Node = { parent: program, type: "ExportNamedDeclaration" };
  const companion: Node = { id: identifier("Port"), parent: typeExport, type: "TSTypeAliasDeclaration" };
  typeExport.declaration = companion;
  const tagsOnly = { range: [0, 24], type: "Block", value: "*\n * @category models\n " };
  const create = docsRule("require-description").create;
  if (P.isUndefined(create)) {
    throw new Error("Expected require-description to expose create");
  }
  const visitor = create({
    cwd: "/repo",
    filename: "/repo/packages/tooling/library/example/src/Port.ts",
    report: (finding: unknown) => {
      reports.push(finding);
    },
    sourceCode: { getCommentsBefore: (node: Node) => (node === typeExport ? [tagsOnly] : []) },
  } as never) as unknown as Record<string, Hook>;
  visitor.CallExpression?.(call);
  visitor[declarationSelector]?.(companion);
  visitor["Program:exit"]?.();
  return reports;
};

const annotation = (method: string, name: Node, options: Node, computed = false): Node => ({
  arguments: [name, options],
  callee: callee(method, computed),
  type: "CallExpression",
});
const described = (key: Node = identifier("description")): Node => ({
  properties: [option(key, literal("A TCP port."))],
  type: "ObjectExpression",
});

describe("require-description derived leads in process", () => {
  it("accepts a companion whose value annotation carries a description", () => {
    expect(run(annotation("annoteSchema", literal("Port"), described()))).toHaveLength(0);
  });
  it("accepts a path-qualified template identifier and a string-literal description key", () => {
    expect(run(annotation("annote", template("models/Port"), described(literal("description"))))).toHaveLength(0);
  });
  it("reports when the annotation names another export", () => {
    expect(run(annotation("annoteSchema", literal("Host"), described()))).toHaveLength(1);
  });
  it("reports when the annotation carries no description", () => {
    const titleOnly: Node = { properties: [option(identifier("title"), literal("Port"))], type: "ObjectExpression" };
    expect(run(annotation("annoteSchema", literal("Port"), titleOnly))).toHaveLength(1);
  });
  it("reports when the callee is not an annotation method", () => {
    const reports = A.flatMap(
      [
        annotation("annoteSchema", literal("Port"), described(), true),
        annotation("make", literal("Port"), described()),
      ],
      run
    );
    expect(reports).toHaveLength(2);
  });
});
