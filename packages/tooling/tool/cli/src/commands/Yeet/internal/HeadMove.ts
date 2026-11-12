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
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { YeetCommandError } from "../Yeet.errors.ts";
import { finalCheckPatchIdentityDigest } from "./FinalCheckRefresh.ts";
import { runGitFoldedStdout } from "./GitExec.ts";
import { YeetHeadMoveChanged, YeetHeadMoveUnchanged, YeetHeadMoveUnknown } from "./HeadMove.schemas.ts";
import type * as PlatformError from "effect/PlatformError";
import type { YeetHeadMove, YeetHeadMoveChange, YeetHeadMoveRequest } from "./HeadMove.schemas.ts";

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
  }).pipe($I.annoteSchema("HeadMoveCommit", { description: "Author metadata and tree identity of one commit." }))
) {}
class Entry extends S.Opaque<Entry, { readonly brand: unique symbol }>()(
  S.Struct({ oldMode: S.String, newMode: S.String, status: S.String, path: S.String }).pipe(
    $I.annoteSchema("HeadMoveEntry", { description: "Raw no-renames diff entry without blob identities." })
  )
) {}
const sameEntries = S.toEquivalence(S.Array(Entry));
const sameShas = S.toEquivalence(S.Array(S.String));

// Strict UTF-8: invalid metadata/paths fail closed instead of comparing replacement characters.
const textFold = Effect.fn("Yeet.headMoveTextFold")((stdout: Stream.Stream<Uint8Array, PlatformError.PlatformError>) =>
  Effect.suspend(() => {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    return stdout.pipe(
      Stream.runFold(
        () => "",
        (text, bytes) => text + decoder.decode(bytes, { stream: true })
      ),
      Effect.map((text) => text + decoder.decode())
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

// Step 10 runs first. The kit cannot express a multi-object, no-maintenance fetch
// with this explicit noninteractive environment; only that missing primitive uses StepExec.
const ensureObjects = Effect.fn("Yeet.headMoveEnsureObjects")(function* (root: string, request: YeetHeadMoveRequest) {
  const refs = A.dedupe([request.before, request.after, request.base]);
  yield* Effect.forEach(refs, guardLiteralArg);
  const missing = yield* Effect.filter(refs, (sha) =>
    read(root, ["cat-file", "-e", `${sha}^{commit}`]).pipe(Effect.option, Effect.map(O.isNone))
  );
  if (A.isReadonlyArrayEmpty(missing)) return;
  const ssh = yield* Config.String("GIT_SSH_COMMAND").pipe(Config.withDefault("ssh"));
  const args = ["fetch", "--no-tags", "--no-write-fetch-head", "--no-auto-maintenance", "origin", ...missing];
  const result = yield* runFoldedStdout({
    command: "git",
    args,
    cwd: root,
    extendEnv: true,
    stdin: "ignore",
    env: { GIT_TERMINAL_PROMPT: "0", GIT_SSH_COMMAND: `${ssh} -o BatchMode=yes` },
    fold: textFold,
  });
  if (result.exitCode !== 0) return yield* YeetCommandError.new("Head-move object fetch failed.")(result.stderr);
  yield* Effect.forEach(missing, (sha) => read(root, ["cat-file", "-e", `${sha}^{commit}`]));
});
const readCommit = Effect.fn("Yeet.headMoveReadCommit")(function* (root: string, sha: string) {
  const git = yield* Git;
  const parentText = yield* read(root, ["show", "-s", "--format=%P", sha]);
  const parentShas = A.flatMap(lines(parentText), Str.split(" "));
  const tree = yield* git.revParse(root, `${sha}^{tree}`);
  const parentTree = yield* O.match(A.head(parentShas), {
    onNone: () => Effect.succeed(""),
    onSome: (parent) => git.revParse(root, `${parent}^{tree}`),
  });
  const metadataText = yield* raw(root, ["show", "-s", "--format=format:%an%x00%ae%x00%aI%x00%ce", sha]);
  const values = Str.split(metadataText, "\0");
  const [authorName, authorEmail, authorDate, email] = yield* S.decodeUnknownEffect(
    S.Tuple([S.String, S.String, S.String, S.String])
  )(values);
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
// Step 5: activity actors are ambiguous; committers identify GitHub rewrites.
const githubCommitters = (request: YeetHeadMoveRequest, own: ReadonlyArray<Commit>) =>
  A.every(own, (commit) => S.is(GithubCommitter)(commit.committerEmail))
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
const rawEntries = Effect.fn("Yeet.headMoveRawEntries")(function* (root: string, commit: Commit) {
  const entryText = yield* raw(root, [
    "diff-tree",
    "--no-commit-id",
    "--raw",
    "--no-renames",
    "--no-abbrev",
    "-r",
    "-z",
    `${commit.sha}^`,
    commit.sha,
    "--",
  ]);
  const tokens = Str.split(entryText, "\0");
  const entries: Array<Entry> = [];
  for (let i = 0; i < A.length(tokens) - 1; i += 2) {
    const [oldMode, newMode, , , status] = yield* S.decodeUnknownEffect(
      S.Tuple([S.String, S.String, S.String, S.String, S.String])
    )(Str.split(tokens[i] ?? "", " "));
    const path = yield* S.decodeUnknownEffect(S.NonEmptyString)(tokens[i + 1]);
    entries.push(Entry.make({ oldMode, newMode, status, path }));
  }
  return entries;
});
const patchDigest = Effect.fn("Yeet.headMovePatchDigest")((root: string, commit: Commit, path: string) =>
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
      `${commit.sha}^`,
      commit.sha,
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
// Step 7b: compare raw modes/status/paths, then each whitespace-exact patch digest.
const patches = Effect.fn("Yeet.headMovePatches")(function* (
  root: string,
  request: YeetHeadMoveRequest,
  before: Commit,
  after: Commit,
  index: number
) {
  const oldEntries = yield* rawEntries(root, before);
  const newEntries = yield* rawEntries(root, after);
  if (!sameEntries(oldEntries, newEntries))
    return changed(
      request,
      "patch",
      `Commit ${index}: raw entries differ at ${
        A.join(
          A.map(newEntries, (entry) => entry.path),
          ", "
        ) || "deleted path"
      }.`
    );
  for (const entry of newEntries) {
    const oldDigest = yield* patchDigest(root, before, entry.path);
    const newDigest = yield* patchDigest(root, after, entry.path);
    if (oldDigest !== newDigest) return changed(request, "patch", `Commit ${index}: ${entry.path} differs.`);
  }
  return O.none();
});
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
const classifyKnown = Effect.fn("Yeet.headMoveClassifyKnown")(function* (root: string, request: YeetHeadMoveRequest) {
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
  yield* requireStep(githubCommitters(request, own));
  const old = yield* oldTail(root, request, A.length(own));
  yield* pairCommits(root, request, old.tail, own);
  const absorption = yield* absorbed(root, request, old.base);
  yield* requireStep(absorption);
  const replayed = yield* replay(root, request, old.base);
  yield* requireStep(replayed);
  return YeetHeadMoveUnchanged.make({ ...request, commits: A.length(own) });
});

/**
 * Classifies pinned head moves without failing callers or trusting GitHub activity actors.
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
    readonly classify: (request: YeetHeadMoveRequest) => Effect.Effect<YeetHeadMove>;
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
   * @category layers
   * @since 0.0.0
   */
  static readonly layer = (repoRoot: string) =>
    Layer.effect(
      YeetHeadMoveClassifier,
      Effect.gen(function* () {
        const dependencies = yield* Effect.context<Effect.Services<ReturnType<typeof classifyKnown>>>();
        return YeetHeadMoveClassifier.of({
          classify: Effect.fn("Yeet.classifyHeadMove")((request: YeetHeadMoveRequest) =>
            classifyKnown(repoRoot, request).pipe(
              Effect.catchIf(S.is(YeetHeadMoveChanged), Effect.succeed),
              Effect.catchCause((cause) =>
                Effect.succeed(YeetHeadMoveUnknown.make({ ...request, reason: Cause.pretty(cause) }))
              ),
              Effect.provideContext(dependencies)
            )
          ),
        });
      })
    );
}

/**
 * Supply a pure request-to-verdict lookup for carry tests.
 *
 * **Example** (Return unreadable evidence)
 *
 * ```ts
 * import { layerYeetHeadMoveClassifierTest, YeetHeadMoveUnknown } from "@beep/repo-cli/test/Yeet"
 * console.log(layerYeetHeadMoveClassifierTest((request) => YeetHeadMoveUnknown.make({ ...request, reason: "fixture" })))
 * ```
 * @category testing
 * @since 0.0.0
 */
export const layerYeetHeadMoveClassifierTest = (lookup: (request: YeetHeadMoveRequest) => YeetHeadMove) =>
  Layer.succeed(YeetHeadMoveClassifier, {
    classify: Effect.fn("Yeet.testClassifyHeadMove")((request: YeetHeadMoveRequest) => Effect.succeed(lookup(request))),
  });
