/**
 * Conservative, metadata-bound proof of a GitHub replay onto the synchronized base.
 * @packageDocumentation
 * @since 0.0.0
 */
import { Git } from "@beep/git/Git";
import { $RepoCliId } from "@beep/identity/packages";
import { runFoldedStdout } from "@beep/repo-cli-kit/process/StepExec";
import { guardLiteralArg } from "@beep/repo-utils";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { constFalse, constTrue, flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { YeetCommandError } from "../Yeet.errors.ts";
import { runGitFoldedStdout } from "./GitExec.ts";
import {
  YeetBaseMergeUnchanged,
  YeetHeadMoveChanged,
  YeetHeadMoveUnchanged,
  YeetHeadMoveUnknown,
} from "./HeadMove.schemas.ts";
import { finalCheckPatchIdentityDigest } from "./PatchIdentity.ts";
import type * as DateTime from "effect/DateTime";
import type { YeetBaseMerge, YeetHeadMove, YeetHeadMoveChange, YeetHeadMoveRequest } from "./HeadMove.schemas.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/HeadMove");
const GithubCommitter = S.String.check(
  S.isPattern(/^(?:noreply@github\.com|\d+\+[^@]+@users\.noreply\.github\.com)$/)
).pipe($I.annoteSchema("GithubCommitter", { description: "GitHub web-flow or cascade committer mailbox." }));
class Commit extends S.Opaque<Commit, { readonly brand: unique symbol }>()(
  S.Struct({
    sha: S.String,
    parents: S.Array(S.String),
    tree: S.String,
    empty: S.Boolean,
    authorName: S.String,
    authorEmail: S.String,
    authorDate: S.String,
    message: S.String,
    committerEmail: S.String,
    signature: S.Option(S.String),
  }).pipe($I.annoteSchema("HeadMoveCommit", { description: "Author metadata and tree identity of one commit." }))
) {}
class Entry extends S.Opaque<Entry, { readonly brand: unique symbol }>()(
  S.Struct({ oldMode: S.String, newMode: S.String, status: S.String, path: S.String }).pipe(
    $I.annoteSchema("HeadMoveEntry", { description: "Raw no-renames diff entry without blob identities." })
  )
) {}
const isChanged = S.is(YeetHeadMoveChanged);
const isGithubCommitter = S.is(GithubCommitter);
const decodeMetadata = S.decodeUnknownEffect(S.Tuple([S.String, S.String, S.String, S.String]));
const decodeRawEntry = S.decodeUnknownEffect(S.Tuple([S.String, S.String, S.String, S.String, S.String]));
const decodePath = S.decodeUnknownEffect(S.NonEmptyString);
const sameEntries = S.toEquivalence(S.Array(Entry));
const sameShas = S.toEquivalence(S.Array(S.String));

const decodeUtf8 = (decode: () => string) =>
  Effect.try({
    try: decode,
    catch: (cause) =>
      PlatformError.systemError({
        _tag: "InvalidData",
        module: "HeadMove",
        method: "decodeUtf8",
        description: "Git output is not UTF-8.",
        cause,
      }),
  });

// Strict UTF-8: invalid metadata/paths fail closed instead of comparing replacement characters.
const textFold = Effect.fn("Yeet.headMoveTextFold")((stdout: Stream.Stream<Uint8Array, PlatformError.PlatformError>) =>
  Effect.suspend(() => {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    return stdout.pipe(
      Stream.runFoldEffect(
        () => "",
        (text, bytes) => decodeUtf8(() => text + decoder.decode(bytes, { stream: true }))
      ),
      Effect.flatMap((text) => decodeUtf8(() => text + decoder.decode()))
    );
  })
);
const raw = Effect.fn("Yeet.headMoveRaw")((root: string, args: ReadonlyArray<string>) =>
  runGitFoldedStdout(root, args, textFold)
);
const read = Effect.fn("Yeet.headMoveRead")((root: string, args: ReadonlyArray<string>) =>
  raw(root, args).pipe(Effect.map(Str.trim))
);
const lines = (text: string) => A.filter(Str.split(text, "\n"), Str.isNonEmpty);
const changed = (request: YeetHeadMoveRequest, change: YeetHeadMoveChange, detail: string) =>
  O.some(YeetHeadMoveChanged.make({ ...request, change, detail }));
const requireStep = Effect.fn("Yeet.headMoveRequireStep")(
  (verdict: O.Option<YeetHeadMoveChanged>): Effect.Effect<void, YeetHeadMoveChanged> =>
    O.match(verdict, { onNone: () => Effect.void, onSome: Effect.fail })
);

// Preserve Git's configured transport; only OpenSSH accepts BatchMode. The `core.sshCommand` read
// runs on `Git.configGet` (W8, SPEC D-22); an unset key or a failed read is no configured command.
const fetchSshEnvironment = Effect.fn("Yeet.headMoveFetchSshEnvironment")(function* (root: string) {
  const command = yield* Config.String("GIT_SSH_COMMAND").pipe(Config.option);
  const program = yield* Config.String("GIT_SSH").pipe(Config.option);
  const git = yield* Git;
  const configured = O.isSome(command)
    ? command
    : yield* git.configGet(root, "core.sshCommand").pipe(Effect.option, Effect.map(O.flatten));
  if (O.isNone(configured) && O.isSome(program)) return {};
  const ssh = O.getOrElse(configured, () => "ssh");
  const executable = Str.replace(/^['"]|['"]$/g, "")(A.headNonEmpty(Str.split(ssh, /\s+/)));
  const programName = A.lastNonEmpty(Str.split(executable, "/"));
  return Str.startsWith("ssh")(programName) ? { GIT_SSH_COMMAND: `${ssh} -o BatchMode=yes` } : {};
});

// Step 10 runs first. The object probes run on `Git.refExists` (`cat-file -e`, W8, SPEC D-22); a
// failed probe reads as missing, as the capture it replaces did.
const ensureShas = Effect.fn("Yeet.headMoveEnsureObjects")(function* (root: string, shas: ReadonlyArray<string>) {
  const git = yield* Git;
  const refs = A.dedupe(shas);
  yield* Effect.forEach(refs, guardLiteralArg);
  const missing = yield* Effect.filter(refs, (sha) =>
    git.refExists(root, `${sha}^{commit}`).pipe(
      Effect.orElseSucceed(() => false),
      Effect.map((exists) => !exists)
    )
  );
  if (A.isReadonlyArrayEmpty(missing)) return;
  const sshEnv = yield* fetchSshEnvironment(root);
  const args = ["fetch", "--no-tags", "--no-write-fetch-head", "--no-auto-maintenance", "origin", ...missing];
  // KEEP (D-22): `Git.fetch` takes one ref and no `--no-auto-maintenance`, and the kit reads its environment
  // once at `make`, so it cannot pass this fetch's per-call `GIT_TERMINAL_PROMPT` and BatchMode
  // `GIT_SSH_COMMAND`.
  // biome-ignore lint/plugin/no-hand-rolled-git-gh-spawn: KEEP (D-22), reason above
  const result = yield* runFoldedStdout({
    command: "git",
    args,
    cwd: root,
    extendEnv: true,
    stdin: "ignore",
    env: { GIT_TERMINAL_PROMPT: "0", ...sshEnv },
    fold: textFold,
  }).pipe(Effect.timeout("60 seconds"));
  if (result.exitCode !== 0) return yield* YeetCommandError.new("Head-move object fetch failed.")(result.stderr);
  yield* Effect.forEach(missing, (sha) =>
    git.refExists(root, `${sha}^{commit}`).pipe(
      Effect.filterOrFail(
        (exists) => exists,
        () =>
          YeetCommandError.make({
            message: `Head-move object ${sha} is still missing after the fetch.`,
            command: `git cat-file -e ${sha}^{commit}`,
            exitCode: 1,
          })
      )
    )
  );
});
const ensureObjects = (root: string, request: YeetHeadMoveRequest) =>
  ensureShas(root, [request.before, request.after, request.base]);
// KEEP (D-22): `Git.commitInfo` and `Git.log` carry no parent list; `%P` is read raw.
const readParents = Effect.fn("Yeet.headMoveReadParents")(function* (root: string, sha: string) {
  const parentText = yield* read(root, ["show", "-s", "--format=%P", sha]);
  return A.flatMap(lines(parentText), Str.split(" "));
});
const readCommit = Effect.fn("Yeet.headMoveReadCommit")(function* (root: string, sha: string) {
  const git = yield* Git;
  const parentShas = yield* readParents(root, sha);
  const tree = yield* git.revParse(root, `${sha}^{tree}`);
  const parentTree = yield* O.match(A.head(parentShas), {
    onNone: () => Effect.succeed(""),
    onSome: (parent) => git.revParse(root, `${parent}^{tree}`),
  });
  // KEEP (D-22): no kit member reads the committer mailbox (`%ce`) or the author date with its
  // original offset (`%aI`); the kit's commit models carry neither.
  const metadataText = yield* raw(root, ["show", "-s", "--format=format:%an%x00%ae%x00%aI%x00%ce", sha]);
  const values = Str.split(metadataText, "\0");
  const [authorName, authorEmail, authorDate, email] = yield* decodeMetadata(values);
  // KEEP (D-22): the raw commit object (headers, `gpgsig`, the exact message) has no kit member
  // (`cat-file` is single-consumer plumbing, D-03).
  const commitObject = yield* raw(root, ["cat-file", "commit", sha]);
  const message = A.join(A.drop(Str.split(commitObject, "\n\n"), 1), "\n\n");
  return Commit.make({
    sha,
    parents: parentShas,
    tree,
    empty: tree === parentTree,
    authorName,
    authorEmail,
    authorDate,
    message,
    committerEmail: email,
    signature: A.findFirst(Str.split(A.headNonEmpty(Str.split(commitObject, "\n\n")), "\n"), Str.startsWith("gpgsig ")),
  });
});
// Step 1: a fast-forward, including equality, restarts proof.
const lanePush = Effect.fn("Yeet.headMoveLanePush")(function* (root: string, request: YeetHeadMoveRequest) {
  const git = yield* Git;
  return (yield* git.isAncestor(root, request.before, request.after))
    ? changed(request, "lane-push", "The old head is an ancestor of the new head.")
    : O.none();
});
// Step 2: all own commits must form a non-empty linear range.
const ownRange = (
  request: YeetHeadMoveRequest,
  first: ReadonlyArray<string>,
  all: ReadonlyArray<string>,
  commits: ReadonlyArray<Commit>
) => {
  if (A.isReadonlyArrayEmpty(first)) return changed(request, "empty-range", "The new head has no own commits.");
  if (!sameShas(first, all) || A.some(commits, (commit) => A.length(commit.parents) > 1))
    return changed(request, "merge-commit", "The new range is not a first-parent linear range.");
  return O.none();
};
// Step 3: S must be the exact linear base, not merely reachable from A.
const linearBase = (request: YeetHeadMoveRequest, actual: string) =>
  actual !== request.base
    ? changed(request, "base-mismatch", "The synchronized base is not the new range's linear base.")
    : O.none();
// Step 4: empty commits cannot establish a rewrite.
const nonEmptyRange = (request: YeetHeadMoveRequest, own: ReadonlyArray<Commit>) =>
  A.isReadonlyArrayEmpty(own)
    ? changed(request, "empty-range", "The new range contains only empty commits.")
    : O.none();
const githubCommitter = (commit: Commit, localEmail: O.Option<string>): boolean => {
  if (O.contains(localEmail, commit.committerEmail) || !isGithubCommitter(commit.committerEmail)) return false;
  return commit.committerEmail === "noreply@github.com"
    ? O.exists(commit.signature, Str.includes("-----BEGIN PGP SIGNATURE-----"))
    : O.isNone(commit.signature);
};
// Step 5: activity actors are ambiguous; committers identify GitHub rewrites.
const githubCommitters = (request: YeetHeadMoveRequest, own: ReadonlyArray<Commit>, localEmail: O.Option<string>) =>
  A.every(own, (commit) => githubCommitter(commit, localEmail))
    ? O.none()
    : changed(request, "not-github-rewrite", "A non-empty commit has a lane committer mailbox.");
// Step 6: walk only the smallest tail with n non-empty commits.
const tailCommit = (request: YeetHeadMoveRequest, commit: Commit) => {
  if (A.length(commit.parents) > 1) return changed(request, "merge-commit", "The old tail contains a merge.");
  if (A.isReadonlyArrayEmpty(commit.parents))
    return changed(request, "commit-count", "The old tail ran out of parents.");
  return O.none();
};
const oldTail = Effect.fn("Yeet.headMoveOldTail")(function* (
  root: string,
  request: YeetHeadMoveRequest,
  count: number
) {
  let at = request.before;
  const tail: Array<Commit> = [];
  while (A.length(tail) < count) {
    const commit = yield* readCommit(root, at);
    yield* requireStep(tailCommit(request, commit));
    if (!commit.empty) tail.push(commit);
    at = yield* Effect.fromOption(A.head(commit.parents));
  }
  return { tail: A.reverse(tail), base: at };
});
class PatchRange extends S.Opaque<PatchRange, { readonly brand: unique symbol }>()(
  S.Struct({ from: S.String, to: S.String }).pipe(
    $I.annoteSchema("HeadMovePatchRange", {
      description: "The two endpoints one patch is diffed between: a commit and its parent, or a base and a head.",
    })
  )
) {}
const commitRange = (commit: Commit) => PatchRange.make({ from: `${commit.sha}^`, to: commit.sha });
const rawEntries = Effect.fn("Yeet.headMoveRawEntries")(function* (root: string, range: PatchRange) {
  // KEEP (D-22): `Git.nameStatus` drops the old and new modes this comparison reads from
  // `diff-tree --raw`.
  const entryText = yield* raw(root, [
    "diff-tree",
    "--no-commit-id",
    "--raw",
    "--no-renames",
    "--no-abbrev",
    "-r",
    "-z",
    range.from,
    range.to,
    "--",
  ]);
  const tokens = Str.split(entryText, "\0");
  const entries: Array<Entry> = [];
  for (let i = 0; i < A.length(tokens) - 1; i += 2) {
    // In bounds by construction: i < length - 1.
    const meta = yield* Effect.fromOption(A.get(tokens, i));
    const [oldMode, newMode, , , status] = yield* decodeRawEntry(Str.split(meta, " "));
    const path = yield* decodePath(tokens[i + 1]);
    entries.push(Entry.make({ oldMode, newMode, status, path }));
  }
  return entries;
});
// KEEP (D-22): the per-path patch identity is a streamed byte fold that keeps invalid UTF-8 (the
// Y33 reason, D-18); the kit buffers decoded text.
const patchDigest = Effect.fn("Yeet.headMovePatchDigest")((root: string, range: PatchRange, path: string) =>
  runGitFoldedStdout(
    root,
    [
      "--literal-pathspecs",
      "diff",
      "--no-color",
      "--no-renames",
      "--no-ext-diff",
      "--no-textconv",
      "--binary",
      "--full-index",
      range.from,
      range.to,
      "--",
      path,
    ],
    finalCheckPatchIdentityDigest
  )
);
// Step 7a: bind author name, mailbox, offset-preserving date and the full raw message.
const MetadataField = LiteralKit(["authorName", "authorEmail", "authorDate", "message"]).pipe(
  $I.annoteSchema("HeadMoveMetadataField", { description: "Author metadata fields bound by rewrite proof." })
);
const metadata = (request: YeetHeadMoveRequest, before: Commit, after: Commit, index: number) =>
  A.findFirst(MetadataField.literals, (field) => before[field] !== after[field]).pipe(
    O.map((field) =>
      YeetHeadMoveChanged.make({ ...request, change: "metadata", detail: `Commit ${index}: ${field} differs.` })
    )
  );
// Step 7b: compare raw modes/status/paths, then each whitespace-exact patch digest. A rewrite's
// new side always lists a path (it holds only non-empty commits); a base merge's may list none,
// so the old side names the paths then.
const samePatch = Effect.fn("Yeet.headMovePatches")(function* (
  root: string,
  request: YeetHeadMoveRequest,
  older: PatchRange,
  newer: PatchRange,
  label: string
) {
  const oldEntries = yield* rawEntries(root, older);
  const newEntries = yield* rawEntries(root, newer);
  const named = A.isReadonlyArrayNonEmpty(newEntries) ? newEntries : oldEntries;
  if (!sameEntries(oldEntries, newEntries))
    return changed(
      request,
      "patch",
      `${label}: raw entries differ at ${A.join(
        A.map(named, (entry) => entry.path),
        ", "
      )}.`
    );
  for (const entry of newEntries) {
    const oldDigest = yield* patchDigest(root, older, entry.path);
    const newDigest = yield* patchDigest(root, newer, entry.path);
    if (oldDigest !== newDigest) return changed(request, "patch", `${label}: ${entry.path} differs.`);
  }
  return O.none();
});
const patches = (root: string, request: YeetHeadMoveRequest, before: Commit, after: Commit, index: number) =>
  samePatch(root, request, commitRange(before), commitRange(after), `Commit ${index}`);
const pairCommits = Effect.fn("Yeet.headMovePairCommits")(function* (
  root: string,
  request: YeetHeadMoveRequest,
  before: ReadonlyArray<Commit>,
  after: ReadonlyArray<Commit>
) {
  for (let index = 0; index < A.length(before); index++) {
    const oldCommit = yield* Effect.fromOption(A.get(before, index));
    const newCommit = yield* Effect.fromOption(A.get(after, index));
    const verdict = yield* patches(root, request, oldCommit, newCommit, index);
    yield* requireStep(verdict);
    yield* requireStep(metadata(request, oldCommit, newCommit, index));
  }
});
// Step 8: squashed history is permitted only if S absorbs all old base content.
const absorbed = Effect.fn("Yeet.headMoveAbsorbed")(function* (
  root: string,
  request: YeetHeadMoveRequest,
  oldBase: string
) {
  const git = yield* Git;
  const merged = yield* git.mergeTree(root, request.base, oldBase);
  const baseTree = yield* git.revParse(root, `${request.base}^{tree}`);
  return merged._tag === "clean" && merged.tree === baseTree
    ? O.none()
    : changed(request, "old-base-not-absorbed", "The synchronized base does not absorb the old base.");
});
// Step 9: erased hunk locations cannot hide a changed replay tree.
const replay = Effect.fn("Yeet.headMoveReplay")(function* (
  root: string,
  request: YeetHeadMoveRequest,
  oldBase: string
) {
  const git = yield* Git;
  const actual = yield* git.revParse(root, `${request.after}^{tree}`);
  // KEEP (D-22): `Git.mergeTree` has no `--merge-base` option.
  const expected = yield* read(root, [
    "merge-tree",
    "--write-tree",
    `--merge-base=${oldBase}`,
    request.base,
    request.before,
  ]);
  return expected === actual
    ? O.none()
    : changed(request, "replay-tree", "The new tree differs from an exact replay onto the synchronized base.");
});
const classifyKnown = Effect.fn("Yeet.headMoveClassifyKnown")(function* (
  root: string,
  request: YeetHeadMoveRequest,
  localEmail: O.Option<string>
) {
  const git = yield* Git;
  yield* ensureObjects(root, request);
  const ff = yield* lanePush(root, request);
  yield* requireStep(ff);
  const first = yield* git.revList(root, `${request.base}..${request.after}`, { firstParent: true });
  const all = yield* git.revList(root, `${request.base}..${request.after}`);
  const commits = yield* Effect.forEach(first, (sha) => readCommit(root, sha));
  yield* requireStep(ownRange(request, first, all, commits));
  const actualBase = yield* git.revParse(root, `${request.after}~${A.length(first)}`);
  yield* requireStep(linearBase(request, actualBase));
  const own = A.reverse(A.filter(commits, (commit) => !commit.empty));
  yield* requireStep(nonEmptyRange(request, own));
  yield* requireStep(githubCommitters(request, own, localEmail));
  const old = yield* oldTail(root, request, A.length(own));
  yield* pairCommits(root, request, old.tail, own);
  const absorption = yield* absorbed(root, request, old.base);
  yield* requireStep(absorption);
  const replayed = yield* replay(root, request, old.base);
  yield* requireStep(replayed);
  return YeetHeadMoveUnchanged.make({ ...request, commits: A.length(own) });
});

// Base merge, step 1: exactly one two-parent merge whose first parent is the old head.
const baseMergeShape = (request: YeetHeadMoveRequest, parents: ReadonlyArray<string>) =>
  A.length(parents) === 2 && O.contains(A.head(parents), request.before)
    ? O.none()
    : changed(request, "not-base-merge", "The new head is not one merge commit on top of the old head.");
// Base merge, step 2: the merged commit is on the synchronized base, so only base history comes in.
const mergedFromBase = Effect.fn("Yeet.headMoveMergedFromBase")(function* (
  root: string,
  request: YeetHeadMoveRequest,
  merged: string
) {
  const git = yield* Git;
  return (yield* git.isAncestor(root, merged, request.base))
    ? O.none()
    : changed(request, "base-mismatch", "The merged commit is not on the synchronized base.");
});
// Base merge, step 3: the pushed tree is git's clean automatic merge, so no conflict was resolved
// and nothing was edited inside the merge commit.
const cleanBaseMerge = Effect.fn("Yeet.headMoveCleanBaseMerge")(function* (
  root: string,
  request: YeetHeadMoveRequest,
  merged: string
) {
  const git = yield* Git;
  const automatic = yield* git.mergeTree(root, request.before, merged);
  if (automatic._tag === "conflicted")
    return changed(request, "merge-conflict", "The automatic merge of the base conflicts.");
  const actual = yield* git.revParse(root, `${request.after}^{tree}`);
  return automatic.tree === actual
    ? O.none()
    : changed(request, "replay-tree", "The merge commit's tree differs from the clean merge of the base.");
});
// Base merge, step 4: the patch against the base (GitHub's three-dot diff) keeps its identity.
const baseMergePatch = Effect.fn("Yeet.headMoveBaseMergePatch")(function* (root: string, request: YeetHeadMoveRequest) {
  const git = yield* Git;
  const oldBase = yield* git.mergeBase(root, request.base, request.before);
  const newBase = yield* git.mergeBase(root, request.base, request.after);
  return yield* samePatch(
    root,
    request,
    PatchRange.make({ from: oldBase, to: request.before }),
    PatchRange.make({ from: newBase, to: request.after }),
    "The pull request's patch"
  );
});
const classifyBaseMergeKnown = Effect.fn("Yeet.headMoveClassifyBaseMergeKnown")(function* (
  root: string,
  request: YeetHeadMoveRequest
) {
  const git = yield* Git;
  yield* ensureObjects(root, request);
  // A shallow boundary hides parents and merge bases, so the identity cannot be established.
  const shallow = yield* git.isShallow(root);
  if (shallow)
    return yield* YeetCommandError.make({ message: "Base-merge evidence needs a full history.", exitCode: 1 });
  const parents = yield* readParents(root, request.after);
  yield* requireStep(baseMergeShape(request, parents));
  // In bounds by construction: the shape step requires two parents.
  const merged = yield* Effect.fromOption(A.get(parents, 1));
  const onBase = yield* mergedFromBase(root, request, merged);
  yield* requireStep(onBase);
  const clean = yield* cleanBaseMerge(root, request, merged);
  yield* requireStep(clean);
  const patch = yield* baseMergePatch(root, request);
  yield* requireStep(patch);
  return YeetBaseMergeUnchanged.make({ ...request, merged });
});

// Failures and defects become the fallback evidence; interruption still propagates.
const recoverEvidence =
  <B>(fallback: (cause: Cause.Cause<unknown>) => B) =>
  <A, E, R>(program: Effect.Effect<A, E, R>): Effect.Effect<A | B, never, R> =>
    program.pipe(
      Effect.catchCause((cause) =>
        Cause.hasFails(cause) || Cause.hasDies(cause)
          ? Effect.succeed(fallback(cause))
          : Effect.failCause(Cause.fromReasons<never>(A.filter(cause.reasons, Cause.isInterruptReason)))
      )
    );
const unknownMove = (request: YeetHeadMoveRequest) =>
  recoverEvidence((cause) => YeetHeadMoveUnknown.make({ ...request, reason: Cause.pretty(cause) }));

/**
 * Classifies pinned head moves without failing callers or trusting GitHub activity actors.
 *
 * **Details**
 *
 * `classify` proves a GitHub rewrite (cascade, restack) replayed the same
 * commits; it refuses every merge. `classifyBaseMerge` proves a push that only
 * merges the synchronized base: one two-parent commit on the old head, the
 * merged commit on the base, the tree equal to git's clean automatic merge,
 * and the same patch identity against the base before and after. A shallow
 * checkout, a missing object or any failed read is `unknown`, never
 * `unchanged`. `isMergeCommit` is the cheap local probe callers take before
 * spending GitHub reads on a base merge; an unreadable commit is not one.
 *
 * **Example** (Classify with deterministic evidence)
 *
 * ```ts
 * import { YeetHeadMoveClassifier, YeetHeadMoveRequest, YeetHeadMoveUnknown, layerYeetHeadMoveClassifierTest } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 * const layer = layerYeetHeadMoveClassifierTest((request) => YeetHeadMoveUnknown.make({ ...request, reason: "unavailable" }))
 * const verdict = YeetHeadMoveClassifier.use((classifier) => classifier.classify(YeetHeadMoveRequest.make({ before: "b", after: "a", base: "s" }))).pipe(Effect.provide(layer))
 * console.log(Effect.isEffect(verdict)) // true
 * ```
 * @category services
 * @since 0.0.0
 */
export class YeetHeadMoveClassifier extends Context.Service<
  YeetHeadMoveClassifier,
  {
    readonly committerInstant: (sha: string) => Effect.Effect<O.Option<DateTime.Utc>>;
    readonly classify: (request: YeetHeadMoveRequest) => Effect.Effect<YeetHeadMove>;
    readonly classifyBaseMerge: (request: YeetHeadMoveRequest) => Effect.Effect<YeetBaseMerge>;
    readonly isMergeCommit: (sha: string) => Effect.Effect<boolean>;
  }
>()($I`YeetHeadMoveClassifier`) {
  /**
   * Capture checkout and Git/platform dependencies once, leaving classify requirement-free.
   *
   * **Example** (Build a checkout classifier)
   *
   * ```ts
   * import { YeetHeadMoveClassifier } from "@beep/repo-cli/test/Yeet"
   * console.log(YeetHeadMoveClassifier.layer("/repo"))
   * ```
   * @param repoRoot - Checkout whose objects and identity supply the evidence.
   * @returns A live classifier layer.
   * @category layers
   * @since 0.0.0
   */
  static readonly layer = (repoRoot: string) =>
    Layer.effect(
      YeetHeadMoveClassifier,
      Effect.gen(function* () {
        const dependencies =
          yield* Effect.context<
            Effect.Services<ReturnType<typeof classifyKnown> | ReturnType<typeof classifyBaseMergeKnown>>
          >();
        // `Git.configGet` (W8, SPEC D-22): an unset key or a failed read is no local mailbox.
        const git = yield* Git;
        const localEmail = yield* git
          .configGet(repoRoot, "user.email")
          .pipe(Effect.option, Effect.map(flow(O.flatten, O.filter(Str.isNonEmpty))));
        return YeetHeadMoveClassifier.of({
          // `Git.log` (W8, SPEC D-22): `CommitLogEntry.committedAt` is the `%cI` instant `show -s` read;
          // an unknown commit or a failed read is no instant.
          committerInstant: Effect.fn("Yeet.committerInstant")((sha: string) =>
            git.log(repoRoot, { revisions: [sha], limit: 1, omitPaths: true }).pipe(
              Effect.map(
                flow(
                  A.head,
                  O.map((entry) => entry.committedAt)
                )
              ),
              Effect.orElseSucceed(O.none<DateTime.Utc>)
            )
          ),
          classify: Effect.fn("Yeet.classifyHeadMove")((request: YeetHeadMoveRequest) =>
            classifyKnown(repoRoot, request, localEmail).pipe(
              Effect.catchIf(isChanged, Effect.succeed),
              unknownMove(request),
              Effect.provideContext(dependencies)
            )
          ),
          classifyBaseMerge: Effect.fn("Yeet.classifyBaseMerge")((request: YeetHeadMoveRequest) =>
            classifyBaseMergeKnown(repoRoot, request).pipe(
              Effect.catchIf(isChanged, Effect.succeed),
              unknownMove(request),
              Effect.provideContext(dependencies)
            )
          ),
          isMergeCommit: Effect.fn("Yeet.isMergeCommit")((sha: string) =>
            ensureShas(repoRoot, [sha]).pipe(
              Effect.andThen(readParents(repoRoot, sha)),
              Effect.map((parents) => A.length(parents) === 2),
              recoverEvidence(() => false),
              Effect.provideContext(dependencies)
            )
          ),
        });
      })
    );
}

const testClassifier = (
  lookup: (request: YeetHeadMoveRequest) => YeetHeadMove,
  baseMerge: (request: YeetHeadMoveRequest) => YeetBaseMerge,
  isMergeCommit: (sha: string) => boolean
) =>
  Layer.succeed(YeetHeadMoveClassifier, {
    committerInstant: Effect.fn("Yeet.testCommitterInstant")((_sha: string) => Effect.succeedNone),
    classify: Effect.fn("Yeet.testClassifyHeadMove")((request: YeetHeadMoveRequest) => Effect.succeed(lookup(request))),
    classifyBaseMerge: Effect.fn("Yeet.testClassifyBaseMerge")((request: YeetHeadMoveRequest) =>
      Effect.succeed(baseMerge(request))
    ),
    isMergeCommit: Effect.fn("Yeet.testIsMergeCommit")((sha: string) => Effect.succeed(isMergeCommit(sha))),
  });

const fixtureMissing =
  (kind: string) =>
  (request: YeetHeadMoveRequest): YeetHeadMoveUnknown =>
    YeetHeadMoveUnknown.make({ ...request, reason: `no ${kind} fixture` });

/**
 * Supply a pure request-to-verdict lookup for carry tests.
 *
 * **Details**
 *
 * No commit is a merge commit and every base merge is `unknown`, so a rewrite
 * fixture never carries a base merge.
 *
 * **Example** (Return unreadable evidence)
 *
 * ```ts
 * import { layerYeetHeadMoveClassifierTest, YeetHeadMoveUnknown } from "@beep/repo-cli/test/Yeet"
 * console.log(layerYeetHeadMoveClassifierTest((request) => YeetHeadMoveUnknown.make({ ...request, reason: "fixture" })))
 * ```
 * @param lookup - Deterministic request-to-verdict function.
 * @returns A requirement-free test classifier layer.
 * @category testing
 * @since 0.0.0
 */
export const layerYeetHeadMoveClassifierTest = (lookup: (request: YeetHeadMoveRequest) => YeetHeadMove) =>
  testClassifier(lookup, fixtureMissing("base-merge"), constFalse);

/**
 * Supply a pure base-merge lookup for review-window carry tests.
 *
 * **Details**
 *
 * Every commit reads as a merge commit, so the lookup alone decides which
 * push rows carry; every rewrite is `unknown`.
 *
 * **Example** (Refuse every base merge)
 *
 * ```ts
 * import { layerYeetBaseMergeClassifierTest, YeetHeadMoveChanged } from "@beep/repo-cli/test/Yeet"
 * const layer = layerYeetBaseMergeClassifierTest((request) =>
 *   YeetHeadMoveChanged.make({ ...request, change: "merge-conflict", detail: "fixture" })
 * )
 * console.log(layer)
 * ```
 * @param lookup - Deterministic request-to-verdict function for base merges.
 * @returns A requirement-free test classifier layer.
 * @category testing
 * @since 0.0.0
 */
export const layerYeetBaseMergeClassifierTest = (lookup: (request: YeetHeadMoveRequest) => YeetBaseMerge) =>
  testClassifier(fixtureMissing("rewrite"), lookup, constTrue);

/**
 * Supply a checkout classifier at a window or ready-gate boundary.
 *
 * **Example** (Build a provision function)
 * ```ts
 * import { provideYeetHeadMoveClassifier } from "@beep/repo-cli/test/Yeet"
 * console.log(typeof provideYeetHeadMoveClassifier("/repo")) // "function"
 * ```
 * @param repoRoot - Checkout used when no classifier is already provided.
 * @returns A function providing a classifier to the program.
 * @category layers
 * @since 0.0.0
 */
export const provideYeetHeadMoveClassifier =
  (repoRoot: string) =>
  <A, E, R>(program: Effect.Effect<A, E, R>) =>
    Effect.scoped(
      Effect.gen(function* () {
        const existing = yield* Effect.serviceOption(YeetHeadMoveClassifier);
        if (O.isSome(existing)) return yield* Effect.provideService(program, YeetHeadMoveClassifier, existing.value);
        const context = yield* Layer.build(YeetHeadMoveClassifier.layer(repoRoot).pipe(Layer.provide(Git.layer)));
        return yield* Effect.provideContext(program, context);
      })
    );
