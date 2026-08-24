/**
 * Codemod: colocate schema-derived capability consts onto their `S.Class` owner.
 *
 * A recurring smell (`SFV4-static-api`, S4) is a top-of-file wall of module
 * consts that merely re-expose a schema's own capabilities:
 *
 * ```ts
 * const isHeading = S.is(Heading);
 * const decodeHeading = S.decodeUnknownSync(Heading);
 * ```
 *
 * When `Heading` is an `S.Class`-family declaration **in the same file**, those
 * capabilities belong on the schema as in-body statics
 * (`static readonly is = S.is(Heading)`; see
 * `packages/foundation/modeling/md/src/Md.model.ts:873`), and local call sites
 * read `Heading.is(v)` instead of `isHeading(v)`.
 *
 * Assisted tier (SPEC.md §5.5 / README triage: 0.6-0.9): this codemod is a
 * PROPOSER — it computes a conservative candidate edit that a P2 remediation
 * agent reviews per diff. Precision beats recall, so it fires only on the exact
 * `S.is` / `S.decodeUnknownSync` / `S.decodeUnknownOption` / `S.encodeSync`
 * shapes over a same-file `S.Class` owner, and skips everything ambiguous
 * (exported consts, imported schema owners, static-name collisions).
 *
 * Standalone: `bun goals/repo-crispening-orchestration/ops/codemods/static-api-colocation.codemod.ts <file...>`
 *
 * @since 0.0.0
 */
import { TSMorphService, TSMorphServiceLive } from "@beep/repo-utils";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Console, Effect, Layer } from "effect";
import { Node, SyntaxKind } from "ts-morph";
import type { TSMorphServiceError } from "@beep/repo-utils";
import type { ClassDeclaration, Identifier, SourceFile, VariableDeclaration } from "ts-morph";

const SCHEMA_MODULE = "effect/Schema";

/**
 * The schema-derived capabilities this codemod relocates. Each maps a
 * `S.<method>(Owner)` const to the in-body static of the same name, so
 * `const isX = S.is(X)` becomes `static readonly is = S.is(X)` and `isX(v)`
 * becomes `X.is(v)`.
 */
const RELOCATABLE_METHODS = new Set<string>(["is", "decodeUnknownSync", "decodeUnknownOption", "encodeSync"]);

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

/** A same-file `S.Class`-family owner: `class X extends S.Class<X>(id)(...) {}`. */
const findSameFileClassOwner = (
  sourceFile: SourceFile,
  name: string,
  schemaAlias: string
): ClassDeclaration | undefined => {
  const declaration = sourceFile.getClass(name);
  if (declaration === undefined) {
    return undefined;
  }
  const heritage = declaration.getExtends();
  if (heritage === undefined) {
    return undefined;
  }
  // `S.Class<X>(id)(fields, ann)` — walk the leftmost identifier of the call
  // chain; it must be the `effect/Schema` namespace for this to be a schema class.
  let cursor: Node = heritage.getExpression();
  for (;;) {
    if (Node.isCallExpression(cursor) || Node.isPropertyAccessExpression(cursor)) {
      cursor = cursor.getExpression();
      continue;
    }
    break;
  }
  return Node.isIdentifier(cursor) && cursor.getText() === schemaAlias ? declaration : undefined;
};

/** A relocation target discovered on a non-exported module const. */
type RelocationTarget = {
  readonly constName: string;
  readonly declarationStart: number;
  readonly ownerName: string;
  readonly method: string;
  readonly sourceFilePath: string;
};

/** Identifier references to `target.constName` that resolve to the exact relocated const. */
const findUsageIdentifiers = (sourceFile: SourceFile, target: RelocationTarget): ReadonlyArray<Identifier> =>
  sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).filter((identifier) => {
    if (identifier.getText() !== target.constName) {
      return false;
    }
    const parent = identifier.getParent();
    const symbol = Node.isShorthandPropertyAssignment(parent) ? parent.getValueSymbol() : identifier.getSymbol();
    const resolvesToTarget = symbol
      ?.getDeclarations()
      .some(
        (declaration) =>
          declaration.getSourceFile().getFilePath() === target.sourceFilePath &&
          declaration.getStart() === target.declarationStart
      );
    if (resolvesToTarget !== true) {
      return false;
    }
    if (Node.isVariableDeclaration(parent) && parent.getNameNode() === identifier) {
      return false;
    }
    // `x.constName` property name, or `{ constName: ... }` key — not a read of our const.
    if (Node.isPropertyAccessExpression(parent) && parent.getNameNode() === identifier) {
      return false;
    }
    if (Node.isPropertyAssignment(parent) && parent.getNameNode() === identifier) {
      return false;
    }
    return true;
  });

/**
 * `const <constName> = <S>.<method>(<Owner>)` where the statement is not
 * exported, `<method>` is relocatable, and `<Owner>` is a same-file class.
 */
const asRelocationTarget = (
  sourceFile: SourceFile,
  declaration: VariableDeclaration,
  schemaAlias: string
): RelocationTarget | undefined => {
  const statement = declaration.getVariableStatement();
  if (statement === undefined || statement.isExported()) {
    return undefined;
  }
  const initializer = declaration.getInitializer();
  if (initializer === undefined || !Node.isCallExpression(initializer)) {
    return undefined;
  }
  const callee = initializer.getExpression();
  if (!Node.isPropertyAccessExpression(callee)) {
    return undefined;
  }
  const receiver = callee.getExpression();
  const method = callee.getName();
  if (!Node.isIdentifier(receiver) || receiver.getText() !== schemaAlias || !RELOCATABLE_METHODS.has(method)) {
    return undefined;
  }
  const args = initializer.getArguments();
  const [only] = args;
  if (args.length !== 1 || only === undefined || !Node.isIdentifier(only)) {
    return undefined;
  }
  const ownerName = only.getText();
  if (findSameFileClassOwner(sourceFile, ownerName, schemaAlias) === undefined) {
    return undefined;
  }
  return {
    constName: declaration.getName(),
    declarationStart: declaration.getStart(),
    ownerName,
    method,
    sourceFilePath: sourceFile.getFilePath(),
  };
};

/** True if the class already declares a member named `staticName`. */
const hasMemberNamed = (owner: ClassDeclaration, staticName: string): boolean =>
  owner.getMembers().some((member) => {
    if (
      Node.isPropertyDeclaration(member) ||
      Node.isMethodDeclaration(member) ||
      Node.isGetAccessorDeclaration(member)
    ) {
      return member.getName() === staticName;
    }
    return false;
  });

/**
 * Pure ts-morph mutation callback for `TSMorphService.updateSourceFile`.
 *
 * @since 0.0.0
 */
export const rewriteStaticApiColocation = (sourceFile: SourceFile): void => {
  const schemaAlias = findSchemaAlias(sourceFile);
  if (schemaAlias === undefined) {
    return;
  }

  const targets: Array<RelocationTarget> = [];
  const seenStatics = new Map<string, Set<string>>();
  for (const declaration of sourceFile.getVariableDeclarations()) {
    const target = asRelocationTarget(sourceFile, declaration, schemaAlias);
    if (target === undefined) {
      continue;
    }
    const owner = findSameFileClassOwner(sourceFile, target.ownerName, schemaAlias);
    if (owner === undefined) {
      continue;
    }
    // Skip when the in-body static name would collide with an existing member,
    // or with another relocation already claiming that static on the same owner.
    const claimed = seenStatics.get(target.ownerName) ?? new Set<string>();
    if (hasMemberNamed(owner, target.method) || claimed.has(target.method)) {
      continue;
    }
    claimed.add(target.method);
    seenStatics.set(target.ownerName, claimed);
    targets.push(target);
  }

  if (targets.length === 0) {
    return;
  }

  // Phase A: rewrite local reads `constName(...)` -> `Owner.method(...)`.
  // Shorthand object keys (`{ constName }`) cannot hold a member access, so
  // they expand to full assignments (`{ constName: Owner.method }`) instead.
  for (const target of targets) {
    const usageIdentifiers = [...findUsageIdentifiers(sourceFile, target)].sort(
      (left, right) => right.getStart() - left.getStart()
    );
    for (const identifier of usageIdentifiers) {
      const parent = identifier.getParent();
      if (Node.isShorthandPropertyAssignment(parent)) {
        parent.replaceWithText(`${target.constName}: ${target.ownerName}.${target.method}`);
      } else {
        identifier.replaceWithText(`${target.ownerName}.${target.method}`);
      }
    }
  }

  // Phase B: add the in-body statics (query owner by name so earlier edits do
  // not invalidate a cached node reference).
  for (const target of targets) {
    const owner = sourceFile.getClass(target.ownerName);
    if (owner === undefined) {
      continue;
    }
    owner.addMember(`static readonly ${target.method} = ${schemaAlias}.${target.method}(${target.ownerName});`);
  }

  // Phase C: remove the now-relocated module consts.
  for (const target of targets) {
    const declaration = sourceFile.getVariableDeclaration(target.constName);
    if (declaration === undefined) {
      continue;
    }
    const statement = declaration.getVariableStatement();
    if (statement !== undefined && statement.getDeclarations().length === 1) {
      statement.remove();
    } else {
      declaration.remove();
    }
  }
};

/** Per-file outcome of a codemod run. */
export type StaticApiColocationResult = {
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
export const runStaticApiColocationCodemod = (
  filePaths: ReadonlyArray<string>
): Effect.Effect<ReadonlyArray<StaticApiColocationResult>, TSMorphServiceError, TSMorphService> =>
  Effect.gen(function* () {
    const service = yield* TSMorphService;
    return yield* Effect.forEach(
      filePaths,
      (filePath) =>
        service
          .updateSourceFile(filePath, rewriteStaticApiColocation)
          .pipe(Effect.map((changed): StaticApiColocationResult => ({ filePath, changed }))),
      { concurrency: 1 }
    );
  });

if (import.meta.main) {
  const filePaths = process.argv.slice(2);
  const MainLayer = TSMorphServiceLive.pipe(Layer.provideMerge(NodeServices.layer));
  NodeRuntime.runMain(
    runStaticApiColocationCodemod(filePaths).pipe(
      Effect.flatMap((results) =>
        Effect.forEach(
          results,
          (result) => Console.log(`${result.changed ? "changed  " : "unchanged"}\t${result.filePath}`),
          {
            discard: true,
          }
        )
      ),
      Effect.provide(MainLayer)
    )
  );
}
