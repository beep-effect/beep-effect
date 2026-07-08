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
import { Console, Effect, FileSystem, flow, HashMap, MutableHashSet, Order, Path, pipe, SchemaGetter } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { Command, Flag } from "effect/unstable/cli";
import { parse } from "jsonc-parser";
import { Node, Project, SyntaxKind } from "ts-morph";
import { todayYmd } from "../../internal/cli/DateStamp.js";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.js";
import { optionalProp } from "../../internal/cli/OptionRecord.js";
import { readExistingRepoFile } from "../../internal/cli/RepoFile.js";
import type { TypeElementTypes } from "ts-morph";

const $I = $RepoCliId.create("commands/Lint/SchemaFirst");
const INVENTORY_PATH = "standards/schema-first.inventory.jsonc";
const POLICY_PATH = "standards/schema-crispening.policy.jsonc";
const INCLUDED_GLOBS = ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}", "infra/**/*.ts"] as const;
const SOURCE_FILE_GLOBS = [...INCLUDED_GLOBS, "!**/docs/**"] as const;

/**
 * Source glob scope used by schema-first lint and schema catalog scans.
 *
 * @example
 * ```ts
 * import { SchemaFirstIncludedGlobs } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(SchemaFirstIncludedGlobs)
 * ```
 * @category configuration
 * @since 0.0.0
 */
export const SchemaFirstIncludedGlobs: ReadonlyArray<string> = A.fromIterable(INCLUDED_GLOBS);

/**
 * Source glob scope plus scan exclusions used by schema-first ts-morph projects.
 *
 * @example
 * ```ts
 * import { SchemaFirstSourceFileGlobs } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(SchemaFirstSourceFileGlobs)
 * ```
 * @category configuration
 * @since 0.0.0
 */
export const SchemaFirstSourceFileGlobs: ReadonlyArray<string> = A.fromIterable(SOURCE_FILE_GLOBS);
const IDENTIFIER_PROPERTY_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
// R11-5: `\bUint8Array\b` removed — effect v4 has a native `S.Uint8Array`
// codec, so a Uint8Array-typed field is convertible schema data, not a
// non-schema signal. R11-3: `Stream.Stream<` added — an ongoing/live
// computation handle, the same "live resource" rationale as the NodeJS
// Readable/WritableStream entries already below.
const NON_SCHEMA_SIGNAL_PATTERN =
  /\bEffect\.Success<|\bLayer\.Layer<|\bAbortSignal\b|\bAbortController\b|\bEventJournal\.Entry\b|\bZod\b|\bz\.|\bAtom\.|\bNodeJS\.(?:Readable|Writable)Stream\b|\bStream\.Stream<|\bStartedTestContainer\b|\bpulumi\.Input<|\bWinkMethods\b|\b(?:Any)?OperationResult\b/;
// R6-1/R7: schema-authoring infrastructure bases. An interface/type-alias
// that extends one of these (the qualified `S.`/`Schema.` access forms
// actually used in this repo) is a schema-combinator type, not decodable
// data — see ops/reports/P2-audits/p2-s1-generic.md and p2-s3-extends.md.
// R15: S.Codec/S.Union/VariantSchema.Overridable join the pattern —
// SchemaFirst.ts:71-72 (fresh detector-gap evidence:
// ops/reports/SF-1/sf-1-schema.md, gaps #1/#4).
const SCHEMA_INFRASTRUCTURE_EXTENDS_PATTERN =
  /\b(?:S|Schema)\.(?:declareConstructor|decodeTo|Bottom|Codec|Union)\b|\bVariantSchema\.(?:Field|Overridable)\b/;
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

const readInventoryDocument = Effect.fn(function* () {
  const content = yield* readExistingRepoFile(INVENTORY_PATH);
  if (O.isNone(content)) {
    return O.none<SchemaFirstInventoryDocument>();
  }

  return yield* decodeInventoryDocument(parse(content.value)).pipe(Effect.option);
});

const readCrispeningPolicyDocument = Effect.fn(function* () {
  const content = yield* readExistingRepoFile(POLICY_PATH);
  if (O.isNone(content)) {
    return O.none<SchemaCrispeningPolicyDocument>();
  }

  return yield* decodeCrispeningPolicyDocument(parse(content.value)).pipe(Effect.option);
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

/**
 * Create the package-owner resolver used by schema-first repository scans.
 *
 * @example
 * ```ts
 * import { makeSchemaFirstOwnerResolver } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(makeSchemaFirstOwnerResolver)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const makeSchemaFirstOwnerResolver = Effect.fn("makeSchemaFirstOwnerResolver")(function* (
  root?: undefined | string
) {
  const base = root ?? process.cwd();
  // The workspace-entry matching mirrors DualArity.makeOwnerResolver by design:
  // each law keeps its own fallback tail, so the shared prefix stays inline.
  // fallow-ignore-next-line code-duplication
  const workspaces = yield* resolveWorkspaceDirs(base);
  const workspaceEntries = pipe(
    HashMap.toEntries(workspaces),
    A.map(([packageName, absolutePath]) => [packageName, toPosixPath(absolutePath)] as const),
    A.sort(byWorkspacePathLengthDescending)
  );
  // fallow-ignore-next-line code-duplication
  const cwd = toPosixPath(base);

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

/**
 * Create a ts-morph project loaded with the schema-first scan source globs.
 *
 * @example
 * ```ts
 * import { makeSchemaFirstProject } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(makeSchemaFirstProject)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const makeSchemaFirstProject = Effect.fn("makeSchemaFirstProject")(function* () {
  const path = yield* Path.Path;
  const project = new Project({
    tsConfigFilePath: path.join(process.cwd(), "tsconfig.json"),
    skipAddingFilesFromTsConfig: true,
  });

  project.addSourceFilesAtPaths(SOURCE_FILE_GLOBS);

  return project;
});

const SCHEMA_CRISPENING_FAMILY_PREFIXES: ReadonlyArray<readonly [string, typeof SchemaCrispeningFamily.Type]> = [
  ["packages/foundation/", "foundation"],
  ["packages/drivers/", "drivers"],
  ["packages/tooling/", "tooling"],
  ["infra/", "tooling"],
  ["apps/", "apps-slices"],
  ["packages/agents/", "apps-slices"],
  ["packages/architecture-lab/", "apps-slices"],
  ["packages/epistemic/", "apps-slices"],
  ["packages/law-practice/", "apps-slices"],
  ["packages/shared/", "apps-slices"],
  ["packages/workspace/", "apps-slices"],
] as const;

/**
 * Resolve the schema-crispening wave family for a repo-relative source file
 * path by prefix. Every schema-first lint scan scope root — `apps/**`, each
 * `packages/**` family prefix (`foundation`, `drivers`, `tooling`, `agents`,
 * `architecture-lab`, `epistemic`, `law-practice`, `shared`, `workspace`),
 * and `infra/**` — is assigned to a family here; `O.none` is reserved for
 * paths entirely outside the schema-first scan scope (e.g. `scripts/**`).
 *
 * @param file - Repo-relative posix path, e.g. `packages/foundation/modeling/schema/src/Foo.ts`.
 * @returns The resolved wave family, or `O.none` when the path is outside the schema-first scan scope.
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

// Shared by resolveOneLevelLocalTypeAlias below and R15's extends-clause
// target resolution: given a symbol's declarations, find a local
// type-alias declaration among them and return its own type node.
const resolveLocalTypeAliasTypeNode = (declarations: ReadonlyArray<Node>): O.Option<Node> =>
  pipe(
    A.findFirst(declarations, Node.isTypeAliasDeclaration),
    O.flatMap((declaration) => O.fromNullishOr(declaration.getTypeNode()))
  );

// R11-6: resolve one level of a local type-alias indirection before running
// the structural/textual member-safety tests below — hiding a function type
// (or a curated runtime-handle type) behind a named alias identifier must
// not silence the check (proven false-negative: p2-s2-signals.md's
// MintFetchableHandle rejected-alternative). Single-hop only, matching the
// same non-transitive-resolution posture as R7's extends composition.
const resolveOneLevelLocalTypeAlias = (typeNode: Node): Node => {
  if (!Node.isTypeReference(typeNode)) {
    return typeNode;
  }
  const declarations = typeNode.getTypeName().getSymbol()?.getDeclarations() ?? [];
  return pipe(
    resolveLocalTypeAliasTypeNode(declarations),
    O.getOrElse(() => typeNode)
  );
};

// Structural function-likeness. Widened (beyond interface-style
// MethodSignature/CallSignature/ConstructSignature/PropertySignature) to
// also recognize class-style MethodDeclaration/PropertyDeclaration members,
// needed so R7's own+inherited member composition classifies a repo-local
// `declare abstract class` extends target (e.g. ChalkInstanceSurface) the
// same way it classifies an interface extends target. A PropertySignature/
// PropertyDeclaration typed exactly `this` (a self-referential chain
// accessor, e.g. Chalk's `readonly red: this`) is also function-like: it is
// definitionally not decodable schema data, the same reasoning R6-1 already
// applies to `Rebuild: this`.
const isFunctionLikeMember = (member: Node): boolean => {
  if (
    Node.isMethodSignature(member) ||
    Node.isCallSignatureDeclaration(member) ||
    Node.isConstructSignatureDeclaration(member) ||
    Node.isMethodDeclaration(member)
  ) {
    return true;
  }
  if (Node.isPropertySignature(member) || Node.isPropertyDeclaration(member)) {
    const rawTypeNode = member.getTypeNode();
    if (rawTypeNode === undefined) {
      return false;
    }
    const typeNode = resolveOneLevelLocalTypeAlias(rawTypeNode);
    return typeNode.getKind() === SyntaxKind.FunctionType || typeNode.getKind() === SyntaxKind.ThisType;
  }
  return false;
};

// R11-3: curated vendor/live-resource signal, kept explicit and separate
// from the generic function-member check above (NON_SCHEMA_SIGNAL_PATTERN
// only — not the retired function-like text pattern).
const isCuratedRuntimeHandleMember = (member: Node): boolean => {
  if (!Node.isPropertySignature(member) && !Node.isPropertyDeclaration(member)) {
    return false;
  }
  const rawTypeNode = member.getTypeNode();
  if (rawTypeNode === undefined) {
    return false;
  }
  const typeText = resolveOneLevelLocalTypeAlias(rawTypeNode).getText();
  return NON_SCHEMA_SIGNAL_PATTERN.test(typeText);
};

// R6-2/R11-2 + R11-3: every member is either structurally function-like or a
// curated vendor/live-resource signal, i.e. zero schema-able data fields.
// SPEC §5.3 (byte-identical encode + arbitrary round-trip) is unsatisfiable
// for a pure behavior/handle record, so it is silently skipped rather than
// tracked at all.
const isSilentMemberShape = (members: ReadonlyArray<Node>): boolean =>
  !A.isReadonlyArrayEmpty(members) &&
  A.every(members, (member) => isFunctionLikeMember(member) || isCuratedRuntimeHandleMember(member));

const isRebuildThisProperty = (member: Node): boolean => {
  if (!Node.isPropertySignature(member)) {
    return false;
  }
  const nameNode = member.getNameNode();
  const typeNode = member.getTypeNode();
  return (
    Node.isIdentifier(nameNode) &&
    nameNode.getText() === "Rebuild" &&
    typeNode !== undefined &&
    typeNode.getKind() === SyntaxKind.ThisType
  );
};

const hasRebuildThisMember = (members: ReadonlyArray<Node>): boolean => A.some(members, isRebuildThisProperty);

// R13: an own body that is empty, or carries only meta members (Rebuild:
// this), exists solely for the schema-authoring type/value dual-binding —
// driver-verified against DateTimeInsert (Model.datetime.ts:133, empty own
// body). Any OTHER own member is real added data and must still surface via
// member-safety composition.
const isEmptyOrMetaOnlyOwnBody = (members: ReadonlyArray<Node>): boolean =>
  A.isReadonlyArrayEmpty(members) || A.every(members, isRebuildThisProperty);

// R11-3: an interface with its own call signature that also extends another
// (local) type is a callable-instance mirror (e.g. `ChalkInstance extends
// ChalkInstanceSurface { (...text): string }`, mirroring the chalk npm
// package's own callable-instance type) — silently skipped without needing
// to fully classify every inherited accessor/method.
const hasOwnCallSignatureMember = (members: ReadonlyArray<Node>): boolean =>
  A.some(members, (member) => Node.isCallSignatureDeclaration(member));

type SchemaFirstMemberClassification =
  | { readonly _tag: "silent" }
  | { readonly _tag: "candidate" }
  | { readonly _tag: "exception"; readonly reason: string };

const silentClassification: SchemaFirstMemberClassification = { _tag: "silent" };
const candidateClassification: SchemaFirstMemberClassification = { _tag: "candidate" };
const exceptionClassification = (reason: string): SchemaFirstMemberClassification => ({ _tag: "exception", reason });

const GENERIC_TYPE_ALIAS_EXCEPTION_REASON =
  "Generic type alias requires manual modeling and is tracked as an exception.";

const isRepoLocalMemberOwner = (
  node: Node
): node is import("ts-morph").InterfaceDeclaration | import("ts-morph").ClassDeclaration =>
  Node.isInterfaceDeclaration(node) || Node.isClassDeclaration(node);

const isExternalDeclarationNode = (declaration: Node): boolean => declaration.getSourceFile().isInNodeModules();

// R7: single-hop resolution of an extends clause's symbol declarations.
// node_modules (React/d3/frimousse/@base-ui/etc.) and the TypeScript
// lib/DOM ambient declarations (lib.dom.d.ts, JSX) both live under
// node_modules, so isInNodeModules() covers "node_modules/lib/React/JSX/DOM"
// in one check. An unresolvable symbol (empty declarations) is treated as
// NOT external — conservative, keeps the gate strict per fence 13.
const extendsClauseResolvesExternal = (clause: import("ts-morph").ExpressionWithTypeArguments): boolean => {
  const declarations = clause.getExpression().getSymbol()?.getDeclarations() ?? [];
  return !A.isReadonlyArrayEmpty(declarations) && A.every(declarations, isExternalDeclarationNode);
};

const allExtendsClausesResolveExternal = (
  extendsClauses: ReadonlyArray<import("ts-morph").ExpressionWithTypeArguments>
): boolean => A.every(extendsClauses, extendsClauseResolvesExternal);

// R15: resolve one level of local alias/interface indirection on the
// extends-clause target before the pattern test — an extends target that is
// itself a local alias of a schema-infrastructure base (e.g. `extends
// EdgeTransform<Data>` where `EdgeTransform<Data> = S.decodeTo<Data,
// string>`) must not escape the pattern match just because the alias name
// itself doesn't textually match (ops/reports/SF-1/sf-1-schema.md, gap #3).
// Falls back to the clause's own text when it isn't a local type-alias.
const resolveExtendsClauseTargetText = (clause: import("ts-morph").ExpressionWithTypeArguments): string => {
  const declarations = clause.getExpression().getSymbol()?.getDeclarations() ?? [];
  return pipe(
    resolveLocalTypeAliasTypeNode(declarations),
    O.map((typeNode) => typeNode.getText()),
    O.getOrElse(() => clause.getText())
  );
};

const extendsSchemaInfrastructureBase = (
  extendsClauses: ReadonlyArray<import("ts-morph").ExpressionWithTypeArguments>
): boolean =>
  A.some(extendsClauses, (clause) =>
    SCHEMA_INFRASTRUCTURE_EXTENDS_PATTERN.test(resolveExtendsClauseTargetText(clause))
  );

// R7: compose the interface's own members with the OWN (non-transitive)
// members of every extends target that resolves to a repo-local
// interface/class declaration, then classify the composed set exactly like
// a non-extends interface. Single-hop by design — matches the audit's
// no-transitive-resolution rule (p2-s3-extends.md).
const composeOwnAndLocalExtendsMembers = (
  node: import("ts-morph").InterfaceDeclaration,
  extendsClauses: ReadonlyArray<import("ts-morph").ExpressionWithTypeArguments>
): ReadonlyArray<Node> => {
  const inheritedMembers = pipe(
    extendsClauses,
    A.flatMap((clause) => clause.getExpression().getSymbol()?.getDeclarations() ?? []),
    A.filter(isRepoLocalMemberOwner),
    A.flatMap((declaration) => declaration.getMembers())
  );
  return [...node.getMembers(), ...inheritedMembers];
};

const captureContextServiceShapeNames = (
  sourceFile: import("ts-morph").SourceFile
): MutableHashSet.MutableHashSet<string> => {
  const names = MutableHashSet.empty<string>();
  for (const classDeclaration of sourceFile.getClasses()) {
    const heritageText = classDeclaration.getExtends()?.getText() ?? "";
    const match = /\bContext\.Service<\s*[\w.$]+\s*,\s*([\w.$]+)\s*>/.exec(heritageText);
    if (match?.[1] !== undefined) {
      MutableHashSet.add(names, match[1]);
    }
  }
  return names;
};

// R11-1 signal (1): same-file `Context.Service<Tag, X>()` through at most
// one local alias intersection, e.g. `type BoxShape = BoxGeneratedOperations
// & BoxStreamingOperations` then `Box extends Context.Service<Box,
// BoxShape>()`.
const isIntersectionAliasedServiceContractShapeMember = (
  sourceFile: import("ts-morph").SourceFile,
  shapeNames: MutableHashSet.MutableHashSet<string>,
  name: string
): boolean =>
  A.some(sourceFile.getTypeAliases(), (aliasDeclaration) => {
    if (!MutableHashSet.has(shapeNames, aliasDeclaration.getName())) {
      return false;
    }
    const typeNode = aliasDeclaration.getTypeNode();
    return (
      typeNode !== undefined &&
      Node.isIntersectionTypeNode(typeNode) &&
      A.some(typeNode.getTypeNodes(), (member) => member.getText() === name)
    );
  });

const findLocalTypeShapeDeclaration = (
  sourceFile: import("ts-morph").SourceFile,
  name: string
): O.Option<import("ts-morph").InterfaceDeclaration | import("ts-morph").TypeAliasDeclaration> =>
  pipe(
    A.findFirst(sourceFile.getInterfaces(), (candidate) => candidate.getName() === name),
    O.orElse(() => A.findFirst(sourceFile.getTypeAliases(), (candidate) => candidate.getName() === name))
  );

// R11-1 signal (2): the declaration is used as a parameter type of a method
// belonging to another same-file shape that itself satisfies signal (1),
// e.g. `ScopedVectorizer` passed to `WinkVectorizerShape.withFreshInstance`.
// Textual (a same-file parameter-position match), not fully call-graph
// verified — a tractable, documented simplification (see the P25 report).
const isServiceContractMethodParameterName = (
  sourceFile: import("ts-morph").SourceFile,
  shapeNames: MutableHashSet.MutableHashSet<string>,
  name: string
): boolean => {
  const parameterPattern = new RegExp(`[(,<]\\s*\\w+\\s*:\\s*(?:ReadonlyArray<)?${name}\\b`);
  return A.some([...shapeNames], (shapeName) =>
    pipe(
      findLocalTypeShapeDeclaration(sourceFile, shapeName),
      O.exists((declaration) => parameterPattern.test(declaration.getText()))
    )
  );
};

// R11-1 signal (4): the declaration is the element type of a
// `ReadonlyArray<X>`/`Array<X>` capability-provider registry. Simplified to
// a same-file textual presence check rather than verifying iteration plus
// an invoked Effect/Stream-returning member — a tractable, documented
// simplification (see the P25 report).
const isCapabilityRegistryElementType = (sourceFile: import("ts-morph").SourceFile, name: string): boolean =>
  new RegExp(`\\b(?:ReadonlyArray|Array)<${name}>`).test(sourceFile.getFullText());

const PROPS_LIKE_NAME_PATTERN = /(?:Props|RenderProps)$/;

// R11-1 signal (5): `.tsx` + `*Props`/`*RenderProps`, or the second type
// argument to `forwardRef<Handle, Props>`.
const isTsxServiceContractShapeName = (
  sourceFile: import("ts-morph").SourceFile,
  filePath: string,
  name: string
): boolean =>
  Str.endsWith(".tsx")(filePath) &&
  (PROPS_LIKE_NAME_PATTERN.test(name) || new RegExp(`forwardRef<[^,>]+,\\s*${name}>`).test(sourceFile.getFullText()));

// R11-1: checked BEFORE the signals/member-safety check. Any one positive
// signal silently skips a service-contract/port shape (fence 1) instead of
// tracking it as an exception.
const isServiceContractShape = (
  sourceFile: import("ts-morph").SourceFile,
  filePath: string,
  name: string,
  shapeNames: MutableHashSet.MutableHashSet<string>
): boolean =>
  MutableHashSet.has(shapeNames, name) ||
  isIntersectionAliasedServiceContractShapeMember(sourceFile, shapeNames, name) ||
  Str.endsWith(".ports.ts")(filePath) ||
  isServiceContractMethodParameterName(sourceFile, shapeNames, name) ||
  isCapabilityRegistryElementType(sourceFile, name) ||
  isTsxServiceContractShapeName(sourceFile, filePath, name);

const classifyComposedMembers = (
  sourceFile: import("ts-morph").SourceFile,
  filePath: string,
  name: string,
  members: ReadonlyArray<Node>
): SchemaFirstMemberClassification => {
  const shapeNames = captureContextServiceShapeNames(sourceFile);
  if (isServiceContractShape(sourceFile, filePath, name, shapeNames)) {
    return silentClassification;
  }
  if (isSilentMemberShape(members)) {
    return silentClassification;
  }
  // R11-4: mixed data+function shapes with no protecting silent-skip signal
  // are a CANDIDATE (gate strengthened), not a tolerated exception — fix by
  // descriptor-extraction/splitting (the proven ExportedTool pattern).
  return candidateClassification;
};

type PermanentSchemaFirstExclusion = {
  readonly file: string;
  readonly symbol: string;
  readonly reason: string;
};

// R14/R15: driver-verified holds where the schema-first detector's generic
// heuristics cannot recognize a real non-schema shape, baked directly into
// the detector (stronger than a standards/schema-first.inventory.jsonc
// exception record) instead of a standing tracked exception — mirrors
// DualArity.ts's PERMANENT_EXCLUSIONS mechanism. Explicit, reviewable,
// driver-owned entries only; NOT a blanket structural exemption.
const PERMANENT_SCHEMA_FIRST_EXCLUSIONS: ReadonlyArray<PermanentSchemaFirstExclusion> = [
  // R14: categorical-generic family (ops/reports/SF-1/sf-1-graphnode.md) —
  // free type parameters driver-verified (via TypeClass.ts's `ap` /
  // Monoid.ts's `Endo`) to be instantiated with function types; no schema
  // can represent them, and zero concrete schema consumers exist anywhere
  // in either package.
  {
    file: "packages/foundation/capability/nlp-processing/src/Graph/EffectGraph.ts",
    symbol: "GraphNode",
    reason:
      "Free type parameter A proven (via TextOperation's ap, TypeClass.ts:672-674) to range over function types; zero concrete schema consumers repo-wide.",
  },
  {
    file: "packages/foundation/capability/nlp-processing/src/Graph/EffectGraph.ts",
    symbol: "EffectGraph",
    reason: "Direct container of GraphNode<A>; inherits its disqualification.",
  },
  {
    file: "packages/foundation/capability/nlp-processing/src/Graph/TypeClass.ts",
    symbol: "Composable",
    reason:
      "identity: TextOperation<A, A> field is itself the unconvertible categorical-generic type; compose is function-typed.",
  },
  {
    file: "packages/foundation/capability/nlp-processing/src/Graph/TypeClass.ts",
    symbol: "ForgetfulOperation",
    reason:
      "apply is a function field over GraphNode<A>/GraphNode<B>; the only other member (name: string) is too thin to justify a public-contract-breaking split.",
  },
  {
    file: "packages/foundation/capability/nlp-processing/src/Graph/TypeClass.ts",
    symbol: "TextOperation",
    reason:
      "Driver-verified: constraining A/B to S.Top produces 104 tsgo errors from one line; ap's (b: B) => C instantiation is a hard S.Top violation.",
  },
  {
    file: "packages/foundation/capability/nlp-processing/src/Graph/GraphOperations/Operation.ts",
    symbol: "GraphOperation",
    reason:
      "apply/estimateCost/validate are function fields over GraphNode<A>/GraphNode<B>. A descriptor/behavior split (category/description/name vs. the function bundle) is theoretically viable per the R11-4 ExportedTool precedent but breaks every operation.X call site in Executor.ts — DEFERRED to a follow-up goal packet, not attempted here.",
  },
  {
    file: "packages/foundation/capability/nlp-processing/src/Graph/GraphOperations/Types.ts",
    symbol: "OperationResult",
    reason:
      "newNodes: ReadonlyArray<GraphNode<B>> for free B inherits GraphNode's disqualification; originalGraph: unknown is intentionally opaque.",
  },
  {
    file: "packages/foundation/capability/nlp-processing/src/Graph/GraphOperations/ResultStore.ts",
    symbol: "StoredResult",
    reason:
      "Non-generic itself, but result: AnyOperationResult = OperationResult<unknown, unknown> inherits the disqualification transitively.",
  },
  {
    file: "packages/foundation/modeling/nlp/src/Algebra/Monoid.ts",
    symbol: "Monoid",
    reason:
      'Driver-verified: constraining A to S.Top produces 96 tsgo errors from one line; every real instance is over a plain value type, several (Endo: Monoid<(a: A) => A>) over function types — the abstract-algebra carrier-type sense of "generic" is incompatible with S.Top.',
  },
  {
    file: "packages/foundation/modeling/nlp/src/Graph/GraphOps.ts",
    symbol: "SearchIndex",
    reason:
      "keyFn: (node: A) => ReadonlyArray<K> is a stored function (behavior); index: HashMap.HashMap<K, ReadonlyArray<NodeIndex>> is a plain-value HashMap keyed by free K with no schema counterpart.",
  },
  {
    file: "packages/foundation/modeling/nlp/src/Operations/Definition.ts",
    symbol: "OperationDefinition",
    reason:
      "inputSchema: S.Schema<A>/outputSchema: S.Schema<B> are fields whose VALUE is itself a Schema instance (S.toArbitrary/encodeSync fail on this shape); implementation is a behavior field. A descriptor/behavior split (name/description/metadata) is theoretically viable per the R11-4 ExportedTool precedent but breaks every definition.X call site — DEFERRED to a follow-up goal packet, not attempted here.",
  },
  // R15: @beep/schema residue (ops/reports/SF-1/sf-1-schema.md).
  {
    file: "packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts",
    symbol: "union",
    reason:
      "Driver-verified regression reproduced: converting the per-member S.Struct to an S.Class breaks S.toTaggedUnion's generated .guards.<case> predicates (S.is requires instanceof once members are classes) — every plain-object call site (~12 across 8+ packages) would fail its guard.",
  },
  {
    file: "packages/foundation/modeling/schema/src/VariantSchema/VariantSchema.core.ts",
    symbol: "extract",
    reason:
      "Driver-verified regression reproduced: an S.Class-backed Extract<V,A,IsDefault> breaks field enumeration and rejects plain-object encode/decode input across 12 tests in 3 files; Extract<V,A,IsDefault>'s S.Struct<...> return type is consumed by name throughout Model.variants.ts and every entity in the repo — blocked: ripple.",
  },
  {
    file: "packages/foundation/modeling/schema/src/VariantSchema/VariantSchema.core.ts",
    symbol: "Class",
    reason:
      "Foundational VariantSchema toolkit self-definition: extends S.Bottom<...> but has substantial non-empty schema-infra own members (extend/fields/make/mapFields/new) with no Rebuild: this — positive control for the R6 generic-interface family, not a conversion target.",
  },
  {
    file: "packages/foundation/modeling/schema/src/VariantSchema/VariantSchema.core.ts",
    symbol: "Field",
    reason:
      "Foundational VariantSchema toolkit self-definition: extends Pipeable (not a schema base by design), a plain tagged carrier — positive control, not a conversion target.",
  },
  {
    file: "packages/foundation/modeling/schema/src/VariantSchema/VariantSchema.core.ts",
    symbol: "Struct",
    reason:
      "Foundational VariantSchema toolkit self-definition: extends Pipeable (not a schema base by design), a plain tagged carrier — positive control, not a conversion target.",
  },
  {
    file: "packages/foundation/modeling/schema/src/VariantSchema/VariantSchema.core.ts",
    symbol: "Union",
    reason:
      "Foundational VariantSchema toolkit self-definition: extends S.Union<{...}> with no Rebuild: this — positive control for the R6 generic-interface family, not a conversion target.",
  },
  {
    file: "packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.definition.ts",
    symbol: "AssignedEntityParts",
    reason:
      "Pure compile-time entity-builder-DSL plumbing: fields' values are S.Top schema instances (a map of schemas, not schema-describable JSON data); assignEntityParts's body returns a plain object with no S.Class/S.Struct wrapper — no schema value exists to convert.",
  },
  {
    file: "packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.definition.ts",
    symbol: "ClassInput",
    reason:
      "Same DSL-input-descriptor shape as AssignedEntityParts: compile-time builder plumbing, no schema instance backing it.",
  },
  {
    file: "packages/foundation/modeling/schema/src/EntitySchema/EntitySchema.persist.ts",
    symbol: "PersistOptions",
    reason:
      "Same DSL-input-descriptor shape: .persisted's values are PersistDescriptor shape descriptors, not schema-describable data.",
  },
  {
    file: "packages/foundation/modeling/schema/test/CurrencyCode.test.ts",
    symbol: "schema-codec-tests",
    reason:
      "Finite LiteralKit enumeration generated from ISO-4217 data — S.toArbitrary over a closed literal union only re-samples already-enumerated members; example-based assertions are the correct test shape.",
  },
  {
    file: "packages/foundation/modeling/schema/test/TerritoryCode.test.ts",
    symbol: "schema-codec-tests",
    reason: "Finite MappedLiteralKit enumeration generated from CLDR data — same reasoning as CurrencyCode.test.ts.",
  },
  {
    file: "packages/foundation/modeling/schema/test/Timezone.test.ts",
    symbol: "schema-codec-tests",
    reason: "Finite LiteralKit enumeration generated from IANA data — same reasoning as CurrencyCode.test.ts.",
  },
  {
    file: "packages/foundation/modeling/schema/test/Fn.test.ts",
    symbol: "schema-codec-tests",
    reason:
      "Meta-test of the Fn/ThunkOf/AnyFn function-value combinator (declareConstructor + self-identity equivalence) — no structural data to arbitrary-generate.",
  },
  {
    file: "packages/foundation/modeling/schema/test/PromiseSchema.test.ts",
    symbol: "schema-codec-tests",
    reason:
      'S.declare<Promise<unknown>> identity declaration; S.toArbitrary throws "Unsupported AST Declaration" on this exact schema and a native Promise has no meaningful round-trip law.',
  },
  {
    file: "packages/foundation/modeling/schema/test/Transformations.test.ts",
    symbol: "schema-codec-tests",
    reason:
      "Meta-test of destructiveTransform using test-local illustrative schemas; lossy decode + passthrough encode, no round-trip law, no domain source schema.",
  },
  // R15 addendum (ops/reports/SF-1/sf-1-repoutils.md): 3 residue entries live
  // in generic factories parameterized by an abstract Fields extends
  // S.Struct.Fields type parameter (not a concrete schema type argument, so
  // the TypedTextSchema precedent doesn't apply). Driver-reproduced, two
  // independent real TS-level blockers: S.Class cannot be constructed inside
  // a function generic over an abstract Fields param ("Missing Self
  // generic", TS2509 in the class-extends form), and Class's `.ast:
  // Declaration` is incompatible with StructWithRest's `ast: Objects`
  // constraint (independently reproduced by both sf1-schema and
  // sf1-repoutils). A wider makeLooseJsonObject redesign is out of
  // initiative scope.
  {
    file: "packages/tooling/library/repo-utils/src/schemas/TSConfig.ts",
    symbol: "makeTypeStruct",
    reason:
      'S.Class<S.Schema.Type<S.Struct<Fields>>>(...) fails "Missing Self generic" (Self can\'t resolve from the generic Fields param), and even past that the result feeds S.StructWithRest(...).ast at the call site, which fails TS2345 (Class.ast: Declaration vs. StructWithRest.Objects). Reproduced via tsgo, reverted; makeLooseJsonObject redesign deferred out of initiative scope.',
  },
  {
    file: "packages/tooling/library/repo-utils/src/schemas/TSConfig.ts",
    symbol: "makeEncodedStruct",
    reason:
      "Same generic-Fields/StructWithRest.ast blockers as makeTypeStruct — same factory, same reproduced failures.",
  },
  {
    file: "packages/tooling/library/repo-utils/src/schemas/TSConfig.ts",
    symbol: "strict",
    reason:
      'Inside makeLooseJsonObject: both a class-extends form (TS2509, generic Fields base unresolvable) and a non-extends S.Class<Self>(id)(fields) form (same "Missing Self generic" failure as makeTypeStruct) were reproduced via tsgo and reverted; strict is a leaf S.decodeUnknownEffect/S.encodeEffect use with no StructWithRest composition, so only the generic-Self limitation blocks it.',
  },
  // R17 item 3 (ops/reports/SF-2/sf-2-tailb.md): unconvertible residue that
  // survives the R17-1/R17-2 detector fixes above — driver-verified via the
  // lane's real compile attempts / per-entry evidence table.
  {
    file: "packages/drivers/acp/src/AcpProtocol.service.ts",
    symbol: "AcpPatchedProtocol",
    reason:
      'Runtime protocol handle: clientProtocol: RpcClient.Protocol["Service"], serverProtocol: RpcServer.Protocol["Service"], incoming: Stream.Stream<...>, notify/request dual-overload function members — the service-contract/runtime-handle sub-class named explicitly in p2-s2-signals.md.',
  },
  {
    file: "packages/drivers/acp/src/AcpProtocol.service.ts",
    symbol: "AcpPatchedProtocolOptions",
    reason:
      "Extends AcpProtocolLoggingOptions (already S.Class) plus 4 Effect-returning callback fields (logger?/onExtRequest?/onNotification?/onTermination?), a live stdio: Stdio.Stdio handle, and terminationError?: Effect.Effect<...>; S.extend does not exist in v4 and manual field-spread re-arrives at an S.declare-wrapped-function dead end (p2-s3-extends.md Attempt 3).",
  },
  {
    file: "packages/drivers/acp/src/AcpTerminal.models.ts",
    symbol: "AcpTerminal",
    reason:
      "All fields are bound Effect.Effect<...> operations over a live remote-terminal-process handle (kill/output/release/waitForExit) plus sessionId/terminalId strings — the 'processes' example from the SPEC's own unconvertible-signals class, verbatim (p2-s2-signals.md).",
  },
  {
    file: "packages/drivers/acp/src/AcpTerminal.models.ts",
    symbol: "MakeTerminalOptions",
    reason: "Constructor options bag mirroring AcpTerminal's live-handle shape 1:1; same reasoning.",
  },
  {
    file: "packages/foundation/capability/mcp-kit/src/FieldTier.ts",
    symbol: "FieldTierSet",
    reason:
      'Container of S.Struct instances (schema builders, not data) as fields; an S.declare-wrapped version compiles (0 tsgo errors) but S.toArbitrary throws "Unsupported AST Declaration" and encodeSync leaks the internal ~effect/Schema AST representation instead of data (p2-s1-generic.md Attempt 2).',
  },
  {
    file: "packages/foundation/capability/mcp-kit/src/ToolkitComposition.ts",
    symbol: "GatedLayer",
    reason:
      "layer: Layer.Layer<ROut, E, RIn> is a live Effect program-construction handle with no schema representation; registration is already schema-first and there is no second data field to extract — already the minimal decomposition (same conclusion as the ExportedTool precedent).",
  },
  {
    file: "packages/drivers/box/src/Box.streaming.ts",
    symbol: "BoxStreamingOperations",
    reason:
      "Nested groups of Effect/Stream-returning SDK operation methods (avatars.createUserAvatar, chunkedUploads.reducer, downloads.downloadFile, etc. — 11 methods, 100% function-typed, zero data fields); the member-safety check inspects only one level and the outer members (avatars, chunkedUploads, ...) are nested object-literal groupings rather than directly function-typed, so isSilentMemberShape cannot reach them without a deeper structural redesign (p2-s2-signals.md).",
  },
  {
    file: "packages/foundation/capability/api-transport/src/Transport.ts",
    symbol: "ApiTransport",
    reason:
      "100% behavioral: rateLimit: Effect.Effect<O.Option<RateLimitSnapshot>>, transformClient: (client) => HttpClient — zero data fields (p2-s2-signals.md service-contracts sub-class, named explicitly).",
  },
  {
    file: "packages/foundation/capability/api-transport/src/Transport.ts",
    symbol: "ApiTransportOptions",
    reason:
      "auth: ApiAuth is a Data.TaggedEnum, not a schema (redesigning ApiAuth itself is a different, unassigned symbol with its own $match blast radius); genuine options-bag with only 2 known call sites (govinfo/ecfr), both always constructing the full 3-field bag together — un-bundling doesn't help, same reasoning as PgliteSqlTestLayerOptions below.",
  },
  {
    file: "packages/tooling/test-kit/test-utils/src/SqlTest.ts",
    symbol: "PgliteTestcontainerResource",
    reason:
      "Live Testcontainer/Docker resource handle (container: StartedTestContainer), matching NON_SCHEMA_SIGNAL_PATTERN's curated StartedTestContainer signal (p2-s2-signals.md).",
  },
  {
    file: "packages/tooling/test-kit/test-utils/src/SqlTest.ts",
    symbol: "SqlTestHooks",
    reason:
      "Generic test-lifecycle callback bag (migrate?/seed?: Effect.Effect<void, E, SqlClient.SqlClient>), no data fields (p2-s2-signals.md).",
  },
  // Driver-verified via a live detectInterfaceReason probe against the real
  // SqlTest.ts source after the R17-1 fix landed: both still resolve to
  // "candidate", not "silent" (no isServiceContractShape signal matches
  // their actual same-file usage), so the R17 item-3 conditional curation
  // applies.
  {
    file: "packages/tooling/test-kit/test-utils/src/SqlTest.ts",
    symbol: "PgliteSqlTestLayerOptions",
    reason:
      "external?/mode?/testcontainers? are genuinely schema-representable, but hooks?: SqlTestHooks<MigrateError, SeedError> is independently unconvertible (see SqlTestHooks above); makePgliteSqlTestLayer/makePgliteIntegrationGate construct this bag with 1-4 of its 4 optional fields across 6+ real call shapes with a genuine `= {}` default — a legitimate options-bag pattern (un-bundling is a pure ergonomic regression for zero schema gain, since hooks' Effect-valued members can't become data regardless of position).",
  },
  {
    file: "packages/tooling/test-kit/test-utils/src/SqlTest.ts",
    symbol: "SqlTestDriver",
    reason:
      "Strategy/driver-port object: makeLayer: (config) => Layer.Layer<Services, SqlTestHarnessError> (Layer isn't data), sqlClient: Context.Key<SqlService, SqlClient.SqlClient> (live service-tag handle), name (the one schema-typed field) — the same 'driver/strategy port' class as GatedLayer/BoxStreamingOperations above (R11-1 service-contract sub-class), but no same-file Context.Service/.ports.ts/capability-registry/tsx-Props signal actually matches its usage, so it does not resolve silent through classifyComposedMembers.",
  },
  {
    file: "packages/foundation/ui-system/form/stories/fields/storyHelpers.tsx",
    symbol: "assertUploadedPreview",
    reason:
      "Param bundles a live DOM node handle (canvasElement: HTMLElement) with two plain strings; HTMLElement is not schema-representable, independent of the SFV4-fn-schema .tsx exemption gap since a DOM handle can never be serializable (SFV4-fn-schema kind — this entry requires the fn-schema loop's permanent-exclusion check added alongside R17).",
  },
  // R15 correction + R18 (ops/reports/SF-2/sf-2-taila.md): R15 point 3's
  // "covers 5" alias-resolution claim is only 3/5 under the landed detector
  // (Edge/Overrideable x2 fixed in-package instead); LiteralKit and
  // MappedLiteralKit resolve through the one-hop alias helper to text that
  // does not match SCHEMA_INFRASTRUCTURE_EXTENDS_PATTERN and carry
  // substantive custom helper members, so they need curation, not pattern
  // matching. R18 also curates 3 fresh unconvertible reproductions from the
  // same lane.
  {
    file: "packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts",
    symbol: "LiteralKit",
    reason:
      "Schema-toolkit self-definition (R6-1 category): extends LiteralKitBase<L, M>, which one-hop-resolves to `S.Literals<L> & {...}` text that does not match SCHEMA_INFRASTRUCTURE_EXTENDS_PATTERN, plus 8 substantive own/inherited helper members (Options/is/Enum/pickOptions/omitOptions/$match/thunk/toTaggedUnion) beyond meta-only plumbing — a genuinely custom toolkit type, not a pure alias.",
  },
  {
    file: "packages/foundation/modeling/schema/src/MappedLiteralKit/MappedLiteralKit.schema.ts",
    symbol: "MappedLiteralKit",
    reason:
      "Same shape of finding as LiteralKit: extends MappedLiteralKitBase<M> (ForwardDirectionalKit<M> & {From, To, Pairs}, itself resolving through DirectionalKit<...>, not a schema-infra base), plus its own annotate(...)/Rebuild: MappedLiteralKit<M> members — genuinely custom mapped-literal toolkit type.",
  },
  {
    file: "packages/foundation/modeling/utils/src/Event.ts",
    symbol: "makeEventSchema",
    reason:
      "Generic factory parameterized over the abstract fields dictionary itself (TFields extends S.Struct.Fields, not a single field's schema value) — constructing an S.Class internally fails TS2509 \"Missing Self generic\"; third independent reproduction of the same TS limitation already ratified for TSConfig.ts's makeTypeStruct/makeEncodedStruct/strict above (R15 addendum).",
  },
  {
    file: "packages/foundation/modeling/utils/src/DrainableWorker.ts",
    symbol: "DrainableWorker",
    reason:
      'drain: Effect.Effect<void> and enqueue: (item: A) => Effect.Effect<void> are computation-valued, not decodable data; independently, an S.Class-backed instance over the class\'s own type parameter fails TS2562 "Base class expressions cannot reference class type parameters".',
  },
  {
    file: "packages/foundation/modeling/md/src/Md.render.ts",
    symbol: "PureRenderAdapter",
    reason:
      "Deliberate plugin-extension contract (documented: 'Future PDF and DOCX adapters can use this shape'); a descriptor/behavior split (the ExportedTool pattern) breaks 5+ flat-literal call sites (MarkdownAdapter/HtmlFragmentAdapter/PlainTextAdapter/renderEffectWith/renderWith) plus its own dtslint fixture asserting the exact flat shape — same deferral class as GraphOperation/OperationDefinition above.",
  },
  {
    file: "packages/foundation/modeling/md/src/Md.render.ts",
    symbol: "EffectRenderAdapter",
    reason:
      "Same descriptor/behavior-split attempt and same immediate TS2741 failure (renderEffectWith's adapter param); same verdict as PureRenderAdapter.",
  },
  {
    file: "packages/foundation/modeling/identity/src/Id.ts",
    symbol: "IdentityComposer",
    reason:
      "Callable template-tag call signature ((strings: TemplateStringsArray, ...) => IdentityString<...>) whose runtime value (createComposer) is a function with properties; an S.Class instance is a plain non-callable object, so no Effect Schema combinator can produce a callable-function-shaped decoded value — reproduced via tsgo (TS2740, missing annote/annoteHttp/annoteKey/annoteSchema and 6 more).",
  },
] as const;

const isPermanentlyExcludedSchemaFirstEntry = (file: string, symbol: string): boolean =>
  A.some(PERMANENT_SCHEMA_FIRST_EXCLUSIONS, (exclusion) => exclusion.file === file && exclusion.symbol === symbol);

// R6-1/R6-2/R15/R17-1: classification for an exported GENERIC interface.
// Schema-infra escape hatches and all-function-member generics still
// silent-skip first; anything else now composes its own members and runs
// through the SAME member-safety signal set (service-contract shapes,
// curated runtime-handle members, .tsx render-boundary names) that
// non-generic interfaces already get via classifyComposedMembers, instead of
// an unconditional tracked exception — generics previously never reached
// member composition at all (ops/reports/SF-2/sf-2-tailb.md; R17, LOCKED).
const classifyGenericInterface = (
  node: import("ts-morph").InterfaceDeclaration,
  sourceFile: import("ts-morph").SourceFile,
  filePath: string,
  extendsClauses: ReadonlyArray<import("ts-morph").ExpressionWithTypeArguments>
): SchemaFirstMemberClassification => {
  // R6-1: schema-infrastructure generic (extends declareConstructor/
  // decodeTo/Bottom/Codec/Union/VariantSchema.Field|Overridable AND
  // declares Rebuild: this OR has an empty/meta-only own body — R15's
  // isEmptyOrMetaOnlyOwnBody carve-out now reaches the generic branch too
  // (previously non-generic-extends-only; ops/reports/SF-1/sf-1-schema.md
  // gap #2).
  if (
    extendsSchemaInfrastructureBase(extendsClauses) &&
    (hasRebuildThisMember(node.getMembers()) || isEmptyOrMetaOnlyOwnBody(node.getMembers()))
  ) {
    return silentClassification;
  }
  // R6-2: all-function-member generic (no data fields).
  if (isSilentMemberShape(node.getMembers())) {
    return silentClassification;
  }
  // R17-1: same silent/candidate treatment a non-generic interface with this
  // exact composed member set would get — no bespoke generic-only exception.
  return classifyComposedMembers(sourceFile, filePath, node.getName(), node.getMembers());
};

// R7/R13: classification for an exported non-generic interface that has at
// least one extends clause — resolves the extends targets, then either
// silently skips or composes own+inherited members for member-safety
// classification.
const classifyExtendsInterface = (
  node: import("ts-morph").InterfaceDeclaration,
  sourceFile: import("ts-morph").SourceFile,
  filePath: string,
  extendsClauses: ReadonlyArray<import("ts-morph").ExpressionWithTypeArguments>
): SchemaFirstMemberClassification => {
  // R7: resolve extends targets before classifying.
  if (allExtendsClausesResolveExternal(extendsClauses)) {
    return silentClassification;
  }
  if (extendsSchemaInfrastructureBase(extendsClauses) && isEmptyOrMetaOnlyOwnBody(node.getMembers())) {
    // R13 (driver-verified against DateTimeInsert, Model.datetime.ts:133):
    // schema-meta "named generic instantiation" idiom (e.g. `DateTimeInsert
    // extends VariantSchema.Field<{...}> {}`) with an empty (or
    // meta-only) own body exists solely for the schema-authoring
    // type/value dual-binding — silent, not a tracked exception. An
    // extends of the same base WITH an added data member still falls
    // through to member-safety composition below.
    return silentClassification;
  }
  if (hasOwnCallSignatureMember(node.getMembers())) {
    return silentClassification;
  }
  return classifyComposedMembers(
    sourceFile,
    filePath,
    node.getName(),
    composeOwnAndLocalExtendsMembers(node, extendsClauses)
  );
};

/**
 * Input for {@link detectInterfaceReason}: the exported interface
 * declaration under inspection plus its owning source file context.
 *
 * @category models
 * @since 0.0.0
 */
type DetectInterfaceReasonInput = {
  readonly node: import("ts-morph").InterfaceDeclaration;
  readonly sourceFile: import("ts-morph").SourceFile;
  readonly filePath: string;
};

/**
 * Classify an exported interface declaration for the schema-first inventory:
 * silently skipped (schema-infrastructure generics, all-function-member
 * shapes, curated runtime-handle shapes, service-contract/port shapes,
 * external-extends shapes), a live candidate, or a tracked exception.
 *
 * @param input - `node` (exported `InterfaceDeclaration` candidate), `sourceFile` (its owning source file, for same-file service-contract signal resolution), and `filePath` (repo-relative posix path).
 * @returns The resolved silent/candidate/exception classification.
 * @example
 * ```ts
 * import { detectInterfaceReason } from "@beep/repo-cli/commands/Lint"
 * import { Project } from "ts-morph"
 *
 * const project = new Project({ useInMemoryFileSystem: true })
 * const sourceFile = project.createSourceFile(
 *   "fixture.ts",
 *   "export interface Logger { readonly log: (message: string) => void }"
 * )
 * const [declaration] = sourceFile.getInterfaces()
 * const classification = detectInterfaceReason({ node: declaration, sourceFile, filePath: "fixture.ts" })
 *
 * // All-function-member interfaces are silently skipped (R6-2/R11-2): a
 * // pure behavior record has no schema-able data field.
 * console.log(classification)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const detectInterfaceReason = (input: DetectInterfaceReasonInput): SchemaFirstMemberClassification => {
  const { node, sourceFile, filePath } = input;
  if (isPermanentlyExcludedSchemaFirstEntry(filePath, node.getName())) {
    return silentClassification;
  }
  const extendsClauses = node.getExtends();

  if (node.getTypeParameters().length > 0) {
    return classifyGenericInterface(node, sourceFile, filePath, extendsClauses);
  }

  if (!A.isReadonlyArrayEmpty(extendsClauses)) {
    return classifyExtendsInterface(node, sourceFile, filePath, extendsClauses);
  }

  return classifyComposedMembers(sourceFile, filePath, node.getName(), node.getMembers());
};

// R14: a generic type alias whose type node is an `S.Schema.Type<...>`
// TypeReference is schema-DERIVED (the TypedText pattern,
// ops/reports/SF-1/sf-1-graphnode.md) — its shape comes from a same-file
// schema factory's `.Type`, so flagging it as undecoded pure data is a
// category error. Textual/structural check only (does not verify the
// referenced factory's own body).
const isSchemaDerivedGenericAliasTypeNode = (typeNode: Node | undefined): boolean =>
  typeNode !== undefined &&
  Node.isTypeReference(typeNode) &&
  /\b(?:S|Schema)\.Schema\.Type\b/.test(typeNode.getTypeName().getText());

/**
 * Input for {@link detectTypeAliasReason}: the exported type-alias
 * declaration under inspection plus its owning source file context.
 *
 * @category models
 * @since 0.0.0
 */
type DetectTypeAliasReasonInput = {
  readonly node: import("ts-morph").TypeAliasDeclaration;
  readonly sourceFile: import("ts-morph").SourceFile;
  readonly filePath: string;
};

/**
 * Classify an exported type-alias-of-a-type-literal declaration for the
 * schema-first inventory using the same silent/candidate/exception
 * classification as {@link detectInterfaceReason}.
 *
 * @param input - `node` (exported `TypeAliasDeclaration` candidate), `sourceFile` (its owning source file, for same-file service-contract signal resolution), and `filePath` (repo-relative posix path).
 * @returns The resolved silent/candidate/exception classification.
 * @example
 * ```ts
 * import { detectTypeAliasReason } from "@beep/repo-cli/commands/Lint"
 * import { Project } from "ts-morph"
 *
 * const project = new Project({ useInMemoryFileSystem: true })
 * const sourceFile = project.createSourceFile(
 *   "fixture.ts",
 *   "export type PointLike = { readonly x: number; readonly y: number }"
 * )
 * const [declaration] = sourceFile.getTypeAliases()
 * const classification = detectTypeAliasReason({ node: declaration, sourceFile, filePath: "fixture.ts" })
 *
 * // A pure-data type alias with no protecting silent-skip signal is a live
 * // candidate that should be modeled as an annotated schema.
 * console.log(classification)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const detectTypeAliasReason = (input: DetectTypeAliasReasonInput): SchemaFirstMemberClassification => {
  const { node, sourceFile, filePath } = input;
  if (isPermanentlyExcludedSchemaFirstEntry(filePath, node.getName())) {
    return silentClassification;
  }
  const typeNode = node.getTypeNode();

  if (node.getTypeParameters().length > 0) {
    if (isSchemaDerivedGenericAliasTypeNode(typeNode)) {
      return silentClassification;
    }
    const isSchemaInfrastructureAliasBase =
      typeNode !== undefined && SCHEMA_INFRASTRUCTURE_EXTENDS_PATTERN.test(typeNode.getText());
    const members = Node.isTypeLiteral(typeNode) ? typeNode.getMembers() : A.empty<TypeElementTypes>();
    if (isSchemaInfrastructureAliasBase && hasRebuildThisMember(members)) {
      return silentClassification;
    }
    if (isSilentMemberShape(members)) {
      return silentClassification;
    }
    return exceptionClassification(GENERIC_TYPE_ALIAS_EXCEPTION_REASON);
  }

  if (typeNode === undefined || typeNode.getKind() !== SyntaxKind.TypeLiteral) {
    return exceptionClassification("Non-literal type alias is out of scope for automatic schema-first enforcement.");
  }

  const members = Node.isTypeLiteral(typeNode) ? typeNode.getMembers() : A.empty<TypeElementTypes>();
  return classifyComposedMembers(sourceFile, filePath, node.getName(), members);
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
 * Shared repo-relative file path and resolved owning package passed to the
 * schema-first AST detectors below. `filePath`/`owner` are loop-scoped
 * closures bound once per source file inside `scanSchemaFirstInventory`'s
 * scan loop, so every real call site is always data-first; the type exists
 * so the trailing pair collapses into one strict object-like parameter.
 *
 * @category models
 * @since 0.0.0
 */
type SchemaFirstDetectorLocation = {
  readonly file: string;
  readonly owner: string;
};

/**
 * Detect an exported function or arrow function whose parameter or return
 * contract is an inline object type literal rather than a schema, within a
 * schema-modeled file. Generic declarations are conservatively skipped.
 *
 * @param node - Exported `FunctionDeclaration` or `ArrowFunction` candidate.
 * @param location - `file` (repo-relative posix path) and `owner` (resolved owning package) for the finding.
 * @returns `O.some` with the advisory entry when an inline object contract is found, `O.none` otherwise.
 * @example
 * ```ts
 * import { fnSchemaEntryFromFunctionLike } from "@beep/repo-cli/commands/Lint"
 * console.log(fnSchemaEntryFromFunctionLike)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const fnSchemaEntryFromFunctionLike: {
  (location: SchemaFirstDetectorLocation): (node: FunctionLikeDeclarationNode) => O.Option<SchemaFirstInventoryEntry>;
  (node: FunctionLikeDeclarationNode, location: SchemaFirstDetectorLocation): O.Option<SchemaFirstInventoryEntry>;
} = dual(
  2,
  (
    node: FunctionLikeDeclarationNode,
    { file, owner }: SchemaFirstDetectorLocation
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
  }
);

/**
 * Detect an exported function or arrow function whose explicit return type
 * annotation includes `null` or `undefined` rather than an `O.Option`,
 * `Result`, `Effect`, or `Exit` return. Only explicit annotations are
 * inspected; inferred returns are out of scope. Generic declarations and
 * `.tsx` react boundary files are conservatively skipped by callers.
 *
 * @param node - Exported `FunctionDeclaration` or `ArrowFunction` candidate.
 * @param location - `file` (repo-relative posix path) and `owner` (resolved owning package) for the finding.
 * @returns `O.some` with the advisory entry when a null/undefined return annotation is found, `O.none` otherwise.
 * @example
 * ```ts
 * import { nullReturnEntryFromFunctionLike } from "@beep/repo-cli/commands/Lint"
 * console.log(nullReturnEntryFromFunctionLike)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const nullReturnEntryFromFunctionLike: {
  (location: SchemaFirstDetectorLocation): (node: FunctionLikeDeclarationNode) => O.Option<SchemaFirstInventoryEntry>;
  (node: FunctionLikeDeclarationNode, location: SchemaFirstDetectorLocation): O.Option<SchemaFirstInventoryEntry>;
} = dual(
  2,
  (
    node: FunctionLikeDeclarationNode,
    { file, owner }: SchemaFirstDetectorLocation
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
  }
);

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
 * @param location - `file` (repo-relative posix path) and `owner` (resolved owning package) for the finding.
 * @returns `O.some` with the advisory entry when a function-local normalization call is found, `O.none` otherwise.
 * @example
 * ```ts
 * import { normalizationEntryFromCallExpression } from "@beep/repo-cli/commands/Lint"
 * console.log(normalizationEntryFromCallExpression)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const normalizationEntryFromCallExpression: {
  (
    location: SchemaFirstDetectorLocation
  ): (callExpression: import("ts-morph").CallExpression) => O.Option<SchemaFirstInventoryEntry>;
  (
    callExpression: import("ts-morph").CallExpression,
    location: SchemaFirstDetectorLocation
  ): O.Option<SchemaFirstInventoryEntry>;
} = dual(
  2,
  (
    callExpression: import("ts-morph").CallExpression,
    { file, owner }: SchemaFirstDetectorLocation
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
  }
);

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
 * @param location - `file` (repo-relative posix path) and `owner` (resolved owning package) for the finding.
 * @returns `O.some` with the advisory entry when an inline Option-struct literal is spread through `getSomes`, `O.none` otherwise.
 * @example
 * ```ts
 * import { getsomesStructEntryFromCallExpression } from "@beep/repo-cli/commands/Lint"
 * console.log(getsomesStructEntryFromCallExpression)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const getsomesStructEntryFromCallExpression: {
  (
    location: SchemaFirstDetectorLocation
  ): (callExpression: import("ts-morph").CallExpression) => O.Option<SchemaFirstInventoryEntry>;
  (
    callExpression: import("ts-morph").CallExpression,
    location: SchemaFirstDetectorLocation
  ): O.Option<SchemaFirstInventoryEntry>;
} = dual(
  2,
  (
    callExpression: import("ts-morph").CallExpression,
    { file, owner }: SchemaFirstDetectorLocation
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
  }
);

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

/**
 * True when the candidate equals one of the literal member names.
 *
 * @example
 * ```ts
 * import { literalMemberEquals } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(literalMemberEquals(["is", "make"], "is")) // true
 * console.log(literalMemberEquals("is")(["is", "make"])) // true
 * ```
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
  return (
    Node.isPropertyAccessExpression(expression) &&
    Node.isIdentifier(expression.getExpression()) &&
    literalMemberEquals(SCHEMA_ARBITRARY_NAMESPACE_NAMES, expression.getExpression().getText()) &&
    literalMemberEquals(SCHEMA_ARBITRARY_HELPERS, expression.getName())
  );
};

const isSchemaArbitraryExpression = (
  expression: import("ts-morph").Expression,
  schemaArbitraryIdentifiers: MutableHashSet.MutableHashSet<string>
): boolean => {
  if (Node.isIdentifier(expression)) {
    return MutableHashSet.has(schemaArbitraryIdentifiers, expression.getText());
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
  schemaArbitraryIdentifiers: MutableHashSet.MutableHashSet<string>
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
  schemaArbitraryIdentifiers: MutableHashSet.MutableHashSet<string>
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

const sourceSchemaArbitraryIdentifiers = (
  sourceFile: import("ts-morph").SourceFile
): MutableHashSet.MutableHashSet<string> => {
  const identifiers = MutableHashSet.empty<string>();
  for (const variableDeclaration of sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
    const nameNode = variableDeclaration.getNameNode();
    const initializer = variableDeclaration.getInitializer();
    if (
      Node.isIdentifier(nameNode) &&
      initializer !== undefined &&
      isSchemaArbitraryExpression(initializer, identifiers)
    ) {
      MutableHashSet.add(identifiers, nameNode.getText());
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
  if (
    !isSchemaFirstTestFile(file) ||
    sourceHasSchemaArbitraryPropertyCoverage(sourceFile) ||
    isPermanentlyExcludedSchemaFirstEntry(file, "schema-codec-tests")
  ) {
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
  const project = yield* makeSchemaFirstProject();

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
  const ownerResolver = yield* makeSchemaFirstOwnerResolver();
  const project = yield* makeSchemaFirstProject();
  const thunkCandidate = () => "candidate" as const;
  const thunkException = () => "exception" as const;

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
      const classification = detectInterfaceReason({ node: declaration, sourceFile, filePath });
      if (classification._tag === "silent") {
        continue;
      }
      pushEntry(
        filePath,
        declaration.getName(),
        "exported-interface",
        classification._tag === "candidate" ? "candidate" : "exception",
        classification._tag === "exception"
          ? classification.reason
          : "Exported pure-data interface should be modeled as an annotated schema.",
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
      const classification = detectTypeAliasReason({ node: declaration, sourceFile, filePath });
      if (classification._tag === "silent") {
        continue;
      }
      pushEntry(
        filePath,
        declaration.getName(),
        "exported-type-literal",
        classification._tag === "candidate" ? "candidate" : "exception",
        classification._tag === "exception"
          ? classification.reason
          : "Exported pure-data type alias should be modeled as an annotated schema.",
        owner
      );
    }

    const hasNormalizationSignal = sourceHasNormalizationSignal(sourceFile);
    const hasGetSomesSignal = sourceHasGetSomesSignal(sourceFile);

    for (const callExpression of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      if (hasNormalizationSignal) {
        const normalizationEntry = normalizationEntryFromCallExpression(callExpression, { file: filePath, owner });
        if (O.isSome(normalizationEntry)) {
          A.appendInPlace(entries, normalizationEntry.value);
        }
      }
      if (hasGetSomesSignal) {
        const getsomesEntry = getsomesStructEntryFromCallExpression(callExpression, { file: filePath, owner });
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
      const structSymbol = inferStructSymbol(callExpression);
      // R15: driver-verified permanent exclusions (e.g. LiteralKit.schema.ts
      // `union`, VariantSchema.core.ts `extract`) skip entirely rather than
      // stay a tracked exception — ops/reports/SF-1/sf-1-schema.md.
      if (isPermanentlyExcludedSchemaFirstEntry(filePath, structSymbol)) {
        continue;
      }
      const reasonOption = detectStructReason(callExpression);
      pushEntry(
        filePath,
        structSymbol,
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
    // R17-2: SFV4-fn-schema mirrors its null-return sibling's .tsx exemption
    // (isNullReturnEligibleFilePath) — a React component's inline prop/return
    // object is a render contract, not a schema contract; converting it to
    // Fn(...)/S.Class is a category error (ops/reports/SF-2/sf-2-tailb.md;
    // R17, LOCKED).
    const isFnSchemaEligible = isNullReturnEligibleFilePath(filePath);
    const isNullReturnEligible = isNullReturnEligibleFilePath(filePath);

    for (const functionLike of functionLikeCandidates) {
      if (hasFnSchemaSignal && isFnSchemaEligible) {
        const fnSchemaEntry = fnSchemaEntryFromFunctionLike(functionLike, { file: filePath, owner });
        // R17 item 3: extend the same curated-exclusion mechanism the
        // object-struct-schema scan and detectInterfaceReason/
        // detectTypeAliasReason already have to the fn-schema loop, so a
        // driver-owned PERMANENT_SCHEMA_FIRST_EXCLUSIONS entry can cover a
        // function-symbol finding too (e.g. assertUploadedPreview).
        if (O.isSome(fnSchemaEntry) && !isPermanentlyExcludedSchemaFirstEntry(filePath, fnSchemaEntry.value.symbol)) {
          A.appendInPlace(entries, fnSchemaEntry.value);
        }
      }
      if (isNullReturnEligible) {
        const nullReturnEntry = nullReturnEntryFromFunctionLike(functionLike, { file: filePath, owner });
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
