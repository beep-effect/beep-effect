/**
 * GitHub clone and conversation evidence adapters.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { DateTime, Effect, FileSystem, Match, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  decodeLibraryJson,
  encodeLibraryJson,
  LibraryAdapterResult,
  runLibraryCommand,
  saveLibraryText,
} from "./Library.adapter.ts";
import { LibraryError } from "./Library.errors.ts";
import { LibraryArtifact } from "./Library.schemas.ts";
import { saveImmutable } from "./Library.store.ts";
import type { LibrarySource } from "./Library.schemas.ts";

const ProviderItems = S.Array(S.Unknown);

const Commit = S.String.check(S.isPattern(/^[0-9a-f]{40}$/));
const PullPins = S.Array(S.Struct({ base: S.Struct({ sha: Commit }), head: S.Struct({ sha: Commit }) }));
const RepositoryIdentity = S.Struct({ id: S.Finite, node_id: S.String, full_name: S.String, html_url: S.String });
const ResourceIdentity = S.Struct({ html_url: S.String });
const DiscussionIdentity = S.Struct({
  data: S.Struct({ repository: S.Struct({ discussion: S.Struct({ url: S.String }) }) }),
});
const PageInfo = S.Struct({ hasNextPage: S.Boolean, endCursor: S.NullOr(S.String) });
const Replies = S.Struct({ pageInfo: PageInfo });
const DiscussionPage = S.Struct({
  data: S.Struct({
    repository: S.Struct({
      discussion: S.Struct({
        comments: S.Struct({ nodes: S.Array(S.Struct({ id: S.String, replies: Replies })), pageInfo: PageInfo }),
      }),
    }),
  }),
});
const ReplyPage = S.Struct({ data: S.Struct({ node: S.Struct({ replies: Replies }) }) });
const renamedRepositoryEndpoint = (
  index: number,
  first: typeof RepositoryIdentity.Type | undefined,
  identitySlug: string
) => `https://api.github.com/repos/${index === 1 && first !== undefined ? first.full_name : identitySlug}`;
const repositoryParts = (url: string) =>
  Str.match(/^https:\/\/github\.com\/([A-Za-z0-9][A-Za-z0-9-]*)\/([A-Za-z0-9_.-]+)(?:\/|$)/)(url);

/**
 * Clone a referenced repository without executing its content.
 * **Example** (Prepare a source-bound acquisition)
 * ```ts
 * import { acquireLibraryGithub } from "@beep/repo-cli/test/ResearchLibrary"
 * import { classifyLibraryReference } from "@beep/repo-cli/commands/Research"
 * import { Effect } from "effect"
 * const acquisition = classifyLibraryReference("https://github.com/Effect-TS/effect", "report").pipe(Effect.flatMap((source) => acquireLibraryGithub("/library", source, "captures/example")))
 * console.log(Effect.isEffect(acquisition))
 * ```
 *
 * @internal
 * @category use-cases
 * @since 0.0.0
 */
export const acquireLibraryGithub = Effect.fn("Library.acquireGithub")(function* (
  root: string,
  source: LibrarySource,
  prefix: string
) {
  const parts = repositoryParts(source.canonicalUrl);
  if (O.isNone(parts))
    return yield* LibraryError.make({ message: "Unsupported GitHub repository identity.", cause: "identity" });
  const owner = Str.toLowerCase(parts.value[1] ?? "");
  const name = Str.toLowerCase(Str.replace(/\.git$/, "")(parts.value[2] ?? ""));
  if (name === "." || name === ".." || Str.isEmpty(name))
    return yield* LibraryError.make({ message: "Invalid repository path identity.", cause: "identity" });
  const slug = `${owner}/${name}`;
  const remote = `https://github.com/${slug}.git`;
  const path = yield* Path.Path;
  const fs = yield* FileSystem.FileSystem;
  const cloneRelative = `repos/github/${owner}/${name}`;
  const clone = path.join(root, cloneRelative);
  const realRoot = yield* fs.realPath(root);
  const validateCloneAncestor = Effect.fn("Library.github.validateCloneAncestor")(function* (ancestor: string) {
    const candidate = path.join(root, ancestor);
    if (!(yield* fs.exists(candidate))) return;
    const real = yield* fs.realPath(candidate);
    const relative = path.relative(realRoot, real);
    if (path.isAbsolute(relative) || relative === ".." || Str.startsWith(`..${path.sep}`)(relative))
      return yield* LibraryError.make({
        message: "Repository path escapes library through a symlink.",
        cause: "identity",
      });
  });
  for (const ancestor of ["repos", "repos/github", `repos/github/${owner}`, cloneRelative])
    yield* validateCloneAncestor(ancestor);
  if (!(yield* fs.exists(clone))) {
    yield* fs.makeDirectory(path.dirname(clone), { recursive: true });
    // --no-checkout prevents remote working-tree filters; no recursive submodule or LFS checkout.
    yield* runLibraryCommand(
      root,
      "git",
      ["-c", "core.hooksPath=/dev/null", "clone", "--no-checkout", "--no-recurse-submodules", "--", remote, clone],
      20_000
    );
  }
  const observedRemote = Str.trim(
    yield* runLibraryCommand(root, "git", ["-C", clone, "remote", "get-url", "origin"], 10_000)
  );
  if (observedRemote !== remote)
    return yield* LibraryError.make({
      message: "Existing repository remote differs from requested source.",
      cause: "identity",
    });
  const git = (args: ReadonlyArray<string>, cap = 8_000_000) =>
    runLibraryCommand(root, "git", ["-c", "core.hooksPath=/dev/null", "-C", clone, ...args], cap);
  const resolvePinnedRevision = Effect.fn("Library.github.resolvePinnedRevision")(function* () {
    const requested = Str.isEmpty(source.revision)
      ? "HEAD"
      : yield* Effect.try({
          try: () => decodeURIComponent(source.revision),
          catch: () =>
            LibraryError.make({ message: "Repository revision contains invalid URL encoding.", cause: "identity" }),
        });
    if (Str.startsWith("-")(requested))
      return yield* LibraryError.make({ message: "Invalid repository revision.", cause: "identity" });
    const resolved = yield* git(["rev-parse", "--verify", `${requested}^{commit}`], 10_000).pipe(Effect.option);
    if (O.isNone(resolved)) yield* git(["fetch", "--no-recurse-submodules", "origin", requested], 20_000);
    const revision = Str.trim(
      O.isSome(resolved) ? resolved.value : yield* git(["rev-parse", "--verify", "FETCH_HEAD^{commit}"], 10_000)
    );
    if (!S.is(Commit)(revision))
      return yield* LibraryError.make({ message: "Repository did not resolve a pinned commit.", cause: "identity" });
    return revision;
  });
  const revision = yield* resolvePinnedRevision();
  // Isolated git configuration prevents user filters; hooks are disabled and submodules/LFS remain pointers.
  yield* git(
    [
      "-c",
      "filter.lfs.required=false",
      "-c",
      "filter.lfs.smudge=",
      "-c",
      "filter.lfs.process=",
      "checkout",
      "--detach",
      revision,
    ],
    20_000
  );
  const files = yield* git(["ls-tree", "-r", "--name-only", revision]);
  const pin = yield* saveLibraryText(
    root,
    `${prefix}/repository.json`,
    yield* encodeLibraryJson({
      remote,
      revision,
      requestedRevision: source.revision,
      clone: cloneRelative,
      materialization: "detached-checkout-and-git-object-database",
      submodules: false,
      lfs: false,
    }),
    "application/json",
    "repository-pin"
  );
  const tree = yield* saveLibraryText(root, `${prefix}/tree.txt`, files, "text/plain", "repository-tree");
  const artifacts = [pin, tree];
  return yield* Effect.gen(function* () {
    const readme = A.findFirst(Str.split(files, "\n"), (file) => /^readme(?:\.[^/]+)?$/i.test(file));
    if (O.isSome(readme))
      artifacts.push(
        yield* saveLibraryText(
          root,
          `${prefix}/README.txt`,
          yield* git(["show", `${revision}:${readme.value}`]),
          "text/plain",
          "extracted-full-text"
        )
      );
    const license = A.findFirst(Str.split(files, "\n"), (file) => /^(?:licen[cs]e|copying)(?:\.[^/]+)?$/i.test(file));
    if (O.isSome(license))
      artifacts.push(
        yield* saveLibraryText(
          root,
          `${prefix}/LICENSE.txt`,
          yield* git(["show", `${revision}:${license.value}`]),
          "text/plain",
          "repository-license"
        )
      );
    const captureGitPatch = Effect.fn("Library.github.captureGitPatch")(function* (
      label: string,
      args: ReadonlyArray<string>
    ) {
      return yield* Effect.scoped(
        Effect.gen(function* () {
          const staging = path.join(root, ".staging");
          yield* fs.makeDirectory(staging, { recursive: true });
          const temporary = yield* fs.makeTempDirectoryScoped({ directory: staging, prefix: "git-patch-" });
          const output = path.join(temporary, "patch.diff");
          yield* git([...args, `--output=${output}`], 20_000);
          const stat = yield* fs.stat(output);
          if (stat.size > BigInt(100_000_000))
            return yield* LibraryError.make({
              cause: "output-bound",
              message: "Git patch exceeded the explicit 100 MB retained-file limit.",
            });
          const bytes = yield* fs.readFile(output);
          const saved = yield* saveImmutable(root, `${prefix}/${label}`, bytes);
          const artifact = LibraryArtifact.make({ ...saved, mediaType: "text/x-diff", role: "raw-diff" });
          artifacts.push(artifact);
          return artifact;
        })
      );
    });
    const validateRenameIdentity = Effect.fn("Library.github.validateRenameIdentity")(function* (
      identity: typeof RepositoryIdentity.Type,
      first: typeof RepositoryIdentity.Type | undefined,
      observedSlug: string
    ) {
      if (
        identity.full_name.toLowerCase() !== observedSlug ||
        identity.html_url.toLowerCase() !== `https://github.com/${observedSlug}` ||
        (first !== undefined && (first.id !== identity.id || first.node_id !== identity.node_id))
      ) {
        return yield* LibraryError.make({
          cause: "identity",
          message: "Returned GitHub repository differs without matching stable repository ID/node identity evidence.",
        });
      }
    });
    let identityObserved = false;
    const captureRenameIdentity = Effect.fn("Library.github.captureRenameIdentity")(function* (resourceUrl: string) {
      const target = repositoryParts(resourceUrl);
      if (identityObserved || O.isNone(target)) return;
      const observedSlug = `${Str.toLowerCase(target.value[1] ?? "")}/${Str.toLowerCase(target.value[2] ?? "")}`;
      if (observedSlug === slug) return;
      const receipts = [];
      let first: typeof RepositoryIdentity.Type | undefined;
      for (const [index, identitySlug] of [
        [0, slug],
        [1, observedSlug],
      ] as const) {
        const endpoint = renamedRepositoryEndpoint(index, first, identitySlug);
        const raw = yield* runLibraryCommand(root, "gh", ["api", endpoint]);
        const artifact = yield* saveLibraryText(
          root,
          `${prefix}/repository-identity-${index}.json`,
          raw,
          "application/json",
          "repository-identity-response"
        );
        artifacts.push(artifact);
        const identity = yield* decodeLibraryJson(RepositoryIdentity)(raw);
        receipts.push({
          requestedEndpoint: endpoint,
          observedAt: DateTime.formatIso(yield* DateTime.now),
          exitCode: 0,
          ...identity,
          artifact: artifact.path,
          sha256: artifact.sha256,
          bytes: artifact.bytes,
        });
        artifacts.push(
          yield* saveLibraryText(
            root,
            `${prefix}/repository-identity-receipt-${index}.json`,
            yield* encodeLibraryJson(receipts),
            "application/json",
            "repository-identity-provenance"
          )
        );
        yield* validateRenameIdentity(identity, first, observedSlug);
        first = identity;
      }
      identityObserved = true;
    });
    const observeResourceIdentities = Effect.fn("Library.github.observeResourceIdentities")(function* (
      decoded: unknown
    ) {
      const resources = S.is(ProviderItems)(decoded) ? decoded : [decoded];
      for (const resource of resources) {
        const identity = S.decodeUnknownOption(ResourceIdentity)(resource);
        if (O.isSome(identity)) yield* captureRenameIdentity(identity.value.html_url);
      }
    });
    const captureApi = Effect.fn("Library.github.captureApi")(function* (label: string, endpoint: string) {
      const pages: Array<unknown> = [];
      const paginated = Str.includes("per_page=100")(endpoint);
      for (const page of A.range(1, 100)) {
        const raw = yield* runLibraryCommand(root, "gh", ["api", paginated ? `${endpoint}&page=${page}` : endpoint]);
        const decoded = yield* decodeLibraryJson(S.Unknown)(raw);
        pages.push(decoded);
        artifacts.push(
          yield* saveLibraryText(
            root,
            `${prefix}/${label}-page-${page}.json`,
            raw,
            "application/json",
            "raw-discussion"
          )
        );
        yield* observeResourceIdentities(decoded);
        const items = paginated
          ? yield* S.decodeUnknownEffect(ProviderItems)(decoded).pipe(
              Effect.mapError((cause) =>
                LibraryError.make({ cause, message: "GitHub pagination response was not an array." })
              )
            )
          : [];
        if (!paginated || items.length < 100) {
          const aggregate = yield* encodeLibraryJson(pages);
          artifacts.push(
            yield* saveLibraryText(root, `${prefix}/${label}.json`, aggregate, "application/json", "raw-discussion")
          );
          artifacts.push(
            yield* saveLibraryText(
              root,
              `${prefix}/${label}-pagination.json`,
              yield* encodeLibraryJson({ endpoint, pages: pages.length, exhausted: true, pageSize: 100 }),
              "application/json",
              "pagination-metadata"
            )
          );
          return aggregate;
        }
      }
      artifacts.push(
        yield* saveLibraryText(
          root,
          `${prefix}/${label}-pagination.json`,
          yield* encodeLibraryJson({ endpoint, pages: pages.length, exhausted: false, pageSize: 100, limit: 100 }),
          "application/json",
          "pagination-metadata"
        )
      );
      return yield* LibraryError.make({
        cause: "pagination",
        message:
          "GitHub resource exceeded bounded 100-page pagination; every returned page and incomplete pagination receipt retained.",
      });
    });
    const capturePull = Effect.fn("Library.github.capturePull")(function* (n: string) {
      const pull = yield* decodeLibraryJson(PullPins)(yield* captureApi("pull", `repos/${slug}/pulls/${n}`));
      yield* captureApi("reviews", `repos/${slug}/pulls/${n}/reviews?per_page=100`);
      yield* captureApi("review-comments", `repos/${slug}/pulls/${n}/comments?per_page=100`);
      yield* captureApi("files", `repos/${slug}/pulls/${n}/files?per_page=100`);
      const remoteDiff = yield* runLibraryCommand(root, "gh", [
        "api",
        "-H",
        "Accept: application/vnd.github.diff",
        `repos/${slug}/pulls/${n}`,
      ]).pipe(Effect.option);
      const retainRemotePullDiff = Effect.fn("Library.github.retainRemotePullDiff")(function* (body: string) {
        artifacts.push(yield* saveLibraryText(root, `${prefix}/pull.diff`, body, "text/x-diff", "raw-diff"));
        const pins = A.head(pull);
        if (O.isNone(pins))
          return yield* LibraryError.make({
            cause: "identity",
            message: "PR diff metadata omitted commit identities.",
          });
        artifacts.push(
          yield* saveLibraryText(
            root,
            `${prefix}/diff-provenance.json`,
            yield* encodeLibraryJson({
              method: "gh-api-diff",
              endpoint: `repos/${slug}/pulls/${n}`,
              accept: "application/vnd.github.diff",
              base: pins.value.base.sha,
              head: pins.value.head.sha,
            }),
            "application/json",
            "diff-provenance"
          )
        );
      });
      const retainLocalPullDiff = Effect.fn("Library.github.retainLocalPullDiff")(function* () {
        const pins = A.head(pull);
        if (O.isNone(pins))
          return yield* LibraryError.make({
            message: "PR metadata omitted base/head commit identities for local diff fallback.",
            cause: "identity",
          });
        for (const sha of [pins.value.base.sha, pins.value.head.sha]) {
          const present = yield* git(["cat-file", "-e", `${sha}^{commit}`], 10_000).pipe(Effect.option);
          if (O.isNone(present)) yield* git(["fetch", "--no-recurse-submodules", "origin", sha], 20_000);
        }
        yield* captureGitPatch("pull.diff", [
          "diff",
          "--no-ext-diff",
          "--no-textconv",
          `${pins.value.base.sha}...${pins.value.head.sha}`,
        ]);
        artifacts.push(
          yield* saveLibraryText(
            root,
            `${prefix}/diff-provenance.json`,
            yield* encodeLibraryJson({
              method: "git-diff",
              base: pins.value.base.sha,
              head: pins.value.head.sha,
              reason: "GitHub diff endpoint unavailable; exact API-reported commit objects fetched without execution.",
            }),
            "application/json",
            "diff-provenance"
          )
        );
      });
      if (O.isSome(remoteDiff)) yield* retainRemotePullDiff(remoteDiff.value);
      else yield* retainLocalPullDiff();
    });
    const captureDiscussion = Effect.fn("Library.github.captureDiscussion")(function* () {
      const discussionNumber = Str.match(/\/discussions\/(\d+)/)(source.canonicalUrl);
      if (O.isNone(discussionNumber))
        return yield* LibraryError.make({ message: "Missing cited discussion number.", cause: "identity" });
      const query =
        "query($owner:String!,$name:String!,$number:Int!,$cursor:String){repository(owner:$owner,name:$name){discussion(number:$number){id title url body author{login} comments(first:100,after:$cursor){nodes{id body url author{login} replies(first:100){nodes{id body url author{login}} pageInfo{hasNextPage endCursor}}} pageInfo{hasNextPage endCursor}}}}}";
      const replyQuery =
        "query($id:ID!,$cursor:String){node(id:$id){... on DiscussionComment{replies(first:100,after:$cursor){nodes{id body url author{login}} pageInfo{hasNextPage endCursor}}}}}";
      const captureDiscussionReplies = Effect.fn("Library.github.captureDiscussionReplies")(function* (
        page: number,
        comment: (typeof DiscussionPage.Type)["data"]["repository"]["discussion"]["comments"]["nodes"][number]
      ) {
        let replyCursor = O.getOrElse(O.fromNullishOr(comment.replies.pageInfo.endCursor), () => "");
        let more = comment.replies.pageInfo.hasNextPage;
        for (const replyPage of A.range(1, 99)) {
          if (!more) break;
          const replyRaw = yield* runLibraryCommand(root, "gh", [
            "api",
            "graphql",
            "-f",
            `query=${replyQuery}`,
            "-f",
            `id=${comment.id}`,
            "-f",
            `cursor=${replyCursor}`,
          ]);
          const reply = yield* decodeLibraryJson(ReplyPage)(replyRaw);
          artifacts.push(
            yield* saveLibraryText(
              root,
              `${prefix}/replies-${page}-${comment.id}-${replyPage}.json`,
              replyRaw,
              "application/json",
              "raw-discussion"
            )
          );
          more = reply.data.node.replies.pageInfo.hasNextPage;
          replyCursor = O.getOrElse(O.fromNullishOr(reply.data.node.replies.pageInfo.endCursor), () => "");
        }
        if (more)
          return yield* LibraryError.make({
            message: "GitHub Discussion replies exceeded bounded pagination.",
            cause: "pagination",
          });
      });
      let cursor = "";
      let exhausted = false;
      const captureDiscussionPage = Effect.fn("Library.github.captureDiscussionPage")(function* (page: number) {
        const raw = yield* runLibraryCommand(root, "gh", [
          "api",
          "graphql",
          "-f",
          `query=${query}`,
          "-f",
          `owner=${owner}`,
          "-f",
          `name=${name}`,
          "-F",
          `number=${discussionNumber.value[1]}`,
          ...(Str.isEmpty(cursor) ? [] : ["-f", `cursor=${cursor}`]),
        ]);
        artifacts.push(
          yield* saveLibraryText(root, `${prefix}/discussion-${page}.json`, raw, "application/json", "raw-discussion")
        );
        const discussionIdentity = yield* decodeLibraryJson(DiscussionIdentity)(raw);
        yield* captureRenameIdentity(discussionIdentity.data.repository.discussion.url);
        const decoded = yield* decodeLibraryJson(DiscussionPage)(raw);
        const comments = decoded.data.repository.discussion.comments;
        for (const comment of comments.nodes) yield* captureDiscussionReplies(page, comment);
        return comments;
      });
      for (const page of A.range(0, 99)) {
        const comments = yield* captureDiscussionPage(page);
        if (!comments.pageInfo.hasNextPage) {
          exhausted = true;
          break;
        }
        cursor = O.getOrElse(O.fromNullishOr(comments.pageInfo.endCursor), () => "");
        if (Str.isEmpty(cursor))
          return yield* LibraryError.make({
            message: "GitHub pagination omitted its continuation cursor.",
            cause: "pagination",
          });
      }
      if (!exhausted)
        return yield* LibraryError.make({
          message: "GitHub Discussion exceeded bounded pagination.",
          cause: "pagination",
        });
    });
    const captureCitedCode = Effect.fn("Library.github.captureCitedCode")(function* () {
      const commits = Str.match(/\/commits(?:\/([^?#]+))?(?:[?#]|$)/)(source.canonicalUrl);
      if (O.isSome(commits)) {
        yield* captureApi("commits", `repos/${slug}/commits?sha=${revision}&per_page=100`);
        return LibraryAdapterResult.make({
          artifacts,
          revision,
          status: "readable",
          complete: true,
          reason: "Cited commit listing captured through paginated GitHub API at the pinned repository revision.",
        });
      }
      const commit = Str.match(/\/commit\/([0-9a-f]{40})(?:[?#]|$)/)(source.canonicalUrl);
      if (O.isSome(commit)) {
        yield* captureGitPatch("cited-commit.diff", [
          "show",
          "--no-ext-diff",
          "--no-textconv",
          "--format=fuller",
          revision,
        ]);
        return LibraryAdapterResult.make({
          artifacts,
          revision,
          status: "readable",
          complete: true,
          reason: "Cited commit diff and metadata retained at resolved SHA.",
        });
      }
      const directory = Str.match(/\/tree\/[^/]+(?:\/(.+?))?(?:[?#]|$)/)(source.canonicalUrl);
      if (O.isSome(directory)) {
        const treePath = directory.value[1] ?? "";
        artifacts.push(
          yield* saveLibraryText(
            root,
            `${prefix}/cited-tree.txt`,
            yield* git(["ls-tree", "-r", "--name-only", Str.isEmpty(treePath) ? revision : `${revision}:${treePath}`]),
            "text/plain",
            "cited-repository-tree"
          )
        );
        return LibraryAdapterResult.make({
          artifacts,
          revision,
          status: "readable",
          complete: true,
          reason: "Cited directory tree retained with a pinned repository checkout.",
        });
      }
      const code = Str.match(/\/blob\/[^/]+\/(.+?)(?:#|$)/)(source.canonicalUrl);
      if (O.isNone(code))
        return LibraryAdapterResult.make({
          artifacts,
          revision,
          status: "blocked",
          complete: false,
          reason: "Repository pinned; cited code locator requires explicit file evidence.",
        });
      artifacts.push(
        yield* saveLibraryText(
          root,
          `${prefix}/cited-code.txt`,
          yield* git(["show", `${revision}:${code.value[1]}`]),
          "text/plain",
          "raw-full-text"
        )
      );
      return undefined;
    });
    const captureIssue = Effect.fn("Library.github.captureIssue")(function* () {
      const number = Str.match(/\/(?:issues|pull)\/(\d+)/)(source.canonicalUrl);
      if (O.isNone(number))
        return yield* LibraryError.make({ message: "Missing cited issue or PR number.", cause: "identity" });
      const n = number.value[1] ?? "";
      yield* captureApi("issue", `repos/${slug}/issues/${n}`);
      yield* captureApi("comments", `repos/${slug}/issues/${n}/comments?per_page=100`);
      if (source.kind === "github-pr") yield* capturePull(n);
    });
    const captureRelease = Effect.fn("Library.github.captureRelease")(function* () {
      const tag = Str.match(/\/releases\/tag\/([^?#]+)/)(source.canonicalUrl);
      const encodedTag = O.isSome(tag)
        ? yield* Effect.try({
            try: () => encodeURIComponent(decodeURIComponent(tag.value[1] ?? "")),
            catch: () =>
              LibraryError.make({ message: "Release tag contains invalid URL encoding.", cause: "identity" }),
          })
        : "";
      yield* captureApi(
        "release",
        O.isSome(tag) ? `repos/${slug}/releases/tags/${encodedTag}` : `repos/${slug}/releases?per_page=100`
      );
    });
    const result = yield* Match.value(source.kind).pipe(
      Match.when(Match.is("github-issue", "github-pr"), () => captureIssue()),
      Match.when("github-release", () => captureRelease()),
      Match.when("github-discussion", () => captureDiscussion()),
      Match.when("github-code", () => captureCitedCode()),
      Match.orElse(() => Effect.void)
    );
    if (result !== undefined) return result;
    return LibraryAdapterResult.make({
      artifacts,
      revision,
      status: "readable",
      complete: true,
      reason: "Repository retained as pinned Git objects with separate cited discussion/code evidence.",
    });
  }).pipe(
    Effect.timeout("8 minutes"),
    Effect.catch((error) =>
      Effect.succeed(
        LibraryAdapterResult.make({
          artifacts,
          revision,
          status: "blocked",
          complete: false,
          reason: S.is(LibraryError)(error)
            ? `Repository retained; cited resource incomplete: ${error.message}`
            : "Repository retained; cited resource acquisition failed or timed out after partial evidence was preserved.",
        })
      )
    )
  );
});
