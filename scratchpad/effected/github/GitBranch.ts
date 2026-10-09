import { $ScratchpadId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { GitHubClient } from "./GitHubClient.ts";
import { GitHubError } from "./GitHubError.ts";
import type { GitHubGraphQLError } from "./GraphQL.ts";
import { GraphQLDocument } from "./GraphQL.ts";
import { Repo } from "./Repo.ts";

const $I = $ScratchpadId.create("effected/github/GitBranch");

const CreateLinkedBranch = GraphQLDocument.make({
  name: "createLinkedBranch",
  document: `mutation ($issueId: ID!, $name: String!, $oid: GitObjectID!, $repositoryId: ID!) {
  createLinkedBranch(input: { issueId: $issueId, name: $name, oid: $oid, repositoryId: $repositoryId }) {
    linkedBranch { id }
  }
}`,
  response: S.Struct({}),
})<{
  readonly issueId: string;
  readonly name: string;
  readonly oid: string;
  readonly repositoryId: string;
}>();

/**
 * What {@link GitBranchShape.upsert} did.
 *
 * @public
 */
export type BranchOutcome = "created" | "reset";

/**
 * Branch refs in GitHub's Git Database API.
 *
 * @remarks
 * **Not local git.** Despite the name this is `POST /repos/…/git/refs` and
 * friends — no subprocess, no working tree, no checkout. `@effected/git` is the
 * package that runs git.
 *
 * @public
 */
export interface GitBranchShape {
  /** Create a branch at `sha`. Fails `alreadyExists` when it is already there. */
  readonly create: (name: string, sha: string) => Effect.Effect<void, GitHubError, Repo>;
  /**
   * Point `name` at `sha`, creating it if needed.
   *
   * @remarks
   * **One call, one intent.** Creating a branch that may already exist needs no
   * `exists` check, no catch and no second attempt: this creates the ref, and
   * when GitHub answers `alreadyExists` it resets the ref to `sha`. It is one
   * round trip in the common case and two in the raced one, and the recovery
   * **resets** rather than inheriting a branch a concurrent creator rooted
   * somewhere else. The result says which happened: `"created"` or `"reset"`.
   *
   * **A reset is observable, and open pull requests react to it.** Resetting a
   * branch to its PR's base — `upsert(branch, targetHead)` — makes that PR's
   * head equal its base, and GitHub **auto-closes a PR whose diff is empty**.
   * The window is invisible at this call site: `upsert(releaseBranch, mainHead)`
   * followed a few seconds later by a commit that re-adds content can lose an
   * open release PR in between while the run reports success. When the end state is "the target head plus
   * a commit", build the commit first — `GitCommit.get` the target for its
   * `treeSha`, `createTree` on it, `createCommit` with the target as parent —
   * and upsert **once**, straight to the finished sha, so the ref never rests
   * on the bare target head.
   */
  readonly upsert: (name: string, sha: string) => Effect.Effect<BranchOutcome, GitHubError, Repo>;
  /** Is the branch there? A 404 is `false`, not an error. */
  readonly exists: (name: string) => Effect.Effect<boolean, GitHubError, Repo>;
  /** The commit the branch points at. Fails `notFound` when it does not exist. */
  readonly sha: (name: string) => Effect.Effect<string, GitHubError, Repo>;
  /** As {@link GitBranchShape.sha}, with absence as `Option.none`. */
  readonly shaOption: (name: string) => Effect.Effect<O.Option<string>, GitHubError, Repo>;
  /** Force the branch to `sha`. Fails `notFound` when it does not exist. */
  readonly reset: (name: string, sha: string) => Effect.Effect<void, GitHubError, Repo>;
  /** Delete the branch. */
  readonly delete: (name: string) => Effect.Effect<void, GitHubError, Repo>;
  /**
   * Create a branch **linked to an issue**, as the GitHub UI's "create a branch"
   * button does.
   *
   * @remarks
   * The one operation in this package with **no REST equivalent** — GitHub
   * exposes `createLinkedBranch` only through GraphQL, which is why the document
   * is owned here rather than left in a consumer. A linked branch shows up on the
   * issue and closes it when the branch's pull request merges; a branch created
   * with {@link GitBranchShape.create} does neither.
   */
  readonly createLinked: (input: {
    readonly issueNodeId: string;
    readonly repositoryNodeId: string;
    readonly name: string;
    readonly sha: string;
  }) => Effect.Effect<void, GitHubGraphQLError, Repo>;
}

/**
 * Create, move, read and delete branch refs through GitHub's Git Database API,
 * with an `upsert` that needs no existence check.
 *
 * @remarks
 * Provide it with {@link GitBranch.layer}, which needs a `GitHubClient`; each
 * method also needs a `Repo` in `R`. Branch names are accepted as `main`,
 * `heads/main` or `refs/heads/main`.
 *
 * @example
 * ```ts
 * import { GitBranch } from "./index.ts";
 * import * as Effect from "effect/Effect";
 *
 * const ensureBranch = (name: string, sha: string) =>
 *   Effect.gen(function* () {
 *     const branches = yield* GitBranch;
 *     return yield* branches.upsert(name, sha); // "created" | "reset"
 *   });
 * ```
 *
 * @public
 */
export class GitBranch extends Context.Service<GitBranch, GitBranchShape>()($I`GitBranch`) {
  /**
   * The live service, built over a `GitHubClient`.
   *
   * @remarks
   * The callback is written `(client) => make(client)` rather than passed as
   * `make` directly, and that is load-bearing: a static initializer runs while
   * the module body is still evaluating, so naming a `const` declared further
   * down throws `Cannot access 'make' before initialization` **at import time**,
   * with a clean typecheck. Wrapping it in an arrow defers the read to when the
   * layer is built.
   */
  static readonly layer: Layer.Layer<GitBranch, never, GitHubClient> = Layer.effect(
    this,
    Effect.map(GitHubClient, (client) => make(client)),
  );

  /** An in-memory double; unstubbed members die naming themselves. */
  static readonly makeTest = (overrides: Partial<GitBranchShape> = {}): GitBranchShape => ({
    create: overrides.create ?? (() => unstubbed("create")),
    upsert: overrides.upsert ?? (() => unstubbed("upsert")),
    exists: overrides.exists ?? (() => unstubbed("exists")),
    sha: overrides.sha ?? (() => unstubbed("sha")),
    shaOption: overrides.shaOption ?? (() => unstubbed("shaOption")),
    reset: overrides.reset ?? (() => unstubbed("reset")),
    delete: overrides.delete ?? (() => unstubbed("delete")),
    createLinked: overrides.createLinked ?? (() => unstubbed("createLinked")),
  });

  /** {@link GitBranch.makeTest} behind a `Layer`. */
  static readonly layerTest = (overrides: Partial<GitBranchShape> = {}): Layer.Layer<GitBranch> =>
    Layer.succeed(GitBranch, GitBranch.makeTest(overrides));
}

const unstubbed = (member: string): never => {
  throw new Error(`GitBranch.makeTest: ${member}() was called but not stubbed — pass an override.`);
};

/**
 * `main`, `refs/heads/main` and `heads/main` all name the same branch.
 *
 * @remarks
 * GitHub's own API is inconsistent here — creation wants the full
 * `refs/heads/x`, every other operation wants `heads/x` — so callers routinely
 * pass whichever they last saw. Normalizing once is cheaper than documenting it
 * seven times.
 */
const shortName = (name: string): string => name.replace(/^refs\/heads\//, "").replace(/^heads\//, "");

const rejectEmpty = (operation: string, name: string): Effect.Effect<string, GitHubError> => {
  const short = shortName(name).trim();
  return short === ""
    ? Effect.fail(GitHubError.rejected(operation, 422, "a branch name is required"))
    : Effect.succeed(short);
};

/**
 * Every method resolves {@link Repo} per call rather than once at layer
 * construction.
 *
 * @remarks
 * This is what makes `Repo.provide(other)` mean something. Capturing the
 * coordinate when the layer is built would give each method `R = never` — the
 * house pattern for a stable dependency — but it would also make a scoped
 * override silently do nothing, because the resource would already hold the
 * repository it was built with. The repository is precisely the dependency that
 * is *not* stable: one program may loop over many target repositories.
 *
 * The client stays resolved at construction, so this costs one context read per
 * call and nothing else.
 */
const make = (client: GitHubClient["Service"]): GitBranchShape => {
  const create = Effect.fn("GitBranch.create")(function* (branch: string, sha: string) {
    const { owner, repo } = yield* Repo;
    const short = yield* rejectEmpty("GitBranch.create", branch);
    yield* Effect.annotateCurrentSpan({ owner, repo, branch: short });
    yield* client.request("POST /repos/{owner}/{repo}/git/refs", {
      owner,
      repo,
      ref: `refs/heads/${short}`,
      sha,
    });
  });

  const reset = Effect.fn("GitBranch.reset")(function* (branch: string, sha: string) {
    const { owner, repo } = yield* Repo;
    const short = yield* rejectEmpty("GitBranch.reset", branch);
    yield* Effect.annotateCurrentSpan({ owner, repo, branch: short });
    yield* client.request("PATCH /repos/{owner}/{repo}/git/refs/{ref}", {
      owner,
      repo,
      ref: `heads/${short}`,
      sha,
      force: true,
    });
  });

  const upsert = Effect.fn("GitBranch.upsert")(function* (branch: string, sha: string) {
    const short = yield* rejectEmpty("GitBranch.upsert", branch);
    yield* Effect.annotateCurrentSpan({ branch: short });
    return yield* create(short, sha).pipe(
      Effect.as<BranchOutcome>("created"),
      // The whole point of a structural `alreadyExists`: a concurrent creator
      // is recognized by the error's shape, not by matching its prose, and the
      // recovery needs no second existence check to tell the cases apart.
      Effect.catchIf(GitHubError.hasKind("alreadyExists"), () => Effect.as(reset(short, sha), "reset" as const)),
    );
  });

  const readRef = Effect.fn("readRef")(function* (operation: string, branch: string) {
    const { owner, repo } = yield* Repo;
    const short = yield* rejectEmpty(operation, branch);
    return yield* client.request("GET /repos/{owner}/{repo}/git/ref/{ref}", {
      owner,
      repo,
      ref: `heads/${short}`,
    });
  });

  const shaOption = Effect.fn("GitBranch.shaOption")(function* (branch: string) {
    yield* Effect.annotateCurrentSpan({ branch });
    return yield* readRef("GitBranch.shaOption", branch).pipe(
      Effect.map((ref) => O.some(ref.object.sha)),
      Effect.catchIf(GitHubError.hasKind("notFound"), () => Effect.succeed(O.none<string>())),
    );
  });

  return {
    create,
    upsert,
    reset,
    exists: Effect.fn("GitBranch.exists")(function* (branch: string) {
      yield* Effect.annotateCurrentSpan({ branch });
      return yield* Effect.map(shaOption(branch), O.isSome);
    }),
    sha: Effect.fn("GitBranch.sha")(function* (branch: string) {
      yield* Effect.annotateCurrentSpan({ branch });
      const ref = yield* readRef("GitBranch.sha", branch);
      return ref.object.sha;
    }),
    shaOption,
    createLinked: Effect.fn("GitBranch.createLinked")(function* (input: {
      readonly issueNodeId: string;
      readonly repositoryNodeId: string;
      readonly name: string;
      readonly sha: string;
    }) {
      const short = shortName(input.name);
      yield* Effect.annotateCurrentSpan({ branch: short });
      yield* client.graphql(CreateLinkedBranch, {
        issueId: input.issueNodeId,
        repositoryId: input.repositoryNodeId,
        name: short,
        oid: input.sha,
      });
    }),
    delete: Effect.fn("GitBranch.delete")(function* (branch: string) {
      const { owner, repo } = yield* Repo;
      const short = yield* rejectEmpty("GitBranch.delete", branch);
      yield* Effect.annotateCurrentSpan({ owner, repo, branch: short });
      return yield* client.request("DELETE /repos/{owner}/{repo}/git/refs/{ref}", {
        owner,
        repo,
        ref: `heads/${short}`,
      });
    }),
  };
};
