import { CliAudience, CliInteractive, CliPrompt, CliRuntime } from "@beep/cli-kit";
import { TestTerminal } from "@beep/cli-kit/testing";
import { MemoryFileSystem } from "@beep/memfs";
import { Audience, TerminalEnv } from "@beep/runtime-env";
import { AudienceShape } from "@beep/runtime-env/Audience";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as CliConfig from "effect/cli/CliConfig";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as GlobalFlag from "effect/cli/GlobalFlag";
import * as Prompt from "effect/cli/Prompt";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Result from "effect/Result";
import * as Runtime from "effect/Runtime";
import * as S from "effect/Schema";
import * as Stdio from "effect/Stdio";
import * as Str from "effect/String";
import * as Terminal from "effect/Terminal";

const gateLayer = (interactive: boolean, builtIns: ReadonlyArray<GlobalFlag.BuiltIn> = GlobalFlag.BuiltIns) =>
  CliPrompt.gateWizard.pipe(
    Layer.provide(Layer.succeed(CliInteractive, interactive)),
    Layer.provide(CliConfig.layer({ builtIns }))
  );
const terminalFactsLayer = (stdin: boolean, stdout: boolean) =>
  TerminalEnv.layerTest({ stdinIsTerminal: stdin, stdout: { isTerminal: stdout } });
const makeFixtures = Effect.gen(function* () {
  return {
    gateQuiet: yield* Layer.build(gateLayer(false)),
    gateHuman: yield* Layer.build(gateLayer(true)),
    gateConsumer: yield* Layer.build(
      gateLayer(
        false,
        A.filter(GlobalFlag.BuiltIns, (flag) => flag !== GlobalFlag.Wizard)
      )
    ),
    tt: yield* Layer.build(terminalFactsLayer(true, true)),
    tf: yield* Layer.build(terminalFactsLayer(true, false)),
    ft: yield* Layer.build(terminalFactsLayer(false, true)),
    ff: yield* Layer.build(terminalFactsLayer(false, false)),
  };
});
class Fixtures extends Context.Service<Fixtures, Effect.Success<typeof makeFixtures>>()(
  "@beep/cli-kit/test/CliAudience.run.test/Fixtures"
) {}
const fixturesLayer = Layer.effect(Fixtures, makeFixtures);

const Json = S.fromJsonString(S.Unknown);

const memoryPlatform = (fs: FileSystem.FileSystem) =>
  Layer.mergeAll(
    Layer.succeed(FileSystem.FileSystem, fs),
    Path.layer,
    Layer.mock(ChildProcessSpawner.ChildProcessSpawner, { spawn: () => Effect.die("unexpected child process") }),
    Stdio.layerTest({}),
    Layer.succeed(
      Terminal.Terminal,
      Terminal.make({
        columns: Effect.succeed(80),
        rows: Effect.succeed(24),
        size: Effect.die("unused"),
        readInput: Effect.die("unused"),
        readLine: Effect.die("unused"),
        display: () => Effect.void,
      })
    )
  );

const capturing = () => {
  const out: string[] = [];
  const err: string[] = [];
  const double: Console.Console = Object.assign(Object.create(console), {
    log: (...args: ReadonlyArray<unknown>) => out.push(pipe(args, A.map(String), A.join(" "))),
    error: (...args: ReadonlyArray<unknown>) => err.push(pipe(args, A.map(String), A.join(" "))),
  });
  return { double, out, err };
};

const profile = Flag.String("profile").pipe(
  Flag.withFallbackPrompt(
    CliPrompt.fallback(
      Prompt.Select({
        message: "Profile",
        choices: [
          { title: "x", value: "x" },
          { title: "library", value: "library" },
        ],
      }),
      { flag: "profile", otherwise: "x" }
    )
  )
);

const init = Command.make("init", { profile }, ({ profile }) =>
  Effect.gen(function* () {
    const audience = yield* Audience;
    yield* Console.log(`profile=${profile} audience=${audience.kind}/${audience.source}`);
  })
);
const root = Command.make("tool").pipe(Command.withSharedFlags(CliAudience.flags()), Command.withSubcommands([init]));

const keysThatPickLibrary = [{ name: "down" }, { name: "enter" }] as const;

const run = Effect.fn("run")(function* (
  argv: ReadonlyArray<string>,
  via: "runWith" | "core" = "runWith",
  gateWizard?: boolean
) {
  const fixtures = yield* Fixtures;
  const terminal = yield* TestTerminal.make();
  yield* terminal.input(keysThatPickLibrary);
  const { double, out, err } = capturing();
  const program =
    via === "runWith"
      ? CliAudience.runWith(root, { version: "1.0.0" })(argv)
      : Command.runWith(CliAudience.provide(root), { version: "1.0.0" })(argv);
  const FileSystem1 = yield* FileSystem.FileSystem;
  const exit = yield* CliRuntime.main(program, {
    platform: Layer.mergeAll(memoryPlatform(FileSystem1), CliPrompt.gateTerminal.pipe(Layer.provide(terminal.layer))),
  }).pipe(
    Effect.exit,
    Effect.provideService(Console.Console, double),
    gateWizard === true ? Effect.provideContext(fixtures.gateHuman) : (self) => self,
    Effect.provideService(CliInteractive, true),
    Effect.provideService(Audience, AudienceShape.make({ kind: "human", source: "detected" }))
  );
  const code = Exit.isFailure(exit) ? exit.cause.pipe(Cause.squash, Runtime.getErrorExitCode) : 0;
  return { out, err, code, reads: yield* terminal.reads };
});

const QUIET = { keys: 0, lines: 0, subscriptions: 0 };

it.layer(Layer.mergeAll(MemoryFileSystem.layer, fixturesLayer), { timeout: "30 seconds" })((it) => {
  describe("CliAudience.runWith resolves the audience flag before core parses, where a fallback prompt fires", () => {
    it.effect("no flag: the human on a terminal is prompted", () =>
      Effect.gen(function* () {
        const { out, reads } = yield* run(["init"]);
        assert.deepStrictEqual(out, ["profile=library audience=human/detected"]);
        assert.deepStrictEqual(reads.keys, 2);
        assert.isAtLeast(reads.subscriptions, 1);
      })
    );

    for (const [label, argv, audience] of [
      ["--agent before the subcommand", ["--agent", "init"], "agent"],
      ["--ci before the subcommand", ["--ci", "init"], "ci"],
      ["--agent after the subcommand", ["init", "--agent"], "agent"],
      ["--audience agent", ["--audience", "agent", "init"], "agent"],
      ["--audience=ci", ["--audience=ci", "init"], "ci"],
    ] as const) {
      it.effect(`${label}: no prompt, the fallback default is used, the terminal is never touched`, () =>
        Effect.gen(function* () {
          const { out, code, reads } = yield* run(argv);
          assert.strictEqual(code, 0);
          assert.deepStrictEqual(out, [`profile=x audience=${audience}/flag`]);
          assert.deepStrictEqual(reads, QUIET);
        })
      );
    }

    it.effect("--no-agent and --agent=false are not given: the prompt still fires", () =>
      Effect.gen(function* () {
        for (const argv of [
          ["--no-agent", "init"],
          ["--agent=false", "init"],
          ["--agent", "false", "init"],
        ]) {
          const { out, reads } = yield* run(argv);
          assert.deepStrictEqual(out, ["profile=library audience=human/detected"], A.join(argv, " "));
          assert.deepStrictEqual(reads.keys, 2);
        }
      })
    );

    it.effect("--human on an interactive run still prompts, and the audience is the flag's", () =>
      Effect.gen(function* () {
        const { out } = yield* run(["--human", "init"]);
        assert.deepStrictEqual(out, ["profile=library audience=human/flag"]);
      })
    );

    it.effect("--agent --ci: exit 64 from core's own resolver, and no prompt", () =>
      Effect.gen(function* () {
        const { out, err, code, reads } = yield* run(["--agent", "--ci", "init"]);
        assert.strictEqual(code, 64);
        assert.isFalse(A.some(out, (line) => Str.startsWith("profile=")(line)));
        assert.isTrue(
          A.some(err, (line) => Str.includes("Give at most one of --audience, --human, --agent, --ci")(line))
        );
        assert.deepStrictEqual(reads, QUIET);
      })
    );

    it.effect("control: core's own runWith lets the prompt fire under --agent (the parse-order gap)", () =>
      Effect.gen(function* () {
        const { out, reads } = yield* run(["--agent", "init"], "core");
        assert.deepStrictEqual(out, ["profile=library audience=agent/flag"]);
        assert.deepStrictEqual(reads.keys, 2, "the fallback ran before the flag was visible, so the terminal was read");
      })
    );

    it.effect("--agent --wizard on a human terminal is an unrecognised flag (64), never the wizard", () =>
      Effect.gen(function* () {
        const { out, err, code } = yield* run(["--agent", "--wizard", "init"], "runWith", true);
        assert.strictEqual(code, 64, "gateWizard decided from the audience detected at build time, before the flag");
        assert.isTrue(
          A.some(err, (line) => Str.includes("wizard")(line)),
          A.join(err, "\n")
        );
        assert.isFalse(
          A.some(out, (line) => /wizard/i.test(line) && !Str.includes("--wizard")(line)),
          "no wizard output"
        );
      })
    );

    it.effect("runWith applies provide itself: --agent --ci exits 64 with no explicit provide on the root", () =>
      Effect.gen(function* () {
        const { code, out } = yield* run(["--agent", "--ci", "init"]);
        assert.strictEqual(code, 64, "without provide the conflict check is skipped and the handler exits 0");
        assert.isFalse(A.some(out, (line) => Str.startsWith("profile=")(line)));
      })
    );

    it("a root without the shared audience flags is a compile error", () => {
      const bare = Command.make("tool").pipe(Command.withSubcommands([Command.make("x", {}, () => Effect.void)]));
      type DataFirstParameters<F> = F extends { (...args: infer A): unknown; (...args: infer _B): unknown } ? A : never;
      const acceptsBare: typeof bare extends DataFirstParameters<typeof CliAudience.runWith>[0] ? true : false = false;
      assert.isFalse(
        acceptsBare,
        "the root must carry the four shared flags (runWith is dual: read its data-first overload)"
      );
    });
  });

  describe("CliAudience: a flag decides CliInteractive from the TTY facts", () => {
    interface Facts {
      readonly ambient: boolean;
      readonly detected: "human" | "agent" | "ci";
      readonly stdin: boolean;
      readonly stdout: boolean;
    }

    const probe = Command.make("probe", {}, () =>
      Effect.gen(function* () {
        const audience = yield* Audience;
        yield* Console.log(`interactive=${yield* CliInteractive} audience=${audience.kind}/${audience.source}`);
      })
    );
    const both = Command.make("tool").pipe(
      Command.withSharedFlags(CliAudience.flags()),
      Command.withSubcommands([init, probe])
    );

    interface RunUnderOptions {
      readonly builtInsInsideGate?: ReadonlyArray<GlobalFlag.BuiltIn>;
      readonly builtInsUnderGate?: ReadonlyArray<GlobalFlag.BuiltIn>;
      readonly endInput?: boolean;
      readonly env?: Record<string, string>;
      readonly gateWizard?: boolean;
      readonly via?: "runWith" | "core";
    }

    const terminalFixture = (facts: Facts, fixtures: typeof Fixtures.Service) => {
      if (facts.stdin) return facts.stdout ? fixtures.tt : fixtures.tf;
      return facts.stdout ? fixtures.ft : fixtures.ff;
    };

    const wizardFixture = (
      facts: Facts,
      fixtures: typeof Fixtures.Service,
      builtIns: RunUnderOptions["builtInsUnderGate"]
    ) => (builtIns === undefined ? (facts.ambient ? fixtures.gateHuman : fixtures.gateQuiet) : fixtures.gateConsumer);

    const runUnder = Effect.fn("runUnder")(function* (
      facts: Facts,
      argv: ReadonlyArray<string>,
      options: RunUnderOptions = {}
    ) {
      const {
        via = "runWith",
        gateWizard = false,
        endInput = false,
        builtInsUnderGate: builtIns,
        builtInsInsideGate,
        env = {},
      } = options;
      const fixtures = yield* Fixtures;
      const terminal = yield* TestTerminal.make();
      yield* terminal.input(keysThatPickLibrary);
      if (endInput === true) yield* terminal.end;
      const { double, out, err } = capturing();
      const program =
        via === "runWith"
          ? CliAudience.runWith(both, { version: "1.0.0" })(argv)
          : Command.runWith(CliAudience.provide(both), { version: "1.0.0" })(argv);
      const insideGate =
        builtInsInsideGate === undefined
          ? program
          : Effect.provideService(program, CliConfig.CliConfig, CliConfig.make({ builtIns: builtInsInsideGate }));
      const FileSystem2 = yield* FileSystem.FileSystem;
      const exit = yield* CliRuntime.main(insideGate, {
        platform: Layer.mergeAll(
          memoryPlatform(FileSystem2),
          CliPrompt.gateTerminal.pipe(Layer.provide(terminal.layer))
        ),
      }).pipe(
        Effect.exit,
        Effect.provideService(Console.Console, double),
        gateWizard === true ? Effect.provideContext(wizardFixture(facts, fixtures, builtIns)) : (self) => self,
        builtIns === undefined
          ? (self) => self
          : Effect.provideService(CliConfig.CliConfig, CliConfig.make({ builtIns })),
        Effect.provideService(CliInteractive, facts.ambient),
        Effect.provideContext(terminalFixture(facts, fixtures)),
        Effect.provideService(Audience, AudienceShape.make({ kind: facts.detected, source: "detected" })),
        Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env))
      );
      const code = Exit.isFailure(exit) ? exit.cause.pipe(Cause.squash, Runtime.getErrorExitCode) : 0;
      return { out, err, code, reads: yield* terminal.reads };
    });

    const agentOnTtys: Facts = { detected: "agent", stdin: true, stdout: true, ambient: false };

    it.effect("--human on real TTYs widens a detected agent: the prompt runs", () =>
      Effect.gen(function* () {
        const { out, reads, code } = yield* runUnder(agentOnTtys, ["--human", "init"]);
        assert.strictEqual(code, 0);
        assert.deepStrictEqual(out, ["profile=library audience=human/flag"]);
        assert.strictEqual(reads.keys, 2, "the prompt read the terminal");
      })
    );

    it.effect("--human still cannot prompt without a terminal on stdin, or on stdout", () =>
      Effect.gen(function* () {
        for (const facts of [
          { ...agentOnTtys, stdin: false },
          { ...agentOnTtys, stdout: false },
          { ...agentOnTtys, stdin: false, stdout: false },
        ]) {
          const { out, reads } = yield* runUnder(facts, ["--human", "init"]);
          assert.deepStrictEqual(
            out,
            ["profile=x audience=human/flag"],
            Result.getOrThrow(S.encodeUnknownResult(Json)(facts))
          );
          assert.deepStrictEqual(reads, QUIET, Result.getOrThrow(S.encodeUnknownResult(Json)(facts)));
        }
      })
    );

    it.effect("--human cannot prompt on a TERM=dumb terminal, through runWith and through a bare provide", () =>
      Effect.gen(function* () {
        for (const via of ["runWith", "core"] as const) {
          const dumb = yield* runUnder(agentOnTtys, ["--human", "probe"], { via, env: { TERM: "dumb" } });
          assert.deepStrictEqual(dumb.out, ["interactive=false audience=human/flag"], via);
          const real = yield* runUnder(agentOnTtys, ["--human", "probe"], { via, env: { TERM: "xterm" } });
          assert.deepStrictEqual(real.out, ["interactive=true audience=human/flag"], `${via} control`);
        }
      })
    );

    it.effect("--agent and --ci still narrow, even on a human terminal", () =>
      Effect.gen(function* () {
        const humanOnTtys: Facts = { detected: "human", stdin: true, stdout: true, ambient: true };
        for (const flag of ["--agent", "--ci"]) {
          const { out, reads } = yield* runUnder(humanOnTtys, [flag, "init"]);
          assert.deepStrictEqual(out, [`profile=x audience=${Str.slice(2)(flag)}/flag`], flag);
          assert.deepStrictEqual(reads, QUIET, flag);
        }
      })
    );

    it.effect("a conflict is never interactive, whatever the TTYs say", () =>
      Effect.gen(function* () {
        const { code, reads } = yield* runUnder(agentOnTtys, ["--human", "--agent", "init"]);
        assert.strictEqual(code, 64);
        assert.deepStrictEqual(reads, QUIET);
      })
    );

    it.effect("the handler sees the recomputed value, through runWith and through a bare provide", () =>
      Effect.gen(function* () {
        for (const via of ["runWith", "core"] as const) {
          const widened = yield* runUnder(agentOnTtys, ["--human", "probe"], { via });
          assert.deepStrictEqual(widened.out, ["interactive=true audience=human/flag"], via);
          const piped = yield* runUnder({ ...agentOnTtys, stdin: false }, ["--human", "probe"], { via });
          assert.deepStrictEqual(piped.out, ["interactive=false audience=human/flag"], `${via} piped`);
          const narrowed = yield* runUnder(
            { detected: "human", stdin: true, stdout: true, ambient: true },
            ["--agent", "probe"],
            { via }
          );
          assert.deepStrictEqual(narrowed.out, ["interactive=false audience=agent/flag"], `${via} agent`);
          const none = yield* runUnder(agentOnTtys, ["probe"], { via });
          assert.deepStrictEqual(
            none.out,
            ["interactive=false audience=agent/detected"],
            `${via} no flag: the ambient value stays`
          );
        }
      })
    );

    it.effect("--human --wizard on real TTYs is the wizard, not an unknown flag, though the gate had dropped it", () =>
      Effect.gen(function* () {
        const { err, code, reads } = yield* runUnder(agentOnTtys, ["--human", "--wizard", "init"], {
          gateWizard: true,
          endInput: true,
        });
        assert.isAtLeast(reads.subscriptions, 1, "the wizard read the terminal, and quit once its input ended");
        assert.isFalse(
          A.some(err, (line) => /unrecogni[sz]ed.*wizard|wizard.*unrecogni[sz]ed|unknown.*wizard/i.test(line)),
          A.join(err, "\n")
        );
        assert.notStrictEqual(code, 64, A.join(err, "\n"));
        const piped = yield* runUnder({ ...agentOnTtys, stdin: false }, ["--human", "--wizard", "init"], {
          gateWizard: true,
        });
        assert.strictEqual(piped.code, 64, "without a terminal the gate's drop stands: the wizard is an unknown flag");
      })
    );

    it.effect(
      "a consumer who left --wizard out of their own builtIns keeps it out: only a drop by the gate is restored",
      () =>
        Effect.gen(function* () {
          const noWizard = A.filter(GlobalFlag.BuiltIns, (flag) => flag !== GlobalFlag.Wizard);
          assert.isFalse(noWizard.includes(GlobalFlag.Wizard));
          const { err, code, reads } = yield* runUnder(agentOnTtys, ["--human", "--wizard", "init"], {
            gateWizard: true,
            endInput: true,
            builtInsUnderGate: noWizard,
          });
          assert.strictEqual(code, 64, A.join(err, "\n"));
          assert.isTrue(
            A.some(err, (line) => /unrecogni[sz]ed.*wizard/i.test(line)),
            A.join(err, "\n")
          );
          assert.strictEqual(
            reads.subscriptions,
            0,
            "the gate had nothing to drop, so --human must not invent a wizard"
          );
          const prompted = yield* runUnder(agentOnTtys, ["--human", "init"], {
            gateWizard: true,
            builtInsUnderGate: noWizard,
          });
          assert.deepStrictEqual(
            prompted.out,
            ["profile=library audience=human/flag"],
            "the same consumer's --human still widens the prompt itself"
          );
        })
    );

    it.effect(
      "a consumer config provided INSIDE the gate, without Wizard, is not overridden: --human --wizard is 64",
      () =>
        Effect.gen(function* () {
          const noWizard = A.filter(GlobalFlag.BuiltIns, (flag) => flag !== GlobalFlag.Wizard);
          const inner = yield* runUnder(agentOnTtys, ["--human", "--wizard", "init"], {
            gateWizard: true,
            endInput: true,
            builtInsInsideGate: noWizard,
          });
          assert.strictEqual(inner.code, 64, A.join(inner.err, "\n"));
          assert.isTrue(
            A.some(inner.err, (line) => /unrecogni[sz]ed.*wizard/i.test(line)),
            A.join(inner.err, "\n")
          );
          assert.strictEqual(
            inner.reads.subscriptions,
            0,
            "the gate's drop mark is on its own config, not the consumer's"
          );
          const control = yield* runUnder(agentOnTtys, ["--human", "--wizard", "init"], {
            gateWizard: true,
            endInput: true,
          });
          assert.isTrue(
            control.reads.subscriptions >= 1,
            "with no consumer config inside, the gate's own config is restored"
          );
        })
    );

    it.effect("the gate's drop is restored, and a second flag-driven narrowing then drops it again", () =>
      Effect.gen(function* () {
        const back = yield* runUnder(agentOnTtys, ["--human", "--wizard", "init"], {
          gateWizard: true,
          endInput: true,
        });
        assert.isTrue(back.reads.subscriptions >= 1, "--human on TTYs brings back the wizard the gate dropped");
        const humanOnTtys: Facts = { detected: "human", stdin: true, stdout: true, ambient: true };
        const dropped = yield* runUnder(humanOnTtys, ["--agent", "--wizard", "init"], { gateWizard: true });
        assert.strictEqual(dropped.code, 64, "a non-human flag drops the wizard whatever the ambient config had");
      })
    );

    it.effect("with no TerminalEnv in the environment a flag only narrows, as before", () =>
      Effect.gen(function* () {
        const { out, reads } = yield* run(["--human", "init"]);
        assert.deepStrictEqual(out, ["profile=library audience=human/flag"]);
        assert.strictEqual(reads.keys, 2, "the first block's harness provides no TerminalEnv: the ambient value stays");
      })
    );
  });
});
