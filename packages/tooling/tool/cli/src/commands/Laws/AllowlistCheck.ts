/**
 * Effect laws allowlist integrity checks.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { isNoNativeRuntimeExtraCheckHotspot } from "@beep/repo-configs/eslint/NoNativeRuntimeHotspots";
import { buildAllowlistSnapshotModuleFromJsoncText } from "@beep/repo-configs/internal/eslint/EffectLawsAllowlistSnapshotCodegen";
import { findRepoRoot } from "@beep/repo-utils";
import { LiteralKit } from "@beep/schema";
import { A } from "@beep/utils";
import { Console, Effect, FileSystem, HashSet, Path, pipe, Result } from "effect";
import * as Eq from "effect/Equal";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { parse } from "jsonc-parser";
import { Project } from "ts-morph";
import { collectNativeRuntimeViolationKeys, NativeRuntimeViolationKeyOptions } from "./NoNativeRuntime.js";
import { formatSchemaDiagnostics } from "./SchemaDiagnostics.js";
import type { ParseError } from "jsonc-parser";

const $I = $RepoCliId.create("commands/Laws/AllowlistCheck");

/**
 * Relative path to the effect laws allowlist.
 *
 * @example
 * ```ts
 * console.log("ALLOWLIST_PATH")
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const ALLOWLIST_PATH = "standards/effect-laws.allowlist.jsonc";
const ALLOWLIST_SNAPSHOT_PATH =
  "packages/tooling/policy-pack/repo-configs/src/internal/eslint/generated/EffectLawsAllowlistSnapshot.ts";
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

class EffectLawsAllowlistEntry extends S.Class<EffectLawsAllowlistEntry>($I`EffectLawsAllowlistEntry`)(
  {
    rule: EffectLawsAllowlistRuleId,
    file: NonEmptyString,
    kind: NativeRuntimeAllowlistKind,
    reason: NonEmptyString,
    owner: NonEmptyString,
    issue: NonEmptyString,
    expiresOn: DateYmdString.pipe(S.UndefinedOr, S.optionalKey),
  },
  $I.annote("EffectLawsAllowlistEntry", {
    description: "Single allowlist entry describing a temporary exception for an Effect law.",
  })
) {}

// fallow-ignore-next-line code-duplication -- CLI allowlist checks intentionally keep a command-local schema boundary.
class EffectLawsAllowlistDocument extends S.Class<EffectLawsAllowlistDocument>($I`EffectLawsAllowlistDocument`)(
  {
    version: S.Literal(1),
    entries: S.Array(EffectLawsAllowlistEntry).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<EffectLawsAllowlistEntry>())),
      S.withDecodingDefault(Effect.succeed(A.empty<EffectLawsAllowlistEntry>()))
    ),
  },
  $I.annote("EffectLawsAllowlistDocument", {
    description: "Schema-backed allowlist document for custom Effect law exceptions.",
  })
) {}

const decodeEffectLawsAllowlist = S.decodeUnknownEffect(EffectLawsAllowlistDocument);

/**
 * Runtime options for allowlist integrity checks.
 *
 * @example
 * ```ts
 * console.log("AllowlistCheckOptions")
 * ```
 * @category models
 * @since 0.0.0
 */
export class AllowlistCheckOptions extends S.Class<AllowlistCheckOptions>($I`AllowlistCheckOptions`)(
  {
    cwd: NonEmptyString,
  },
  $I.annote("AllowlistCheckOptions", {
    description: "Runtime options for effect laws allowlist integrity checks starting from a workspace directory.",
  })
) {}

/**
 * Result of an allowlist integrity check.
 *
 * @example
 * ```ts
 * console.log("AllowlistCheckSummary")
 * ```
 * @category models
 * @since 0.0.0
 */
export class AllowlistCheckSummary extends S.Class<AllowlistCheckSummary>($I`AllowlistCheckSummary`)(
  {
    ok: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false)), S.withDecodingDefault(Effect.succeed(false))),
    diagnostics: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<string>())),
      S.withDecodingDefault(Effect.succeed(A.empty<string>()))
    ),
  },
  $I.annote("AllowlistCheckSummary", {
    description: "Summary of effect laws allowlist integrity diagnostics.",
  })
) {}

const parseAllowlistText = (text: string): Result.Result<unknown, ReadonlyArray<string>> => {
  const parseErrors = A.empty<ParseError>();
  const parsed = parse(text, parseErrors, {
    allowTrailingComma: true,
    disallowComments: false,
  });

  return Eq.equals(0, A.length(parseErrors))
    ? Result.succeed(parsed)
    : Result.fail(
        pipe(
          parseErrors,
          A.map((parseError) => `parse error at offset ${parseError.offset}`)
        )
      );
};

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
  const path = yield* Path.Path;
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  let index = 0;
  let diagnostics = A.empty<string>();

  for (const entry of entries) {
    if (entry.rule !== NO_NATIVE_RUNTIME_RULE_ID) {
      index += 1;
      continue;
    }

    const sourceFile = project.addSourceFileAtPathIfExists(path.resolve(cwd, entry.file));
    if (P.isUndefined(sourceFile)) {
      index += 1;
      continue;
    }

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
 * @example
 * ```ts
 * console.log("runAllowlistCheck")
 * ```
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
 * @example
 * ```ts
 * console.log("reportAllowlistCheckSummary")
 * ```
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
