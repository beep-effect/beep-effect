import {
  GitHubAppAuth,
  isReviewerSummary,
  makeGitHubAppAuth,
  Reviewer,
  ReviewerAnnotation,
  ReviewerCredentials,
  ReviewerLive,
  ReviewerResult,
  ReviewerReview,
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
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";

const Json = S.fromJsonString(S.Unknown);
const encodeJson = S.encodeEffect(Json);
const decodeJson = S.decodeUnknownEffect(Json);
const decodeObject = S.Record(S.String, S.Unknown).pipe(S.decodeUnknownEffect);
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
const sha = "a".repeat(40);
const baseSha = "b".repeat(40);
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
    head: { sha: state === "stale" ? "c".repeat(40) : sha },
    base: { sha: state === "base-moved" ? "d".repeat(40) : baseSha },
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
  user: { login, type: login.endsWith("[bot]") ? "Bot" : "User" },
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
const auth = Layer.succeed(
  GitHubAppAuth,
  GitHubAppAuth.of({ appId: 42, token: Effect.succeed(Redacted.make("opaque-token-of-arbitrary-length")) })
);

// Every response passes through Effect's HttpClient seam; no network or real credentials.
const client = (handler: (method: string, url: URL, body: unknown) => unknown) =>
  HttpClient.make((request, url) =>
    Effect.gen(function* () {
      const body =
        request.body._tag === "Uint8Array" ? yield* decodeJson(new TextDecoder().decode(request.body.body)) : undefined;
      const output = handler(request.method, url, body);
      return HttpClientResponse.fromWeb(
        request,
        new Response(yield* encodeJson(output), { status: 200, headers: { "content-type": "application/json" } })
      );
    }).pipe(Effect.orDie)
  );
class MockClient extends Context.Service<MockClient, Ref.Ref<HttpClient.HttpClient>>()(
  "@beep/repo-cli/test/reviewer.test/MockClient"
) {}
const MockClientLive = Layer.effect(MockClient, Ref.make(client(() => ({}))));
const HttpProxy = Layer.effect(
  HttpClient.HttpClient,
  Effect.gen(function* () {
    const current = yield* MockClient;
    return HttpClient.make((request) => Ref.get(current).pipe(Effect.flatMap((http) => http.execute(request))));
  })
);
const HttpTestLayer = ReviewerLive.pipe(
  Layer.provide(auth),
  Layer.provide(HttpProxy),
  Layer.provideMerge(MockClientLive)
);
const usingHttp =
  (http: HttpClient.HttpClient) =>
  <A, E, R>(program: Effect.Effect<A, E, R>) =>
    MockClient.use((current) => Ref.set(current, http).pipe(Effect.andThen(program)));

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
      expect(reviewerCheckSatisfied([check(1, 42, "completed", "success")], "c".repeat(40), 42, 7, baseSha)).toBe(
        false
      );
      expect(reviewerCheckSatisfied([check(1, 42, "completed", "success"), check(2)], sha, 42, 7, baseSha)).toBe(false);
      expect(reviewerCheckSatisfied([check(1, 42, "completed", "success")], sha, 42, 7, baseSha)).toBe(true);
      const codeFailure = check(1, 42, "completed", "failure");
      const newerDocsSuccess = check(2, 42, "completed", "success", 8);
      expect(reviewerCheckSatisfied([codeFailure, newerDocsSuccess], sha, 42, 7, baseSha)).toBe(false);
      expect(reviewerCheckSatisfied([newerDocsSuccess], sha, 42, 7, baseSha)).toBe(false);
      expect(reviewerCheckSatisfied([check(3, 42, "completed", "success")], sha, 42, 7, "d".repeat(40))).toBe(false);
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
      const files = [{ filename: "docs/app.md" }, { filename: "README.md" }];
      const http = client((_method, url) =>
        url.pathname.endsWith("/files")
          ? files
          : url.pathname.endsWith("/pulls")
            ? [{ number: 7, state: "open", head: { sha } }]
            : { head: { sha }, base: { sha: baseSha }, changed_files: 2 }
      );
      assertSome(yield* Reviewer.use((reviewer) => reviewer.docsOnly(7, sha)).pipe(usingHttp(http)), baseSha);
      const sharedHead = client((_method, url) =>
        url.pathname.endsWith("/files")
          ? files
          : url.pathname.endsWith("/pulls")
            ? [
                { number: 7, state: "open", head: { sha } },
                { number: 8, state: "open", head: { sha } },
              ]
            : { head: { sha }, base: { sha: baseSha }, changed_files: 2 }
      );
      assertNone(yield* Reviewer.use((reviewer) => reviewer.docsOnly(7, sha)).pipe(usingHttp(sharedHead)));
      const missingAssociation = client((_method, url) =>
        url.pathname.endsWith("/files")
          ? files
          : url.pathname.endsWith("/pulls")
            ? []
            : { head: { sha }, base: { sha: baseSha }, changed_files: 2 }
      );
      assertNone(yield* Reviewer.use((reviewer) => reviewer.docsOnly(7, sha)).pipe(usingHttp(missingAssociation)));
      let reads = 0;
      const moved = client((_method, url) => {
        if (url.pathname.endsWith("/files")) return files;
        reads += 1;
        return { head: { sha: reads === 1 ? sha : "c".repeat(40) }, base: { sha: baseSha }, changed_files: 2 };
      });
      const outcome = yield* Reviewer.use((reviewer) => reviewer.docsOnly(7, sha)).pipe(
        usingHttp(moved),
        Effect.result
      );
      expect(outcome._tag).toBe("Failure");
      let baseReads = 0;
      const movedBase = client((_method, url) => {
        if (url.pathname.endsWith("/files")) return files;
        baseReads += 1;
        return { head: { sha }, base: { sha: baseReads === 1 ? baseSha : "d".repeat(40) }, changed_files: 2 };
      });
      expect(
        (yield* Reviewer.use((reviewer) => reviewer.docsOnly(7, sha)).pipe(usingHttp(movedBase), Effect.result))._tag
      ).toBe("Failure");
      const truncated = client(() => ({ head: { sha }, base: { sha: baseSha }, changed_files: 3000 }));
      expect(
        (yield* Reviewer.use((reviewer) => reviewer.docsOnly(7, sha)).pipe(usingHttp(truncated), Effect.result))._tag
      ).toBe("Failure");
    })
  );
  it.effect("reuses only this PR and base's in-progress check", () =>
    Effect.gen(function* () {
      let creates = 0;
      const http = client((method, url) => {
        if (url.pathname.endsWith("/pulls/7")) return { head: { sha }, base: { sha: baseSha } };
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
        if (url.pathname.endsWith("/pulls/7")) return { head: { sha }, base: { sha: baseSha } };
        if (method === "POST") {
          postedBody = body;
          return { id: 44 };
        }
        return { total_count: 1, check_runs: [check(3, 42, "in_progress", null, 8)] };
      });
      expect(yield* Reviewer.use((reviewer) => reviewer.start(7, sha)).pipe(usingHttp(otherPr))).toBe(44);
      expect((yield* decodeObject(postedBody)).external_id).toBe(reviewerCheckExternalId(7, sha, baseSha));
      const changedSinceClassification = client((_method, url) => {
        if (url.pathname.endsWith("/pulls/7")) return { head: { sha }, base: { sha: "d".repeat(40) } };
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
          expect(yield* reviewer.upsert(7, "First")).toBe(12);
          expect(yield* reviewer.upsert(7, "Second")).toBe(12);
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
        if (url.pathname.endsWith("/pulls/7")) return { head: { sha }, base: { sha: baseSha } };
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
      yield* Reviewer.use((reviewer) => reviewer.complete(2, { ...result(), annotations })).pipe(usingHttp(http));
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
        const { pull, run } = completionFixture(state);
        const http = client((method, url) => {
          if (method !== "GET") writes += 1;
          return url.pathname.endsWith("/pulls/7") ? pull : run;
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
        if (url.pathname.endsWith("/pulls/7")) return { head: { sha }, base: { sha: baseSha } };
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
      const outcome = yield* Reviewer.use((reviewer) => reviewer.complete(2, { ...result(), annotations })).pipe(
        usingHttp(http),
        Effect.result
      );
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
        if (method === "GET") return { head: { sha }, base: { sha: baseSha } };
        return (body: unknown) => body;
      });
      const posting = client((method, _url, body) => {
        if (method === "GET") return { head: { sha }, base: { sha: baseSha } };
        bodies.push(body);
        return { id: 55 };
      });
      yield* Reviewer.use((reviewer) =>
        reviewer.review(7, sha, ReviewerReview.make({ body: "Notes", comments: [] }))
      ).pipe(usingHttp(posting));
      const posted = yield* decodeObject(bodies[0]);
      expect(posted.event).toBe("COMMENT");
      expect(posted.commit_id).toBe(sha);
      const stale = yield* Reviewer.use((reviewer) => reviewer.start(7, "b".repeat(40))).pipe(
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
      expect(yield* requireReviewerInRuleset(updated, 42)).toEqual(updated);
    })
  );
});

class TokenFixture extends Context.Service<
  TokenFixture,
  {
    readonly publicKey: CryptoKey;
    readonly requestBodies: Array<unknown>;
    readonly jwts: Array<string>;
    readonly exchanges: () => number;
  }
>()("@beep/repo-cli/test/reviewer.test/TokenFixture") {}
const TokenTestLayer = Layer.unwrap(
  Effect.gen(function* () {
    // Generated in memory for this test; neither private key nor installation token is persisted.
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
    let exchanges = 0;
    const requestBodies: Array<unknown> = [];
    const jwts: Array<string> = [];
    const http = HttpClient.make((request) =>
      Effect.gen(function* () {
        exchanges += 1;
        jwts.push(request.headers.authorization ?? "");
        if (request.body._tag === "Uint8Array")
          requestBodies.push(yield* decodeJson(new TextDecoder().decode(request.body.body)));
        const now = yield* Clock.currentTimeMillis;
        const body = yield* encodeJson({
          token: `opaque-${exchanges}`,
          expires_at: DateTime.formatIso(DateTime.makeUnsafe(now + 3_600_000)),
        });
        return HttpClientResponse.fromWeb(request, new Response(body, { status: 201 }));
      }).pipe(Effect.orDie)
    );
    const credentials = ReviewerCredentials.make({
      appId: 42,
      clientId: "Iv.test-client",
      installationId: 77,
      privateKey: Redacted.make(pem),
    });
    return Layer.merge(
      makeGitHubAppAuth(credentials).pipe(Layer.provide(Layer.succeed(HttpClient.HttpClient, http))),
      Layer.succeed(TokenFixture, { publicKey: pair.publicKey, requestBodies, jwts, exchanges: () => exchanges })
    );
  })
);

it.layer(TokenTestLayer, { timeout: "30 seconds" })("installation token cache", (it) => {
  it.effect("signs RS256 in memory, scopes tokens, shares refresh, and expires five minutes early", () =>
    Effect.gen(function* () {
      const fixture = yield* TokenFixture;
      const { jwts, requestBodies } = fixture;
      const service = yield* GitHubAppAuth;
      const first = yield* service.token;
      expect(Redacted.value(first)).toBe("opaque-1");
      // A single test owns this layer clock; assert the absolute refresh boundary.
      yield* TestClock.setTime(Duration.minutes(54).pipe(Duration.toMillis));
      expect(Redacted.value(yield* service.token)).toBe("opaque-1");
      yield* TestClock.setTime(Duration.minutes(55).pipe(Duration.toMillis));
      const tokens = yield* Effect.all([service.token, service.token], { concurrency: 2 });
      expect(A.map(tokens, Redacted.value)).toEqual(["opaque-2", "opaque-2"]);
      expect(fixture.exchanges()).toBe(2);
      expect(requestBodies[0]).toMatchObject({ repositories: ["beep-effect"], permissions: { checks: "write" } });
      const jwt = (jwts[0] ?? "").slice(7).split(".");
      const claims = yield* decodeJson(Buffer.from(jwt[1] ?? "", "base64url").toString()).pipe(
        Effect.flatMap(decodeObject)
      );
      expect(claims).toEqual({ iat: -60, exp: 540, iss: "Iv.test-client" });
      expect(
        yield* Effect.promise(() =>
          crypto.subtle.verify(
            "RSASSA-PKCS1-v1_5",
            fixture.publicKey,
            Buffer.from(jwt[2] ?? "", "base64url"),
            new TextEncoder().encode(`${jwt[0]}.${jwt[1]}`)
          )
        )
      ).toBe(true);
    })
  );
});
