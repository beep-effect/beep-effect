import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import { GitHubClient } from "./GitHubClient.ts";
import type { GitHubError } from "./GitHubError.ts";
import { numericId } from "./internal/ids.ts";
import { Repo } from "./Repo.ts";

/** How a check run finished. @public */
export const CheckConclusion = S.Literals([
  "success",
  "failure",
  "neutral",
  "cancelled",
  "timed_out",
  "action_required",
  "skipped",
]);

/** How serious an annotation is. @public */
export const AnnotationLevel = S.Literals(["notice", "warning", "failure"]);

/**
 * One annotation on a check run.
 *
 * @public
 */
export class Annotation extends S.Class<Annotation>("Annotation")({
  /** Repository-relative path. */
  path: S.String,
  /** First line of the range, 1-based. */
  startLine: S.Int,
  /** Last line of the range, 1-based. */
  endLine: S.Int,
  level: AnnotationLevel,
  message: S.String,
  title: S.optionalKey(S.String),
}) {
}

/**
 * A check run's rendered output.
 *
 * @remarks
 * GitHub's limits are **byte** limits, and that distinction is the whole reason
 * this class exists rather than a struct: `✅`, `❌`, `🦋` and `│` cost several
 * bytes each, so a character-count check passes while the request comes back
 * 422 saying *"summary exceeds a maximum bytesize of 65535"*. Use
 * {@link CheckRunOutput.truncated} to cut an output to fit.
 *
 * @public
 */
export class CheckRunOutput extends S.Class<CheckRunOutput>("CheckRunOutput")({
  title: S.String,
  /** Markdown shown under the title. Capped at 65535 **bytes**. */
  summary: S.String,
  /** Longer markdown. Capped at 65535 **bytes**. */
  text: S.optionalKey(S.String),
  /** At most 50 per request; the rest are dropped by {@link CheckRunOutput.truncated}. */
  annotations: Annotation.pipe(S.Array, S.optionalKey),
}) {
  /** GitHub's cap on `summary` and `text`, in UTF-8 bytes. */
  static readonly LIMIT_BYTES = 65_535;
  /** GitHub's cap on annotations per request. */
  static readonly MAX_ANNOTATIONS = 50;
  /** Appended when a field had to be cut. */
  static readonly NOTICE = "\n\n_…truncated (exceeded GitHub's 65535-byte check limit)._";

  /**
   * This output, cut to fit GitHub's limits.
   *
   * @remarks
   * Pure, so the byte arithmetic is testable with no client, no layer and no
   * network — which is what lets a property test hammer it with arbitrary
   * multi-byte input.
   */
  truncated(): CheckRunOutput {
    const annotations = this.annotations;
    return CheckRunOutput.make({
      title: this.title,
      summary: capBytes(this.summary),
      ...(this.text !== undefined ? { text: capBytes(this.text) } : {}),
      ...(annotations !== undefined ? { annotations: annotations.slice(0, CheckRunOutput.MAX_ANNOTATIONS) } : {}),
    });
  }
}

/**
 * Cut `value` to GitHub's byte budget without leaving a broken code point.
 *
 * @remarks
 * Slicing a UTF-8 buffer mid-character decodes to U+FFFD. Splitting a four-byte
 * code point can produce **more than one** replacement character, so the trim
 * loops rather than dropping a single one.
 */
const capBytes = (value: string): string => {
  if (Buffer.byteLength(value, "utf8") <= CheckRunOutput.LIMIT_BYTES) return value;
  const budget = CheckRunOutput.LIMIT_BYTES - Buffer.byteLength(CheckRunOutput.NOTICE, "utf8");
  let cut = Buffer.from(value, "utf8").subarray(0, budget).toString("utf8");
  while (cut.endsWith("�")) cut = cut.slice(0, -1);
  return `${cut}${CheckRunOutput.NOTICE}`;
};

/**
 * A check run as GitHub reports it.
 *
 * @public
 */
export class CheckRunRef extends S.Class<CheckRunRef>("CheckRunRef")({
  id: S.Int,
  name: S.String,
  /** The web URL. */
  url: S.String,
  status: S.String,
}) {
}

/**
 * Conclude the surrounding {@link CheckRunShape.withCheckRun} explicitly.
 *
 * @remarks
 * **Recording, not sending.** The call stores the verdict; the bracket's
 * finalizer writes it exactly once, on whichever path `use` leaves by. That is
 * what makes an explicit conclusion survive a later failure or an interrupt,
 * and what keeps the completion a single request no matter how many times this
 * is called. Calling it twice keeps the **last** verdict.
 *
 * Its error channel is `never` because the finalizer owns the reporting: a
 * caller that could observe a failed `complete` here would have to decide what
 * to do about it while already on the way out.
 *
 * Omit `output` to conclude without touching the run's rendered output —
 * whatever the last {@link CheckRunShape.update} wrote stays.
 *
 * @public
 */
export type ConcludeCheckRun = (
  conclusion: (typeof CheckConclusion.literals)[number],
  output?: CheckRunOutput,
) => Effect.Effect<void>;

/**
 * Create, update and conclude GitHub check runs on a commit, including a
 * bracket that always concludes the run.
 *
 * @remarks
 * Every member resolves the target repository from the `Repo` service in `R`.
 *
 * @public
 */
export interface CheckRunShape {
  /** Start an in-progress check run against a commit. */
  readonly create: (name: string, headSha: string) => Effect.Effect<CheckRunRef, GitHubError, Repo>;
  readonly get: (id: number) => Effect.Effect<CheckRunRef, GitHubError, Repo>;
  /** Update an in-flight run's output. */
  readonly update: (id: number, output: CheckRunOutput) => Effect.Effect<void, GitHubError, Repo>;
  /** Finish a run. */
  readonly complete: (
    id: number,
    conclusion: (typeof CheckConclusion.literals)[number],
    output?: CheckRunOutput,
  ) => Effect.Effect<void, GitHubError, Repo>;
  /**
   * Run `use` inside a check run, concluding it however `use` exits.
   *
   * @remarks
   * **Every exit reaches a terminal state.** Left to itself the bracket
   * concludes `"success"` on success, `"failure"` on a typed failure or a
   * defect, and `"cancelled"` on an interrupt. A run left `in_progress` is
   * never reaped by GitHub and blocks branch protection until someone deletes
   * it by hand, so the finalizer is exit-aware rather than a `tap`/`tapError`
   * pair — which fires on the first two only.
   *
   * **`use` can override that verdict**, which is how the other four
   * conclusions are reachable. `conclude` records one; a recorded verdict
   * **wins on every exit path**, including failure and interruption, because
   * how a check ran and how the surrounding program ended are different
   * questions. A findings-derived `"neutral"` is the motivating case: the work
   * ran fine and the result is advisory.
   *
   * Only the success path can fail the effect on the conclusion's behalf.
   * Neither an interrupt nor an existing failure is replaced by whatever went
   * wrong while reporting it.
   *
   * `use` keeps its own `R` and its own `A`, so the bracket composes with
   * whatever services the wrapped work needs.
   *
   * @example
   * ```ts
   * import { CheckRun, CheckRunOutput } from "./index.ts";
   * import { Effect } from "effect";
   *
   * const lintWithCheck = (sha: string) =>
   *   Effect.gen(function* () {
   *     const check = yield* CheckRun;
   *     return yield* check.withCheckRun("lint", sha, (_id, conclude) =>
   *       Effect.gen(function* () {
   *         const findings = 3; // run the linter here
   *         // An advisory result: record "neutral" instead of the default "success".
   *         yield* conclude(
   *           "neutral",
   *           CheckRunOutput.make({ title: "lint", summary: `${findings} findings` }),
   *         );
   *         return findings;
   *       }),
   *     );
   *   });
   * ```
   */
  readonly withCheckRun: <A, E, R>(
    name: string,
    headSha: string,
    use: (id: number, conclude: ConcludeCheckRun) => Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, E | GitHubError, R | Repo>;
}

/**
 * Create, update and conclude GitHub check runs, including the
 * {@link CheckRunShape.withCheckRun} bracket that always reaches a terminal state.
 *
 * @remarks
 * Provide it with {@link CheckRun.layer}, which needs a `GitHubClient`; each
 * method also needs a `Repo` in `R`.
 *
 * @public
 */
export class CheckRun extends Context.Service<CheckRun, CheckRunShape>()("@beep/scratchpad/effected/github/CheckRun") {
  /** The live service, built over a `GitHubClient`. */
  static readonly layer: Layer.Layer<CheckRun, never, GitHubClient> = Layer.effect(
    this,
    Effect.map(GitHubClient, (client) => make(client)),
  );

  /** An in-memory double; unstubbed members die naming themselves. */
  static readonly makeTest = (overrides: Partial<CheckRunShape> = {}): CheckRunShape => ({
    create: overrides.create ?? (() => unstubbed("create")),
    get: overrides.get ?? (() => unstubbed("get")),
    update: overrides.update ?? (() => unstubbed("update")),
    complete: overrides.complete ?? (() => unstubbed("complete")),
    withCheckRun: overrides.withCheckRun ?? (() => unstubbed("withCheckRun")),
  });

  /** {@link CheckRun.makeTest} behind a `Layer`. */
  static readonly layerTest = (overrides: Partial<CheckRunShape> = {}): Layer.Layer<CheckRun> =>
    Layer.succeed(CheckRun, CheckRun.makeTest(overrides));
}

const unstubbed = (member: string): never => {
  throw new Error(`CheckRun.makeTest: ${member}() was called but not stubbed — pass an override.`);
};

const wireOutput = (output: CheckRunOutput) => {
  const capped = output.truncated();
  return {
    title: capped.title,
    summary: capped.summary,
    ...(capped.text !== undefined ? { text: capped.text } : {}),
    ...(capped.annotations !== undefined
      ? {
        annotations: capped.annotations.map((annotation) => ({
          path: annotation.path,
          start_line: annotation.startLine,
          end_line: annotation.endLine,
          annotation_level: annotation.level,
          message: annotation.message,
          ...(annotation.title !== undefined ? { title: annotation.title } : {}),
        })),
      }
      : {}),
  };
};

/** A verdict `use` recorded through {@link ConcludeCheckRun}. */
interface RecordedConclusion {
  readonly conclusion: (typeof CheckConclusion.literals)[number];
  readonly output: CheckRunOutput | undefined;
}

/**
 * What the bracket concludes when `use` recorded nothing.
 *
 * @remarks
 * **Exit-aware, because a `tap`/`tapError` pair is not.** Those two fire on
 * success and on a *typed* failure; an interrupted `use` — a cancelled
 * workflow, a job timeout, a losing branch of a race — and a defect hit
 * neither, and the run stayed `in_progress` forever. GitHub never reaps such a
 * run, so it blocks branch protection until a human deletes it by hand.
 */
const defaultConclusion = <A, E>(name: string, exit: Exit.Exit<A, E>): RecordedConclusion => {
  if (Exit.isSuccess(exit)) {
    return {
      conclusion: "success",
      output: CheckRunOutput.make({
        title: name,
        summary: "Completed successfully.",
      }),
    };
  }
  const cancelled = Cause.hasInterruptsOnly(exit.cause);
  return {
    conclusion: cancelled ? "cancelled" : "failure",
    output: CheckRunOutput.make({
      title: name,
      summary: cancelled ? "Cancelled before completion." : "Failed.",
    }),
  };
};

/**
 * Conclude a bracketed run: the verdict `use` recorded, or the exit's default.
 *
 * @remarks
 * **`recorded` wins on every exit path**, including failure and interruption.
 * How the *check* ran and how the surrounding *program* ended are different
 * questions, and only `use` knows the first one — a findings-derived
 * `"neutral"` must not be overwritten by a `"cancelled"` just because the job
 * was torn down afterwards.
 *
 * `Effect.onExit` runs its finalizer **uninterruptibly**, which is what lets
 * the concluding request survive the interrupt that triggered it.
 *
 * Only the success path keeps the error channel: failing to record a success
 * is a real failure the caller should see. On the other paths the call is
 * ignored, because neither an interrupt nor an existing failure should be
 * replaced by whatever went wrong while reporting it — and that choice is the
 * **exit's**, independent of whose verdict is being written.
 */
const concludeFor = <A, E>(
  name: string,
  id: number,
  exit: Exit.Exit<A, E>,
  recorded: RecordedConclusion | undefined,
  complete: CheckRunShape["complete"],
): Effect.Effect<void, GitHubError, Repo> => {
  const settled = recorded ?? defaultConclusion(name, exit);
  const write = complete(id, settled.conclusion, settled.output);
  return Exit.isSuccess(exit) ? write : Effect.ignore(write);
};

const refOf = (raw: {
  id: number | bigint;
  name: string;
  html_url?: string | null;
  status: string
}): CheckRunRef =>
  CheckRunRef.make({
    id: numericId(raw.id),
    name: raw.name,
    url: raw.html_url ?? "",
    status: raw.status,
  });

const make = (client: GitHubClient["Service"]): CheckRunShape => {
  const create = Effect.fn("CheckRun.create")(function* (name: string, headSha: string) {
    const { owner, repo } = yield* Repo;
    yield* Effect.annotateCurrentSpan({ owner, repo, name, headSha });
    const created = yield* client.request("POST /repos/{owner}/{repo}/check-runs", {
      owner,
      repo,
      name,
      head_sha: headSha,
      status: "in_progress",
      started_at: DateTime.formatIso(yield* DateTime.now),
    });
    return refOf(created);
  });

  const complete = Effect.fn("CheckRun.complete")(function* (
    id: number,
    conclusion: (typeof CheckConclusion.literals)[number],
    output?: CheckRunOutput,
  ) {
    const { owner, repo } = yield* Repo;
    yield* Effect.annotateCurrentSpan({ owner, repo, id, conclusion });
    yield* client.request("PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}", {
      owner,
      repo,
      check_run_id: id,
      status: "completed",
      conclusion,
      completed_at: DateTime.formatIso(yield* DateTime.now),
      ...(output !== undefined ? { output: wireOutput(output) } : {}),
    });
  });

  return {
    create,
    complete,

    get: Effect.fn("CheckRun.get")(function* (id: number) {
      const { owner, repo } = yield* Repo;
      yield* Effect.annotateCurrentSpan({ owner, repo, id });
      const raw = yield* client.request("GET /repos/{owner}/{repo}/check-runs/{check_run_id}", {
        owner,
        repo,
        check_run_id: id,
      });
      return refOf(raw);
    }),

    update: Effect.fn("CheckRun.update")(function* (id: number, output: CheckRunOutput) {
      const { owner, repo } = yield* Repo;
      yield* Effect.annotateCurrentSpan({ owner, repo, id });
      yield* client.request("PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}", {
        owner,
        repo,
        check_run_id: id,
        output: wireOutput(output),
      });
    }),

    withCheckRun: Effect.fn("withCheckRun")(function* <A, E, R>(
      name: string,
      headSha: string,
      use: (id: number, conclude: ConcludeCheckRun) => Effect.Effect<A, E, R>,
    ) {
      const run = yield* create(name, headSha);
      const recorded = yield* Ref.make<RecordedConclusion | undefined>(undefined);
      const conclude: ConcludeCheckRun = (conclusion, output) => Ref.set(recorded, {
        conclusion,
        output,
      });
      return yield* use(run.id, conclude).pipe(
        Effect.onExit((exit) =>
          Effect.flatMap(Ref.get(recorded), (chosen) => concludeFor(name, run.id, exit, chosen, complete)),
        ),
      );
    }),
  };
};
