/**
 * Schema-first inventory and enforcement command.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { isExcludedTypeScriptSourcePath, toPosixPath } from "@beep/repo-utils/schemas/TypeScriptSourceExclusions";
import { resolveWorkspaceDirs } from "@beep/repo-utils/Workspaces";
import { LiteralKit } from "@beep/schema";
import { A, Str, thunkEmptyStr } from "@beep/utils";
import { Console, DateTime, Effect, FileSystem, flow, HashMap, Order, Path, pipe, SchemaGetter } from "effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { Command, Flag } from "effect/unstable/cli";
import { parse } from "jsonc-parser";
import { Node, Project, SyntaxKind } from "ts-morph";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.js";
import { optionalProp } from "../../internal/cli/OptionRecord.js";
import type { TypeElementTypes } from "ts-morph";

const $I = $RepoCliId.create("commands/Lint/SchemaFirst");
const INVENTORY_PATH = "standards/schema-first.inventory.jsonc";
const POLICY_PATH = "standards/schema-crispening.policy.jsonc";
const INCLUDED_GLOBS = ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}", "infra/**/*.ts"] as const;
const SOURCE_FILE_GLOBS = [...INCLUDED_GLOBS, "!**/docs/**"] as const;
const IDENTIFIER_PROPERTY_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const FUNCTION_LIKE_TEXT_PATTERN = /=>|\bEffect\.Effect</;
const NON_SCHEMA_SIGNAL_PATTERN =
  /\bEffect\.Success<|\bLayer\.Layer<|\bAbortSignal\b|\bAbortController\b|\bUint8Array\b|\bEventJournal\.Entry\b|\bZod\b|\bz\.|\bAtom\.|\bNodeJS\.(?:Readable|Writable)Stream\b|\bStartedTestContainer\b|\bpulumi\.Input<|\bWinkMethods\b|\b(?:Any)?OperationResult\b/;
const SCHEMA_FIELDS_CALL_PATTERN = /\bS\.(?:Class|Struct|TaggedClass|TaggedStruct|ErrorClass|TaggedErrorClass)\b/;
const SCHEMA_CLASS_FIELDS_CALL_PATTERN = /\bS\.(?:Class|TaggedClass|ErrorClass|TaggedErrorClass)\b/;
const NUMERIC_DOMAIN_TOKENS = ["timeout", "count", "size", "rate", "limit", "ms", "seconds"] as const;
const STATIC_API_SCHEMA_SIGNAL_PATTERN = /\b(?:S\.(?:TaggedUnion|toTaggedUnion)|LiteralKit|MappedLiteralKit)\s*\(/;
const DEFAULTS_SCHEMA_SIGNAL_PATTERN =
  /\b(?:S\.(?:Class|Struct|TaggedClass|TaggedStruct|ErrorClass|TaggedErrorClass)|withConstructorDefault|withDecodingDefault|SchemaUtils\.withKeyDefaults)\b/;
const EQUIVALENCE_SCHEMA_SIGNAL_PATTERN =
  /\b(?:S\.(?:Class|Struct|TaggedClass|TaggedStruct|ErrorClass|TaggedErrorClass|toEquivalence|overrideToEquivalence)|SchemaUtils\.toEquivalence)\b/;
const FN_CALL_SIGNAL_PATTERN = /\bFn\s*\(/;
const NORMALIZATION_METHOD_NAMES = ["trim", "toUpperCase", "toLowerCase"] as const;
const NORMALIZATION_CALL_SIGNAL_PATTERN = /\.(?:trim|toUpperCase|toLowerCase)\(/;
const NULL_UNDEFINED_RETURN_PATTERN = /\bnull\b|\bundefined\b/;
const GETSOMES_CALL_SIGNAL_PATTERN = /\bgetSomes\s*\(/;
const GETSOMES_OBJECT_NAMES = ["R", "Record"] as const;
const SCHEMA_DERIVED_EQUIVALENCE_PATTERN =
  /\b(?:S|Schema)\.(?:toEquivalence|overrideToEquivalence)\b|SchemaUtils\.toEquivalence\b/;
const MANUAL_EQUALITY_COMPARISON_PATTERN = /===|!==/;
const BROAD_EMAIL_SCHEMA_PATTERN = /^S\.optionalKey\(S\.String(?:\)|,)|^S\.String(?:$|\.pipe\()/;
const DEFAULT_PARAMETER_NAMES = ["options", "params", "config", "request", "args", "input"] as const;
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
const SCHEMA_ARBITRARY_HELPERS = ["toArbitrary", "toArbitraryLazy"] as const;
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
  "/dtslint/",
] as const;
const SCHEMA_DISCRIMINATOR_TOKENS = [
  "_tag",
  "tag",
  "kind",
  "status",
  "type",
  "mode",
  "reason",
  "state",
  "category",
  "profile",
  "family",
  "subtype",
] as const;

const stringifyJsonPretty = SchemaGetter.stringifyJson({ space: 2 });
const stringifyJsonLine = SchemaGetter.stringifyJson({ space: 0 });

/**
 * Stable schema-first policy rule identifiers emitted for lint and Yeet issue routing.
 *
 * @internal
 * @category schema
 * @since 0.0.0
 */
export const SchemaFirstPolicyRuleId = LiteralKit([
  "schema-first-inventory",
  "literal-kit-const-assertion",
  "SFV4-defaults",
  "SFV4-static-api",
  "SFV4-precision-audit",
  "SFV4-arbitrary-tests",
  "SFV4-equivalence",
  "SFV4-numeric-domain",
  "SFV4-boundary-codec",
  "SFV4-fn-schema",
  "SFV4-normalization",
  "SFV4-null-return",
  "SFV4-getsomes-struct",
]).pipe(
  $I.annoteSchema("SchemaFirstPolicyRuleId", {
    description: "Stable schema-first policy rule identifiers emitted for lint and Yeet issue routing.",
  })
);

const SchemaFirstPolicySeverity = LiteralKit(["warning", "error"]).pipe(
  $I.annoteSchema("SchemaFirstPolicySeverity", {
    description: "Severity levels emitted by schema-first policy lint findings.",
  })
);

/**
 * Kinds of schema-first inventory findings.
 *
 * @internal
 * @category schema
 * @since 0.0.0
 */
export const SchemaFirstEntryKind = LiteralKit([
  "exported-interface",
  "exported-type-literal",
  "object-struct-schema",
  "schema-policy-advisory",
]).pipe(
  $I.annoteSchema("SchemaFirstEntryKind", {
    description: "Kinds of schema-first inventory findings.",
  })
);

/**
 * Tracked status for a schema-first inventory finding.
 *
 * @internal
 * @category schema
 * @since 0.0.0
 */
export const SchemaFirstEntryStatus = LiteralKit(["candidate", "exception", "advisory"]).pipe(
  $I.annoteSchema("SchemaFirstEntryStatus", {
    description: "Tracked status for a schema-first inventory finding.",
  })
);

/**
 * Single tracked schema-first inventory finding for a source file symbol.
 *
 * @example
 * ```ts
 * import { SchemaFirstInventoryEntry } from "@beep/repo-cli/commands/Lint"
 * console.log(SchemaFirstInventoryEntry)
 * ```
 * @category models
 * @since 0.0.0
 */
export class SchemaFirstInventoryEntry extends S.Class<SchemaFirstInventoryEntry>($I`SchemaFirstInventoryEntry`)(
  {
    file: S.String,
    symbol: S.String,
    kind: SchemaFirstEntryKind,
    status: SchemaFirstEntryStatus,
    ruleId: S.optionalKey(SchemaFirstPolicyRuleId),
    line: S.optionalKey(S.Finite),
    owner: S.String,
    reason: S.String,
  },
  $I.annote("SchemaFirstInventoryEntry", {
    description: "Single tracked schema-first finding for a source file symbol.",
  })
) {}

class SchemaFirstPolicyFinding extends S.Class<SchemaFirstPolicyFinding>($I`SchemaFirstPolicyFinding`)(
  {
    category: S.Literal("schema-first-policy"),
    ruleId: SchemaFirstPolicyRuleId,
    severity: SchemaFirstPolicySeverity,
    file: S.String,
    line: S.optionalKey(S.Finite),
    symbol: S.optionalKey(S.String),
    message: S.String,
    remediation: S.String,
  },
  $I.annote("SchemaFirstPolicyFinding", {
    description: "Machine-readable schema-first lint finding consumed by Yeet quality issue packets.",
  })
) {}

/**
 * Namespace for {@link SchemaFirstInventoryEntry} companion types.
 *
 * @example
 * ```ts
 * console.log("SchemaFirstInventoryEntry")
 * ```
 * @category models
 * @since 0.0.0
 */
export declare namespace SchemaFirstInventoryEntry {
  /**
   * Encoded representation of {@link SchemaFirstInventoryEntry}.
   *
   * @example
   * ```ts
   * console.log("Encoded")
   * ```
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof SchemaFirstInventoryEntry.Encoded;
}

class SchemaFirstInventoryDocument extends S.Class<SchemaFirstInventoryDocument>($I`SchemaFirstInventoryDocument`)(
  {
    version: S.Literal(1),
    generatedOn: S.String,
    scope: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(A.fromIterable(INCLUDED_GLOBS))),
      S.withDecodingDefault(Effect.succeed(A.fromIterable(INCLUDED_GLOBS)))
    ),
    entries: S.Array(SchemaFirstInventoryEntry).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<SchemaFirstInventoryEntry>())),
      S.withDecodingDefault(Effect.succeed(A.empty<SchemaFirstInventoryEntry.Encoded>()))
    ),
  },
  $I.annote("SchemaFirstInventoryDocument", {
    description: "Committed schema-first inventory baseline for repo-wide lint enforcement.",
  })
) {}

class SchemaFirstLintOptions extends S.Class<SchemaFirstLintOptions>($I`SchemaFirstLintOptions`)(
  {
    write: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefault(Effect.succeed(false))
    ),
  },
  $I.annote("SchemaFirstLintOptions", {
    description: "CLI options for schema-first inventory verification.",
  })
) {}

class SchemaFirstLintSummary extends S.Class<SchemaFirstLintSummary>($I`SchemaFirstLintSummary`)(
  {
    liveEntries: S.Finite,
    trackedEntries: S.Finite,
    missingEntries: S.Finite,
    staleEntries: S.Finite,
    enforcedCandidates: S.Finite,
    literalKitConstAssertions: S.Finite,
    boundaryCodecAdvisories: S.Finite,
    defaultsAdvisories: S.Finite,
    staticApiAdvisories: S.Finite,
    equivalenceAdvisories: S.Finite,
    precisionAuditAdvisories: S.Finite,
    arbitraryTestsAdvisories: S.Finite,
    numericDomainAdvisories: S.Finite,
    fnSchemaAdvisories: S.Finite,
    normalizationAdvisories: S.Finite,
    nullReturnAdvisories: S.Finite,
    getsomesStructAdvisories: S.Finite,
    crispeningPolicyExempt: S.Finite,
    wroteInventory: S.Boolean,
  },
  $I.annote("SchemaFirstLintSummary", {
    description: "Summary of schema-first inventory verification results.",
  })
) {}

/**
 * Wave-family keys used to resolve the schema-crispening policy blocking flag
 * by path prefix.
 *
 * @internal
 * @category schema
 * @since 0.0.0
 */
export const SchemaCrispeningFamily = LiteralKit(["foundation", "drivers", "tooling", "apps-slices"]).pipe(
  $I.annoteSchema("SchemaCrispeningFamily", {
    description: "Wave-family keys used to resolve the schema-crispening policy blocking flag by path prefix.",
  })
);

/**
 * Blocking flag for a schema-crispening wave family or per-owner policy override.
 *
 * @example
 * ```ts
 * import { SchemaCrispeningFamilyPolicy } from "@beep/repo-cli/commands/Lint"
 * console.log(SchemaCrispeningFamilyPolicy)
 * ```
 * @category models
 * @since 0.0.0
 */
export class SchemaCrispeningFamilyPolicy extends S.Class<SchemaCrispeningFamilyPolicy>(
  $I`SchemaCrispeningFamilyPolicy`
)(
  {
    blocking: S.Boolean,
  },
  $I.annote("SchemaCrispeningFamilyPolicy", {
    description: "Blocking flag for a schema-crispening wave family or per-owner override.",
  })
) {}

/**
 * Schema-crispening policy ratchet document: novel lint cards and the
 * per-family / per-owner blocking flags that resolve whether a card's
 * findings currently fail the repo-wide schema-first lint.
 *
 * @example
 * ```ts
 * import { SchemaCrispeningPolicyDocument } from "@beep/repo-cli/commands/Lint"
 * console.log(SchemaCrispeningPolicyDocument)
 * ```
 * @category models
 * @since 0.0.0
 */
export class SchemaCrispeningPolicyDocument extends S.Class<SchemaCrispeningPolicyDocument>(
  $I`SchemaCrispeningPolicyDocument`
)(
  {
    schemaVersion: S.Literal("schema-crispening-policy/v1"),
    cards: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<string>())),
      S.withDecodingDefault(Effect.succeed(A.empty<string>()))
    ),
    families: S.Record(S.String, SchemaCrispeningFamilyPolicy).pipe(
      S.withConstructorDefault(Effect.succeed(R.empty<string, SchemaCrispeningFamilyPolicy>())),
      S.withDecodingDefault(Effect.succeed(R.empty<string, SchemaCrispeningFamilyPolicy>()))
    ),
    ownerOverrides: S.Record(S.String, SchemaCrispeningFamilyPolicy).pipe(
      S.withConstructorDefault(Effect.succeed(R.empty<string, SchemaCrispeningFamilyPolicy>())),
      S.withDecodingDefault(Effect.succeed(R.empty<string, SchemaCrispeningFamilyPolicy>()))
    ),
  },
  $I.annote("SchemaCrispeningPolicyDocument", {
    description: "Schema-crispening policy ratchet: novel lint cards and per-family/per-owner blocking flags.",
  })
) {}

class LiteralKitConstAssertionViolation extends S.Class<LiteralKitConstAssertionViolation>(
  $I`LiteralKitConstAssertionViolation`
)(
  {
    file: S.String,
    line: S.Finite,
    argument: S.Finite,
  },
  $I.annote("LiteralKitConstAssertionViolation", {
    description: "Direct LiteralKit call argument that redundantly asserts an inline array as const.",
  })
) {}

const decodeInventoryDocument = S.decodeUnknownEffect(SchemaFirstInventoryDocument);
const encodeInventoryDocument = S.encodeUnknownEffect(SchemaFirstInventoryDocument);
const encodePolicyFinding = S.encodeUnknownEffect(SchemaFirstPolicyFinding);
const decodeCrispeningPolicyDocument = S.decodeUnknownEffect(SchemaCrispeningPolicyDocument);

const isExcludedFile = isExcludedTypeScriptSourcePath;

const makeEntryKey = (entry: SchemaFirstInventoryEntry): string =>
  `${entry.file}::${entry.symbol}::${entry.kind}::${entry.ruleId ?? ""}::${entry.line ?? ""}`;

const byEntryKeyAscending: Order.Order<SchemaFirstInventoryEntry> = Order.mapInput(Order.String, makeEntryKey);

const byWorkspacePathLengthDescending: Order.Order<readonly [string, string]> = Order.mapInput(
  Order.Number,
  (entry) => -entry[1].length
);

const sortEntries: (entries: ReadonlyArray<SchemaFirstInventoryEntry>) => ReadonlyArray<SchemaFirstInventoryEntry> =
  flow(A.sort(byEntryKeyAscending));

const isActiveRuleAdvisory =
  (ruleId: typeof SchemaFirstPolicyRuleId.Type) =>
  (entry: SchemaFirstInventoryEntry): boolean =>
    entry.ruleId === ruleId && entry.status === "advisory";

const renderPolicyFindingLine = Effect.fn("renderPolicyFindingLine")(function* (finding: SchemaFirstPolicyFinding) {
  const encoded = yield* encodePolicyFinding(finding);
  const rendered = yield* stringifyJsonLine.run(O.some(encoded), {});
  return `[schema-first:issue] ${O.getOrElse(rendered, thunkEmptyStr)}`;
});

const inventoryEntryFinding = (
  entry: SchemaFirstInventoryEntry,
  message: string,
  remediation: string
): SchemaFirstPolicyFinding =>
  SchemaFirstPolicyFinding.make({
    category: "schema-first-policy",
    ruleId: entry.ruleId ?? "schema-first-inventory",
    severity: entry.status === "advisory" ? "warning" : "error",
    file: entry.file,
    symbol: entry.symbol,
    message,
    remediation,
    ...optionalProp("line", O.fromUndefinedOr(entry.line)),
  });

const DEFAULT_MISSING_ENTRY_REMEDIATION =
  "Run bun run beep lint schema-first --write after reviewing the finding, or migrate the symbol to an annotated schema.";

const MISSING_ENTRY_REMEDIATIONS: Readonly<Record<string, string>> = {
  "SFV4-static-api":
    "Prefer schema-derived .match/.guards/.cases or LiteralKit helpers, or run bun run beep lint schema-first --write with a justification when behavior intentionally differs.",
  "SFV4-numeric-domain":
    "Review the numeric domain and replace broad S.Number/S.NumberFromString with S.Finite, S.Int, or checks; then run bun run beep lint schema-first --write if the broad domain is intentional.",
  "SFV4-boundary-codec":
    "Replace direct JSON.parse with S.UnknownFromJsonString or S.fromJsonString(schema) plus an Effect/Result/Option decoder, or inventory the exception when the protocol is intentionally non-standard.",
  "SFV4-defaults":
    "Move option/request fallback values into schema fields with S.withConstructorDefault, S.withDecodingDefault*, or SchemaUtils.withKeyDefaults; inventory the exception only when the fallback intentionally differs from schema construction semantics.",
  "SFV4-equivalence":
    "Derive comparison from S.toEquivalence(schema) or SchemaUtils.toEquivalence(schema); use S.overrideToEquivalence only when schema semantics intentionally differ.",
  "SFV4-precision-audit":
    "Replace broad email S.String fields with @beep/schema Email or a local precise email schema; inventory only external protocol fields that intentionally allow non-email strings.",
  "SFV4-arbitrary-tests":
    "Add a focused property test using S.toArbitrary(sourceSchema) and fast-check, or keep the inventory entry when the file is intentionally golden/snapshot/regression-only coverage.",
  "SFV4-fn-schema":
    "Model inline object parameter/return contracts with Fn({ input, output }) from @beep/schema or an S.Class, or run bun run beep lint schema-first --write with a justification when the shape intentionally stays inline.",
  "SFV4-normalization":
    "Move the trim/case normalization into a schema transformation (S.decodeTo + SchemaTransformation, or SchemaGetter) so the invariant travels with the data; inventory the exception only when the call is intentionally imperative.",
  "SFV4-null-return":
    "Return O.Option, Result, Effect, or Exit instead of a null/undefined-typed return; run bun run beep lint schema-first --write when the boundary (3rd-party/react) intentionally returns null/undefined.",
  "SFV4-getsomes-struct":
    "Replace R.getSomes over an inline Option-struct literal with O.getSomesStruct (@beep/utils) to preserve literal keys and per-key value types; inventory the exception only for intentionally homogeneous dynamic-key dictionaries.",
};

const missingEntryRemediation = (entry: SchemaFirstInventoryEntry): string =>
  pipe(
    O.fromNullishOr(entry.ruleId),
    O.flatMap((ruleId) => R.get(MISSING_ENTRY_REMEDIATIONS, ruleId)),
    O.getOrElse(() => DEFAULT_MISSING_ENTRY_REMEDIATION)
  );

const literalKitConstAssertionFinding = (violation: LiteralKitConstAssertionViolation): SchemaFirstPolicyFinding =>
  SchemaFirstPolicyFinding.make({
    category: "schema-first-policy",
    ruleId: "literal-kit-const-assertion",
    severity: "error",
    file: violation.file,
    line: violation.line,
    symbol: "LiteralKit",
    message: "Inline LiteralKit array arguments do not need as const.",
    remediation: "Remove the redundant as const assertion; LiteralKit already uses const type parameters.",
  });

const logPolicyFinding = Effect.fn("logPolicyFinding")(function* (finding: SchemaFirstPolicyFinding) {
  yield* Console.error(yield* renderPolicyFindingLine(finding));
});

const todayYmd = (): string => {
  const now = DateTime.nowUnsafe();
  const year = `${DateTime.getPartUtc(now, "year")}`;
  const month = Str.padStart(2, "0")(`${DateTime.getPartUtc(now, "month")}`);
  const day = Str.padStart(2, "0")(`${DateTime.getPartUtc(now, "day")}`);
  return `${year}-${month}-${day}`;
};

const readInventoryDocument = Effect.fn(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolutePath = path.resolve(process.cwd(), INVENTORY_PATH);

  if (!(yield* fs.exists(absolutePath))) {
    return O.none<SchemaFirstInventoryDocument>();
  }

  const content = yield* fs.readFileString(absolutePath);
  return yield* decodeInventoryDocument(parse(content)).pipe(Effect.option);
});

const readCrispeningPolicyDocument = Effect.fn(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolutePath = path.resolve(process.cwd(), POLICY_PATH);

  if (!(yield* fs.exists(absolutePath))) {
    return O.none<SchemaCrispeningPolicyDocument>();
  }

  const content = yield* fs.readFileString(absolutePath);
  return yield* decodeCrispeningPolicyDocument(parse(content)).pipe(Effect.option);
});

const writeInventoryDocument = Effect.fn("writeInventoryDocument")(function* (document: SchemaFirstInventoryDocument) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolutePath = path.resolve(process.cwd(), INVENTORY_PATH);
  const encodedDocument = yield* encodeInventoryDocument(document);
  const rendered = yield* stringifyJsonPretty.run(O.some(encodedDocument), {});
  const serialized = O.getOrElse(rendered, thunkEmptyStr);
  yield* fs.writeFileString(absolutePath, `${serialized}\n`);
});

const makeOwnerResolver = Effect.fn("makeOwnerResolver")(function* () {
  const workspaces = yield* resolveWorkspaceDirs(process.cwd());
  const workspaceEntries = pipe(
    HashMap.toEntries(workspaces),
    A.map(([packageName, absolutePath]) => [packageName, toPosixPath(absolutePath)] as const),
    A.sort(byWorkspacePathLengthDescending)
  );
  const cwd = toPosixPath(process.cwd());

  return (absoluteFilePath: string): string => {
    const normalized = toPosixPath(absoluteFilePath);
    const relativePath = toPosixPath(Str.replace(`${cwd}/`, "")(normalized));
    const workspaceMatch = A.findFirst(
      workspaceEntries,
      ([, workspacePath]) => normalized === workspacePath || Str.startsWith(`${workspacePath}/`)(normalized)
    );
    if (O.isSome(workspaceMatch)) {
      return workspaceMatch.value[0];
    }
    if (Str.startsWith("infra/")(relativePath)) {
      return "@beep/infra";
    }
    return "@beep/root";
  };
});

const SCHEMA_CRISPENING_FAMILY_PREFIXES: ReadonlyArray<readonly [string, typeof SchemaCrispeningFamily.Type]> = [
  ["packages/foundation/", "foundation"],
  ["packages/drivers/", "drivers"],
  ["packages/tooling/", "tooling"],
  ["apps/", "apps-slices"],
  ["packages/agents/", "apps-slices"],
  ["packages/architecture-lab/", "apps-slices"],
  ["packages/epistemic/", "apps-slices"],
  ["packages/law-practice/", "apps-slices"],
  ["packages/workspace/", "apps-slices"],
] as const;

/**
 * Resolve the schema-crispening wave family for a repo-relative source file
 * path by prefix. `packages/shared/**` and `infra/**` are unassigned until
 * their P1 wave assignment lands and resolve to `O.none` (non-blocking).
 *
 * @param file - Repo-relative posix path, e.g. `packages/foundation/modeling/schema/src/Foo.ts`.
 * @returns The resolved wave family, or `O.none` when the path is unassigned.
 * @example
 * ```ts
 * import { schemaCrispeningFamilyForFile } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(schemaCrispeningFamilyForFile("packages/drivers/postgres/src/Postgres.ts"))
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const schemaCrispeningFamilyForFile = (file: string): O.Option<typeof SchemaCrispeningFamily.Type> =>
  pipe(
    A.findFirst(SCHEMA_CRISPENING_FAMILY_PREFIXES, ([prefix]) => Str.startsWith(prefix)(file)),
    O.map(([, family]) => family)
  );

const resolveSchemaCrispeningPolicyBlocking = (
  policy: SchemaCrispeningPolicyDocument,
  entry: SchemaFirstInventoryEntry
): boolean =>
  pipe(
    R.get(policy.ownerOverrides, entry.owner),
    O.map((override) => override.blocking),
    O.orElse(() =>
      pipe(
        schemaCrispeningFamilyForFile(entry.file),
        O.flatMap((family) => R.get(policy.families, family)),
        O.map((familyPolicy) => familyPolicy.blocking)
      )
    ),
    O.getOrElse(() => false)
  );

/**
 * Test whether a schema-first inventory entry is exempt from failing the
 * repo-wide lint under the schema-crispening policy ratchet (G4). An absent
 * policy document exempts nothing (fail-safe); an entry is only ever exempt
 * when its `ruleId` is a policy-tracked card AND the resolved blocking flag
 * (owner override, else family, else non-blocking when unassigned) is `false`.
 *
 * @param policyDocument - The decoded `standards/schema-crispening.policy.jsonc` document, if present.
 * @returns A predicate over inventory entries.
 * @example
 * ```ts
 * import { isSchemaCrispeningPolicyExempt } from "@beep/repo-cli/commands/Lint"
 * import * as O from "effect/Option"
 *
 * const exemptWithoutPolicy = isSchemaCrispeningPolicyExempt(O.none())
 * console.log(exemptWithoutPolicy)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const isSchemaCrispeningPolicyExempt =
  (policyDocument: O.Option<SchemaCrispeningPolicyDocument>) =>
  (entry: SchemaFirstInventoryEntry): boolean =>
    pipe(
      policyDocument,
      O.flatMap((policy) =>
        pipe(
          O.fromNullishOr(entry.ruleId),
          O.filter((ruleId) => A.contains(policy.cards, ruleId)),
          O.map(() => !resolveSchemaCrispeningPolicyBlocking(policy, entry))
        )
      ),
      O.getOrElse(() => false)
    );

const isFunctionLikeMember = (member: Node): boolean => {
  if (
    Node.isMethodSignature(member) ||
    Node.isCallSignatureDeclaration(member) ||
    Node.isConstructSignatureDeclaration(member)
  ) {
    return true;
  }
  if (Node.isPropertySignature(member)) {
    const typeNode = member.getTypeNode();
    return typeNode !== undefined && typeNode.getKind() === SyntaxKind.FunctionType;
  }
  return false;
};

const isTypeNodeUnsafe = (typeText: string): boolean =>
  FUNCTION_LIKE_TEXT_PATTERN.test(typeText) || NON_SCHEMA_SIGNAL_PATTERN.test(typeText);

const typeLiteralMembersUnsafe = (members: ReadonlyArray<Node>): boolean =>
  A.some(members, (member) => {
    if (isFunctionLikeMember(member)) {
      return true;
    }
    if (Node.isPropertySignature(member)) {
      const typeText = member.getTypeNode()?.getText() ?? "";
      return isTypeNodeUnsafe(typeText);
    }
    return false;
  });

const detectInterfaceReason = (node: import("ts-morph").InterfaceDeclaration): O.Option<string> => {
  if (node.getTypeParameters().length > 0) {
    return O.some("Generic interface requires manual modeling and is tracked as an exception.");
  }
  if (node.getExtends().length > 0) {
    return O.some("Derived interface with extends clauses is tracked as an exception.");
  }
  if (typeLiteralMembersUnsafe(node.getMembers())) {
    return O.some("Interface contains non-schema signals such as function members or runtime handles.");
  }
  return O.none();
};

const detectTypeAliasReason = (node: import("ts-morph").TypeAliasDeclaration): O.Option<string> => {
  if (node.getTypeParameters().length > 0) {
    return O.some("Generic type alias requires manual modeling and is tracked as an exception.");
  }
  const typeNode = node.getTypeNode();
  if (typeNode === undefined || typeNode.getKind() !== SyntaxKind.TypeLiteral) {
    return O.some("Non-literal type alias is out of scope for automatic schema-first enforcement.");
  }
  const members = Node.isTypeLiteral(typeNode) ? typeNode.getMembers() : A.empty<TypeElementTypes>();
  if (typeLiteralMembersUnsafe(members)) {
    return O.some("Type alias contains non-schema signals such as function members or runtime handles.");
  }
  return O.none();
};

const isFunctionLocalNode = (node: Node): boolean =>
  node.getFirstAncestor(
    (ancestor) =>
      Node.isFunctionDeclaration(ancestor) ||
      Node.isFunctionExpression(ancestor) ||
      Node.isArrowFunction(ancestor) ||
      Node.isMethodDeclaration(ancestor)
  ) !== undefined;

const nodesShareSymbolDeclaration = (left: Node, right: Node): boolean => {
  const rightDeclarations = right.getSymbol()?.getDeclarations() ?? [];
  return (
    rightDeclarations.length > 0 &&
    A.some(left.getSymbol()?.getDeclarations() ?? [], (leftDeclaration) => rightDeclarations.includes(leftDeclaration))
  );
};

const isStructFieldsInputForSchemaClass = (callExpression: import("ts-morph").CallExpression): boolean => {
  const variableDeclaration = callExpression.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
  if (variableDeclaration === undefined) {
    return false;
  }

  const variableNameNode = variableDeclaration.getNameNode();
  return A.some(callExpression.getSourceFile().getDescendantsOfKind(SyntaxKind.CallExpression), (candidate) => {
    if (candidate === callExpression || !SCHEMA_CLASS_FIELDS_CALL_PATTERN.test(candidate.getExpression().getText())) {
      return false;
    }
    const firstArgument = candidate.getArguments()[0];
    return firstArgument !== undefined && nodesShareSymbolDeclaration(firstArgument, variableNameNode);
  });
};

const detectStructReason = (callExpression: import("ts-morph").CallExpression): O.Option<string> => {
  const firstArgument = callExpression.getArguments()[0];
  if (firstArgument === undefined || !Node.isObjectLiteralExpression(firstArgument)) {
    return O.some("S.Struct usage without a plain object literal stays tracked as an exception.");
  }
  const invalidKeys = A.some(firstArgument.getProperties(), (property) => {
    if (Node.isSpreadAssignment(property)) {
      return true;
    }
    const nameNode = "getNameNode" in property ? property.getNameNode() : undefined;
    if (nameNode === undefined) {
      return true;
    }
    const propertyName = Str.replace(/^["']|["']$/g, "")(nameNode.getText());
    return !IDENTIFIER_PROPERTY_PATTERN.test(propertyName);
  });
  if (invalidKeys) {
    return O.some("S.Struct with non-identifier or spread keys stays tracked as an exception.");
  }
  if (callExpression.getFirstAncestorByKind(SyntaxKind.PropertyAssignment) !== undefined) {
    return O.some("Inline nested S.Struct boundary shapes stay tracked until a dedicated class extraction pass.");
  }
  if (isStructFieldsInputForSchemaClass(callExpression)) {
    return O.some("Internal S.Struct field block feeds an S.Class constructor and stays tied to the class model.");
  }
  if (isFunctionLocalNode(callExpression)) {
    return O.some("Function-local S.Struct wrappers used for transient decode envelopes stay tracked as exceptions.");
  }
  return O.none();
};

const inferStructSymbol = (callExpression: import("ts-morph").CallExpression): string =>
  pipe(
    O.fromNullishOr(callExpression.getFirstAncestorByKind(SyntaxKind.VariableDeclaration)),
    O.map((declaration) => declaration.getName()),
    O.getOrElse(() => {
      const line = callExpression.getSourceFile().getLineAndColumnAtPos(callExpression.getStart()).line;
      return `anonymous@${line}`;
    })
  );

const propertyNameText = (property: import("ts-morph").PropertyAssignment): O.Option<string> =>
  pipe(
    O.fromNullishOr(property.getNameNode()),
    O.map((nameNode) => Str.replace(/^["']|["']$/g, "")(nameNode.getText())),
    O.filter(Str.isNonEmpty)
  );

const fieldNameTokens: (fieldName: string) => ReadonlyArray<string> = flow(
  Str.replace(/([a-z0-9])([A-Z])/g, "$1 $2"),
  Str.replace(/[^A-Za-z0-9]+/g, " "),
  Str.trim,
  Str.split(/\s+/),
  A.map(Str.toLowerCase),
  A.filter(Str.isNonEmpty)
);

const isNumericDomainFieldName = (fieldName: string): boolean =>
  A.some(fieldNameTokens(fieldName), (token) =>
    A.some(NUMERIC_DOMAIN_TOKENS, (numericToken) => Str.Equivalence(token, numericToken))
  );

const isBroadNumberSchemaExpression = (initializer: Node): boolean => {
  const text = initializer.getText();
  if (/S\.(?:Finite|Int)\b|\.check\(/.test(text)) {
    return false;
  }
  return (
    text === "S.Number" ||
    text === "S.NumberFromString" ||
    Str.startsWith("S.Number.pipe(")(text) ||
    Str.startsWith("S.NumberFromString.pipe(")(text)
  );
};

const isSchemaFieldsObjectLiteral = (node: Node): boolean => {
  if (!Node.isObjectLiteralExpression(node)) {
    return false;
  }
  const parent = node.getParent();
  return Node.isCallExpression(parent) && SCHEMA_FIELDS_CALL_PATTERN.test(parent.getExpression().getText());
};

const inferSchemaContainerSymbol = (node: Node): string => {
  const classDeclaration = node.getFirstAncestorByKind(SyntaxKind.ClassDeclaration);
  if (classDeclaration !== undefined) {
    return classDeclaration.getName() ?? "anonymous-class";
  }
  const variableDeclaration = node.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
  if (variableDeclaration !== undefined) {
    return variableDeclaration.getName();
  }
  const line = node.getSourceFile().getLineAndColumnAtPos(node.getStart()).line;
  return `anonymous@${line}`;
};

const numericDomainEntryFromProperty = (
  property: import("ts-morph").PropertyAssignment,
  file: string,
  owner: string
): O.Option<SchemaFirstInventoryEntry> => {
  const parent = property.getParent();
  if (!isSchemaFieldsObjectLiteral(parent)) {
    return O.none();
  }

  const fieldName = propertyNameText(property);
  if (O.isNone(fieldName) || !isNumericDomainFieldName(fieldName.value)) {
    return O.none();
  }

  const initializer = property.getInitializer();
  if (initializer === undefined || !isBroadNumberSchemaExpression(initializer)) {
    return O.none();
  }

  const field = fieldName.value;
  const container = inferSchemaContainerSymbol(parent);
  return O.some(
    SchemaFirstInventoryEntry.make({
      file,
      symbol: `${container}.${field}`,
      kind: "schema-policy-advisory",
      status: "advisory",
      ruleId: "SFV4-numeric-domain",
      line: property.getSourceFile().getLineAndColumnAtPos(property.getStart()).line,
      owner,
      reason: `Broad numeric schema field "${field}" should use S.Finite, S.Int, or a range check unless NaN and infinity are intentional.`,
    })
  );
};

const isBroadEmailSchemaExpression = (initializer: Node): boolean => {
  const text = initializer.getText();
  if (/\b(?:Email|ContactEmail)\b|S\.NonEmptyString\b|\.check\(/.test(text)) {
    return false;
  }
  return BROAD_EMAIL_SCHEMA_PATTERN.test(text);
};

const precisionAuditEntryFromProperty = (
  property: import("ts-morph").PropertyAssignment,
  file: string,
  owner: string
): O.Option<SchemaFirstInventoryEntry> => {
  const parent = property.getParent();
  if (!isSchemaFieldsObjectLiteral(parent)) {
    return O.none();
  }

  const fieldName = propertyNameText(property);
  if (O.isNone(fieldName) || !Str.Equivalence(fieldName.value, "email")) {
    return O.none();
  }

  const initializer = property.getInitializer();
  if (initializer === undefined || !isBroadEmailSchemaExpression(initializer)) {
    return O.none();
  }

  const container = inferSchemaContainerSymbol(parent);
  return O.some(
    SchemaFirstInventoryEntry.make({
      file,
      symbol: `${container}.email`,
      kind: "schema-policy-advisory",
      status: "advisory",
      ruleId: "SFV4-precision-audit",
      line: property.getSourceFile().getLineAndColumnAtPos(property.getStart()).line,
      owner,
      reason:
        'Broad string field "email" should use @beep/schema Email, a local precise email schema, or a documented external-protocol exception.',
    })
  );
};

const sourceHasStaticApiSchemaSignal = (sourceFile: import("ts-morph").SourceFile): boolean =>
  STATIC_API_SCHEMA_SIGNAL_PATTERN.test(sourceFile.getFullText());

const isSchemaDiscriminatorToken = (token: string): boolean =>
  A.some(SCHEMA_DISCRIMINATOR_TOKENS, (discriminatorToken) => Str.Equivalence(discriminatorToken, token));

const schemaDiscriminatorExpressionText = (expression: Node): O.Option<string> => {
  if (Node.isIdentifier(expression) && isSchemaDiscriminatorToken(expression.getText())) {
    return O.some(expression.getText());
  }
  if (Node.isPropertyAccessExpression(expression) && isSchemaDiscriminatorToken(expression.getName())) {
    return O.some(expression.getText());
  }
  return O.none();
};

const inferExecutableContainerSymbol = (node: Node): string => {
  const functionDeclaration = node.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration);
  if (functionDeclaration !== undefined) {
    return functionDeclaration.getName() ?? "anonymous-function";
  }
  const arrowFunction = node.getFirstAncestorByKind(SyntaxKind.ArrowFunction);
  const arrowVariableDeclaration = arrowFunction?.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
  if (arrowVariableDeclaration !== undefined) {
    return arrowVariableDeclaration.getName();
  }
  const functionExpression = node.getFirstAncestorByKind(SyntaxKind.FunctionExpression);
  const functionExpressionVariableDeclaration = functionExpression?.getFirstAncestorByKind(
    SyntaxKind.VariableDeclaration
  );
  if (functionExpressionVariableDeclaration !== undefined) {
    return functionExpressionVariableDeclaration.getName();
  }
  return inferSchemaContainerSymbol(node);
};

const staticApiEntryFromSwitch = (
  switchStatement: import("ts-morph").SwitchStatement,
  file: string,
  owner: string
): O.Option<SchemaFirstInventoryEntry> =>
  pipe(
    schemaDiscriminatorExpressionText(switchStatement.getExpression()),
    O.map((expressionText) => {
      const line = switchStatement.getSourceFile().getLineAndColumnAtPos(switchStatement.getStart()).line;
      return SchemaFirstInventoryEntry.make({
        file,
        symbol: `${inferExecutableContainerSymbol(switchStatement)}.switch(${expressionText})`,
        kind: "schema-policy-advisory",
        status: "advisory",
        ruleId: "SFV4-static-api",
        line,
        owner,
        reason: `Schema-modeled discriminator switch "${expressionText}" should use schema-derived .match/.guards or LiteralKit.$match when semantics match.`,
      });
    })
  );

const isJsonParseCallExpression = (callExpression: import("ts-morph").CallExpression): boolean => {
  const expression = callExpression.getExpression();
  return (
    Node.isPropertyAccessExpression(expression) &&
    expression.getExpression().getText() === "JSON" &&
    expression.getName() === "parse"
  );
};

const boundaryCodecEntryFromJsonParse = (
  callExpression: import("ts-morph").CallExpression,
  file: string,
  owner: string
): SchemaFirstInventoryEntry =>
  SchemaFirstInventoryEntry.make({
    file,
    symbol: `${inferExecutableContainerSymbol(callExpression)}.JSON.parse`,
    kind: "schema-policy-advisory",
    status: "advisory",
    ruleId: "SFV4-boundary-codec",
    line: callExpression.getSourceFile().getLineAndColumnAtPos(callExpression.getStart()).line,
    owner,
    reason:
      "Direct JSON.parse boundary should use S.UnknownFromJsonString or S.fromJsonString(schema) so parsing and validation stay schema-owned.",
  });

type FunctionLikeDeclarationNode = import("ts-morph").FunctionDeclaration | import("ts-morph").ArrowFunction;

const sourceExportedArrowFunctions = (
  sourceFile: import("ts-morph").SourceFile
): ReadonlyArray<import("ts-morph").ArrowFunction> =>
  pipe(
    sourceFile.getVariableStatements(),
    A.filter((statement) => statement.isExported()),
    A.flatMap((statement) => statement.getDeclarations()),
    A.map((declaration) => O.fromNullishOr(declaration.getInitializer())),
    A.map(O.filter(Node.isArrowFunction)),
    A.getSomes
  );

const functionLikeSymbolName = (node: FunctionLikeDeclarationNode): string => {
  if (Node.isFunctionDeclaration(node)) {
    return node.getName() ?? "anonymous-function";
  }
  const variableDeclaration = node.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
  return variableDeclaration?.getName() ?? "anonymous-arrow";
};

const isInlineTypeLiteralNode = (typeNode: Node | undefined): boolean =>
  typeNode !== undefined && Node.isTypeLiteral(typeNode);

const sourceHasFnSchemaSignal = (sourceFile: import("ts-morph").SourceFile): boolean => {
  const text = sourceFile.getFullText();
  return SCHEMA_FIELDS_CALL_PATTERN.test(text) || FN_CALL_SIGNAL_PATTERN.test(text);
};

/**
 * Detect an exported function or arrow function whose parameter or return
 * contract is an inline object type literal rather than a schema, within a
 * schema-modeled file. Generic declarations are conservatively skipped.
 *
 * @param node - Exported `FunctionDeclaration` or `ArrowFunction` candidate.
 * @param file - Repo-relative posix path of the source file.
 * @param owner - Resolved owning package for the finding.
 * @returns `O.some` with the advisory entry when an inline object contract is found, `O.none` otherwise.
 * @example
 * ```ts
 * import { fnSchemaEntryFromFunctionLike } from "@beep/repo-cli/commands/Lint"
 * console.log(fnSchemaEntryFromFunctionLike)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const fnSchemaEntryFromFunctionLike = (
  node: FunctionLikeDeclarationNode,
  file: string,
  owner: string
): O.Option<SchemaFirstInventoryEntry> => {
  if (node.getTypeParameters().length > 0) {
    return O.none();
  }

  const hasInlineParameterTypeLiteral = A.some(node.getParameters(), (parameter) =>
    isInlineTypeLiteralNode(parameter.getTypeNode())
  );
  const hasInlineReturnTypeLiteral = isInlineTypeLiteralNode(node.getReturnTypeNode());
  if (!hasInlineParameterTypeLiteral && !hasInlineReturnTypeLiteral) {
    return O.none();
  }

  const name = functionLikeSymbolName(node);
  return O.some(
    SchemaFirstInventoryEntry.make({
      file,
      symbol: name,
      kind: "schema-policy-advisory",
      status: "advisory",
      ruleId: "SFV4-fn-schema",
      line: node.getSourceFile().getLineAndColumnAtPos(node.getStart()).line,
      owner,
      reason: `Exported function "${name}" carries inline object contracts in a schema-modeled file; model them with Fn({ input, output }) from @beep/schema or an S.Class so the contract is executable.`,
    })
  );
};

/**
 * Detect an exported function or arrow function whose explicit return type
 * annotation includes `null` or `undefined` rather than an `O.Option`,
 * `Result`, `Effect`, or `Exit` return. Only explicit annotations are
 * inspected; inferred returns are out of scope. Generic declarations and
 * `.tsx` react boundary files are conservatively skipped by callers.
 *
 * @param node - Exported `FunctionDeclaration` or `ArrowFunction` candidate.
 * @param file - Repo-relative posix path of the source file.
 * @param owner - Resolved owning package for the finding.
 * @returns `O.some` with the advisory entry when a null/undefined return annotation is found, `O.none` otherwise.
 * @example
 * ```ts
 * import { nullReturnEntryFromFunctionLike } from "@beep/repo-cli/commands/Lint"
 * console.log(nullReturnEntryFromFunctionLike)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const nullReturnEntryFromFunctionLike = (
  node: FunctionLikeDeclarationNode,
  file: string,
  owner: string
): O.Option<SchemaFirstInventoryEntry> => {
  if (node.getTypeParameters().length > 0) {
    return O.none();
  }

  const returnTypeNode = node.getReturnTypeNode();
  if (returnTypeNode === undefined || !NULL_UNDEFINED_RETURN_PATTERN.test(returnTypeNode.getText())) {
    return O.none();
  }

  const name = functionLikeSymbolName(node);
  return O.some(
    SchemaFirstInventoryEntry.make({
      file,
      symbol: name,
      kind: "schema-policy-advisory",
      status: "advisory",
      ruleId: "SFV4-null-return",
      line: node.getSourceFile().getLineAndColumnAtPos(node.getStart()).line,
      owner,
      reason: `Exported helper "${name}" declares a null/undefined return; return O.Option, Result, Effect, or Exit instead (3rd-party/react boundary returns are ledgered exceptions).`,
    })
  );
};

const isNullReturnEligibleFilePath = (filePath: string): boolean => !Str.endsWith(".tsx")(filePath);

const isNormalizationMethodName = (name: string): boolean =>
  A.some(NORMALIZATION_METHOD_NAMES, (methodName) => Str.Equivalence(methodName, name));

const sourceHasNormalizationSignal = (sourceFile: import("ts-morph").SourceFile): boolean => {
  const text = sourceFile.getFullText();
  return SCHEMA_FIELDS_CALL_PATTERN.test(text) && NORMALIZATION_CALL_SIGNAL_PATTERN.test(text);
};

/**
 * Detect a zero-argument `.trim()`/`.toUpperCase()`/`.toLowerCase()` call made
 * inside a function body of a schema-modeled file. Such normalization belongs
 * in a schema transformation so the invariant travels with the data instead of
 * living in ad hoc imperative code.
 *
 * @param callExpression - Candidate call expression to inspect.
 * @param file - Repo-relative posix path of the source file.
 * @param owner - Resolved owning package for the finding.
 * @returns `O.some` with the advisory entry when a function-local normalization call is found, `O.none` otherwise.
 * @example
 * ```ts
 * import { normalizationEntryFromCallExpression } from "@beep/repo-cli/commands/Lint"
 * console.log(normalizationEntryFromCallExpression)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const normalizationEntryFromCallExpression = (
  callExpression: import("ts-morph").CallExpression,
  file: string,
  owner: string
): O.Option<SchemaFirstInventoryEntry> => {
  const expression = callExpression.getExpression();
  if (
    !Node.isPropertyAccessExpression(expression) ||
    !isNormalizationMethodName(expression.getName()) ||
    callExpression.getArguments().length > 0 ||
    !isFunctionLocalNode(callExpression)
  ) {
    return O.none();
  }

  const methodName = expression.getName();
  const container = inferExecutableContainerSymbol(callExpression);
  return O.some(
    SchemaFirstInventoryEntry.make({
      file,
      symbol: `${container}.${methodName}`,
      kind: "schema-policy-advisory",
      status: "advisory",
      ruleId: "SFV4-normalization",
      line: callExpression.getSourceFile().getLineAndColumnAtPos(callExpression.getStart()).line,
      owner,
      reason: `Normalization call ".${methodName}()" inside a function body in a schema-modeled file should live in a schema transformation (S.decodeTo + SchemaTransformation, or SchemaGetter) so the invariant travels with the data.`,
    })
  );
};

const sourceHasGetSomesSignal = (sourceFile: import("ts-morph").SourceFile): boolean =>
  GETSOMES_CALL_SIGNAL_PATTERN.test(sourceFile.getFullText());

const isGetSomesObjectName = (name: string): boolean =>
  A.some(GETSOMES_OBJECT_NAMES, (objectName) => Str.Equivalence(objectName, name));

/**
 * Detect an `R.getSomes(...)`/`Record.getSomes(...)` call whose first argument
 * is an inline object literal, i.e. a heterogeneous Option-struct spread that
 * should preserve literal keys and per-key value types through
 * `O.getSomesStruct` instead. Calls over an identifier/variable argument (the
 * homogeneous dynamic-key dictionary case) are left alone.
 *
 * @param callExpression - Candidate call expression to inspect.
 * @param file - Repo-relative posix path of the source file.
 * @param owner - Resolved owning package for the finding.
 * @returns `O.some` with the advisory entry when an inline Option-struct literal is spread through `getSomes`, `O.none` otherwise.
 * @example
 * ```ts
 * import { getsomesStructEntryFromCallExpression } from "@beep/repo-cli/commands/Lint"
 * console.log(getsomesStructEntryFromCallExpression)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const getsomesStructEntryFromCallExpression = (
  callExpression: import("ts-morph").CallExpression,
  file: string,
  owner: string
): O.Option<SchemaFirstInventoryEntry> => {
  const expression = callExpression.getExpression();
  if (!Node.isPropertyAccessExpression(expression) || expression.getName() !== "getSomes") {
    return O.none();
  }
  if (!isGetSomesObjectName(expression.getExpression().getText())) {
    return O.none();
  }
  const firstArgument = callExpression.getArguments()[0];
  if (firstArgument === undefined || !Node.isObjectLiteralExpression(firstArgument)) {
    return O.none();
  }

  return O.some(
    SchemaFirstInventoryEntry.make({
      file,
      symbol: `${inferExecutableContainerSymbol(callExpression)}.R.getSomes`,
      kind: "schema-policy-advisory",
      status: "advisory",
      ruleId: "SFV4-getsomes-struct",
      line: callExpression.getSourceFile().getLineAndColumnAtPos(callExpression.getStart()).line,
      owner,
      reason:
        "R.getSomes over an inline Option-struct literal should use O.getSomesStruct (@beep/utils) to preserve literal keys and per-key value types; R.getSomes remains for homogeneous dynamic-key dictionaries (Law 20/47 as amended 2026-07-05).",
    })
  );
};

const sourceHasDefaultsSchemaSignal = (sourceFile: import("ts-morph").SourceFile): boolean =>
  DEFAULTS_SCHEMA_SIGNAL_PATTERN.test(sourceFile.getFullText());

const isDefaultParameterName = (name: string): boolean =>
  A.some(DEFAULT_PARAMETER_NAMES, (parameterName) => Str.Equivalence(parameterName, name));

const isNonEmptyObjectLiteral = (node: Node): node is import("ts-morph").ObjectLiteralExpression =>
  Node.isObjectLiteralExpression(node) && node.getProperties().length > 0;

const defaultsEntryFromParameter = (
  parameter: import("ts-morph").ParameterDeclaration,
  file: string,
  owner: string
): O.Option<SchemaFirstInventoryEntry> => {
  const initializer = parameter.getInitializer();
  if (initializer === undefined || !isNonEmptyObjectLiteral(initializer)) {
    return O.none();
  }

  const parameterName = parameter.getName();
  if (!isDefaultParameterName(parameterName)) {
    return O.none();
  }

  return O.some(
    SchemaFirstInventoryEntry.make({
      file,
      symbol: `${inferExecutableContainerSymbol(parameter)}.${parameterName}`,
      kind: "schema-policy-advisory",
      status: "advisory",
      ruleId: "SFV4-defaults",
      line: parameter.getSourceFile().getLineAndColumnAtPos(parameter.getStart()).line,
      owner,
      reason: `Parameter default object for "${parameterName}" should move fallback values into schema defaults so construction, decoding, and tests share one source of truth.`,
    })
  );
};

const sourceHasEquivalenceSchemaSignal = (sourceFile: import("ts-morph").SourceFile): boolean =>
  EQUIVALENCE_SCHEMA_SIGNAL_PATTERN.test(sourceFile.getFullText());

const isSchemaDerivedEquivalenceExpression = (text: string): boolean => SCHEMA_DERIVED_EQUIVALENCE_PATTERN.test(text);

const hasManualEqualityComparison = (text: string): boolean => MANUAL_EQUALITY_COMPARISON_PATTERN.test(text);

const isExportedEqualsVariableDeclaration = (declaration: import("ts-morph").VariableDeclaration): boolean => {
  if (!Str.Equivalence(declaration.getName(), "equals")) {
    return false;
  }
  const variableStatement = declaration.getFirstAncestorByKind(SyntaxKind.VariableStatement);
  return variableStatement?.isExported() ?? false;
};

const equivalenceEntryFromVariableDeclaration = (
  declaration: import("ts-morph").VariableDeclaration,
  file: string,
  owner: string
): O.Option<SchemaFirstInventoryEntry> => {
  if (!isExportedEqualsVariableDeclaration(declaration)) {
    return O.none();
  }

  const initializerText = declaration.getInitializer()?.getText() ?? "";
  if (isSchemaDerivedEquivalenceExpression(initializerText) || !hasManualEqualityComparison(initializerText)) {
    return O.none();
  }

  return O.some(
    SchemaFirstInventoryEntry.make({
      file,
      symbol: declaration.getName(),
      kind: "schema-policy-advisory",
      status: "advisory",
      ruleId: "SFV4-equivalence",
      line: declaration.getSourceFile().getLineAndColumnAtPos(declaration.getStart()).line,
      owner,
      reason:
        'Exported schema-modeled equality helper "equals" should derive from S.toEquivalence(schema) unless comparison intentionally differs from schema semantics.',
    })
  );
};

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

const literalMemberEquals = <const T extends string>(members: readonly T[], candidate: string): boolean =>
  A.some(members, (member) => Str.Equivalence(member, candidate));

const isSchemaArbitraryCallExpression = (callExpression: import("ts-morph").CallExpression): boolean => {
  const expression = callExpression.getExpression();
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
 * @param sourceText - TypeScript source text to inspect.
 * @returns Whether the text contains schema-derived arbitrary coverage.
 * @example
 * ```ts
 * import { sourceTextHasSchemaArbitraryPropertyCoverage } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(sourceTextHasSchemaArbitraryPropertyCoverage("fc.property(S.toArbitrary(Worker), (worker) => true)"))
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const sourceTextHasSchemaArbitraryPropertyCoverage = (sourceText: string): boolean => {
  const project = new Project({ skipAddingFilesFromTsConfig: true });
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

const isLiteralKitConstAssertionArgument = (argument: Node): boolean =>
  Node.isAsExpression(argument) &&
  Node.isArrayLiteralExpression(argument.getExpression()) &&
  argument.getTypeNode()?.getText() === "const";

const collectLiteralKitConstAssertionViolations = Effect.fn(function* () {
  const path = yield* Path.Path;
  const project = new Project({
    tsConfigFilePath: path.join(process.cwd(), "tsconfig.json"),
    skipAddingFilesFromTsConfig: true,
  });

  project.addSourceFilesAtPaths(SOURCE_FILE_GLOBS);

  const violations = A.empty<LiteralKitConstAssertionViolation>();

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = toPosixPath(path.relative(process.cwd(), sourceFile.getFilePath()));
    if (isExcludedFile(filePath)) {
      continue;
    }

    for (const callExpression of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      if (callExpression.getExpression().getText() !== "LiteralKit") {
        continue;
      }

      const args = callExpression.getArguments();
      for (let argumentIndex = 0; argumentIndex < args.length; argumentIndex += 1) {
        const argument = args[argumentIndex];
        if (!isLiteralKitConstAssertionArgument(argument)) {
          continue;
        }

        A.appendInPlace(
          violations,
          LiteralKitConstAssertionViolation.make({
            file: filePath,
            line: sourceFile.getLineAndColumnAtPos(argument.getStart()).line,
            argument: argumentIndex + 1,
          })
        );
      }
    }
  }

  return violations;
});

const scanSchemaFirstInventory = Effect.fn(function* () {
  const path = yield* Path.Path;
  const ownerResolver = yield* makeOwnerResolver();
  const project = new Project({
    tsConfigFilePath: path.join(process.cwd(), "tsconfig.json"),
    skipAddingFilesFromTsConfig: true,
  });
  const thunkCandidate = () => "candidate" as const;
  const thunkException = () => "exception" as const;

  project.addSourceFilesAtPaths(SOURCE_FILE_GLOBS);

  const entries = A.empty<SchemaFirstInventoryEntry>();
  const pushEntry = (
    file: string,
    symbol: string,
    kind: typeof SchemaFirstEntryKind.Type,
    status: typeof SchemaFirstEntryStatus.Type,
    reason: string,
    owner: string,
    options: {
      readonly line?: number;
      readonly ruleId?: typeof SchemaFirstPolicyRuleId.Type;
    } = {}
  ) =>
    void A.appendInPlace(
      entries,
      SchemaFirstInventoryEntry.make({
        file,
        symbol,
        kind,
        status,
        ...options,
        reason,
        owner,
      })
    );

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = toPosixPath(path.relative(process.cwd(), sourceFile.getFilePath()));
    const owner = ownerResolver(sourceFile.getFilePath());
    const arbitraryTestsEntry = arbitraryTestsEntryFromSourceFile(sourceFile, filePath, owner);
    if (O.isSome(arbitraryTestsEntry)) {
      A.appendInPlace(entries, arbitraryTestsEntry.value);
    }
    if (isExcludedFile(filePath)) {
      continue;
    }

    for (const declaration of sourceFile.getInterfaces()) {
      if (!declaration.isExported()) {
        continue;
      }
      const reasonOption = detectInterfaceReason(declaration);
      pushEntry(
        filePath,
        declaration.getName(),
        "exported-interface",
        O.match(reasonOption, {
          onNone: thunkCandidate,
          onSome: thunkException,
        }),
        O.getOrElse(reasonOption, () => "Exported pure-data interface should be modeled as an annotated schema."),
        owner
      );
    }

    for (const declaration of sourceFile.getTypeAliases()) {
      if (!declaration.isExported()) {
        continue;
      }
      const typeNode = declaration.getTypeNode();
      if (typeNode === undefined || typeNode.getKind() !== SyntaxKind.TypeLiteral) {
        continue;
      }
      const reasonOption = detectTypeAliasReason(declaration);
      pushEntry(
        filePath,
        declaration.getName(),
        "exported-type-literal",
        O.match(reasonOption, {
          onNone: thunkCandidate,
          onSome: thunkException,
        }),
        O.getOrElse(reasonOption, () => "Exported pure-data type alias should be modeled as an annotated schema."),
        owner
      );
    }

    const hasNormalizationSignal = sourceHasNormalizationSignal(sourceFile);
    const hasGetSomesSignal = sourceHasGetSomesSignal(sourceFile);

    for (const callExpression of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      if (hasNormalizationSignal) {
        const normalizationEntry = normalizationEntryFromCallExpression(callExpression, filePath, owner);
        if (O.isSome(normalizationEntry)) {
          A.appendInPlace(entries, normalizationEntry.value);
        }
      }
      if (hasGetSomesSignal) {
        const getsomesEntry = getsomesStructEntryFromCallExpression(callExpression, filePath, owner);
        if (O.isSome(getsomesEntry)) {
          A.appendInPlace(entries, getsomesEntry.value);
        }
      }

      if (callExpression.getExpression().getText() !== "S.Struct") {
        if (isJsonParseCallExpression(callExpression)) {
          A.appendInPlace(entries, boundaryCodecEntryFromJsonParse(callExpression, filePath, owner));
        }
        continue;
      }
      const reasonOption = detectStructReason(callExpression);
      pushEntry(
        filePath,
        inferStructSymbol(callExpression),
        "object-struct-schema",
        O.match(reasonOption, {
          onNone: thunkCandidate,
          onSome: thunkException,
        }),
        O.getOrElse(reasonOption, () => "Object schema should prefer an annotated S.Class over S.Struct."),
        owner
      );
    }

    const functionLikeCandidates: ReadonlyArray<FunctionLikeDeclarationNode> = [
      ...A.filter(sourceFile.getFunctions(), (declaration) => declaration.isExported()),
      ...sourceExportedArrowFunctions(sourceFile),
    ];
    const hasFnSchemaSignal = sourceHasFnSchemaSignal(sourceFile);
    const isNullReturnEligible = isNullReturnEligibleFilePath(filePath);

    for (const functionLike of functionLikeCandidates) {
      if (hasFnSchemaSignal) {
        const fnSchemaEntry = fnSchemaEntryFromFunctionLike(functionLike, filePath, owner);
        if (O.isSome(fnSchemaEntry)) {
          A.appendInPlace(entries, fnSchemaEntry.value);
        }
      }
      if (isNullReturnEligible) {
        const nullReturnEntry = nullReturnEntryFromFunctionLike(functionLike, filePath, owner);
        if (O.isSome(nullReturnEntry)) {
          A.appendInPlace(entries, nullReturnEntry.value);
        }
      }
    }

    for (const property of sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment)) {
      const entry = numericDomainEntryFromProperty(property, filePath, owner);
      if (O.isSome(entry)) {
        A.appendInPlace(entries, entry.value);
      }
      const precisionEntry = precisionAuditEntryFromProperty(property, filePath, owner);
      if (O.isSome(precisionEntry)) {
        A.appendInPlace(entries, precisionEntry.value);
      }
    }

    if (sourceHasStaticApiSchemaSignal(sourceFile)) {
      for (const switchStatement of sourceFile.getDescendantsOfKind(SyntaxKind.SwitchStatement)) {
        const entry = staticApiEntryFromSwitch(switchStatement, filePath, owner);
        if (O.isSome(entry)) {
          A.appendInPlace(entries, entry.value);
        }
      }
    }

    if (sourceHasDefaultsSchemaSignal(sourceFile)) {
      for (const parameter of sourceFile.getDescendantsOfKind(SyntaxKind.Parameter)) {
        const entry = defaultsEntryFromParameter(parameter, filePath, owner);
        if (O.isSome(entry)) {
          A.appendInPlace(entries, entry.value);
        }
      }
    }

    if (sourceHasEquivalenceSchemaSignal(sourceFile)) {
      for (const declaration of sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
        const entry = equivalenceEntryFromVariableDeclaration(declaration, filePath, owner);
        if (O.isSome(entry)) {
          A.appendInPlace(entries, entry.value);
        }
      }
    }
  }

  return SchemaFirstInventoryDocument.make({
    version: 1,
    generatedOn: todayYmd(),
    scope: A.fromIterable(INCLUDED_GLOBS),
    entries: sortEntries(A.dedupeWith(entries, (left, right) => makeEntryKey(left) === makeEntryKey(right))),
  });
});

const mergeInventory = (
  liveDocument: SchemaFirstInventoryDocument,
  existingDocument: O.Option<SchemaFirstInventoryDocument>
): SchemaFirstInventoryDocument => {
  const existingByKey = pipe(
    existingDocument,
    O.map((document) =>
      HashMap.fromIterable(
        A.map(document.entries, (entry): readonly [string, SchemaFirstInventoryEntry] => [makeEntryKey(entry), entry])
      )
    ),
    O.getOrElse(HashMap.empty<string, SchemaFirstInventoryEntry>)
  );

  const mergedEntries = pipe(
    liveDocument.entries,
    A.map((entry) => O.getOrElse(HashMap.get(existingByKey, makeEntryKey(entry)), () => entry))
  );

  return SchemaFirstInventoryDocument.make({
    version: 1,
    generatedOn: liveDocument.generatedOn,
    scope: liveDocument.scope,
    entries: sortEntries(mergedEntries),
  });
};

type SchemaFirstLintFindings = {
  readonly missingEntries: ReadonlyArray<SchemaFirstInventoryEntry>;
  readonly staleEntries: ReadonlyArray<SchemaFirstInventoryEntry>;
  readonly enforcedCandidates: ReadonlyArray<SchemaFirstInventoryEntry>;
  readonly boundaryCodecAdvisories: ReadonlyArray<SchemaFirstInventoryEntry>;
  readonly defaultsAdvisories: ReadonlyArray<SchemaFirstInventoryEntry>;
  readonly staticApiAdvisories: ReadonlyArray<SchemaFirstInventoryEntry>;
  readonly equivalenceAdvisories: ReadonlyArray<SchemaFirstInventoryEntry>;
  readonly precisionAuditAdvisories: ReadonlyArray<SchemaFirstInventoryEntry>;
  readonly arbitraryTestsAdvisories: ReadonlyArray<SchemaFirstInventoryEntry>;
  readonly numericDomainAdvisories: ReadonlyArray<SchemaFirstInventoryEntry>;
  readonly fnSchemaAdvisories: ReadonlyArray<SchemaFirstInventoryEntry>;
  readonly normalizationAdvisories: ReadonlyArray<SchemaFirstInventoryEntry>;
  readonly nullReturnAdvisories: ReadonlyArray<SchemaFirstInventoryEntry>;
  readonly getsomesStructAdvisories: ReadonlyArray<SchemaFirstInventoryEntry>;
  readonly activeAdvisories: ReadonlyArray<SchemaFirstInventoryEntry>;
  readonly policyExemptCount: number;
};

const inventoryEntriesByKey = (
  entries: ReadonlyArray<SchemaFirstInventoryEntry>
): HashMap.HashMap<string, SchemaFirstInventoryEntry> =>
  HashMap.fromIterable(
    A.map(entries, (entry): readonly [string, SchemaFirstInventoryEntry] => [makeEntryKey(entry), entry])
  );

const trackedInventoryEntriesByKey = (
  existingDocument: O.Option<SchemaFirstInventoryDocument>
): HashMap.HashMap<string, SchemaFirstInventoryEntry> =>
  O.match(existingDocument, {
    onNone: HashMap.empty<string, SchemaFirstInventoryEntry>,
    onSome: (document) => inventoryEntriesByKey(document.entries),
  });

const inventoryEntriesAbsentFrom = (
  entries: ReadonlyArray<SchemaFirstInventoryEntry>,
  entriesByKey: HashMap.HashMap<string, SchemaFirstInventoryEntry>
): ReadonlyArray<SchemaFirstInventoryEntry> =>
  A.filter(entries, (entry) => !HashMap.has(entriesByKey, makeEntryKey(entry)));

const staleInventoryEntries = (
  existingDocument: O.Option<SchemaFirstInventoryDocument>,
  liveByKey: HashMap.HashMap<string, SchemaFirstInventoryEntry>
): ReadonlyArray<SchemaFirstInventoryEntry> =>
  pipe(
    existingDocument,
    O.map((document) => inventoryEntriesAbsentFrom(document.entries, liveByKey)),
    O.getOrElse(A.empty<SchemaFirstInventoryEntry>)
  );

const collectSchemaFirstLintFindings = (
  liveDocument: SchemaFirstInventoryDocument,
  existingDocument: O.Option<SchemaFirstInventoryDocument>,
  mergedDocument: SchemaFirstInventoryDocument,
  policyDocument: O.Option<SchemaCrispeningPolicyDocument>
): SchemaFirstLintFindings => {
  const isExempt = isSchemaCrispeningPolicyExempt(policyDocument);
  const liveByKey = inventoryEntriesByKey(liveDocument.entries);
  const trackedByKey = trackedInventoryEntriesByKey(existingDocument);
  const missingEntries = A.filter(
    inventoryEntriesAbsentFrom(liveDocument.entries, trackedByKey),
    (entry) => !isExempt(entry)
  );
  const staleEntries = A.filter(staleInventoryEntries(existingDocument, liveByKey), (entry) => !isExempt(entry));
  const policyFilteredEntries = A.filter(mergedDocument.entries, (entry) => !isExempt(entry));
  const policyExemptCount = A.filter(mergedDocument.entries, isExempt).length;
  const boundaryCodecAdvisories = A.filter(policyFilteredEntries, isActiveRuleAdvisory("SFV4-boundary-codec"));
  const defaultsAdvisories = A.filter(policyFilteredEntries, isActiveRuleAdvisory("SFV4-defaults"));
  const staticApiAdvisories = A.filter(policyFilteredEntries, isActiveRuleAdvisory("SFV4-static-api"));
  const equivalenceAdvisories = A.filter(policyFilteredEntries, isActiveRuleAdvisory("SFV4-equivalence"));
  const precisionAuditAdvisories = A.filter(policyFilteredEntries, isActiveRuleAdvisory("SFV4-precision-audit"));
  const arbitraryTestsAdvisories = A.filter(policyFilteredEntries, isActiveRuleAdvisory("SFV4-arbitrary-tests"));
  const numericDomainAdvisories = A.filter(policyFilteredEntries, isActiveRuleAdvisory("SFV4-numeric-domain"));
  const fnSchemaAdvisories = A.filter(policyFilteredEntries, isActiveRuleAdvisory("SFV4-fn-schema"));
  const normalizationAdvisories = A.filter(policyFilteredEntries, isActiveRuleAdvisory("SFV4-normalization"));
  const nullReturnAdvisories = A.filter(policyFilteredEntries, isActiveRuleAdvisory("SFV4-null-return"));
  const getsomesStructAdvisories = A.filter(policyFilteredEntries, isActiveRuleAdvisory("SFV4-getsomes-struct"));

  return {
    missingEntries,
    staleEntries,
    enforcedCandidates: A.filter(policyFilteredEntries, (entry) => entry.status === "candidate"),
    boundaryCodecAdvisories,
    defaultsAdvisories,
    staticApiAdvisories,
    equivalenceAdvisories,
    precisionAuditAdvisories,
    arbitraryTestsAdvisories,
    numericDomainAdvisories,
    fnSchemaAdvisories,
    normalizationAdvisories,
    nullReturnAdvisories,
    getsomesStructAdvisories,
    activeAdvisories: [
      ...boundaryCodecAdvisories,
      ...defaultsAdvisories,
      ...staticApiAdvisories,
      ...equivalenceAdvisories,
      ...precisionAuditAdvisories,
      ...arbitraryTestsAdvisories,
      ...numericDomainAdvisories,
      ...fnSchemaAdvisories,
      ...normalizationAdvisories,
      ...nullReturnAdvisories,
      ...getsomesStructAdvisories,
    ],
    policyExemptCount,
  };
};

const makeSchemaFirstLintSummary = (
  liveDocument: SchemaFirstInventoryDocument,
  mergedDocument: SchemaFirstInventoryDocument,
  literalKitConstAssertionViolations: ReadonlyArray<LiteralKitConstAssertionViolation>,
  findings: SchemaFirstLintFindings,
  options: SchemaFirstLintOptions
): SchemaFirstLintSummary =>
  SchemaFirstLintSummary.make({
    liveEntries: liveDocument.entries.length,
    trackedEntries: mergedDocument.entries.length,
    missingEntries: findings.missingEntries.length,
    staleEntries: findings.staleEntries.length,
    enforcedCandidates: findings.enforcedCandidates.length,
    literalKitConstAssertions: literalKitConstAssertionViolations.length,
    boundaryCodecAdvisories: findings.boundaryCodecAdvisories.length,
    defaultsAdvisories: findings.defaultsAdvisories.length,
    staticApiAdvisories: findings.staticApiAdvisories.length,
    equivalenceAdvisories: findings.equivalenceAdvisories.length,
    precisionAuditAdvisories: findings.precisionAuditAdvisories.length,
    arbitraryTestsAdvisories: findings.arbitraryTestsAdvisories.length,
    numericDomainAdvisories: findings.numericDomainAdvisories.length,
    fnSchemaAdvisories: findings.fnSchemaAdvisories.length,
    normalizationAdvisories: findings.normalizationAdvisories.length,
    nullReturnAdvisories: findings.nullReturnAdvisories.length,
    getsomesStructAdvisories: findings.getsomesStructAdvisories.length,
    crispeningPolicyExempt: findings.policyExemptCount,
    wroteInventory: options.write,
  });

const logSchemaFirstSummary = Effect.fn("logSchemaFirstSummary")(function* (summary: SchemaFirstLintSummary) {
  yield* Console.log(`[schema-first] live_entries=${summary.liveEntries}`);
  yield* Console.log(`[schema-first] tracked_entries=${summary.trackedEntries}`);
  yield* Console.log(`[schema-first] missing_entries=${summary.missingEntries}`);
  yield* Console.log(`[schema-first] stale_entries=${summary.staleEntries}`);
  yield* Console.log(`[schema-first] enforced_candidates=${summary.enforcedCandidates}`);
  yield* Console.log(`[schema-first] literal_kit_const_assertions=${summary.literalKitConstAssertions}`);
  yield* Console.log(`[schema-first] sfv4_boundary_codec_advisories=${summary.boundaryCodecAdvisories}`);
  yield* Console.log(`[schema-first] sfv4_defaults_advisories=${summary.defaultsAdvisories}`);
  yield* Console.log(`[schema-first] sfv4_static_api_advisories=${summary.staticApiAdvisories}`);
  yield* Console.log(`[schema-first] sfv4_equivalence_advisories=${summary.equivalenceAdvisories}`);
  yield* Console.log(`[schema-first] sfv4_precision_audit_advisories=${summary.precisionAuditAdvisories}`);
  yield* Console.log(`[schema-first] sfv4_arbitrary_tests_advisories=${summary.arbitraryTestsAdvisories}`);
  yield* Console.log(`[schema-first] sfv4_numeric_domain_advisories=${summary.numericDomainAdvisories}`);
  yield* Console.log(`[schema-first] sfv4_fn_schema_advisories=${summary.fnSchemaAdvisories}`);
  yield* Console.log(`[schema-first] sfv4_normalization_advisories=${summary.normalizationAdvisories}`);
  yield* Console.log(`[schema-first] sfv4_null_return_advisories=${summary.nullReturnAdvisories}`);
  yield* Console.log(`[schema-first] sfv4_getsomes_struct_advisories=${summary.getsomesStructAdvisories}`);
  yield* Console.log(`[schema-first] crispening_policy_exempt=${summary.crispeningPolicyExempt}`);
  if (summary.wroteInventory) {
    yield* Console.log(`[schema-first] wrote ${INVENTORY_PATH}`);
  }
});

const logMissingEntries = Effect.fn("logMissingEntries")(function* (entries: ReadonlyArray<SchemaFirstInventoryEntry>) {
  if (entries.length > 0) {
    yield* Console.error("[schema-first] untracked live findings:");
    for (const entry of entries) {
      yield* Console.error(`- ${entry.file} :: ${entry.symbol} [${entry.kind}] ${entry.reason}`);
      yield* logPolicyFinding(inventoryEntryFinding(entry, entry.reason, missingEntryRemediation(entry)));
    }
  }
});

const logStaleEntries = Effect.fn("logStaleEntries")(function* (entries: ReadonlyArray<SchemaFirstInventoryEntry>) {
  if (entries.length > 0) {
    yield* Console.error("[schema-first] stale inventory entries:");
    for (const entry of entries) {
      yield* Console.error(`- ${entry.file} :: ${entry.symbol} [${entry.kind}]`);
      yield* logPolicyFinding(
        inventoryEntryFinding(
          entry,
          "Stale schema-first inventory entry is no longer present in the live scan.",
          "Run bun run beep lint schema-first --write after confirming the source removal or rename."
        )
      );
    }
  }
});

const logEnforcedCandidates = Effect.fn("logEnforcedCandidates")(function* (
  entries: ReadonlyArray<SchemaFirstInventoryEntry>
) {
  if (entries.length > 0) {
    yield* Console.error("[schema-first] repo still contains candidate findings:");
    for (const entry of entries) {
      yield* Console.error(`- ${entry.file} :: ${entry.symbol} [${entry.kind}] ${entry.reason}`);
      yield* logPolicyFinding(
        inventoryEntryFinding(
          entry,
          entry.reason,
          "Model the exported data with an annotated schema or record a justified exception in standards/schema-first.inventory.jsonc."
        )
      );
    }
  }
});

const logLiteralKitConstAssertionViolations = Effect.fn("logLiteralKitConstAssertionViolations")(function* (
  violations: ReadonlyArray<LiteralKitConstAssertionViolation>
) {
  if (violations.length > 0) {
    yield* Console.error("[schema-first] redundant LiteralKit const assertions:");
    for (const violation of violations) {
      yield* Console.error(
        `- ${violation.file}:${violation.line} arg${violation.argument} [literal-kit-const-assertion] Inline LiteralKit array arguments do not need as const.`
      );
      yield* logPolicyFinding(literalKitConstAssertionFinding(violation));
    }
  }
});

const logActiveAdvisories = Effect.fn("logActiveAdvisories")(function* (
  entries: ReadonlyArray<SchemaFirstInventoryEntry>
) {
  if (entries.length > 0) {
    yield* Console.error("[schema-first] repo still contains advisory findings:");
    for (const entry of entries) {
      yield* Console.error(`- ${entry.file} :: ${entry.symbol} [${entry.kind}] ${entry.reason}`);
      yield* logPolicyFinding(
        inventoryEntryFinding(
          entry,
          entry.reason,
          "Resolve the schema-first advisory or move the entry to exception with a documented reason."
        )
      );
    }
  }
});

// Findings arriving here are already policy-filtered per
// standards/schema-crispening.policy.jsonc (see collectSchemaFirstLintFindings);
// this function does not re-consult the policy itself.
const schemaFirstLintHasFailures = (
  options: SchemaFirstLintOptions,
  findings: SchemaFirstLintFindings,
  literalKitConstAssertionViolations: ReadonlyArray<LiteralKitConstAssertionViolation>
): boolean =>
  A.some(
    [
      findings.enforcedCandidates.length,
      literalKitConstAssertionViolations.length,
      findings.activeAdvisories.length,
      ...(options.write ? [] : [findings.missingEntries.length, findings.staleEntries.length]),
    ],
    (count) => count > 0
  );

/**
 * Run schema-first inventory verification against the committed baseline.
 *
 * @example
 * ```ts
 * console.log("runSchemaFirstLint")
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const runSchemaFirstLint = Effect.fn(function* (options: SchemaFirstLintOptions) {
  const liveDocument = yield* scanSchemaFirstInventory();
  const literalKitConstAssertionViolations = yield* collectLiteralKitConstAssertionViolations();
  const existingDocument = yield* readInventoryDocument();
  const mergedDocument = mergeInventory(liveDocument, existingDocument);
  const policyDocument = yield* readCrispeningPolicyDocument();
  const findings = collectSchemaFirstLintFindings(liveDocument, existingDocument, mergedDocument, policyDocument);
  const summary = makeSchemaFirstLintSummary(
    liveDocument,
    mergedDocument,
    literalKitConstAssertionViolations,
    findings,
    options
  );

  if (options.write) {
    yield* writeInventoryDocument(mergedDocument);
  }

  yield* logSchemaFirstSummary(summary);
  yield* logMissingEntries(findings.missingEntries);
  yield* logStaleEntries(findings.staleEntries);
  yield* logEnforcedCandidates(findings.enforcedCandidates);
  yield* logLiteralKitConstAssertionViolations(literalKitConstAssertionViolations);
  yield* logActiveAdvisories(findings.activeAdvisories);

  if (schemaFirstLintHasFailures(options, findings, literalKitConstAssertionViolations)) {
    return yield* failWithReportedExit("schema-first: inventory enforcement failed.");
  }

  return summary;
});

/**
 * Repo-wide schema-first lint command.
 *
 * @example
 * ```ts
 * console.log("lintSchemaFirstCommand")
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const lintSchemaFirstCommand = Command.make(
  "schema-first",
  {
    write: Flag.boolean("write").pipe(Flag.withDescription("Refresh standards/schema-first.inventory.jsonc")),
  },
  Effect.fn(function* ({ write }) {
    yield* runSchemaFirstLint(SchemaFirstLintOptions.make({ write }));
  })
).pipe(Command.withDescription("Verify the repo-wide schema-first inventory baseline"));
