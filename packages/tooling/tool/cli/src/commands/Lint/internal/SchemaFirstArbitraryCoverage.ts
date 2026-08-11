/**
 * Schema-derived arbitrary coverage detector for schema-first test files.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, Str } from "@beep/utils";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import { Node, SyntaxKind } from "ts-morph";
import { createInMemoryTsMorphProject } from "../../../internal/tsmorph/index.ts";
import { SchemaFirstInventoryEntry } from "../Lint.schemas.ts";

const SCHEMA_CODEC_HELPERS = [
  // Effect-returning codecs.
  "decodeUnknownEffect",
  "decodeEffect",
  "encodeUnknownEffect",
  "encodeEffect",
  // Result-returning codecs.
  "decodeUnknownResult",
  "decodeResult",
  "encodeUnknownResult",
  "encodeResult",
  // Option-returning codecs.
  "decodeUnknownOption",
  "decodeOption",
  "encodeUnknownOption",
  "encodeOption",
  // Exit-returning codecs.
  "decodeUnknownExit",
  "decodeExit",
  "encodeUnknownExit",
  "encodeExit",
  // Promise-returning codecs.
  "decodeUnknownPromise",
  "decodePromise",
  "encodeUnknownPromise",
  "encodePromise",
  // Synchronous throwing codecs (most common in unit tests).
  "decodeUnknownSync",
  "decodeSync",
  "encodeUnknownSync",
  "encodeSync",
] as const;
const SCHEMA_ARBITRARY_NAMESPACE_NAMES = ["S", "Schema"] as const;
const SCHEMA_ARBITRARY_HELPERS = ["toArbitrary"] as const;
const REPO_SCHEMA_ARBITRARY_HELPERS = ["assertSchemaArbitraryDecodesToSelf"] as const;
// Schema-derived property coverage requires deriving the arbitrary from the
// schema itself and using it in a property, or through repo-owned helpers that
// perform that property assertion internally. Bare arbitrary construction is not
// coverage and must not suppress the advisory.
const TEST_FILE_PATTERN = /(?:\/test\/|\/tests\/|\.test\.tsx?$|\.spec\.tsx?$)/;
const TEST_FILE_EXCLUDED_SEGMENTS = [
  "/.repos/",
  "/node_modules/",
  "/dist/",
  "/build/",
  "/coverage/",
  "/docs/",
  "/_generated/",
  "/generated/",
] as const;

const isSchemaFirstTestFile = (filePath: string): boolean =>
  TEST_FILE_PATTERN.test(filePath) &&
  !A.some(TEST_FILE_EXCLUDED_SEGMENTS, (segment) => Str.includes(segment)(`/${filePath}`));

const isSchemaCodecHelperName = (name: string): boolean =>
  A.some(SCHEMA_CODEC_HELPERS, (helperName) => Str.Equivalence(helperName, name));

// Matches schema codec calls of the form `<Identifier>.<codecHelper>(...)`. This
// covers the namespace forms `S.decodeUnknownSync(Schema)` / `Schema.decode...`
// AND the class-local static API promoted by this repo, e.g.
// `NamedNode.decodeUnknownResult(...)` or `ContactSubmission.decodeUnknownEffect(...)`,
// so migrating to class statics cannot silently evade the advisory. The codec
// helper names are Effect-Schema-specific, so any-identifier objects are safe.
const isSchemaCodecCallExpression = (callExpression: import("ts-morph").CallExpression): boolean => {
  const expression = callExpression.getExpression();
  return (
    Node.isPropertyAccessExpression(expression) &&
    isSchemaCodecHelperName(expression.getName()) &&
    Node.isIdentifier(expression.getExpression())
  );
};

/**
 * True when the candidate equals one of the literal member names.
 *
 * **Example** (Inspect schema arbitrary coverage)
 *
 * ```ts
 * import { literalMemberEquals } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(literalMemberEquals(["is", "make"], "is")) // true
 * console.log(literalMemberEquals("is")(["is", "make"])) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const literalMemberEquals: {
  <const T extends string>(members: readonly T[], candidate: string): boolean;
  (candidate: string): <const T extends string>(members: readonly T[]) => boolean;
} = dual(2, <const T extends string>(members: readonly T[], candidate: string): boolean =>
  A.some(members, (member) => Str.Equivalence(member, candidate))
);

const isSchemaArbitraryCallExpression = (callExpression: import("ts-morph").CallExpression): boolean => {
  const expression = callExpression.getExpression();
  if (Node.isCallExpression(expression)) {
    return isSchemaArbitraryCallExpression(expression);
  }
  return (
    Node.isPropertyAccessExpression(expression) &&
    Node.isIdentifier(expression.getExpression()) &&
    literalMemberEquals(SCHEMA_ARBITRARY_NAMESPACE_NAMES, expression.getExpression().getText()) &&
    literalMemberEquals(SCHEMA_ARBITRARY_HELPERS, expression.getName())
  );
};

const isSchemaArbitraryExpression = (
  expression: import("ts-morph").Expression,
  schemaArbitraryIdentifiers: ReadonlySet<string>
): boolean => {
  if (Node.isIdentifier(expression)) {
    return schemaArbitraryIdentifiers.has(expression.getText());
  }

  if (Node.isCallExpression(expression)) {
    if (isSchemaArbitraryCallExpression(expression)) {
      return true;
    }

    const callTarget = expression.getExpression();
    if (Node.isPropertyAccessExpression(callTarget)) {
      return isSchemaArbitraryExpression(callTarget.getExpression(), schemaArbitraryIdentifiers);
    }
  }

  return false;
};

const containsSchemaArbitraryExpression = (
  expression: import("ts-morph").Expression,
  schemaArbitraryIdentifiers: ReadonlySet<string>
): boolean => {
  if (isSchemaArbitraryExpression(expression, schemaArbitraryIdentifiers)) {
    return true;
  }

  if (Node.isCallExpression(expression)) {
    return A.some(expression.getArguments(), (argument) =>
      Node.isExpression(argument) ? containsSchemaArbitraryExpression(argument, schemaArbitraryIdentifiers) : false
    );
  }

  return false;
};

const isFastCheckPropertyCallExpression = (
  callExpression: import("ts-morph").CallExpression,
  schemaArbitraryIdentifiers: ReadonlySet<string>
): boolean => {
  const expression = callExpression.getExpression();
  if (Node.isPropertyAccessExpression(expression)) {
    const namespaceExpression = expression.getExpression();
    return (
      Node.isIdentifier(namespaceExpression) &&
      namespaceExpression.getText() === "fc" &&
      literalMemberEquals(["property", "asyncProperty"] as const, expression.getName()) &&
      A.some(callExpression.getArguments(), (argument) =>
        Node.isExpression(argument) ? containsSchemaArbitraryExpression(argument, schemaArbitraryIdentifiers) : false
      )
    );
  }

  return false;
};

const isRepoSchemaArbitraryHelperCallExpression = (callExpression: import("ts-morph").CallExpression): boolean => {
  const expression = callExpression.getExpression();
  return Node.isIdentifier(expression) && literalMemberEquals(REPO_SCHEMA_ARBITRARY_HELPERS, expression.getText());
};

const sourceSchemaArbitraryIdentifiers = (sourceFile: import("ts-morph").SourceFile): ReadonlySet<string> => {
  const identifiers = new Set<string>();
  for (const variableDeclaration of sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
    const nameNode = variableDeclaration.getNameNode();
    const initializer = variableDeclaration.getInitializer();
    if (
      Node.isIdentifier(nameNode) &&
      initializer !== undefined &&
      isSchemaArbitraryExpression(initializer, identifiers)
    ) {
      identifiers.add(nameNode.getText());
    }
  }
  return identifiers;
};

const sourceHasSchemaArbitraryPropertyCoverage = (sourceFile: import("ts-morph").SourceFile): boolean => {
  const schemaArbitraryIdentifiers = sourceSchemaArbitraryIdentifiers(sourceFile);
  return A.some(
    sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression),
    (callExpression) =>
      isRepoSchemaArbitraryHelperCallExpression(callExpression) ||
      isFastCheckPropertyCallExpression(callExpression, schemaArbitraryIdentifiers)
  );
};

/**
 * Test whether source text contains schema-derived arbitrary coverage.
 *
 * **Example** (Inspect schema arbitrary coverage)
 *
 * ```ts
 * import { sourceTextHasSchemaArbitraryPropertyCoverage } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(sourceTextHasSchemaArbitraryPropertyCoverage("fc.property(S.toArbitrary(Worker)(fc), (worker) => true)"))
 * ```
 *
 * @param sourceText - TypeScript source text to inspect.
 * @returns Whether the text contains schema-derived arbitrary coverage.
 * @category utilities
 * @since 0.0.0
 */
export const sourceTextHasSchemaArbitraryPropertyCoverage = (sourceText: string): boolean => {
  const project = createInMemoryTsMorphProject();
  const sourceFile = project.createSourceFile("schema-arbitrary-coverage.tsx", sourceText, { overwrite: true });
  return sourceHasSchemaArbitraryPropertyCoverage(sourceFile);
};

const arbitraryTestsEntryFromSourceFile = (
  sourceFile: import("ts-morph").SourceFile,
  file: string,
  owner: string
): O.Option<SchemaFirstInventoryEntry> => {
  if (!isSchemaFirstTestFile(file) || sourceHasSchemaArbitraryPropertyCoverage(sourceFile)) {
    return O.none();
  }

  const schemaCodecCalls = A.filter(
    sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression),
    isSchemaCodecCallExpression
  );
  if (schemaCodecCalls.length < 3) {
    return O.none();
  }

  const line = sourceFile.getLineAndColumnAtPos(schemaCodecCalls[0]?.getStart() ?? sourceFile.getStart()).line;
  return O.some(
    SchemaFirstInventoryEntry.make({
      file,
      symbol: "schema-codec-tests",
      kind: "schema-policy-advisory",
      status: "advisory",
      ruleId: "SFV4-arbitrary-tests",
      line,
      owner,
      reason: `Schema-heavy test file has ${schemaCodecCalls.length} Schema codec assertions but no schema-derived property coverage.`,
    })
  );
};

/**
 * Grouped helpers for schema-derived arbitrary coverage detection.
 *
 * **Example** (Inspect schema arbitrary coverage)
 *
 * ```ts
 * import { SchemaFirstArbitraryCoverage } from "@beep/repo-cli/test/Lint"
 * import * as O from "effect/Option"
 * import { Project } from "ts-morph"
 *
 * const project = new Project({ useInMemoryFileSystem: true })
 * const sourceFile = project.createSourceFile("fixture.ts", "export const x = 1")
 * const entry = SchemaFirstArbitraryCoverage.arbitraryTestsEntryFromSourceFile(sourceFile, "fixture.ts", "@beep/test")
 * console.log(O.isOption(entry)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const SchemaFirstArbitraryCoverage = {
  arbitraryTestsEntryFromSourceFile,
} as const;
