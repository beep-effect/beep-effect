/**
 * Schema-derived arbitrary coverage detector for schema-first test files.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { createInMemoryTsMorphProject } from "@beep/repo-cli-kit/tsmorph/index";
import { A, Str } from "@beep/utils";
import { dual } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import { Node, SyntaxKind, VariableDeclarationKind } from "ts-morph";
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
const SCHEMA_ARBITRARY_NAMESPACE_NAMES = ["S", "Schema", "Arbitrary"] as const;
const SCHEMA_ARBITRARY_HELPERS = ["toArbitrary", "schema"] as const;
const REPO_SCHEMA_ARBITRARY_HELPERS = ["assertSchemaArbitraryDecodesToSelf"] as const;
// Schema-derived property coverage requires deriving the arbitrary from the
// schema itself and using it in a property, or through repo-owned helpers that
// perform that property assertion internally. Bare arbitrary construction is not
// coverage and must not suppress the advisory.
// Only test entry files count: support modules under `test/` (harnesses,
// fixtures, executable peers) assert nothing on their own.
const TEST_FILE_PATTERN = /\.(?:test|spec)\.tsx?$/;
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

const SCHEMA_NAMESPACE_NAMES = ["S", "Schema"] as const;

const isSchemaMember = (expression: import("ts-morph").Node, member: string): boolean =>
  Node.isPropertyAccessExpression(expression) &&
  Node.isIdentifier(expression.getExpression()) &&
  literalMemberEquals(SCHEMA_NAMESPACE_NAMES, expression.getExpression().getText()) &&
  Str.Equivalence(expression.getName(), member);

// `S.Unknown` and `S.fromJsonString(S.Unknown)` are JSON plumbing, not a schema
// whose values a property test could generate. Same-file `const` aliases resolve.
const isUnknownSchemaExpression = (
  expression: import("ts-morph").Node,
  unknownAliases: HashSet.HashSet<string>
): boolean => {
  if (Node.isIdentifier(expression)) return HashSet.has(unknownAliases, expression.getText());
  if (isSchemaMember(expression, "Unknown")) return true;
  if (!Node.isCallExpression(expression) || !isSchemaMember(expression.getExpression(), "fromJsonString")) return false;
  const args = expression.getArguments();
  return args.length === 1 && O.exists(A.head(args), (argument) => isUnknownSchemaExpression(argument, unknownAliases));
};

const sourceUnknownSchemaAliases = (sourceFile: import("ts-morph").SourceFile): HashSet.HashSet<string> =>
  A.reduce(
    A.flatMap(
      A.filter(
        sourceFile.getVariableStatements(),
        (statement: import("ts-morph").VariableStatement) =>
          statement.getDeclarationKind() === VariableDeclarationKind.Const
      ),
      (statement: import("ts-morph").VariableStatement) => statement.getDeclarations()
    ),
    HashSet.empty<string>(),
    (aliases: HashSet.HashSet<string>, declaration: import("ts-morph").VariableDeclaration) => {
      const nameNode = declaration.getNameNode();
      const initializer = declaration.getInitializer();
      return Node.isIdentifier(nameNode) && initializer !== undefined && isUnknownSchemaExpression(initializer, aliases)
        ? HashSet.add(aliases, nameNode.getText())
        : aliases;
    }
  );

const isUnknownSchemaCodecCall = (
  callExpression: import("ts-morph").CallExpression,
  unknownAliases: HashSet.HashSet<string>
): boolean => {
  const args = callExpression.getArguments();
  return args.length === 1 && O.exists(A.head(args), (argument) => isUnknownSchemaExpression(argument, unknownAliases));
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

// Matches a bare `Arbitrary.schema` / `S.toArbitrary` reference passed as a
// pipe argument, e.g. `EvidenceTier.pipe(S.Array, Arbitrary.schema)`.
const isSchemaArbitraryHelperReference = (expression: import("ts-morph").Expression): boolean =>
  Node.isPropertyAccessExpression(expression) &&
  Node.isIdentifier(expression.getExpression()) &&
  literalMemberEquals(SCHEMA_ARBITRARY_NAMESPACE_NAMES, expression.getExpression().getText()) &&
  literalMemberEquals(SCHEMA_ARBITRARY_HELPERS, expression.getName());

const isSchemaArbitraryExpression = (
  expression: import("ts-morph").Expression,
  schemaArbitraryIdentifiers: HashSet.HashSet<string>
): boolean => {
  if (Node.isIdentifier(expression)) {
    // Repo idiom: cross-field generators are exported as colocated
    // `<Model>Arbitrary` companions built with `Arbitrary.schema`; imported
    // companions are schema-derived even though their initializer lives in
    // another module.
    return (
      HashSet.has(schemaArbitraryIdentifiers, expression.getText()) || Str.endsWith("Arbitrary")(expression.getText())
    );
  }

  if (isSchemaArbitraryHelperReference(expression)) {
    return true;
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
  schemaArbitraryIdentifiers: HashSet.HashSet<string>
): boolean => {
  if (isSchemaArbitraryExpression(expression, schemaArbitraryIdentifiers)) {
    return true;
  }

  if (Node.isArrayLiteralExpression(expression)) {
    return A.some(
      expression.getElements(),
      (element) => Node.isExpression(element) && containsSchemaArbitraryExpression(element, schemaArbitraryIdentifiers)
    );
  }

  if (Node.isCallExpression(expression)) {
    return A.some(expression.getArguments(), (argument) =>
      Node.isExpression(argument) ? containsSchemaArbitraryExpression(argument, schemaArbitraryIdentifiers) : false
    );
  }

  return false;
};

const isArbitraryPropertyCallExpression = (
  callExpression: import("ts-morph").CallExpression,
  schemaArbitraryIdentifiers: HashSet.HashSet<string>
): boolean => {
  const expression = callExpression.getExpression();
  if (Node.isPropertyAccessExpression(expression)) {
    const namespaceExpression = expression.getExpression();
    return (
      Node.isIdentifier(namespaceExpression) &&
      literalMemberEquals(["fc", "Arbitrary"], namespaceExpression.getText()) &&
      literalMemberEquals(["property", "asyncProperty", "checkEffect"] as const, expression.getName()) &&
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

// Snapshot @effect/vitest `it.prop` / `it.effect.prop` accept only Schema or
// native Arbitrary inputs (raw fast-check generators are rejected by type), so
// any `it....prop(...)` call in a schema-heavy test file is schema-derived
// property coverage.
const isVitestPropCallExpression = (callExpression: import("ts-morph").CallExpression): boolean => {
  const expression = callExpression.getExpression();
  if (!Node.isPropertyAccessExpression(expression) || !Str.Equivalence(expression.getName(), "prop")) {
    return false;
  }
  let base: import("ts-morph").Expression = expression.getExpression();
  while (Node.isPropertyAccessExpression(base)) {
    base = base.getExpression();
  }
  return Node.isIdentifier(base) && Str.Equivalence(base.getText(), "it");
};

const sourceSchemaArbitraryIdentifiers = (sourceFile: import("ts-morph").SourceFile): HashSet.HashSet<string> => {
  let identifiers = HashSet.empty<string>();
  for (const variableDeclaration of sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
    const nameNode = variableDeclaration.getNameNode();
    const initializer = variableDeclaration.getInitializer();
    if (
      Node.isIdentifier(nameNode) &&
      initializer !== undefined &&
      isSchemaArbitraryExpression(initializer, identifiers)
    ) {
      identifiers = HashSet.add(identifiers, nameNode.getText());
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
      isVitestPropCallExpression(callExpression) ||
      isArbitraryPropertyCallExpression(callExpression, schemaArbitraryIdentifiers)
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

  const codecCalls = A.filter(sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression), isSchemaCodecCallExpression);
  const unknownAliases = sourceUnknownSchemaAliases(sourceFile);
  const schemaCodecCalls = A.filter(
    codecCalls,
    (callExpression) => !isUnknownSchemaCodecCall(callExpression, unknownAliases)
  );
  if (schemaCodecCalls.length < 3) {
    return O.none();
  }

  // The row stays anchored at the first codec call of any kind so excluding
  // S.Unknown plumbing from the count never re-keys an existing entry.
  const line = sourceFile.getLineAndColumnAtPos(codecCalls[0]?.getStart() ?? sourceFile.getStart()).line;
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
