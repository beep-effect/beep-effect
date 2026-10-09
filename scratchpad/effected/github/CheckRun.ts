import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
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
import * as O from "@beep/utils/Option";

const $I = $ScratchpadId.create("effected/github/CheckRun");

class UnstubbedError extends S.TaggedError<UnstubbedError>($I`UnstubbedError`)("UnstubbedError", {
  message: S.String.annotateKey({ description: "The test-double member that needs an override." }),
}, $I.annote("UnstubbedError", { description: "An unconfigured test-double member was called." })) {}

/**
 * How a check run finished.
 *
 * **Example** (Decode a neutral literal)
 *
 * ```ts
 * import { CheckConclusion } from "@beep/scratchpad/effected/github/CheckRun";
 * import * as S from "effect/Schema";
 *
 * console.log(S.decodeSync(CheckConclusion)("neutral")) // neutral
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const CheckConclusion = LiteralKit([
  "success",
  "failure",
  "neutral",
  "cancelled",
  "timed_out",
  "action_required",
  "skipped",
]).pipe($I.annoteSchema("CheckConclusion", { description: "How a check run finished." }));

/**
 * The values accepted by {@link CheckConclusion}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type CheckConclusion = typeof CheckConclusion.Type;

/**
 * How serious an annotation is.
 *
 * **Example** (Decode a warning literal)
 *
 * ```ts
 * import { AnnotationLevel } from "@beep/scratchpad/effected/github/CheckRun";
 * import * as S from "effect/Schema";
 *
 * console.log(S.decodeSync(AnnotationLevel)("warning")) // warning
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const AnnotationLevel = LiteralKit(["notice", "warning", "failure"]).pipe($I.annoteSchema("AnnotationLevel", { description: "How serious an annotation is." }));

/**
 * The values accepted by {@link AnnotationLevel}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type AnnotationLevel = typeof AnnotationLevel.Type;

/**
 * Associates a check-run finding with a repository-relative line range.
 *
 * **Example** (Annotate a repository line)
 *
 * ```ts
 * import { Annotation } from "@beep/scratchpad/effected/github/CheckRun";
 *
 * const annotation = Annotation.make({
 *   path: "src/main.ts", startLine: 1, endLine: 1,
 *   level: "warning", message: "Review this line.",
 * });
 * console.log(annotation.level) // warning
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class Annotation extends S.Class<Annotation>($I`Annotation`)({
  /**
   * Repository-relative path.
   *
   * @since 0.0.0
   */
  path: S.String.annotateKey({ description: "Repository-relative path." }),
  /**
   * First line of the range, 1-based.
   *
   * @since 0.0.0
   */
  startLine: S.Int.annotateKey({ description: "First line of the range, 1-based." }),
  /**
   * Last line of the range, 1-based.
   *
   * @since 0.0.0
   */
  endLine: S.Int.annotateKey({ description: "Last line of the range, 1-based." }),
  level: AnnotationLevel.annotateKey({ description: "How serious the annotated finding is: `notice`, `warning` or `failure`" }),
  message: S.String.annotateKey({ description: "The explanation GitHub displays for the annotated line range" }),
  title: S.optionalKey(S.String).annotateKey({ description: "An optional heading GitHub displays for the annotated finding" }),
}, $I.annote("Annotation", { description: "One annotation on a check run." })) {
}

/**
 * Carries the Markdown summary, extended text and annotations rendered for a check run.
 *
 * **Gotchas**
 *
 * GitHub's limits are **byte** limits, and that distinction is the whole reason
 * this class exists rather than a struct: `✅`, `❌`, `🦋` and `│` cost several
 * bytes each, so a character-count check passes while the request comes back
 * 422 saying *"summary exceeds a maximum bytesize of 65535"*. Use
 * {@link CheckRunOutput.truncated} to cut an output to fit.
 *
 * **Example** (Construct rendered check output)
 *
 * ```ts
 * import { CheckRunOutput } from "@beep/scratchpad/effected/github/CheckRun";
 *
 * const output = CheckRunOutput.make({ title: "lint", summary: "No findings." });
 * console.log(output.truncated().summary) // No findings.
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class CheckRunOutput extends S.Class<CheckRunOutput>($I`CheckRunOutput`)({
  title: S.String.annotateKey({ description: "The heading GitHub displays above the check run's summary" }),
  /**
   * Markdown shown under the title. Capped at 65535 **bytes**.
   *
   * @since 0.0.0
   */
  summary: S.String.annotateKey({ description: "Markdown shown under the title. Capped at 65535 **bytes**." }),
  /**
   * Longer markdown. Capped at 65535 **bytes**.
   *
   * @since 0.0.0
   */
  text: S.optionalKey(S.String).annotateKey({ description: "Longer markdown. Capped at 65535 **bytes**." }),
  /**
   * At most 50 per request; the rest are dropped by {@link CheckRunOutput.truncated}.
   *
   * @since 0.0.0
   */
  annotations: Annotation.pipe(S.Array, S.optionalKey).annotateKey({ description: "At most 50 per request; the rest are dropped by CheckRunOutput.truncated." }),
}, $I.annote("CheckRunOutput", { description: "A check run's rendered output." })) {
  /**
   * GitHub's cap on `summary` and `text`, in UTF-8 bytes.
   *
   * **Example** (Inspect the UTF-8 byte limit)
   *
   * ```ts
   * import { CheckRunOutput } from "@beep/scratchpad/effected/github/CheckRun";
   *
   * console.log(CheckRunOutput.LIMIT_BYTES) // 65535
   * ```
   *
   * @category constants
   * @since 0.0.0
   */
  static readonly LIMIT_BYTES = 65_535;
  /**
   * GitHub's cap on annotations per request.
   *
   * **Example** (Inspect the annotation limit)
   *
   * ```ts
   * import { CheckRunOutput } from "@beep/scratchpad/effected/github/CheckRun";
   *
   * console.log(CheckRunOutput.MAX_ANNOTATIONS) // 50
   * ```
   *
   * @category constants
   * @since 0.0.0
   */
  static readonly MAX_ANNOTATIONS = 50;
  /**
   * Appended when a field had to be cut.
   *
   * **Example** (Inspect the truncation notice prefix)
   *
   * ```ts
   * import { CheckRunOutput } from "@beep/scratchpad/effected/github/CheckRun";
   *
   * console.log(CheckRunOutput.NOTICE.startsWith("\n\n")) // true
   * ```
   *
   * @category constants
   * @since 0.0.0
   */
  static readonly NOTICE = "\n\n_…truncated (exceeded GitHub's 65535-byte check limit)._";

  /**
   * This output, cut to fit GitHub's limits.
   *
   * **Details**
   *
   * Pure, so the byte arithmetic is testable with no client, no layer and no
   * network — which is what lets a property test hammer it with arbitrary
   * multi-byte input.
   *
   * **Example** (Truncate oversized check output)
   *
   * ```ts
   * import { CheckRunOutput } from "@beep/scratchpad/effected/github/CheckRun";
   *
   * const output = CheckRunOutput.make({ title: "lint", summary: "x".repeat(70_000) });
   * console.log(output.truncated().summary.endsWith(CheckRunOutput.NOTICE)) // true
   * ```
   *
   * @category formatting
   * @since 0.0.0
   */
  truncated(): CheckRunOutput {
    const annotations = this.annotations;
    return CheckRunOutput.make({
      title: this.title,
      summary: capBytes(this.summary),
      ...O.getSomesStruct({ text: O.map(O.fromUndefinedOr(this.text), capBytes) }),
      ...O.getSomesStruct({ annotations: O.map(O.fromUndefinedOr(annotations), (values) => values.slice(0, CheckRunOutput.MAX_ANNOTATIONS)) }),
    });
  }
}

/**
 * Cut `value` to GitHub's byte budget without leaving a broken code point.
 *
 * **Details**
 *
 * A cut inside a UTF-8 sequence moves back to its leading byte before
 * decoding. Complete characters, including an existing U+FFFD, survive.
 *
 * @since 0.0.0
 */
const capBytes = (value: string): string => {
  if (Buffer.byteLength(value, "utf8") <= CheckRunOutput.LIMIT_BYTES) return value;
  const budget = CheckRunOutput.LIMIT_BYTES - Buffer.byteLength(CheckRunOutput.NOTICE, "utf8");
  const bytes = Buffer.from(value, "utf8");
  let end = budget;
  while (end > 0 && ((bytes[end] ?? 0) & 0xc0) === 0x80) end -= 1;
  const cut = bytes.subarray(0, end).toString("utf8");
  return `${cut}${CheckRunOutput.NOTICE}`;
};

/**
 * Captures the identity, web URL and execution status GitHub reports for a check run.
 *
 * **Example** (Read a check run identifier)
 *
 * ```ts
 * import { CheckRunRef } from "@beep/scratchpad/effected/github/CheckRun";
 *
 * const run = CheckRunRef.make({ id: 42, name: "lint", url: "https://example.com/check/42", status: "in_progress" });
 * console.log(run.id) // 42
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class CheckRunRef extends S.Class<CheckRunRef>($I`CheckRunRef`)({
  id: S.Int.annotateKey({ description: "GitHub's identifier for reading, updating and concluding this check run" }),
  name: S.String.annotateKey({ description: "The label supplied when the check run was created, as reported by GitHub" }),
  /**
   * The web URL.
   *
   * @since 0.0.0
   */
  url: S.String.annotateKey({ description: "The web URL." }),
  status: S.String.annotateKey({ description: "The check run's execution status as reported by GitHub" }),
}, $I.annote("CheckRunRef", { description: "A check run as GitHub reports it." })) {
}

/**
 * Conclude the surrounding {@link CheckRunShape.withCheckRun} explicitly.
 *
 * **Details**
 *
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
 * @category type-level
 * @since 0.0.0
 */
export type ConcludeCheckRun = (
  conclusion: (typeof CheckConclusion.literals)[number],
  output?: CheckRunOutput,
) => Effect.Effect<void>;

/**
 * Create, update and conclude GitHub check runs on a commit, including a
 * bracket that always concludes the run.
 *
 * **Details**
 *
 * Every member resolves the target repository from the `Repo` service in `R`.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface CheckRunShape {
  /**
   * Start an in-progress check run against a commit.
   *
   * @since 0.0.0
   */
  readonly create: (name: string, headSha: string) => Effect.Effect<CheckRunRef, GitHubError, Repo>;
  readonly get: (id: number) => Effect.Effect<CheckRunRef, GitHubError, Repo>;
  /**
   * Update an in-flight run's output.
   *
   * @since 0.0.0
   */
  readonly update: (id: number, output: CheckRunOutput) => Effect.Effect<void, GitHubError, Repo>;
  /**
   * Finish a run.
   *
   * @since 0.0.0
   */
  readonly complete: (
    id: number,
    conclusion: (typeof CheckConclusion.literals)[number],
    output?: CheckRunOutput,
  ) => Effect.Effect<void, GitHubError, Repo>;
  /**
   * Run `use` inside a check run, concluding it however `use` exits.
   *
   * **Details**
   *
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
   * **Example** (Conclude a lint check with a neutral verdict)
   *
   * ```ts
   * import { CheckRun, CheckRunOutput } from "@beep/scratchpad/effected/github/CheckRun";
   * import * as Effect from "effect/Effect";
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
   *
   * console.log(Effect.isEffect(lintWithCheck("abc123"))) // true
   * ```
   *
   * @since 0.0.0
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
 * **Details**
 *
 * Provide it with {@link CheckRun.layer}, which needs a `GitHubClient`; each
 * method also needs a `Repo` in `R`.
 *
 * **Example** (Compose the CheckRun service)
 *
 * ```ts
 * import { CheckRun } from "@beep/scratchpad/effected/github/CheckRun";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.flatMap(CheckRun, (service) => service.create("lint", "abc123"));
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class CheckRun extends Context.Service<CheckRun, CheckRunShape>()($I`CheckRun`) {
  /**
   * The live service, built over a `GitHubClient`.
   *
   * **Example** (Build the live CheckRun layer)
   *
   * ```ts
   * import { CheckRun } from "@beep/scratchpad/effected/github/CheckRun";
   * import * as Layer from "effect/Layer";
   *
   * console.log(Layer.isLayer(CheckRun.layer)) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<CheckRun, never, GitHubClient> = Layer.effect(
    this,
    Effect.map(GitHubClient, (client) => make(client)),
  );

  /**
   * An in-memory double; unstubbed members die naming themselves.
   *
   * **Example** (Stub CheckRun operations)
   *
   * ```ts
   * import { CheckRun } from "@beep/scratchpad/effected/github/CheckRun";
   * import * as Effect from "effect/Effect";
   *
   * const service = CheckRun.makeTest({
   *   update: () => Effect.succeed(undefined),
   * });
   * console.log(typeof service.update) // function
   * ```
   *
   * @category testing
   * @since 0.0.0
   */
  static readonly makeTest = (overrides: Partial<CheckRunShape> = {}): CheckRunShape => ({
    create: overrides.create ?? (() => unstubbed("create")),
    get: overrides.get ?? (() => unstubbed("get")),
    update: overrides.update ?? (() => unstubbed("update")),
    complete: overrides.complete ?? (() => unstubbed("complete")),
    withCheckRun: overrides.withCheckRun ?? (() => unstubbed("withCheckRun")),
  });

  /**
   * {@link CheckRun.makeTest} behind a `Layer`.
   *
   * **Example** (Provide a CheckRun test layer)
   *
   * ```ts
   * import { CheckRun } from "@beep/scratchpad/effected/github/CheckRun";
   * import * as Layer from "effect/Layer";
   *
   * console.log(Layer.isLayer(CheckRun.layerTest())) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerTest = (overrides: Partial<CheckRunShape> = {}): Layer.Layer<CheckRun> =>
    Layer.succeed(CheckRun, CheckRun.makeTest(overrides));
}

const unstubbed = (member: string): never => {
  throw UnstubbedError.make({ message: `CheckRun.makeTest: ${member}() was called but not stubbed — pass an override.` });
};

const wireOutput = (output: CheckRunOutput) => {
  const capped = output.truncated();
  return {
    title: capped.title,
    summary: capped.summary,
    ...O.getSomesStruct({ text: O.fromUndefinedOr(capped.text) }),
    ...O.getSomesStruct({
      annotations: O.map(O.fromUndefinedOr(capped.annotations), (annotations) => annotations.map((annotation) => ({
          path: annotation.path,
          start_line: annotation.startLine,
          end_line: annotation.endLine,
          annotation_level: annotation.level,
          message: annotation.message,
          ...O.getSomesStruct({ title: O.fromUndefinedOr(annotation.title) }),
      }))),
    }),
  };
};

/**
 * A verdict `use` recorded through {@link ConcludeCheckRun}.
 *
 * @since 0.0.0
 */
interface RecordedConclusion {
  readonly conclusion: (typeof CheckConclusion.literals)[number];
  readonly output: CheckRunOutput | undefined;
}

/**
 * What the bracket concludes when `use` recorded nothing.
 *
 * **Gotchas**
 *
 * **Exit-aware, because a `tap`/`tapError` pair is not.** Those two fire on
 * success and on a *typed* failure; an interrupted `use` — a cancelled
 * workflow, a job timeout, a losing branch of a race — and a defect hit
 * neither, and the run stayed `in_progress` forever. GitHub never reaps such a
 * run, so it blocks branch protection until a human deletes it by hand.
 *
 * @since 0.0.0
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
 * **Details**
 *
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
 *
 * @since 0.0.0
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
      ...O.getSomesStruct({ output: O.map(O.fromUndefinedOr(output), wireOutput) }),
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
      return yield* Effect.suspend(() => use(run.id, conclude)).pipe(
        Effect.onExit((exit) =>
          Effect.flatMap(Ref.get(recorded), (chosen) => concludeFor(name, run.id, exit, chosen, complete)),
        ),
      );
    }),
  };
};
