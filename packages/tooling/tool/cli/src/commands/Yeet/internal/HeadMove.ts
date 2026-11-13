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
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { YeetCommandError } from "../Yeet.errors.ts";
import { runGitFoldedStdout } from "./GitExec.ts";
import { YeetHeadMoveChanged, YeetHeadMoveUnchanged, YeetHeadMoveUnknown } from "./HeadMove.schemas.ts";
import { finalCheckPatchIdentityDigest } from "./PatchIdentity.ts";
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

// Preserve Git's configured transport; only OpenSSH accepts BatchMode.
const fetchSshEnvironment = Effect.fn("Yeet.headMoveFetchSshEnvironment")(function* (root: string) {
  const command = yield* Config.String("GIT_SSH_COMMAND").pipe(Config.option);
  const program = yield* Config.String("GIT_SSH").pipe(Config.option);
  const configured = O.isSome(command) ? command : yield* read(root, ["config", "core.sshCommand"]).pipe(Effect.option);
  if (O.isNone(configured) && O.isSome(program)) return {};
  const ssh = O.getOrElse(configured, () => "ssh");
  const executable = Str.replace(/^['"]|['"]$/g, "")(A.headNonEmpty(Str.split(ssh, /\s+/)));
  const programName = A.lastNonEmpty(Str.split(executable, "/"));
  return Str.startsWith("ssh")(programName) ? { GIT_SSH_COMMAND: `${ssh} -o BatchMode=yes` } : {};
});

// Step 10 runs first. The kit cannot express a multi-object, no-maintenance fetch
// with this explicit noninteractive environment; only that missing primitive uses StepExec.
const ensureObjects = Effect.fn("Yeet.headMoveEnsureObjects")(function* (root: string, request: YeetHeadMoveRequest) {
  const refs = A.dedupe([request.before, request.after, request.base]);
  yield* Effect.forEach(refs, guardLiteralArg);
  const missing = yield* Effect.filter(refs, (sha) =>
    read(root, ["cat-file", "-e", `${sha}^{commit}`]).pipe(Effect.option, Effect.map(O.isNone))
  );
  if (A.isReadonlyArrayEmpty(missing)) return;
  const sshEnv = yield* fetchSshEnvironment(root);
  const args = ["fetch", "--no-tags", "--no-write-fetch-head", "--no-auto-maintenance", "origin", ...missing];
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
  const [authorName, authorEmail, authorDate, email] = yield* decodeMetadata(values);
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
    const [oldMode, newMode, , , status] = yield* decodeRawEntry(Str.split(tokens[i] ?? "", " "));
    const path = yield* decodePath(tokens[i + 1]);
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
    readonly committerInstant: (sha: string) => Effect.Effect<O.Option<DateTime.Utc>>;
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
   * @param repoRoot - Checkout whose objects and identity supply the evidence.
   * @returns A live classifier layer.
   * @category layers
   * @since 0.0.0
   */
  static readonly layer = (repoRoot: string) =>
    Layer.effect(
      YeetHeadMoveClassifier,
      Effect.gen(function* () {
        const dependencies = yield* Effect.context<Effect.Services<ReturnType<typeof classifyKnown>>>();
        const localEmail = yield* read(repoRoot, ["config", "user.email"]).pipe(
          Effect.option,
          Effect.map(O.filter(Str.isNonEmpty))
        );
        return YeetHeadMoveClassifier.of({
          committerInstant: Effect.fn("Yeet.committerInstant")((sha: string) =>
            read(repoRoot, ["show", "-s", "--format=%cI", sha]).pipe(
              Effect.map(DateTime.make),
              Effect.option,
              Effect.map(O.flatten),
              Effect.provideContext(dependencies)
            )
          ),
          classify: Effect.fn("Yeet.classifyHeadMove")((request: YeetHeadMoveRequest) =>
            classifyKnown(repoRoot, request, localEmail).pipe(
              Effect.catchIf(isChanged, Effect.succeed),
              Effect.catchCause((cause) =>
                Cause.hasFails(cause) || Cause.hasDies(cause)
                  ? Effect.succeed(YeetHeadMoveUnknown.make({ ...request, reason: Cause.pretty(cause) }))
                  : Effect.failCause(Cause.fromReasons<never>(A.filter(cause.reasons, Cause.isInterruptReason)))
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
 * @param lookup - Deterministic request-to-verdict function.
 * @returns A requirement-free test classifier layer.
 * @category testing
 * @since 0.0.0
 */
export const layerYeetHeadMoveClassifierTest = (lookup: (request: YeetHeadMoveRequest) => YeetHeadMove) =>
  Layer.succeed(YeetHeadMoveClassifier, {
    committerInstant: Effect.fn("Yeet.testCommitterInstant")((_sha: string) => Effect.succeedNone),
    classify: Effect.fn("Yeet.testClassifyHeadMove")((request: YeetHeadMoveRequest) => Effect.succeed(lookup(request))),
  });

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
