/**
 * The final-check refresh rule (operator ruling 2026-10-28): a head F with no
 * receipt of its own is still final when an ancestor head R carries a
 * complete, passing `yeet final-check` receipt and, outside what `main`
 * brought in, the lane's own changes between R and F touch only allowed files.
 *
 * **Details**
 *
 * The typical F is R plus a main merge and the inventory re-runs that merge
 * forces (`beep lint schema-first --write` and friends), or a goal-packet
 * flip. Re-running the ~45 minute final-check for that buys nothing: the
 * lane's code is the code R proved, and main's own changes were proved by
 * main's CI.
 *
 * Own changes are computed against MBR = merge-base(R, base) and
 * MBF = merge-base(F, base). A path in `git diff R F` is the lane's own change
 * when it is absent from `git diff MBR MBF`, or when the lane's patch for it
 * differs (`MBR..R` against `MBF..F`, compared verbatim after dropping
 * per-file identity headers and hunk line numbers). Every own change must be on the
 * allowlist: the tool-regenerated standards inventories, or goal-packet
 * `SPEC.md`, `PLAN.md`, `README.md`, `ops/manifest.json` and reuse ledgers.
 * Code, tests and config always need a full final-check.
 *
 * The effect-vitest inventory has one extra hazard: taking main's copy and
 * re-running `--write` can silently reopen or drop findings. When it is an own
 * change, the lane's net count per finding status (count at the head minus
 * count at its merge base) must match between R and F.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Jsonc } from "@beep/jsonc/Jsonc";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { constFalse, constTrue } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Match from "effect/Match";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { EffectVitestInventoryPath } from "../../Lint/Lint.schemas.ts";
import {
  FINAL_CHECK_RECEIPT_DIR,
  finalCheckRefusal,
  readFinalCheckReceipt,
  YEET_FINAL_CHECK_COMMAND,
} from "./FinalCheck.ts";
import {
  FinalCheckRefreshFacts,
  FinalCheckRefreshOwnChange,
  FinalCheckRefreshPass,
  FinalCheckRefreshRefused,
  FinalCheckStatusDrift,
} from "./FinalCheckRefresh.schemas.ts";
import { runGitFoldedStdout, runGitOutput, runGitPathList } from "./GitExec.ts";
import type * as Crypto from "effect/Crypto";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { YeetCommandError } from "../Yeet.errors.ts";
import type { FinalCheckReceipt } from "./FinalCheck.schemas.ts";
import type { FinalCheckRefreshAllowance, FinalCheckRefreshVerdict } from "./FinalCheckRefresh.schemas.ts";

/**
 * The tool-regenerated standards inventories a lane may refresh after its
 * receipt without a new final-check.
 *
 * **Example** (Check an inventory path)
 *
 * ```ts
 * import { FINAL_CHECK_REFRESH_INVENTORIES } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(FINAL_CHECK_REFRESH_INVENTORIES.includes("standards/schema-first.inventory.jsonc")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const FINAL_CHECK_REFRESH_INVENTORIES: ReadonlyArray<string> = [
  "standards/jsdoc-documentation.inventory.jsonc",
  "standards/jsdoc-documentation.inventory.md",
  EffectVitestInventoryPath,
  "standards/schema-first.inventory.jsonc",
  "standards/fallow.boundaries.generated.jsonc",
  "standards/effect-laws.allowlist.jsonc",
];

const inventorySet = HashSet.fromIterable(FINAL_CHECK_REFRESH_INVENTORIES);

// Packet files below `goals/<slug>/` a lane flips as its work lands.
const packetFiles = HashSet.fromIterable(["SPEC.md", "PLAN.md", "README.md", "ops/manifest.json"]);

const REUSE_LEDGER = "reuse-ledger.md";

const isGoalPacketFile = (path: string): boolean => {
  const segments = Str.split("/")(path);
  if (A.length(segments) < 3 || segments[0] !== "goals") return false;
  const inPacket = A.join(A.drop(segments, 2), "/");
  return HashSet.has(packetFiles, inPacket) || O.contains(A.last(segments), REUSE_LEDGER);
};

/**
 * Classify a repository-relative path under the refresh allowlist.
 *
 * **Example** (Classify three paths)
 *
 * ```ts
 * import { finalCheckRefreshAllowance } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(finalCheckRefreshAllowance("standards/fallow.boundaries.generated.jsonc")) // Some("standards-inventory")
 * console.log(finalCheckRefreshAllowance("goals/demo/ops/manifest.json")) // Some("goal-packet")
 * console.log(finalCheckRefreshAllowance("packages/demo/src/index.ts")) // None
 * ```
 *
 * @param path - Repository-relative path with `/` separators.
 * @returns The allowance that admits the path, or none for code, tests and config.
 * @category policies
 * @since 0.0.0
 */
export const finalCheckRefreshAllowance = (path: string): O.Option<FinalCheckRefreshAllowance> =>
  HashSet.has(inventorySet, path)
    ? O.some("standards-inventory")
    : isGoalPacketFile(path)
      ? O.some("goal-packet")
      : O.none();

const renderDrift = (drift: FinalCheckStatusDrift): string =>
  `${drift.status} ${drift.atReceipt >= 0 ? "+" : ""}${drift.atReceipt} at the receipt, ${drift.atFinal >= 0 ? "+" : ""}${drift.atFinal} at the final head`;

/**
 * Judge the refresh facts: pass only when every own change is allowed and the
 * effect-vitest status counts the lane owns held.
 *
 * **Example** (A code change refuses)
 *
 * ```ts
 * import { decideFinalCheckRefresh, FinalCheckReceipt, FinalCheckRefreshFacts } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const verdict = decideFinalCheckRefresh(
 *   FinalCheckRefreshFacts.make({
 *     receipt: FinalCheckReceipt.make({
 *       schemaVersion: "yeet-final-check/v1", headSha: "r".repeat(40), mergeBase: "m".repeat(40), base: "origin/main",
 *       complete: true, verdict: "pass", startedAt: "2026-10-28T00:00:00.000Z",
 *       finishedAt: "2026-10-28T00:40:00.000Z", steps: [], expectationRewrites: [],
 *     }),
 *     finalHead: "f".repeat(40),
 *     ownChanges: ["packages/demo/src/index.ts"],
 *     effectVitestStatusDrift: [],
 *     effectVitestUnreadable: O.none(),
 *   })
 * )
 * console.log(verdict._tag) // "refused"
 * ```
 *
 * @param facts - What git says about the receipt head and the final head.
 * @returns Pass with the classified own changes, or the first refusal.
 * @category policies
 * @since 0.0.0
 */
export const decideFinalCheckRefresh = (facts: FinalCheckRefreshFacts): FinalCheckRefreshVerdict => {
  const ownChanges = A.map(facts.ownChanges, (path) =>
    FinalCheckRefreshOwnChange.make({ path, allowance: finalCheckRefreshAllowance(path) })
  );
  const refuse = (reason: FinalCheckRefreshRefused["reason"], detail: string) =>
    FinalCheckRefreshRefused.make({
      receiptHead: facts.receipt.headSha,
      finalHead: facts.finalHead,
      reason,
      ownChanges,
      detail,
    });
  const disallowed = A.filter(ownChanges, (change) => O.isNone(change.allowance));
  if (A.isReadonlyArrayNonEmpty(disallowed)) {
    return refuse(
      "own-change-outside-allowlist",
      `the lane changed ${A.length(disallowed)} file(s) outside the refresh allowlist after the receipt: ${A.join(
        A.map(disallowed, (change) => change.path),
        ", "
      )}; code, tests and config need a full final-check`
    );
  }
  if (O.isSome(facts.effectVitestUnreadable)) {
    return refuse(
      "effect-vitest-status-drift",
      `could not decode ${EffectVitestInventoryPath} at ${facts.effectVitestUnreadable.value}, so its status counts cannot be compared`
    );
  }
  if (A.isReadonlyArrayNonEmpty(facts.effectVitestStatusDrift)) {
    return refuse(
      "effect-vitest-status-drift",
      `the lane's effect-vitest status counts changed after the receipt (${A.join(
        A.map(facts.effectVitestStatusDrift, renderDrift),
        "; "
      )}); take main's inventory and re-run \`bun run beep lint effect-vitest --write\` without changing statuses, or run a full final-check`
    );
  }
  return FinalCheckRefreshPass.make({ receipt: facts.receipt, finalHead: facts.finalHead, ownChanges });
};

type GitServices = Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner;

const gitLine = (repoRoot: string, args: ReadonlyArray<string>) =>
  runGitOutput(repoRoot, args).pipe(Effect.map(Str.trim));

const changedPaths = (repoRoot: string, from: string, to: string) =>
  runGitPathList(repoRoot, ["diff", "--name-only", "--no-renames", "-z", from, to]).pipe(
    Effect.map(HashSet.fromIterable)
  );

// The lane's patch for one file, verbatim: the per-file header block (blob
// ids, `---`/`+++` names) is dropped and hunk headers lose their line numbers,
// so the same edit on a moved base still matches. Content lines keep every
// byte, whitespace and invalid UTF-8 included, and `--binary --full-index`
// renders binary edits as their bytes rather than "Binary files differ"; a
// binary delta on a different base therefore never matches, which fails closed.
const MarkerEncoder = new TextEncoder();
const asciiBytes = (text: string): Uint8Array => MarkerEncoder.encode(text);

const NewlineByte = 0x0a;
const NewlineBytes = asciiBytes("\n");
const HunkMarker = asciiBytes("@@");
const BinaryPatchMarker = asciiBytes("GIT binary patch");
const PatchHeaderPrefixes = A.map(["diff --git ", "index ", "--- ", "+++ "], asciiBytes);

// A line is classified on its first bytes alone: one byte past the longest
// marker tells an exact `GIT binary patch` line from a longer one.
const ClassifyPrefixLength = BinaryPatchMarker.length + 1;

const bytesStartWith =
  (marker: Uint8Array) =>
  (bytes: Uint8Array): boolean =>
    bytes.length >= marker.length && A.every(A.range(0, marker.length - 1), (at) => bytes[at] === marker[at]);

// The first bytes of one diff line: all of it when `complete`, otherwise
// `ClassifyPrefixLength` bytes of a longer line.
type LinePrefix = {
  readonly bytes: Uint8Array;
  readonly complete: boolean;
  readonly inBody: boolean;
};

// One line's contribution to the identity: `emit` is what enters the digest
// (none drops the line), and `streamRest` passes the line's remaining bytes
// through verbatim.
type LineVerdict = {
  readonly inBody: boolean;
  readonly emit: O.Option<Uint8Array>;
  readonly streamRest: boolean;
};

// The header block ends at the first hunk header or binary patch marker; from
// there every line is kept, hunk headers reduced to `@@`.
const classifyLine: (line: LinePrefix) => LineVerdict = Match.type<LinePrefix>().pipe(
  Match.when(
    ({ bytes }) => bytesStartWith(HunkMarker)(bytes),
    (): LineVerdict => ({ inBody: true, emit: O.some(HunkMarker), streamRest: false })
  ),
  Match.when(
    ({ inBody }) => inBody,
    ({ bytes }): LineVerdict => ({ inBody: true, emit: O.some(bytes), streamRest: true })
  ),
  Match.when(
    ({ bytes, complete }) =>
      complete && bytes.length === BinaryPatchMarker.length && bytesStartWith(BinaryPatchMarker)(bytes),
    ({ bytes }): LineVerdict => ({ inBody: true, emit: O.some(bytes), streamRest: true })
  ),
  Match.when(
    ({ bytes }) => A.some(PatchHeaderPrefixes, (prefix) => bytesStartWith(prefix)(bytes)),
    (): LineVerdict => ({ inBody: false, emit: O.none(), streamRest: false })
  ),
  Match.orElse(({ bytes }): LineVerdict => ({ inBody: false, emit: O.some(bytes), streamRest: true }))
);

/**
 * Digest the patch identity of one file's diff while it streams.
 *
 * **Details**
 *
 * The identity drops the per-file header block (`diff --git`, `index`, `---`,
 * `+++`), erases hunk-header line numbers so the same edit on a moved base
 * matches, and keeps every content byte as git wrote it: whitespace, `\r` and
 * bytes that are not valid UTF-8 all count. Lines split on the `\n` byte
 * alone and are classified on their first bytes, so only that short prefix and
 * a SHA-256 state are held; a diff of any size, or a single line of any
 * length, compares in linear time without a capture bound. Equal digests mean
 * equal identities.
 *
 * **Example** (Digest a streamed diff)
 *
 * ```ts
 * import { finalCheckPatchIdentityDigest } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 * import * as Stream from "effect/Stream"
 *
 * const digest = finalCheckPatchIdentityDigest(
 *   Stream.make(new TextEncoder().encode("diff --git a/x b/x\n@@ -1 +1 @@\n-a\n+b\n"))
 * )
 * console.log(Effect.isEffect(digest)) // true
 * ```
 *
 * @param diff - Raw `git diff` stdout bytes for one path.
 * @returns The hex SHA-256 of the patch identity.
 * @category parsing
 * @since 0.0.0
 */
export const finalCheckPatchIdentityDigest = <E, R>(
  diff: Stream.Stream<Uint8Array, E, R>
): Effect.Effect<string, E, R> =>
  Effect.suspend(() => {
    const hash = sha256.create();
    const prefix = new Uint8Array(ClassifyPrefixLength);
    let prefixLength = 0;
    let inBody = false;
    let anyKept = false;
    // None while the current line is still being classified.
    let verdict = O.none<LineVerdict>();

    const decide = (complete: boolean): LineVerdict => {
      const next = classifyLine({ bytes: prefix.slice(0, prefixLength), complete, inBody });
      inBody = next.inBody;
      if (O.isSome(next.emit)) {
        if (anyKept) hash.update(NewlineBytes);
        hash.update(next.emit.value);
        anyKept = true;
      }
      verdict = O.some(next);
      return next;
    };

    // Bytes of the current line, never containing `\n`.
    const feed = (bytes: Uint8Array): void => {
      const rest = O.match(verdict, {
        onSome: () => bytes,
        onNone: () => {
          const taken = Num.min(bytes.length, ClassifyPrefixLength - prefixLength);
          prefix.set(bytes.subarray(0, taken), prefixLength);
          prefixLength += taken;
          if (prefixLength === ClassifyPrefixLength) decide(false);
          return bytes.subarray(taken);
        },
      });
      if (rest.length > 0 && O.exists(verdict, ({ streamRest }) => streamRest)) hash.update(rest);
    };

    const endLine = (): void => {
      if (O.isNone(verdict)) decide(true);
      verdict = O.none();
      prefixLength = 0;
    };

    const scan = (chunk: Uint8Array): void => {
      let start = 0;
      let newline = chunk.indexOf(NewlineByte, start);
      while (newline !== -1) {
        feed(chunk.subarray(start, newline));
        endLine();
        start = newline + 1;
        newline = chunk.indexOf(NewlineByte, start);
      }
      feed(chunk.subarray(start));
    };

    return diff.pipe(
      Stream.runForEach((chunk) => Effect.sync(() => scan(chunk))),
      Effect.map(() => {
        endLine();
        return bytesToHex(hash.digest());
      })
    );
  });

const filePatch = (repoRoot: string, from: string, to: string, path: string) =>
  runGitFoldedStdout(
    repoRoot,
    ["diff", "--no-color", "--no-renames", "--no-ext-diff", "--binary", "--full-index", from, to, "--", path],
    finalCheckPatchIdentityDigest
  );

const StatusCountDocument = S.Struct({ findings: S.Array(S.Struct({ status: S.String })) });

const decodeStatusCountDocument = Jsonc.bind(StatusCountDocument).decode;

// Finding count per status at one revision; an absent file has no findings,
// and an undecodable one is none so the caller fails closed.
const statusCounts = Effect.fn("Yeet.finalCheckRefreshStatusCounts")(function* (repoRoot: string, revision: string) {
  const text = yield* runGitOutput(repoRoot, ["show", `${revision}:${EffectVitestInventoryPath}`]).pipe(Effect.option);
  if (O.isNone(text)) return O.some(HashMap.empty<string, number>());
  const document = yield* decodeStatusCountDocument(text.value).pipe(Effect.option);
  return O.map(document, ({ findings }) =>
    A.reduce(findings, HashMap.empty<string, number>(), (counts, finding) =>
      HashMap.set(counts, finding.status, O.getOrElse(HashMap.get(counts, finding.status), () => 0) + 1)
    )
  );
});

const countOf = (counts: HashMap.HashMap<string, number>, status: string): number =>
  O.getOrElse(HashMap.get(counts, status), () => 0);

const laneDelta = (head: HashMap.HashMap<string, number>, base: HashMap.HashMap<string, number>, status: string) =>
  countOf(head, status) - countOf(base, status);

const noDrift = { drift: A.empty<FinalCheckStatusDrift>(), unreadable: O.none<string>() };

const effectVitestDrift = Effect.fn("Yeet.finalCheckRefreshEffectVitestDrift")(function* (
  repoRoot: string,
  revisions: { readonly mbr: string; readonly r: string; readonly mbf: string; readonly f: string }
) {
  const read = (revision: string) =>
    statusCounts(repoRoot, revision).pipe(
      Effect.flatMap(O.match({ onNone: () => Effect.fail(revision), onSome: Effect.succeed }))
    );
  const all = yield* Effect.all([read(revisions.mbr), read(revisions.r), read(revisions.mbf), read(revisions.f)]).pipe(
    Effect.result
  );
  if (Result.isFailure(all)) return { drift: A.empty<FinalCheckStatusDrift>(), unreadable: O.some(all.failure) };
  const [mbr, r, mbf, f] = all.success;
  const statuses = A.sort(
    A.dedupe(A.flatMap([mbr, r, mbf, f], (map) => map.pipe(HashMap.keys, A.fromIterable))),
    Order.String
  );
  const drift = A.flatMap(statuses, (status) => {
    const atReceipt = laneDelta(r, mbr, status);
    const atFinal = laneDelta(f, mbf, status);
    return atReceipt === atFinal ? [] : [FinalCheckStatusDrift.make({ status, atReceipt, atFinal })];
  });
  return { drift, unreadable: O.none<string>() };
});

/**
 * Read the refresh facts for a receipt head R and a final head F against a base ref.
 *
 * **Example** (Build the facts read)
 *
 * ```ts
 * import { collectFinalCheckRefreshFacts } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof collectFinalCheckRefreshFacts) // "function"
 * ```
 *
 * @param repoRoot - Checkout holding both heads.
 * @param base - Base ref main merges come from, usually `origin/main`.
 * @param receipt - The passing receipt recorded for R.
 * @param finalHead - The head the flip would mark ready.
 * @returns The own changes and effect-vitest status drift between R and F.
 * @category io
 * @since 0.0.0
 */
export const collectFinalCheckRefreshFacts = Effect.fn("Yeet.collectFinalCheckRefreshFacts")(function* (
  repoRoot: string,
  base: string,
  receipt: FinalCheckReceipt,
  finalHead: string
): Effect.fn.Return<FinalCheckRefreshFacts, YeetCommandError, GitServices> {
  const r = receipt.headSha;
  const mbr = yield* gitLine(repoRoot, ["merge-base", r, base]);
  const mbf = yield* gitLine(repoRoot, ["merge-base", finalHead, base]);
  const changed = yield* changedPaths(repoRoot, r, finalHead);
  const mainChanged = yield* changedPaths(repoRoot, mbr, mbf);
  const ownChanges = yield* Effect.filter(
    A.sort(A.fromIterable(changed), Order.String),
    Effect.fnUntraced(function* (path) {
      if (!HashSet.has(mainChanged, path)) return true;
      const atReceipt = yield* filePatch(repoRoot, mbr, r, path);
      const atFinal = yield* filePatch(repoRoot, mbf, finalHead, path);
      return atReceipt !== atFinal;
    })
  );
  const ev = A.contains(ownChanges, EffectVitestInventoryPath)
    ? yield* effectVitestDrift(repoRoot, { mbr, r, mbf, f: finalHead })
    : noDrift;
  return FinalCheckRefreshFacts.make({
    receipt,
    finalHead,
    ownChanges,
    effectVitestStatusDrift: ev.drift,
    effectVitestUnreadable: ev.unreadable,
  });
});

const isAncestor = (repoRoot: string, ancestor: string, head: string) =>
  runGitOutput(repoRoot, ["merge-base", "--is-ancestor", ancestor, head]).pipe(
    Effect.as(true),
    Effect.orElseSucceed(constFalse)
  );

/**
 * Find the nearest strict ancestor of a head that carries a final-check receipt
 * of any verdict.
 *
 * **Details**
 *
 * Lists the receipt files under `.beep/yeet/final-check/`, keeps those named
 * by a strict ancestor of `finalHead`, and returns the head with the fewest
 * commits to `finalHead`. The choice is made by file name before any decode,
 * so a nearer failing, partial or malformed receipt is the one judged and
 * refuses; an older passing receipt never stands in for it.
 *
 * **Example** (Build the receipt search)
 *
 * ```ts
 * import { findFinalCheckRefreshReceipt } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(findFinalCheckRefreshReceipt("/repo", "f".repeat(40)))) // true
 * ```
 *
 * @param repoRoot - Checkout holding `.beep/yeet/final-check/`.
 * @param finalHead - The head the flip would mark ready.
 * @returns The head of the nearest ancestor receipt file, or none.
 * @category io
 * @since 0.0.0
 */
export const findFinalCheckRefreshReceipt = Effect.fn("Yeet.findFinalCheckRefreshReceipt")(function* (
  repoRoot: string,
  finalHead: string
): Effect.fn.Return<O.Option<string>, never, FileSystem.FileSystem | Path.Path | GitServices> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const entries = yield* fs
    .readDirectory(path.join(repoRoot, FINAL_CHECK_RECEIPT_DIR))
    .pipe(Effect.orElseSucceed((): ReadonlyArray<string> => []));
  const heads = A.flatMap(entries, (entry) =>
    Str.endsWith(".json")(entry) ? [Str.slice(0, -".json".length)(entry)] : []
  );
  const ancestors = yield* Effect.filter(
    A.filter(heads, (head) => head !== finalHead),
    (head) => isAncestor(repoRoot, head, finalHead)
  );
  const distances = yield* Effect.forEach(ancestors, (head) =>
    gitLine(repoRoot, ["rev-list", "--count", `${head}..${finalHead}`]).pipe(
      Effect.map((count) => [Number(count), head] as const),
      Effect.option
    )
  );
  return A.head(
    A.map(
      A.sort(
        A.getSomes(distances),
        Order.mapInput(Order.Number, ([distance]: readonly [number, string]) => distance)
      ),
      ([, head]) => head
    )
  );
});

// A probe that cannot answer counts as present, so the caller fails closed.
const receiptFileExists = Effect.fn("Yeet.finalCheckRefreshReceiptFileExists")(function* (
  repoRoot: string,
  headSha: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* fs
    .exists(path.join(repoRoot, FINAL_CHECK_RECEIPT_DIR, `${headSha}.json`))
    .pipe(Effect.orElseSucceed(constTrue));
});

/**
 * Apply the refresh rule to a head with no receipt of its own.
 *
 * **Details**
 *
 * Returns none when no strict ancestor carries a receipt, so the caller keeps
 * its ordinary "no final-check receipt" refusal. A receipt file for the head
 * itself that exists but does not decode refuses (`malformed-receipt`), as
 * does an undecodable, failing or partial receipt on the nearest ancestor;
 * otherwise the rule judges the lane's own changes since that receipt.
 *
 * **Example** (Build the refresh check)
 *
 * ```ts
 * import { checkFinalCheckRefresh } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(checkFinalCheckRefresh("/repo", "origin/main", "f".repeat(40)))) // true
 * ```
 *
 * @param repoRoot - Checkout holding the heads and the receipts.
 * @param base - Base ref main merges come from, usually `origin/main`.
 * @param finalHead - The head the flip would mark ready.
 * @returns The verdict for the nearest ancestor receipt of any verdict, or none.
 * @category workflows
 * @since 0.0.0
 */
export const checkFinalCheckRefresh = Effect.fn("Yeet.checkFinalCheckRefresh")(function* (
  repoRoot: string,
  base: string,
  finalHead: string
): Effect.fn.Return<
  O.Option<FinalCheckRefreshVerdict>,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | GitServices
> {
  const malformed = (receiptHead: string, which: string) =>
    O.some(
      FinalCheckRefreshRefused.make({
        receiptHead,
        finalHead,
        reason: "malformed-receipt",
        ownChanges: [],
        detail: `the final-check receipt for ${which} ${Str.slice(0, 12)(receiptHead)} exists but does not decode; re-run \`${YEET_FINAL_CHECK_COMMAND}\` instead of falling back to an older receipt`,
      })
    );
  // The rule covers only a head with no receipt of its own. A decodable one
  // is judged on its own (none here); a file that is there but unreadable must
  // refuse, never fall through to an ancestor.
  if (yield* receiptFileExists(repoRoot, finalHead)) {
    const own = yield* readFinalCheckReceipt(repoRoot, finalHead);
    return O.isSome(own) ? O.none() : malformed(finalHead, "head");
  }
  const receiptHead = yield* findFinalCheckRefreshReceipt(repoRoot, finalHead);
  if (O.isNone(receiptHead)) return O.none();
  const receipt = yield* readFinalCheckReceipt(repoRoot, receiptHead.value);
  if (O.isNone(receipt)) return malformed(receiptHead.value, "ancestor");
  // The file name chose this receipt, so it is the head the receipt must
  // record: a receipt copied or renamed under another sha is refused here.
  const notPassing = finalCheckRefusal(receipt, receiptHead.value);
  if (O.isSome(notPassing)) {
    return O.some(
      FinalCheckRefreshRefused.make({
        receiptHead: receiptHead.value,
        finalHead,
        reason: "ancestor-receipt-not-passing",
        ownChanges: [],
        detail: `the nearest ancestor receipt does not pass (${notPassing.value}); an older passing receipt never stands in for it`,
      })
    );
  }
  const facts = yield* collectFinalCheckRefreshFacts(repoRoot, base, receipt.value, finalHead);
  return O.some(decideFinalCheckRefresh(facts));
});
