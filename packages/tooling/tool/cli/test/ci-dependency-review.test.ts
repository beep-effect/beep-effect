/**
 * #1882: manifest-aware dependency review over recorded GitHub compare
 * responses. No test touches the network: a recorded `GithubPolicyClient`
 * answers each exact `gh api` argument list, and any other request fails.
 *
 * The recorded files under `fixtures/dependency-review/` are trimmed real
 * replies of `gh api --paginate --slurp .../dependency-graph/compare/...`
 * captured on 2026-10-21 (see that directory's README).
 */

import {
  CiCommandError,
  classifyGithubFailure,
  DEPENDENCY_REVIEW_COMPARE_PAGE_LIMIT,
  DependencyChange,
  DependencyGraphComparePage,
  DependencyGraphComparePages,
  DependencyReview,
  DependencyReviewLive,
  DependencyReviewRequest,
  decideLicense,
  dependencyReviewFailure,
  dependencyReviewFixturePolicy,
  GithubApiReply,
  GithubPolicyClient,
  isFixtureManifest,
  renderDependencyReview,
  runDependencyReview,
} from "@beep/repo-cli/commands/Ci";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import inventory from "./fixtures/dependency-review/manifest-inventory.json" with { type: "json" };
import pr911Recorded from "./fixtures/dependency-review/pr-911-photo-face-uv-lock.json" with { type: "json" };
import pr1592Recorded from "./fixtures/dependency-review/pr-1592-lockfile-fixtures.json" with { type: "json" };
import type { DependencyReviewVerdict } from "@beep/repo-cli/commands/Ci";

const sha = (digit: string): string => A.join(A.replicate(digit, 40), "");
const request = (base: string, head: string) => DependencyReviewRequest.make({ base: sha(base), head: sha(head) });
const rangeKey = (review: DependencyReviewRequest): string => `${review.base}...${review.head}`;
const COMPARE_PAGE =
  /^-i repos\/\{owner\}\/\{repo\}\/dependency-graph\/compare\/([0-9a-f]{40}\.\.\.[0-9a-f]{40})\?per_page=1&page=(\d+)$/u;
// GitHub's `gh api -i` shape: status line, CRLF headers, a blank line, then the
// JSON page. A Link header names the next page until the last one.
const pageLink = (page: number, last: number): string => {
  const url = (target: number) =>
    `<https://api.github.com/repositories/1/dependency-graph/compare/x?per_page=1&page=${target}>`;
  const rels = [
    ...(page > 1 ? [`${url(page - 1)}; rel="prev"`] : []),
    ...(page < last ? [`${url(page + 1)}; rel="next"`] : []),
    `${url(last)}; rel="last"`,
    `${url(1)}; rel="first"`,
  ];
  return last > 1 ? `Link: ${A.join(rels, ", ")}\r\n` : "";
};
const httpPage = (page: number, last: number, body: string): string =>
  `HTTP/2.0 200 OK\r\nContent-Type: application/json; charset=utf-8\r\n${pageLink(page, last)}\r\n${body}`;
const ok = (output: string) => GithubApiReply.make({ exitCode: 0, output, truncated: false });
const failed = (output: string) => GithubApiReply.make({ exitCode: 1, output, truncated: false });
const encodePage = S.encodeEffect(S.fromJsonString(DependencyGraphComparePage));
const decodePage = S.decodeUnknownEffect(S.fromJsonString(DependencyGraphComparePage));
const decodePages = S.decodeUnknownEffect(DependencyGraphComparePages);

// Real recorded pull-request ranges.
const PR_911 = DependencyReviewRequest.make({
  base: "19d8b3df005dd9768e003a9efc716d84bf0ad12a",
  head: "9fc17c2ed94893ac831ed12b4370c70dfc48a0af",
});
const PR_1592 = DependencyReviewRequest.make({
  base: "cb64e0484f218a0b04bd8356aef2ceb463644a7c",
  head: "b56c98a04992a430463a10204a62cd8b3ac6f8a3",
});

// Synthetic ranges, each answered by rows derived from the recorded replies.
const LOOK_ALIKE = request("1", "2");
const LICENSES = request("3", "4");
const SCOPE_AND_REMOVAL = request("5", "6");
const REPOSITORY_LICENSE = request("7", "8");
const LICENSE_LOOKUP_DENIED = request("9", "a");
const HTTP_403 = request("b", "c");
const HTTP_404 = request("d", "e");
const RATE_LIMIT = request("f", "0");
const HTTP_429 = request("0", "1");
const MALFORMED_SHAPE = request("1", "3");
const MALFORMED_JSON = request("1", "4");
const TRUNCATED = request("1", "5");
const SPAWN_FAILURE = request("1", "6");
const EMPTY = request("1", "7");
const PAGE_2_ADVISORY = request("1", "9");
const LATER_PAGE_TRUNCATED = request("1", "a");
const LATER_PAGE_MALFORMED = request("1", "b");
const LATER_PAGE_FAILED = request("1", "c");
const PAGE_LIMIT = request("1", "d");
const SKIPPED_PAGE = request("1", "e");
const NO_SEPARATOR = request("1", "f");
const NOT_OK_STATUS = request("2", "0");
const PAGE_PARAM_FIRST = request("2", "1");
const CURSOR_NEXT = request("2", "3");
const MALFORMED_NEXT = request("2", "4");
// A page whose Link header is exactly `link` (the round-2 review cases).
const linkedPage = (link: string, body: string): string =>
  `HTTP/2.0 200 OK\r\nContent-Type: application/json; charset=utf-8\r\nLink: ${link}\r\n\r\n${body}`;
const MISSING_HEAD = DependencyReviewRequest.make({
  base: sha("1"),
  head: A.join(A.replicate("deadbeef", 5), ""),
});
const COMMIT_LOOKUP = /^--jq \.sha repos\/\{owner\}\/\{repo\}\/commits\/([0-9a-f]{40})$/u;

const recordedLodashFixture = (pages: DependencyGraphComparePages): DependencyChange =>
  O.getOrThrow(
    A.findFirst(
      A.flatten(pages),
      (row) => row.manifest === "scratchpad/test/lockfiles/fixtures/npm/v1/package-lock.json"
    )
  );
const recordedUrllib3 = (pages: DependencyGraphComparePages): DependencyChange =>
  O.getOrThrow(A.findFirst(A.flatten(pages), (row) => row.name === "urllib3"));
const recordedVitestDevelopment = (pages: DependencyGraphComparePages): DependencyChange =>
  O.getOrThrow(A.findFirst(A.flatten(pages), (row) => row.name === "vitest"));

const RecordedGithub = Layer.effect(
  GithubPolicyClient,
  Effect.gen(function* () {
    const pr911Pages = yield* decodePages(pr911Recorded);
    const pr1592Pages = yield* decodePages(pr1592Recorded);
    const lodash = recordedLodashFixture(pr1592Pages);
    const urllib3 = recordedUrllib3(pr911Pages);
    const vitest = recordedVitestDevelopment(pr1592Pages);
    const moved = (manifest: string) => DependencyChange.make({ ...lodash, manifest });
    const licensed = (license: string | null, name: string) =>
      DependencyChange.make({ ...urllib3, name, license, vulnerabilities: [] });
    // GitHub's `per_page` counts manifests: with `per_page=1` every page holds
    // one manifest's rows, and some pages are empty.
    const paged = Effect.fn("RecordedGithub.paged")(function* (pages: ReadonlyArray<ReadonlyArray<DependencyChange>>) {
      const last = A.isReadonlyArrayEmpty(pages) ? 1 : A.length(pages);
      const served: ReadonlyArray<ReadonlyArray<DependencyChange>> = A.isReadonlyArrayEmpty(pages)
        ? [A.empty<DependencyChange>()]
        : pages;
      // A lambda, not `encodePage` itself: `forEach` passes the index as a
      // second argument, which the codec reads as parse options.
      const bodies = yield* Effect.forEach(served, (rows) => encodePage(rows));
      return A.map(bodies, (body, index) => ok(httpPage(index + 1, last, body)));
    });
    const byManifest = (rows: ReadonlyArray<DependencyChange>): ReadonlyArray<ReadonlyArray<DependencyChange>> =>
      A.isReadonlyArrayNonEmpty(rows) ? A.groupWith(rows, (self, that) => self.manifest === that.manifest) : [];
    const pr1592ByManifest = byManifest(A.flatten(pr1592Pages));
    const replies = HashMap.make(
      [rangeKey(PR_911), yield* paged(byManifest(A.flatten(pr911Pages)))],
      // The recorded #1592 rows across one page per manifest, with an empty
      // page after the third, as GitHub serves them.
      [rangeKey(PR_1592), yield* paged([...A.take(pr1592ByManifest, 3), [], ...A.drop(pr1592ByManifest, 3)])],
      [
        rangeKey(LOOK_ALIKE),
        yield* paged(
          byManifest([
            moved("scratchpad/tests/fixtures/npm/v1/package-lock.json"),
            moved("packages/tooling/test-fixtures/package-lock.json"),
            moved("fixtures/test/package-lock.json"),
            moved("packages/demo/test/fixtures-loader/package-lock.json"),
          ])
        ),
      ],
      [
        rangeKey(LICENSES),
        yield* paged([
          [
            licensed("GPL-3.0-or-later", "gpl-or-later"),
            licensed("MIT OR AGPL-3.0-only", "agpl-choice"),
            licensed("MIT AND GPL-3.0", "gpl-conjunction"),
            licensed("GPL-3.0 WITH Classpath-exception-2.0", "gpl-exception"),
            licensed("LGPL-3.0-only", "lgpl"),
            licensed("NOASSERTION", "no-assertion"),
            licensed("Custom proprietary terms", "unresolved"),
          ],
        ]),
      ],
      [
        rangeKey(SCOPE_AND_REMOVAL),
        yield* paged([
          [DependencyChange.make({ ...vitest, manifest: "apps/oip-web/package.json" })],
          [DependencyChange.make({ ...urllib3, change_type: "removed" })],
        ]),
      ],
      [
        rangeKey(REPOSITORY_LICENSE),
        yield* paged([
          [
            DependencyChange.make({
              ...urllib3,
              name: "agpl-repo",
              license: null,
              source_repository_url: "https://github.com/example/agpl-repo",
              vulnerabilities: [],
            }),
            DependencyChange.make({
              ...urllib3,
              name: "unlicensed-repo",
              license: null,
              source_repository_url: "https://github.com/example/unlicensed-repo",
              vulnerabilities: [],
            }),
          ],
        ]),
      ],
      [
        rangeKey(LICENSE_LOOKUP_DENIED),
        yield* paged([
          [
            DependencyChange.make({
              ...urllib3,
              license: null,
              source_repository_url: "https://github.com/example/forbidden-repo",
            }),
          ],
        ]),
      ],
      // A clean production page, then the recorded high urllib3 advisory alone on page 2.
      [
        rangeKey(PAGE_2_ADVISORY),
        yield* paged([
          [licensed("MIT", "clean")],
          [DependencyChange.make({ ...urllib3, manifest: "apps/oip-web/uv.lock" })],
        ]),
      ],
      [
        rangeKey(LATER_PAGE_TRUNCATED),
        [ok(httpPage(1, 2, "[]")), GithubApiReply.make({ exitCode: 0, output: httpPage(2, 2, "[{"), truncated: true })],
      ],
      [rangeKey(LATER_PAGE_MALFORMED), [ok(httpPage(1, 2, "[]")), ok(httpPage(2, 2, '{"rows":[]}'))]],
      [rangeKey(LATER_PAGE_FAILED), [ok(httpPage(1, 2, "[]")), failed("gh: Server Error (HTTP 502)")]],
      // Page 1 claims the next page is 3: a skipped page could hide rows.
      [rangeKey(SKIPPED_PAGE), [ok(Str.replace('page=2>; rel="next"', 'page=3>; rel="next"')(httpPage(1, 3, "[]")))]],
      // `page` before `per_page` in the next URL: page 2 must still be read.
      [
        rangeKey(PAGE_PARAM_FIRST),
        [
          ok(
            linkedPage(
              '<https://api.github.com/repositories/1/dependency-graph/compare/x?page=2&per_page=1>; rel="next", <https://api.github.com/repositories/1/dependency-graph/compare/x?page=2&per_page=1>; rel="last"',
              "[]"
            )
          ),
          ...(yield* paged([[DependencyChange.make({ ...urllib3, manifest: "apps/oip-web/uv.lock" })]])),
        ],
      ],
      [
        rangeKey(CURSOR_NEXT),
        [
          ok(
            linkedPage(
              '<https://api.github.com/repositories/1/dependency-graph/compare/x?after=Y3Vyc29y&per_page=1>; rel="next"',
              "[]"
            )
          ),
        ],
      ],
      [rangeKey(MALFORMED_NEXT), [ok(linkedPage('https://api.github.com/x?page=2; rel="next"', "[]"))]],
      [rangeKey(NO_SEPARATOR), [ok("[]")]],
      [rangeKey(NOT_OK_STATUS), [ok("HTTP/2.0 304 Not Modified\r\n\r\n[]")]],
      [rangeKey(HTTP_403), [failed("gh: Resource not accessible by integration (HTTP 403)")]],
      [rangeKey(HTTP_404), [failed("gh: Not Found (HTTP 404)")]],
      [rangeKey(RATE_LIMIT), [failed("gh: API rate limit exceeded for installation ID 4242. (HTTP 403)")]],
      [rangeKey(HTTP_429), [failed("gh: You have exceeded a secondary rate limit. (HTTP 429)")]],
      [rangeKey(MALFORMED_SHAPE), [ok(httpPage(1, 1, '[{"change_type":"modified","manifest":"package.json"}]'))]],
      [rangeKey(MALFORMED_JSON), [ok(httpPage(1, 1, "<html>bad gateway</html>"))]],
      [rangeKey(TRUNCATED), [GithubApiReply.make({ exitCode: 0, output: httpPage(1, 1, "[{"), truncated: true })]],
      [rangeKey(EMPTY), yield* paged([])],
      // GitHub's real reply for an unknown commit range: 200 and no rows.
      [rangeKey(MISSING_HEAD), yield* paged([])]
    );
    const licenses = HashMap.make(
      ["repos/example/agpl-repo/license", ok('{"license":{"spdx_id":"AGPL-3.0"}}')],
      ["repos/example/unlicensed-repo/license", failed("gh: Not Found (HTTP 404)")],
      ["repos/example/forbidden-repo/license", failed("gh: Resource not accessible by integration (HTTP 403)")]
    );
    // Every commit resolves to itself except MISSING_HEAD's head, which gets
    // GitHub's recorded reply for an unknown SHA.
    const commitReply = (commit: string) =>
      commit === MISSING_HEAD.head ? failed(`gh: No commit found for SHA: ${commit} (HTTP 422)`) : ok(`${commit}\n`);
    // PAGE_LIMIT links a next page forever.
    const pageReply = (range: string, page: number) =>
      range === rangeKey(PAGE_LIMIT)
        ? ok(httpPage(page, page + 1, "[]"))
        : pipe(
            HashMap.get(replies, range),
            O.flatMap(A.get(page - 1)),
            O.getOrElse(() => failed(`gh: unrecorded page ${page} of ${range} (HTTP 418)`))
          );
    const respond = Effect.fn("RecordedGithub.respond")(function* (args: ReadonlyArray<string>) {
      const key = A.join(args, " ");
      const commit = pipe(
        Str.match(COMMIT_LOOKUP)(key),
        O.flatMap((match) => O.fromUndefinedOr(match[1]))
      );
      if (O.isSome(commit)) return commitReply(commit.value);
      const page = Str.match(COMPARE_PAGE)(key);
      if (O.isSome(page)) {
        const [, range = "", number = "0"] = page.value;
        if (range === rangeKey(SPAWN_FAILURE))
          return yield* CiCommandError.make({ message: "GitHub policy request failed; state is unknown." });
        return pageReply(
          range,
          O.getOrElse(Num.parse(number), () => 0)
        );
      }
      return O.getOrElse(HashMap.get(licenses, key), () => failed(`gh: unrecorded request ${key} (HTTP 418)`));
    });
    return GithubPolicyClient.of({
      read: Effect.fn("RecordedGithub.read")(() =>
        Effect.fail(CiCommandError.make({ message: "read is not used by dependency review" }))
      ),
      write: Effect.fn("RecordedGithub.write")(() =>
        Effect.fail(CiCommandError.make({ message: "write is not used by dependency review" }))
      ),
      request: respond,
    });
  })
);

const review = (target: DependencyReviewRequest) => DependencyReview.use((service) => service.review(target));
const findings = (verdict: DependencyReviewVerdict) =>
  verdict._tag === "fail" ? A.map(verdict.findings, (finding) => `${finding._tag}:${finding.name}`) : [];

describe("dependency review fixture policy", () => {
  it("classifies the recorded dependency-graph manifest inventory exactly", () => {
    const isFixture = isFixtureManifest(dependencyReviewFixturePolicy);
    const misclassified = A.filter(
      inventory.manifests,
      (entry) => isFixture(entry.path) !== (entry.classification === "synthetic-fixture")
    );
    expect(misclassified).toEqual([]);
    expect(A.length(A.filter(inventory.manifests, (entry) => entry.classification === "synthetic-fixture"))).toBe(
      inventory.syntheticFixtureCount
    );
  });

  it("matches whole path segments only", () => {
    const isFixture = isFixtureManifest(dependencyReviewFixturePolicy);
    expect(isFixture("packages/tooling/library/repo-workspaces/test/fixtures/peers/npm/package-lock.json")).toBe(true);
    expect(isFixture("packages/tooling/library/repo-utils/test/fixtures/mock-monorepo/package.json")).toBe(true);
    expect(isFixture("test/fixtures/package.json")).toBe(true);
    expect(isFixture("scratchpad/tests/fixtures/npm/package-lock.json")).toBe(false);
    expect(isFixture("packages/tooling/test-fixtures/package-lock.json")).toBe(false);
    expect(isFixture("fixtures/test/package-lock.json")).toBe(false);
    expect(isFixture("packages/demo/test/fixtures-loader/package.json")).toBe(false);
    expect(isFixture("scratchpad/package.json")).toBe(false);
  });
});

describe("dependency review compare schema", () => {
  it.effect("decodes a row whose package_url is null, as GitHub's dependency-graph-diff schema allows", () =>
    Effect.gen(function* () {
      const row = yield* S.decodeEffect(DependencyChange)({
        change_type: "added",
        manifest: "apps/oip-web/package.json",
        ecosystem: "npm",
        name: "local-only",
        version: "1.0.0",
        package_url: null,
        license: null,
        source_repository_url: null,
        vulnerabilities: [],
        scope: "runtime",
      });
      expect(row.package_url).toBeNull();
    })
  );

  it.effect.prop(
    "a schema-derived page survives the wire codec, and any of its manifests under a fixture root is excluded",
    [Arbitrary.schema(DependencyGraphComparePage)],
    ([page]) =>
      Effect.gen(function* () {
        const wire = yield* encodePage(page);
        expect(yield* decodePage(wire)).toEqual(page);
        const isFixture = isFixtureManifest(dependencyReviewFixturePolicy);
        // Any manifest, moved under a declared fixture root, is excluded.
        for (const row of page) {
          expect(isFixture(`scratchpad/test/fixtures/${row.manifest}`)).toBe(true);
        }
      }),
    { arbitrary: fcRuns(25) }
  );
});

describe("dependency review license decisions", () => {
  it("reproduces the pinned action's deny semantics", () => {
    const deny = ["AGPL-3.0", "GPL-3.0"] as const;
    const decide = decideLicense(deny);
    expect(decide("GPL-3.0")).toBe("denied");
    expect(decide("GPL-3.0-only")).toBe("denied");
    expect(decide("GPL-3.0-or-later")).toBe("denied");
    expect(decide("GPL-2.0-or-later")).toBe("denied");
    expect(decide("GPL-2.0+")).toBe("denied");
    expect(decide("AGPL-1.0-or-later")).toBe("denied");
    expect(decide("MIT OR GPL-3.0")).toBe("denied");
    expect(decide("GPL-2.0-only")).toBe("allowed");
    expect(decide("AGPL-1.0")).toBe("allowed");
    expect(decide("LGPL-3.0-only")).toBe("allowed");
    expect(decide("MIT AND GPL-3.0")).toBe("allowed");
    expect(decide("GPL-3.0 WITH Classpath-exception-2.0")).toBe("allowed");
    expect(decide("LicenseRef-github-NONE")).toBe("allowed");
    expect(decide("MIT AND OTHER")).toBe("allowed");
    expect(decide("NOASSERTION")).toBe("unlicensed");
    expect(decide(null)).toBe("unlicensed");
    expect(decide("Custom proprietary terms")).toBe("unresolved");
  });

  it("classifies gh failures", () => {
    expect(classifyGithubFailure("gh: No commit found for SHA: abc (HTTP 422)")).toBe("not-found");
    expect(classifyGithubFailure("gh: Resource not accessible by integration (HTTP 403)")).toBe("permission-denied");
    expect(classifyGithubFailure("gh: Bad credentials (HTTP 401)")).toBe("permission-denied");
    expect(classifyGithubFailure("gh: API rate limit exceeded for user ID 1. (HTTP 403)")).toBe("rate-limited");
    expect(classifyGithubFailure("gh: secondary limit (HTTP 429)")).toBe("rate-limited");
    expect(classifyGithubFailure("gh: Not Found (HTTP 404)")).toBe("not-found");
    expect(classifyGithubFailure("error connecting to api.github.com")).toBe("request-failed");
  });
});

it.layer(Layer.provideMerge(DependencyReviewLive, RecordedGithub), { timeout: "30 seconds" })(
  "dependency review over recorded compare responses",
  (it) => {
    it.effect("fails on a high transitive advisory in a production lockfile (PR #911)", () =>
      Effect.gen(function* () {
        const verdict = yield* review(PR_911);
        expect(verdict._tag).toBe("fail");
        // certifi and urllib3 are transitive in photo-face's uv.lock: neither
        // is a direct pyproject dependency at that head; pytest is moderate.
        expect(findings(verdict)).toEqual(["vulnerability:certifi", "vulnerability:urllib3"]);
        expect(
          verdict._tag === "fail" &&
            A.every(
              verdict.findings,
              (finding) => finding.manifest === "packages/tooling/tool/cli/python/photo-face/uv.lock"
            )
        ).toBe(true);
        assertSome(dependencyReviewFailure(verdict), "Dependency review failed: 2 finding(s) in production manifests.");
      })
    );

    it.effect("excludes only fixture manifests and passes the PR that tripped the action (PR #1592)", () =>
      Effect.gen(function* () {
        const verdict = yield* review(PR_1592);
        expect(verdict._tag).toBe("pass");
        if (verdict._tag !== "pass") return;
        expect(verdict.counts.rows).toBe(18);
        expect(verdict.counts.excludedRows).toBe(16);
        expect(verdict.counts.reviewedRows).toBe(2);
        expect(verdict.counts.excludedManifests).toContain(
          "scratchpad/test/lockfiles/fixtures/npm/v1/package-lock.json"
        );
        expect(verdict.counts.excludedManifests).toContain("scratchpad/test/lockfiles/fixtures/pnpm/v2/pnpm-lock.yaml");
        assertNone(dependencyReviewFailure(verdict));
        const lines = renderDependencyReview(verdict, PR_1592, dependencyReviewFixturePolicy);
        expect(lines).toContain(
          `fixture policy: **/test/**/fixtures/** (${dependencyReviewFixturePolicy.rules[0].reason})`
        );
        assertSome(A.last(lines), "verdict: pass");
      })
    );

    it.effect("still fails a production path that only resembles a fixture root", () =>
      Effect.gen(function* () {
        const verdict = yield* review(LOOK_ALIKE);
        expect(verdict._tag).toBe("fail");
        if (verdict._tag !== "fail") return;
        expect(A.map(verdict.findings, (finding) => finding.manifest)).toEqual([
          "scratchpad/tests/fixtures/npm/v1/package-lock.json",
          "packages/tooling/test-fixtures/package-lock.json",
          "fixtures/test/package-lock.json",
          "packages/demo/test/fixtures-loader/package-lock.json",
        ]);
        expect(verdict.counts.excludedRows).toBe(0);
      })
    );

    it.effect("fails denied and unresolved licenses and reports unlicensed rows", () =>
      Effect.gen(function* () {
        const verdict = yield* review(LICENSES);
        expect(findings(verdict)).toEqual([
          "denied-license:gpl-or-later",
          "denied-license:agpl-choice",
          "unresolved-license:unresolved",
        ]);
        expect(verdict._tag === "fail" && verdict.counts.unlicensedRows).toBe(1);
        expect(A.join(renderDependencyReview(verdict, LICENSES, dependencyReviewFixturePolicy), "\n")).toContain(
          "denied license:"
        );
        expect(A.join(renderDependencyReview(verdict, LICENSES, dependencyReviewFixturePolicy), "\n")).toContain(
          "unresolved license:"
        );
      })
    );

    it.effect("keeps the action's runtime scope and additions-only rules", () =>
      Effect.gen(function* () {
        expect((yield* review(SCOPE_AND_REMOVAL))._tag).toBe("pass");
        expect((yield* review(EMPTY))._tag).toBe("pass");
      })
    );

    it.effect("resolves a missing license from the source repository", () =>
      Effect.gen(function* () {
        const verdict = yield* review(REPOSITORY_LICENSE);
        expect(findings(verdict)).toEqual(["denied-license:agpl-repo"]);
        expect(verdict._tag === "fail" && verdict.counts.unlicensedRows).toBe(1);
      })
    );

    it.effect("exits 0 only on pass, 1 on fail or unknown, and 64 on malformed SHAs", () =>
      Effect.gen(function* () {
        const exitCode = (refs: { readonly base: string; readonly head: string }) =>
          runDependencyReview(refs).pipe(
            Effect.exit,
            Effect.map(
              Exit.match({
                onSuccess: () => 0,
                onFailure: (cause) =>
                  pipe(
                    Cause.findErrorOption(cause),
                    O.map((error) => error.exitCode),
                    O.getOrElse(() => -1)
                  ),
              })
            )
          );
        expect(yield* exitCode(PR_1592)).toBe(0);
        expect(yield* exitCode(PR_911)).toBe(1);
        expect(yield* exitCode(HTTP_403)).toBe(1);
        expect(yield* exitCode(MISSING_HEAD)).toBe(1);
        expect(yield* exitCode({ base: "abc", head: PR_911.head })).toBe(64);
      })
    );

    it.effect("reads every compare page, so an advisory on page 2 still fails", () =>
      Effect.gen(function* () {
        expect(findings(yield* review(PAGE_2_ADVISORY))).toEqual(["vulnerability:urllib3"]);
        // The next link names `page` before `per_page`.
        expect(findings(yield* review(PAGE_PARAM_FIRST))).toEqual(["vulnerability:urllib3"]);
      })
    );

    it.effect("fails closed on a next link without a readable page number", () =>
      Effect.gen(function* () {
        for (const target of [CURSOR_NEXT, MALFORMED_NEXT]) {
          const verdict = yield* review(target);
          expect(verdict._tag === "unknown" && verdict.reason).toBe("malformed-response");
        }
      })
    );

    it.effect("fails closed on a truncated, malformed, failed or skipped later page and at the page ceiling", () =>
      Effect.gen(function* () {
        const cases = [
          [LATER_PAGE_TRUNCATED, "request-failed"],
          [LATER_PAGE_MALFORMED, "malformed-response"],
          [LATER_PAGE_FAILED, "request-failed"],
          [SKIPPED_PAGE, "malformed-response"],
          [PAGE_LIMIT, "page-limit-exceeded"],
          [NO_SEPARATOR, "malformed-response"],
          [NOT_OK_STATUS, "malformed-response"],
        ] as const;
        for (const [target, reason] of cases) {
          const verdict = yield* review(target);
          expect(verdict._tag === "unknown" && verdict.reason).toBe(reason);
        }
        const limited = yield* review(PAGE_LIMIT);
        expect(limited._tag === "unknown" && limited.detail).toContain(`${DEPENDENCY_REVIEW_COMPARE_PAGE_LIMIT} pages`);
      })
    );

    it.effect("turns every GitHub failure into unknown, which fails the job", () =>
      Effect.gen(function* () {
        const cases = [
          [HTTP_403, "permission-denied"],
          [HTTP_404, "not-found"],
          [RATE_LIMIT, "rate-limited"],
          [HTTP_429, "rate-limited"],
          [MALFORMED_SHAPE, "malformed-response"],
          [MALFORMED_JSON, "malformed-response"],
          [TRUNCATED, "request-failed"],
          [SPAWN_FAILURE, "request-failed"],
          [LICENSE_LOOKUP_DENIED, "permission-denied"],
          [MISSING_HEAD, "not-found"],
        ] as const;
        for (const [target, reason] of cases) {
          const verdict = yield* review(target);
          expect(verdict._tag === "unknown" && verdict.reason).toBe(reason);
          assertSome(
            dependencyReviewFailure(verdict),
            `Dependency review state is unknown (${reason}); failing closed.`
          );
          const lines = renderDependencyReview(verdict, target, dependencyReviewFixturePolicy);
          expect(pipe(A.last(lines), O.exists(Str.startsWith(`verdict: unknown (${reason})`)))).toBe(true);
        }
      })
    );
  }
);

const reviewWithClient = Effect.fn("DependencyReviewTest.reviewWithClient")(function* (
  client: GithubPolicyClient["Service"],
  target: DependencyReviewRequest
) {
  const context = yield* Layer.build(
    DependencyReviewLive.pipe(Layer.provide(Layer.succeed(GithubPolicyClient, client)))
  );
  return yield* review(target).pipe(Effect.provideContext(context));
}, Effect.scoped);

it.layer(RecordedGithub, { timeout: "30 seconds" })("dependency review boundary failures", (it) => {
  it.effect("handles unquoted pagination, truncated licenses, absent scopes, and low advisories", () =>
    Effect.gen(function* () {
      const client = yield* GithubPolicyClient;
      const rows = yield* decodePage(
        yield* encodePage([
          DependencyChange.make({
            change_type: "added",
            manifest: "package.json",
            ecosystem: "npm",
            name: "low-risk",
            version: "1.0.0",
            package_url: null,
            license: Str.repeat(255)("x"),
            source_repository_url: "https://github.com/example/license",
            vulnerabilities: [
              {
                advisory_ghsa_id: "GHSA-0000-0000-0000",
                advisory_summary: "Fixture advisory",
                advisory_url: "https://example.invalid/advisory",
                severity: "low",
              },
            ],
          }),
        ])
      );
      const body = yield* encodePage([
        ...rows,
        DependencyChange.make({
          ...O.getOrThrow(A.head(rows)),
          name: "long-valid-license",
          license: `MIT${Str.repeat(36)(" OR MIT")}`,
          vulnerabilities: [],
        }),
      ]);
      let pages = 0;
      const adapted = GithubPolicyClient.of({
        ...client,
        request: Effect.fn("DependencyReviewTest.request")((args: ReadonlyArray<string>) => {
          const endpoint = O.getOrElse(A.last(args), () => "");
          if (Str.includes("/commits/")(endpoint))
            return pipe(
              endpoint,
              Str.split("/"),
              A.last,
              O.getOrElse(() => ""),
              ok,
              Effect.succeed
            );
          if (Str.includes("/compare/")(endpoint)) {
            pages += 1;
            return Effect.succeed(
              ok(pages === 1 ? linkedPage("<https://api.github.com/x?page=2>; rel=next", body) : httpPage(2, 2, "[]"))
            );
          }
          return Effect.succeed(ok('{"license":{"spdx_id":"MIT"}}'));
        }),
      });
      const verdict = yield* reviewWithClient(adapted, PR_911);
      expect(verdict._tag).toBe("pass");
      expect(pages).toBe(2);
    })
  );

  it.effect("fails closed on wrong commit identities and failed or malformed repository-license responses", () =>
    Effect.gen(function* () {
      const client = yield* GithubPolicyClient;
      for (const scenario of ["wrong-commit", "license-request", "license-json"]) {
        const adapted = GithubPolicyClient.of({
          ...client,
          request: Effect.fn("DependencyReviewTest.request")((args: ReadonlyArray<string>) => {
            const endpoint = O.getOrElse(A.last(args), () => "");
            if (scenario === "wrong-commit" && Str.includes("/commits/")(endpoint)) return Effect.succeed(ok(sha("0")));
            if (Str.includes("/license")(endpoint))
              return scenario === "license-request"
                ? Effect.fail(CiCommandError.make({ message: "fixture license transport failed" }))
                : Effect.succeed(ok("not json"));
            return client.request(args);
          }),
        });
        const verdict = yield* reviewWithClient(adapted, REPOSITORY_LICENSE);
        expect(verdict._tag === "unknown" && verdict.reason).toBe(
          scenario === "wrong-commit"
            ? "not-found"
            : scenario === "license-request"
              ? "request-failed"
              : "malformed-response"
        );
      }
    })
  );
});
