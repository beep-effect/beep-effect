import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { rootCommand } from "@beep/repo-cli/commands/Root";
import {
  CommandGroupHelp,
  commandGroupRoutes,
  DispatchTarget,
  dispatchRuntimeServices,
  loadDispatchTarget,
  loadQualityTasks,
  makeRootCommand,
  makeStubCommand,
  ROOT_COMMAND_DESCRIPTION,
  ROOT_COMMAND_NAME,
  resolveCommandTarget,
  resolveDispatchTarget,
} from "@beep/repo-cli/test/Dispatch";
import { it } from "@beep/test-runner";
import { A, O, P } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Stdio from "effect/Stdio";
import * as Terminal from "effect/Terminal";
import * as TestConsole from "effect/testing/TestConsole";

// Rendering help reads no file and spawns nothing, so the CLI environment is hermetic.
const HelpRenderLayer = Layer.mergeAll(
  MemoryFileSystem.layer,
  Path.layer,
  Stdio.layerTest({}),
  Layer.succeed(
    Terminal.Terminal,
    Terminal.make({
      columns: Effect.succeed(80),
      rows: Effect.succeed(24),
      size: Effect.die("Help rendering must not prompt."),
      readInput: Effect.die("Help rendering must not prompt."),
      readLine: Effect.die("Help rendering must not prompt."),
      display: () => Effect.void,
    })
  ),
  Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make(() => Effect.die("Help rendering must not spawn subprocesses."))
  )
);

const realGroups = A.flatMap(rootCommand.subcommands, ({ commands }) => commands);

// The fields `effect/cli` reads from a subcommand when rendering its parent's help and suggestions.
const helpFields = (command: {
  readonly name: string;
  readonly description?: string | undefined;
  readonly shortDescription?: string | undefined;
  readonly alias?: string | undefined;
  readonly unlisted?: boolean | undefined;
}) => ({
  name: command.name,
  description: command.description,
  shortDescription: command.shortDescription,
  alias: command.alias,
  unlisted: command.unlisted === true,
});

// Run a root with argv and return everything it logged, so two roots can be compared byte for byte.
const renderedOutput = Effect.fnUntraced(function* <Name extends string>(
  root: Command.Command<Name, {}, {}, never, never>,
  argv: ReadonlyArray<string>
) {
  const logged = A.length(yield* TestConsole.logLines);
  const errored = A.length(yield* TestConsole.errorLines);
  yield* Command.runWith(root, { version: "0.0.0" })(argv).pipe(Effect.ignore);
  const lines = A.appendAll(
    A.drop(yield* TestConsole.logLines, logged),
    A.drop(yield* TestConsole.errorLines, errored)
  );
  return A.join(A.filter(lines, P.isString), "\n");
});

const realRoot = rootCommand;

describe("lazy dispatch manifest", () => {
  it("registers every group of the real command tree, in root help order", () => {
    expect(A.map(commandGroupRoutes, ({ help }) => help.name)).toStrictEqual(A.map(realGroups, ({ name }) => name));
    expect(rootCommand.subcommands).toHaveLength(1);
    expect(rootCommand.name).toBe(ROOT_COMMAND_NAME);
    expect(rootCommand.description).toBe(ROOT_COMMAND_DESCRIPTION);
  });

  it("carries each group's static help fields exactly", () => {
    A.forEach(A.zip(commandGroupRoutes, realGroups), ([route, real]) => {
      expect(helpFields(route.help), `manifest help for "${real.name}" drifted`).toStrictEqual(helpFields(real));
    });
  });

  it.effect("loads the same facade command the eager root registers", () =>
    Effect.gen(function* () {
      const loaded = yield* loadDispatchTarget(DispatchTarget.cases["full-tree"].make({}));
      A.forEach(realGroups, (real) => {
        expect(
          O.exists(HashMap.get(loaded, real.name), (command) => command === real),
          `loader for "${real.name}"`
        ).toBe(true);
      });
    })
  );
});

it.layer(HelpRenderLayer, { timeout: "30 seconds" })((it) => {
  describe("lazy dispatch help rendering", () => {
    it.effect("renders root help and every group's help identically to the eager tree", () =>
      Effect.gen(function* () {
        expect(yield* renderedOutput(makeRootCommand(HashMap.empty()), ["--help"])).toBe(
          yield* renderedOutput(realRoot, ["--help"])
        );
        expect(yield* renderedOutput(makeRootCommand(HashMap.empty()), ["no-such-group"])).toBe(
          yield* renderedOutput(realRoot, ["no-such-group"])
        );
        for (const real of realGroups) {
          const lazyRoot = makeRootCommand(HashMap.make([real.name, real]));
          expect(yield* renderedOutput(lazyRoot, [real.name, "--help"]), `beep ${real.name} --help`).toBe(
            yield* renderedOutput(realRoot, [real.name, "--help"])
          );
        }
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );
  });
});

describe("help-only stub commands", () => {
  it("carries every optional help field a group may set", () => {
    const stub = makeStubCommand(
      CommandGroupHelp.make({
        name: "example",
        description: "Example group",
        shortDescription: "Example",
        alias: "ex",
        unlisted: true,
      })
    );
    expect(helpFields(stub)).toStrictEqual({
      name: "example",
      description: "Example group",
      shortDescription: "Example",
      alias: "ex",
      unlisted: true,
    });
    expect(helpFields(makeStubCommand(CommandGroupHelp.make({ name: "bare" })))).toStrictEqual({
      name: "bare",
      description: undefined,
      shortDescription: undefined,
      alias: undefined,
      unlisted: false,
    });
  });

  it.effect("loads the quality-task parser and runner on demand", () =>
    Effect.gen(function* () {
      const tasks = yield* Effect.promise(loadQualityTasks);
      expect(P.isFunction(tasks.parseQualityTaskInvocation)).toBe(true);
      expect(P.isFunction(tasks.runQualityTask)).toBe(true);
    })
  );
});

describe("argv-first dispatch target", () => {
  const group = (name: string) => DispatchTarget.cases.group.make({ name });
  const root = DispatchTarget.cases.root.make({});
  const fullTree = DispatchTarget.cases["full-tree"].make({});
  const qualityTask = DispatchTarget.cases["quality-task"].make({});

  it("names the first positional group after root flags and their values", () => {
    expect(resolveCommandTarget(["yeet", "--help"])).toStrictEqual(group("yeet"));
    expect(resolveCommandTarget(["--log-level", "debug", "lint", "laws", "--help"])).toStrictEqual(group("lint"));
    expect(resolveCommandTarget(["--log-level=debug", "docs"])).toStrictEqual(group("docs"));
    expect(resolveCommandTarget(["-h", "ci"])).toStrictEqual(group("ci"));
  });

  it("renders the root alone when no known group is named", () => {
    expect(resolveCommandTarget([])).toStrictEqual(root);
    expect(resolveCommandTarget(["--help"])).toStrictEqual(root);
    expect(resolveCommandTarget(["--version"])).toStrictEqual(root);
    expect(resolveCommandTarget(["no-such-group"])).toStrictEqual(root);
    expect(resolveCommandTarget(["--", "yeet"])).toStrictEqual(root);
  });

  it("loads the full tree for flags that walk every group", () => {
    expect(resolveCommandTarget(["--completions", "zsh"])).toStrictEqual(fullTree);
    expect(resolveCommandTarget(["--completions=bash"])).toStrictEqual(fullTree);
    expect(resolveCommandTarget(["--wizard"])).toStrictEqual(fullTree);
  });

  it("routes root quality tasks before groups, except lint policy subcommands and root flags", () => {
    expect(resolveDispatchTarget(["build"])).toStrictEqual(qualityTask);
    expect(resolveDispatchTarget(["lint", "--fix"])).toStrictEqual(qualityTask);
    expect(resolveDispatchTarget(["lint", "laws"])).toStrictEqual(group("lint"));
    expect(resolveDispatchTarget(["check", "--help"])).toStrictEqual(root);
    expect(resolveDispatchTarget(["ci", "run"])).toStrictEqual(group("ci"));
  });

  it("builds only the runtime services the dispatched group declares", () => {
    expect(HashSet.size(dispatchRuntimeServices(root))).toBe(0);
    expect(HashSet.size(dispatchRuntimeServices(qualityTask))).toBe(0);
    expect(A.fromIterable(dispatchRuntimeServices(group("ci")))).toStrictEqual(["fs-utils"]);
    expect(HashSet.size(dispatchRuntimeServices(fullTree))).toBe(3);
  });
});
