import colors, { Colors, createColors, isColorSupported, ProcessLike, supportsColor } from "@beep/colors";
import browserColors, {
  supportsColor as browserSupportsColor,
  createColors as createBrowserColors,
  isColorSupported as isBrowserColorSupported,
} from "@beep/colors/Colors.browser";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

describe("supportsColor", () => {
  it("enables colors for TTY terminals with a non-dumb TERM", () => {
    expect(
      supportsColor({
        env: {
          TERM: "xterm-256color",
        },
        stdout: {
          isTTY: true,
        },
      })
    ).toBe(true);
  });

  it("disables colors for dumb TTY terminals", () => {
    expect(
      supportsColor({
        env: {
          TERM: "dumb",
        },
        stdout: {
          isTTY: true,
        },
      })
    ).toBe(false);
  });

  it("treats NO_COLOR as an override even when the value is empty", () => {
    expect(
      supportsColor({
        env: {
          CI: "1",
          FORCE_COLOR: "1",
          NO_COLOR: "",
          TERM: "xterm-256color",
        },
        platform: "win32",
        stdout: {
          isTTY: true,
        },
      })
    ).toBe(false);
  });

  it("treats --no-color as an override", () => {
    expect(
      supportsColor({
        argv: ["--no-color"],
        env: {
          TERM: "xterm-256color",
        },
        stdout: {
          isTTY: true,
        },
      })
    ).toBe(false);
  });

  it("treats FORCE_COLOR=0 as disabled", () => {
    expect(
      supportsColor({
        env: {
          FORCE_COLOR: "0",
        },
      })
    ).toBe(false);
  });

  it("allows FORCE_COLOR to enable colors without a TTY", () => {
    expect(
      supportsColor({
        env: {
          FORCE_COLOR: "1",
        },
      })
    ).toBe(true);
  });

  it("enables colors in CI environments", () => {
    expect(
      supportsColor({
        env: {
          CI: "1",
        },
      })
    ).toBe(true);
  });

  it("decodes process-like inputs through the schema model", () => {
    expect(O.isSome(ProcessLike.decodeOption({ env: { FORCE_COLOR: "1" } }))).toBe(true);
    expect(O.isNone(ProcessLike.decodeOption({ stdout: { isTTY: "yes" } }))).toBe(true);
  });

  it("round-trips generated process-like values through the schema", () => {
    const processLikeArbitrary = S.toArbitrary(ProcessLike);
    const encodeProcessLike = S.encodeUnknownOption(ProcessLike);

    fc.assert(
      fc.property(processLikeArbitrary, (processLike) => {
        const encoded = encodeProcessLike(processLike);

        expect(O.isSome(encoded)).toBe(true);

        if (O.isSome(encoded)) {
          const decoded = ProcessLike.decodeOption(encoded.value);

          expect(O.isSome(decoded)).toBe(true);

          if (O.isSome(decoded)) {
            expect(decoded.value).toEqual(processLike);
          }
        }
      })
    );
  });

  it("honors disable overrides for generated process-like values", () => {
    const processLikeArbitrary = S.toArbitrary(ProcessLike);

    fc.assert(
      fc.property(processLikeArbitrary, (processLike) => {
        expect(
          supportsColor({
            ...processLike,
            env: {
              ...processLike.env,
              NO_COLOR: "",
            },
          })
        ).toBe(false);
        expect(
          supportsColor({
            ...processLike,
            argv: A.append(processLike.argv ?? A.empty(), "--no-color"),
          })
        ).toBe(false);
      })
    );
  });
});

describe("createColors", () => {
  it("returns plain string coercion when disabled", () => {
    const plain = createColors(false);

    expect(plain.red("warning")).toBe("warning");
    expect(plain.bold(42)).toBe("42");
    expect(plain.dim(undefined)).toBe("undefined");
  });

  it("returns ANSI-wrapped values when enabled", () => {
    const enabled = createColors(true);

    expect(enabled.green("ready")).toBe("\u001B[32mready\u001B[39m");
  });

  it("reopens nested styles after a child formatter closes", () => {
    const enabled = createColors(true);

    expect(enabled.red(`a${enabled.red("b")}c`)).toBe("\u001B[31ma\u001B[31mb\u001B[31mc\u001B[39m");
    expect(enabled.bold(`a${enabled.bold("b")}c`)).toBe("\u001B[1ma\u001B[1mb\u001B[22m\u001B[1mc\u001B[22m");
  });
});

describe("@beep/colors", () => {
  it("exports a shared Colors instance", () => {
    expect(colors).toBeInstanceOf(Colors);
    expect(colors.isColorSupported).toBe(isColorSupported);
  });
});

describe("@beep/colors browser entry", () => {
  it("always disables ANSI output", () => {
    expect(isBrowserColorSupported).toBe(false);
    expect(browserSupportsColor()).toBe(false);
    expect(browserColors.red("warning")).toBe("warning");
    expect(createBrowserColors().bold("beep")).toBe("beep");
    expect(createBrowserColors(true).bold("beep")).toBe("beep");
    expect(browserColors.createColors(true).red("warning")).toBe("warning");
  });
});
