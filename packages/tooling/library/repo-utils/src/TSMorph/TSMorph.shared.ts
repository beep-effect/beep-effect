/**
 * Shared TSMorph normalization helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoUtilsId } from "@beep/identity";
import { A, Str, Text, thunkEmptyStr } from "@beep/utils";
import { flow, Match, Order, pipe } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { DiagnosticCategory, Node } from "ts-morph";
import { SymbolKind, symbolCategoryFromKind } from "./TSMorph.model.ts";
import type * as Ordering from "effect/Ordering";
import type {
  ClassDeclaration,
  ConstructorDeclaration,
  DiagnosticMessageChain,
  EnumDeclaration,
  FunctionDeclaration,
  GetAccessorDeclaration,
  InterfaceDeclaration,
  MethodDeclaration,
  SetAccessorDeclaration,
  TypeAliasDeclaration,
} from "ts-morph";
import type { SourceText, TsMorphDiagnostic, Symbol as TsMorphSymbol } from "./TSMorph.model.ts";

const $I = $RepoUtilsId.create("TSMorph/TSMorph.shared");

/**
 * Supported declaration nodes for normalized TSMorph symbol extraction.
 *
 * **Example** (Import OutlineDeclaration type)
 *
 * ```ts
 * import type { OutlineDeclaration } from "@beep/repo-utils/TSMorph/TSMorph.shared"
 * type Example = OutlineDeclaration
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export type OutlineDeclaration =
  | ClassDeclaration
  | ConstructorDeclaration
  | EnumDeclaration
  | FunctionDeclaration
  | GetAccessorDeclaration
  | InterfaceDeclaration
  | MethodDeclaration
  | SetAccessorDeclaration
  | TypeAliasDeclaration;

const bySymbolNameAscending: Order.Order<TsMorphSymbol> = Order.mapInput(Order.String, (symbol) => symbol.name);
const bySymbolFilePathAscending: Order.Order<TsMorphSymbol> = Order.mapInput(Order.String, (symbol) => symbol.filePath);
const bySymbolStartLineAscending: Order.Order<TsMorphSymbol> = Order.mapInput(
  Order.Number,
  (symbol) => symbol.startLine
);

/**
 * Deterministic symbol ordering used by normalized TSMorph symbol collections.
 *
 * **Example** (Compare two symbols ascending)
 *
 * ```ts
 * import { byTsMorphSymbolAscending } from "@beep/repo-utils/TSMorph/TSMorph.shared"
 * import { Symbol as TsMorphSymbol } from "@beep/repo-utils"
 * import * as S from "effect/Schema"
 *
 * const decodeSymbol = S.decodeUnknownSync(TsMorphSymbol)
 * const helper = decodeSymbol({
 *   id: "src/User.ts::createUser#FunctionDeclaration",
 *   filePath: "src/User.ts",
 *   name: "createUser",
 *   qualifiedName: "createUser",
 *   kind: "FunctionDeclaration",
 *   category: "function",
 *   signature: "export function createUser() {}",
 *   docstring: null,
 *   summary: null,
 *   decorators: [],
 *   keywords: ["createUser", "FunctionDeclaration", "function"],
 *   parentId: null,
 *   startLine: 8,
 *   endLine: 8,
 *   byteOffset: 40,
 *   byteLength: 32,
 *   contentHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
 * })
 * const model = decodeSymbol({
 *   id: "src/User.ts::User#ClassDeclaration",
 *   filePath: "src/User.ts",
 *   name: "User",
 *   qualifiedName: "User",
 *   kind: "ClassDeclaration",
 *   category: "class",
 *   signature: "export class User {}",
 *   docstring: null,
 *   summary: "User model.",
 *   decorators: [],
 *   keywords: ["User", "ClassDeclaration", "class"],
 *   parentId: null,
 *   startLine: 1,
 *   endLine: 1,
 *   byteOffset: 0,
 *   byteLength: 20,
 *   contentHash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
 * })
 * console.log(byTsMorphSymbolAscending(helper, model))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const byTsMorphSymbolAscending: {
  (that: TsMorphSymbol): (self: TsMorphSymbol) => Ordering.Ordering;
  (self: TsMorphSymbol, that: TsMorphSymbol): Ordering.Ordering;
} = dual(2, Order.combine(bySymbolNameAscending, Order.combine(bySymbolFilePathAscending, bySymbolStartLineAscending)));

const byDiagnosticStartLineAscending: Order.Order<TsMorphDiagnostic> = Order.mapInput(
  Order.Number,
  (diagnostic) => diagnostic.startLine
);
const byDiagnosticStartColumnAscending: Order.Order<TsMorphDiagnostic> = Order.mapInput(
  Order.Number,
  (diagnostic) => diagnostic.startColumn
);
const byDiagnosticCodeAscending: Order.Order<TsMorphDiagnostic> = Order.mapInput(
  Order.Number,
  (diagnostic) => diagnostic.code
);

/**
 * Deterministic ordering for normalized diagnostics.
 *
 * **Example** (Compare two diagnostics ascending)
 *
 * ```ts
 * import { byNormalizedDiagnosticAscending } from "@beep/repo-utils/TSMorph/TSMorph.shared"
 * import { TsMorphDiagnostic } from "@beep/repo-utils"
 * import * as S from "effect/Schema"
 *
 * const decodeDiagnostic = S.decodeUnknownSync(TsMorphDiagnostic)
 * const missingName = decodeDiagnostic({
 *   category: "error",
 *   code: 2304,
 *   message: "Cannot find name 'User'.",
 *   source: null,
 *   startLine: 1,
 *   startColumn: 8,
 *   endLine: 1,
 *   endColumn: 12
 * })
 * const unusedLocal = decodeDiagnostic({
 *   category: "warning",
 *   code: 6133,
 *   message: "'user' is declared but its value is never read.",
 *   source: "ts",
 *   startLine: 4,
 *   startColumn: 7,
 *   endLine: 4,
 *   endColumn: 11
 * })
 * console.log(byNormalizedDiagnosticAscending(missingName, unusedLocal))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const byNormalizedDiagnosticAscending: {
  (that: TsMorphDiagnostic): (self: TsMorphDiagnostic) => Ordering.Ordering;
  (self: TsMorphDiagnostic, that: TsMorphDiagnostic): Ordering.Ordering;
} = dual(
  2,
  Order.combine(
    byDiagnosticStartLineAscending,
    Order.combine(byDiagnosticStartColumnAscending, byDiagnosticCodeAscending)
  )
);

const firstSignatureLine = (text: string): string =>
  pipe(
    Str.split("\n")(text),
    A.map(Str.trim),
    A.findFirst(Str.isNonEmpty),
    O.getOrElse(() => Str.trim(text))
  );

/**
 * Read the normalized JSDoc description text attached to a declaration.
 *
 * **Example** (Read function docstring)
 *
 * ```ts
 * import { readDocstring } from "@beep/repo-utils/TSMorph/TSMorph.shared"
 * import { Project } from "ts-morph"
 *
 * const sourceFile = new Project({ useInMemoryFileSystem: true }).createSourceFile(
 *   "src/example.ts",
 *   "/** Reads source text. *\/\nexport function readSourceText() {}"
 * )
 * const docstring = readDocstring(sourceFile.getFunctionOrThrow("readSourceText"))
 * console.log(docstring)
 * ```
 *
 * @param node - Declaration node that may carry JSDoc metadata.
 * @returns Normalized declaration description text when present.
 * @category utilities
 * @since 0.0.0
 */
export const readDocstring = (node: OutlineDeclaration): O.Option<string> => {
  if (!Node.isJSDocable(node)) {
    return O.none();
  }

  const descriptions = pipe(
    node.getJsDocs(),
    A.map(flow((jsDoc) => jsDoc.getDescription(), Str.trim)),
    A.filter(Str.isNonEmpty),
    A.join("\n\n")
  );

  return Str.isNonEmpty(descriptions) ? O.some(descriptions) : O.none();
};

/**
 * Read normalized decorator text attached to a declaration.
 *
 * **Example** (Read class decorators)
 *
 * ```ts
 * import { readDecorators } from "@beep/repo-utils/TSMorph/TSMorph.shared"
 * import { Project } from "ts-morph"
 *
 * const sourceFile = new Project({ useInMemoryFileSystem: true }).createSourceFile(
 *   "src/example.ts",
 *   "@sealed\nexport class User {}"
 * )
 * const decorators = readDecorators(sourceFile.getClassOrThrow("User"))
 * console.log(decorators)
 * ```
 *
 * @param node - Declaration node that may carry decorators.
 * @returns Normalized decorator source text in declaration order.
 * @category utilities
 * @since 0.0.0
 */
export const readDecorators = (node: OutlineDeclaration): ReadonlyArray<string> =>
  Node.isDecoratable(node)
    ? pipe(node.getDecorators(), A.map(flow((decorator) => decorator.getText(), Str.trim)), A.filter(Str.isNonEmpty))
    : A.empty();

/**
 * Read the first non-empty signature line for a declaration.
 *
 * **Example** (Read function signature)
 *
 * ```ts
 * import { readSignature } from "@beep/repo-utils/TSMorph/TSMorph.shared"
 * import { Project } from "ts-morph"
 *
 * const sourceFile = new Project({ useInMemoryFileSystem: true }).createSourceFile(
 *   "src/example.ts",
 *   "export function readSourceText(filePath: string): string { return filePath }"
 * )
 * const signature = readSignature(sourceFile.getFunctionOrThrow("readSourceText"))
 * console.log(signature)
 * ```
 *
 * @param node - Declaration node to read.
 * @returns First non-empty line from the declaration source text.
 * @category utilities
 * @since 0.0.0
 */
export const readSignature = (node: OutlineDeclaration): string => {
  const signatureSourceText = pipe(
    Node.isDecoratable(node) ? node.getDecorators() : A.empty(),
    A.last,
    O.map((decorator) => Str.slice(decorator.getEnd(), node.getEnd())(node.getSourceFile().getFullText())),
    O.getOrElse(() => node.getText())
  );

  return firstSignatureLine(signatureSourceText);
};

/**
 * Derive the normalized summary text for a declaration.
 *
 * **Example** (Summarize optional docstring)
 *
 * ```ts
 * import { makeSummary } from "@beep/repo-utils/TSMorph/TSMorph.shared"
 * import * as O from "effect/Option"
 *
 * const summary = makeSummary(O.some("Reads source text."))
 * console.log(summary)
 * ```
 *
 * @param docstring - Optional normalized JSDoc description text.
 * @returns Stable summary text used by the public symbol model.
 * @category utilities
 * @since 0.0.0
 */
export const makeSummary = (docstring: O.Option<string>): O.Option<string> => docstring;

/**
 * Build stable symbol keywords from normalized declaration metadata.
 *
 * **Example** (Build symbol keywords)
 *
 * ```ts
 * import { makeKeywords } from "@beep/repo-utils/TSMorph/TSMorph.shared"
 *
 * const keywords = makeKeywords("readSourceText", "TSMorphService.readSourceText", {
 *   kind: "MethodDeclaration"
 * })
 * console.log(keywords)
 * ```
 *
 * @param name - Symbol display name.
 * @param qualifiedName - Fully qualified symbol path.
 * @param kind - Public symbol kind literal.
 * @returns Stable keyword set used by the public symbol model.
 * @category utilities
 * @since 0.0.0
 */
export const makeKeywords: {
  (
    qualifiedName: string,
    options: {
      readonly kind: SymbolKind;
    }
  ): (name: string) => ReadonlyArray<string>;
  (
    name: string,
    qualifiedName: string,
    options: {
      readonly kind: SymbolKind;
    }
  ): ReadonlyArray<string>;
} = dual(
  3,
  (
    name: string,
    qualifiedName: string,
    options: {
      readonly kind: SymbolKind;
    }
  ): ReadonlyArray<string> => A.make(name, qualifiedName, options.kind, symbolCategoryFromKind(options.kind))
);

/**
 * Build deterministic lowercased search text for a normalized symbol entry.
 *
 * **Example** (Build symbol search text)
 *
 * ```ts
 * import { makeScopeSymbolSearchText } from "@beep/repo-utils/TSMorph/TSMorph.shared"
 * import { SourceText, Symbol as TsMorphSymbol } from "@beep/repo-utils"
 * import * as S from "effect/Schema"
 *
 * const symbol = S.decodeUnknownSync(TsMorphSymbol)({
 *   id: "src/User.ts::User#ClassDeclaration",
 *   filePath: "src/User.ts",
 *   name: "User",
 *   qualifiedName: "User",
 *   kind: "ClassDeclaration",
 *   category: "class",
 *   signature: "export class User {}",
 *   docstring: "Represents an application user.",
 *   summary: "User model.",
 *   decorators: [],
 *   keywords: ["User", "ClassDeclaration", "class"],
 *   parentId: null,
 *   startLine: 1,
 *   endLine: 1,
 *   byteOffset: 0,
 *   byteLength: 20,
 *   contentHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
 * })
 * const sourceText = S.decodeUnknownSync(SourceText)("export class User {}")
 * const searchText = makeScopeSymbolSearchText(symbol, sourceText)
 * console.log(searchText.includes("application user"))
 * ```
 *
 * @param symbol - Public normalized symbol metadata.
 * @param sourceText - Extracted declaration source text.
 * @returns Lowercased search corpus for symbol lookup and filtering.
 * @category utilities
 * @since 0.0.0
 */
export const makeScopeSymbolSearchText: {
  (sourceText: SourceText): (symbol: TsMorphSymbol) => string;
  (symbol: TsMorphSymbol, sourceText: SourceText): string;
} = dual(2, (symbol: TsMorphSymbol, sourceText: SourceText): string =>
  pipe(
    A.make(
      symbol.name,
      symbol.qualifiedName,
      symbol.signature,
      O.getOrElse(symbol.summary, thunkEmptyStr),
      O.getOrElse(symbol.docstring, thunkEmptyStr),
      sourceText
    ),
    A.map(Str.trim),
    A.filter(Str.isNonEmpty),
    A.join(" "),
    Str.toLowerCase
  )
);

const flattenDiagnosticMessageTextMatcher = Match.type<string | DiagnosticMessageChain>().pipe(
  Match.when(P.isString, (text) => text),
  Match.orElse((messageChain) =>
    pipe(
      messageChain.getNext() ?? A.empty<DiagnosticMessageChain>(),
      A.reduce(A.make(messageChain.getMessageText()), (lines, next) => {
        const nextText = flattenDiagnosticMessageText(next);
        return Str.isNonEmpty(nextText) ? A.append(lines, nextText) : lines;
      }),
      A.filter(Str.isNonEmpty),
      Text.joinLines
    )
  )
);

/**
 * Flatten a TypeScript diagnostic message chain into normalized text.
 *
 * **Example** (Flatten diagnostic message)
 *
 * ```ts
 * import { flattenDiagnosticMessageText } from "@beep/repo-utils/TSMorph/TSMorph.shared"
 *
 * const message = flattenDiagnosticMessageText("TS2304: Cannot find name 'x'.")
 * console.log(message)
 * ```
 *
 * @param message - Diagnostic string or nested TypeScript message chain.
 * @returns Normalized multi-line diagnostic text.
 * @category utilities
 * @since 0.0.0
 */
export const flattenDiagnosticMessageText = (message: string | DiagnosticMessageChain): string =>
  flattenDiagnosticMessageTextMatcher(message);

const errorDiagnosticCategory: TsMorphDiagnostic["category"] = "error";
const warningDiagnosticCategory: TsMorphDiagnostic["category"] = "warning";
const suggestionDiagnosticCategory: TsMorphDiagnostic["category"] = "suggestion";
const messageDiagnosticCategory: TsMorphDiagnostic["category"] = "message";

const normalizeDiagnosticCategoryMatcher = Match.type<DiagnosticCategory>().pipe(
  Match.when(DiagnosticCategory.Error, () => errorDiagnosticCategory),
  Match.when(DiagnosticCategory.Warning, () => warningDiagnosticCategory),
  Match.when(DiagnosticCategory.Suggestion, () => suggestionDiagnosticCategory),
  Match.orElse(() => messageDiagnosticCategory)
);

/**
 * Normalize TypeScript diagnostic categories into the public service literal domain.
 *
 * **Example** (Normalize error category)
 *
 * ```ts
 * import { normalizeDiagnosticCategory } from "@beep/repo-utils/TSMorph/TSMorph.shared"
 * import { DiagnosticCategory } from "ts-morph"
 *
 * const category = normalizeDiagnosticCategory(DiagnosticCategory.Error)
 * console.log(category)
 * ```
 *
 * @param category - Raw TypeScript diagnostic category.
 * @returns Public service diagnostic category literal.
 * @category utilities
 * @since 0.0.0
 */
export const normalizeDiagnosticCategory = (category: DiagnosticCategory): TsMorphDiagnostic["category"] =>
  normalizeDiagnosticCategoryMatcher(category);

/**
 * Named declaration summary discovered from a TypeScript source file.
 *
 * **Example** (Create named declaration)
 *
 * ```ts
 * import { NamedDeclaration } from "@beep/repo-utils/TSMorph/TSMorph.shared"
 *
 * const declaration = NamedDeclaration.make({
 *   name: "readSourceText",
 *   kind: "MethodDeclaration"
 * })
 * console.log(declaration.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NamedDeclaration extends S.Class<NamedDeclaration>($I`NamedDeclaration`)(
  {
    name: S.String,
    kind: SymbolKind,
  },
  $I.annote("NamedDeclaration", {
    description: "Represents a named declaration with a name and kind",
  })
) {
  static readonly newOption: {
    (name: string, kind: SymbolKind): O.Option<NamedDeclaration>;
    (kind: SymbolKind): (name: string) => O.Option<NamedDeclaration>;
  } = dual(
    2,
    (name: string, kind: SymbolKind): O.Option<NamedDeclaration> =>
      pipe(
        NamedDeclaration.make({
          name,
          kind,
        }),
        O.some
      )
  );
}

/**
 * Read the normalized name and kind for a supported declaration node.
 *
 * **Example** (Read interface declaration name)
 *
 * ```ts
 * import { getDeclarationName } from "@beep/repo-utils/TSMorph/TSMorph.shared"
 * import { Project } from "ts-morph"
 *
 * const sourceFile = new Project({ useInMemoryFileSystem: true }).createSourceFile(
 *   "src/example.ts",
 *   "export interface SearchSymbolsRequest { query: string }"
 * )
 * const declaration = getDeclarationName(sourceFile.getInterfaceOrThrow("SearchSymbolsRequest"))
 * console.log(declaration)
 * ```
 *
 * @param declaration - Supported declaration node to inspect.
 * @returns Normalized declaration name and public kind when available.
 * @category utilities
 * @since 0.0.0
 */
export const getDeclarationName = (declaration: OutlineDeclaration): O.Option<NamedDeclaration> => {
  if (Node.isConstructorDeclaration(declaration)) {
    return NamedDeclaration.newOption("constructor", "Constructor");
  }

  if (Node.isFunctionDeclaration(declaration)) {
    return pipe(declaration.getName(), O.fromUndefinedOr, O.flatMap(NamedDeclaration.newOption("FunctionDeclaration")));
  }

  if (Node.isClassDeclaration(declaration)) {
    return pipe(declaration.getName(), O.fromUndefinedOr, O.flatMap(NamedDeclaration.newOption("ClassDeclaration")));
  }

  if (Node.isMethodDeclaration(declaration)) {
    return NamedDeclaration.newOption(declaration.getName(), "MethodDeclaration");
  }

  if (Node.isGetAccessorDeclaration(declaration)) {
    return NamedDeclaration.newOption(declaration.getName(), "GetAccessor");
  }

  if (Node.isSetAccessorDeclaration(declaration)) {
    return NamedDeclaration.newOption(declaration.getName(), "SetAccessor");
  }

  if (Node.isInterfaceDeclaration(declaration)) {
    return pipe(
      declaration.getName(),
      O.fromUndefinedOr,
      O.flatMap(NamedDeclaration.newOption("InterfaceDeclaration"))
    );
  }

  if (Node.isTypeAliasDeclaration(declaration)) {
    return pipe(
      declaration.getName(),
      O.fromUndefinedOr,
      O.flatMap(NamedDeclaration.newOption("TypeAliasDeclaration"))
    );
  }

  return pipe(declaration.getName(), O.fromUndefinedOr, O.flatMap(NamedDeclaration.newOption("EnumDeclaration")));
};

/**
 * Extend a parent symbol qualified name with one child declaration segment.
 *
 * **Example** (Qualify root declaration name)
 *
 * ```ts
 * import { pipeQualifiedName } from "@beep/repo-utils/TSMorph/TSMorph.shared"
 * import * as O from "effect/Option"
 *
 * const qualifiedName = pipeQualifiedName(O.none(), "SearchSymbolsRequest")
 * console.log(qualifiedName)
 * ```
 *
 * @param parentSymbol - Parent symbol, when the declaration is nested.
 * @param name - Child declaration name segment.
 * @returns Qualified symbol name anchored to the nearest parent symbol.
 * @category utilities
 * @since 0.0.0
 */
export const pipeQualifiedName: {
  (name: string): (parentSymbol: O.Option<TsMorphSymbol>) => string;
  (parentSymbol: O.Option<TsMorphSymbol>, name: string): string;
} = dual(2, (parentSymbol: O.Option<TsMorphSymbol>, name: string): string =>
  O.isSome(parentSymbol) ? `${parentSymbol.value.qualifiedName}.${name}` : name
);
