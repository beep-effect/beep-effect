/**
 * Codemod: absorb literal `?? default` body fallbacks into the schema field.
 *
 * A recurring smell (`SFV4-defaults`, S2) reads an optional schema field and
 * supplies its default inline in a function body:
 *
 * ```ts
 * export const resolveSize = (input: ChunkOptions): number => input.size ?? 1024;
 * ```
 *
 * When `size` is an `S.optionalKey(...)` field on a same-file `S.Class`/
 * `S.Struct`, the default belongs on the schema via
 * `SchemaUtils.withKeyDefaults(1024)` (see
 * `packages/agents/server/src/AssistantTurn/ScanState.ts:33`), after which the
 * body read simplifies to the plain field access.
 *
 * Assisted tier (SPEC.md §5.5 / README triage: 0.6-0.9): this codemod is a
 * PROPOSER — it computes a conservative candidate edit that a P2 remediation
 * agent reviews per diff. Precision beats recall, so it fires only on literal
 * (string/number/boolean) defaults over a field name that maps to exactly one
 * same-file `S.optionalKey` schema field with no default yet, and skips
 * everything ambiguous (computed defaults, imported schema owners, fields that
 * already carry a default).
 *
 * Standalone: `bun goals/repo-crispening-orchestration/ops/codemods/defaults-fallback.codemod.ts <file...>`
 *
 * @since 0.0.0
 */
import { TSMorphService, TSMorphServiceLive } from "@beep/repo-utils";
import { NodeServices } from "@effect/platform-node";
import { Console, Effect, Layer } from "effect";
import { Node, SyntaxKind } from "ts-morph";
import type { TSMorphServiceError } from "@beep/repo-utils";
import type { BinaryExpression, Expression, ObjectLiteralExpression, PropertyAssignment, SourceFile } from "ts-morph";

const SCHEMA_MODULE = "effect/Schema";
const SCHEMA_UTILS_MODULE = "@beep/schema";
const SCHEMA_UTILS_LOCAL = "SchemaUtils";

/** Combinators that already attach a default; a field carrying one is skipped. */
const DEFAULT_COMBINATORS = new Set<string>([
  "withKeyDefaults",
  "withConstantDefault",
  "withConstructorDefault",
  "withDecodingDefault",
  "withDecodingDefaultKey",
  "withEmptyArrayDefaults",
]);

/** Local namespace name for `import * as S from "effect/Schema"`, if any. */
const findSchemaAlias = (sourceFile: SourceFile): string | undefined => {
  for (const declaration of sourceFile.getImportDeclarations()) {
    if (declaration.getModuleSpecifierValue() !== SCHEMA_MODULE) {
      continue;
    }
    const namespaceImport = declaration.getNamespaceImport();
    if (namespaceImport !== undefined) {
      return namespaceImport.getText();
    }
  }
  return undefined;
};

/** True if `expression` (or a descendant) references `<schemaAlias>.<name>`. */
const referencesSchemaMember = (expression: Expression, schemaAlias: string, name: string): boolean => {
  const matches = (node: Node): boolean =>
    Node.isPropertyAccessExpression(node) &&
    node.getName() === name &&
    Node.isIdentifier(node.getExpression()) &&
    node.getExpression().getText() === schemaAlias;
  return matches(expression) || expression.getDescendants().some(matches);
};

/** True if the field initializer is `S.optionalKey(...)` and carries no default yet. */
const isBareOptionalKeyField = (initializer: Expression, schemaAlias: string): boolean => {
  if (!referencesSchemaMember(initializer, schemaAlias, "optionalKey")) {
    return false;
  }
  return !initializer
    .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
    .some((access) => DEFAULT_COMBINATORS.has(access.getName()));
};

/** The `{ field: schema }` object of an `S.Class` heritage call or an `S.Struct(...)` call. */
const collectSchemaFieldObjects = (
  sourceFile: SourceFile,
  schemaAlias: string
): ReadonlyArray<ObjectLiteralExpression> => {
  const objects: Array<ObjectLiteralExpression> = [];
  for (const declaration of sourceFile.getClasses()) {
    const heritage = declaration.getExtends();
    if (heritage === undefined) {
      continue;
    }
    // `class X extends S.Class<X>(id)(fields, ann)` — the heritage node is an
    // ExpressionWithTypeArguments; its expression is the outer call whose first
    // argument is the `{ field: schema }` object.
    const heritageCall = heritage.getExpression();
    if (!Node.isCallExpression(heritageCall)) {
      continue;
    }
    const [fields] = heritageCall.getArguments();
    if (fields !== undefined && Node.isObjectLiteralExpression(fields)) {
      objects.push(fields);
    }
  }
  for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const callee = call.getExpression();
    if (
      Node.isPropertyAccessExpression(callee) &&
      callee.getName() === "Struct" &&
      Node.isIdentifier(callee.getExpression()) &&
      callee.getExpression().getText() === schemaAlias
    ) {
      const [fields] = call.getArguments();
      if (fields !== undefined && Node.isObjectLiteralExpression(fields)) {
        objects.push(fields);
      }
    }
  }
  return objects;
};

/**
 * The single same-file bare-optionalKey field property assignment named `name`,
 * or `undefined` when there is none, several, or the field carries a default.
 */
const findUniqueOptionalField = (
  fieldObjects: ReadonlyArray<ObjectLiteralExpression>,
  name: string,
  schemaAlias: string
): PropertyAssignment | undefined => {
  const matches: Array<PropertyAssignment> = [];
  for (const object of fieldObjects) {
    const property = object.getProperty(name);
    if (property === undefined || !Node.isPropertyAssignment(property)) {
      continue;
    }
    const initializer = property.getInitializer();
    if (initializer !== undefined && isBareOptionalKeyField(initializer, schemaAlias)) {
      matches.push(property);
    }
  }
  return matches.length === 1 ? matches[0] : undefined;
};

/** A literal default: string / number / `true` / `false`. */
const isLiteralDefault = (node: Node): boolean =>
  Node.isStringLiteral(node) || Node.isNumericLiteral(node) || Node.isTrueLiteral(node) || Node.isFalseLiteral(node);

/** `<object>.<field> ?? <literal>` — returns the field name and default text. */
const asFallback = (
  node: BinaryExpression
): { readonly fieldName: string; readonly defaultText: string; readonly lhsText: string } | undefined => {
  if (node.getOperatorToken().getKind() !== SyntaxKind.QuestionQuestionToken) {
    return undefined;
  }
  const left = node.getLeft();
  if (!Node.isPropertyAccessExpression(left)) {
    return undefined;
  }
  const right = node.getRight();
  if (!isLiteralDefault(right)) {
    return undefined;
  }
  return { fieldName: left.getName(), defaultText: right.getText(), lhsText: left.getText() };
};

/** Ensure `import { SchemaUtils } from "@beep/schema"` is present. */
const ensureSchemaUtilsImport = (sourceFile: SourceFile): void => {
  for (const declaration of sourceFile.getImportDeclarations()) {
    if (declaration.getModuleSpecifierValue() !== SCHEMA_UTILS_MODULE) {
      continue;
    }
    if (declaration.getNamedImports().some((specifier) => specifier.getName() === SCHEMA_UTILS_LOCAL)) {
      return;
    }
    declaration.addNamedImport(SCHEMA_UTILS_LOCAL);
    return;
  }
  sourceFile.addImportDeclaration({
    moduleSpecifier: SCHEMA_UTILS_MODULE,
    namedImports: [SCHEMA_UTILS_LOCAL],
  });
};

/**
 * Pure ts-morph mutation callback for `TSMorphService.updateSourceFile`.
 *
 * @since 0.0.0
 */
export const rewriteDefaultsFallback = (sourceFile: SourceFile): void => {
  const schemaAlias = findSchemaAlias(sourceFile);
  if (schemaAlias === undefined) {
    return;
  }
  const fieldObjects = collectSchemaFieldObjects(sourceFile, schemaAlias);
  if (fieldObjects.length === 0) {
    return;
  }

  type Edit = {
    readonly binary: BinaryExpression;
    readonly field: PropertyAssignment;
    readonly defaultText: string;
    readonly lhsText: string;
  };
  // Two-pass: collect every candidate first, then drop ALL candidates whose
  // field is claimed more than once — a single schema default cannot serve
  // multiple (possibly divergent) call-site defaults, and absorbing only the
  // first would leave the file half-transformed (schema default added while a
  // redundant `??` survives in another body).
  const candidates: Array<Edit> = [];
  const claimCounts = new Map<PropertyAssignment, number>();

  for (const binary of sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression)) {
    const fallback = asFallback(binary);
    if (fallback === undefined) {
      continue;
    }
    const field = findUniqueOptionalField(fieldObjects, fallback.fieldName, schemaAlias);
    if (field === undefined) {
      continue;
    }
    claimCounts.set(field, (claimCounts.get(field) ?? 0) + 1);
    candidates.push({ binary, field, defaultText: fallback.defaultText, lhsText: fallback.lhsText });
  }

  const edits = candidates.filter((candidate) => claimCounts.get(candidate.field) === 1);

  if (edits.length === 0) {
    return;
  }

  ensureSchemaUtilsImport(sourceFile);

  for (const edit of edits) {
    const initializer = edit.field.getInitializer();
    if (initializer !== undefined) {
      initializer.replaceWithText(
        `${initializer.getText()}.pipe(${SCHEMA_UTILS_LOCAL}.withKeyDefaults(${edit.defaultText}))`
      );
    }
  }
  for (const edit of edits) {
    edit.binary.replaceWithText(edit.lhsText);
  }
};

/** Per-file outcome of a codemod run. */
export type DefaultsFallbackResult = {
  readonly filePath: string;
  readonly changed: boolean;
};

/**
 * Run the rewrite across the given files. Each file goes through
 * `updateSourceFile`, so a no-match file is a byte-identical no-op
 * (`changed: false`).
 *
 * @since 0.0.0
 */
export const runDefaultsFallbackCodemod = (
  filePaths: ReadonlyArray<string>
): Effect.Effect<ReadonlyArray<DefaultsFallbackResult>, TSMorphServiceError, TSMorphService> =>
  Effect.gen(function* () {
    const service = yield* TSMorphService;
    return yield* Effect.forEach(
      filePaths,
      (filePath) =>
        service
          .updateSourceFile(filePath, rewriteDefaultsFallback)
          .pipe(Effect.map((changed): DefaultsFallbackResult => ({ filePath, changed }))),
      { concurrency: 1 }
    );
  });

if (import.meta.main) {
  const filePaths = process.argv.slice(2);
  const MainLayer = TSMorphServiceLive.pipe(Layer.provideMerge(NodeServices.layer));
  Effect.runPromise(
    runDefaultsFallbackCodemod(filePaths).pipe(
      Effect.flatMap((results) =>
        Effect.forEach(
          results,
          (result) => Console.log(`${result.changed ? "changed  " : "unchanged"}\t${result.filePath}`),
          {
            discard: true,
          }
        )
      ),
      Effect.tapErrorCause((cause) => Console.error(cause)),
      Effect.provide(MainLayer)
    )
  ).catch(() => {
    process.exit(1);
  });
}
