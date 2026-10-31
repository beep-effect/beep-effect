/**
 * JSONC owner-switch differential (roadmap PR R3a, SPEC W4-o).
 *
 * R3a re-points every `@beep/schema/Jsonc` importer (`decodeJsoncTextAs`,
 * `JsoncTextToUnknown`) to the `@beep/jsonc` kit (`Jsonc.bind(schema).decode`,
 * `Jsonc.JsoncFromString`), deletes `packages/foundation/modeling/schema/src/Jsonc.ts`
 * and drops `jsonc-parser` from `@beep/schema`. Two legs prove the switch moves
 * no byte:
 *
 * 1. `corpus`: every git-tracked `*.jsonc` file plus the JSON documents the
 *    facade's consumers decode (`tsconfig*.json`, `turbo.json`, `biome.json*`,
 *    `vercel.json`, `package.json`, `docgen.json`) is decoded by a frozen copy of
 *    the deleted facade (`jsonc-parser` `parse` with `allowTrailingComma: true`,
 *    `disallowComments: false`, every parse error a failure) and by the kit
 *    (`Jsonc.JsoncFromString`). Two successes compare through
 *    `Jsonc.equalsValue`; two rejections are the classified `both-reject`
 *    outcome; anything else is unclassified and fails the gate. The encode
 *    direction is recorded too: the facade never encoded (`legacy-encode-unsupported`,
 *    intended), the kit encodes through `Jsonc.stringify`, and the kit text must
 *    decode back to the legacy value (`roundTrip`). The legacy leg needs
 *    `jsonc-parser` installed at the root, which R3b removes; without it the leg
 *    reports `skipped`, and the committed report
 *    `research/jsonc-owner-switch-differential-r3a.json` is the record.
 * 2. `edges`: a fixed negative and edge corpus (empty and whitespace-only
 *    documents, a UTF-8 BOM, trailing content, leading and trailing commas,
 *    unterminated strings, comments and containers, `NaN`, hex and other
 *    non-JSON numbers, nesting around the kit's 256-deep cap, a `__proto__`
 *    key, control characters, a lone surrogate, bad escapes) decoded by both
 *    legs, each case classified as `equal`, `both-reject`,
 *    `legacy-reject-kit-accept`, `legacy-accept-kit-reject` or `value-differs`.
 *    Three divergences are intended and allowlisted by case id with their
 *    reason (BOM tolerance, the 256-deep nesting cap, JSON.parse `__proto__`
 *    own-property semantics); every other non-equal, non-both-reject case, and
 *    an allowlisted case whose outcome moved, is unclassified and fails the
 *    gate. The leg also records one rejection's message under both legs,
 *    because the text changes (`Invalid JSONC input (...)` becomes `JSONC parse
 *    failed with N error(s): ...`) and flows into the consumers' error messages.
 * 3. `generators`: every repo-cli generator that reads JSONC through the facade
 *    and has a check or dry mode runs against one fixed input tree, the lane's
 *    CLI doing the work: `tsconfig-sync --check|--dry-run`, `version-sync
 *    --skip-network [--dry-run]`, `lint tsconfig-overlay`, `cache census --json`,
 *    `cache profile`, `quality jsdoc-ratchet`, `lint schema-first`,
 *    `lint effect-vitest`, `knowledge doctor --report --json` and
 *    `create-package --dry-run`. Each run records its exit code, the sha256 of
 *    its normalized stdout and stderr (ANSI, durations, timestamps and the two
 *    roots replaced) and whether the input tree stayed clean. `--compare`
 *    re-runs the matrix with the current code and fails on any difference.
 *
 * The input tree is a detached worktree of the base revision so the before and
 * after runs read identical files while only the code differs:
 *
 *   git worktree add --detach "$HOME/.cache/beep/effected-r3a-jsonc-parity" <base-rev>
 *   ln -s "$PWD/node_modules" "$HOME/.cache/beep/effected-r3a-jsonc-parity/node_modules"
 *
 * Usage (from the repo root):
 *
 *   bun goals/effected-promotion/ops/jsonc-owner-switch-differential.ts --inputs-root <worktree> [--out <report.json>]
 *   bun goals/effected-promotion/ops/jsonc-owner-switch-differential.ts --inputs-root <worktree> --compare <baseline.json> [--out <report.json>]
 *   bun goals/effected-promotion/ops/jsonc-owner-switch-differential.ts --skip-generators [--out <report.json>]
 *
 * The report names the code revision it measured (`codeRev`); a dirty checkout
 * is refused unless `--allow-dirty` is passed, and then `dirtyAllowed: true` is
 * recorded so a provisional record cannot pass as the committed one.
 *
 * Exit code 1 when the checkout is dirty without `--allow-dirty`, the corpus
 * or the edge leg has an unclassified difference, a round trip fails, a
 * generator leaves the input tree dirty, or `--compare` finds a difference.
 */
import * as NodeURL from "node:url";
import { Jsonc } from "@beep/jsonc/Jsonc";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";

// --- report schema ------------------------------------------------------------

const TOOL = "goals/effected-promotion/ops/jsonc-owner-switch-differential.ts";

const CorpusOutcome = S.Literals(["equal", "both-reject", "unclassified"]);

const CorpusDifference = S.Struct({
  path: S.String,
  outcome: CorpusOutcome,
  legacy: S.String,
  kit: S.String,
});

const CorpusLeg = S.Struct({
  legacy: S.Literals(["jsonc-parser", "skipped"]),
  scope: S.String,
  files: S.Finite,
  byKind: S.Record(S.String, S.Finite),
  equal: S.Finite,
  bothReject: S.Finite,
  unclassified: S.Finite,
  encode: S.Struct({
    legacy: S.tag("legacy-encode-unsupported"),
    kitEncoded: S.Finite,
    roundTrip: S.Finite,
    failures: S.Array(S.Struct({ path: S.String, message: S.String })),
  }),
  differences: S.Array(CorpusDifference),
});

const EdgeOutcome = S.Literals([
  "equal",
  "both-reject",
  "legacy-reject-kit-accept",
  "legacy-accept-kit-reject",
  "value-differs",
]);

const EdgeCaseRecord = S.Struct({
  id: S.String,
  outcome: EdgeOutcome,
  legacy: S.String,
  kit: S.String,
  intended: S.optionalKey(S.String),
});

const EdgeLeg = S.Struct({
  legacy: S.Literals(["jsonc-parser", "skipped"]),
  cases: S.Finite,
  equal: S.Finite,
  bothReject: S.Finite,
  intended: S.Finite,
  unclassified: S.Finite,
  messageShape: S.Struct({ id: S.String, legacy: S.String, kit: S.String }),
  records: S.Array(EdgeCaseRecord),
});

const GeneratorRun = S.Struct({
  id: S.String,
  argv: S.Array(S.String),
  exitCode: S.Finite,
  stdoutSha256: S.String,
  stdoutBytes: S.Finite,
  stdoutHead: S.String,
  stderrSha256: S.String,
  stderrBytes: S.Finite,
  stderrHead: S.String,
  treeClean: S.Boolean,
});

const GeneratorsLeg = S.Struct({
  inputsRev: S.String,
  runs: S.Array(GeneratorRun),
});

const Difference = S.Struct({ subject: S.String, field: S.String, baseline: S.String, current: S.String });

const Report = S.Struct({
  schemaVersion: S.tag(1),
  tool: S.String,
  codeRev: S.String,
  codeDirty: S.Boolean,
  dirtyAllowed: S.optionalKey(S.Boolean),
  corpus: CorpusLeg,
  edges: EdgeLeg,
  generators: S.optionalKey(GeneratorsLeg),
  comparedWith: S.optionalKey(S.String),
  differences: S.optionalKey(S.Array(Difference)),
});

type CorpusDifference = typeof CorpusDifference.Type;
type CorpusLeg = typeof CorpusLeg.Type;
type EdgeOutcome = typeof EdgeOutcome.Type;
type EdgeCaseRecord = typeof EdgeCaseRecord.Type;
type EdgeLeg = typeof EdgeLeg.Type;
type GeneratorRun = typeof GeneratorRun.Type;
type Difference = typeof Difference.Type;
type Report = typeof Report.Type;

const encodeReport = S.encodeEffect(S.fromJsonString(Report, { space: 2 }));
const decodeReport = S.decodeUnknownEffect(S.fromJsonString(Report));

class DifferentialFailure extends S.TaggedError<DifferentialFailure, { readonly brand: unique symbol }>()(
  "DifferentialFailure",
  { message: S.String }
) {}

const failWith = (cause: unknown) => DifferentialFailure.make({ message: String(cause) });

const repoRoot = NodeURL.fileURLToPath(new URL("../../..", import.meta.url));
const cliEntry = `${repoRoot}packages/tooling/tool/cli/src/bin.ts`;

const flagValue = (flag: string): O.Option<string> =>
  O.flatMap(
    A.findFirstIndex(process.argv, (arg) => arg === flag),
    (index) => A.get(process.argv, index + 1)
  );

const hasFlag = (flag: string): boolean => A.contains(process.argv, flag);

const sha256 = (text: string): string => new Bun.CryptoHasher("sha256").update(text).digest("hex");

const basename = (path: string): string =>
  pipe(
    Str.split(path, "/"),
    A.last,
    O.getOrElse(() => path)
  );

// --- shell ---------------------------------------------------------------------

const collectText = <E>(stream: Stream.Stream<Uint8Array, E>) => stream.pipe(Stream.decodeText(), Stream.mkString);

const git = Effect.fn("JsoncDifferential.git")(function* (cwd: string, args: ReadonlyArray<string>) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  return yield* spawner.string(ChildProcess.make("git", [...args], { cwd }));
});

const revParse = (cwd: string) => Effect.map(git(cwd, ["rev-parse", "HEAD"]), Str.trim);

// The input worktree carries a `node_modules` symlink to the lane's install (not a
// directory, so the repo's ignore rule does not cover it); everything else counts.
const isDirty = (cwd: string) =>
  Effect.map(git(cwd, ["status", "--porcelain"]), (status) =>
    pipe(
      Str.split(status, "\n"),
      A.map(Str.trim),
      A.some((line) => !Str.isEmpty(line) && line !== "?? node_modules")
    )
  );

// --- corpus --------------------------------------------------------------------

const CORPUS_BASENAMES: ReadonlyArray<string> = [
  "turbo.json",
  "biome.json",
  "vercel.json",
  "package.json",
  "docgen.json",
];

const corpusKind = (path: string): O.Option<string> => {
  const base = basename(path);
  if (Str.endsWith(".jsonc")(base)) {
    return O.some("jsonc");
  }
  if (Str.startsWith("tsconfig")(base) && Str.endsWith(".json")(base)) {
    return O.some("tsconfig");
  }
  return A.contains(CORPUS_BASENAMES, base) ? O.some(base) : O.none();
};

// The decode direction of the deleted facade, frozen from
// `packages/foundation/modeling/schema/src/Jsonc.ts` at the R3a base revision.
interface LegacyModule {
  readonly parse: (
    text: string,
    errors: Array<{ readonly error: number; readonly offset: number; readonly length: number }>,
    options: { readonly allowTrailingComma: boolean; readonly disallowComments: boolean }
  ) => unknown;
  readonly printParseErrorCode: (code: number) => string;
}

const loadLegacy: Effect.Effect<O.Option<LegacyModule>> = Effect.tryPromise({
  try: () => import("jsonc-parser") as Promise<LegacyModule>,
  catch: (cause) => cause,
}).pipe(Effect.option);

const legacyDecode =
  (jsonc: LegacyModule) =>
  (content: string): Result.Result<unknown, string> => {
    const errors: Array<{ readonly error: number; readonly offset: number; readonly length: number }> = [];
    const parsed = jsonc.parse(content, errors, { allowTrailingComma: true, disallowComments: false });
    return A.match(errors, {
      onEmpty: () => Result.succeed(parsed),
      onNonEmpty: (recorded) =>
        Result.fail(
          pipe(
            recorded,
            A.map((error) => `${jsonc.printParseErrorCode(error.error)}@${error.offset}:${error.length}`),
            A.join(", "),
            (details) => `Invalid JSONC input (${details}).`
          )
        ),
    });
  };

const kitDecode = S.decodeResult(Jsonc.JsoncFromString);
const kitEncode = S.encodeResult(Jsonc.JsoncFromString);

const describe = (result: Result.Result<unknown, unknown>): string =>
  Result.match(result, {
    onFailure: (error) => `reject: ${Str.trim(String(error))}`,
    onSuccess: () => "accept",
  });

const classify = (
  legacy: Result.Result<unknown, string>,
  kit: Result.Result<unknown, S.SchemaError>,
  text: string
): typeof CorpusOutcome.Type => {
  if (Result.isSuccess(legacy) && Result.isSuccess(kit)) {
    return Jsonc.equalsValue(text, legacy.success) ? "equal" : "unclassified";
  }
  return Result.isFailure(legacy) && Result.isFailure(kit) ? "both-reject" : "unclassified";
};

const runCorpus = Effect.fn("JsoncDifferential.runCorpus")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const listing = yield* git(repoRoot, ["ls-files", "-z"]);
  const paths = pipe(
    Str.split(listing, "\u0000"),
    A.map((path) => O.map(corpusKind(path), (kind) => ({ path, kind }))),
    A.getSomes,
    A.sort(Order.mapInput(Order.String, (entry: { readonly path: string }) => entry.path))
  );
  const byKind = A.reduce(paths, {} as Record<string, number>, (counts, entry) => ({
    ...counts,
    [entry.kind]: (counts[entry.kind] ?? 0) + 1,
  }));
  const scope =
    "git ls-files: every *.jsonc, plus tsconfig*.json, turbo.json, biome.json, vercel.json, package.json and docgen.json";
  const legacy = yield* loadLegacy;
  if (O.isNone(legacy)) {
    yield* Console.log("corpus: jsonc-parser is not installed; the legacy leg is skipped");
    return {
      legacy: "skipped",
      scope,
      files: A.length(paths),
      byKind,
      equal: 0,
      bothReject: 0,
      unclassified: 0,
      encode: { legacy: "legacy-encode-unsupported", kitEncoded: 0, roundTrip: 0, failures: [] },
      differences: [],
    } satisfies CorpusLeg;
  }
  const decodeLegacy = legacyDecode(legacy.value);
  const outcomes = yield* Effect.forEach(paths, (entry) =>
    Effect.map(fs.readFileString(`${repoRoot}${entry.path}`).pipe(Effect.mapError(failWith)), (text) => {
      const legacyResult = decodeLegacy(text);
      const kitResult = kitDecode(text);
      const outcome = classify(legacyResult, kitResult, text);
      const encoded = Result.isSuccess(legacyResult) ? O.some(kitEncode(legacyResult.success)) : O.none();
      const roundTrip = O.flatMap(encoded, (result) =>
        Result.match(result, {
          onFailure: (error) => O.some({ path: entry.path, message: Str.trim(String(error)) }),
          onSuccess: (text2) =>
            Result.isSuccess(legacyResult) && Jsonc.equalsValue(text2, legacyResult.success)
              ? O.none()
              : O.some({ path: entry.path, message: "kit text does not decode back to the legacy value" }),
        })
      );
      return {
        difference:
          outcome === "equal"
            ? O.none<CorpusDifference>()
            : O.some({ path: entry.path, outcome, legacy: describe(legacyResult), kit: describe(kitResult) }),
        outcome,
        kitEncoded: O.exists(encoded, Result.isSuccess),
        roundTripFailure: roundTrip,
      };
    })
  );
  const count = (outcome: typeof CorpusOutcome.Type) =>
    A.length(A.filter(outcomes, (entry) => entry.outcome === outcome));
  const failures = A.getSomes(A.map(outcomes, (entry) => entry.roundTripFailure));
  const kitEncoded = A.length(A.filter(outcomes, (entry) => entry.kitEncoded));
  const leg = {
    legacy: "jsonc-parser",
    scope,
    files: A.length(paths),
    byKind,
    equal: count("equal"),
    bothReject: count("both-reject"),
    unclassified: count("unclassified"),
    encode: {
      legacy: "legacy-encode-unsupported",
      kitEncoded,
      roundTrip: kitEncoded - A.length(failures),
      failures,
    },
    differences: A.getSomes(A.map(outcomes, (entry) => entry.difference)),
  } satisfies CorpusLeg;
  yield* Console.log(
    `corpus: ${leg.files} file(s), ${leg.equal} equal, ${leg.bothReject} both-reject, ${leg.unclassified} unclassified; encode ${leg.encode.roundTrip}/${leg.encode.kitEncoded} round trips`
  );
  return leg;
});

// --- edges ---------------------------------------------------------------------

interface EdgeCase {
  readonly id: string;
  readonly text: string;
}

const nested = (depth: number): string => `${Str.repeat(depth)("[")}${Str.repeat(depth)("]")}`;

// Fixed negative and edge corpus. Ids are the allowlist keys below; keep them stable.
const EDGE_CASES: ReadonlyArray<EdgeCase> = [
  { id: "empty", text: "" },
  { id: "whitespace-only", text: "  \n\t " },
  { id: "bom-prefixed", text: '﻿{"a":1}' },
  { id: "trailing-content", text: '{"a":1} x' },
  { id: "array-trailing-comma", text: "[1,]" },
  { id: "array-leading-comma", text: "[,1]" },
  { id: "array-double-comma", text: "[1,,2]" },
  { id: "object-trailing-comma", text: '{"a":1,}' },
  { id: "nested-trailing-commas", text: '{"a":[1,2,],}' },
  { id: "unterminated-string", text: '"abc' },
  { id: "unterminated-block-comment", text: "/* open" },
  { id: "unterminated-object", text: '{"a":1' },
  { id: "line-comment-only", text: "// just a comment" },
  { id: "block-comment-only", text: "/* c */" },
  { id: "value-with-line-comment", text: "true // ok" },
  { id: "crlf-around-object", text: '\r\n{\r\n"a": 1\r\n}\r\n' },
  { id: "nan", text: "NaN" },
  { id: "infinity", text: "Infinity" },
  { id: "undefined-literal", text: "undefined" },
  { id: "hex-number", text: "0x10" },
  { id: "leading-zero", text: "01" },
  { id: "leading-plus", text: "+1" },
  { id: "leading-dot", text: ".5" },
  { id: "trailing-dot", text: "1." },
  { id: "depth-255", text: nested(255) },
  { id: "depth-256", text: nested(256) },
  { id: "depth-257", text: nested(257) },
  { id: "depth-300", text: nested(300) },
  { id: "proto-key-object-value", text: '{"__proto__":{"x":1}}' },
  { id: "proto-key-primitive-value", text: '{"__proto__":1}' },
  { id: "control-char-in-string", text: '"a\u0001b"' },
  { id: "tab-in-string", text: '"a\tb"' },
  { id: "lone-surrogate-escape", text: '"\\ud800"' },
  { id: "bad-escape", text: '"\\q"' },
  { id: "short-unicode-escape", text: '"\\u00"' },
  { id: "escaped-slash", text: '"a\\/b"' },
  { id: "single-quoted-string", text: "'a'" },
  { id: "unquoted-key", text: "{a:1}" },
  { id: "missing-colon", text: '{"a" 1}' },
  { id: "missing-value", text: '{"a":}' },
  { id: "duplicate-keys", text: '{"a":1,"a":2}' },
  { id: "null", text: "null" },
];

// The divergences R3a accepts, by case id: the outcome the kit must show and why.
const INTENDED_DIVERGENCES: HashMap.HashMap<string, { readonly outcome: EdgeOutcome; readonly reason: string }> =
  HashMap.make(
    [
      "bom-prefixed",
      {
        outcome: "legacy-reject-kit-accept",
        reason:
          "BOM tolerance: the kit scanner treats U+FEFF as whitespace; jsonc-parser rejected it (InvalidSymbol@0:1). No tracked document carries a BOM (corpus leg).",
      },
    ],
    [
      "depth-257",
      {
        outcome: "legacy-accept-kit-reject",
        reason:
          "Nesting cap: the kit rejects collections nested deeper than MAX_NESTING_DEPTH (256, internal/limits.ts) with NestingDepthExceeded instead of risking a RangeError defect; jsonc-parser recursed without a cap.",
      },
    ],
    [
      "depth-300",
      {
        outcome: "legacy-accept-kit-reject",
        reason: "Nesting cap, as depth-257.",
      },
    ],
    [
      "proto-key-object-value",
      {
        outcome: "value-differs",
        reason:
          "JSON.parse semantics: the kit defines `__proto__` as an own data property; jsonc-parser assigned it and so set the result's prototype and dropped the key. No @beep/jsonc consumer feeds a decoded object into a [[Set]] merge (Object.assign, R.union); spreads create own properties.",
      },
    ],
    [
      "proto-key-primitive-value",
      {
        outcome: "value-differs",
        reason: "JSON.parse `__proto__` semantics, as proto-key-object-value (jsonc-parser dropped the key).",
      },
    ]
  );

const MESSAGE_SHAPE_CASE = "trailing-content";

const classifyEdge = (
  legacy: Result.Result<unknown, string>,
  kit: Result.Result<unknown, S.SchemaError>,
  text: string
): EdgeOutcome => {
  if (Result.isSuccess(legacy)) {
    if (Result.isFailure(kit)) {
      return "legacy-accept-kit-reject";
    }
    return Jsonc.equalsValue(text, legacy.success) ? "equal" : "value-differs";
  }
  return Result.isSuccess(kit) ? "legacy-reject-kit-accept" : "both-reject";
};

const edgeRecord = (decodeLegacy: (content: string) => Result.Result<unknown, string>, edge: EdgeCase) => {
  const legacyResult = decodeLegacy(edge.text);
  const kitResult = kitDecode(edge.text);
  const outcome = classifyEdge(legacyResult, kitResult, edge.text);
  const intended = HashMap.get(INTENDED_DIVERGENCES, edge.id);
  const record = {
    id: edge.id,
    outcome,
    legacy: describe(legacyResult),
    kit: describe(kitResult),
    ...O.match(intended, { onNone: () => ({}), onSome: (entry) => ({ intended: entry.reason }) }),
  } satisfies EdgeCaseRecord;
  // The allowlist is exact: an allowlisted case must show its recorded outcome, and an
  // unlisted case must be equal or rejected by both legs.
  const classified = O.match(intended, {
    onNone: () => outcome === "equal" || outcome === "both-reject",
    onSome: (entry) => entry.outcome === outcome,
  });
  return { record, classified };
};

const runEdges = Effect.fn("JsoncDifferential.runEdges")(function* () {
  const legacy = yield* loadLegacy;
  if (O.isNone(legacy)) {
    yield* Console.log("edges: jsonc-parser is not installed; the legacy leg is skipped");
    return {
      legacy: "skipped",
      cases: A.length(EDGE_CASES),
      equal: 0,
      bothReject: 0,
      intended: 0,
      unclassified: 0,
      messageShape: { id: MESSAGE_SHAPE_CASE, legacy: "skipped", kit: "skipped" },
      records: [],
    } satisfies EdgeLeg;
  }
  const decodeLegacy = legacyDecode(legacy.value);
  const outcomes = A.map(EDGE_CASES, (edge) => edgeRecord(decodeLegacy, edge));
  const records = A.map(outcomes, (entry) => entry.record);
  const count = (outcome: EdgeOutcome) => A.length(A.filter(records, (record) => record.outcome === outcome));
  const shape = pipe(
    A.findFirst(records, (record) => record.id === MESSAGE_SHAPE_CASE),
    O.map((record) => ({ id: record.id, legacy: record.legacy, kit: record.kit })),
    O.getOrElse(() => ({ id: MESSAGE_SHAPE_CASE, legacy: "missing", kit: "missing" }))
  );
  const leg = {
    legacy: "jsonc-parser",
    cases: A.length(records),
    equal: count("equal"),
    bothReject: count("both-reject"),
    intended: A.length(
      A.filter(outcomes, (entry) => entry.classified && O.isSome(HashMap.get(INTENDED_DIVERGENCES, entry.record.id)))
    ),
    unclassified: A.length(A.filter(outcomes, (entry) => !entry.classified)),
    messageShape: shape,
    records,
  } satisfies EdgeLeg;
  yield* Console.log(
    `edges: ${leg.cases} case(s), ${leg.equal} equal, ${leg.bothReject} both-reject, ${leg.intended} intended divergence(s), ${leg.unclassified} unclassified`
  );
  return leg;
});

// --- generators ----------------------------------------------------------------

interface Generator {
  readonly argv: ReadonlyArray<string>;
  readonly id: string;
}

const GENERATORS: ReadonlyArray<Generator> = [
  { id: "tsconfig-sync-check", argv: ["tsconfig-sync", "--check", "--verbose"] },
  { id: "tsconfig-sync-dry-run", argv: ["tsconfig-sync", "--dry-run", "--verbose"] },
  { id: "version-sync-report", argv: ["version-sync", "--skip-network"] },
  { id: "version-sync-dry-run", argv: ["version-sync", "--skip-network", "--dry-run"] },
  { id: "lint-tsconfig-overlay", argv: ["lint", "tsconfig-overlay"] },
  { id: "cache-census-json", argv: ["cache", "census", "--json"] },
  { id: "cache-profile-check", argv: ["cache", "profile"] },
  { id: "quality-jsdoc-ratchet", argv: ["quality", "jsdoc-ratchet"] },
  { id: "lint-schema-first", argv: ["lint", "schema-first"] },
  { id: "lint-effect-vitest", argv: ["lint", "effect-vitest"] },
  { id: "knowledge-doctor-report", argv: ["knowledge", "doctor", "--report", "--json"] },
  {
    id: "create-package-dry-run",
    argv: [
      "create-package",
      "--dry-run",
      "--skip-lockfile",
      "--type",
      "library",
      "--family",
      "foundation",
      "--kind",
      "modeling",
      "--description",
      "R3a JSONC parity probe",
      "r3a-jsonc-parity-probe",
    ],
  },
];

const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;
const DURATION = /\b\d+(?:\.\d+)?\s?(?:ms|s|min)\b/g;
// Phase timings such as `discoveryMs=3469.6` and `scanMs=81736.6`.
const PHASE_MS = /\b(\w+Ms)=\d+(?:\.\d+)?/g;
const TIMESTAMP = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})/g;

const normalize =
  (inputsRoot: string) =>
  (text: string): string =>
    pipe(
      text,
      (value) => value.replace(ANSI, ""),
      Str.replaceAll(`${inputsRoot}/`, "<inputs>/"),
      Str.replaceAll(inputsRoot, "<inputs>"),
      Str.replaceAll(repoRoot, "<repo>/"),
      (value) => value.replace(TIMESTAMP, "<timestamp>"),
      (value) => value.replace(PHASE_MS, "$1=<duration>"),
      (value) => value.replace(DURATION, "<duration>")
    );

const head = (text: string): string => Str.slice(0, 240)(text);

const runGenerator = Effect.fn("JsoncDifferential.runGenerator")(function* (inputsRoot: string, generator: Generator) {
  const result = yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* ChildProcess.make("bun", [cliEntry, ...generator.argv], {
        cwd: inputsRoot,
        env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
        extendEnv: false,
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
      });
      return yield* Effect.all(
        { stdout: collectText(handle.stdout), stderr: collectText(handle.stderr), exitCode: handle.exitCode },
        { concurrency: "unbounded" }
      );
    })
  );
  const clean = normalize(inputsRoot);
  const stdout = clean(result.stdout);
  const stderr = clean(result.stderr);
  const treeClean = !(yield* isDirty(inputsRoot));
  if (!treeClean) {
    yield* git(inputsRoot, ["checkout", "--", "."]);
    yield* git(inputsRoot, ["clean", "-fd"]);
  }
  const run = {
    id: generator.id,
    argv: [...generator.argv],
    exitCode: Number(result.exitCode),
    stdoutSha256: sha256(stdout),
    stdoutBytes: Buffer.byteLength(stdout),
    stdoutHead: head(stdout),
    stderrSha256: sha256(stderr),
    stderrBytes: Buffer.byteLength(stderr),
    stderrHead: head(stderr),
    treeClean,
  } satisfies GeneratorRun;
  yield* Console.log(
    `${run.id}: exit ${run.exitCode}, stdout ${run.stdoutBytes} B ${Str.slice(0, 12)(run.stdoutSha256)}, stderr ${run.stderrBytes} B, tree ${treeClean ? "clean" : "DIRTY"}`
  );
  return run;
});

const runGenerators = Effect.fn("JsoncDifferential.runGenerators")(function* (inputsRoot: string) {
  const inputsRev = yield* revParse(inputsRoot);
  if (yield* isDirty(inputsRoot)) {
    return yield* DifferentialFailure.make({ message: `${inputsRoot} is dirty; the input tree must be clean` });
  }
  const runs = yield* Effect.forEach(GENERATORS, (generator) => runGenerator(inputsRoot, generator));
  return { inputsRev, runs };
});

// --- compare -------------------------------------------------------------------

const compareField = (subject: string, field: string, baseline: unknown, current: unknown): O.Option<Difference> =>
  baseline === current ? O.none() : O.some({ subject, field, baseline: String(baseline), current: String(current) });

const compareReports = (baseline: Report, current: Report): ReadonlyArray<Difference> => {
  const corpus = A.getSomes([
    compareField("corpus", "files", baseline.corpus.files, current.corpus.files),
    compareField("corpus", "equal", baseline.corpus.equal, current.corpus.equal),
    compareField("corpus", "bothReject", baseline.corpus.bothReject, current.corpus.bothReject),
    compareField("corpus", "unclassified", baseline.corpus.unclassified, current.corpus.unclassified),
    compareField("corpus", "encode.roundTrip", baseline.corpus.encode.roundTrip, current.corpus.encode.roundTrip),
  ]);
  const edges = A.getSomes([
    compareField("edges", "cases", baseline.edges.cases, current.edges.cases),
    compareField("edges", "equal", baseline.edges.equal, current.edges.equal),
    compareField("edges", "bothReject", baseline.edges.bothReject, current.edges.bothReject),
    compareField("edges", "intended", baseline.edges.intended, current.edges.intended),
    compareField("edges", "unclassified", baseline.edges.unclassified, current.edges.unclassified),
    ...A.flatMap(baseline.edges.records, (before) =>
      O.match(
        A.findFirst(current.edges.records, (record) => record.id === before.id),
        {
          onNone: () => [{ subject: `edge:${before.id}`, field: "record", baseline: "present", current: "missing" }],
          onSome: (after) => A.getSomes([compareField(`edge:${before.id}`, "outcome", before.outcome, after.outcome)]),
        }
      )
    ),
  ]);
  const baselineRuns = O.getOrElse(
    O.map(O.fromNullishOr(baseline.generators), (leg) => leg.runs),
    () => A.empty<GeneratorRun>()
  );
  const currentRuns = O.getOrElse(
    O.map(O.fromNullishOr(current.generators), (leg) => leg.runs),
    () => A.empty<GeneratorRun>()
  );
  const inputsRevOf = (report: Report): string =>
    pipe(
      O.fromNullishOr(report.generators),
      O.map((leg) => leg.inputsRev),
      O.getOrElse(() => "none")
    );
  const inputs = A.getSomes([compareField("generators", "inputsRev", inputsRevOf(baseline), inputsRevOf(current))]);
  const runs = A.flatMap(baselineRuns, (before) =>
    O.match(
      A.findFirst(currentRuns, (run) => run.id === before.id),
      {
        onNone: () => [{ subject: before.id, field: "run", baseline: "present", current: "missing" }],
        onSome: (after) =>
          A.getSomes([
            compareField(before.id, "exitCode", before.exitCode, after.exitCode),
            compareField(before.id, "stdoutSha256", before.stdoutSha256, after.stdoutSha256),
            compareField(before.id, "stderrSha256", before.stderrSha256, after.stderrSha256),
            compareField(before.id, "treeClean", before.treeClean, after.treeClean),
          ]),
      }
    )
  );
  return [...corpus, ...edges, ...inputs, ...runs];
};

// --- main ----------------------------------------------------------------------

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const codeRev = yield* revParse(repoRoot);
  const codeDirty = yield* isDirty(repoRoot);
  const dirtyAllowed = hasFlag("--allow-dirty");
  if (codeDirty && !dirtyAllowed) {
    return yield* DifferentialFailure.make({
      message: `${repoRoot} is dirty; commit first so codeRev names the measured code, or pass --allow-dirty (recorded as dirtyAllowed)`,
    });
  }
  const corpus = yield* runCorpus();
  const edges = yield* runEdges();
  const inputsRoot = flagValue("--inputs-root");
  const generators = hasFlag("--skip-generators")
    ? O.none()
    : O.isSome(inputsRoot)
      ? O.some(yield* runGenerators(Str.replace(/\/$/, "")(inputsRoot.value)))
      : yield* DifferentialFailure.make({ message: "pass --inputs-root <worktree> or --skip-generators" });
  const base: Report = {
    schemaVersion: 1,
    tool: TOOL,
    codeRev,
    codeDirty,
    ...(dirtyAllowed ? { dirtyAllowed } : {}),
    corpus,
    edges,
    ...(O.isSome(generators) ? { generators: generators.value } : {}),
  };
  const compared = flagValue("--compare");
  const report: Report = O.isSome(compared)
    ? yield* Effect.map(
        fs.readFileString(compared.value).pipe(Effect.mapError(failWith), Effect.flatMap(decodeReport)),
        (baseline) => ({
          ...base,
          comparedWith: compared.value,
          differences: compareReports(baseline, base),
        })
      )
    : base;
  const encoded = yield* encodeReport(report);
  yield* O.match(flagValue("--out"), {
    onNone: () => Console.log(encoded),
    onSome: (out) =>
      fs
        .writeFileString(out, `${encoded}\n`)
        .pipe(Effect.mapError(failWith), Effect.andThen(Console.log(`report written to ${out}`))),
  });
  const dirtyRuns = pipe(
    O.fromNullishOr(report.generators),
    O.map((leg) => A.filter(leg.runs, (run) => !run.treeClean)),
    O.getOrElse(() => A.empty<GeneratorRun>())
  );
  const differences = report.differences ?? [];
  const failures = [
    ...(report.corpus.unclassified > 0 ? [`${report.corpus.unclassified} unclassified corpus difference(s)`] : []),
    ...(report.edges.unclassified > 0 ? [`${report.edges.unclassified} unclassified edge case(s)`] : []),
    ...(A.isReadonlyArrayNonEmpty(report.corpus.encode.failures)
      ? [`${A.length(report.corpus.encode.failures)} encode round-trip failure(s)`]
      : []),
    ...(A.isReadonlyArrayNonEmpty(dirtyRuns) ? [`${A.length(dirtyRuns)} generator(s) left the input tree dirty`] : []),
    ...(A.isReadonlyArrayNonEmpty(differences) ? [`${A.length(differences)} difference(s) against the baseline`] : []),
  ];
  if (A.isReadonlyArrayNonEmpty(failures)) {
    yield* Console.error(`FAIL: ${A.join(failures, "; ")}`);
    yield* Effect.forEach(differences, (difference) =>
      Console.error(`  ${difference.subject}.${difference.field}: ${difference.baseline} -> ${difference.current}`)
    );
    return yield* Effect.fail(DifferentialFailure.make({ message: A.join(failures, "; ") }));
  }
  yield* Console.log("OK: no unclassified difference");
});

NodeRuntime.runMain(
  program.pipe(
    Effect.provide(Layer.mergeAll(NodeServices.layer)),
    Effect.catchTag("DifferentialFailure", (error) => Effect.andThen(Console.error(error.message), Effect.fail(error)))
  )
);
