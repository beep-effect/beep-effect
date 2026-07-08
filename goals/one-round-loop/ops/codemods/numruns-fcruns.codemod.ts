/**
 * Codemod: migrate inline fast-check `numRuns:` options to the env-max
 * `fcRuns` helper (one-round-loop P1, orl-011).
 *
 * Inline `{ numRuns: N }` overrides `fc.configureGlobal`, so the nightly
 * property sweep cannot raise run counts across the repo while sites pin
 * literals. The migration turns every literal into a FLOOR:
 *
 * ```ts
 * fc.assert(property, { numRuns: 40 });
 * // becomes
 * fc.assert(property, fcRuns(40));
 *
 * fc.assert(property, { numRuns: 25, endOnFailure: true });
 * // becomes
 * fc.assert(property, { ...fcRuns(25), endOnFailure: true });
 * ```
 *
 * Precision over recall (packet fence 3 — floors never go down):
 * - Only `<fcAlias>.assert(...)` call sites are touched, where `fcAlias`
 *   is resolved from the file's `FastCheck` import off `effect/testing`.
 * - Only numeric-literal `numRuns` values are rewritten; identifiers and
 *   expressions are left untouched for the post-sweep `rg` proof.
 * - Options objects containing spreads are left untouched.
 * - `assertSchemaArbitraryDecodesToSelf` options are naturally out of
 *   scope (the helper already routes through `fcRuns` internally).
 *
 * Standalone: `bun goals/one-round-loop/ops/codemods/numruns-fcruns.codemod.ts <file...>`
 *
 * @since 0.0.0
 */
import { TSMorphService, TSMorphServiceLive } from "@beep/repo-utils";
import { NodeServices } from "@effect/platform-node";
import { Console, Effect, Layer } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { Node, SyntaxKind } from "ts-morph";
import type { TSMorphServiceError } from "@beep/repo-utils";
import type { CallExpression, ObjectLiteralExpression, SourceFile } from "ts-morph";

const FAST_CHECK_MODULE = "effect/testing";
const TEST_UTILS_MODULE = "@beep/test-utils";
const HELPER_NAME = "fcRuns";

/**
 * Packages inside `@beep/test-utils`' own dependency closure. `@beep/test-utils`
 * depends on `@beep/schema`, `@beep/utils`, and `@beep/pglite`, so migrating
 * their test files to `fcRuns` would make them import the helper back out of a
 * package that depends on them — a package cycle (greptile: "Cyclic Helper
 * Import"). The codemod leaves their inline `numRuns` untouched; lift this
 * carve-out by relocating `fcRuns` to a leaf package upstream of the closure.
 */
const TEST_UTILS_CLOSURE_MARKERS: ReadonlyArray<string> = [
  "/foundation/modeling/schema/",
  "/foundation/modeling/utils/",
  "/drivers/pglite/",
];

const isTestUtilsClosureFile = (filePath: string): boolean =>
  A.some(TEST_UTILS_CLOSURE_MARKERS, (marker) => Str.includes(marker)(filePath));

/**
 * Per-file codemod outcome.
 *
 * @example
 * ```ts
 * import type { NumRunsFcRunsResult } from "./numruns-fcruns.codemod.ts"
 *
 * const result: NumRunsFcRunsResult = { filePath: "/repo/test/a.test.ts", changed: true }
 * console.log(result.changed)
 * ```
 * @category models
 * @since 0.0.0
 */
export type NumRunsFcRunsResult = {
  readonly filePath: string;
  readonly changed: boolean;
};

const resolveFastCheckAlias = (sourceFile: SourceFile): O.Option<string> =>
  A.findFirst(
    A.flatMap(
      A.filter(
        sourceFile.getImportDeclarations(),
        (declaration) => declaration.getModuleSpecifierValue() === FAST_CHECK_MODULE
      ),
      (declaration) => declaration.getNamedImports()
    ),
    (named) => named.getName() === "FastCheck"
  ).pipe(O.map((named) => named.getAliasNode()?.getText() ?? named.getName()));

const isFcAssertCall = (call: CallExpression, fcAlias: string): boolean => {
  const expression = call.getExpression();
  if (!Node.isPropertyAccessExpression(expression)) {
    return false;
  }
  if (expression.getName() !== "assert") {
    return false;
  }
  const target = expression.getExpression();
  return Node.isIdentifier(target) && target.getText() === fcAlias;
};

const rewriteOptionsObject = (options: ObjectLiteralExpression): boolean => {
  const hasSpread = A.some(options.getProperties(), Node.isSpreadAssignment);
  if (hasSpread) {
    return false;
  }

  const numRunsProperty = options.getProperty("numRuns");
  if (numRunsProperty === undefined || !Node.isPropertyAssignment(numRunsProperty)) {
    return false;
  }

  const initializer = numRunsProperty.getInitializer();
  if (initializer === undefined || !Node.isNumericLiteral(initializer)) {
    return false;
  }

  const literal = initializer.getText();
  const otherProperties = A.filter(options.getProperties(), (property) => property !== numRunsProperty);

  if (A.isReadonlyArrayEmpty(otherProperties)) {
    options.replaceWithText(`${HELPER_NAME}(${literal})`);
    return true;
  }

  const rendered = A.join(
    A.map(otherProperties, (property) => property.getText()),
    ", "
  );
  options.replaceWithText(`{ ...${HELPER_NAME}(${literal}), ${rendered} }`);
  return true;
};

const ensureFcRunsImport = (sourceFile: SourceFile): void => {
  const existing = A.findFirst(
    sourceFile.getImportDeclarations(),
    (declaration) => declaration.getModuleSpecifierValue() === TEST_UTILS_MODULE && !declaration.isTypeOnly()
  );

  O.match(existing, {
    onNone: () => {
      sourceFile.addImportDeclaration({
        moduleSpecifier: TEST_UTILS_MODULE,
        namedImports: [HELPER_NAME],
      });
    },
    onSome: (declaration) => {
      const alreadyImported = A.some(declaration.getNamedImports(), (named) => named.getName() === HELPER_NAME);
      if (!alreadyImported) {
        declaration.addNamedImport(HELPER_NAME);
      }
    },
  });
};

const rewriteNumRunsToFcRuns = (sourceFile: SourceFile): boolean => {
  if (isTestUtilsClosureFile(sourceFile.getFilePath())) {
    return false;
  }

  const fcAlias = resolveFastCheckAlias(sourceFile);
  if (O.isNone(fcAlias)) {
    return false;
  }

  const rewritten = A.filter(
    A.filter(sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression), (call) => isFcAssertCall(call, fcAlias.value)),
    (call) => {
      const args = call.getArguments();
      const options = A.get(args, 1);
      return O.match(options, {
        onNone: () => false,
        onSome: (candidate) => (Node.isObjectLiteralExpression(candidate) ? rewriteOptionsObject(candidate) : false),
      });
    }
  );

  if (A.isReadonlyArrayEmpty(rewritten)) {
    return false;
  }

  ensureFcRunsImport(sourceFile);
  return true;
};

/**
 * Run the numRuns→fcRuns codemod over the given files.
 *
 * @param filePaths - Absolute paths of the files to rewrite.
 * @returns One `{ filePath, changed }` record per input file.
 * @example
 * ```ts
 * import { runNumRunsFcRunsCodemod } from "./numruns-fcruns.codemod.ts"
 *
 * const program = runNumRunsFcRunsCodemod(["/repo/packages/example/test/example.test.ts"])
 * console.log(typeof program)
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const runNumRunsFcRunsCodemod = (
  filePaths: ReadonlyArray<string>
): Effect.Effect<ReadonlyArray<NumRunsFcRunsResult>, TSMorphServiceError, TSMorphService> =>
  Effect.gen(function* () {
    const service = yield* TSMorphService;
    return yield* Effect.forEach(
      filePaths,
      (filePath) =>
        service
          .updateSourceFile(filePath, rewriteNumRunsToFcRuns)
          .pipe(Effect.map((changed): NumRunsFcRunsResult => ({ filePath, changed }))),
      { concurrency: 1 }
    );
  });

if (import.meta.main) {
  const filePaths = process.argv.slice(2);
  const MainLayer = TSMorphServiceLive.pipe(Layer.provideMerge(NodeServices.layer));
  Effect.runPromise(
    runNumRunsFcRunsCodemod(filePaths).pipe(
      Effect.flatMap((results) =>
        Effect.forEach(
          results,
          (result) => Console.log(`${result.changed ? "changed  " : "unchanged"}\t${result.filePath}`),
          {
            discard: true,
          }
        )
      ),
      Effect.tapCause((cause) => Console.error(cause)),
      Effect.provide(MainLayer)
    )
  ).catch(() => {
    process.exit(1);
  });
}
