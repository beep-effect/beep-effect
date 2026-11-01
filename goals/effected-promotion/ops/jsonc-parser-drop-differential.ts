/**
 * `jsonc-parser` drop differential (roadmap PR R3b, SPEC W4-o; reuse-ledger #2-#10, #12, #13, #226, #255, #274,
 * #284, #306).
 *
 * R3b moves every remaining `jsonc-parser` importer in `@beep/repo-cli` and `@beep/repo-configs` onto `@beep/jsonc`
 * and drops the dependency from both manifests and the root devDependencies. The kit's `JsoncFormatter.format` became
 * a token-for-token port of `jsonc-parser` 3.3.1 `format`, and `JsoncModifier.modifyWithFormatting` a port of its
 * `modify`, so the repo-cli editing facade and pretty JSON renderer keep their bytes. Five legs prove it, each
 * comparing a frozen copy of the retired `jsonc-parser` call with the site's current code:
 *
 * 1. **format** (byte parity): `renderPrettyCommandJson` (the owner the five Skills `format` + `applyEdits` copies
 *    collapsed onto) against the frozen `jsonc.format` + `applyEdits` + newline, over every corpus document as text
 *    and as compact JSON (the encoded payloads the renderers format).
 * 2. **edit** (byte parity): the facade's `applyJsoncModification` against the frozen `jsonc.modify` + `applyEdits`
 *    with the facade's 2-space options, over every corpus object document: replace, wrap in a new object, delete,
 *    nested insert, nested delete and set, create missing parents, array append, insert, replace and delete, and a
 *    top-level insert. Both throwing is `both-reject`. `PolicyFingerprintJson.modifyJson` runs against a frozen copy
 *    of its `jsonc-parser` body over `turbo.json` and the root `package.json` with the policy-fingerprint edit
 *    shapes (seal task insert after its owned siblings, delete, inputs and dependsOn rewrite, seal script insert).
 * 3. **parse** (value parity): each parse profile the retired sites used (`jsonc-parser` defaults: comments allowed,
 *    trailing commas rejected; trailing commas allowed; strict JSON without comments) read by `jsonc-parser` (every
 *    error a rejection) and by `Jsonc.parseResult` with the site's options, over the corpus plus a negative corpus.
 *    Intended divergences are allowlisted by reason: the kit tolerates a UTF-8 BOM, caps nesting at 256 and keeps
 *    `__proto__` as an own key (all three recorded by R3a). The error texts the sites render are compared too, over
 *    the negative corpus: the allowlist schema's `<code>@<offset>:<length>` list, AllowlistCheck's `parse error at
 *    offset <n>` lines and the Quality `parse error <code> at offset <n>` lines (which now name the code: the kit has
 *    no numeric codes, `intended:code-by-name`). Where both readings reject but recover differently (another code
 *    or token length, a longer or shorter recovered tail), the case is `intended:recovery-detail` only when the
 *    first error sits at the same offset; any other difference is unclassified. The exported site functions run as well: `parseGoalManifestText` over every goal manifest,
 *    `decodeAllowlistDocumentFromJsoncText` over the allowlist and its broken variants, and
 *    `selectOsvPackageOverrideIdsForAudit` over `osv-scanner.toml` and `bun.lock`.
 * 4. **tree** (offset parity): `modelsParseJson` and the trailing-comma tree reading `Knowledge.refs` uses, against
 *    `jsonc-parser` `parseTree`: the node value (`getNodeValue` against `toValue`) and the type, offset and length of
 *    every top-level property value (`findNodeAtLocation` against `find`).
 * 5. **generators**: every repo-cli command whose path runs through a changed site, in its check, dry-run or
 *    report mode, with the lane's CLI against one detached worktree of `--inputs-rev` (the R3a machinery):
 *    `tsconfig-sync --check|--dry-run`, `version-sync --skip-network --dry-run`, `create-package --dry-run`,
 *    `lint policy-fingerprint`, `lint reflection-artifacts`, `laws allowlist-check`, `quality tsgo-rules`,
 *    `goals doctor`, `knowledge refs`, `models check`, `models apply` and `skills lock-plan --json`. Each run records
 *    its exit code and the sha256 of its normalized stdout and stderr, and whether the input tree stayed clean. Two
 *    commands read state outside the input tree (`models check` the operator's harness configuration, `skills
 *    lock-plan` the GitHub API, where a rate-limited 403 turns a vendored entry unresolved), so with `--before` each
 *    reruns, up to three times, until it matches its baseline run, and the report records the attempts.
 *
 * Every leg reads its documents from the owned input worktree, never the running checkout, so the corpus is the
 * same before and after the switch. The corpus is every tracked `*.json` and `*.jsonc` file under 400 KB outside
 * `node_modules`; reports record it by count and sha256 of the repository-relative path list.
 *
 * Usage (from the repo root):
 *
 *   bun goals/effected-promotion/ops/jsonc-parser-drop-differential.ts --inputs-rev <rev> [--out <report.json>]
 *   bun goals/effected-promotion/ops/jsonc-parser-drop-differential.ts --inputs-rev <rev> --before <baseline.json> \
 *     [--out <report.json>]
 *
 * Run once before the switch (`--out`): its site legs must be all `identical`, which proves the frozen copies
 * faithful. Run after it with `--before`: the corpus must match, every leg must hold no unclassified case, and every
 * generator run must match the baseline's exit code and output hashes. A dirty checkout is refused unless
 * `--allow-dirty` is passed (recorded as `dirtyAllowed`). Exit status is non-zero on any failure.
 */
import * as NodeOS from "node:os";
import * as NodeURL from "node:url";
import { Jsonc, JsoncParseOptions } from "@beep/jsonc/Jsonc";
import { parseGoalManifestText } from "@beep/repo-cli/commands/Goals/Inventory";
import { modelsParseJson } from "@beep/repo-cli/commands/Models/Models.spans";
import { selectOsvPackageOverrideIdsForAudit } from "@beep/repo-cli/commands/Quality/Quality.osv-ignore";
import { renderPrettyCommandJson } from "@beep/repo-cli/test/Cli";
import { applyJsoncModification, JsoncModification } from "@beep/repo-cli/test/SharedInternals";
import { decodeAllowlistDocumentFromJsoncText } from "@beep/repo-configs/internal/laws/EffectLawsAllowlistSchemas";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as ChildProcess from "effect/process/ChildProcess";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as jsonc from "jsonc-parser";
import {
  insertAfterOwned,
  modifyJson,
} from "../../../packages/tooling/tool/cli/src/commands/Lint/internal/PolicyFingerprintJson.ts";

const TOOL = "goals/effected-promotion/ops/jsonc-parser-drop-differential.ts";
const repoRoot = NodeURL.fileURLToPath(new URL("../../..", import.meta.url));
const cliEntry = `${repoRoot}packages/tooling/tool/cli/src/bin.ts`;
const MAX_BYTES = 400_000;

const sha256 = (text: string): string => new Bun.CryptoHasher("sha256").update(text).digest("hex");
const sameJson = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);
const flagValue = (flag: string): O.Option<string> =>
  pipe(
    A.findFirstIndex(process.argv, (arg) => arg === flag),
    O.flatMap((index) => A.get(process.argv, index + 1))
  );
const hasFlag = (flag: string): boolean => A.contains(process.argv, flag);

// --- report schema ---------------------------------------------------------------------------------------------

const Case = S.Struct({ leg: S.String, site: S.String, id: S.String, outcome: S.String });
type Case = typeof Case.Type;
const SiteSummary = S.Struct({ site: S.String, cases: S.Finite, outcomes: S.Record(S.String, S.Finite) });
const Leg = S.Struct({
  sites: S.Array(SiteSummary),
  nonIdentical: S.Array(Case),
  unclassified: S.Finite,
});
type Leg = typeof Leg.Type;
const GeneratorRun = S.Struct({
  id: S.String,
  argv: S.Array(S.String),
  exitCode: S.Finite,
  stdoutSha256: S.String,
  stdoutBytes: S.Finite,
  stderrSha256: S.String,
  stderrBytes: S.Finite,
  treeClean: S.Boolean,
  attempts: S.optionalKey(S.Finite),
});
type GeneratorRun = typeof GeneratorRun.Type;
const Comparison = S.Struct({ baseline: S.String, identical: S.Boolean, differing: S.Array(S.String) });
type Comparison = typeof Comparison.Type;
const Report = S.Struct({
  schemaVersion: S.tag(1),
  tool: S.String,
  codeRev: S.String,
  codeDirty: S.Boolean,
  dirtyAllowed: S.optionalKey(S.Boolean),
  inputsRev: S.String,
  corpus: S.Struct({ files: S.Finite, pathsSha256: S.String }),
  format: Leg,
  edit: Leg,
  parse: Leg,
  tree: Leg,
  generators: S.Array(GeneratorRun),
  comparison: S.optionalKey(Comparison),
});
type Report = typeof Report.Type;
const encodeReport = S.encodeEffect(S.fromJsonString(Report, { space: 2 }));
const decodeReport = S.decodeUnknownEffect(S.fromJsonString(Report));

class DifferentialFailure extends S.TaggedError<DifferentialFailure, { readonly brand: unique symbol }>()(
  "DifferentialFailure",
  { message: S.String }
) {}
const failWith = (cause: unknown) => DifferentialFailure.make({ message: String(cause) });

const legOf = (cases: ReadonlyArray<Case>): Leg => {
  const sites = A.dedupe(A.map(cases, (entry) => entry.site));
  return {
    sites: A.map(sites, (site) => {
      const own = A.filter(cases, (entry) => entry.site === site);
      const outcomes: Record<string, number> = {};
      for (const entry of own) outcomes[entry.outcome] = (outcomes[entry.outcome] ?? 0) + 1;
      return { site, cases: A.length(own), outcomes };
    }),
    nonIdentical: A.filter(cases, (entry) => entry.outcome !== "identical"),
    unclassified: A.length(A.filter(cases, (entry) => entry.outcome === "unclassified")),
  };
};

const attempt = <T>(run: () => T): Result.Result<T, string> =>
  Result.try({ try: run, catch: (cause) => String(cause) });

// Byte parity of two attempts: equal output, or both threw.
const byteOutcome = (legacy: Result.Result<string, string>, current: Result.Result<string, string>): string =>
  Result.isFailure(legacy) && Result.isFailure(current)
    ? "both-reject"
    : Result.isSuccess(legacy) && Result.isSuccess(current) && legacy.success === current.success
      ? "identical"
      : "unclassified";

// --- frozen legacy copies --------------------------------------------------------------------------------------

// `renderPrettyCommandJson` and the five Skills copies, frozen at the R3b base revision.
const LEGACY_FORMATTING: jsonc.FormattingOptions = { tabSize: 2, insertSpaces: true };
const legacyPretty = (encoded: string): string =>
  `${jsonc.applyEdits(encoded, jsonc.format(encoded, undefined, LEGACY_FORMATTING))}\n`;

// `internal/cli/Jsonc.ts` `applyJsoncModification`, frozen.
const legacyModify = (content: string, path: jsonc.JSONPath, value: unknown, isArrayInsertion: boolean): string =>
  jsonc.applyEdits(
    content,
    jsonc.modify(content, path, value, {
      formattingOptions: LEGACY_FORMATTING,
      ...(isArrayInsertion ? { isArrayInsertion: true } : {}),
    })
  );

// `Lint/internal/PolicyFingerprintJson.ts` `modifyJson` and its layout, frozen.
const LEGACY_FINGERPRINT_FORMATTING = { formattingOptions: { insertSpaces: true, tabSize: 2, eol: "\n" } } as const;
const JSON_LINE_WIDTH = 80;
const isScalar = (value: unknown) => !P.isObject(value) || value === null;
const trailingWidth = (index: number, length: number) => (index === length - 1 ? 0 : 1);
const legacyRenderArray = (
  values: ReadonlyArray<unknown>,
  indent: string,
  column: number,
  trailing: number
): string => {
  if (A.isReadonlyArrayEmpty(values)) return "[]";
  const inner = `${indent}  `;
  const inline = `[${A.join(
    A.map(values, (item) => legacyRenderJson(item, inner, inner.length, 1)),
    ", "
  )}]`;
  if (A.every(values, isScalar) && column + inline.length + trailing <= JSON_LINE_WIDTH) return inline;
  const lines = A.map(
    values,
    (item, index) => `${inner}${legacyRenderJson(item, inner, inner.length, trailingWidth(index, values.length))}`
  );
  return `[\n${A.join(lines, ",\n")}\n${indent}]`;
};
const legacyRenderObject = (record: Readonly<Record<string, unknown>>, indent: string): string => {
  const entries = R.toEntries(record);
  if (A.isReadonlyArrayEmpty(entries)) return "{}";
  const lines = A.map(entries, ([key, member], index) => {
    const prefix = `${indent}  ${JSON.stringify(key)}: `;
    return `${prefix}${legacyRenderJson(member, `${indent}  `, prefix.length, trailingWidth(index, entries.length))}`;
  });
  return `{\n${A.join(lines, ",\n")}\n${indent}}`;
};
const legacyRenderJson = (value: unknown, indent: string, column: number, trailing: number): string => {
  if (A.isArray(value)) return legacyRenderArray(value, indent, column, trailing);
  if (P.isObject(value) && value !== null)
    return legacyRenderObject(value as Readonly<Record<string, unknown>>, indent);
  return JSON.stringify(value);
};
const legacyRelayout = (text: string, path: jsonc.JSONPath, value: unknown): string => {
  const tree = jsonc.parseTree(text);
  const node = tree === undefined ? undefined : jsonc.findNodeAtLocation(tree, path);
  if (node === undefined) return text;
  const before = Str.slice(0, node.offset)(text);
  const start = O.match(Str.lastIndexOf("\n")(before), { onNone: () => 0, onSome: (index) => index + 1 });
  const indent = O.getOrElse(
    O.map(Str.match(/^ */)(Str.slice(start)(before)), (match) => match[0]),
    () => ""
  );
  const after = Str.slice(node.offset + node.length)(text);
  const trailing = Str.startsWith(",")(Str.trimStart(after)) ? 1 : 0;
  return `${before}${legacyRenderJson(value, indent, node.offset - start, trailing)}${after}`;
};
const legacyModifyJson = (
  text: string,
  path: jsonc.JSONPath,
  value: unknown,
  insertion: ((properties: Array<string>) => number) | undefined
): string => {
  const options =
    insertion === undefined
      ? LEGACY_FINGERPRINT_FORMATTING
      : { ...LEGACY_FINGERPRINT_FORMATTING, getInsertionIndex: insertion };
  const next = jsonc.applyEdits(text, jsonc.modify(text, path, value, options));
  return value === undefined ? next : legacyRelayout(next, path, value);
};

// The jsonc-parser reading of one parse profile: every error a rejection.
const legacyParse = (text: string, options: jsonc.ParseOptions): O.Option<unknown> => {
  const errors: Array<jsonc.ParseError> = [];
  const value: unknown = jsonc.parse(text, errors, options);
  return A.isReadonlyArrayEmpty(errors) ? O.some(value) : O.none();
};
const legacyErrors = (text: string, options: jsonc.ParseOptions): ReadonlyArray<jsonc.ParseError> => {
  const errors: Array<jsonc.ParseError> = [];
  jsonc.parse(text, errors, options);
  return errors;
};

// --- corpus ----------------------------------------------------------------------------------------------------

interface Document {
  readonly path: string;
  readonly text: string;
}

const loadCorpus = Effect.fn("JsoncDrop.loadCorpus")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const listing = yield* git(root, ["ls-files", "--", "*.json", "*.jsonc"]);
  const paths = pipe(
    Str.split(listing, "\n"),
    A.filter((path) => Str.isNonEmpty(path) && !Str.includes("node_modules/")(path)),
    A.sort(Order.String)
  );
  const documents = yield* Effect.forEach(paths, (path) =>
    fs.readFileString(`${root}/${path}`).pipe(
      Effect.map((text) => (text.length <= MAX_BYTES ? O.some<Document>({ path, text }) : O.none<Document>())),
      Effect.orElseSucceed(() => O.none<Document>())
    )
  );
  return A.getSomes(documents);
});

// --- leg 1: format ---------------------------------------------------------------------------------------------

const runFormat = (corpus: ReadonlyArray<Document>): Leg => {
  const cases: Array<Case> = [];
  for (const { path, text } of corpus) {
    cases.push({
      leg: "format",
      site: "renderPrettyCommandJson:text",
      id: path,
      outcome: byteOutcome(
        attempt(() => legacyPretty(text)),
        attempt(() => renderPrettyCommandJson(text))
      ),
    });
    O.map(legacyParse(text, { allowTrailingComma: true }), (value) => {
      const compact = JSON.stringify(value) ?? "";
      cases.push({
        leg: "format",
        site: "renderPrettyCommandJson:compact",
        id: path,
        outcome: byteOutcome(
          attempt(() => legacyPretty(compact)),
          attempt(() => renderPrettyCommandJson(compact))
        ),
      });
    });
  }
  return legOf(cases);
};

// --- leg 2: edit -----------------------------------------------------------------------------------------------

interface EditOp {
  readonly id: string;
  readonly isArrayInsertion: boolean;
  readonly path: ReadonlyArray<string | number>;
  readonly value: unknown;
}

const editOps = (document: Readonly<Record<string, unknown>>): ReadonlyArray<EditOp> => {
  const ops: Array<EditOp> = [];
  const op = (id: string, path: ReadonlyArray<string | number>, value: unknown, isArrayInsertion = false) =>
    ops.push({ id, path, value, isArrayInsertion });
  for (const key of A.take(R.keys(document), 4)) {
    const member = document[key];
    op("replace-same", [key], member);
    op("wrap", [key], { wrapped: member, empty: [], none: {} });
    op("delete", [key], undefined);
    if (P.isObject(member) && member !== null && !A.isArray(member)) {
      const keys = R.keys(member as Record<string, unknown>);
      op("nested-insert", [key, "zzR3bProbe"], ["x"]);
      op("create-parents", [key, "zzR3b", "probe"], { deep: 1 });
      O.map(A.head(keys), (first) => {
        op("nested-delete", [key, first], undefined);
        op("nested-set", [key, first], "r3b");
      });
    }
    if (A.isArray(member)) {
      op("array-append", [key, member.length], "appended", true);
      op("array-insert-first", [key, 0], { inserted: true }, true);
      if (A.isReadonlyArrayNonEmpty(member)) {
        op("array-replace-first", [key, 0], 0);
        op("array-delete-first", [key, 0], undefined);
        op("array-delete-last", [key, member.length - 1], undefined);
      }
    }
  }
  op("insert", ["zzR3bProbe"], { list: [1, {}], text: "x" });
  op("delete-missing", ["zzR3bMissing"], undefined);
  return ops;
};

const isOwnedSeal = (name: string): boolean => Str.startsWith("policy-seal:")(name);

const runEdit = (corpus: ReadonlyArray<Document>): Leg => {
  const cases: Array<Case> = [];
  for (const { path, text } of corpus) {
    const parsed = legacyParse(text, { allowTrailingComma: true });
    if (O.isNone(parsed) || !P.isObject(parsed.value) || parsed.value === null || A.isArray(parsed.value)) continue;
    for (const op of editOps(parsed.value as Record<string, unknown>)) {
      cases.push({
        leg: "edit",
        site: "applyJsoncModification",
        id: `${path}#${op.id}:${JSON.stringify(op.path)}`,
        outcome: byteOutcome(
          attempt(() => legacyModify(text, [...op.path], op.value, op.isArrayInsertion)),
          attempt(() =>
            applyJsoncModification(
              JsoncModification.make({
                content: text,
                path: op.path as never,
                value: op.value,
                ...(op.isArrayInsertion ? { isArrayInsertion: true } : {}),
              })
            )
          )
        ),
      });
    }
  }
  // The policy-fingerprint writer's shapes over the two documents it edits.
  const fingerprintOps: ReadonlyArray<
    readonly [string, string, ReadonlyArray<string>, unknown, ((properties: Array<string>) => number) | undefined]
  > = [
    [
      "turbo.json",
      "seal-insert",
      ["tasks", "policy-seal:r3b-probe"],
      { inputs: ["$TURBO_DEFAULT$"] },
      insertAfterOwned(isOwnedSeal)("policy-seal:r3b-probe"),
    ],
    [
      "turbo.json",
      "seal-insert-first",
      ["tasks", "policy-seal:0000"],
      { cache: true },
      insertAfterOwned(isOwnedSeal)("policy-seal:0000"),
    ],
    ["turbo.json", "task-delete", ["tasks", "build"], undefined, undefined],
    [
      "turbo.json",
      "inputs-rewrite",
      ["tasks", "check", "inputs"],
      ["$TURBO_DEFAULT$", "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"],
      undefined,
    ],
    ["turbo.json", "depends-rewrite", ["tasks", "build", "dependsOn"], ["^build", "policy-seal:r3b-probe"], undefined],
    [
      "package.json",
      "script-insert",
      ["scripts", "policy-seal:r3b-probe"],
      "true",
      insertAfterOwned(isOwnedSeal)("policy-seal:r3b-probe"),
    ],
    ["package.json", "script-delete", ["scripts", "build"], undefined, undefined],
  ];
  for (const [file, id, path, value, insertion] of fingerprintOps) {
    const document = A.findFirst(corpus, (entry) => entry.path === file);
    if (O.isNone(document)) continue;
    const text = document.value.text;
    cases.push({
      leg: "edit",
      site: "PolicyFingerprintJson.modifyJson",
      id: `${file}#${id}`,
      outcome: byteOutcome(
        attempt(() => legacyModifyJson(text, [...path], value, insertion)),
        attempt(() => modifyJson({ text, path, value, insertion }))
      ),
    });
  }
  return legOf(cases);
};

// --- leg 3: parse ----------------------------------------------------------------------------------------------

interface Profile {
  readonly id: string;
  readonly kit: JsoncParseOptions;
  readonly legacy: jsonc.ParseOptions;
}

const PROFILES: ReadonlyArray<Profile> = [
  // Goals/Inventory, Quality FallowQuality (jsonc-parser defaults).
  { id: "default", legacy: {}, kit: JsoncParseOptions.make({ allowTrailingComma: false }) },
  // AllowlistCheck, the allowlist schema, Quality (tsgo-rules, github-checks), osv-ignore, PolicyFingerprint.
  { id: "trailing-comma", legacy: { allowTrailingComma: true }, kit: JsoncParseOptions.make({}) },
  // Models.spans and the generated Vitest aliases.
  {
    id: "strict-json",
    legacy: { allowTrailingComma: false, disallowComments: true },
    kit: JsoncParseOptions.make({ allowTrailingComma: false, disallowComments: true }),
  },
];

const NEGATIVE: ReadonlyArray<readonly [string, string]> = [
  ["empty", ""],
  ["whitespace", "   \n"],
  ["trailing-comma", '{"a":1,}'],
  ["leading-comma", "[,1]"],
  ["comment", '{"a":1 // c\n}'],
  ["block-comment", '/* c */ {"a":1}'],
  ["unterminated-string", '{"a":"x}'],
  ["unterminated-object", '{"a":1'],
  ["unterminated-comment", '{"a":1} /* c'],
  ["trailing-content", '{"a":1} x'],
  ["bad-escape", '{"a":"\\q"}'],
  ["hex-number", '{"a":0x10}'],
  ["nan", '{"a":NaN}'],
  ["missing-colon", '{"a" 1}'],
  ["missing-comma", '{"a":1 "b":2}'],
  ["duplicate-key", '{"a":1,"a":2}'],
  ["bom", '﻿{"a":1}'],
  ["proto", '{"__proto__":{"x":1}}'],
  ["deep", `${Str.repeat(300)("[")}${Str.repeat(300)("]")}`],
  ["control-character", '{"a":"\u0001"}'],
];

// Intended divergences of the kit's reading, by negative-corpus id (R3a recorded the same three).
const INTENDED_PARSE: Readonly<Record<string, string>> = {
  bom: "intended:bom-tolerance",
  deep: "intended:nesting-cap",
  proto: "intended:proto-own-key",
};

const parseOutcome = (id: string, legacy: O.Option<unknown>, kit: O.Option<unknown>): string => {
  if (O.isNone(legacy) && O.isNone(kit)) return "both-reject";
  if (O.isSome(legacy) && O.isSome(kit) && sameJson(legacy.value, kit.value)) return "identical";
  return INTENDED_PARSE[id] ?? "unclassified";
};

const allowlistMessage = (errors: ReadonlyArray<jsonc.ParseError>): string =>
  `Allowlist JSONC parse error (${A.join(
    A.map(errors, (error) => `${jsonc.printParseErrorCode(error.error)}@${error.offset}:${error.length}`),
    ", "
  )}).`;

const runParse = Effect.fn("JsoncDrop.runParse")(function* (root: string, corpus: ReadonlyArray<Document>) {
  const fs = yield* FileSystem.FileSystem;
  const cases: Array<Case> = [];
  const inputs = A.appendAll(
    A.map(corpus, (document) => [document.path, document.text] as const),
    A.map(NEGATIVE, ([id, text]) => [id, text] as const)
  );
  for (const profile of PROFILES) {
    for (const [id, text] of inputs) {
      cases.push({
        leg: "parse",
        site: `profile:${profile.id}`,
        id,
        outcome: parseOutcome(
          id,
          legacyParse(text, profile.legacy),
          Result.getSuccess(Jsonc.parseResult(text, profile.kit))
        ),
      });
    }
  }
  // Error texts the sites render, over the negative corpus.
  for (const [id, text] of NEGATIVE) {
    const legacy = legacyErrors(text, { allowTrailingComma: true });
    if (A.isReadonlyArrayEmpty(legacy) || id in INTENDED_PARSE) continue;
    const kit = Result.match(Jsonc.parseResult(text), { onFailure: (error) => error.errors, onSuccess: () => [] });
    const kitAllowlist = `Allowlist JSONC parse error (${A.join(
      A.map(kit, (detail) => `${detail.code}@${detail.offset}:${detail.length}`),
      ", "
    )}).`;
    // Both readings reject, so the text differs only in how each parser recovers: the error list may differ in
    // code, token length and recovered tail, but its first error must sit at the same offset.
    const sameFirstOffset =
      O.getOrUndefined(O.map(A.head(legacy), (error) => error.offset)) ===
      O.getOrUndefined(O.map(A.head(kit), (detail) => detail.offset));
    const recovered = (identical: boolean): string =>
      identical ? "identical" : sameFirstOffset ? "intended:recovery-detail" : "unclassified";
    cases.push({
      leg: "parse",
      site: "error-text:allowlist",
      id,
      outcome: recovered(allowlistMessage(legacy) === kitAllowlist),
    });
    const offsets = (values: ReadonlyArray<{ readonly offset: number }>) =>
      A.join(
        A.map(values, (value) => `parse error at offset ${value.offset}`),
        "\n"
      );
    cases.push({
      leg: "parse",
      site: "error-text:allowlist-check",
      id,
      outcome: recovered(offsets(legacy) === offsets(kit)),
    });
    const codes = (values: ReadonlyArray<string>) => A.join(values, ",");
    const sameCodes =
      codes(A.map(legacy, (error) => jsonc.printParseErrorCode(error.error))) ===
        codes(A.map(kit, (detail) => detail.code)) && offsets(legacy) === offsets(kit);
    cases.push({
      leg: "parse",
      site: "error-text:quality",
      id,
      // The Quality lines print the code: a number under jsonc-parser, the code's name under the kit.
      outcome: sameCodes ? "intended:code-by-name" : sameFirstOffset ? "intended:recovery-detail" : "unclassified",
    });
  }
  // The exported site functions.
  for (const { path, text } of A.filter(corpus, (document) =>
    /^goals\/[^/]+\/ops\/manifest\.json$/.test(document.path)
  )) {
    const legacy = O.filter(legacyParse(text, {}), (value) => P.isObject(value) && value !== null && !A.isArray(value));
    cases.push({
      leg: "parse",
      site: "parseGoalManifestText",
      id: path,
      outcome: parseOutcome(path, legacy, parseGoalManifestText(text)),
    });
  }
  const allowlistText = yield* fs
    .readFileString(`${root}/standards/effect-laws.allowlist.jsonc`)
    .pipe(Effect.mapError(failWith));
  const allowlistVariants: ReadonlyArray<readonly [string, string]> = [
    ["allowlist", allowlistText],
    ["allowlist-truncated", Str.slice(0, Math.floor(allowlistText.length / 2))(allowlistText)],
    ["allowlist-garbage", `${allowlistText}\n}}`],
    ["allowlist-missing-comma", Str.replace('"', '"x" "')(allowlistText)],
  ];
  for (const [id, text] of allowlistVariants) {
    const legacyErr = legacyErrors(text, { allowTrailingComma: true });
    const current = yield* Effect.result(decodeAllowlistDocumentFromJsoncText(text));
    const kitErr = Result.match(Jsonc.parseResult(text), { onFailure: (error) => error.errors, onSuccess: () => [] });
    const sameFirstOffset =
      O.getOrUndefined(O.map(A.head(legacyErr), (error) => error.offset)) ===
      O.getOrUndefined(O.map(A.head(kitErr), (detail) => detail.offset));
    const outcome = A.isReadonlyArrayEmpty(legacyErr)
      ? Result.isSuccess(current)
        ? "identical"
        : "unclassified"
      : Result.isFailure(current) && Str.includes(allowlistMessage(legacyErr))(current.failure.message)
        ? "identical"
        : Result.isFailure(current) &&
            Str.includes("Allowlist JSONC parse error (")(current.failure.message) &&
            sameFirstOffset
          ? "intended:recovery-detail"
          : "unclassified";
    cases.push({ leg: "parse", site: "decodeAllowlistDocumentFromJsoncText", id, outcome });
  }
  const osvConfig = yield* fs.readFileString(`${root}/osv-scanner.toml`).pipe(Effect.mapError(failWith));
  const lockfile = yield* fs.readFileString(`${root}/bun.lock`).pipe(Effect.mapError(failWith));
  const now = DateTime.makeUnsafe("2026-10-31T00:00:00Z");
  for (const [id, lock] of [
    ["bun.lock", lockfile],
    ["bun.lock-broken", `${lockfile}\n}`],
  ] as const) {
    const legacyLock = legacyParse(lock, { allowTrailingComma: true });
    const legacyIds = O.isSome(legacyLock) ? "parsed" : "rejected";
    const current = selectOsvPackageOverrideIdsForAudit(osvConfig, lock, now);
    cases.push({
      leg: "parse",
      site: "selectOsvPackageOverrideIdsForAudit",
      id: `${id}:${legacyIds}:${A.length(current)}`,
      outcome:
        legacyIds === "rejected"
          ? A.isReadonlyArrayEmpty(current)
            ? "both-reject"
            : "unclassified"
          : parseOutcome(id, legacyLock, Result.getSuccess(Jsonc.parseResult(lock))),
    });
  }
  return legOf(cases);
});

// --- leg 4: tree -----------------------------------------------------------------------------------------------

interface TreeShape {
  readonly length: number;
  readonly offset: number;
  readonly type: string;
}

// Node value and the top-level property value spans of a `jsonc-parser` tree.
const legacyTree = (text: string, options: jsonc.ParseOptions): O.Option<string> => {
  const errors: Array<jsonc.ParseError> = [];
  const tree = jsonc.parseTree(text, errors, options);
  if (tree === undefined || A.isReadonlyArrayNonEmpty(errors)) return O.none();
  const spans: Array<TreeShape> = [];
  for (const property of tree.children ?? []) {
    const key = property.children?.[0]?.value;
    if (P.isString(key)) {
      const node = jsonc.findNodeAtLocation(tree, [key]);
      if (node !== undefined) spans.push({ type: node.type, offset: node.offset, length: node.length });
    }
  }
  return O.some(JSON.stringify({ value: jsonc.getNodeValue(tree), spans }));
};

interface KitNode {
  readonly children?: ReadonlyArray<KitNode>;
  readonly find: (path: ReadonlyArray<string>) => O.Option<KitNode>;
  readonly length: number;
  readonly offset: number;
  readonly toValue: () => unknown;
  readonly type: string;
  readonly value?: unknown;
}

const isKitNode = (value: unknown): value is KitNode => P.isObject(value) && P.hasProperty(value, "toValue");

const kitTreeShape = (tree: KitNode): string => {
  const spans: Array<TreeShape> = [];
  for (const property of tree.children ?? []) {
    const key = property.children?.[0]?.value;
    if (P.isString(key)) {
      O.map(tree.find([key]), (node) => spans.push({ type: node.type, offset: node.offset, length: node.length }));
    }
  }
  return JSON.stringify({ value: tree.toValue(), spans });
};

// Before the switch `modelsParseJson` returned a `jsonc-parser` node; read either shape.
const anyTreeShape = (tree: unknown): string =>
  isKitNode(tree)
    ? kitTreeShape(tree)
    : O.getOrElse(
        O.map(O.some(tree as jsonc.Node), (node) => {
          const spans: Array<TreeShape> = [];
          for (const property of node.children ?? []) {
            const key = property.children?.[0]?.value;
            if (P.isString(key)) {
              const found = jsonc.findNodeAtLocation(node, [key]);
              if (found !== undefined) spans.push({ type: found.type, offset: found.offset, length: found.length });
            }
          }
          return JSON.stringify({ value: jsonc.getNodeValue(node), spans });
        }),
        () => ""
      );

const runTree = Effect.fn("JsoncDrop.runTree")(function* (corpus: ReadonlyArray<Document>) {
  const cases: Array<Case> = [];
  for (const { path, text } of corpus) {
    const strictLegacy = legacyTree(text, { allowTrailingComma: false, disallowComments: true });
    const strictCurrent = yield* Effect.option(Effect.map(modelsParseJson(text), anyTreeShape));
    cases.push({
      leg: "tree",
      site: "modelsParseJson",
      id: path,
      outcome:
        O.isNone(strictLegacy) && O.isNone(strictCurrent)
          ? "both-reject"
          : O.isSome(strictLegacy) && O.isSome(strictCurrent) && strictLegacy.value === strictCurrent.value
            ? "identical"
            : "unclassified",
    });
    // Knowledge.refs reads the evidence documents with trailing commas allowed.
    const trailingLegacy = legacyTree(text, { allowTrailingComma: true });
    const trailingKit = O.map(O.flatten(Result.getSuccess(Jsonc.parseTreeResult(text))), (tree) =>
      kitTreeShape(tree as unknown as KitNode)
    );
    cases.push({
      leg: "tree",
      site: "Knowledge.refs:parseTree",
      id: path,
      outcome:
        O.isNone(trailingLegacy) && O.isNone(trailingKit)
          ? "both-reject"
          : O.isSome(trailingLegacy) && O.isSome(trailingKit) && trailingLegacy.value === trailingKit.value
            ? "identical"
            : "unclassified",
    });
  }
  return legOf(cases);
});

// --- leg 5: generators (the R3a owned-worktree machinery) ------------------------------------------------------

interface Generator {
  readonly argv: ReadonlyArray<string>;
  readonly id: string;
  // Why the command's output can change between two runs of the same code: it is rerun, up to
  // VOLATILE_ATTEMPTS times, until it matches the baseline, and the attempts are recorded.
  readonly volatile?: string;
}

const VOLATILE_ATTEMPTS = 3;

const GENERATORS: ReadonlyArray<Generator> = [
  { id: "tsconfig-sync-check", argv: ["tsconfig-sync", "--check", "--verbose"] },
  { id: "tsconfig-sync-dry-run", argv: ["tsconfig-sync", "--dry-run", "--verbose"] },
  { id: "version-sync-dry-run", argv: ["version-sync", "--skip-network", "--dry-run"] },
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
      "R3b JSONC parity probe",
      "r3b-jsonc-parity-probe",
    ],
  },
  { id: "lint-policy-fingerprint", argv: ["lint", "policy-fingerprint"] },
  { id: "lint-reflection-artifacts", argv: ["lint", "reflection-artifacts"] },
  { id: "laws-allowlist-check", argv: ["laws", "allowlist-check"] },
  { id: "quality-tsgo-rules", argv: ["quality", "tsgo-rules"] },
  { id: "goals-doctor", argv: ["goals", "doctor"] },
  { id: "knowledge-refs", argv: ["knowledge", "refs"] },
  {
    id: "models-check",
    argv: ["models", "check"],
    volatile: "reads the operator's live harness configuration and model catalog",
  },
  { id: "models-apply", argv: ["models", "apply"] },
  {
    id: "skills-lock-plan-json",
    argv: ["skills", "lock-plan", "--json"],
    volatile: "fetches the pinned upstream trees from api.github.com; a 403 turns a vendored entry unresolved",
  },
];

const collectText = <E>(stream: Stream.Stream<Uint8Array, E>) => stream.pipe(Stream.decodeText(), Stream.mkString);

const git = Effect.fn("JsoncDrop.git")(function* (cwd: string, args: ReadonlyArray<string>) {
  const result = yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* ChildProcess.make("git", [...args], {
        cwd,
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
  if (Number(result.exitCode) !== 0) {
    return yield* DifferentialFailure.make({
      message: `git ${A.join(args, " ")} (in ${cwd}) exited ${result.exitCode}: ${Str.trim(result.stderr)}`,
    });
  }
  return result.stdout;
});

const revParse = (cwd: string) => Effect.map(git(cwd, ["rev-parse", "HEAD"]), Str.trim);

// The input worktree carries a `node_modules` symlink to the lane's install; everything else counts.
const isDirty = (cwd: string) =>
  Effect.map(git(cwd, ["status", "--porcelain"]), (status) =>
    pipe(
      Str.split(status, "\n"),
      A.map(Str.trim),
      A.some((line) => !Str.isEmpty(line) && line !== "?? node_modules")
    )
  );

const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;
const DURATION = /\b\d+(?:\.\d+)?\s?(?:ms|s|min)\b/g;
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

const INPUTS_PARENT = `${NodeOS.homedir()}/.cache/beep/jsonc-parser-drop-differential`;

interface OwnedInputs {
  readonly root: string;
}

const logRelease = (what: string) =>
  Effect.catchCause((cause: Cause.Cause<unknown>) => Console.error(`cleanup: ${what} failed: ${Cause.pretty(cause)}`));

// A fresh holder directory with a detached worktree of `rev` inside it, removed when the scope closes; the only
// tree a generator run may change, restore or remove.
const ownedInputs = Effect.fn("JsoncDrop.ownedInputs")(function* (rev: string) {
  const fs = yield* FileSystem.FileSystem;
  const commit = yield* Effect.map(git(repoRoot, ["rev-parse", "--verify", `${rev}^{commit}`]), Str.trim);
  yield* fs.makeDirectory(INPUTS_PARENT, { recursive: true }).pipe(Effect.mapError(failWith));
  const holder = yield* Effect.acquireRelease(
    fs.makeTempDirectory({ directory: INPUTS_PARENT, prefix: "inputs-" }).pipe(Effect.mapError(failWith)),
    (path) =>
      fs
        .remove(path, { recursive: true, force: true })
        .pipe(Effect.andThen(git(repoRoot, ["worktree", "prune"])), logRelease(`removing ${path}`))
  );
  const root = `${holder}/inputs`;
  yield* Effect.acquireRelease(Effect.as(git(repoRoot, ["worktree", "add", "--detach", root, commit]), root), (path) =>
    git(repoRoot, ["worktree", "remove", "--force", path]).pipe(logRelease(`git worktree remove ${path}`))
  );
  yield* fs.symlink(`${repoRoot}node_modules`, `${root}/node_modules`).pipe(Effect.mapError(failWith));
  yield* Console.log(`inputs: detached worktree of ${commit} at ${root} (removed at exit)`);
  return { root } satisfies OwnedInputs;
});

const restoreOwnedInputs = Effect.fn("JsoncDrop.restoreOwnedInputs")(function* (inputs: OwnedInputs) {
  yield* git(inputs.root, ["reset", "--hard", "--quiet", "HEAD"]);
  yield* git(inputs.root, ["clean", "-fd", "--quiet", "-e", "node_modules"]);
  if (yield* isDirty(inputs.root)) {
    return yield* DifferentialFailure.make({ message: `${inputs.root} is still dirty after the restore` });
  }
});

const runGenerator = Effect.fn("JsoncDrop.runGenerator")(function* (inputs: OwnedInputs, generator: Generator) {
  const result = yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* ChildProcess.make("bun", [cliEntry, ...generator.argv], {
        cwd: inputs.root,
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
  const clean = normalize(inputs.root);
  const stdout = clean(result.stdout);
  const stderr = clean(result.stderr);
  const treeClean = !(yield* isDirty(inputs.root));
  if (!treeClean) {
    yield* restoreOwnedInputs(inputs);
  }
  const run: GeneratorRun = {
    id: generator.id,
    argv: [...generator.argv],
    exitCode: Number(result.exitCode),
    stdoutSha256: sha256(stdout),
    stdoutBytes: Buffer.byteLength(stdout),
    stderrSha256: sha256(stderr),
    stderrBytes: Buffer.byteLength(stderr),
    treeClean,
  };
  yield* Console.log(
    `${run.id}: exit ${run.exitCode}, stdout ${run.stdoutBytes} B ${Str.slice(0, 12)(run.stdoutSha256)}, stderr ${run.stderrBytes} B, tree ${treeClean ? "clean" : "DIRTY"}`
  );
  return run;
});

// A volatile generator reruns until its output matches the baseline run, at most VOLATILE_ATTEMPTS times.
const runVolatile = (
  inputs: OwnedInputs,
  generator: Generator,
  expected: GeneratorRun,
  attempt: number
): ReturnType<typeof runGenerator> =>
  Effect.flatMap(runGenerator(inputs, generator), (run) =>
    run.stdoutSha256 === expected.stdoutSha256 &&
    run.stderrSha256 === expected.stderrSha256 &&
    run.exitCode === expected.exitCode
      ? Effect.succeed({ ...run, attempts: attempt })
      : attempt < VOLATILE_ATTEMPTS
        ? Effect.andThen(
            Console.log(`${generator.id}: differs from the baseline (${generator.volatile}); rerunning`),
            runVolatile(inputs, generator, expected, attempt + 1)
          )
        : Effect.succeed({ ...run, attempts: attempt })
  );

// --- compare ---------------------------------------------------------------------------------------------------

const compareReports = (baseline: Report, current: Report): Comparison => {
  const differing: Array<string> = [];
  if (baseline.inputsRev !== current.inputsRev)
    differing.push(`inputsRev ${baseline.inputsRev} -> ${current.inputsRev}`);
  if (baseline.corpus.pathsSha256 !== current.corpus.pathsSha256) differing.push("corpus path list");
  for (const leg of ["format", "edit"] as const) {
    if (A.isReadonlyArrayNonEmpty(baseline[leg].nonIdentical)) {
      differing.push(`baseline ${leg} leg is not all identical (frozen copies unfaithful)`);
    }
  }
  for (const before of baseline.generators) {
    const after = A.findFirst(current.generators, (run) => run.id === before.id);
    if (O.isNone(after)) {
      differing.push(`${before.id}: missing`);
      continue;
    }
    for (const field of ["exitCode", "stdoutSha256", "stderrSha256", "treeClean"] as const) {
      if (before[field] !== after.value[field]) {
        differing.push(`${before.id}.${field}: ${String(before[field])} -> ${String(after.value[field])}`);
      }
    }
  }
  return { baseline: "", identical: A.isReadonlyArrayEmpty(differing), differing };
};

// --- main ------------------------------------------------------------------------------------------------------

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const codeRev = yield* revParse(repoRoot);
  const codeDirty = yield* isDirty(repoRoot);
  const dirtyAllowed = hasFlag("--allow-dirty");
  if (codeDirty && !dirtyAllowed) {
    return yield* DifferentialFailure.make({
      message: `${repoRoot} is dirty; commit first so codeRev names the measured code, or pass --allow-dirty`,
    });
  }
  const inputsRev = yield* O.match(flagValue("--inputs-rev"), {
    onNone: () => Effect.fail(DifferentialFailure.make({ message: "pass --inputs-rev <rev>" })),
    onSome: Effect.succeed,
  });
  const before = flagValue("--before");
  const baseline = yield* O.match(before, {
    onNone: () => Effect.succeed(O.none<Report>()),
    onSome: (path) =>
      fs.readFileString(path).pipe(Effect.mapError(failWith), Effect.flatMap(decodeReport), Effect.map(O.some)),
  });
  const measured = yield* Effect.scoped(
    Effect.gen(function* () {
      const inputs = yield* ownedInputs(inputsRev);
      const corpus = yield* loadCorpus(inputs.root);
      yield* Console.log(`corpus: ${A.length(corpus)} documents`);
      const format = runFormat(corpus);
      const edit = runEdit(corpus);
      const parse = yield* runParse(inputs.root, corpus);
      const tree = yield* runTree(corpus);
      const generators = yield* Effect.forEach(GENERATORS, (generator) =>
        O.match(
          O.flatMap(
            O.filter(baseline, () => generator.volatile !== undefined),
            (report) => A.findFirst(report.generators, (run) => run.id === generator.id)
          ),
          {
            onNone: () => runGenerator(inputs, generator),
            onSome: (expected) => runVolatile(inputs, generator, expected, 1),
          }
        )
      );
      return {
        inputsRev: yield* revParse(inputs.root),
        corpus: {
          files: A.length(corpus),
          pathsSha256: sha256(
            A.join(
              A.map(corpus, (entry) => entry.path),
              "\n"
            )
          ),
        },
        format,
        edit,
        parse,
        tree,
        generators,
      };
    })
  );
  const base: Report = {
    schemaVersion: 1,
    tool: TOOL,
    codeRev,
    codeDirty,
    ...(dirtyAllowed ? { dirtyAllowed } : {}),
    ...measured,
  };
  const report: Report = O.match(O.all({ path: before, report: baseline }), {
    onNone: () => base,
    onSome: ({ path, report: prior }) => ({ ...base, comparison: { ...compareReports(prior, base), baseline: path } }),
  });
  const encoded = yield* encodeReport(report);
  yield* O.match(flagValue("--out"), {
    onNone: () => Console.log(encoded),
    onSome: (out) =>
      fs
        .writeFileString(out, `${encoded}\n`)
        .pipe(Effect.mapError(failWith), Effect.andThen(Console.log(`report written to ${out}`))),
  });
  const failures = [
    ...A.flatMap(["format", "edit", "parse", "tree"] as const, (leg) =>
      report[leg].unclassified > 0 ? [`${report[leg].unclassified} unclassified ${leg} case(s)`] : []
    ),
    ...(A.some(report.generators, (run) => !run.treeClean) ? ["a generator left the input tree dirty"] : []),
    ...(report.comparison !== undefined && !report.comparison.identical
      ? [`${A.length(report.comparison.differing)} difference(s) against the baseline`]
      : []),
  ];
  if (A.isReadonlyArrayNonEmpty(failures)) {
    yield* Console.error(`FAIL: ${A.join(failures, "; ")}`);
    for (const leg of ["format", "edit", "parse", "tree"] as const) {
      for (const entry of A.take(
        A.filter(report[leg].nonIdentical, (entry) => entry.outcome === "unclassified"),
        20
      )) {
        yield* Console.error(`  ${entry.leg} ${entry.site} ${entry.id}`);
      }
    }
    for (const line of report.comparison?.differing ?? []) yield* Console.error(`  ${line}`);
    return yield* DifferentialFailure.make({ message: A.join(failures, "; ") });
  }
  yield* Console.log("OK: no unclassified difference");
});

NodeRuntime.runMain(
  program.pipe(
    Effect.provide(Layer.mergeAll(NodeServices.layer)),
    Effect.catchTag("DifferentialFailure", (error) => Effect.andThen(Console.error(error.message), Effect.fail(error)))
  )
);
