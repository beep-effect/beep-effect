/**
 * Strict tsconfig verdict parity for the 3-A6 owner switch (repo-utils
 * `schemas/TSConfig.ts` -> `@beep/repo-tsconfig/TsconfigValidator`).
 *
 * `--record <out.json>` records, for the strict tsconfig model the tree
 * currently holds (see `MODEL` below):
 *
 * - the strict verdict (`accept` / `reject` + the schema failure text) over
 *   every git-tracked `*tsconfig*.json` outside packet research output (the
 *   corpus-A filter of `repo-tsconfig-differential.ts`);
 * - docgen's resolved `parseCompilerOptions` and `examplesCompilerOptions`
 *   for every tracked `docgen.json`, as `Configuration.load` resolves them
 *   from that package's directory with no CLI input, plus the examples
 *   `tsconfig.json` text docgen renders from the examples options.
 *
 * `--compare <before.json> <after.json>` diffs two records and classifies
 * every difference against the intended 3-A6 verdict shifts (each pinned by
 * an inverted test in `packages/tooling/library/repo-tsconfig/test`). The
 * run fails on any unclassified difference.
 *
 * The before record (`research/tsconfig-validator-parity-3-a6-before.json`)
 * was taken on the lane base with `MODEL` bound to the legacy repo-utils
 * model; the switch commit rebinds `MODEL` to the validator, so the after
 * record is reproducible from the final tree and the before record from the
 * recording commit.
 *
 * Usage (from the repo root, after `bun install`):
 *
 *   bun goals/effected-promotion/ops/tsconfig-validator-parity.ts --record <out.json>
 *   bun goals/effected-promotion/ops/tsconfig-validator-parity.ts --compare <before.json> <after.json> [--out <report.json>]
 */

import * as Configuration from "@beep/repo-docgen/Configuration";
import * as Domain from "@beep/repo-docgen/Domain";
import { TsconfigValidator } from "@beep/repo-tsconfig/TsconfigValidator";
import { jsonStringifyPretty } from "@beep/repo-utils";
import { TsconfigJsonFromString } from "@beep/tsconfig/TsconfigJson";
import { HostProcessPlatform } from "@beep/utils";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const TOOL = "goals/effected-promotion/ops/tsconfig-validator-parity.ts";
const CONCURRENCY = 8;

// --- the strict model under measurement -----------------------------------------------------------
//
// Current binding: `@beep/repo-tsconfig/TsconfigValidator` (the strict verdict of the loaded document,
// as `TsconfigValidator.load` judges it) and docgen's `encodeExamplesTsconfig`. The recording commit
// bound this block to repo-utils `schemas/TSConfig.ts` (`decodeTSConfigFromJsoncTextEffect` and
// `encodeTSConfigPrettyEffect`) without touching the record or compare code below.

interface StrictModel {
  /** The examples `tsconfig.json` text docgen renders from resolved examples compiler options. */
  readonly examplesTsconfig: (compilerOptions: unknown) => Effect.Effect<string, { readonly message: string }>;
  readonly name: string;
  /** Strict verdict over one tsconfig document's JSONC text. */
  readonly verdict: (text: string) => Effect.Effect<void, { readonly message: string }>;
}

const decodeDocument = S.decodeEffect(TsconfigJsonFromString);
const MODEL: StrictModel = {
  name: "@beep/repo-tsconfig TsconfigValidator",
  verdict: (text) => Effect.asVoid(Effect.flatMap(decodeDocument(text), TsconfigValidator.validate)),
  examplesTsconfig: (compilerOptions) =>
    Effect.flatMap(S.decodeUnknownEffect(Configuration.CompilerOptionsShape)(compilerOptions), (options) =>
      Configuration.encodeExamplesTsconfig(options)
    ),
};

// --- record ---------------------------------------------------------------------------------------

const Verdict = S.Struct({
  path: S.String,
  verdict: S.Literals(["accept", "reject"]),
  reason: S.NullOr(S.String),
});

const Outcome = S.Union([S.Struct({ ok: S.Unknown }), S.Struct({ error: S.String })]);

const DocgenEntry = S.Struct({
  path: S.String,
  parse: Outcome,
  examples: Outcome,
  examplesTsconfig: Outcome,
});

const ParityRecord = S.Struct({
  tool: S.String,
  model: S.String,
  commit: S.String,
  dirty: S.Boolean,
  tsconfigs: S.Struct({ count: S.Number, accept: S.Number, reject: S.Number, entries: S.Array(Verdict) }),
  docgen: S.Struct({ count: S.Number, loaded: S.Number, entries: S.Array(DocgenEntry) }),
});
type ParityRecord = typeof ParityRecord.Type;
type DocgenEntry = typeof DocgenEntry.Type;
type Outcome = typeof Outcome.Type;

const decodeRecord = S.decodeUnknownEffect(S.fromJsonString(ParityRecord));

class ParityFailed extends Data.TaggedError("TsconfigValidatorParityFailed")<{ readonly reason: string }> {}

const argv = process.argv.slice(2);
const flagValue = (flag: string): O.Option<string> =>
  pipe(
    A.findFirstIndex(argv, (arg) => arg === flag),
    O.flatMap((index) => A.get(argv, index + 1))
  );
const flagValues = (flag: string, count: number): O.Option<ReadonlyArray<string>> =>
  pipe(
    A.findFirstIndex(argv, (arg) => arg === flag),
    O.map((index) => A.drop(argv, index + 1)),
    O.map(A.take(count)),
    O.filter((values) => A.length(values) === count)
  );

const trackedFiles = Effect.fnUntraced(function* (repoRoot: string, args: ReadonlyArray<string>) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  return A.filter(
    yield* spawner.lines(ChildProcess.make("git", ["ls-files", "--", ...args], { cwd: repoRoot })),
    Str.isNonEmpty
  );
});

/** Committed output carries no machine paths: the checkout is `<repo>` and the home directory `~`. */
const scrub = (repoRoot: string, text: string): string =>
  pipe(text, Str.replaceAll(repoRoot, "<repo>"), Str.replaceAll(process.env.HOME ?? "~", "~"));

const recordTsconfigs = Effect.fnUntraced(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const files = yield* trackedFiles(repoRoot, ["*tsconfig*.json", ":(exclude)goals/**/research/**"]);
  const entries = yield* Effect.forEach(
    files,
    Effect.fnUntraced(function* (relative: string) {
      const text = yield* fs.readFileString(path.join(repoRoot, relative));
      const outcome = yield* Effect.result(MODEL.verdict(text));
      return outcome._tag === "Success"
        ? { path: relative, verdict: "accept" as const, reason: null }
        : { path: relative, verdict: "reject" as const, reason: scrub(repoRoot, outcome.failure.message) };
    }),
    { concurrency: CONCURRENCY }
  );
  return {
    count: A.length(entries),
    accept: A.length(A.filter(entries, (entry) => entry.verdict === "accept")),
    reject: A.length(A.filter(entries, (entry) => entry.verdict === "reject")),
    entries,
  };
});

const noLoadArgs: Parameters<typeof Configuration.load>[0] = {
  projectHomepage: O.none(),
  srcLink: O.none(),
  srcDir: O.none(),
  outDir: O.none(),
  theme: O.none(),
  enableSearch: O.none(),
  enforceDescriptions: O.none(),
  enforceExamples: O.none(),
  enforceVersion: O.none(),
  tscExecutable: O.none(),
  include: O.none(),
  exclude: O.none(),
  parseCompilerOptions: O.none(),
  examplesCompilerOptions: O.none(),
};

const processAt = (cwd: string) =>
  Layer.succeed(
    Domain.Process,
    Domain.Process.of({ cwd: Effect.succeed(cwd), platform: HostProcessPlatform, argv: Effect.succeed([]) })
  );

const outcome = <A, E extends { readonly message: string }>(
  repoRoot: string,
  effect: Effect.Effect<A, E>
): Effect.Effect<Outcome> =>
  Effect.match(effect, {
    onFailure: (error) => ({ error: scrub(repoRoot, error.message) }),
    onSuccess: (ok) => ({ ok }),
  });

const recordDocgen = Effect.fnUntraced(function* (repoRoot: string) {
  const path = yield* Path.Path;
  const files = yield* trackedFiles(repoRoot, ["*docgen.json"]);
  const entries = yield* Effect.forEach(
    files,
    Effect.fnUntraced(function* (relative: string): Effect.fn.Return<DocgenEntry, never, FileSystem.FileSystem> {
      const dir = path.dirname(path.join(repoRoot, relative));
      const loaded = yield* Effect.result(
        Configuration.load(noLoadArgs).pipe(Effect.provide(Layer.mergeAll(processAt(dir), Path.layer)))
      );
      if (loaded._tag === "Failure") {
        const error = { error: scrub(repoRoot, loaded.failure.message) };
        return { path: relative, parse: error, examples: error, examplesTsconfig: error };
      }
      const config = loaded.success;
      const examplesTsconfig = yield* outcome(repoRoot, MODEL.examplesTsconfig(config.examplesCompilerOptions));
      return {
        path: relative,
        parse: { ok: config.parseCompilerOptions },
        examples: { ok: config.examplesCompilerOptions },
        examplesTsconfig,
      };
    }),
    { concurrency: CONCURRENCY }
  );
  return {
    count: A.length(entries),
    loaded: A.length(A.filter(entries, (entry) => "ok" in entry.parse)),
    entries,
  };
});

const record = Effect.fnUntraced(function* (repoRoot: string, out: string) {
  const fs = yield* FileSystem.FileSystem;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const commit = Str.trim(yield* spawner.string(ChildProcess.make("git", ["rev-parse", "HEAD"], { cwd: repoRoot })));
  const dirty = Str.isNonEmpty(
    Str.trim(yield* spawner.string(ChildProcess.make("git", ["status", "--porcelain"], { cwd: repoRoot })))
  );
  const tsconfigs = yield* recordTsconfigs(repoRoot);
  const docgen = yield* recordDocgen(repoRoot);
  const report: ParityRecord = { tool: TOOL, model: MODEL.name, commit, dirty, tsconfigs, docgen };
  yield* fs.writeFileString(out, `${scrub(repoRoot, yield* jsonStringifyPretty(report))}\n`);
  yield* Console.error(
    `${MODEL.name}: ${tsconfigs.count} tsconfigs (${tsconfigs.accept} accept, ${tsconfigs.reject} reject); ` +
      `${docgen.count} docgen.json (${docgen.loaded} loaded)`
  );
});

// --- compare --------------------------------------------------------------------------------------

/**
 * The intended 3-A6 verdict shifts. Each rule names the inverted test that pins it; a difference no
 * rule claims is unclassified and fails the run.
 */
interface ShiftRule {
  readonly claims: (
    before: string | null,
    after: string | null,
    direction: "accept->reject" | "reject->accept"
  ) => boolean;
  readonly id: string;
  readonly pinnedBy: string;
}

const mentions = (text: string | null, pattern: RegExp): boolean => text !== null && pattern.test(text);

const SHIFT_RULES: ReadonlyArray<ShiftRule> = [
  {
    id: "paths-null-target-rejected",
    pinnedBy: "TsconfigValidator.test.ts: rejects a null paths target",
    claims: (_before, after, direction) =>
      direction === "accept->reject" && mentions(after, /got null[\s|]*at \["compilerOptions"\]\["paths"\]/),
  },
  {
    id: "null-option-rejected",
    pinnedBy: "TsconfigValidator.test.ts: rejects null where the legacy model collapsed it to Option.none",
    claims: (_before, after, direction) => direction === "accept->reject" && mentions(after, /got null/),
  },
  {
    id: "unknown-top-level-section-rejected",
    pinnedBy: "TsconfigValidator.test.ts: rejects the legacy ts-node and buildOptions sections as unknown keys",
    claims: (_before, after, direction) =>
      direction === "accept->reject" && mentions(after, /at \["(ts-node|buildOptions)"\]/),
  },
  {
    id: "removed-enum-value-rejected",
    pinnedBy: "TsconfigValidator.test.ts: rejects es3, the legacy fallbackPolling aliases and ES2022.SharedMemory",
    claims: (_before, after, direction) =>
      direction === "accept->reject" &&
      mentions(
        after,
        /got "(es3|fixedpollinginterval|prioritypollinginterval|dynamicprioritypolling|es2022\.sharedmemory)"/i
      ),
  },
  {
    id: "empty-reference-path-rejected",
    pinnedBy: "TsconfigValidator.test.ts: rejects an empty references[].path",
    claims: (_before, after, direction) =>
      direction === "accept->reject" && mentions(after, /\["references"\]\[\d+\]\["path"\]/),
  },
  {
    id: "allow-importing-ts-extensions-tsc7-rule",
    pinnedBy:
      "TsconfigValidator.test.ts: allowImportingTsExtensions follows tsc 7 (noEmit, emitDeclarationOnly or rewriteRelativeImportExtensions; no moduleResolution requirement)",
    claims: (before, _after, direction) =>
      direction === "reject->accept" && mentions(before, /allowImportingTsExtensions requires/),
  },
  {
    id: "new-enum-value-accepted",
    pinnedBy: "TsconfigValidator.test.ts: accepts the TypeScript 7 targets and library additions through ES2025",
    claims: (before, _after, direction) => direction === "reject->accept" && mentions(before, /Expected one of/),
  },
];

interface Difference {
  readonly after: unknown;
  readonly before: unknown;
  readonly classified: string | null;
  readonly kind: string;
  readonly path: string;
}

const classify = (before: string | null, after: string | null, direction: "accept->reject" | "reject->accept") =>
  pipe(
    A.findFirst(SHIFT_RULES, (rule) => rule.claims(before, after, direction)),
    O.map((rule) => rule.id),
    O.getOrNull
  );

const stable = (value: unknown): string => JSON.stringify(sortKeys(value));
const sortKeys = (value: unknown): unknown =>
  A.isArray(value)
    ? A.map(value, sortKeys)
    : P.isObject(value)
      ? pipe(
          R.toEntries(value as Record<string, unknown>),
          A.sort(Order.mapInput(Order.String, ([key]: readonly [string, unknown]) => key)),
          A.map(([key, inner]) => [key, sortKeys(inner)] as const),
          R.fromEntries
        )
      : value;
/** Key order and enum spelling are not semantic for tsc: lower-case every string leaf before comparing. */
const canonical = (value: unknown): string =>
  stable(
    JSON.parse(JSON.stringify(value), (_key, inner: unknown) => (P.isString(inner) ? Str.toLowerCase(inner) : inner))
  );

const compareTsconfigs = (before: ParityRecord, after: ParityRecord): ReadonlyArray<Difference> => {
  const afterByPath = R.fromEntries(A.map(after.tsconfigs.entries, (entry) => [entry.path, entry] as const));
  return A.getSomes(
    A.map(before.tsconfigs.entries, (entry) =>
      pipe(
        R.get(afterByPath, entry.path),
        O.flatMap((next) => {
          if (next.verdict === entry.verdict) return O.none();
          const direction = entry.verdict === "accept" ? ("accept->reject" as const) : ("reject->accept" as const);
          return O.some({
            path: entry.path,
            kind: `verdict ${direction}`,
            before: entry.reason,
            after: next.reason,
            classified: classify(entry.reason, next.reason, direction),
          });
        })
      )
    )
  );
};

const compareOutcome = (path: string, field: string, before: Outcome, after: Outcome): O.Option<Difference> => {
  if (stable(before) === stable(after)) return O.none();
  if ("ok" in before && "ok" in after) {
    if (field === "examplesTsconfig" && P.isString(before.ok) && P.isString(after.ok)) {
      const same = canonical(JSON.parse(before.ok)) === canonical(JSON.parse(after.ok));
      return O.some({
        path,
        kind: `${field} text`,
        before: before.ok,
        after: after.ok,
        classified: same ? "examples-tsconfig-key-order-and-enum-spelling" : null,
      });
    }
    return O.some({ path, kind: `${field} value`, before: before.ok, after: after.ok, classified: null });
  }
  return O.some({ path, kind: `${field} outcome`, before, after, classified: null });
};

const compareDocgen = (before: ParityRecord, after: ParityRecord): ReadonlyArray<Difference> => {
  const afterByPath = R.fromEntries(A.map(after.docgen.entries, (entry) => [entry.path, entry] as const));
  return A.flatMap(before.docgen.entries, (entry) =>
    pipe(
      R.get(afterByPath, entry.path),
      O.match({
        onNone: () => [{ path: entry.path, kind: "missing after", before: entry, after: null, classified: null }],
        onSome: (next) =>
          A.getSomes([
            compareOutcome(entry.path, "parse", entry.parse, next.parse),
            compareOutcome(entry.path, "examples", entry.examples, next.examples),
            compareOutcome(entry.path, "examplesTsconfig", entry.examplesTsconfig, next.examplesTsconfig),
          ]),
      })
    )
  );
};

const compare = Effect.fnUntraced(function* (beforePath: string, afterPath: string) {
  const fs = yield* FileSystem.FileSystem;
  const before = yield* decodeRecord(yield* fs.readFileString(beforePath));
  const after = yield* decodeRecord(yield* fs.readFileString(afterPath));
  const missingAfter = A.filter(
    before.tsconfigs.entries,
    (entry) => !A.some(after.tsconfigs.entries, (next) => next.path === entry.path)
  );
  const differences = [...compareTsconfigs(before, after), ...compareDocgen(before, after)];
  const unclassified = A.filter(differences, (difference) => difference.classified === null);
  const byRule = pipe(
    A.getSomes(A.map(differences, (difference) => O.fromNullishOr(difference.classified))),
    A.groupBy((id) => id),
    R.map(A.length)
  );
  const report = {
    tool: TOOL,
    before: {
      model: before.model,
      commit: before.commit,
      tsconfigs: before.tsconfigs.count,
      docgen: before.docgen.count,
    },
    after: { model: after.model, commit: after.commit, tsconfigs: after.tsconfigs.count, docgen: after.docgen.count },
    tsconfigVerdicts: {
      compared: A.length(before.tsconfigs.entries) - A.length(missingAfter),
      missingAfter: A.map(missingAfter, (entry) => entry.path),
      identical:
        A.length(before.tsconfigs.entries) - A.length(missingAfter) - A.length(compareTsconfigs(before, after)),
    },
    docgen: {
      compared: before.docgen.count,
      identical: before.docgen.count - A.length(A.dedupe(A.map(compareDocgen(before, after), (d) => d.path))),
    },
    classified: byRule,
    rules: A.map(SHIFT_RULES, (rule) => ({ id: rule.id, pinnedBy: rule.pinnedBy })),
    differences,
    unclassified: A.length(unclassified),
    ok: A.isReadonlyArrayEmpty(unclassified) && A.isReadonlyArrayEmpty(missingAfter),
  };
  const encoded = yield* jsonStringifyPretty(report);
  yield* O.match(flagValue("--out"), {
    onNone: () => Console.log(encoded),
    onSome: (out) => fs.writeFileString(out, `${encoded}\n`),
  });
  yield* Console.error(
    `${report.tsconfigVerdicts.compared} tsconfig verdicts compared (${report.tsconfigVerdicts.identical} identical), ` +
      `${report.docgen.compared} docgen.json compared (${report.docgen.identical} identical); ` +
      `${A.length(differences)} differences, ${report.unclassified} unclassified`
  );
  if (!report.ok) {
    return yield* new ParityFailed({ reason: `${report.unclassified} unclassified differences` });
  }
});

const program = Effect.fn("TsconfigValidatorParity.main")(function* () {
  const repoRoot = process.cwd();
  const recordOut = flagValue("--record");
  const comparePair = flagValues("--compare", 2);
  if (O.isSome(recordOut)) return yield* record(repoRoot, recordOut.value);
  if (O.isSome(comparePair)) return yield* compare(comparePair.value[0]!, comparePair.value[1]!);
  return yield* new ParityFailed({ reason: "pass --record <out.json> or --compare <before.json> <after.json>" });
});

program().pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
