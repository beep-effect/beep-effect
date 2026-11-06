import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { GitHubApp } from "@beep/github/GitHubApp";
import { GitHubClient } from "@beep/github/GitHubClient";
import {
  GitHubAppAuth,
  isReviewerSummary,
  loadReviewerCredentials,
  makeGitHubAppAuth,
  mintReviewerToken,
  Reviewer,
  ReviewerAnnotation,
  ReviewerCredentials,
  ReviewerLive,
  ReviewerResult,
  ReviewerReview,
  releaseReviewerInRuleset,
  requireReviewerInRuleset,
  reviewerCheckExternalId,
  reviewerCheckSatisfied,
  reviewerConclusion,
  reviewerDocsOnly,
} from "@beep/repo-cli/commands/Reviewer";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import { githubFetch, reply } from "./support/GithubFetch.ts";

const Json = S.fromJsonString(S.Unknown);
const encodeJson = S.encodeEffect(Json);
const decodeJson = S.decodeUnknownEffect(Json);
const decodeObject = S.Record(S.String, S.Unknown).pipe(S.decodeUnknownEffect);
const decodeClaims = S.Struct({ iat: S.Int, exp: S.Int, iss: S.String }).pipe(S.decodeUnknownEffect);
const Requests = S.Struct({
  output: S.Struct({ annotations: S.Unknown.pipe(S.Array, S.optionalKey) }).pipe(S.optionalKey),
  event: S.optionalKey(S.String),
}).pipe(S.Array);
const decodeRequests = S.decodeUnknownEffect(Requests);
const decodeReview = ReviewerReview.pipe(S.fromJsonString, S.decodeUnknownEffect);
const ReviewerResultJson = S.fromJsonString(ReviewerResult);
const ReviewerResultArbitrary = Arbitrary.schema(ReviewerResult);
const encodeReviewerResult = S.encodeResult(ReviewerResultJson);
const decodeReviewerResult = S.decodeResult(ReviewerResultJson);
const sameReviewerResult = S.toEquivalence(ReviewerResult);
const sha = Str.repeat(40)("a");
const baseSha = Str.repeat(40)("b");
const check = (id: number, app = 42, status = "in_progress", conclusion: string | null = null, pr = 7) => ({
  id,
  name: "beep-reviewer",
  head_sha: sha,
  status,
  conclusion,
  app: { id: app },
  external_id: reviewerCheckExternalId(pr, sha, baseSha),
});
const completionFixture = (state: string) => ({
  pull: {
    head: { ref: "feature", sha: state === "stale" ? Str.repeat(40)("c") : sha },
    base: { ref: "main", sha: state === "base-moved" ? Str.repeat(40)("d") : baseSha },
  },
  run:
    state === "unassociated"
      ? { ...check(2), external_id: "invalid-association" }
      : state === "stale" || state === "base-moved"
        ? check(2)
        : check(2, 42, "completed", state),
});
const summary = (
  app: number | null = 42,
  login = "beep-reviewer[bot]",
  body = "<!-- beep-reviewer:summary -->\nOld"
) => ({
  id: 12,
  body,
  user: { login, type: Str.endsWith("[bot]")(login) ? "Bot" : "User" },
  performed_via_github_app: app === null ? null : { id: app },
});
const result = (p0 = 0, p1 = 0) =>
  ReviewerResult.make({
    score: 4,
    tier: "L2",
    p0,
    p1,
    p2: 2,
    summary: "Two suggestions",
    conclusion: "auto",
    annotations: [],
  });
const auth = Layer.succeed(GitHubAppAuth, GitHubAppAuth.of({ appId: 42 }));
// The full pull-request payload the kit's `PullRequest` projection decodes.
const pull = ({
  number = 7,
  state = "open",
  head = sha,
  base = baseSha,
  changed_files = 2,
}: {
  number?: number;
  state?: string;
  head?: string;
  base?: string;
  changed_files?: number;
} = {}) => ({
  number,
  node_id: `PR_${number}`,
  html_url: `https://github.com/beep-effect/beep-effect/pull/${number}`,
  title: "Fixture",
  state,
  draft: false,
  merged: false,
  merged_at: null,
  head: { ref: "feature", sha: head },
  base: { ref: "main", sha: base },
  changed_files,
});
const changedFile = (filename: string) => ({ filename, status: "modified", additions: 1, deletions: 0 });

// Every response passes through the `@beep/github` transport's `fetch` seam; no network or real credentials.
type Handler = (method: string, url: URL, body: unknown) => unknown;
const current: { handler: Handler } = { handler: () => ({}) };
const transport = githubFetch((call) => current.handler(call.method, call.url, call.body));
const HttpTestLayer = ReviewerLive.pipe(
  Layer.provide(auth),
  Layer.provide(
    GitHubClient.layerFromToken({
      token: Redacted.make("opaque-token-of-arbitrary-length"),
      retry: "off",
      fetch: transport.fetch,
    })
  )
);
const client = (handler: Handler): Handler => handler;
const usingHttp =
  (handler: Handler) =>
  <A, E, R>(program: Effect.Effect<A, E, R>) =>
    Effect.sync(() => {
      current.handler = handler;
    }).pipe(Effect.andThen(program));

describe("reviewer conclusions and identity", () => {
  it.prop(
    "round-trips schema-generated review results through JSON",
    { value: ReviewerResultArbitrary },
    ({ value }) => {
      const encoded = Result.getOrThrow(encodeReviewerResult(value));
      const decoded = Result.getOrThrow(decodeReviewerResult(encoded));
      expect(sameReviewerResult(value, decoded)).toBe(true);
    }
  );
  it.effect("fails P0/P1 and succeeds P2-only results", () =>
    Effect.sync(() => {
      expect(reviewerConclusion(result())).toBe("success");
      expect(reviewerConclusion(result(1))).toBe("failure");
      expect(reviewerConclusion(result(0, 1))).toBe("failure");
      expect(reviewerConclusion({ ...result(1), conclusion: "neutral" })).toBe("neutral");
    })
  );
  it.effect("requires marker, bot login, actor type, and matching originating App", () =>
    Effect.sync(() => {
      expect(isReviewerSummary(summary(), 42)).toBe(true);
      expect(isReviewerSummary(summary(99), 42)).toBe(false);
      expect(isReviewerSummary(summary(null), 42)).toBe(false);
      expect(isReviewerSummary(summary(42, "kriegcloud"), 42)).toBe(false);
      expect(isReviewerSummary(summary(42, "other[bot]"), 42)).toBe(false);
      expect(isReviewerSummary(summary(42, "beep-reviewer[bot]", "No marker"), 42)).toBe(false);
    })
  );
  it.effect("requires the newest run for the exact App, PR, head, and base", () =>
    Effect.sync(() => {
      expect(reviewerCheckSatisfied([check(1, 99, "completed", "success")], sha, 42, 7, baseSha)).toBe(false);
      expect(reviewerCheckSatisfied([check(1, 42, "completed", "success")], Str.repeat(40)("c"), 42, 7, baseSha)).toBe(
        false
      );
      expect(reviewerCheckSatisfied([check(1, 42, "completed", "success"), check(2)], sha, 42, 7, baseSha)).toBe(false);
      expect(reviewerCheckSatisfied([check(1, 42, "completed", "success")], sha, 42, 7, baseSha)).toBe(true);
      const codeFailure = check(1, 42, "completed", "failure");
      const newerDocsSuccess = check(2, 42, "completed", "success", 8);
      expect(reviewerCheckSatisfied([codeFailure, newerDocsSuccess], sha, 42, 7, baseSha)).toBe(false);
      expect(reviewerCheckSatisfied([newerDocsSuccess], sha, 42, 7, baseSha)).toBe(false);
      expect(reviewerCheckSatisfied([check(3, 42, "completed", "success")], sha, 42, 7, Str.repeat(40)("d"))).toBe(
        false
      );
    })
  );
  it.effect("does not classify a code-to-doc rename or empty file list as L0", () =>
    Effect.sync(() => {
      expect(reviewerDocsOnly([{ filename: "docs/app.md" }])).toBe(true);
      expect(reviewerDocsOnly([{ filename: "docs/app.md", previous_filename: "src/app.ts" }])).toBe(false);
      expect(reviewerDocsOnly([{ filename: ".github/agents/gate.md" }])).toBe(false);
      expect(reviewerDocsOnly([])).toBe(false);
    })
  );
  it.effect("requires review for agent instructions, release metadata, and test inputs", () =>
    Effect.sync(() => {
      for (const filename of [
        "AGENTS.md",
        "CLAUDE.md",
        "GEMINI.md",
        "SKILL.md",
        "packages/foo/AGENTS.md",
        ".agents/guide.md",
        ".codex/guide.md",
        ".cursor/rules.md",
        ".grok/skills/review/SKILL.md",
        ".changeset/release.md",
        "apps/labs/semantica/fixtures/input.txt",
        "test/README.md",
        "tests/data.md",
        "docs/fixtures/input.md",
        "docs/test/example.md",
        "docs/.config/readme.md",
        "docs/AGENTS.md",
        "src/input.txt",
      ]) {
        expect(reviewerDocsOnly([{ filename }]), filename).toBe(false);
        expect(reviewerDocsOnly([{ filename: "docs/moved.md", previous_filename: filename }]), filename).toBe(false);
      }
      for (const filename of [
        "docs/ops/reviewer.md",
        "docs/reference.mdx",
        "docs/manual.rst",
        "README.md",
        "packages/foo/README.en.md",
      ]) {
        expect(reviewerDocsOnly([{ filename }]), filename).toBe(true);
      }
    })
  );
  it.effect("rejects APPROVE and REQUEST_CHANGES at the JSON boundary", () =>
    Effect.gen(function* () {
      for (const event of ["APPROVE", "REQUEST_CHANGES"]) {
        const input = yield* encodeJson({ body: "Review", comments: [], event });
        expect((yield* decodeReview(input).pipe(Effect.result))._tag).toBe("Failure");
      }
    })
  );
});

it.layer(HttpTestLayer, { timeout: "30 seconds" })("reviewer HTTP operations", (it) => {
  it.effect("classifies L0 with App-authenticated HTTP and refuses truncated or changing heads", () =>
    Effect.gen(function* () {
      const files = [changedFile("docs/app.md"), changedFile("README.md")];
      const http = client((_method, url) =>
        Str.endsWith("/files")(url.pathname) ? files : Str.endsWith("/pulls")(url.pathname) ? [pull()] : pull()
      );
      const pipe1 = yield* Reviewer.use((reviewer) => reviewer.docsOnly(7, sha)).pipe(usingHttp(http));
      assertSome(pipe1, baseSha);
      const sharedHead = client((_method, url) =>
        Str.endsWith("/files")(url.pathname)
          ? files
          : Str.endsWith("/pulls")(url.pathname)
            ? [pull(), pull({ number: 8 })]
            : pull()
      );
      const pipe2 = yield* Reviewer.use((reviewer) => reviewer.docsOnly(7, sha)).pipe(usingHttp(sharedHead));
      assertNone(pipe2);
      const missingAssociation = client((_method, url) =>
        Str.endsWith("/files")(url.pathname) ? files : Str.endsWith("/pulls")(url.pathname) ? [] : pull()
      );
      const pipe3 = yield* Reviewer.use((reviewer) => reviewer.docsOnly(7, sha)).pipe(usingHttp(missingAssociation));
      assertNone(pipe3);
      let reads = 0;
      const moved = client((_method, url) => {
        if (Str.endsWith("/files")(url.pathname)) return files;
        reads += 1;
        return pull({ head: reads === 1 ? sha : Str.repeat(40)("c") });
      });
      const outcome = yield* Reviewer.use((reviewer) => reviewer.docsOnly(7, sha)).pipe(
        usingHttp(moved),
        Effect.result
      );
      expect(outcome._tag).toBe("Failure");
      let baseReads = 0;
      const movedBase = client((_method, url) => {
        if (Str.endsWith("/files")(url.pathname)) return files;
        baseReads += 1;
        return pull({ base: baseReads === 1 ? baseSha : Str.repeat(40)("d") });
      });
      expect(
        (yield* Reviewer.use((reviewer) => reviewer.docsOnly(7, sha)).pipe(usingHttp(movedBase), Effect.result))._tag
      ).toBe("Failure");
      const truncated = client(() => pull({ changed_files: 3000 }));
      expect(
        (yield* Reviewer.use((reviewer) => reviewer.docsOnly(7, sha)).pipe(usingHttp(truncated), Effect.result))._tag
      ).toBe("Failure");
    })
  );
  it.effect("reuses only this PR and base's in-progress check", () =>
    Effect.gen(function* () {
      let creates = 0;
      const http = client((method, url) => {
        if (Str.endsWith("/pulls/7")(url.pathname)) return pull();
        if (method === "POST") {
          creates += 1;
          return { id: 44 };
        }
        return { total_count: 2, check_runs: [check(1, 99), check(2)] };
      });
      const id = yield* Reviewer.use((reviewer) => reviewer.start(7, sha)).pipe(usingHttp(http));
      expect(id).toBe(2);
      expect(creates).toBe(0);
      let postedBody: unknown;
      const otherPr = client((method, url, body) => {
        if (Str.endsWith("/pulls/7")(url.pathname)) return pull();
        if (method === "POST") {
          postedBody = body;
          return { id: 44 };
        }
        return { total_count: 1, check_runs: [check(3, 42, "in_progress", null, 8)] };
      });
      const pipe4 = yield* Reviewer.use((reviewer) => reviewer.start(7, sha)).pipe(usingHttp(otherPr));
      expect(pipe4).toBe(44);
      expect((yield* decodeObject(postedBody)).external_id).toBe(reviewerCheckExternalId(7, sha, baseSha));
      const changedSinceClassification = client((_method, url) => {
        if (Str.endsWith("/pulls/7")(url.pathname)) return pull({ base: Str.repeat(40)("d") });
        return { total_count: 0, check_runs: [] };
      });
      expect(
        (yield* Reviewer.use((reviewer) => reviewer.start(7, sha, O.some(baseSha))).pipe(
          usingHttp(changedSinceClassification),
          Effect.result
        ))._tag
      ).toBe("Failure");
    })
  );
  it.effect("stops an empty check page even when the total count is inflated", () =>
    Effect.gen(function* () {
      let pages = 0;
      let creates = 0;
      const http = client((method, url) => {
        if (Str.endsWith("/pulls/7")(url.pathname)) return pull();
        if (method === "POST") {
          creates += 1;
          return { id: 44 };
        }
        pages += 1;
        return { total_count: 999, check_runs: [] };
      });
      const pipe5 = yield* Reviewer.use((reviewer) => reviewer.start(7, sha)).pipe(usingHttp(http));
      expect(pipe5).toBe(44);
      expect(pages).toBe(1);
      expect(creates).toBe(1);
    })
  );
  it.effect("cancels only an App-owned active check and preserves terminal results", () =>
    Effect.gen(function* () {
      const cases = [
        { run: check(2), active: true },
        { run: check(2, 42, "completed", "success"), active: false },
        { run: check(2, 42, "completed", "cancelled"), active: false },
        { run: check(2, 99), active: false },
      ];
      for (const { run, active } of cases) {
        const writes: Array<unknown> = [];
        const http = client((method, _url, body) => {
          if (method === "GET") return run;
          writes.push(body);
          return { id: 2 };
        });
        const outcome = yield* Reviewer.use((reviewer) => reviewer.cancel(2, "Superseded")).pipe(
          usingHttp(http),
          Effect.result
        );
        expect(outcome._tag).toBe(active ? "Success" : "Failure");
        expect(writes.length).toBe(active ? 1 : 0);
        if (active) expect((yield* decodeObject(writes[0])).conclusion).toBe("cancelled");
      }
    })
  );
  it.effect("edits the same owned summary twice and ignores copied markers", () =>
    Effect.gen(function* () {
      const paths: Array<string> = [];
      let creates = 0;
      const http = client((method, url) => {
        if (method === "GET") return [summary(99), summary()];
        paths.push(url.pathname);
        if (method === "POST") creates += 1;
        return { id: 12 };
      });
      yield* Reviewer.use((reviewer) =>
        Effect.gen(function* () {
          const upsert6 = yield* reviewer.upsert(7, "First");
          expect(upsert6).toBe(12);
          const upsert7 = yield* reviewer.upsert(7, "Second");
          expect(upsert7).toBe(12);
        })
      ).pipe(usingHttp(http));
      expect(creates).toBe(0);
      expect(paths).toEqual([
        "/repos/beep-effect/beep-effect/issues/comments/12",
        "/repos/beep-effect/beep-effect/issues/comments/12",
      ]);
    })
  );
  it.effect("batches 101 annotations as 50, 50, 1 before completing", () =>
    Effect.gen(function* () {
      const bodies: Array<unknown> = [];
      const http = client((method, url, body) => {
        if (Str.endsWith("/pulls/7")(url.pathname)) return pull();
        if (method === "GET") return check(2);
        bodies.push(body);
        return { id: 2 };
      });
      const annotations = A.makeBy(101, () =>
        ReviewerAnnotation.make({
          path: "README.md",
          start_line: 1,
          end_line: 1,
          annotation_level: "warning",
          message: "Clarify",
        })
      );
      yield* Reviewer.use((reviewer) => reviewer.complete(2, ReviewerResult.make({ ...result(), annotations }))).pipe(
        usingHttp(http)
      );
      const requests = yield* decodeRequests(bodies);
      expect(A.map(requests, (body) => body.output?.annotations?.length ?? 0)).toEqual([50, 50, 1, 0]);
      const last = yield* decodeObject(bodies[3]);
      expect(last.conclusion).toBe("success");
    })
  );
  it.effect("rejects completed, unassociated, and stale head/base check runs without writes", () =>
    Effect.gen(function* () {
      for (const state of ["cancelled", "success", "stale", "base-moved", "unassociated"]) {
        let writes = 0;
        const { pull: completion, run } = completionFixture(state);
        const http = client((method, url) => {
          if (method !== "GET") writes += 1;
          return Str.endsWith("/pulls/7")(url.pathname) ? { ...pull(), ...completion } : run;
        });
        const outcome = yield* Reviewer.use((reviewer) => reviewer.complete(2, result())).pipe(
          usingHttp(http),
          Effect.result
        );
        expect(outcome._tag, state).toBe("Failure");
        expect(writes, state).toBe(0);
      }
    })
  );
  it.effect("does not complete if the check is cancelled while annotations publish", () =>
    Effect.gen(function* () {
      let cancelled = false;
      let completions = 0;
      const http = client((method, url) => {
        if (Str.endsWith("/pulls/7")(url.pathname)) return pull();
        if (method === "GET")
          return check(2, 42, cancelled ? "completed" : "in_progress", cancelled ? "cancelled" : null);
        if (cancelled) completions += 1;
        cancelled = true;
        return { id: 2 };
      });
      const annotations = [
        ReviewerAnnotation.make({
          path: "README.md",
          start_line: 1,
          end_line: 1,
          annotation_level: "warning",
          message: "Clarify",
        }),
      ];
      const outcome = yield* Reviewer.use((reviewer) =>
        reviewer.complete(2, ReviewerResult.make({ ...result(), annotations }))
      ).pipe(usingHttp(http), Effect.result);
      expect(outcome._tag).toBe("Failure");
      expect(completions).toBe(0);
    })
  );
  it.effect("refuses to mutate another App's check", () =>
    Effect.gen(function* () {
      let writes = 0;
      const http = client((method) => {
        if (method !== "GET") writes += 1;
        return check(2, 99);
      });
      const outcome = yield* Reviewer.use((reviewer) => reviewer.complete(2, result())).pipe(
        usingHttp(http),
        Effect.result
      );
      expect(outcome._tag).toBe("Failure");
      expect(writes).toBe(0);
    })
  );
  it.effect("posts COMMENT only and pins the current head", () =>
    Effect.gen(function* () {
      const bodies: Array<unknown> = [];
      const http = client((method) => {
        if (method === "GET") return pull();
        return (body: unknown) => body;
      });
      const posting = client((method, _url, body) => {
        if (method === "GET") return pull();
        bodies.push(body);
        return { id: 55 };
      });
      yield* Reviewer.use((reviewer) =>
        reviewer.review(7, sha, ReviewerReview.make({ body: "Notes", comments: [] }))
      ).pipe(usingHttp(posting));
      const posted = yield* decodeObject(bodies[0]);
      expect(posted.event).toBe("COMMENT");
      expect(posted.commit_id).toBe(sha);
      const stale = yield* Reviewer.use((reviewer) => reviewer.start(7, Str.repeat(40)("b"))).pipe(
        usingHttp(http),
        Effect.result
      );
      expect(stale._tag).toBe("Failure");
    })
  );
});

describe("lossless required check update", () => {
  it.effect("preserves unrelated rules, checks, parameters, conditions and bypass actors", () =>
    Effect.gen(function* () {
      const original = {
        name: "main",
        target: "branch",
        enforcement: "active",
        bypass_actors: [{ actor_id: 9, actor_type: "Integration", bypass_mode: "always" }],
        conditions: { ref_name: { include: ["~DEFAULT_BRANCH"], exclude: [] } },
        rules: [
          { type: "pull_request", parameters: { required_approving_review_count: 0, future_field: "keep" } },
          {
            type: "required_status_checks",
            parameters: {
              strict_required_status_checks_policy: true,
              do_not_enforce_on_create: false,
              required_status_checks: [
                { context: "CI", integration_id: 15368 },
                { context: "beep-reviewer", integration_id: null },
              ],
            },
          },
        ],
      };
      const updated = yield* requireReviewerInRuleset(original, 42);
      expect(updated).toEqual({
        ...original,
        rules: [
          original.rules[0],
          {
            ...original.rules[1],
            parameters: {
              ...original.rules[1]?.parameters,
              required_status_checks: [
                { context: "CI", integration_id: 15368 },
                { context: "beep-reviewer", integration_id: 42 },
              ],
            },
          },
        ],
      });
      const requireReviewerInRuleset8 = yield* requireReviewerInRuleset(updated, 42);
      expect(requireReviewerInRuleset8).toEqual(updated);
      const released = yield* releaseReviewerInRuleset(updated);
      expect(released).toEqual({
        ...original,
        rules: [
          original.rules[0],
          {
            ...original.rules[1],
            parameters: {
              ...original.rules[1]?.parameters,
              required_status_checks: [{ context: "CI", integration_id: 15368 }],
            },
          },
        ],
      });
      const releaseReviewerInRuleset9 = yield* releaseReviewerInRuleset(released);
      expect(releaseReviewerInRuleset9).toEqual(released);
      const requireReviewerInRuleset10 = yield* requireReviewerInRuleset(released, 42);
      expect(requireReviewerInRuleset10).toEqual(updated);
    })
  );

  it.effect("refuses malformed rulesets in both require and release without losing the policy error", () =>
    Effect.gen(function* () {
      for (const value of [
        null,
        { rules: "invalid" },
        { rules: [{ type: "required_status_checks", parameters: {} }] },
      ]) {
        const required = yield* requireReviewerInRuleset(value, 42).pipe(Effect.flip);
        const released = yield* releaseReviewerInRuleset(value).pipe(Effect.flip);
        expect(required.message).toBe("Cannot safely update this ruleset.");
        expect(released.message).toBe("Cannot safely update this ruleset.");
      }
    })
  );

  it.effect("refuses an ambiguous release", () =>
    Effect.gen(function* () {
      const checks = { type: "required_status_checks", parameters: { required_status_checks: [] } };
      const result = yield* releaseReviewerInRuleset({ rules: [checks, checks] }).pipe(Effect.result);
      expect(result._tag).toBe("Failure");
    })
  );
});

// Generated in memory for this suite; neither private key nor installation token is persisted.
const reviewerKey = Effect.gen(function* () {
  const pair = yield* Effect.promise(() =>
    crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"]
    )
  );
  const der = yield* Effect.promise(() => crypto.subtle.exportKey("pkcs8", pair.privateKey));
  // WebCrypto exports PKCS#8. Extract its RSA OCTET STRING to exercise GitHub's PKCS#1 PEM.
  const bytes = new Uint8Array(der);
  const contentOffset = (offset: number) =>
    offset +
    (bytes[offset + 1] === undefined || (bytes[offset + 1] ?? 0) < 128 ? 2 : 2 + ((bytes[offset + 1] ?? 0) & 127));
  const contentLength = (offset: number) => {
    const first = bytes[offset + 1] ?? 0;
    return first < 128
      ? first
      : A.reduce(A.fromIterable(bytes.slice(offset + 2, offset + 2 + (first & 127))), 0, (n, byte) => n * 256 + byte);
  };
  let offset = contentOffset(0);
  offset = contentOffset(offset) + contentLength(offset); // version
  offset = contentOffset(offset) + contentLength(offset); // algorithm
  expect(bytes[offset]).toBe(4); // PrivateKey OCTET STRING
  const pkcs1 = bytes.slice(contentOffset(offset), contentOffset(offset) + contentLength(offset));
  const pem = `-----BEGIN RSA PRIVATE KEY-----\n${Buffer.from(pkcs1).toString("base64")}\n-----END RSA PRIVATE KEY-----`; // gitleaks:allow -- format marker only; key generated in memory. nosemgrep: semgrep.beep-hardcoded-private-key
  return { publicKey: pair.publicKey, pem };
});

const grantedAll = { checks: "write", pull_requests: "write", issues: "write", contents: "read", metadata: "read" };

// A fake GitHub App API: mints `opaque-<n>` tokens an hour past `clock.now`, records revocations,
// and answers every other call with the bearer it carried.
const appApi = (granted: Record<string, string>) => {
  const clock = { now: 0 };
  const revoked: Array<string> = [];
  let exchanges = 0;
  const api = githubFetch((call) => {
    if (call.method === "POST" && Str.endsWith("/access_tokens")(call.url.pathname)) {
      exchanges += 1;
      return reply(201)({
        token: `opaque-${exchanges}`,
        expires_at: DateTime.formatIso(DateTime.makeUnsafe(clock.now + 3_600_000)),
        permissions: granted,
      });
    }
    if (call.method === "DELETE" && call.url.pathname === "/installation/token") {
      revoked.push(call.authorization);
      return reply(204)();
    }
    return { bearer: call.authorization };
  });
  return { ...api, clock, revoked, exchanges: () => exchanges };
};

const reviewerCredentials = (pem: string) =>
  ReviewerCredentials.make({
    appId: 42,
    clientId: "Iv.test-client",
    installationId: 77,
    privateKey: Redacted.make(pem),
  });

const Bearer = S.Struct({ bearer: S.String });
const readBearer = GitHubClient.use((client) =>
  client.requestDecoded("GET /repos/{owner}/{repo}", { owner: "beep-effect", repo: "beep-effect" }, Bearer)
).pipe(Effect.map((answer) => answer.bearer));

describe("installation token client", () => {
  it.effect("signs RS256 in memory, scopes and checks tokens, shares refresh, and re-mints five minutes early", () =>
    Effect.gen(function* () {
      const key = yield* reviewerKey;
      const api = appApi(grantedAll);
      const context = yield* Layer.build(
        makeGitHubAppAuth(reviewerCredentials(key.pem), { fetch: api.fetch, retry: "off" })
      );
      expect(Context.get(context, GitHubAppAuth).appId).toBe(42);
      // The permission-check token is minted first and handed back; the client mints its own.
      expect(api.exchanges()).toBe(2);
      expect(api.revoked).toEqual(["token opaque-1"]);
      const bearer = readBearer.pipe(Effect.provideContext(context));
      const bearer11 = yield* bearer;
      expect(bearer11).toBe("token opaque-2");
      // A single test owns this clock; assert the absolute refresh boundary.
      api.clock.now = Duration.toMillis(Duration.minutes(54));
      yield* TestClock.setTime(api.clock.now);
      const bearer12 = yield* bearer;
      expect(bearer12).toBe("token opaque-2");
      api.clock.now = Duration.toMillis(Duration.minutes(55));
      yield* TestClock.setTime(api.clock.now);
      const all13 = yield* Effect.all([bearer, bearer], { concurrency: 2 });
      expect(all13).toEqual(["token opaque-3", "token opaque-3"]);
      expect(api.exchanges()).toBe(3);
      expect(api.revoked).toEqual(["token opaque-1", "token opaque-2"]);
      const mints = A.filter(api.calls, (call) => Str.endsWith("/access_tokens")(call.url.pathname));
      expect(A.map(mints, (call) => call.url.pathname)).toEqual(A.replicate("/app/installations/77/access_tokens", 3));
      for (const mint of mints) {
        expect(mint.body).toEqual({
          permissions: grantedAll,
          repositories: ["beep-effect"],
        });
      }
      const jwt = Str.split(".")(Str.slice(7)(O.getOrThrow(A.head(mints)).authorization));
      const claims = yield* decodeJson(Buffer.from(jwt[1] ?? "", "base64url").toString()).pipe(
        Effect.flatMap(decodeClaims)
      );
      expect(claims.iss).toBe("Iv.test-client");
      expect(claims.exp - claims.iat).toBe(600);
      const promise14 = yield* Effect.promise(() =>
        crypto.subtle.verify(
          "RSASSA-PKCS1-v1_5",
          key.publicKey,
          Buffer.from(jwt[2] ?? "", "base64url"),
          new TextEncoder().encode(`${jwt[0]}.${jwt[1]}`)
        )
      );
      expect(promise14).toBe(true);
    })
  );

  it.effect("fails closed and revokes a token granted below the reviewer permissions", () =>
    Effect.gen(function* () {
      const key = yield* reviewerKey;
      const api = appApi({ ...grantedAll, checks: "read" });
      const error = yield* Layer.build(
        makeGitHubAppAuth(reviewerCredentials(key.pem), { fetch: api.fetch, retry: "off" })
      ).pipe(Effect.flip);
      expect(error).toMatchObject({ operation: "token", message: "Reviewer installation token exchange failed." });
      expect(api.exchanges()).toBe(1);
      expect(api.revoked).toEqual(["token opaque-1"]);
    })
  );

  it.effect("reports an unusable signing key as a jwt failure without any exchange", () =>
    Effect.gen(function* () {
      const api = appApi(grantedAll);
      const error = yield* Layer.build(
        makeGitHubAppAuth(reviewerCredentials("not a key"), { fetch: api.fetch, retry: "off" })
      ).pipe(Effect.flip);
      expect(error).toMatchObject({ operation: "jwt", message: "Reviewer installation token exchange failed." });
      expect(api.calls).toEqual([]);
    })
  );

  it.effect("mints one checked token for the token command without revoking it", () =>
    Effect.gen(function* () {
      const key = yield* reviewerKey;
      const api = appApi(grantedAll);
      const app = yield* Layer.build(GitHubApp.layerWith({ fetch: api.fetch, retry: "off" }));
      const minted = yield* mintReviewerToken(reviewerCredentials(key.pem)).pipe(Effect.provideContext(app));
      expect(Redacted.value(minted.token)).toBe("opaque-1");
      expect(api.revoked).toEqual([]);
    })
  );
});

// The op reads run through `@beep/commands` `Run`; a scripted spawner answers them by reference.
const reviewerSecrets: Record<string, string> = {
  app_id: "42",
  client_id: "Iv.test-client",
  installation_id: "77",
  private_key: "PEM\n",
};
const opReference = (field: string) => `op://BEEP_SECRETS/beep-reviewer GitHub App/${field}`;
// The argv each lane reads a field with: the local `op` shim, or `op` on the SSH host.
const readLines = (field: string) => [
  `op read ${opReference(field)}`,
  `ssh -o BatchMode=yes -- dankstation op read '${opReference(field)}'`,
];
const opScript = (refused: ReadonlyArray<string>) =>
  ScriptedSpawner.make((command, args) => {
    const line = A.join([command, ...args], " ");
    const field = A.findFirst(R.keys(reviewerSecrets), (name) => A.contains(readLines(name), line));
    return O.match(
      O.filter(field, (name) => !A.contains(refused, name)),
      {
        onNone: () =>
          Str.endsWith("op-doctor")(line) ? { exit: 0 } : { exit: 1, stderr: "[ERROR] could not read secret" },
        onSome: (name) => ({ stdout: reviewerSecrets[name] ?? "" }),
      }
    );
  });
const loadWith = (spawner: ScriptedSpawner, env: Record<string, string> = {}) =>
  Effect.flatMap(Layer.build(spawner.layer), (context) =>
    loadReviewerCredentials.pipe(
      Effect.provideContext(context),
      Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env))
    )
  );

describe("reviewer credentials", () => {
  it.effect("reads every field through op when no environment variable carries it", () =>
    Effect.gen(function* () {
      const spawner = opScript([]);
      const credentials = yield* loadWith(spawner, { BEEP_REVIEWER_APP_ID: "42" });
      expect(credentials.clientId).toBe("Iv.test-client");
      expect(credentials.installationId).toBe(77);
      expect(Redacted.value(credentials.privateKey)).toBe("PEM");
      expect(A.map(spawner.spawns, (spawn) => [spawn.command, ...spawn.args])).toEqual([
        ["op", "read", opReference("client_id")],
        ["op", "read", opReference("installation_id")],
        ["op", "read", opReference("private_key")],
      ]);
    })
  );

  it.effect("reads through ssh on the configured host", () =>
    Effect.gen(function* () {
      const spawner = opScript([]);
      yield* loadWith(spawner, { BEEP_REVIEWER_OP_SSH: "dankstation" });
      expect(spawner.spawns[0]?.args).toEqual([
        "-o",
        "BatchMode=yes",
        "--",
        "dankstation",
        `op read '${opReference("app_id")}'`,
      ]);
    })
  );

  it.effect("runs op-doctor once and stops the secret path on a refused read", () =>
    Effect.gen(function* () {
      const spawner = opScript(["client_id"]);
      const error = yield* loadWith(spawner).pipe(Effect.flip);
      expect(error.message).toBe("op op read field client_id failed; op-doctor ran once. Secret path stopped.");
      expect(A.map(spawner.spawns, (spawn) => spawn.command)).toEqual(["op", "op", "op-doctor"]);
      const remote = opScript(["app_id"]);
      const remoteError = yield* loadWith(remote, { BEEP_REVIEWER_OP_SSH: "dankstation" }).pipe(Effect.flip);
      expect(remoteError.message).toBe("ssh op read field app_id failed; op-doctor ran once. Secret path stopped.");
      expect(remote.spawns[1]?.args).toEqual(["-o", "BatchMode=yes", "--", "dankstation", "op-doctor"]);
    })
  );

  it.effect("refuses credentials that do not decode", () =>
    Effect.gen(function* () {
      const error = yield* loadWith(opScript([]), { BEEP_REVIEWER_APP_ID: "not-a-number" }).pipe(Effect.flip);
      expect(error.message).toBe("Reviewer credentials could not be resolved or validated.");
    })
  );
});
