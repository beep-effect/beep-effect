/**
 * Title pass for the JSDoc legacy-carrier migration via the local model proxy.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { A, O, Str } from "@beep/utils";
import { Console, Effect, MutableHashMap, Order, pipe } from "effect";
import * as S from "effect/Schema";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import { QualityScriptCommandError } from "../Quality.errors.ts";
import {
  defaultJSDocMigrateExtractPath,
  defaultJSDocMigrateTitlesPath,
  JSDocMigrateRemarksRouting,
  JSDocMigrateTitleRecord,
} from "./JSDocMigrate.schemas.ts";
import {
  jsdocMigrateRunContext,
  jsdocMigrateTitleCodec,
  readJSDocMigrateExtractRequired,
  readJSDocMigrateJsonl,
} from "./JSDocMigrateData.ts";
import type { FileSystem, Path } from "effect";
import type { JSDocMigrateExtractRecord } from "./JSDocMigrate.schemas.ts";

const $I = $RepoCliId.create("commands/Quality/internal/JSDocMigrateTitles");

const migrateTitlesError = (message: string): QualityScriptCommandError =>
  QualityScriptCommandError.make({
    message,
    command: "bun run beep quality jsdoc-migrate titles",
    exitCode: 1,
  });

const TitleSuggestion = S.Struct({
  anchor: S.String,
  titles: S.Array(S.String),
  remarks: S.optionalKey(JSDocMigrateRemarksRouting),
  leadEnd: S.optionalKey(S.Int),
  seePurposes: S.Array(S.String).pipe(S.optionalKey),
});

const TitleSuggestionList = S.Array(TitleSuggestion);

const ChatCompletionResponse = S.Struct({
  choices: S.Array(
    S.Struct({
      message: S.Struct({ content: S.String }),
    })
  ),
});

const decodeChatCompletion = S.decodeUnknownEffect(ChatCompletionResponse);
const decodeSuggestionList = S.decodeUnknownEffect(S.fromJsonString(TitleSuggestionList));

/**
 * Default local CLIProxyAPI endpoint used by the title pass.
 *
 * **Example** (Inspect the default proxy URL)
 *
 * ```ts
 * import { defaultJSDocMigrateProxyUrl } from "@beep/repo-cli/test/Quality"
 *
 * console.log(defaultJSDocMigrateProxyUrl) // "http://127.0.0.1:8317"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const defaultJSDocMigrateProxyUrl = "http://127.0.0.1:8317";

/**
 * Default model routed through the local proxy for the title pass.
 *
 * **Example** (Inspect the default model)
 *
 * ```ts
 * import { defaultJSDocMigrateTitlesModel } from "@beep/repo-cli/test/Quality"
 *
 * console.log(defaultJSDocMigrateTitlesModel) // "grok-4.5"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const defaultJSDocMigrateTitlesModel = "grok-4.5";

/**
 * Build the title-pass prompt for one file's pending blocks.
 *
 * **Details**
 *
 * The model returns data only — titles, remarks routing, lead split point,
 * and see purposes — and never writes files. The prompt pins the exact JSON
 * contract and per-block counts so a schema-invalid return is detectable and
 * retryable.
 *
 * **Example** (Render a prompt)
 *
 * ```ts
 * import { JSDocMigrateExtractRecord, jsdocMigrateTitlesPrompt } from "@beep/repo-cli/test/Quality"
 *
 * const record = JSDocMigrateExtractRecord.make({
 *   anchor: "packages/x/src/Y.ts#decode#0",
 *   filePath: "packages/x/src/Y.ts",
 *   symbol: "decode",
 *   ordinal: 0,
 *   kind: "value",
 *   sourceHash: "sha256:0000",
 *   start: 0,
 *   end: 40,
 *   blockText: "/** Doc. *" + "/",
 *   leadParagraphCount: 1,
 *   exampleTagCount: 1,
 *   unfencedExampleCount: 0,
 *   remarksTagCount: 0,
 *   undescribedSeeCount: 0
 * })
 * console.log(jsdocMigrateTitlesPrompt([record]).includes("packages/x/src/Y.ts#decode#0")) // true
 * ```
 *
 * @param records - Pending extract records for one file.
 * @returns Prompt text pinning the JSON response contract.
 * @category use-cases
 * @since 0.0.0
 */
export const jsdocMigrateTitlesPrompt = (records: ReadonlyArray<JSDocMigrateExtractRecord>): string => {
  const blocks = A.map(records, (record) =>
    JSON.stringify({
      anchor: record.anchor,
      symbol: record.symbol,
      kind: record.kind,
      exampleTagCount: record.exampleTagCount,
      remarksTagCount: record.remarksTagCount,
      leadParagraphCount: record.leadParagraphCount,
      undescribedSeeCount: record.undescribedSeeCount,
      blockText: record.blockText,
    })
  );
  return A.join(
    [
      "You are producing routing data for a mechanical JSDoc migration. You never rewrite prose.",
      "For each input block, return one JSON object with these fields:",
      '- "anchor": copied verbatim from the input.',
      '- "titles": exactly exampleTagCount short Example titles (2-6 words, specific to what the example shows, unique within the block). Empty array when exampleTagCount is 0.',
      '- "remarks": "details" or "gotchas" — required when remarksTagCount > 0, omitted otherwise. Choose "gotchas" only when the remarks text warns about surprising or dangerous behavior.',
      '- "leadEnd": optional; when leadParagraphCount > 1, the number of leading paragraphs to keep as the lead (usually 1). Omit when leadParagraphCount is 1.',
      '- "seePurposes": optional; when undescribedSeeCount > 0, exactly that many purpose phrases in source order, each starting with "for" (e.g. "for the underlying decoder."). Omit otherwise.',
      "Respond with ONLY a JSON array of these objects, no prose and no code fences.",
      "Input blocks:",
      ...blocks,
    ],
    "\n"
  );
};

const stripJsonFences = (content: string): string => {
  const trimmed = Str.trim(content);
  const match = /^```(?:json)?\s*\n([\s\S]*?)\n```$/.exec(trimmed);
  return match === null ? trimmed : (match[1] ?? trimmed);
};

type TitleSuggestionShape = typeof TitleSuggestion.Type;

const titleSuggestionProblem = (
  suggestion: TitleSuggestionShape,
  extract: JSDocMigrateExtractRecord
): string | undefined => {
  if (suggestion.titles.length !== extract.exampleTagCount) {
    return `anchor ${suggestion.anchor} returned ${suggestion.titles.length} title(s); expected ${extract.exampleTagCount}`;
  }
  const trimmedTitles = A.map(suggestion.titles, Str.trim);
  if (A.some(trimmedTitles, Str.isEmpty)) {
    return `anchor ${suggestion.anchor} returned an empty title`;
  }
  if (A.dedupe(trimmedTitles).length !== trimmedTitles.length) {
    return `anchor ${suggestion.anchor} returned duplicate titles within the block`;
  }
  if (extract.remarksTagCount > 0 && suggestion.remarks === undefined) {
    return `anchor ${suggestion.anchor} is missing the required remarks routing`;
  }
  if ((suggestion.seePurposes?.length ?? 0) !== extract.undescribedSeeCount) {
    return `anchor ${suggestion.anchor} returned ${suggestion.seePurposes?.length ?? 0} see purpose(s); expected ${extract.undescribedSeeCount}`;
  }
  if (suggestion.leadEnd !== undefined && (suggestion.leadEnd < 1 || suggestion.leadEnd > extract.leadParagraphCount)) {
    return `anchor ${suggestion.anchor} returned leadEnd ${suggestion.leadEnd}; expected 1..${extract.leadParagraphCount}`;
  }
  return undefined;
};

const titleRecordFromSuggestion = (
  suggestion: TitleSuggestionShape,
  extract: JSDocMigrateExtractRecord
): JSDocMigrateTitleRecord =>
  JSDocMigrateTitleRecord.make({
    anchor: suggestion.anchor,
    sourceHash: extract.sourceHash,
    kind: extract.kind,
    titles: suggestion.titles,
    ...O.getSomesStruct({
      remarks: O.fromUndefinedOr(suggestion.remarks),
      leadEnd: O.fromUndefinedOr(suggestion.leadEnd),
      seePurposes: O.fromUndefinedOr(suggestion.seePurposes),
    }),
  });

const collectTitleSuggestions = (
  suggestions: ReadonlyArray<TitleSuggestionShape>,
  pendingByAnchor: MutableHashMap.MutableHashMap<string, JSDocMigrateExtractRecord>
): {
  readonly problems: Array<string>;
  readonly records: Array<JSDocMigrateTitleRecord>;
  readonly seen: MutableHashMap.MutableHashMap<string, boolean>;
} => {
  const problems: Array<string> = [];
  const records: Array<JSDocMigrateTitleRecord> = [];
  const seen = MutableHashMap.empty<string, boolean>();
  for (const suggestion of suggestions) {
    const extract = MutableHashMap.get(pendingByAnchor, suggestion.anchor);
    if (O.isNone(extract)) {
      A.appendInPlace(problems, `unknown anchor ${suggestion.anchor}`);
      continue;
    }
    MutableHashMap.set(seen, suggestion.anchor, true);
    const problem = titleSuggestionProblem(suggestion, extract.value);
    if (problem !== undefined) {
      A.appendInPlace(problems, problem);
      continue;
    }
    A.appendInPlace(records, titleRecordFromSuggestion(suggestion, extract.value));
  }
  return { problems, records, seen };
};

/**
 * Decode and validate one title-pass response against its pending records.
 *
 * **Details**
 *
 * Fails when the response is not the pinned JSON shape, misses a requested
 * anchor, invents an unknown anchor, or returns a title count that
 * disagrees with the block's `exampleTagCount` — the caller retries exactly
 * these failures. Valid suggestions are stamped with the extract record's
 * `sourceHash` and `kind` so the emitted rows verify like any frozen record.
 *
 * **Example** (Validate a well-formed response)
 *
 * ```ts
 * import { JSDocMigrateExtractRecord, jsdocMigrateTitleRecordsFromResponse } from "@beep/repo-cli/test/Quality"
 * import { Effect } from "effect"
 *
 * const record = JSDocMigrateExtractRecord.make({
 *   anchor: "packages/x/src/Y.ts#decode#0",
 *   filePath: "packages/x/src/Y.ts",
 *   symbol: "decode",
 *   ordinal: 0,
 *   kind: "value",
 *   sourceHash: "sha256:0000",
 *   start: 0,
 *   end: 40,
 *   blockText: "/** Doc. *" + "/",
 *   leadParagraphCount: 1,
 *   exampleTagCount: 1,
 *   unfencedExampleCount: 0,
 *   remarksTagCount: 0,
 *   undescribedSeeCount: 0
 * })
 * const content = JSON.stringify([{ anchor: record.anchor, titles: ["Decode a name"] }])
 * const program = jsdocMigrateTitleRecordsFromResponse(content, [record])
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const jsdocMigrateTitleRecordsFromResponse = Effect.fn("JSDocMigrateTitles.recordsFromResponse")(function* (
  content: string,
  pending: ReadonlyArray<JSDocMigrateExtractRecord>
): Effect.fn.Return<ReadonlyArray<JSDocMigrateTitleRecord>, QualityScriptCommandError> {
  const suggestions = yield* decodeSuggestionList(stripJsonFences(content)).pipe(
    Effect.mapError((cause) => QualityScriptCommandError.new(cause, "Title response is not the pinned JSON shape."))
  );
  const pendingByAnchor = MutableHashMap.fromIterable(
    A.map(pending, (record): readonly [string, JSDocMigrateExtractRecord] => [record.anchor, record])
  );
  const { problems, records, seen } = collectTitleSuggestions(suggestions, pendingByAnchor);
  for (const record of pending) {
    if (O.isNone(MutableHashMap.get(seen, record.anchor))) {
      A.appendInPlace(problems, `missing anchor ${record.anchor}`);
    }
  }
  if (problems.length > 0) {
    return yield* migrateTitlesError(`Title response failed validation: ${A.join(A.take(problems, 10), "; ")}`);
  }
  return records;
});

type PendingTitleFileGroup = {
  readonly filePath: string;
  readonly records: ReadonlyArray<JSDocMigrateExtractRecord>;
};

const pendingTitleRecords = (
  extract: ReadonlyArray<JSDocMigrateExtractRecord>,
  existingByAnchor: MutableHashMap.MutableHashMap<string, JSDocMigrateTitleRecord>
): ReadonlyArray<JSDocMigrateExtractRecord> =>
  A.filter(extract, (record) =>
    O.match(MutableHashMap.get(existingByAnchor, record.anchor), {
      onNone: () => true,
      onSome: (existing) => existing.sourceHash !== record.sourceHash,
    })
  );

const pendingTitleFileGroups = (
  pending: ReadonlyArray<JSDocMigrateExtractRecord>
): ReadonlyArray<PendingTitleFileGroup> => {
  const byFile = MutableHashMap.empty<string, Array<JSDocMigrateExtractRecord>>();
  for (const record of pending) {
    const bucket = MutableHashMap.get(byFile, record.filePath);
    if (O.isSome(bucket)) {
      A.appendInPlace(bucket.value, record);
    } else {
      MutableHashMap.set(byFile, record.filePath, [record]);
    }
  }
  return pipe(
    [...byFile],
    A.map(([filePath, records]): PendingTitleFileGroup => ({ filePath, records })),
    A.sortWith((group) => group.filePath, Order.String)
  );
};

/**
 * Options accepted by {@link runJSDocMigrateTitles}.
 *
 * **Example** (Configure a bounded title run)
 *
 * ```ts
 * import { RunJSDocMigrateTitlesOptions } from "@beep/repo-cli/test/Quality"
 *
 * const options = RunJSDocMigrateTitlesOptions.make({ limitFiles: 5 })
 * console.log(options.limitFiles) // 5
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RunJSDocMigrateTitlesOptions extends S.Class<RunJSDocMigrateTitlesOptions>(
  $I`RunJSDocMigrateTitlesOptions`
)(
  {
    extract: S.optionalKey(S.String),
    titles: S.optionalKey(S.String),
    proxyUrl: S.optionalKey(S.String),
    model: S.optionalKey(S.String),
    limitFiles: S.optionalKey(S.Int),
  },
  $I.annote("RunJSDocMigrateTitlesOptions", {
    description: "Options for the jsdoc-migrate titles stage: data files, proxy endpoint, model, and file cap.",
  })
) {}

const chatCompletionContent = (
  client: HttpClient.HttpClient,
  request: HttpClientRequest.HttpClientRequest
): Effect.Effect<string, QualityScriptCommandError> =>
  client.execute(request).pipe(
    Effect.filterOrFail(
      (candidate) => candidate.status >= 200 && candidate.status < 300,
      (candidate) => migrateTitlesError(`Proxy returned HTTP ${candidate.status}.`)
    ),
    Effect.flatMap((candidate) => candidate.json),
    Effect.mapError((cause) => QualityScriptCommandError.new(cause, "Failed to call the local model proxy.")),
    Effect.flatMap((body) =>
      decodeChatCompletion(body).pipe(
        Effect.mapError((cause) => QualityScriptCommandError.new(cause, "Proxy response is not a chat completion."))
      )
    ),
    Effect.map((response) => response.choices[0]?.message.content ?? "")
  );

const titlesPromptWithRetryNote = (
  pending: ReadonlyArray<JSDocMigrateExtractRecord>,
  previousProblem: string | undefined
): string =>
  previousProblem === undefined
    ? jsdocMigrateTitlesPrompt(pending)
    : `${jsdocMigrateTitlesPrompt(pending)}\nYour previous response was rejected: ${previousProblem}. Return only the corrected JSON array.`;

const requestTitlesForFile = Effect.fn("JSDocMigrateTitles.requestTitlesForFile")(function* (
  proxyUrl: string,
  model: string,
  pending: ReadonlyArray<JSDocMigrateExtractRecord>
): Effect.fn.Return<ReadonlyArray<JSDocMigrateTitleRecord>, QualityScriptCommandError, HttpClient.HttpClient> {
  const client = yield* HttpClient.HttpClient;
  const attempt = Effect.fnUntraced(function* (previousProblem: string | undefined) {
    const request = HttpClientRequest.post(`${proxyUrl}/v1/chat/completions`).pipe(
      HttpClientRequest.bodyJsonUnsafe({
        model,
        messages: [{ role: "user", content: titlesPromptWithRetryNote(pending, previousProblem) }],
        temperature: 0,
      })
    );
    const content = yield* chatCompletionContent(client, request);
    return yield* jsdocMigrateTitleRecordsFromResponse(content, pending);
  });

  let lastError: QualityScriptCommandError | undefined;
  for (let tryIndex = 0; tryIndex < 3; tryIndex += 1) {
    const outcome = yield* attempt(lastError?.message).pipe(Effect.result);
    if (outcome._tag === "Success") {
      return outcome.success;
    }
    lastError = outcome.failure;
  }
  return yield* lastError ?? migrateTitlesError("Title request failed.");
});

/**
 * Run the title pass: append validated records to `titles.jsonl` per anchor.
 *
 * **Details**
 *
 * One request per file through the local CLIProxyAPI (never the xAI API), so
 * the run bills the Grok plan and has no agent cap. Resume skips an anchor
 * only when its record is present AND its `sourceHash` still matches the
 * extract — a bare anchor-present check would silently reuse a stale title
 * after an upstream edit. Retries happen only on schema-invalid returns.
 *
 * **Example** (Build the titles Effect)
 *
 * ```ts
 * import { runJSDocMigrateTitles, RunJSDocMigrateTitlesOptions } from "@beep/repo-cli/test/Quality"
 * import { Effect } from "effect"
 *
 * const program = runJSDocMigrateTitles(RunJSDocMigrateTitlesOptions.make({ limitFiles: 1 }))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const runJSDocMigrateTitles = Effect.fn("JSDocMigrateTitles.run")(function* (
  options: RunJSDocMigrateTitlesOptions
): Effect.fn.Return<void, QualityScriptCommandError, FileSystem.FileSystem | Path.Path | HttpClient.HttpClient> {
  const { fs, path, repoRoot } = yield* jsdocMigrateRunContext();
  const extractPath = path.resolve(repoRoot, options.extract ?? defaultJSDocMigrateExtractPath);
  const titlesPath = path.resolve(repoRoot, options.titles ?? defaultJSDocMigrateTitlesPath);
  const proxyUrl = options.proxyUrl ?? defaultJSDocMigrateProxyUrl;
  const model = options.model ?? defaultJSDocMigrateTitlesModel;

  const extract = yield* readJSDocMigrateExtractRequired(extractPath);

  const existingByAnchor = MutableHashMap.empty<string, JSDocMigrateTitleRecord>();
  for (const record of yield* readJSDocMigrateJsonl(titlesPath, jsdocMigrateTitleCodec.decode, "titles.jsonl")) {
    MutableHashMap.set(existingByAnchor, record.anchor, record);
  }

  const pending = pendingTitleRecords(extract, existingByAnchor);
  const fileGroups = pendingTitleFileGroups(pending);
  const limited = options.limitFiles === undefined ? fileGroups : A.take(fileGroups, options.limitFiles);

  yield* fs
    .makeDirectory(path.dirname(titlesPath), { recursive: true })
    .pipe(
      Effect.mapError((cause) => QualityScriptCommandError.new(cause, `Failed to create ${path.dirname(titlesPath)}.`))
    );

  let appended = 0;
  for (const group of limited) {
    const records = yield* requestTitlesForFile(proxyUrl, model, group.records);
    const lines = yield* Effect.forEach(records, (record) =>
      jsdocMigrateTitleCodec
        .encode(record)
        .pipe(Effect.mapError((cause) => QualityScriptCommandError.new(cause, `Failed to encode ${record.anchor}.`)))
    );
    yield* fs
      .writeFileString(titlesPath, `${A.join(lines, "\n")}\n`, { flag: "a" })
      .pipe(Effect.mapError((cause) => QualityScriptCommandError.new(cause, `Failed to append to ${titlesPath}.`)));
    appended += records.length;
    yield* Console.log(`[jsdoc-migrate] titles: ${group.filePath} -> ${records.length} record(s)`);
  }
  yield* Console.log(
    `[jsdoc-migrate] titles ok: pendingBlocks=${pending.length} files=${limited.length} appended=${appended} -> ${titlesPath}`
  );
});
