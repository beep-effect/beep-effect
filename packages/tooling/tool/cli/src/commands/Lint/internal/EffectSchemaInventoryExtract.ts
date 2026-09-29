/**
 * Syntax-only `schema-inventory/v1` extraction over pinned Effect sources.
 *
 * **Details**
 *
 * Ported from the effect-schema-parity research prototype without changing its output: the
 * TypeScript parser walks each module's top-level declarations, one level of public members,
 * and one level of namespace statements. No binder or checker runs, so rows are declaration
 * facets, not semantic symbols.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, Str } from "@beep/utils";
import { Effect, HashSet, MutableHashMap, Order, Path, pipe } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { ts } from "ts-morph";
import {
  EffectSchemaInventoryExtraction,
  EffectSchemaInventoryModuleRows,
  EffectSchemaInventoryRow,
} from "../EffectSchemaInventory.schemas.ts";
import { EffectSchemaInventoryError } from "../Lint.errors.ts";
import type {
  EffectSchemaInventoryKind,
  EffectSchemaInventoryModule,
  EffectSchemaInventoryPin,
} from "../EffectSchemaInventory.schemas.ts";

type Declared = { readonly node: ts.Node; readonly owner: ts.Node };
type RowDraft = typeof EffectSchemaInventoryRow.Encoded;

const decodeRow = S.decodeUnknownEffect(EffectSchemaInventoryRow);

/**
 * Collation used by the committed fixture: `String.prototype.localeCompare` with locale `en`.
 */
const localeOrder: Order.Order<string> = Order.make((self, that) => Str.localeCompare(that, ["en"])(self));

const rowOrder: Order.Order<EffectSchemaInventoryRow> = Order.combineAll([
  Order.mapInput(localeOrder, (row: EffectSchemaInventoryRow) => row.file),
  Order.mapInput(Order.Number, (row: EffectSchemaInventoryRow) => row.line),
  Order.mapInput(localeOrder, (row: EffectSchemaInventoryRow) => row.symbol),
  Order.mapInput(localeOrder, (row: EffectSchemaInventoryRow) => row.kind),
]);

const isTsNode = (value: unknown): value is ts.Node =>
  P.hasProperty(value, "kind") && P.isNumber(value.kind) && P.hasProperty(value, "getText");

const isJsDocNode = (value: unknown): value is ts.JSDoc => isTsNode(value) && ts.isJSDoc(value);

// Reads a node-valued property the public TypeScript typings do not declare on every node kind,
// reproducing the prototype's untyped `node.<key>` access.
const nodeProperty = (node: ts.Node, key: "body" | "name" | "type"): O.Option<ts.Node> => {
  if (!P.hasProperty(node, key)) return O.none();
  const value = node[key];
  return isTsNode(value) ? O.some(value) : O.none();
};

const arrayProperty = (
  node: ts.Node,
  key: "jsDoc" | "members" | "parseDiagnostics"
): O.Option<ReadonlyArray<unknown>> => {
  if (!P.hasProperty(node, key)) return O.none();
  const value = node[key];
  return A.isArray(value) ? O.some(value) : O.none();
};

/**
 * JSDoc blocks the parser attached to a node (`node.jsDoc`, an internal TypeScript field).
 *
 * **Example** (Read an interface's JSDoc)
 *
 * ```ts
 * import { effectSchemaInventoryJsDocBlocks } from "@beep/repo-cli/commands/Lint"
 * import { ts } from "ts-morph"
 *
 * const source = ts.createSourceFile("a.ts", "/** Doc. *\/\nexport interface A {}", ts.ScriptTarget.Latest, true)
 * const statement = source.statements[0]
 * console.log(statement === undefined ? 0 : effectSchemaInventoryJsDocBlocks(statement).length) // 1
 * ```
 *
 * @param node - Any parsed node; kinds the parser never attaches JSDoc to yield an empty array.
 * @returns The attached JSDoc blocks in source order.
 * @category parsing
 * @since 0.0.0
 */
export const effectSchemaInventoryJsDocBlocks = (node: ts.Node): ReadonlyArray<ts.JSDoc> =>
  O.match(arrayProperty(node, "jsDoc"), { onNone: A.empty<ts.JSDoc>, onSome: A.filter(isJsDocNode) });

const hasModifier = (node: ts.Node, kind: ts.SyntaxKind): boolean =>
  ts.canHaveModifiers(node) && A.some(ts.getModifiers(node) ?? [], (modifier) => modifier.kind === kind);

/**
 * Collapse whitespace and truncate to `limit` UTF-16 code units, ending in `…` when cut.
 *
 * **Example** (Collapse and truncate a preview)
 *
 * ```ts
 * import { compactEffectSchemaInventoryPreview } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(compactEffectSchemaInventoryPreview("  a\n   b  ", 300)) // "a b"
 * console.log(compactEffectSchemaInventoryPreview("abcdef", 4)) // "abc…"
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const compactEffectSchemaInventoryPreview: {
  (limit: number): (text: string) => string;
  (text: string, limit: number): string;
} = dual(2, (text: string, limit: number): string => {
  const value = pipe(text, Str.replace(/\s+/gu, " "), Str.trim);
  return value.length > limit ? `${Str.slice(0, limit - 1)(value)}…` : value;
});

const compact = (text: string): string => compactEffectSchemaInventoryPreview(text, 300);

const CATEGORY_TAG = /(?:^|\n)\s*@category\s+([^\n]+)/u;
const SINCE_TAG = /(?:^|\n)\s*@since\s+([^\n]+)/u;
const DEPRECATED_TAG = /@deprecated\b/u;
const INTERNAL_TAG = /@internal\b/u;
const EXAMPLE_MARKER = /@example\b|\*\*Example\*\*/u;
const SUMMARY_END = /\n\s*\n|(?:^|\n)\s*@/u;

const jsDocText = (node: ts.Node): string =>
  pipe(
    effectSchemaInventoryJsDocBlocks(node),
    A.map((block) => pipe(block.getText(), Str.replace(/^\/\*\*|\*\/$/gu, ""), Str.replace(/^\s*\* ?/gmu, ""))),
    A.join("\n"),
    Str.trim
  );

const tagValue = (raw: string, pattern: RegExp): string | null =>
  pipe(
    raw,
    Str.match(pattern),
    O.flatMap((match) => O.fromUndefinedOr(match[1])),
    O.map(Str.trim),
    O.getOrNull
  );

const docMetadata = (node: ts.Node) => {
  const raw = jsDocText(node);
  return {
    category: tagValue(raw, CATEGORY_TAG),
    since: tagValue(raw, SINCE_TAG),
    deprecated: O.isSome(Str.match(DEPRECATED_TAG)(raw)),
    internal: O.isSome(Str.match(INTERNAL_TAG)(raw)),
    summary: compactEffectSchemaInventoryPreview(A.headNonEmpty(Str.split(raw, SUMMARY_END)), 400),
    hasExample: O.isSome(Str.match(EXAMPLE_MARKER)(raw)),
  };
};

const KIND_TABLE: ReadonlyArray<readonly [(node: ts.Node) => boolean, EffectSchemaInventoryKind]> = [
  [(node) => ts.isVariableDeclaration(node) || ts.isBindingElement(node), "const"],
  [ts.isFunctionDeclaration, "function"],
  [ts.isClassDeclaration, "class"],
  [ts.isInterfaceDeclaration, "interface"],
  [ts.isTypeAliasDeclaration, "type"],
  [ts.isModuleDeclaration, "namespace"],
  [(node) => ts.isMethodDeclaration(node) || ts.isMethodSignature(node), "method"],
  [ts.isCallSignatureDeclaration, "call"],
  [(node) => ts.isConstructSignatureDeclaration(node) || ts.isConstructorDeclaration(node), "constructor"],
  [(node) => ts.isGetAccessor(node) || ts.isSetAccessor(node), "accessor"],
];

const kindOf = (node: ts.Node): EffectSchemaInventoryKind =>
  pipe(
    A.findFirst(KIND_TABLE, ([test]) => test(node)),
    O.map(([, kind]) => kind),
    O.getOrElse((): EffectSchemaInventoryKind => "property")
  );

const CALLABLE_KINDS = HashSet.make<ReadonlyArray<EffectSchemaInventoryKind>>(
  "function",
  "method",
  "call",
  "constructor"
);

const sliceText = (node: ts.Node, end: number): string => Str.slice(0, end)(node.getText());

const signatureOf = (node: ts.Node): string => {
  if (ts.isVariableDeclaration(node) || ts.isBindingElement(node)) {
    const name = node.name.getText();
    const type = ts.isVariableDeclaration(node) ? O.fromUndefinedOr(node.type) : O.none<ts.TypeNode>();
    if (O.isSome(type)) return compact(`const ${name}: ${type.value.getText()}`);
    const initializer = node.initializer;
    if (initializer !== undefined && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)))
      return compact(`const ${name} = ${sliceText(initializer, initializer.body.pos - initializer.pos)}`);
    return `const ${name}: <inferred; see source>`;
  }
  if (ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node))
    return compact(sliceText(node, node.members.pos - node.getStart() - 1));
  if (ts.isModuleDeclaration(node))
    return compact(
      O.match(O.fromUndefinedOr(node.body), {
        onNone: () => node.getText(),
        onSome: (body) => sliceText(node, body.pos - node.getStart()),
      })
    );
  return compact(
    O.match(nodeProperty(node, "body"), {
      onNone: () => node.getText(),
      onSome: (body) => sliceText(node, body.pos - node.getStart()),
    })
  );
};

const overloadCount = (node: ts.Node, kind: EffectSchemaInventoryKind): number => {
  if (HashSet.has(CALLABLE_KINDS, kind)) return O.isSome(nodeProperty(node, "body")) ? 0 : 1;
  return O.match(nodeProperty(node, "type"), {
    onNone: () => 0,
    onSome: (type) => (ts.isTypeLiteralNode(type) ? A.filter(type.members, ts.isCallSignatureDeclaration).length : 0),
  });
};

const bindingLeaves = (
  node: ts.VariableDeclaration | ts.BindingElement
): ReadonlyArray<ts.VariableDeclaration | ts.BindingElement> => {
  if (ts.isIdentifier(node.name)) return [node];
  const elements: ReadonlyArray<ts.ArrayBindingElement> = node.name.elements;
  return A.flatMap(A.filter(elements, ts.isBindingElement), bindingLeaves);
};

const declarationsOf = (statements: ReadonlyArray<ts.Statement>): ReadonlyArray<Declared> =>
  A.flatMap(
    statements,
    (statement): ReadonlyArray<Declared> =>
      ts.isVariableStatement(statement)
        ? A.map(A.flatMap(statement.declarationList.declarations, bindingLeaves), (node) => ({
            node,
            owner: statement,
          }))
        : [{ node: statement, owner: statement }]
  );

const memberName = (member: ts.Node): string =>
  O.match(nodeProperty(member, "name"), {
    onSome: (name) => name.getText(),
    onNone: () =>
      ts.isCallSignatureDeclaration(member) ? "<call>" : ts.isIndexSignatureDeclaration(member) ? "<index>" : "<new>",
  });

const isHiddenMember = (member: ts.Node): boolean =>
  hasModifier(member, ts.SyntaxKind.PrivateKeyword) ||
  hasModifier(member, ts.SyntaxKind.ProtectedKeyword) ||
  O.exists(nodeProperty(member, "name"), ts.isPrivateIdentifier);

const directMembers = (node: ts.Node): ReadonlyArray<ts.Node> =>
  pipe(
    arrayProperty(node, "members"),
    O.orElse(() =>
      pipe(
        nodeProperty(node, "type"),
        O.filter(ts.isTypeLiteralNode),
        O.map((type): ReadonlyArray<unknown> => type.members)
      )
    ),
    O.map(A.filter(isTsNode)),
    O.getOrElse(A.empty<ts.Node>)
  );

const specifierText = (name: ts.ModuleExportName): string => name.text;

/** Everything one module's walk needs, bundled so the recursive visitor stays a plain function. */
type ModuleWalk = {
  readonly pin: EffectSchemaInventoryPin;
  readonly module: EffectSchemaInventoryModule;
  readonly source: ts.SourceFile;
  readonly moduleFiles: HashSet.HashSet<string>;
  readonly resolveTarget: (from: string, specifier: string) => string;
  readonly drafts: MutableHashMap.MutableHashMap<string, RowDraft>;
  readonly order: Array<string>;
  readonly failures: Array<string>;
  starCount: number;
};

const addRow = (
  walk: ModuleWalk,
  node: ts.Node,
  owner: ts.Node,
  symbol: string,
  forced: O.Option<readonly [EffectSchemaInventoryKind, string]> = O.none()
): void => {
  const kind = O.match(forced, { onNone: () => kindOf(node), onSome: ([forcedKind]) => forcedKind });
  const key = `${symbol}|${kind}`;
  const count = overloadCount(node, kind);
  const existing = MutableHashMap.get(walk.drafts, key);
  if (O.isSome(existing)) {
    MutableHashMap.set(walk.drafts, key, { ...existing.value, overloads: existing.value.overloads + count });
    return;
  }
  walk.order.push(key);
  MutableHashMap.set(walk.drafts, key, {
    sha: walk.pin,
    module: walk.module.module,
    file: walk.module.file,
    line: walk.source.getLineAndCharacterOfPosition(owner.getStart()).line + 1,
    symbol,
    kind,
    ...docMetadata(owner),
    signature: O.match(forced, { onNone: () => signatureOf(node), onSome: ([, signature]) => signature }),
    overloads: count,
    importable: walk.module.importable,
  });
};

const visitStatements = (
  walk: ModuleWalk,
  statements: ReadonlyArray<ts.Statement>,
  prefix: string,
  depth: number
): void => {
  const declarations = declarationsOf(statements);
  // Later declarations of a name win, as with the prototype's `new Map(entries)`.
  const locals = MutableHashMap.fromIterable(
    A.getSomes(
      A.map(declarations, (declared) =>
        O.map(nodeProperty(declared.node, "name"), (name) => [name.getText(), declared] as const)
      )
    )
  );
  const emit = (node: ts.Node, owner: ts.Node, name: string): void => {
    const symbol = `${prefix}${name}`;
    addRow(walk, node, owner, symbol);
    if (depth !== 0) return;
    if (ts.isModuleDeclaration(node) && node.body !== undefined && ts.isModuleBlock(node.body)) {
      visitStatements(walk, node.body.statements, `${symbol}.`, 1);
      return;
    }
    for (const member of directMembers(node)) {
      if (isHiddenMember(member)) continue;
      addRow(walk, member, member, `${symbol}.${memberName(member)}`);
    }
  };
  for (const { node, owner } of declarations) {
    if (ts.isExportDeclaration(node)) {
      const clause = node.exportClause;
      if (clause === undefined) {
        walk.starCount += 1;
        continue;
      }
      if (ts.isNamespaceExport(clause)) {
        // A namespace re-export is one row; its target is inventoried under its own module path,
        // so the barrel never repeats the target's members.
        const specifier = node.moduleSpecifier;
        const target =
          specifier !== undefined && ts.isStringLiteral(specifier)
            ? O.some(walk.resolveTarget(walk.module.file, specifier.text))
            : O.none<string>();
        if (!O.exists(target, (file) => HashSet.has(walk.moduleFiles, file))) {
          walk.failures.push(
            `${walk.module.file} re-exports ${O.getOrElse(target, () => node.getText())} as a namespace; add it to the module list first`
          );
          continue;
        }
        addRow(
          walk,
          node,
          node,
          `${prefix}${specifierText(clause.name)}`,
          O.some(["namespace", compact(node.getText())])
        );
        continue;
      }
      for (const element of clause.elements) {
        const local = MutableHashMap.get(locals, specifierText(element.propertyName ?? element.name));
        if (node.moduleSpecifier === undefined && O.isSome(local)) {
          const owner = A.isReadonlyArrayNonEmpty(effectSchemaInventoryJsDocBlocks(element))
            ? element
            : local.value.owner;
          emit(local.value.node, owner, specifierText(element.name));
        } else {
          addRow(
            walk,
            element,
            element,
            `${prefix}${specifierText(element.name)}`,
            O.some(["re-export", compact(node.getText())])
          );
        }
      }
      continue;
    }
    const exportedName = nodeProperty(node, "name");
    if (O.isSome(exportedName) && hasModifier(owner, ts.SyntaxKind.ExportKeyword))
      emit(node, owner, exportedName.value.getText());
  }
};

const parseModule = Effect.fn("EffectSchemaInventoryExtract.parse")(function* (
  module: EffectSchemaInventoryModule,
  text: string
) {
  const source = ts.createSourceFile(module.file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (O.exists(arrayProperty(source, "parseDiagnostics"), A.isReadonlyArrayNonEmpty))
    return yield* EffectSchemaInventoryError.new(`Parse errors: ${module.file}`);
  return source;
});

/**
 * Extract `schema-inventory/v1` rows from the pinned text of every listed module.
 *
 * **Details**
 *
 * Every source is parsed before any row is emitted, and a parse error fails the whole pass.
 * Rows sort by file, line, symbol, and kind with `localeCompare(…, "en")`, the prototype's
 * collation, so regeneration reproduces committed bytes. A namespace re-export whose target is
 * not in the module list fails rather than silently dropping or duplicating rows.
 *
 * **Example** (Extract one exported function)
 *
 * ```ts
 * import { EffectSchemaInventoryModule, extractEffectSchemaInventory } from "@beep/repo-cli/commands/Lint"
 * import { NodeServices } from "@effect/platform-node"
 * import { Effect } from "effect"
 *
 * const module = EffectSchemaInventoryModule.make({
 *   file: "packages/effect/src/Demo.ts", module: "effect/Demo", slug: "effect-Demo", importable: true
 * })
 * const program = extractEffectSchemaInventory("df77fff9396fe31de72d1947ecb5b74f8cee89e1", [
 *   [module, "/** Says hi. *\/\nexport function hi(): string { return \"hi\" }\n"]
 * ])
 * Effect.runPromise(program.pipe(Effect.provide(NodeServices.layer))).then((extraction) =>
 *   console.log(extraction.modules[0]?.rows[0]?.signature) // "export function hi(): string"
 * )
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const extractEffectSchemaInventory = Effect.fn("EffectSchemaInventoryExtract.extract")(function* (
  pin: EffectSchemaInventoryPin,
  sources: ReadonlyArray<readonly [EffectSchemaInventoryModule, string]>
) {
  const path = yield* Path.Path;
  const moduleFiles = HashSet.fromIterable(A.map(sources, ([module]) => module.file));
  if (HashSet.size(moduleFiles) !== sources.length)
    return yield* EffectSchemaInventoryError.new("Duplicate file in the effect-schema-inventory module list.");
  const parsed = yield* Effect.forEach(sources, ([module, text]) =>
    Effect.map(parseModule(module, text), (source) => [module, source] as const)
  );
  const resolveTarget = (from: string, specifier: string): string =>
    path.normalize(path.join(path.dirname(from), specifier));
  let bareStarDeclarationsOmitted = 0;
  const modules = yield* Effect.forEach(
    parsed,
    Effect.fnUntraced(function* ([module, source]) {
      const walk: ModuleWalk = {
        pin,
        module,
        source,
        moduleFiles,
        resolveTarget,
        drafts: MutableHashMap.empty(),
        order: [],
        failures: [],
        starCount: 0,
      };
      visitStatements(walk, source.statements, "", 0);
      bareStarDeclarationsOmitted += walk.starCount;
      if (A.isReadonlyArrayNonEmpty(walk.failures))
        return yield* EffectSchemaInventoryError.new(A.join(walk.failures, "\n"));
      const rows = yield* Effect.forEach(
        A.getSomes(A.map(walk.order, (key) => MutableHashMap.get(walk.drafts, key))),
        (draft) =>
          decodeRow(draft).pipe(EffectSchemaInventoryError.mapError(`Invalid row ${draft.module} ${draft.symbol}`))
      );
      return EffectSchemaInventoryModuleRows.make({ module, rows: A.sort(rows, rowOrder) });
    })
  );
  return EffectSchemaInventoryExtraction.make({ parser: ts.version, bareStarDeclarationsOmitted, modules });
});
