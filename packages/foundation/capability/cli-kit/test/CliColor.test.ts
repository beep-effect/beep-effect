import { CliColor } from "@beep/cli-kit";
import { TerminalEnv } from "@beep/runtime-env";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Context from "effect/Context";
import * as CliError from "effect/cli/CliError";
import * as CliOutput from "effect/cli/CliOutput";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Stdio from "effect/Stdio";

describe("CliColor.enabled", () => {
  const cases: ReadonlyArray<readonly [string, boolean, Record<string, string>, boolean]> = [
    [
      "TTY, no colour variables at all: a bare TTY follows Node's terminal table, so no TERM is no colour",
      true,
      {},
      false,
    ],
    ["TTY, NO_COLOR unset", true, { TERM: "xterm-256color" }, true],
    [
      "TTY, NO_COLOR empty — fromUnknown's default treats it as unset, same as fromEnv",
      true,
      { TERM: "xterm-256color", NO_COLOR: "" },
      true,
    ],
    ["TTY, NO_COLOR=1", true, { TERM: "xterm-256color", NO_COLOR: "1" }, false],
    [
      'TTY, NO_COLOR=true (okfit\'s !== "1" rule got this wrong)',
      true,
      { TERM: "xterm-256color", NO_COLOR: "true" },
      false,
    ],
    ["TTY, NO_COLOR=0 — any non-empty value disables", true, { TERM: "xterm-256color", NO_COLOR: "0" }, false],
    ["not a TTY, NO_COLOR unset", false, {}, false],
    ["not a TTY, NO_COLOR empty", false, { NO_COLOR: "" }, false],
    [
      "not a TTY, FORCE_COLOR=1 forces colour on: a forced level beats a missing TTY",
      false,
      { FORCE_COLOR: "1" },
      true,
    ],
    ["TTY, FORCE_COLOR=0 forces colour off", true, { TERM: "xterm-256color", FORCE_COLOR: "0" }, false],
    [
      "not a TTY, FORCE_COLOR=3 beats NO_COLOR=1, as in Node's getColorDepth",
      false,
      { FORCE_COLOR: "3", NO_COLOR: "1" },
      true,
    ],
    ["TTY, TERM=dumb", true, { TERM: "dumb" }, false],
  ];
  for (const [label, tty, env, expected] of cases) {
    it.layer(
      Layer.mergeAll(
        Stdio.layerTest({ stdoutIsTerminal: Effect.succeed(tty) }),
        ConfigProvider.layer(ConfigProvider.fromUnknown(env))
      ),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect(label, () =>
        Effect.gen(function* () {
          const enabled1 = yield* CliColor.enabled;
          assert.strictEqual(enabled1, expected);
        })
      );
    });
  }

  it.layer(
    Layer.mergeAll(
      Stdio.layerTest({ stdoutIsTerminal: Effect.succeed(true) }),
      ConfigProvider.layer(
        ConfigProvider.fromUnknown({ TERM: "xterm-256color", NO_COLOR: "" }, { preserveEmptyStrings: true })
      )
    ),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect(
      "TTY, NO_COLOR empty with a provider that preserves empty strings — no-color.org: only non-empty disables",
      () =>
        Effect.gen(function* () {
          const enabled2 = yield* CliColor.enabled;
          assert.strictEqual(enabled2, true);
        })
    );
  });
  it.layer(
    TerminalEnv.layerTest({ stdout: { color: "256" } }).pipe(
      Layer.provideMerge(Stdio.layerTest({ stdoutIsTerminal: Effect.succeed(false) })),
      Layer.provide(Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({})))
    ),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("an ambient TerminalEnv decides, even over a non-TTY Stdio", () =>
      Effect.gen(function* () {
        const enabled3 = yield* CliColor.enabled;
        assert.strictEqual(enabled3, true);
      })
    );
  });

  it("keeps its exact type", () => {
    const pinned = CliColor.enabled satisfies Effect.Effect<boolean, never, Stdio.Stdio>;
    assert.isDefined(pinned, "a wider requirement (Terminal, TerminalEnv) or error channel would fail to compile");
  });
});

describe("CliColor.formatterLayer", () => {
  const sampleErrors = [CliError.MissingOption.make({ option: "--required" })];

  it.layer(
    CliColor.formatterLayer({ formatVersion: (name, version) => `${name} ${version} via @scope/plugin 2.0.0` }).pipe(
      Layer.provide(Stdio.layerTest({ stdoutIsTerminal: Effect.succeed(false) })),
      Layer.provide(Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({})))
    ),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("applies an override while non-overridden methods still render the real default output", () =>
      Effect.gen(function* () {
        const formatter = yield* CliOutput.Formatter;
        assert.strictEqual(formatter.formatVersion("tool", "1.0.0"), "tool 1.0.0 via @scope/plugin 2.0.0");
        assert.strictEqual(
          formatter.formatErrors(sampleErrors),
          CliOutput.defaultFormatter({ colors: false }).formatErrors(sampleErrors)
        );
      })
    );
  });

  it.layer(
    CliColor.formatterLayer().pipe(
      Layer.provide(Stdio.layerTest({ stdoutIsTerminal: Effect.succeed(false) })),
      Layer.provide(Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({})))
    ),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("renders identically to the plain default when stdout is not a terminal", () =>
      Effect.gen(function* () {
        const formatter = yield* CliOutput.Formatter;
        assert.strictEqual(
          formatter.formatVersion("my-awesome-tool", "1.2.3"),
          CliOutput.defaultFormatter({ colors: false }).formatVersion("my-awesome-tool", "1.2.3")
        );
      })
    );
  });

  it.layer(
    CliColor.formatterLayer().pipe(
      Layer.provide(Stdio.layerTest({ stdoutIsTerminal: Effect.succeed(true) })),
      Layer.provide(
        Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ TERM: "xterm-256color" }))
      )
    ),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("renders identically to the coloured default when stdout is a terminal and NO_COLOR is unset", () =>
      Effect.gen(function* () {
        const formatter = yield* CliOutput.Formatter;
        const rendered = formatter.formatVersion("my-awesome-tool", "1.2.3");
        assert.strictEqual(
          rendered,
          CliOutput.defaultFormatter({ colors: true }).formatVersion("my-awesome-tool", "1.2.3")
        );
        assert.notStrictEqual(
          rendered,
          CliOutput.defaultFormatter({ colors: false }).formatVersion("my-awesome-tool", "1.2.3")
        );
      })
    );
  });

  const globalFlagDoc = {
    name: "log-level",
    aliases: [],
    type: "string",
    description: O.some("Sets the minimum log level"),
    required: false,
  };
  const helpDocAt = (commandPath: ReadonlyArray<string>) => ({
    description: "A command",
    usage: A.join(commandPath, " "),
    annotations: Context.empty(),
    flags: [],
    globalFlags: [globalFlagDoc],
    commandPath,
  });
  it.layer(
    CliColor.formatterLayer(
      { formatVersion: (name, version) => `${name} ${version} via @scope/plugin 2.0.0` },
      { globalFlags: "summary", inheritedFlags: "none" }
    ).pipe(
      Layer.provide(Stdio.layerTest({ stdoutIsTerminal: Effect.succeed(false) })),
      Layer.provide(Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({})))
    ),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("applies the formatter options while keeping the overrides and the colour decision", () =>
      Effect.gen(function* () {
        const formatter = yield* CliOutput.Formatter;
        const expected = CliOutput.defaultFormatter({ colors: false, globalFlags: "summary", inheritedFlags: "none" });
        const subcommand = formatter.formatHelpDoc(helpDocAt(["tool", "sub"]));
        assert.strictEqual(subcommand, expected.formatHelpDoc(helpDocAt(["tool", "sub"])));
        assert.include(subcommand, "Run 'tool --help' for global flags");
        assert.notInclude(subcommand, "--log-level");
        const root = formatter.formatHelpDoc(helpDocAt(["tool"]));
        assert.include(root, "GLOBAL FLAGS");
        assert.include(root, "--log-level");
        assert.strictEqual(formatter.formatVersion("tool", "1.0.0"), "tool 1.0.0 via @scope/plugin 2.0.0");
      })
    );
  });

  it.layer(
    CliColor.formatterLayer().pipe(
      Layer.provide(Stdio.layerTest({ stdoutIsTerminal: Effect.succeed(false) })),
      Layer.provide(Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({})))
    ),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("lists global flags in full on a subcommand when no option is given", () =>
      Effect.gen(function* () {
        const formatter = yield* CliOutput.Formatter;
        const subcommand = formatter.formatHelpDoc(helpDocAt(["tool", "sub"]));
        assert.include(subcommand, "--log-level");
        assert.notInclude(subcommand, "Run 'tool --help' for global flags");
      })
    );
  });

  it.layer(
    CliColor.formatterLayer().pipe(
      Layer.provide(Stdio.layerTest({ stdoutIsTerminal: Effect.succeed(false) })),
      Layer.provide(Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ FORCE_COLOR: "1" })))
    ),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("renders with colours under FORCE_COLOR=1 and no terminal", () =>
      Effect.gen(function* () {
        const formatter = yield* CliOutput.Formatter;
        const rendered = formatter.formatVersion("my-awesome-tool", "1.2.3");
        assert.strictEqual(
          rendered,
          CliOutput.defaultFormatter({ colors: true }).formatVersion("my-awesome-tool", "1.2.3")
        );
        assert.notStrictEqual(
          rendered,
          CliOutput.defaultFormatter({ colors: false }).formatVersion("my-awesome-tool", "1.2.3")
        );
      })
    );
  });
});
