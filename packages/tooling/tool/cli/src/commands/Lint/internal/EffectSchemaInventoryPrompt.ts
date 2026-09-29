/**
 * Lane prompt generation for one inventoried module.
 *
 * **Details**
 *
 * A row carries only a truncated signature, a summary, and an example flag, so the prompt
 * resolves every row's `file:line` against the pinned source and inlines the full top-level
 * declaration with its JSDoc block. A row that resolves to no declaration fails generation
 * rather than shipping a prompt with only the row's truncated fields.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, Str } from "@beep/utils";
import { Effect, HashSet, Inspectable, MutableHashMap, Order, Path, pipe } from "effect";
import * as O from "effect/Option";
import { ts } from "ts-morph";
import { writeArtifact } from "../../../internal/artifacts/index.ts";
import {
  EffectSchemaInventoryFixturePath,
  EffectSchemaInventoryGraftContext,
  EffectSchemaInventoryPromptReceipt,
  EffectSchemaInventoryPromptRoot,
} from "../EffectSchemaInventory.schemas.ts";
import { EffectSchemaInventoryError } from "../Lint.errors.ts";
import { effectSchemaInventoryJsDocBlocks } from "./EffectSchemaInventoryExtract.ts";
import { findEffectSchemaInventoryModule } from "./EffectSchemaInventoryModules.ts";
import { effectSchemaInventoryJsonlName } from "./EffectSchemaInventoryRender.ts";
import { EffectSchemaInventorySource } from "./EffectSchemaInventorySource.ts";
import { readEffectSchemaInventoryModuleRows } from "./EffectSchemaInventoryStore.ts";
import type {
  EffectSchemaInventoryGraftEntry,
  EffectSchemaInventoryModule,
  EffectSchemaInventoryPin,
  EffectSchemaInventoryRow,
} from "../EffectSchemaInventory.schemas.ts";

/**
 * One top-level declaration of the pinned source and the rows it declares. Overload signatures
 * and their implementation are consecutive statements, so they form one block.
 */
type DeclarationBlock = {
  readonly statements: A.NonEmptyReadonlyArray<ts.Statement>;
  readonly startLine: number;
  readonly endLine: number;
  readonly rows: ReadonlyArray<EffectSchemaInventoryRow>;
  readonly locals: ReadonlyArray<ts.Statement>;
};

const EXAMPLE_MARKER = /@example\b|\*\*Example\*\*/u;

const lineOf = (source: ts.SourceFile, position: number): number =>
  source.getLineAndCharacterOfPosition(position).line + 1;

const bindingNames = (name: ts.BindingName): ReadonlyArray<string> => {
  if (ts.isIdentifier(name)) return [name.text];
  const elements: ReadonlyArray<ts.ArrayBindingElement> = name.elements;
  return A.flatMap(A.filter(elements, ts.isBindingElement), (element: ts.BindingElement) => bindingNames(element.name));
};

const statementNames = (statement: ts.Statement): ReadonlyArray<string> => {
  if (ts.isVariableStatement(statement))
    return A.flatMap(statement.declarationList.declarations, (declaration) => bindingNames(declaration.name));
  if (
    ts.isFunctionDeclaration(statement) ||
    ts.isClassDeclaration(statement) ||
    ts.isInterfaceDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement) ||
    ts.isEnumDeclaration(statement) ||
    ts.isModuleDeclaration(statement)
  )
    return O.match(O.fromUndefinedOr(statement.name), {
      onNone: A.empty<string>,
      onSome: (name) => (ts.isIdentifier(name) || ts.isStringLiteral(name) ? [name.text] : []),
    });
  return [];
};

const functionName = (statement: ts.Statement): O.Option<string> =>
  ts.isFunctionDeclaration(statement) ? O.map(O.fromUndefinedOr(statement.name), (name) => name.text) : O.none();

const continuesOverloads = (previous: ts.Statement, statement: ts.Statement): boolean =>
  pipe(
    O.all([functionName(previous), functionName(statement)]),
    O.exists(([left, right]) => left === right)
  );

// Consecutive same-name function declarations (overloads plus implementation) grouped; every other statement alone.
const declarationGroups = (
  statements: ReadonlyArray<ts.Statement>
): ReadonlyArray<A.NonEmptyReadonlyArray<ts.Statement>> =>
  A.reduce(statements, A.empty<A.NonEmptyReadonlyArray<ts.Statement>>(), (groups, statement) =>
    pipe(
      A.last(groups),
      O.filter((group) => continuesOverloads(A.lastNonEmpty(group), statement)),
      O.match({
        onNone: () => A.append(groups, A.of(statement)),
        onSome: (group) => A.append(A.dropRight(groups, 1), A.append(group, statement)),
      })
    )
  );

// Local declarations named by a specifier-only `export { … }` statement, which the rows point at.
const exportedLocals = (
  statement: ts.Statement,
  byName: MutableHashMap.MutableHashMap<string, ts.Statement>
): ReadonlyArray<ts.Statement> => {
  if (!ts.isExportDeclaration(statement) || statement.moduleSpecifier !== undefined) return [];
  const clause = statement.exportClause;
  if (clause === undefined || !ts.isNamedExports(clause)) return [];
  // AST nodes compare by reference: Effect's structural equality would walk the whole tree.
  return A.dedupeWith(
    A.getSomes(
      A.map(clause.elements, (element) => MutableHashMap.get(byName, (element.propertyName ?? element.name).text))
    ),
    (self, that) => self === that
  );
};

const fenceFor = (content: string): string => {
  const longestRun = A.reduce(A.fromIterable(Str.matchAll(/`+/gu)(content)), 0, (longest, match) =>
    match[0].length > longest ? match[0].length : longest
  );
  return Str.repeat(longestRun >= 3 ? longestRun + 1 : 3)("`");
};

const cell = Str.replaceAll("|", "\\|");

const rowNotes = (row: EffectSchemaInventoryRow): string =>
  A.join(
    A.getSomes([
      row.overloads > 0 ? O.some(`${row.overloads} overload signature${row.overloads === 1 ? "" : "s"}`) : O.none(),
      row.hasExample ? O.some("example") : O.none(),
      row.internal ? O.some("`@internal`") : O.none(),
      row.deprecated ? O.some("deprecated") : O.none(),
      row.importable ? O.none() : O.some("not importable"),
    ]),
    ", "
  );

const topLevelSymbol = (row: EffectSchemaInventoryRow): string => A.headNonEmpty(Str.split(row.symbol, "."));

const renderBlock = (source: ts.SourceFile, text: string, block: DeclarationBlock): string => {
  const sliceWithDoc = (group: A.NonEmptyReadonlyArray<ts.Statement>): string => {
    const first = A.headNonEmpty(group);
    const start = pipe(
      A.head(effectSchemaInventoryJsDocBlocks(first)),
      O.map((doc) => doc.getStart(source)),
      O.getOrElse(() => first.getStart(source))
    );
    return Str.slice(start, A.lastNonEmpty(group).getEnd())(text);
  };
  const code = A.join(
    A.append(
      A.map(block.locals, (local) => sliceWithDoc(A.of(local))),
      sliceWithDoc(block.statements)
    ),
    "\n\n"
  );
  const fence = fenceFor(code);
  const names = A.join(
    A.map(A.dedupe(A.map(block.rows, topLevelSymbol)), (name) => `\`${name}\``),
    ", "
  );
  const localNote = A.isReadonlyArrayNonEmpty(block.locals)
    ? `\nThe export list re-exports local declarations; they are inlined ahead of the \`export\` statement.\n`
    : "";
  return A.join(
    [
      `### ${names} (lines ${block.startLine}-${block.endLine})`,
      localNote,
      "| Line | Symbol | Kind | Category | Since | Notes |",
      "| ---: | --- | --- | --- | --- | --- |",
      ...A.map(
        block.rows,
        (row) =>
          `| ${row.line} | \`${cell(row.symbol)}\` | ${row.kind} | ${cell(O.getOrElse(row.category, () => "-"))} | ${cell(O.getOrElse(row.since, () => "-"))} | ${rowNotes(row)} |`
      ),
      "",
      `${fence}ts`,
      code,
      fence,
      "",
    ],
    "\n"
  );
};

const renderGraft = (context: EffectSchemaInventoryGraftContext): string =>
  EffectSchemaInventoryGraftContext.match(context, {
    unavailable: ({ reason }) =>
      `Graft context is unavailable (${reason}). The declarations below are complete without it; graft is a local aid, never a hosted-CI input.\n`,
    available: ({ head, identicalAtPin, entries }) =>
      A.join(
        [
          `Graft skeleton of the reference working tree at HEAD \`${head}\`. ${
            identicalAtPin
              ? "The module source is byte-identical at HEAD and at the pin, so the spans match the inlined source."
              : "The module source differs between HEAD and the pin: spans and summaries describe HEAD, and the inlined source below is authoritative."
          } Summaries are graft's, not Effect's documentation.`,
          "",
          "| Span | Kind | Name | Summary |",
          "| --- | --- | --- | --- |",
          ...A.map(
            entries,
            (entry: EffectSchemaInventoryGraftEntry) =>
              `| ${entry.span} | ${cell(entry.kind)} | \`${cell(entry.name)}\` | ${cell(O.getOrElse(entry.summary, () => ""))} |`
          ),
          "",
        ],
        "\n"
      ),
  });

/**
 * Render the lane prompt for one module from its committed rows and pinned source text.
 *
 * **Details**
 *
 * Each row resolves to the top-level statement whose lines contain it; member rows fold into
 * their parent and namespace rows into their namespace. A specifier-only `export { … }` block
 * also inlines the local declarations it names. Generation fails when a row resolves to no
 * statement, when a row's file differs from the module's file, or when a row flagged
 * `hasExample` lands on inlined text without an example.
 *
 * **Example** (Render a prompt for one function)
 *
 * ```ts
 * import {
 *   EffectSchemaInventoryGraftContext,
 *   EffectSchemaInventoryModule,
 *   EffectSchemaInventoryRow,
 *   renderEffectSchemaInventoryPrompt
 * } from "@beep/repo-cli/commands/Lint"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const pin = "df77fff9396fe31de72d1947ecb5b74f8cee89e1"
 * const module = EffectSchemaInventoryModule.make({
 *   file: "packages/effect/src/Demo.ts", module: "effect/Demo", slug: "effect-Demo", importable: true
 * })
 * const row = EffectSchemaInventoryRow.make({
 *   sha: pin, module: "effect/Demo", file: "packages/effect/src/Demo.ts", line: 2, symbol: "hi",
 *   kind: "function", category: O.none(), since: O.none(), deprecated: false, internal: false,
 *   summary: "Says hi.", hasExample: false, signature: "export function hi(): string", overloads: 0, importable: true
 * })
 * const program = renderEffectSchemaInventoryPrompt({
 *   module,
 *   pin,
 *   rows: [row],
 *   source: "/** Says hi. *\/\nexport function hi(): string {\n  return \"hi\"\n}\n",
 *   graft: EffectSchemaInventoryGraftContext.cases.unavailable.make({ reason: "graft is not on PATH" })
 * })
 * Effect.runPromise(program).then((prompt) => console.log(prompt.includes("return \"hi\""))) // true
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const renderEffectSchemaInventoryPrompt = Effect.fn("EffectSchemaInventoryPrompt.render")(function* (input: {
  readonly module: EffectSchemaInventoryModule;
  readonly pin: EffectSchemaInventoryPin;
  readonly rows: ReadonlyArray<EffectSchemaInventoryRow>;
  readonly source: string;
  readonly graft: EffectSchemaInventoryGraftContext;
}) {
  const { module, pin, rows } = input;
  const foreign = A.filter(rows, (row) => row.file !== module.file || row.sha !== pin);
  if (A.isReadonlyArrayNonEmpty(foreign))
    return yield* EffectSchemaInventoryError.new(
      `Rows for ${module.module} must all read ${module.file} at ${pin}; ${foreign.length} do not (first: ${A.headNonEmpty(foreign).symbol}).`
    );
  const source = ts.createSourceFile(module.file, input.source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const groups = A.map(declarationGroups(source.statements), (statements) => ({
    statements,
    startLine: lineOf(source, A.headNonEmpty(statements).getStart(source)),
    endLine: lineOf(source, A.lastNonEmpty(statements).getEnd()),
  }));
  const byName = MutableHashMap.fromIterable(
    A.flatMap(source.statements, (statement) => A.map(statementNames(statement), (name) => [name, statement] as const))
  );
  const resolved = A.map(rows, (row) => ({
    row,
    at: A.findFirstIndex(groups, (entry) => entry.startLine <= row.line && row.line <= entry.endLine),
  }));
  const unresolved = A.filter(resolved, ({ at }) => O.isNone(at));
  if (A.isReadonlyArrayNonEmpty(unresolved))
    return yield* EffectSchemaInventoryError.new(
      `${unresolved.length} ${module.module} rows resolve to no declaration at ${pin}: ${A.join(
        A.map(A.take(unresolved, 5), ({ row }) => `${row.symbol}@${row.line}`),
        ", "
      )}`
    );
  const blockIndexes = A.dedupe(A.getSomes(A.map(resolved, ({ at }) => at)));
  // Statements are keyed by source position; AST nodes must not enter structural hashing.
  const blockStatementStarts = HashSet.fromIterable(
    A.flatMap(blockIndexes, (index) =>
      O.getOrElse(
        O.map(A.get(groups, index), (entry) => A.map(entry.statements, (statement) => statement.pos)),
        A.empty<number>
      )
    )
  );
  const blocks = A.getSomes(
    A.map(A.sort(blockIndexes, Order.Number), (index) =>
      O.map(
        A.get(groups, index),
        (entry): DeclarationBlock => ({
          ...entry,
          rows: A.map(
            A.filter(resolved, ({ at }) => O.exists(at, (value) => value === index)),
            ({ row }) => row
          ),
          locals: A.filter(
            exportedLocals(A.headNonEmpty(entry.statements), byName),
            (local) => !HashSet.has(blockStatementStarts, local.pos)
          ),
        })
      )
    )
  );
  const rendered = A.map(blocks, (block) => ({ block, text: renderBlock(source, input.source, block) }));
  const missingExamples = A.flatMap(rendered, ({ block, text }) =>
    O.isSome(Str.match(EXAMPLE_MARKER)(text)) ? [] : A.filter(block.rows, (row) => row.hasExample)
  );
  if (A.isReadonlyArrayNonEmpty(missingExamples))
    return yield* EffectSchemaInventoryError.new(
      `Rows flagged hasExample inline no example: ${A.join(
        A.map(A.take(missingExamples, 5), (row) => row.symbol),
        ", "
      )}`
    );
  const internalRows = A.filter(rows, (row) => row.internal).length;
  const shortPin = Str.slice(0, 10)(pin);
  return A.join(
    [
      `# Lane prompt: \`${module.module}\``,
      "",
      `Generated by \`bun run beep lint effect-schema-inventory --prompt ${module.module}\`. Regenerate it after every Effect pin change instead of editing it by hand.`,
      "",
      "## Provenance",
      "",
      "| Field | Value |",
      "| --- | --- |",
      `| Module | \`${module.module}\` (${module.importable ? "importable" : "provenance only: Effect's exports map nulls this path"}) |`,
      `| Pin | \`${pin}\`, the root \`package.json\` catalog \`effect\` entry |`,
      `| Source | \`${shortPin}:${module.file}\`, read with \`git -C .repos/effect show\` |`,
      `| Rows | ${rows.length} (${internalRows} \`@internal\`) from \`${EffectSchemaInventoryFixturePath}/${effectSchemaInventoryJsonlName(module.slug)}\` |`,
      `| Declarations | ${blocks.length} top-level declarations (overloads grouped), each inlined in full with its JSDoc |`,
      "",
      "## How to use this prompt",
      "",
      "This prompt is the knowledge half of a lane on the effect-schema-parity goal. The lane brief supplies the task, the phase done-signal, and the bounce conditions from `goals/effect-schema-parity/SPEC.md`.",
      "",
      "- Every declaration below is upstream Effect at the pin, inlined in full with its JSDoc block (signature, sections, examples). The reference checkout is not needed to read it.",
      "- Judge coverage facet by facet. Only a public symbol covers a facet: a row marked `@internal`, or a row of a module that is not importable, is provenance and never a coverage target.",
      "- Cite upstream evidence as `<file>:<line>` at the pin, using the line numbers in the tables.",
      "",
      "## Graft context",
      "",
      renderGraft(input.graft),
      "## Declarations",
      "",
      ...A.map(rendered, ({ text }) => text),
    ],
    "\n"
  );
});

/**
 * Generate and write the lane prompt for one module from the committed fixture and pinned source.
 *
 * **Details**
 *
 * Fails loud on the same inputs as `--check`: an unreadable catalog pin, a missing reference
 * clone, or a pin absent from it. It also fails when the module's committed rows carry a sha
 * other than the catalog pin (regenerate with `--write` first). The prompt defaults to
 * `<promptRoot>/<slug>.md`; a relative `out` resolves against the repository root and may not
 * escape it, while an absolute `out` is written as given.
 *
 * **Example** (Build a prompt generation)
 *
 * ```ts
 * import { generateEffectSchemaInventoryPrompt } from "@beep/repo-cli/commands/Lint"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * console.log(Effect.isEffect(generateEffectSchemaInventoryPrompt(process.cwd(), "effect/SchemaIssue", O.none()))) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const generateEffectSchemaInventoryPrompt = Effect.fn("EffectSchemaInventoryPrompt.generate")(function* (
  root: string,
  moduleName: string,
  out: O.Option<string>
) {
  const path = yield* Path.Path;
  const source = yield* EffectSchemaInventorySource;
  const module = yield* Effect.fromOption(findEffectSchemaInventoryModule(moduleName), () =>
    EffectSchemaInventoryError.new(`Unknown inventory module ${moduleName}.`)
  );
  const pin = yield* source.readPin;
  yield* source.verifyPin(pin);
  const rows = yield* readEffectSchemaInventoryModuleRows(root, module);
  if (A.some(rows, (row) => row.sha !== pin))
    return yield* EffectSchemaInventoryError.new(
      `${EffectSchemaInventoryFixturePath}/${effectSchemaInventoryJsonlName(module.slug)} is not at inventoryPin ${pin}; run lint effect-schema-inventory --write first.`
    );
  const text = yield* source.readPinned(pin, module.file);
  const graft = yield* source.graftContext(pin, module.file);
  const prompt = yield* renderEffectSchemaInventoryPrompt({ module, pin, rows, source: text, graft });
  const requested = O.getOrElse(out, () => path.join(EffectSchemaInventoryPromptRoot, `${module.slug}.md`));
  const target = path.resolve(root, requested);
  if (!path.isAbsolute(requested) && Str.startsWith("..")(path.relative(root, target)))
    return yield* EffectSchemaInventoryError.new(
      `--out ${requested} resolves outside the repository root; pass an absolute path to write elsewhere.`
    );
  yield* writeArtifact({
    path: target,
    body: prompt,
    onError: (cause) =>
      EffectSchemaInventoryError.new(`Unable to write ${target}: ${Inspectable.toStringUnknown(cause, 0)}`),
  });
  return EffectSchemaInventoryPromptReceipt.make({
    module: module.module,
    target: pipe(path.relative(root, target), (relative) => (Str.startsWith("..")(relative) ? target : relative)),
    rows: rows.length,
    graftAvailable: EffectSchemaInventoryGraftContext.guards.available(graft),
  });
});
