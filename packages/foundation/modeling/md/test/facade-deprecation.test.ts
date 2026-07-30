import ts from "typescript";
import { describe, expect, it } from "vitest";

const rootFile = ts.sys.resolvePath("src/Md.ts");
const program = ts.createProgram({
  rootNames: [rootFile],
  options: {
    allowImportingTsExtensions: true,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ESNext,
  },
});
const checker = program.getTypeChecker();

const facadeProperty = (propertyName: string): ts.Symbol => {
  const source = program.getSourceFile(rootFile);
  if (source === undefined) throw new Error(`Missing compiler source: ${rootFile}`);
  const moduleSymbol = checker.getSymbolAtLocation(source);
  if (moduleSymbol === undefined) throw new Error(`Missing compiler module symbol: ${rootFile}`);
  const facade = checker.getExportsOfModule(moduleSymbol).find((candidate) => candidate.name === "Md");
  if (facade === undefined) throw new Error("Missing compiler export symbol: Md");
  const declaration = facade.valueDeclaration ?? facade.declarations?.[0];
  if (declaration === undefined) throw new Error("Missing compiler declaration: Md");
  const property = checker.getTypeOfSymbolAtLocation(facade, declaration).getProperty(propertyName);
  if (property === undefined) throw new Error(`Missing Md facade property: ${propertyName}`);
  return property;
};

const isDeprecated = (symbol: ts.Symbol): boolean =>
  symbol.getJsDocTags(checker).some((tag) => tag.name === "deprecated");

describe("Md facade deprecations", () => {
  it("marks the ambiguous task-list adapter while keeping the canonical builder current", () => {
    expect(isDeprecated(facadeProperty("taskList"))).toBe(true);
    expect(isDeprecated(facadeProperty("taskListFromItems"))).toBe(false);
  });
});
