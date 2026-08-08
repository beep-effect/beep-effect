import chalk, {
  Chalk,
  ChalkConstructorOptions,
  ChalkOptions,
  ColorInfo,
  ColorName,
  ColorSupport,
  ColorSupportLevel,
  chalkStderr,
  ModifierName,
} from "@beep/chalk";
import browserChalk, {
  chalkStderr as browserChalkStderr,
  supportsColor as browserSupportsColor,
  supportsColorStderr as browserSupportsColorStderr,
} from "@beep/chalk/Chalk.browser";
import { AnsiRenderLevel, ColorModelName, StyleChannel, StyleName } from "@beep/chalk/internal/ChalkSchema";
import { createSupportsColor } from "@beep/chalk/internal/SupportsColor";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import * as Equal from "effect/Equal";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import type { ChalkInstance, ColorSupportLevel as ColorSupportLevelType } from "@beep/chalk";

const withLevel = (instance: ChalkInstance, level: ColorSupportLevelType, run: () => void): void => {
  const previousLevel = instance.level;

  try {
    instance.level = level;
    run();
  } finally {
    instance.level = previousLevel;
  }
};

describe("@beep/chalk", () => {
  it("does not add styling when called as the base function", () => {
    withLevel(chalk, 3, () => {
      expect(chalk("foo")).toBe("foo");
      expect(chalk("hello", "there")).toBe("hello there");
    });
  });

  it("supports automatic casting to string", () => {
    withLevel(chalk, 3, () => {
      expect(chalk(["hello", "there"])).toBe("hello,there");
      expect(chalk(123)).toBe("123");
      expect(chalk.bold(["foo", "bar"])).toBe("\u001B[1mfoo,bar\u001B[22m");
      expect(chalk.green(98_765)).toBe("\u001B[32m98765\u001B[39m");
    });
  });

  it("styles strings with chained modifiers and colors", () => {
    withLevel(chalk, 3, () => {
      expect(chalk.underline("foo")).toBe("\u001B[4mfoo\u001B[24m");
      expect(chalk.red.bgGreen.underline("foo")).toBe("\u001B[31m\u001B[42m\u001B[4mfoo\u001B[24m\u001B[49m\u001B[39m");
      expect(chalk.underline.red.bgGreen("foo")).toBe("\u001B[4m\u001B[31m\u001B[42mfoo\u001B[49m\u001B[39m\u001B[24m");
    });
  });

  it("supports nested styles and same-type reopen behavior", () => {
    withLevel(chalk, 3, () => {
      expect(chalk.red(`foo${chalk.underline.bgBlue("bar")}!`)).toBe(
        "\u001B[31mfoo\u001B[4m\u001B[44mbar\u001B[49m\u001B[24m!\u001B[39m"
      );
      expect(chalk.red(`a${chalk.yellow(`b${chalk.green("c")}b`)}c`)).toBe(
        "\u001B[31ma\u001B[33mb\u001B[32mc\u001B[39m\u001B[31m\u001B[33mb\u001B[39m\u001B[31mc\u001B[39m"
      );
    });
  });

  it("resets styles and preserves function prototype methods", () => {
    withLevel(chalk, 3, () => {
      expect(chalk.reset(`${chalk.red.bgGreen.underline("foo")}foo`)).toBe(
        "\u001B[0m\u001B[31m\u001B[42m\u001B[4mfoo\u001B[24m\u001B[49m\u001B[39mfoo\u001B[0m"
      );
      expect(Reflect.apply(chalk.grey, null, ["foo"])).toBe("\u001B[90mfoo\u001B[39m");
      expect(chalk.apply(chalk, ["foo"])).toBe("foo");
      expect(chalk.bind(chalk, "foo")()).toBe("foo");
      expect(chalk.call(chalk, "foo")).toBe("foo");
    });
  });

  it("supports aliases, empty input, and template-tag parity", () => {
    withLevel(chalk, 3, () => {
      expect(chalk.grey("foo")).toBe("\u001B[90mfoo\u001B[39m");
      expect(chalk.bgGray("foo")).toBe("\u001B[100mfoo\u001B[49m");
      expect(chalk.red()).toBe("");
      expect(chalk.red.blue.black()).toBe("");
      expect(chalk.red`Hello ${"X"}!`).toBe("\u001B[31mHello X!\u001B[39m");
    });
  });

  it("re-opens styles around line breaks", () => {
    withLevel(chalk, 3, () => {
      expect(chalk.grey("hello\nworld")).toBe("\u001B[90mhello\u001B[39m\n\u001B[90mworld\u001B[39m");
      expect(chalk.grey("hello\r\nworld")).toBe("\u001B[90mhello\u001B[39m\r\n\u001B[90mworld\u001B[39m");
    });
  });

  it("supports RGB, HEX, and ANSI256 builders across levels", () => {
    expect(new Chalk({ level: 1 }).hex("#FF0000")("hello")).toBe("\u001B[91mhello\u001B[39m");
    expect(new Chalk({ level: 2 }).hex("#FF0000")("hello")).toBe("\u001B[38;5;196mhello\u001B[39m");
    expect(new Chalk({ level: 3 }).bgHex("#FF0000")("hello")).toBe("\u001B[48;2;255;0;0mhello\u001B[49m");
    expect(new Chalk({ level: 0 }).hex("#FF0000")("hello")).toBe("hello");
    expect(new Chalk({ level: 0 }).bgAnsi256(194)("hello")).toBe("hello");
  });

  it("keeps isolated instances separate and validates invalid levels", () => {
    withLevel(chalk, 1, () => {
      const instance = new Chalk({ level: 0 });

      expect(instance.red("foo")).toBe("foo");
      expect(chalk.red("foo")).toBe("\u001B[31mfoo\u001B[39m");

      instance.level = 2;

      expect(instance.red("foo")).toBe("\u001B[31mfoo\u001B[39m");
      expect(() => Reflect.construct(Chalk, [{ level: 10 }])).toThrow(/integer from 0 to 3/);
      expect(() => Reflect.set(chalk, "level", 10)).toThrow(/integer from 0 to 3/);
    });
  });

  it("propagates level changes across child builders", () => {
    withLevel(chalk, 1, () => {
      const { red } = chalk;

      expect(red.level).toBe(1);

      chalk.level = 0;

      expect(red.level).toBe(0);

      red.level = 1;

      expect(chalk.level).toBe(1);
      expect(red("foo")).toBe("\u001B[31mfoo\u001B[39m");
    });
  });

  it("supports visible for enabled and disabled instances", () => {
    const enabled = new Chalk({ level: 3 });
    const disabled = new Chalk({ level: 0 });

    expect(enabled.visible.red("foo")).toBe("\u001B[31mfoo\u001B[39m");
    expect(enabled.red.visible("foo")).toBe("\u001B[31mfoo\u001B[39m");
    expect(enabled.visible("foo")).toBe("foo");
    expect(disabled.visible.red("foo")).toBe("");
    expect(disabled.red.visible("foo")).toBe("");
    expect(disabled.visible("foo")).toBe("");
  });

  it("exposes a stderr instance with independent state", () => {
    withLevel(chalkStderr, 3, () => {
      expect(chalkStderr.red.bold("foo")).toBe("\u001B[31m\u001B[1mfoo\u001B[22m\u001B[39m");
    });
  });

  it("backs public option models with Effect schemas", () => {
    const decodeConstructorOptions = S.decodeUnknownSync(ChalkConstructorOptions);
    const decodeStrictOptions = S.decodeUnknownSync(ChalkOptions);

    expect(decodeConstructorOptions({ level: 3 }).level).toBe(3);
    expect(decodeStrictOptions({ level: 3 }).level).toBe(3);
    expect(S.is(ColorSupportLevel)(2)).toBe(true);
    expect(S.is(ColorSupportLevel)(4)).toBe(false);
    expect(() => decodeConstructorOptions({ level: 4 })).toThrow(/integer from 0 to 3/);
  });

  it("round-trips schema-derived values through their encoded shapes", () => {
    const schemas = [
      AnsiRenderLevel,
      ChalkConstructorOptions,
      ChalkOptions,
      ColorInfo,
      ColorModelName,
      ColorName,
      ColorSupport,
      ColorSupportLevel,
      ModifierName,
      StyleChannel,
      StyleName,
    ] as const;

    for (const schema of schemas) {
      const arbitrary = S.toArbitrary(schema);
      const decode = S.decodeSync(schema);
      const encode = S.encodeSync(schema);

      fc.assert(
        fc.property(arbitrary, (value) => {
          expect(Equal.equals(decode(encode(value)), value)).toBe(true);
        }),
        fcRuns(50)
      );
    }
  });
});

describe("supportsColor detection", () => {
  it("honors force-color, no-color, tty, and CI rules", () => {
    expect(
      createSupportsColor({
        runtimeProcessLike: { env: { TERM: "xterm-256color" } },
        stream: { isTTY: true },
      })
    ).toMatchObject({ level: 2 });

    expect(
      createSupportsColor({
        runtimeProcessLike: { env: { FORCE_COLOR: "3", NO_COLOR: "" } },
        stream: { isTTY: true },
      })
    ).toMatchObject({ level: 3 });

    expect(
      createSupportsColor({
        runtimeProcessLike: { env: { NO_COLOR: "1", TERM: "xterm-256color" } },
        stream: { isTTY: true },
      })
    ).toBe(false);

    expect(
      createSupportsColor({
        runtimeProcessLike: { env: { FORCE_COLOR: "2", NO_COLOR: "1" } },
        stream: { isTTY: false },
      })
    ).toMatchObject({ level: 2 });

    expect(
      createSupportsColor({
        runtimeProcessLike: { env: { FORCE_COLOR: "definitely-not-a-level" } },
        stream: { isTTY: false },
      })
    ).toBe(false);

    expect(
      createSupportsColor({
        runtimeProcessLike: { env: { FORCE_COLOR: "2" } },
        stream: { isTTY: false },
      })
    ).toMatchObject({ level: 2 });

    expect(
      createSupportsColor({
        runtimeProcessLike: { env: { CI: "1", GITHUB_ACTIONS: "1" } },
        stream: { isTTY: true },
      })
    ).toMatchObject({ level: 3 });
  });

  it("covers platform, flag, and terminal-specific rules with explicit runtime fixtures", () => {
    const detect = (
      env: Readonly<Record<string, string | undefined>>,
      options: {
        readonly argv?: ReadonlyArray<string>;
        readonly osRelease?: string;
        readonly platform?: string;
        readonly sniffFlags?: boolean;
      } = {}
    ) =>
      createSupportsColor({
        options: options.sniffFlags === undefined ? {} : { sniffFlags: options.sniffFlags },
        runtimeProcessLike: {
          argv: options.argv ?? [],
          env,
          platform: options.platform ?? "linux",
          ...(options.osRelease === undefined ? {} : { osRelease: options.osRelease }),
        },
        stream: { isTTY: true },
      });

    expect(detect({}, { argv: ["--no-color"] })).toBe(false);
    expect(detect({}, { argv: ["--color"] })).toMatchObject({ level: 1 });
    expect(detect({}, { argv: ["--color=256"] })).toMatchObject({ level: 2 });
    expect(detect({}, { argv: ["--color=16m"] })).toMatchObject({ level: 3 });
    expect(detect({}, { argv: ["--", "--color"] })).toBe(false);
    expect(detect({}, { argv: ["--color"], sniffFlags: false })).toBe(false);
    expect(detect({ TF_BUILD: "1", AGENT_NAME: "agent" })).toMatchObject({ level: 1 });
    expect(detect({ TERM: "dumb" })).toBe(false);
    expect(detect({}, { platform: "win32", osRelease: "10.0.10586" })).toMatchObject({ level: 2 });
    expect(detect({}, { platform: "win32", osRelease: "10.0.14931" })).toMatchObject({ level: 3 });
    expect(detect({}, { platform: "win32", osRelease: "6.1.7601" })).toMatchObject({ level: 1 });
    expect(detect({ CI: "1", TRAVIS: "1" })).toMatchObject({ level: 1 });
    expect(detect({ CI: "1", CI_NAME: "codeship" })).toMatchObject({ level: 1 });
    expect(detect({ TEAMCITY_VERSION: "9.1.0" })).toMatchObject({ level: 1 });
    expect(detect({ TEAMCITY_VERSION: "9.0.0" })).toBe(false);
    expect(detect({ COLORTERM: "truecolor" })).toMatchObject({ level: 3 });
    expect(detect({ TERM: "xterm-kitty" })).toMatchObject({ level: 3 });
    expect(detect({ TERM_PROGRAM: "iTerm.app", TERM_PROGRAM_VERSION: "3.5.0" })).toMatchObject({ level: 3 });
    expect(detect({ TERM_PROGRAM: "iTerm.app", TERM_PROGRAM_VERSION: "2.9.0" })).toMatchObject({ level: 2 });
    expect(detect({ TERM_PROGRAM: "Apple_Terminal" })).toMatchObject({ level: 2 });
    expect(detect({ TERM: "xterm-256color" })).toMatchObject({ level: 2 });
    expect(detect({ TERM: "xterm" })).toMatchObject({ level: 1 });
  });
});

describe("@beep/chalk browser entry", () => {
  it("remains usable in non-browser runtimes", () => {
    expect(browserSupportsColor).toBe(false);
    expect(browserSupportsColorStderr).toBe(false);
    expect(browserChalk.red("warning")).toBe("warning");
    expect(browserChalkStderr.blue.bold("beep")).toBe("beep");
  });
});
