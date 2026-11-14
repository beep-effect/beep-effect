// MEAS-03 slice 2 (PLAN slice 10b) admission gate: the handler errors slice 10
// left `unlocated`, typed and located. Every attempt in the committed journal is
// classified by hand below, with the row slice 10 gave it, the row it gets now,
// and why, then replayed through the live loader and fold. The rows are
// hand-written and stratified over the live residual by raise-site sentence:
// publish input refusals, review-thread readiness refusals, GitHub rate limits
// and other failed GitHub calls, the residue that stays in the unknown bucket,
// and the neighbouring rows that must not move.
import { GitHubError } from "@beep/github/GitHubError";
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { YeetCommandError, YeetHandlerErrorKind, yeetHandlerErrorKind } from "@beep/repo-cli/commands/Yeet";
import {
  BuildYeetVerdictInput,
  buildYeetEconomicsReport,
  buildYeetVerdict,
  EconomicsJournal,
  EconomicsScope,
  EconomicsScopeRequest,
  economicsAttemptClass,
  economicsCountMix,
  YeetEconomicsSource,
  YeetVerdictJson,
} from "@beep/repo-cli/test/Yeet";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome, deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { EconomicsAttempt, EconomicsAttemptClass } from "@beep/repo-cli/test/Yeet";

const RUN_ID = "fix_certainty-handler-errors-0123456789ab";
const NOW = DateTime.makeUnsafe("2026-11-14T00:00:00.000Z");

const fixtureJournal = pipe(
  R.values(
    import.meta.glob<string>("./fixtures/yeet-economics/adjudicated-handler-errors.ndjson", {
      eager: true,
      import: "default",
      query: "?raw",
    })
  ),
  A.head,
  O.getOrThrow
);

const LiveSource = Layer.provideMerge(
  YeetEconomicsSource.layer,
  Layer.mergeAll(MemoryFileSystem.layer, Path.layer, Digest.layerWebCrypto)
);

const attemptId = (suffix: number): string => `5d2e8c4a-1b3f-4e6a-8c9d-${Str.padStart(12, "0")(`${suffix}`)}`;

interface Adjudicated {
  readonly after: O.Option<string>;
  readonly attemptClass: EconomicsAttemptClass;
  readonly attemptId: string;
  // The actionable row the fold gave it before this slice.
  readonly before: O.Option<string>;
  // The `handlerErrorKind` the fixture verdict carries, as the new writer
  // stamps it (or a newer writer would); none for rows written before it.
  readonly verdictKind: O.Option<string>;
  readonly why: string;
}

const red = (
  suffix: number,
  before: string,
  after: string,
  verdictKind: string | undefined,
  why: string
): Adjudicated => ({
  attemptId: attemptId(suffix),
  attemptClass: "red",
  before: O.some(before),
  after: O.some(after),
  verdictKind: O.fromUndefinedOr(verdictKind),
  why,
});

const notRed = (suffix: number, attemptClass: EconomicsAttemptClass, why: string): Adjudicated => ({
  attemptId: attemptId(suffix),
  attemptClass,
  before: O.none(),
  after: O.none(),
  verdictKind: O.none(),
  why,
});

const isYeetHandlerErrorKind = S.is(YeetHandlerErrorKind);
const rowEquivalence = O.makeEquivalence(Str.Equivalence);

const PUBLISH_INPUT = "refusal:publish-input";
const REVIEW_THREADS = "refusal:review-threads";
const RATE_LIMIT = "github:rate-limit";
const TRANSPORT = "github:transport";
const UNLOCATED = "unlocated";

const ADJUDICATED: ReadonlyArray<Adjudicated> = [
  red(1, UNLOCATED, PUBLISH_INPUT, undefined, "publish found nothing reviewed to publish (the largest live stratum)"),
  red(2, UNLOCATED, PUBLISH_INPUT, undefined, "an untracked-files refusal, its packet summary appended"),
  red(3, UNLOCATED, PUBLISH_INPUT, undefined, "commitlint refused the message; its quoted subject names a rate limit"),
  red(4, UNLOCATED, PUBLISH_INPUT, "publish-input", "the new writer typed a missing --message refusal"),
  red(5, UNLOCATED, REVIEW_THREADS, undefined, "a monitor run refused on the retired 'unresolved' sentence"),
  red(
    6,
    UNLOCATED,
    REVIEW_THREADS,
    "review-threads",
    "a publish refused on outstanding threads, typed by the new writer"
  ),
  red(7, UNLOCATED, RATE_LIMIT, undefined, "the branch pull request REST read hit the hourly limit"),
  red(8, UNLOCATED, RATE_LIMIT, undefined, "the retired gh pr create path hit the GraphQL limit"),
  red(9, UNLOCATED, RATE_LIMIT, undefined, "the default branch REST read hit the hourly limit"),
  red(
    10,
    UNLOCATED,
    RATE_LIMIT,
    "github-rate-limit",
    "the new writer typed a rate-limited GitHubError cause; the text has no limit words"
  ),
  red(11, UNLOCATED, TRANSPORT, undefined, "the monitor's comment poll failed (the one live transport row)"),
  red(12, UNLOCATED, TRANSPORT, undefined, "the branch pull request REST read got a 502: GitHub, but not a rate limit"),
  red(
    13,
    UNLOCATED,
    UNLOCATED,
    undefined,
    "the since-fixed pull request number decode after a full success stays unknown"
  ),
  red(14, UNLOCATED, UNLOCATED, undefined, "a failed ownership-lease write is not one of the typed classes"),
  red(15, UNLOCATED, UNLOCATED, undefined, "the proof wrote files after the commit: not an input refusal"),
  red(
    16,
    UNLOCATED,
    UNLOCATED,
    "future-kind",
    "a kind from a newer writer this reader does not know: unknown, and the row still counts"
  ),
  red(17, "unexecuted", "unexecuted", undefined, "a push-only flag refusal that ran no lane keeps its slice-3 row"),
  red(18, "unexecuted", PUBLISH_INPUT, "publish-input", "a typed refusal names what failed even when no lane ran"),
  red(
    19,
    "refusal:closeout",
    "refusal:closeout",
    undefined,
    "a red closeout stays a closeout refusal despite its rate-limit text"
  ),
  red(20, "refusal:stale-base", "refusal:stale-base", undefined, "the stale-base refusal is classed before any kind"),
  red(
    21,
    "publish:02-pr-create",
    "publish:02-pr-create",
    "github-rate-limit",
    "a step-exit red keeps its failed step over a typed kind"
  ),
  notRed(22, "green", "a passing publish"),
  notRed(23, "terminated", "interrupted: a termination, never a red row"),
  red(24, UNLOCATED, UNLOCATED, undefined, "an old verdict without a failure kind is not read as a handler error"),
];

const countOf = (attemptClass: EconomicsAttemptClass): number =>
  A.length(A.filter(ADJUDICATED, (row) => row.attemptClass === attemptClass));

const scope = (root: string) => EconomicsScope.make({ kind: "checkout", checkouts: [root], branch: O.none() });

// The actionable row the live fold gives one attempt alone, read from a
// one-attempt report so every attempt is checked against its own adjudication.
const actionableRowOf = (root: string, journal: EconomicsJournal, attempt: EconomicsAttempt): O.Option<string> =>
  pipe(
    buildYeetEconomicsReport([EconomicsJournal.make({ ...journal, attempts: [attempt] })], scope(root), NOW, [])
      .firstFailure.actionableLaneMix,
    A.head,
    O.map((row) => row.key)
  );

it.layer(LiveSource, { timeout: "30 seconds" })("yeet economics adjudicated handler errors", (it) => {
  it.effect(
    "locates every residual handler error by its kind and keeps the unknown bucket",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "economics-handler-errors-" });
      const runDirectory = path.join(root, ".beep/yeet/runs", RUN_ID);
      yield* fs.makeDirectory(runDirectory, { recursive: true });
      yield* fs.writeFileString(path.join(runDirectory, "attempts.ndjson"), fixtureJournal);
      const journals = yield* YeetEconomicsSource.use((source) =>
        source.read(EconomicsScopeRequest.make({ repoRoot: root, branch: O.none(), fleet: false }))
      );
      const journal = pipe(journals, A.head, O.getOrThrow);
      const attempts = journal.attempts;

      // Every row decodes, the one with an unknown kind included, and every
      // attempt is adjudicated once.
      expect(A.map(journals, (read) => [read.diagnostics.invalidRows, read.diagnostics.starts])).toEqual([[0, 24]]);
      expect(
        A.sort(
          A.map(attempts, (attempt) => attempt.attemptId),
          Str.Order
        )
      ).toEqual(A.map(ADJUDICATED, (row) => row.attemptId));

      // Each attempt's class and row, with the reason on both sides so a
      // mismatch prints why the row was expected.
      const observed = A.map(ADJUDICATED, (row) =>
        pipe(
          A.findFirst(attempts, (attempt) => attempt.attemptId === row.attemptId),
          O.map((found) => [
            row.why,
            economicsAttemptClass(found),
            actionableRowOf(root, journal, found),
            found.handlerErrorKind,
          ])
        )
      );
      deepStrictEqual(
        observed,
        A.map(ADJUDICATED, (row) =>
          O.some([row.why, row.attemptClass, row.after, O.filter(row.verdictKind, isYeetHandlerErrorKind)])
        )
      );

      // An old row (no kind in its verdict) moved only if slice 10 read it as
      // `unlocated`; only the rows the new writer typed may leave another row.
      expect(
        A.filter(
          ADJUDICATED,
          (row) =>
            O.isNone(row.verdictKind) && !rowEquivalence(row.before, row.after) && !O.contains(row.before, UNLOCATED)
        )
      ).toEqual([]);

      const report = buildYeetEconomicsReport(journals, scope(root), NOW, []);
      const failure = report.firstFailure;
      // Terminations stay apart; the totals invariant holds: one row per red
      // attempt, so a class counted twice would break the sum.
      expect(report.attempts.all.classMix).toEqual([
        { key: "red", count: countOf("red") },
        { key: "green", count: countOf("green") },
        { key: "terminated", count: countOf("terminated") },
      ]);
      expect(failure.redAttempts).toBe(22);
      expect(Num.sumAll(A.map(failure.actionableLaneMix, (row) => row.count))).toBe(failure.redAttempts);
      expect(Num.sumAll(A.map(failure.receiptProxyMix, (row) => row.count))).toBe(failure.redAttempts);
      expect(failure.actionableLaneMix).toEqual(economicsCountMix(A.getSomes(A.map(ADJUDICATED, (row) => row.after))));
      // The before and after mixes count the same reds: rows moved, none appeared.
      const beforeMix = economicsCountMix(A.getSomes(A.map(ADJUDICATED, (row) => row.before)));
      expect(Num.sumAll(A.map(beforeMix, (row) => row.count))).toBe(failure.redAttempts);
      // An unknown bucket stays for what nothing adjudicates.
      assertSome(
        O.map(
          A.findFirst(failure.actionableLaneMix, (row) => row.key === UNLOCATED),
          (row) => row.count
        ),
        5
      );
    })
  );
});

describe("yeet handler error kind", () => {
  const github = (kind: GitHubError["kind"]) =>
    GitHubError.make({ kind, operation: "GET /repos/{owner}/{repo}/pulls", reason: "fixture", status: 403 });
  const failure = (fields: Partial<Pick<YeetCommandError, "handlerErrorKind" | "cause">>) =>
    YeetCommandError.make({ message: "Failed to inspect current branch pull request through GitHub REST", ...fields });

  it("lets the raise site's kind win, then reads a GitHubError cause by its structural kind", () => {
    assertSome(
      yeetHandlerErrorKind(failure({ handlerErrorKind: "publish-input", cause: github("rateLimited") })),
      "publish-input"
    );
    assertSome(yeetHandlerErrorKind(failure({ cause: github("rateLimited") })), "github-rate-limit");
    assertSome(yeetHandlerErrorKind(failure({ cause: github("transport") })), "github-transport");
    assertSome(yeetHandlerErrorKind(failure({ cause: github("unauthorized") })), "github-transport");
  });

  it("names no kind for an error neither the site nor a GitHub cause types", () => {
    pipe(failure({}), yeetHandlerErrorKind, assertNone);
    pipe(
      failure({ cause: YeetCommandError.make({ message: "API rate limit exceeded" }) }),
      yeetHandlerErrorKind,
      assertNone
    );
  });

  it("closes the kind domain over the four residual classes", () => {
    expect(YeetHandlerErrorKind.literals).toEqual([
      "publish-input",
      "review-threads",
      "github-rate-limit",
      "github-transport",
    ]);
  });
});

describe("yeet verdict handler error kind", () => {
  const input = (fields: Partial<Pick<BuildYeetVerdictInput, "handlerErrorKind">>) =>
    BuildYeetVerdictInput.make({
      attemptId: O.some(attemptId(1)),
      base: "origin/main",
      branch: "fix/certainty-handler-errors",
      createdAt: "2026-11-10T00:10:00.000Z",
      executed: [],
      head: "HEAD",
      message:
        "Yeet merge readiness requires zero outstanding review threads; found 1 (1 unresolved, 0 reviewer follow-up)",
      mode: "monitor",
      outcome: "failure",
      packetPaths: [],
      planned: [],
      runId: RUN_ID,
      failureKind: "handler-error",
      ...fields,
    });

  it.effect("records the kind only when the handler error named one", () =>
    Effect.gen(function* () {
      const typed = buildYeetVerdict(input({ handlerErrorKind: "review-threads" }));
      expect(typed.handlerErrorKind).toBe("review-threads");
      const typedJson = yield* YeetVerdictJson.encode(typed);
      expect(Str.includes('"handlerErrorKind":"review-threads"')(typedJson)).toBe(true);
      const decoded = yield* YeetVerdictJson.decode(typedJson);
      expect(decoded.handlerErrorKind).toBe("review-threads");

      const untyped = buildYeetVerdict(input({}));
      const untypedJson = yield* YeetVerdictJson.encode(untyped);
      expect(Str.includes("handlerErrorKind")(untypedJson)).toBe(false);
    })
  );
});
