import ts from "typescript";
import { describe, expect, it } from "vitest";

const rootFile = ts.sys.resolvePath("src/index.ts");
const chatFile = ts.sys.resolvePath("src/chat/index.ts");
const viewerFile = ts.sys.resolvePath("src/viewer.tsx");
const chatComposerFile = ts.sys.resolvePath("src/chat/chat-composer.tsx");

const program = ts.createProgram({
  rootNames: [rootFile, chatFile, viewerFile, chatComposerFile],
  options: {
    allowImportingTsExtensions: true,
    jsx: ts.JsxEmit.ReactJSX,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ESNext,
  },
});
const checker = program.getTypeChecker();

const exportedSymbol = (fileName: string, exportName: string): ts.Symbol => {
  const source = program.getSourceFile(fileName);
  if (source === undefined) throw new Error(`Missing compiler source: ${fileName}`);
  const moduleSymbol = checker.getSymbolAtLocation(source);
  if (moduleSymbol === undefined) throw new Error(`Missing compiler module symbol: ${fileName}`);
  const symbol = checker.getExportsOfModule(moduleSymbol).find((candidate) => candidate.name === exportName);
  if (symbol === undefined) throw new Error(`Missing compiler export symbol: ${exportName}`);
  return symbol;
};

const isDeprecated = (symbol: ts.Symbol): boolean =>
  symbol.getJsDocTags(checker).some((tag) => tag.name === "deprecated");

describe("compatibility facade deprecations", () => {
  it("marks representative root and chat aliases while keeping exact subpaths current", () => {
    expect(isDeprecated(exportedSymbol(rootFile, "EditorViewer"))).toBe(true);
    expect(isDeprecated(exportedSymbol(rootFile, "ChatComposer"))).toBe(true);
    expect(isDeprecated(exportedSymbol(chatFile, "ChatComposer"))).toBe(true);

    expect(isDeprecated(exportedSymbol(viewerFile, "EditorViewer"))).toBe(false);
    expect(isDeprecated(exportedSymbol(chatComposerFile, "ChatComposer"))).toBe(false);
  });
});
