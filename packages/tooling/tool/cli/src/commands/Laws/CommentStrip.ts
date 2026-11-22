/**
 * Comment-law strip: the ledger of banned comments and the vote-gated apply with an AST-identity proof.
 *
 * **Details**
 *
 * `runCommentLedger` writes one JSONL row per banned comment under a path,
 * each with a stable `cid` and a protection reason. `runCommentApply` reads
 * that ledger and two or more vote files, deletes only the rows the votes
 * agree on, and proves each touched file: the oxc ESTree program before and
 * after, with positions dropped and JSX children compared under JSX
 * whitespace rules, must be identical, or the file is left as it was.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Git } from "@beep/git/Git";
import { GrammarNode, isBannedCommentKind } from "@beep/lint-rules/comment-grammar";
import { findRepoRoot } from "@beep/repo-utils";
import { sha256Hex } from "@beep/repo-utils/Sha256Hex";
import { A } from "@beep/utils";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as FileSystem from "effect/FileSystem";
import * as F from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { parseSync } from "oxc-parser";
import {
  commentLawFiles,
  commentPackageRootOf,
  commentScopeOf,
  isInCommentScope,
  parseCommentSource,
} from "./CommentLaw.ts";
import {
  CommentApplySummary,
  CommentLedgerRow,
  CommentLedgerSummary,
  CommentRefusal,
  CommentVote,
} from "./CommentStrip.model.ts";
import { CommentLawExecutionError } from "./Laws.errors.ts";
import type { ClassifiedComment } from "@beep/lint-rules/comment-grammar";
import type * as Digest from "effect/crypto/Digest";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { CommentApplyOptions, CommentRefusalReason, CommentVoteCode } from "./CommentStrip.model.ts";

/**
 * Repository-relative directory that holds the strip ledgers; it is gitignored.
 *
 * **Example** (Locate a ledger)
 *
 * ```ts
 * import { COMMENT_LEDGER_DIR } from "@beep/repo-cli/commands/Laws/CommentStrip"
 *
 * console.log(`${COMMENT_LEDGER_DIR}/packages-foo.jsonl`) // ".beep/comment-law/ledger/packages-foo.jsonl"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const COMMENT_LEDGER_DIR = ".beep/comment-law/ledger";

const ANCHOR_LENGTH = 60;
const TOOL_TAG = /@(?:since|category|internal|public|expected-unused|ignore|deprecated)\b/;
const ISSUE_URL = /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/(?:issues|pull)\/\d+$/;
const DECISION_FILE = /^decisions\/\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]*\.md$/;
const BLANK = /^\s*$/;
const POSITION_KEYS = HashSet.make("start", "end", "range", "loc");
const EMPTY_BLOCK_TYPES = HashSet.make("BlockStatement", "StaticBlock", "ClassBody", "TSModuleBlock");
const JSX_PARENT_TYPES = HashSet.make("JSXElement", "JSXFragment");
const DeletableCode = S.Literals(["T", "S", "X", "D", "G"]);
const isDeletableCode = S.is(DeletableCode);
const isNode = S.is(GrammarNode);
const decodeLedgerLine = S.decodeUnknownEffect(S.fromJsonString(CommentLedgerRow));
const encodeLedgerLine = S.encodeEffect(S.fromJsonString(CommentLedgerRow));
const decodeVote = S.decodeUnknownEffect(CommentVote);

type CommentStripServices =
  | Digest.Digest
  | FileSystem.FileSystem
  | Path.Path
  | ChildProcessSpawner.ChildProcessSpawner
  | SecureRandom.SecureRandom
  | Git;

interface ParsedSource {
  readonly comments: ReadonlyArray<ClassifiedComment>;
  readonly errors: number;
  readonly file: string;
  readonly program: unknown;
  readonly text: string;
}

interface Located {
  readonly comment: ClassifiedComment;
  readonly group: string;
  readonly row: CommentLedgerRow;
}

interface Span {
  readonly end: number;
  readonly replacement: string;
  readonly start: number;
}

interface ApplyContext {
  readonly ballots: ReadonlyArray<HashMap.HashMap<string, CommentVote>>;
  readonly committed: HashSet.HashSet<string>;
  readonly realRoot: string;
  readonly roots: ReadonlyArray<string>;
}

interface FileOutcome {
  readonly deleted: number;
  readonly refusals: ReadonlyArray<CommentRefusal>;
  readonly touched: O.Option<string>;
}

const fieldOf = (node: GrammarNode, key: string): unknown =>
  (node as unknown as Readonly<Record<string, unknown>>)[key];

const childValues = (value: unknown): ReadonlyArray<unknown> =>
  A.isArray(value) ? value : P.isObject(value) ? R.values(value as Readonly<Record<string, unknown>>) : [];

const nodesWhere = (value: unknown, keep: (node: GrammarNode) => boolean): ReadonlyArray<GrammarNode> =>
  A.appendAll(
    isNode(value) && keep(value) ? [value] : [],
    A.flatMap(childValues(value), (child) => nodesWhere(child, keep))
  );

const isEmptyBlock = (node: GrammarNode): boolean => {
  const body = fieldOf(node, "body");
  return HashSet.has(EMPTY_BLOCK_TYPES, node.type) && A.isArray(body) && A.isReadonlyArrayEmpty(body);
};

const isEmptyJsxContainer = (node: GrammarNode): boolean =>
  node.type === "JSXExpressionContainer" &&
  O.exists(O.liftPredicate(fieldOf(node, "expression"), isNode), (inner) => inner.type === "JSXEmptyExpression");

const contains = (outer: GrammarNode, comment: ClassifiedComment): boolean =>
  outer.start < comment.start && comment.end <= outer.end;

const parseSource = (file: string, text: string): ParsedSource => ({
  ...parseCommentSource({ file, text }),
  file,
  text,
});

const lineOf = (text: string, offset: number): number => A.length(Str.split(Str.slice(0, offset)(text), "\n"));

const isBlankBetween = (text: string, from: number, to: number): boolean => BLANK.test(Str.slice(from, to)(text));

const anchorAfter = (source: ParsedSource, from: number): string => {
  const skips = HashMap.fromIterable(A.map(source.comments, (comment) => [comment.start, comment.end] as const));
  let anchor = "";
  let offset = from;
  while (offset < Str.length(source.text) && Str.length(anchor) < ANCHOR_LENGTH) {
    const skip = HashMap.get(skips, offset);
    const character = Str.slice(offset, offset + 1)(source.text);
    anchor = O.isSome(skip) || BLANK.test(character) ? anchor : `${anchor}${character}`;
    offset = O.getOrElse(skip, () => offset + 1);
  }
  return anchor;
};

const isJsDocBlock = (comment: ClassifiedComment): boolean =>
  comment.type === "Block" && Str.startsWith("*")(comment.value);

const stackedUnderJsDoc = (source: ParsedSource, comment: ClassifiedComment, index: number): boolean =>
  O.exists(
    A.get(source.comments, index - 1),
    (previous) =>
      isBlankBetween(source.text, previous.end, comment.start) &&
      (isJsDocBlock(previous) || stackedUnderJsDoc(source, previous, index - 1))
  );

const continuesDirective = (source: ParsedSource, index: number, comment: ClassifiedComment): boolean =>
  O.exists(
    A.get(source.comments, index - 1),
    (previous) =>
      previous.kind === "directive" &&
      previous.type === "Line" &&
      comment.type === "Line" &&
      isBlankBetween(source.text, previous.end, comment.start) &&
      lineOf(source.text, comment.start) - lineOf(source.text, previous.end) === 1
  );

interface ProtectionProbe {
  readonly comment: ClassifiedComment;
  readonly emptyBlocks: ReadonlyArray<GrammarNode>;
  readonly index: number;
  readonly source: ParsedSource;
}

type ProtectionRule = (probe: ProtectionProbe) => O.Option<string>;

const protectWhen =
  (reason: string, test: (probe: ProtectionProbe) => boolean): ProtectionRule =>
  (probe) =>
    test(probe) ? O.some(reason) : O.none();

const toolTagRule: ProtectionRule = ({ comment }) =>
  comment.type === "Block"
    ? O.map(O.fromNullishOr(TOOL_TAG.exec(comment.value)), (match) => `tool-read tag ${match[0]}`)
    : O.none();

const PROTECTION_RULES: ReadonlyArray<ProtectionRule> = [
  toolTagRule,
  protectWhen("holds a code fence", ({ comment }) => Str.includes("```")(comment.value)),
  protectWhen("only content of a block", ({ comment, emptyBlocks }) =>
    A.some(emptyBlocks, (block) => contains(block, comment))
  ),
  protectWhen("TypeScript pragma", ({ comment }) => Str.startsWith("@ts-")(comment.text)),
  protectWhen("continues the directive above", ({ comment, index, source }) =>
    continuesDirective(source, index, comment)
  ),
  protectWhen(
    "JSDoc stacked under another JSDoc block",
    ({ comment, index, source }) => isJsDocBlock(comment) && stackedUnderJsDoc(source, comment, index)
  ),
];

const protectionOf = (probe: ProtectionProbe): O.Option<string> => A.findFirst(PROTECTION_RULES, (rule) => rule(probe));

const groupKeyOf = (source: ParsedSource, comment: ClassifiedComment): string =>
  A.join([source.file, comment.kind, comment.text, anchorAfter(source, comment.end)], "\u0000");

const cidOf = (group: string, ordinal: number) => Effect.map(sha256Hex(`${group}\u0000${ordinal}`), Str.slice(0, 16));

const locateRows = Effect.fn("CommentStrip.locateRows")(function* (
  source: ParsedSource
): Effect.fn.Return<ReadonlyArray<Located>, never, Digest.Digest> {
  const emptyBlocks = nodesWhere(source.program, isEmptyBlock);
  const banned = A.filter(
    A.map(source.comments, (comment, index) => ({ comment, index })),
    ({ comment }) => isBannedCommentKind(comment.kind)
  );
  let ordinals = HashMap.empty<string, number>();
  let located = A.empty<Located>();
  for (const { comment, index } of banned) {
    const group = groupKeyOf(source, comment);
    const ordinal = O.getOrElse(HashMap.get(ordinals, group), () => 0);
    ordinals = HashMap.set(ordinals, group, ordinal + 1);
    const row = CommentLedgerRow.make({
      cid: yield* cidOf(group, ordinal),
      file: source.file,
      line: lineOf(source.text, comment.start),
      kind: comment.kind,
      text: comment.text,
      protect: protectionOf({ comment, emptyBlocks, index, source }),
    });
    located = A.append(located, { comment, group, row });
  }
  return located;
});

const readOptionalText = Effect.fn("CommentStrip.readOptionalText")(function* (absolute: string, label: string) {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs.exists(absolute).pipe(CommentLawExecutionError.mapError(`Failed to stat ${label}`));
  if (!exists) return O.none<string>();
  const text = yield* fs.readFileString(absolute).pipe(CommentLawExecutionError.mapError(`Failed to read ${label}`));
  return O.some(text);
});

const readRequiredText = Effect.fn("CommentStrip.readRequiredText")(function* (absolute: string, label: string) {
  const text = yield* readOptionalText(absolute, label);
  if (O.isNone(text)) return yield* CommentLawExecutionError.new(`${label} does not exist.`);
  return text.value;
});

const nonEmptyLines = (text: string): ReadonlyArray<readonly [line: number, value: string]> =>
  A.filter(
    A.map(Str.split(text, "\n"), (value, index) => [index + 1, Str.trimEnd(value)] as const),
    ([, value]) => Str.isNonEmpty(value)
  );

const ledgerSlugOf = (scope: string): string => (scope === "." ? "_root" : Str.replaceAll("/", "-")(scope));

const locateFile = Effect.fn("CommentStrip.locateFile")(function* (repoRoot: string, file: string) {
  const text = yield* readOptionalText(`${repoRoot}/${file}`, file);
  if (O.isNone(text) || (!Str.includes("//")(text.value) && !Str.includes("/*")(text.value))) return A.empty<Located>();
  return yield* locateRows(parseSource(file, text.value));
});

/**
 * Write the strip ledger for every banned comment under one path.
 *
 * **Details**
 *
 * The ledger is written to `.beep/comment-law/ledger/<path-slug>.jsonl`
 * (gitignored), one row per banned comment, in file and offset order.
 * Protected rows are blocks carrying a tag tools read (`@since`,
 * `@category`, `@internal`, `@public`, `@expected-unused`, `@ignore`,
 * `@deprecated`), comments holding a code fence, the only content of a
 * block (`catch {}` included), TypeScript pragmas, the continuation line of
 * a directive, and JSDoc stacked under another JSDoc block.
 *
 * **Example** (Write a ledger for one package)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { runCommentLedger } from "@beep/repo-cli/commands/Laws/CommentStrip"
 *
 * console.log(Effect.isEffect(runCommentLedger(process.cwd(), "packages/foundation/modeling/csv"))) // true
 * ```
 *
 * @param cwd - Any directory inside the repository.
 * @param path - Repository-relative directory or file to census; `./` and `.` are read as `--list` reads them.
 * @returns Effect that yields where the ledger went and its row counts.
 * @category utilities
 * @since 0.0.0
 */
export const runCommentLedger = Effect.fn("CommentStrip.runCommentLedger")(function* (
  cwd: string,
  path: string
): Effect.fn.Return<CommentLedgerSummary, CommentLawExecutionError, CommentStripServices> {
  const fs = yield* FileSystem.FileSystem;
  const repoRoot = yield* findRepoRoot(cwd).pipe(
    CommentLawExecutionError.mapError("Failed to locate the repository root")
  );
  const scope = commentScopeOf(path);
  const { files } = yield* commentLawFiles(repoRoot);
  const located = yield* Effect.forEach(
    A.filter(files, (file) => isInCommentScope(scope, file)),
    (file) => locateFile(repoRoot, file),
    { concurrency: 1 }
  ).pipe(Effect.map(A.flatten));
  const lines = yield* Effect.forEach(located, ({ row }) => encodeLedgerLine(row), { concurrency: 1 }).pipe(
    CommentLawExecutionError.mapError("Failed to encode the ledger")
  );
  const relative = `${COMMENT_LEDGER_DIR}/${ledgerSlugOf(scope)}.jsonl`;
  yield* fs
    .makeDirectory(`${repoRoot}/${COMMENT_LEDGER_DIR}`, { recursive: true })
    .pipe(CommentLawExecutionError.mapError(`Failed to create ${COMMENT_LEDGER_DIR}`));
  yield* fs
    .writeFileString(`${repoRoot}/${relative}`, A.isReadonlyArrayEmpty(lines) ? "" : `${A.join(lines, "\n")}\n`)
    .pipe(CommentLawExecutionError.mapError(`Failed to write ${relative}`));
  return CommentLedgerSummary.make({
    path: relative,
    rows: A.length(located),
    protected: A.length(A.filter(located, ({ row }) => O.isSome(row.protect))),
  });
});

const readLedger = Effect.fn("CommentStrip.readLedger")(function* (absolute: string, label: string) {
  const text = yield* readRequiredText(absolute, label);
  return yield* Effect.forEach(
    nonEmptyLines(text),
    ([line, value]) =>
      decodeLedgerLine(value).pipe(CommentLawExecutionError.mapError(`${label}:${line} is not a ledger row`)),
    { concurrency: 1 }
  );
});

const voteOfLine = (label: string, line: number, value: string) => {
  const fields = Str.split(value, "\t");
  const field = (index: number) => Str.trim(O.getOrElse(A.get(fields, index), () => ""));
  return decodeVote({ cid: field(0), code: field(1), ref: field(2) }).pipe(
    CommentLawExecutionError.mapError(`${label}:${line} is not a cid<TAB>code<TAB>ref vote`)
  );
};

const readBallot = Effect.fn("CommentStrip.readBallot")(function* (absolute: string, label: string) {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* readRequiredText(absolute, label);
  const identity = yield* fs.realPath(absolute).pipe(CommentLawExecutionError.mapError(`Failed to resolve ${label}`));
  let ballot = HashMap.empty<string, CommentVote>();
  for (const [line, value] of nonEmptyLines(text)) {
    const vote = yield* voteOfLine(label, line, value);
    if (HashMap.has(ballot, vote.cid))
      return yield* CommentLawExecutionError.new(`${label}:${line} votes ${vote.cid} a second time`);
    ballot = HashMap.set(ballot, vote.cid, vote);
  }
  return { ballot, identity };
});

const refusalOf = (row: CommentLedgerRow, reason: CommentRefusalReason, detail: string): CommentRefusal =>
  CommentRefusal.make({ cid: row.cid, file: row.file, line: row.line, reason, detail });

const agreedVotes = (
  votes: ReadonlyArray<CommentVote>
): Result.Result<A.NonEmptyReadonlyArray<CommentVote>, string> => {
  const groups = R.values(A.groupBy(votes, (vote): string => vote.code));
  const best = A.reduce(groups, 0, (top, group) => N.max(top, A.length(group)));
  const leaders = A.filter(groups, (group) => A.length(group) === best);
  if (best < 2) return Result.fail("no code has two agreeing votes");
  return A.isReadonlyArrayNonEmpty(leaders) && A.length(leaders) === 1
    ? Result.succeed(A.headNonEmpty(leaders))
    : Result.fail(
        `${A.join(
          A.map(leaders, (group) => A.headNonEmpty(group).code),
          " and "
        )} tie`
      );
};

const decisionPathOf = (root: string, ref: string): string => {
  const relative = root !== "." && Str.startsWith(`${root}/`)(ref) ? Str.slice(Str.length(root) + 1)(ref) : ref;
  return DECISION_FILE.test(relative) ? (root === "." ? relative : `${root}/${relative}`) : "";
};

const gateCode = (
  row: CommentLedgerRow,
  code: CommentVoteCode,
  refs: ReadonlyArray<string>,
  context: ApplyContext
): O.Option<CommentRefusal> => {
  if (code === "X" && !A.some(refs, (ref) => ISSUE_URL.test(ref)))
    return O.some(refusalOf(row, "missing-ref", "X needs an issue or pull request URL"));
  if (code !== "D") return O.none();
  const root = commentPackageRootOf(context.roots, row.file);
  const named = A.some(refs, (ref) => HashSet.has(context.committed, decisionPathOf(root, ref)));
  return named
    ? O.none()
    : O.some(refusalOf(row, "missing-decision", `D needs ${root}/decisions/<date>-<slug>.md committed in HEAD`));
};

const verdictOf = (row: CommentLedgerRow, context: ApplyContext): O.Option<CommentRefusal> => {
  const votes = A.getSomes(A.map(context.ballots, (ballot) => HashMap.get(ballot, row.cid)));
  if (A.length(votes) < 2) return O.some(refusalOf(row, "too-few-votes", `${A.length(votes)} vote(s)`));
  return Result.match(agreedVotes(votes), {
    onFailure: (detail) => O.some(refusalOf(row, "votes-disagree", detail)),
    onSuccess: (agreed) => {
      const code = A.headNonEmpty(agreed).code;
      if (!isDeletableCode(code)) return O.some(refusalOf(row, "retained-code", `agreed ${code}`));
      return gateCode(
        row,
        code,
        A.map(agreed, (vote) => vote.ref),
        context
      );
    },
  });
};

const decideRow = (
  row: CommentLedgerRow,
  current: HashMap.HashMap<string, Located>,
  context: ApplyContext
): Result.Result<Located, CommentRefusal> =>
  O.match(HashMap.get(current, row.cid), {
    onNone: () => Result.fail(refusalOf(row, "stale-cid", "the tree changed; run --ledger again")),
    onSome: (located) =>
      O.match(located.row.protect, {
        onSome: (reason) => Result.fail(refusalOf(row, "protected", reason)),
        onNone: () =>
          O.match(verdictOf(row, context), {
            onSome: Result.fail,
            onNone: () => Result.succeed(located),
          }),
      }),
  });

const withoutOrdinalSiblings = (
  planned: ReadonlyArray<Located>,
  current: ReadonlyArray<Located>
): readonly [ReadonlyArray<Located>, ReadonlyArray<CommentRefusal>] => {
  const plannedCids = HashSet.fromIterable(A.map(planned, (entry) => entry.row.cid));
  const leftBehind = HashSet.fromIterable(
    A.map(
      A.filter(current, (entry) => !HashSet.has(plannedCids, entry.row.cid)),
      (entry) => entry.group
    )
  );
  const [kept, refused] = A.partition(planned, (entry) =>
    HashSet.has(leftBehind, entry.group) ? Result.fail(entry) : Result.succeed(entry)
  );
  return [
    kept,
    A.map(refused, (entry) =>
      refusalOf(entry.row, "ordinal-sibling", "an identical comment with the same anchor stays")
    ),
  ];
};

const withoutShrunkGroups = Effect.fn("CommentStrip.withoutShrunkGroups")(function* (
  planned: ReadonlyArray<Located>,
  current: ReadonlyArray<Located>,
  censused: HashSet.HashSet<string>
) {
  let shrunk = HashSet.empty<string>();
  for (const group of A.dedupe(A.map(planned, (entry) => entry.group))) {
    const next = yield* cidOf(group, A.length(A.filter(current, (entry) => entry.group === group)));
    shrunk = HashSet.has(censused, next) ? HashSet.add(shrunk, group) : shrunk;
  }
  const [kept, refused] = A.partition(planned, (entry) =>
    HashSet.has(shrunk, entry.group) ? Result.fail(entry) : Result.succeed(entry)
  );
  return [
    kept,
    A.map(refused, (entry) =>
      refusalOf(entry.row, "stale-cid", "an identical comment censused with it is gone; run --ledger again")
    ),
  ] as const;
});

const lineSpanOf = (text: string, start: number, end: number): O.Option<Span> => {
  const lineStart = O.getOrElse(
    O.map(Str.lastIndexOf("\n")(Str.slice(0, start)(text)), (index) => index + 1),
    () => 0
  );
  const newline = O.getOrElse(Str.indexOf("\n")(Str.slice(end)(text)), () => Str.length(text) - end);
  const lineEnd = end + newline;
  return isBlankBetween(text, lineStart, start) && isBlankBetween(text, end, lineEnd)
    ? O.some({ start: lineStart, end: N.min(lineEnd + 1, Str.length(text)), replacement: "" })
    : O.none();
};

const exactSpanOf = (text: string, start: number, end: number, joins: boolean): Span => {
  const tight = joins && !isBlankBetween(text, start - 1, start) && !isBlankBetween(text, end, end + 1);
  return { start, end, replacement: tight ? " " : "" };
};

const spanOf = (
  source: ParsedSource,
  containers: ReadonlyArray<GrammarNode>,
  plannedStarts: HashSet.HashSet<number>,
  comment: ClassifiedComment
): Span => {
  const container = A.findFirst(
    containers,
    (node) =>
      contains(node, comment) &&
      A.every(
        A.filter(source.comments, (other) => contains(node, other)),
        (other) => HashSet.has(plannedStarts, other.start)
      )
  );
  const start = O.match(container, { onNone: () => comment.start, onSome: (node) => node.start });
  const end = O.match(container, { onNone: () => comment.end, onSome: (node) => node.end });
  return O.getOrElse(lineSpanOf(source.text, start, end), () =>
    exactSpanOf(source.text, start, end, O.isNone(container))
  );
};

const mergeSpans = (spans: ReadonlyArray<Span>): ReadonlyArray<Span> =>
  A.reduce(
    A.sort(
      spans,
      Order.mapInput(Order.Number, (span: Span) => span.start)
    ),
    A.empty<Span>(),
    (merged, span) =>
      O.match(A.last(merged), {
        onNone: () => [span],
        onSome: (previous) =>
          span.start < previous.end
            ? A.append(A.dropRight(merged, 1), { ...previous, end: N.max(previous.end, span.end) })
            : A.append(merged, span),
      })
  );

const stripText = (source: ParsedSource, planned: ReadonlyArray<Located>): string => {
  const containers = nodesWhere(source.program, isEmptyJsxContainer);
  const plannedStarts = HashSet.fromIterable(A.map(planned, (entry) => entry.comment.start));
  const spans = mergeSpans(A.map(planned, (entry) => spanOf(source, containers, plannedStarts, entry.comment)));
  return A.reduce(
    A.reverse(spans),
    source.text,
    (text, span) => `${Str.slice(0, span.start)(text)}${span.replacement}${Str.slice(span.end)(text)}`
  );
};

const cleanJsxText = (value: string): string => {
  const lines = Str.split(value, /\r\n|\n|\r/);
  const lastNonEmpty = O.getOrElse(
    A.findLastIndex(lines, (line) => /[^ \t]/.test(line)),
    () => -1
  );
  return A.join(
    A.map(lines, (line, index) => {
      const spaced = Str.replaceAll("\t", " ")(line);
      const leading = index === 0 ? spaced : Str.replace(/^ +/, "")(spaced);
      const trimmed = index === A.length(lines) - 1 ? leading : Str.replace(/ +$/, "")(leading);
      return Str.isEmpty(trimmed) || index === lastNonEmpty ? trimmed : `${trimmed} `;
    }),
    ""
  );
};

const jsxTextOf = (value: unknown): O.Option<string> =>
  isNode(value) && value.type === "JSXText" ? O.some(cleanJsxText(`${fieldOf(value, "value")}`)) : O.none();

const jsxChildren = (children: unknown): ReadonlyArray<unknown> =>
  A.flatMap(childValues(children), (child): ReadonlyArray<unknown> => {
    if (isNode(child) && isEmptyJsxContainer(child)) return [];
    return O.match(jsxTextOf(child), {
      onNone: () => [child],
      onSome: (text) => (Str.isEmpty(text) ? [] : [text]),
    });
  });

const canonicalNode = (node: Readonly<Record<string, unknown>>): unknown => {
  const fields = R.filter(node, (_, key) => !HashSet.has(POSITION_KEYS, key));
  const normalized =
    isNode(node) && HashSet.has(JSX_PARENT_TYPES, node.type)
      ? { ...fields, children: jsxChildren(node.children) }
      : fields;
  return R.map(normalized, canonical);
};

const canonical = (value: unknown): unknown =>
  A.isArray(value)
    ? A.map(value, canonical)
    : P.isRegExp(value)
      ? `${value}`
      : P.isObject(value)
        ? canonicalNode(value as Readonly<Record<string, unknown>>)
        : value;

/**
 * Prove that a strip left a file's program unchanged.
 *
 * **Details**
 *
 * Both texts are parsed with `oxc-parser`. The ESTree programs are compared
 * with `start`, `end`, `range` and `loc` dropped; JSX children are compared
 * as a JSX transform passes them: empty `{}` containers dropped, each text
 * child cleaned under JSX whitespace rules and dropped when empty, and every
 * remaining text child kept as its own child, so a deletion that joins two
 * text children changes the child count and fails. A parse error on either
 * side is `parse-error`; any other difference is `proof-failed`.
 *
 * **Example** (Prove a comment deletion)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { commentStripProof } from "@beep/repo-cli/commands/Laws/CommentStrip"
 *
 * const proof = commentStripProof("a.ts", "// note\nexport const x = 1;\n", "export const x = 1;\n")
 *
 * console.log(O.isNone(proof)) // true
 * ```
 *
 * @param file - Path the parser uses to pick the dialect.
 * @param before - Source text before the strip.
 * @param after - Source text after the strip.
 * @returns `None` when the programs match, otherwise the refusal reason.
 * @category utilities
 * @since 0.0.0
 */
export const commentStripProof: {
  (before: string, after: string): (file: string) => O.Option<CommentRefusalReason>;
  (file: string, before: string, after: string): O.Option<CommentRefusalReason>;
} = F.dual(3, (file: string, before: string, after: string): O.Option<CommentRefusalReason> => {
  const left = parseSync(file, before, { sourceType: "module" });
  const right = parseSync(file, after, { sourceType: "module" });
  if (A.isReadonlyArrayNonEmpty(left.errors) || A.isReadonlyArrayNonEmpty(right.errors)) return O.some("parse-error");
  return Equal.equals(canonical(left.program), canonical(right.program)) ? O.none() : O.some("proof-failed");
});

const emptyOutcome = (refusals: ReadonlyArray<CommentRefusal>): FileOutcome => ({
  deleted: 0,
  refusals,
  touched: O.none(),
});

const refuseAll = (rows: ReadonlyArray<CommentLedgerRow>, reason: CommentRefusalReason, detail: string) =>
  A.map(rows, (row) => refusalOf(row, reason, detail));

const applyToFile = Effect.fn("CommentStrip.applyToFile")(function* (
  repoRoot: string,
  file: string,
  rows: ReadonlyArray<CommentLedgerRow>,
  context: ApplyContext
) {
  const fs = yield* FileSystem.FileSystem;
  const absolute = `${repoRoot}/${file}`;
  const text = yield* readOptionalText(absolute, file);
  if (O.isNone(text)) return emptyOutcome(refuseAll(rows, "stale-cid", "the file is gone"));
  const real = yield* fs.realPath(absolute).pipe(CommentLawExecutionError.mapError(`Failed to resolve ${file}`));
  if (real !== `${context.realRoot}/${file}`)
    return emptyOutcome(refuseAll(rows, "symlinked-path", "the path resolves through a symlink"));
  const source = parseSource(file, text.value);
  if (source.errors > 0) return emptyOutcome(refuseAll(rows, "parse-error", "the file does not parse"));
  const current = yield* locateRows(source);
  const byCid = HashMap.fromIterable(A.map(current, (entry) => [entry.row.cid, entry] as const));
  const [decided, refused] = A.partition(rows, (row) => decideRow(row, byCid, context));
  const [unshrunk, siblings] = withoutOrdinalSiblings(decided, current);
  const [planned, shrunk] = yield* withoutShrunkGroups(
    unshrunk,
    current,
    HashSet.fromIterable(A.map(rows, (row) => row.cid))
  );
  const refusals = A.appendAll(A.appendAll(refused, siblings), shrunk);
  if (A.isReadonlyArrayEmpty(planned)) return emptyOutcome(refusals);
  const after = stripText(source, planned);
  const proof = commentStripProof(file, text.value, after);
  if (O.isSome(proof))
    return emptyOutcome(
      A.appendAll(
        refusals,
        A.map(planned, (entry) => refusalOf(entry.row, proof.value, "the stripped file is not the same program"))
      )
    );
  const latest = yield* readOptionalText(absolute, file);
  if (!O.contains(latest, text.value))
    return emptyOutcome(
      A.appendAll(
        refusals,
        A.map(planned, (entry) =>
          refusalOf(entry.row, "file-changed", "the file changed while apply ran; run --ledger again")
        )
      )
    );
  yield* fs.writeFileString(absolute, after).pipe(CommentLawExecutionError.mapError(`Failed to write ${file}`));
  return { deleted: A.length(planned), refusals, touched: O.some(file) } satisfies FileOutcome;
});

const committedDecisions = Effect.fn("CommentStrip.committedDecisions")(function* (
  repoRoot: string,
  rows: ReadonlyArray<CommentLedgerRow>,
  ballots: ReadonlyArray<HashMap.HashMap<string, CommentVote>>,
  roots: ReadonlyArray<string>
) {
  const git = yield* Git;
  const candidates = A.dedupe(
    A.flatMap(rows, (row) =>
      A.getSomes(
        A.map(ballots, (ballot) =>
          F.pipe(
            HashMap.get(ballot, row.cid),
            O.filter((vote) => vote.code === "D"),
            O.map((vote) => decisionPathOf(commentPackageRootOf(roots, row.file), vote.ref)),
            O.filter(Str.isNonEmpty)
          )
        )
      )
    )
  );
  if (A.isReadonlyArrayEmpty(candidates)) return A.empty<string>();
  return yield* git
    .lsTree(repoRoot, "HEAD", { pathspec: candidates, fullTree: true })
    .pipe(
      Effect.map(A.map((entry) => entry.path)),
      CommentLawExecutionError.mapError("Failed to list the committed decision files")
    );
});

const applyToFiles = Effect.fn("CommentStrip.applyToFiles")(function* (
  repoRoot: string,
  rows: ReadonlyArray<CommentLedgerRow>,
  context: ApplyContext
) {
  let outcomes = A.empty<FileOutcome>();
  for (const [file, fileRows] of A.sort(
    R.toEntries(A.groupBy(rows, (row) => row.file)),
    Order.mapInput(Order.String, ([name]: readonly [string, ReadonlyArray<CommentLedgerRow>]) => name)
  )) {
    const outcome = yield* Effect.result(applyToFile(repoRoot, file, fileRows, context));
    if (Result.isFailure(outcome)) {
      const written = A.getSomes(A.map(outcomes, ({ touched }) => touched));
      return yield* CommentLawExecutionError.new(
        `${outcome.failure.message}; already written: ${A.isReadonlyArrayEmpty(written) ? "none" : A.join(written, ", ")}`
      );
    }
    outcomes = A.append(outcomes, outcome.success);
  }
  return outcomes;
});

/**
 * Delete the ledger rows two vote files agree on, behind an AST-identity proof.
 *
 * **Details**
 *
 * A row is deleted only when at least two vote files agree on one deletable
 * code and no other code ties it: `T`, `S` or `G`; `X` only with an issue or
 * pull request URL; `D` only when the ref names a git-tracked
 * `<package>/decisions/<date>-<slug>.md` committed in `HEAD` in the owning
 * package. Each vote file counts once. Protected rows, rows whose `cid` no
 * longer matches the tree, deletions that would leave an identical sibling
 * behind or follow one that is gone, files that resolve through a symlink
 * and files edited while apply ran are refused. Each comment's range is
 * removed, with its whole line when nothing else is on it; an empty JSX
 * `{}` container goes with its comment. Every touched file must pass
 * {@link commentStripProof}, or it is not written. Biome is not run. When a
 * file fails to read or write, the error names the files already written.
 *
 * **Example** (Apply two vote files)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { runCommentApply } from "@beep/repo-cli/commands/Laws/CommentStrip"
 * import { CommentApplyOptions } from "@beep/repo-cli/commands/Laws/CommentStrip.model"
 *
 * const program = runCommentApply(
 *   CommentApplyOptions.make({ cwd: process.cwd(), ledger: "ledger.jsonl", votes: ["a.tsv", "b.tsv"] })
 * )
 *
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param options - Repository location, ledger path and vote file paths.
 * @returns Effect that yields the deleted count, the files written and every refusal.
 * @category utilities
 * @since 0.0.0
 */
export const runCommentApply = Effect.fn("CommentStrip.runCommentApply")(function* (
  options: CommentApplyOptions
): Effect.fn.Return<CommentApplySummary, CommentLawExecutionError, CommentStripServices> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot(options.cwd).pipe(
    CommentLawExecutionError.mapError("Failed to locate the repository root")
  );
  if (A.length(options.votes) < 2)
    return yield* CommentLawExecutionError.new("--apply needs at least two --votes files.");
  const rows = yield* readLedger(path.resolve(options.cwd, options.ledger), options.ledger);
  const read = yield* Effect.forEach(options.votes, (votes) => readBallot(path.resolve(options.cwd, votes), votes), {
    concurrency: 1,
  });
  const identities = A.map(read, ({ identity }) => identity);
  if (A.length(A.dedupe(identities)) < A.length(identities))
    return yield* CommentLawExecutionError.new("--votes names one file twice; each vote file counts once.");
  const ballots = A.map(read, ({ ballot }) => ballot);
  const { roots } = yield* commentLawFiles(repoRoot);
  const committed = yield* committedDecisions(repoRoot, rows, ballots, roots);
  const realRoot = yield* fs
    .realPath(repoRoot)
    .pipe(CommentLawExecutionError.mapError("Failed to resolve the repository root"));
  const context: ApplyContext = { ballots, committed: HashSet.fromIterable(committed), realRoot, roots };
  const outcomes = yield* applyToFiles(repoRoot, rows, context);
  return CommentApplySummary.make({
    deleted: A.reduce(outcomes, 0, (total, outcome) => total + outcome.deleted),
    filesTouched: A.getSomes(A.map(outcomes, (outcome) => outcome.touched)),
    refusals: A.flatMap(outcomes, (outcome) => outcome.refusals),
  });
});
