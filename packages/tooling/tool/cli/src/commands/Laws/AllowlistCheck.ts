/**
 * Effect laws allowlist integrity checks.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Jsonc } from "@beep/jsonc/Jsonc";
import { buildAllowlistSnapshotModuleFromJsoncText } from "@beep/repo-configs/internal/laws/EffectLawsAllowlistSnapshotCodegen";
import { isNoNativeRuntimeExtraCheckHotspot } from "@beep/repo-configs/laws/NoNativeRuntimeHotspots";
import { findRepoRoot } from "@beep/repo-utils";
import { LiteralKit } from "@beep/schema";
import { ArrayKeyDefaultEmpty } from "@beep/schema/SchemaUtils/withKeyDefaults";
import { A } from "@beep/utils";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Eq from "effect/Equal";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { Project } from "ts-morph";
import { collectNativeRuntimeViolationKeys, NativeRuntimeViolationKeyOptions } from "./NoNativeRuntime.ts";
import { formatSchemaDiagnostics } from "./SchemaDiagnostics.ts";

const $I = $RepoCliId.create("commands/Laws/AllowlistCheck");

/**
 * Relative path to the effect laws allowlist.
 *
 * **Example** (Log allowlist path label)
 *
 * ```ts
 * console.log("ALLOWLIST_PATH")
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const ALLOWLIST_PATH = "standards/effect-laws.allowlist.jsonc";
const ALLOWLIST_SNAPSHOT_PATH =
  "packages/tooling/policy-pack/repo-configs/src/internal/laws/generated/EffectLawsAllowlistSnapshot.ts";
const NO_NATIVE_RUNTIME_RULE_ID = "beep-laws/no-native-runtime";

const EffectLawsAllowlistRuleId = LiteralKit([NO_NATIVE_RUNTIME_RULE_ID]).pipe(
  $I.annoteSchema("EffectLawsAllowlistRuleId", {
    description: "Effect law rule identifiers currently supported by the allowlist checker.",
  })
);

const NativeRuntimeAllowlistKind = LiteralKit([
  "array-static",
  "date-static",
  "native-error",
  "native-fetch",
  "native-sort",
  "native-switch",
  "new-date",
  "new-map-set",
  "node-runtime-import",
  "object-method",
  "string-method",
  "typeof-runtime",
  "weak-collection",
]).pipe(
  $I.annoteSchema("NativeRuntimeAllowlistKind", {
    description: "Native runtime violation kinds currently supported by the allowlist checker.",
  })
);

const NonEmptyString = S.String.check(S.makeFilter((value) => value.length > 0 || "Expected non-empty string.")).pipe(
  $I.annoteSchema("NonEmptyString", {
    description: "Non-empty string value used for effect-laws allowlist fields.",
  })
);

const DateYmdString = S.String.check(
  S.makeFilter(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test || "Expected YYYY-MM-DD date string format.")
).pipe(
  $I.annoteSchema("DateYmdString", {
    description: "Calendar date string in YYYY-MM-DD format for allowlist expiration.",
  })
);

class EffectLawsAllowlistEntry extends S.Opaque<EffectLawsAllowlistEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    rule: EffectLawsAllowlistRuleId,
    file: NonEmptyString,
    kind: NativeRuntimeAllowlistKind,
    reason: NonEmptyString,
    owner: NonEmptyString,
    issue: NonEmptyString,
    expiresOn: DateYmdString.pipe(S.UndefinedOr, S.optionalKey),
  }).pipe(
    $I.annoteSchema("EffectLawsAllowlistEntry", {
      description: "Single allowlist entry describing a temporary exception for an Effect law.",
    })
  )
) {}

// fallow-ignore-next-line code-duplication -- each laws allowlist check keeps a command-local document schema. Owner: @beep/repo-cli. Exit: share one allowlist document schema when the allowlist formats converge.
class EffectLawsAllowlistDocument extends S.Opaque<EffectLawsAllowlistDocument, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag(1),
    entries: ArrayKeyDefaultEmpty(EffectLawsAllowlistEntry),
  }).pipe(
    $I.annoteSchema("EffectLawsAllowlistDocument", {
      description: "Schema-backed allowlist document for custom Effect law exceptions.",
    })
  )
) {}

const decodeEffectLawsAllowlist = S.decodeUnknownEffect(EffectLawsAllowlistDocument);

/**
 * Runtime options for allowlist integrity checks.
 *
 * **Example** (Log options type label)
 *
 * ```ts
 * console.log("AllowlistCheckOptions")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AllowlistCheckOptions extends S.Opaque<AllowlistCheckOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    cwd: NonEmptyString,
  }).pipe(
    $I.annoteSchema("AllowlistCheckOptions", {
      description: "Runtime options for effect laws allowlist integrity checks starting from a workspace directory.",
    })
  )
) {}

/**
 * Result of an allowlist integrity check.
 *
 * **Example** (Log summary type label)
 *
 * ```ts
 * console.log("AllowlistCheckSummary")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AllowlistCheckSummary extends S.Opaque<AllowlistCheckSummary, { readonly brand: unique symbol }>()(
  S.Struct({
    ok: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultKey(Effect.succeed(false))
    ),
    diagnostics: ArrayKeyDefaultEmpty(S.String),
  }).pipe(
    $I.annoteSchema("AllowlistCheckSummary", {
      description: "Summary of effect laws allowlist integrity diagnostics.",
    })
  )
) {}

const parseAllowlistText = (text: string): Result.Result<unknown, ReadonlyArray<string>> =>
  Jsonc.parseResult(text).pipe(
    Result.mapError((error) => A.map(error.errors, (detail) => `parse error at offset ${detail.offset}`))
  );

const validateEntryFiles = Effect.fn(function* (cwd: string, entries: ReadonlyArray<EffectLawsAllowlistEntry>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  let index = 0;
  let diagnostics = A.empty<string>();

  for (const entry of entries) {
    const absoluteEntryPath = path.resolve(cwd, entry.file);
    const exists = yield* fs.exists(absoluteEntryPath);

    if (!exists) {
      diagnostics = A.append(diagnostics, `entries.${index}.file: Referenced file does not exist: ${entry.file}`);
    }

    index += 1;
  }

  return diagnostics;
});

const makeAllowlistKey = (entry: EffectLawsAllowlistEntry): string => `${entry.rule}::${entry.file}::${entry.kind}`;

const validateUniqueAllowlistKeys = (entries: ReadonlyArray<EffectLawsAllowlistEntry>): ReadonlyArray<string> => {
  let index = 0;
  let seenKeys = HashSet.empty<string>();
  let diagnostics = A.empty<string>();

  for (const entry of entries) {
    const key = makeAllowlistKey(entry);

    if (HashSet.has(seenKeys, key)) {
      diagnostics = A.append(diagnostics, `entries.${index}: Duplicate allowlist key ${key}`);
    } else {
      seenKeys = HashSet.add(seenKeys, key);
    }

    index += 1;
  }

  return diagnostics;
};

const validateEntriesStillMatchViolations = Effect.fn(function* (
  cwd: string,
  entries: ReadonlyArray<EffectLawsAllowlistEntry>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const project = new Project({ skipAddingFilesFromTsConfig: true, useInMemoryFileSystem: true });
  let index = 0;
  let diagnostics = A.empty<string>();

  for (const entry of entries) {
    const absoluteEntryPath = path.resolve(cwd, entry.file);
    if (entry.rule !== NO_NATIVE_RUNTIME_RULE_ID || !(yield* fs.exists(absoluteEntryPath))) {
      index += 1;
      continue;
    }

    // Read through the FileSystem service so the check honours the provided platform layer.
    const sourceText = yield* fs.readFileString(absoluteEntryPath);
    const sourceFile = project.createSourceFile(absoluteEntryPath, sourceText, { overwrite: true });

    const violationKeys = collectNativeRuntimeViolationKeys(
      sourceFile,
      NativeRuntimeViolationKeyOptions.make({
        inHotspotScope: isNoNativeRuntimeExtraCheckHotspot(entry.file),
        relativeFilePath: entry.file,
      })
    );
    if (!A.contains(makeAllowlistKey(entry))(violationKeys)) {
      diagnostics = A.append(
        diagnostics,
        `entries.${index}: No current violation matches allowlist key ${makeAllowlistKey(entry)}`
      );
    }

    index += 1;
  }

  return diagnostics;
});

const validateGeneratedSnapshotSync = Effect.fn(function* (repoRoot: string, allowlistText: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const snapshotPath = path.resolve(repoRoot, ALLOWLIST_SNAPSHOT_PATH);
  const snapshotDirectory = path.dirname(snapshotPath);

  if (!(yield* fs.exists(snapshotDirectory))) {
    return A.empty<string>();
  }

  const exists = yield* fs.exists(snapshotPath);
  if (!exists) {
    return A.make(`${ALLOWLIST_SNAPSHOT_PATH}: Generated allowlist snapshot is missing.`);
  }

  const expectedSnapshot = yield* buildAllowlistSnapshotModuleFromJsoncText(allowlistText);
  const currentSnapshot = yield* fs.readFileString(snapshotPath);
  return expectedSnapshot === currentSnapshot
    ? A.empty<string>()
    : A.make(`${ALLOWLIST_SNAPSHOT_PATH}: Generated allowlist snapshot is stale; run package codegen.`);
});

/**
 * Run the effect laws allowlist integrity check.
 *
 * **Example** (Log check function label)
 *
 * ```ts
 * console.log("runAllowlistCheck")
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const runAllowlistCheck = Effect.fn(function* (options: AllowlistCheckOptions) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot(options.cwd);
  const absolutePath = path.resolve(repoRoot, ALLOWLIST_PATH);

  const exists = yield* fs.exists(absolutePath);
  if (!exists) {
    return AllowlistCheckSummary.make({
      ok: false,
      diagnostics: A.make(`missing file: ${ALLOWLIST_PATH}`),
    });
  }

  const text = yield* fs.readFileString(absolutePath);
  const parsedResult = parseAllowlistText(text);

  if (Result.isFailure(parsedResult)) {
    return AllowlistCheckSummary.make({
      ok: false,
      diagnostics: parsedResult.failure,
    });
  }

  const decodedResult = yield* decodeEffectLawsAllowlist(parsedResult.success).pipe(
    Effect.result,
    Effect.map(
      Result.match({
        onFailure: (error) => Result.fail(formatSchemaDiagnostics(error.issue)),
        onSuccess: Result.succeed,
      })
    )
  );

  if (Result.isFailure(decodedResult)) {
    return AllowlistCheckSummary.make({
      ok: false,
      diagnostics: decodedResult.failure,
    });
  }

  const fileDiagnostics = yield* validateEntryFiles(repoRoot, decodedResult.success.entries);
  const duplicateDiagnostics = validateUniqueAllowlistKeys(decodedResult.success.entries);
  const usageDiagnostics = yield* validateEntriesStillMatchViolations(repoRoot, decodedResult.success.entries);
  const snapshotDiagnostics = yield* validateGeneratedSnapshotSync(repoRoot, text);
  const diagnostics = pipe(
    fileDiagnostics,
    A.appendAll(duplicateDiagnostics),
    A.appendAll(usageDiagnostics),
    A.appendAll(snapshotDiagnostics)
  );

  return AllowlistCheckSummary.make({
    ok: pipe(A.length(diagnostics), Eq.equals(0)),
    diagnostics,
  });
});

/**
 * Print allowlist integrity diagnostics to the console.
 *
 * **Example** (Log report function label)
 *
 * ```ts
 * console.log("reportAllowlistCheckSummary")
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const reportAllowlistCheckSummary = Effect.fn(function* (summary: AllowlistCheckSummary) {
  if (summary.ok) {
    yield* Console.log("[laws-allowlist] OK");
    return;
  }

  yield* Console.error(`[laws-allowlist] found ${A.length(summary.diagnostics)} issue(s):`);

  for (const diagnostic of summary.diagnostics) {
    yield* Console.error(`- ${diagnostic}`);
  }
});
