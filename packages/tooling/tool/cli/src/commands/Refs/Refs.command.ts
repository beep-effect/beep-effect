/**
 * Operator commands for the manifest-defined Effect reference workspace.
 * @packageDocumentation
 * @since 0.0.0
 */
import { Config, Console, Effect } from "effect";
import * as A from "effect/Array";
import { Command, Flag } from "effect/cli";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { resolveOperatorPath, resolveUnitBunPath } from "../../internal/systemd/index.ts";
import { ReferenceWorkspaceError } from "./Refs.errors.ts";
import { RefsRefreshStatus } from "./Refs.schemas.ts";
import { ReferenceWorkspace, ReferenceWorkspaceLive, referenceWorkspaceLayer } from "./Refs.service.ts";

const rootFlag = Flag.String("root").pipe(
  Flag.optional,
  Flag.withDescription("Reference workspace root; defaults to BEEP_REFERENCES_ROOT or the manifest")
);
const homeConfig = Config.String("HOME").pipe(
  Effect.mapError((cause) => ReferenceWorkspaceError.make({ path: "HOME", message: "HOME is required.", cause }))
);

const planCommand = Command.make(
  "plan",
  { root: rootFlag },
  Effect.fn("Refs.plan")(function* ({ root }) {
    const home = yield* homeConfig;
    const workspace = yield* ReferenceWorkspace;
    const resolved = yield* workspace.resolveRoot(home, root);
    yield* Console.log(A.join(yield* workspace.plan(home, resolved), "\n"));
  })
).pipe(
  Command.withDescription("Print the clone, link, and build plan without writing"),
  Command.provide(ReferenceWorkspaceLive)
);

const refreshCommand = Command.make(
  "refresh",
  { root: rootFlag, jobs: Flag.Int("jobs").pipe(Flag.withDefault(16)) },
  Effect.fn("Refs.refresh")(function* ({ root, jobs }) {
    const home = yield* homeConfig;
    const workspace = yield* ReferenceWorkspace;
    const resolved = yield* workspace.resolveRoot(home, root);
    const status = yield* workspace.refresh(home, resolved, jobs);
    yield* Console.log(yield* S.encodeEffect(S.fromJsonString(RefsRefreshStatus))(status));
  })
).pipe(
  Command.withDescription("Pull clean main members and rebuild their reference indexes (operator only)"),
  Command.provide(ReferenceWorkspaceLive)
);

const timerCommand = Command.make(
  "install-timer",
  {
    owner: Flag.String("owner").pipe(Flag.optional),
    onCalendar: Flag.String("on-calendar").pipe(Flag.optional),
    bunPath: Flag.String("bun-path").pipe(Flag.optional),
    refresh: Flag.Boolean("refresh").pipe(Flag.withDefault(false)),
    uninstall: Flag.Boolean("uninstall").pipe(Flag.withDefault(false)),
  },
  Effect.fn("Refs.installTimer")(function* (options) {
    const home = yield* homeConfig;
    const workspace = yield* ReferenceWorkspace;
    if (options.refresh && options.uninstall)
      return yield* ReferenceWorkspaceError.make({ path: home, message: "Choose --refresh or --uninstall, not both." });
    if (options.uninstall) return yield* Console.log(A.join(yield* workspace.uninstallTimer(home), "\n"));
    if (options.refresh) {
      if (O.isSome(options.owner) || O.isSome(options.onCalendar))
        return yield* ReferenceWorkspaceError.make({
          path: home,
          message: "--refresh reuses the installed owner and calendar; omit --owner and --on-calendar.",
        });
      return yield* Console.log(A.join(yield* workspace.refreshTimer(home, options.bunPath), "\n"));
    }
    if (O.isNone(options.owner))
      return yield* ReferenceWorkspaceError.make({
        path: home,
        message: "--owner is required for a fresh timer installation.",
      });
    const path = yield* Path.Path;
    const owner = resolveOperatorPath(options.owner.value, home, path.resolve);
    const bunPath = yield* resolveUnitBunPath({ home, pinned: options.bunPath });
    const install = ReferenceWorkspace.use(
      Effect.fnUntraced(function* (owned) {
        const root = yield* owned.resolveRoot(home, O.none());
        return yield* owned.installTimer(
          home,
          root,
          O.getOrElse(options.onCalendar, () => "*-*-* 03:30:00"),
          bunPath
        );
      })
    );
    yield* Console.log(
      A.join(
        yield* Effect.scoped(
          Layer.build(referenceWorkspaceLayer(owner)).pipe(
            Effect.flatMap((context) => install.pipe(Effect.provide(context)))
          )
        ),
        "\n"
      )
    );
  })
).pipe(
  Command.withDescription("Install, re-render, or uninstall beep-refs-refresh user units"),
  Command.provide(ReferenceWorkspaceLive)
);

/**
 * Registers reference planning, refresh, and timer operations beside Graft.
 *
 * **Example** (Inspect the command name)
 * ```ts
 * import { refsCommand } from "@beep/repo-cli/commands/Refs"
 * refsCommand.name // => "refs"
 * ```
 * @category cli-commands
 * @since 0.0.0
 */
export const refsCommand = Command.make("refs", {}, () =>
  Console.log("Reference commands: plan, refresh, install-timer")
).pipe(
  Command.withDescription("Manage the manifest-defined reference workspace"),
  Command.withSubcommands([planCommand, refreshCommand, timerCommand])
);
