/**
 * The practice mod's hook bodies.
 *
 * **Details**
 *
 * Claude Code reads a hooks module statically: `register` must be a function
 * declaration, every hook a function literal, and `$` may only be handed to
 * functions named at the top of the module. So each body here is curried on
 * `$` (`toolRow($)(e)`), and `src/build-plugin.ts` generates the `register`
 * entry that calls them from literal hooks.
 *
 * - practice-kg tool rows draw as plain sentences (`/practice raw` toggles
 *   the engine's own rows back, D13);
 * - the band above the prompt offers Right / Wrong / Partly / Undo for the
 *   latest answer, and `/right`, `/wrong`, `/partly` do the same (D14);
 * - `/practice export` returns the verdict log as JSON lines for explicit saving.
 *
 * **Gotchas**
 *
 * The latest answer and the raw-row toggle live in module state: a hot
 * reload forgets them until the next answer completes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { identity, pipe } from "effect/Function";
import * as Match from "effect/Match";
import * as MutableRef from "effect/MutableRef";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Str from "effect/String";
import { ModHost, ModHostError, makeModHost } from "./PracticeMod.host.ts";
import { chosenMatterOf, decodeMatterLookup } from "./PracticeMod.matters.ts";
import { phraseToolCall, practiceKgToolOf } from "./PracticeMod.phrases.ts";
import { makeTimerLog, TimerLog } from "./PracticeMod.timers.ts";
import { KgAnswerItem, TimerInterval } from "./PracticeMod.values.ts";
import { makeVerdictLog, VerdictInput, VerdictLog } from "./PracticeMod.verdicts.ts";
import type { Verdict } from "@beep/law-practice-domain/values";
import type {
  AbovePromptProps,
  CommandRunResult,
  Engine,
  PluginOptions,
  RenderElement,
  RenderInput,
  Timer,
  ToolUseProps,
  TurnCompleteInput,
} from "claude-code";
import type { ChosenMatter } from "./PracticeMod.values.ts";

type LatestAnswer = { readonly turnId: string; readonly question: string };

const DefaultServers: ReadonlyArray<string> = ["practice-kg"];

const VerdictLabel: Record<Verdict, string> = {
  right: "Right",
  wrong: "Wrong",
  partly: "Partly right",
  withdrawn: "Undone",
};

/**
 * The slash commands the mod registers.
 *
 * **Example** (List the commands)
 *
 * ```ts
 * import { PracticeCommands } from "@/PracticeMod.hooks"
 *
 * console.log(PracticeCommands.map((command) => command.name)) // ["matter", "time", "right", "wrong", "partly", "practice"]
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PracticeCommands = [
  { name: "matter", description: "Choose, show, or clear the current matter.", argumentHint: "[reference | clear]" },
  { name: "time", description: "Show, start, or stop the explicit timer.", argumentHint: "[start | stop]" },
  { name: "right", description: "Mark Claude's last answer right.", argumentHint: "[note]" },
  { name: "wrong", description: "Mark Claude's last answer wrong.", argumentHint: "[note]" },
  { name: "partly", description: "Mark Claude's last answer partly right.", argumentHint: "[note]" },
  {
    name: "practice",
    description: "Practice tools: export the verdicts, undo the last verdict, or show raw tool rows.",
    argumentHint: "export | undo | raw",
  },
];

const servers = MutableRef.make(DefaultServers);
const latest = MutableRef.make<O.Option<LatestAnswer>>(O.none());
const lastSaved = MutableRef.make<O.Option<string>>(O.none());
const rawRows = MutableRef.make(false);
const matter = MutableRef.make<O.Option<ChosenMatter>>(O.none());
const timer = MutableRef.make<O.Option<TimerInterval>>(O.none());
const ticker = MutableRef.make<O.Option<Timer>>(O.none());
const elapsedMinutes = MutableRef.make(0);
const minute = Duration.toMillis(Duration.minutes(1));
const matterLabel = (chosen: ChosenMatter): string => chosen.docketKey ?? chosen.reference;
const timerStatus = (): string =>
  pipe(MutableRef.get(timer), O.isSome)
    ? `Timer running: ${MutableRef.get(elapsedMinutes)} minutes.`
    : "Timer is stopped.";

const decodeServers = S.decodeUnknownOption(S.NonEmptyArray(S.NonEmptyString));

const runWith =
  ($: Engine) =>
  <A, E>(program: Effect.Effect<A, E, VerdictLog | TimerLog | ModHost>): Promise<A> =>
    Effect.runPromise(
      program.pipe(
        Effect.provideServiceEffect(VerdictLog, makeVerdictLog),
        Effect.provideServiceEffect(TimerLog, makeTimerLog),
        Effect.provideService(ModHost, makeModHost($))
      )
    );

// decision: shared-plugin-write-permits
const verdictWrites = Semaphore.makeUnsafe(1);

// decision: shared-plugin-write-permits
const timerWrites = Semaphore.makeUnsafe(1);

const LockedText = "This answer is locked; the verdict was not saved.";
const SaveFailedText = "The verdict could not be saved. Try again.";

// A failed save is shown as a toast: a band press has no command reply.
const toastText =
  ($: Engine) =>
  (text: string): Effect.Effect<string> =>
    Effect.as(
      Effect.sync(() => $.ui.toast(text)),
      text
    );

const noteOf = (args: string): O.Option<string> => O.liftPredicate(Str.trim(args), Str.isNonEmpty);

/**
 * Applies the plugin's options: `servers` names the MCP servers whose
 * practice-kg tools are redrawn (default `practice-kg`).
 *
 * **Example** (Reference configure)
 *
 * ```ts
 * import * as P from "effect/Predicate"
 * import { configure } from "@/PracticeMod.hooks"
 *
 * console.log(P.isFunction(configure)) // true
 * ```
 *
 * @category hooks
 * @since 0.0.0
 */
export const configure = (options: PluginOptions): void => {
  MutableRef.set(
    servers,
    O.getOrElse(decodeServers(options.servers), () => DefaultServers)
  );
};

/**
 * Registers the mod's slash commands.
 *
 * **Example** (Reference registerCommands)
 *
 * ```ts
 * import * as P from "effect/Predicate"
 * import { registerCommands } from "@/PracticeMod.hooks"
 *
 * console.log(P.isFunction(registerCommands)) // true
 * ```
 *
 * @category hooks
 * @since 0.0.0
 */
export const registerCommands = ($: Engine) => (): Promise<void> =>
  Effect.runPromise(
    Effect.forEach(PracticeCommands, (command) => Effect.promise(() => $.command.register(command)), {
      concurrency: 1,
      discard: true,
    })
  );

/**
 * Remembers the latest main-loop answer as the verdict target.
 *
 * **Example** (Reference rememberAnswer)
 *
 * ```ts
 * import * as P from "effect/Predicate"
 * import { rememberAnswer } from "@/PracticeMod.hooks"
 *
 * console.log(P.isFunction(rememberAnswer)) // true
 * ```
 *
 * @category hooks
 * @since 0.0.0
 */
export const rememberAnswer =
  ($: Engine) =>
  (e: TurnCompleteInput): Promise<void> =>
    e.agentId !== undefined || e.isAborted
      ? Promise.resolve()
      : Effect.runPromise(
          Effect.map(
            Effect.promise(() => $.session.messages()),
            (messages) => {
              const question = pipe(
                A.findLast(messages, (message) => message.role === "user"),
                O.map((message) => message.text),
                O.getOrElse(() => "")
              );
              MutableRef.set(latest, O.some({ turnId: e.turnId, question }));
              MutableRef.set(lastSaved, O.none());
              $.ui.invalidate("ui.render");
            }
          )
        );

const recordVerdict =
  ($: Engine) =>
  (verdict: Verdict, note: O.Option<string>): Promise<string> =>
    O.match(MutableRef.get(latest), {
      onNone: () => Promise.resolve("There is no answer to mark yet."),
      onSome: (answer) =>
        runWith($)(
          Effect.gen(function* () {
            const host = yield* ModHost;
            const log = yield* VerdictLog;
            const sessionId = yield* host.sessionId;
            const item = KgAnswerItem.make({
              itemId: `kg-answer:${sessionId}:${answer.turnId}`,
              sessionId,
              turnId: answer.turnId,
              question: answer.question,
              matter: MutableRef.get(matter),
            });
            yield* log.record(VerdictInput.make({ item, verdict, note }));
            const saved = verdict === "withdrawn" ? "Undone" : `Saved: ${VerdictLabel[verdict]}`;
            MutableRef.set(lastSaved, O.some(saved));
            yield* host.toast(saved);
            $.ui.invalidate("ui.render");
            return saved;
          }).pipe(
            Semaphore.withPermit(verdictWrites),
            Effect.catchTag("VerdictLocked", () => toastText($)(LockedText)),
            Effect.catch(() => toastText($)(SaveFailedText))
          )
        ),
    });

/**
 * Answers `/right`, `/wrong` and `/partly`.
 *
 * **Example** (Reference verdictCommand)
 *
 * ```ts
 * import * as P from "effect/Predicate"
 * import { verdictCommand } from "@/PracticeMod.hooks"
 *
 * console.log(P.isFunction(verdictCommand)) // true
 * ```
 *
 * @category hooks
 * @since 0.0.0
 */
export const verdictCommand =
  ($: Engine) =>
  (verdict: Verdict, args: string): Promise<CommandRunResult> =>
    recordVerdict($)(verdict, noteOf(args)).then((text) => ({ text }));

/**
 * Answers `/practice export | undo | raw`.
 *
 * **Example** (Reference practiceCommand)
 *
 * ```ts
 * import * as P from "effect/Predicate"
 * import { practiceCommand } from "@/PracticeMod.hooks"
 *
 * console.log(P.isFunction(practiceCommand)) // true
 * ```
 *
 * @category hooks
 * @since 0.0.0
 */
export const practiceCommand =
  ($: Engine) =>
  (args: string): Promise<CommandRunResult> =>
    Match.value(Str.trim(args)).pipe(
      Match.when("raw", () => {
        const raw = !MutableRef.get(rawRows);
        MutableRef.set(rawRows, raw);
        $.ui.invalidate("ui.render");
        return Promise.resolve({ text: raw ? "Showing the raw tool calls." : "Showing tool calls in plain language." });
      }),
      Match.when("undo", () => recordVerdict($)("withdrawn", O.none()).then((text) => ({ text }))),
      Match.when("export", () =>
        runWith($)(
          Effect.gen(function* () {
            const verdicts = yield* Effect.flatMap(VerdictLog, (log) => log.exportJsonl).pipe(
              Semaphore.withPermit(verdictWrites)
            );
            const intervals = yield* Effect.flatMap(TimerLog, (log) => log.exportJsonl);
            return { verdicts, intervals };
          }).pipe(
            Effect.match({
              onFailure: () => {
                $.ui.toast("The practice logs could not be exported. Try again.");
                return { text: "The practice logs could not be exported. Try again." };
              },
              onSuccess: ({ verdicts, intervals }) => ({
                text:
                  Str.isEmpty(verdicts) && Str.isEmpty(intervals)
                    ? "Nothing to export yet."
                    : `Copy these JSONL rows into files you choose.\n\nVerdicts:\n${verdicts}\nTimer intervals:\n${intervals}`,
              }),
            })
          )
        )
      ),
      Match.orElse(() => Promise.resolve({ text: "Use /practice export, /practice undo, or /practice raw." }))
    );

/**
 * The plain-language row for a practice-kg tool call, or undefined to keep
 * the engine's own row.
 *
 * **Example** (Reference toolRow)
 *
 * ```ts
 * import * as P from "effect/Predicate"
 * import { toolRow } from "@/PracticeMod.hooks"
 *
 * console.log(P.isFunction(toolRow)) // true
 * ```
 *
 * @category hooks
 * @since 0.0.0
 */
export const toolRow =
  ($: Engine) =>
  (e: RenderInput<"ToolUse", ToolUseProps>): RenderElement | undefined =>
    MutableRef.get(rawRows)
      ? undefined
      : pipe(
          practiceKgToolOf(MutableRef.get(servers), e.props.tool),
          O.map((tool) => {
            const { Text } = $.ui.resolve(e);
            const sentence = phraseToolCall(tool, e.props.input);
            return e.props.isErrored
              ? Text({ color: "red", children: `${sentence} (failed)` })
              : e.props.isRunning
                ? Text({ dimColor: true, children: `${sentence}...` })
                : Text({ children: sentence });
          }),
          O.getOrUndefined
        );

/**
 * The verdict band for the latest answer, or undefined when there is none.
 *
 * **Example** (Reference verdictBand)
 *
 * ```ts
 * import * as P from "effect/Predicate"
 * import { verdictBand } from "@/PracticeMod.hooks"
 *
 * console.log(P.isFunction(verdictBand)) // true
 * ```
 *
 * @category hooks
 * @since 0.0.0
 */
export const verdictBand =
  ($: Engine) =>
  (e: RenderInput<"AbovePrompt", AbovePromptProps>): RenderElement | undefined => {
    const chosen = MutableRef.get(matter);
    const running = MutableRef.get(timer);
    const answer = MutableRef.get(latest);
    if (A.every([O.isNone(chosen), O.isNone(running), O.isNone(answer)], identity)) return undefined;
    const { Box, Text, Button } = $.ui.resolve(e);
    const press = (verdict: Verdict) => () => void recordVerdict($)(verdict, O.none());
    return Box({
      flexDirection: "row",
      gap: 1,
      children: [
        O.getOrUndefined(O.map(chosen, (value) => Text({ children: `Matter: ${matterLabel(value)}` }))),
        pipe(
          running,
          O.map(() => Text({ children: `Timer: ${MutableRef.get(elapsedMinutes)} minutes` })),
          O.getOrUndefined
        ),
        ...(O.isSome(answer)
          ? [
              Text({ dimColor: true, children: "Last answer:" }),
              Button({ key: "verdict-right", label: "Right", onPress: press("right") }),
              Button({ key: "verdict-wrong", label: "Wrong", onPress: press("wrong") }),
              Button({ key: "verdict-partly", label: "Partly", onPress: press("partly") }),
              Button({ key: "verdict-undo", label: "Undo", plain: true, dimColor: true, onPress: press("withdrawn") }),
              pipe(
                MutableRef.get(lastSaved),
                O.map((saved) => Text({ dimColor: true, children: saved })),
                O.getOrUndefined
              ),
            ]
          : []),
      ],
    });
  };

/**
 * Chooses a matter only after a unique lookup, or shows/clears the current choice.
 *
 * **Example** (Reference the command)
 * ```ts
 * import * as P from "effect/Predicate"
 * import { matterCommand } from "@/PracticeMod.hooks"
 * console.log(P.isFunction(matterCommand)) // true
 * ```
 * @category hooks
 * @since 0.0.0
 */
export const matterCommand =
  ($: Engine) =>
  (args: string): Promise<CommandRunResult> => {
    const reference = Str.trim(args);
    return Match.value(reference).pipe(
      Match.when("", () =>
        Promise.resolve({
          text: O.match(MutableRef.get(matter), {
            onNone: () => "No matter is selected.",
            onSome: (value) => `Matter: ${matterLabel(value)}`,
          }),
        })
      ),
      Match.when("clear", () => {
        MutableRef.set(matter, O.none());
        $.ui.invalidate("ui.render");
        return Promise.resolve({ text: "Matter cleared." });
      }),
      Match.orElse(() =>
        Effect.runPromise(
          Effect.gen(function* () {
            const server = pipe(
              MutableRef.get(servers),
              A.head,
              O.getOrElse(() => "practice-kg")
            );
            const raw = yield* Effect.tryPromise({
              try: () => $.mcp.call(server, "kg_matter_lookup", { reference }),
              catch: (cause) => ModHostError.make({ operation: "matter-lookup", message: String(cause) }),
            });
            const rows = yield* decodeMatterLookup(raw);
            const chosen = chosenMatterOf(rows, reference);
            if (O.isSome(chosen)) {
              MutableRef.set(matter, chosen);
              $.ui.invalidate("ui.render");
              return { text: `Matter: ${matterLabel(chosen.value)}` };
            }
            if (A.isReadonlyArrayNonEmpty(rows) && A.some(rows, (row) => row.resolution === "ambiguous")) {
              const keys = A.take(A.dedupe(A.getSomes(A.map(rows, (row) => O.fromNullOr(row.docketKey)))), 5);
              return {
                text: `Several matters match ${reference}: ${A.join(keys, ", ")}. Repeat /matter with one of these docket keys.`,
              };
            }
            return { text: `No matter matches ${reference}.` };
          }).pipe(
            Effect.orElseSucceed(() => {
              $.ui.toast("The matter could not be looked up. Try again.");
              return { text: "The matter could not be looked up. Try again." };
            })
          )
        )
      )
    );
  };

const updateElapsed = ($: Engine) => (): Promise<void> =>
  runWith($)(
    Effect.gen(function* () {
      const running = MutableRef.get(timer);
      if (O.isSome(running)) {
        const host = yield* ModHost;
        const now = yield* host.now;
        MutableRef.set(
          elapsedMinutes,
          Math.floor(Num.max(0, DateTime.toEpochMillis(now) - DateTime.toEpochMillis(running.value.startedAt)) / minute)
        );
        $.ui.invalidate("ui.render");
      }
    }).pipe(
      Effect.orElseSucceed(() => {
        $.ui.toast("The timer clock could not be read.");
      })
    )
  );

/**
 * Starts and stops explicit timing; a failed write keeps the interval available for retry.
 *
 * **Example** (Reference the command)
 * ```ts
 * import * as P from "effect/Predicate"
 * import { timeCommand } from "@/PracticeMod.hooks"
 * console.log(P.isFunction(timeCommand)) // true
 * ```
 * @category hooks
 * @since 0.0.0
 */
export const timeCommand =
  ($: Engine) =>
  (args: string): Promise<CommandRunResult> =>
    runWith($)(
      Effect.gen(function* () {
        const host = yield* ModHost;
        return yield* Match.value(Str.trim(args)).pipe(
          Match.when("start", () =>
            Effect.gen(function* () {
              if (pipe(MutableRef.get(timer), O.isSome)) return { text: "Timer is already running." };
              const now = yield* host.now;
              const sessionId = yield* host.sessionId;
              MutableRef.set(
                timer,
                TimerInterval.makeOption({
                  schemaVersion: "practice-timer/v1",
                  sessionId,
                  matter: MutableRef.get(matter),
                  startedAt: now,
                  stoppedAt: now,
                })
              );
              MutableRef.set(elapsedMinutes, 0);
              MutableRef.set(ticker, O.some($.clock.every(minute, () => void updateElapsed($)())));
              $.ui.invalidate("ui.render");
              return { text: "Timer started." };
            }).pipe(Semaphore.withPermit(timerWrites))
          ),
          Match.when("stop", () =>
            Effect.gen(function* () {
              const running = MutableRef.get(timer);
              if (O.isNone(running)) return { text: "Timer is stopped." };
              const log = yield* TimerLog;
              const stoppedAt = yield* host.now;
              yield* log.record(TimerInterval.make({ ...running.value, stoppedAt }));
              O.map(MutableRef.get(ticker), (value) => value.cancel());
              MutableRef.set(ticker, O.none());
              MutableRef.set(timer, O.none());
              $.ui.invalidate("ui.render");
              yield* host.toast("Timer interval saved.");
              return { text: "Timer stopped. Interval saved." };
            }).pipe(Semaphore.withPermit(timerWrites))
          ),
          Match.when(
            "",
            Effect.fnUntraced(function* () {
              yield* Effect.promise(() => updateElapsed($)());
              return { text: timerStatus() };
            })
          ),
          Match.orElse(() => Effect.succeed({ text: "Use /time, /time start, or /time stop." }))
        );
      }).pipe(
        Effect.orElseSucceed(() => {
          $.ui.toast("The timer could not be saved or updated. Try again.");
          return { text: "The timer could not be saved or updated. Try again." };
        })
      )
    );
