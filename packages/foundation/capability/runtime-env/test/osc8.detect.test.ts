import { detect, detectOsc8 } from "@beep/runtime-env/internal/osc8/detect";
import { WrapperInfo } from "@beep/runtime-env/internal/osc8/wrappers";
import { assert, describe, it } from "@effect/vitest";
import * as O from "effect/Option";
import { envFor } from "./support/osc8.fixtures.ts";
import type { ProcessSnapshot } from "@beep/runtime-env/internal/osc8/detect";
import type { Env } from "@beep/runtime-env/internal/types";

const snapshot = (env: Env = {}, isStdoutTTY = true, isStderrTTY = true): ProcessSnapshot.Encoded => ({
  env,
  isStdoutTTY,
  isStderrTTY,
});

describe("detect — overrides", () => {
  it("FORCE_HYPERLINK=1 forces on, even when not a TTY", () => {
    const r = detect(snapshot({ FORCE_HYPERLINK: "1" }, false, false));
    assert.strictEqual(r.supported, true);
    assert.strictEqual(r.reason, "force-env");
    assert.deepStrictEqual(r.override, O.some("force-hyperlink"));
  });
  it("FORCE_HYPERLINK=1 forces on, even inside tmux", () => {
    const r = detect(snapshot({ FORCE_HYPERLINK: "1", TMUX: "x" }));
    assert.strictEqual(r.supported, true);
    assert.strictEqual(r.reason, "force-env");
  });
  it("FORCE_HYPERLINK=0 is falsy and does not force", () => {
    const r = detect(snapshot({ FORCE_HYPERLINK: "0" }, false, false));
    assert.strictEqual(r.supported, false);
    assert.strictEqual(r.reason, "not-a-tty");
  });
  it("NO_HYPERLINK=1 disables", () => {
    const r = detect(snapshot({ ...envFor.iterm(), NO_HYPERLINK: "1" }));
    assert.strictEqual(r.supported, false);
    assert.strictEqual(r.reason, "no-hyperlink-env");
    assert.deepStrictEqual(r.override, O.some("no-hyperlink"));
  });
  it("FORCE_HYPERLINK overrides NO_HYPERLINK", () => {
    const r = detect(snapshot({ FORCE_HYPERLINK: "1", NO_HYPERLINK: "1" }, false, false));
    assert.strictEqual(r.supported, true);
    assert.strictEqual(r.reason, "force-env");
  });
  it("NO_COLOR=1 disables (per no-color.org spec)", () => {
    const r = detect(snapshot({ ...envFor.iterm(), NO_COLOR: "1" }));
    assert.strictEqual(r.supported, false);
    assert.strictEqual(r.reason, "no-color-env");
    assert.deepStrictEqual(r.override, O.some("no-color"));
  });
  it("NO_COLOR='0' still disables (any non-empty is truthy per spec)", () => {
    const r = detect(snapshot({ ...envFor.iterm(), NO_COLOR: "0" }));
    assert.strictEqual(r.supported, false);
    assert.strictEqual(r.reason, "no-color-env");
  });
});

describe("detect — TTY", () => {
  it("returns off with not-a-tty when stdout is not a TTY", () => {
    const r = detect(snapshot(envFor.iterm(), false, true));
    assert.strictEqual(r.supported, false);
    assert.strictEqual(r.reason, "not-a-tty");
  });
  it("supportedForStderr reflects stderr's TTY independently", () => {
    const r = detect(snapshot(envFor.iterm(), false, true));
    assert.strictEqual(r.supported, false);
    assert.strictEqual(r.supportedForStderr, true);
  });
});

describe("detect — wrappers", () => {
  it("returns off with wrapper-strips when TMUX is set", () => {
    const r = detect(snapshot({ ...envFor.iterm(), TMUX: "x" }));
    assert.strictEqual(r.supported, false);
    assert.strictEqual(r.reason, "wrapper-strips");
    assert.deepStrictEqual(r.wrapper, WrapperInfo.makeOption({ name: "tmux", passesThrough: false }));
  });
});

describe("detect — terminal allowlist", () => {
  it("iTerm 3.5 is terminal-known-supported", () => {
    const r = detect(snapshot(envFor.iterm({ version: "3.5.0" })));
    assert.strictEqual(r.supported, true);
    assert.strictEqual(r.reason, "terminal-known-supported");
    assert.deepStrictEqual(r.terminal, O.some("iTerm.app"));
    assert.deepStrictEqual(r.terminalVersion, O.some("3.5.0"));
  });
  it("iTerm 3.0 is terminal-known-too-old", () => {
    const r = detect(snapshot(envFor.iterm({ version: "3.0.0" })));
    assert.strictEqual(r.supported, false);
    assert.strictEqual(r.reason, "terminal-known-too-old");
    assert.deepStrictEqual(r.terminal, O.some("iTerm.app"));
  });
  it("Apple Terminal is terminal-known-unsupported", () => {
    const r = detect(snapshot(envFor.appleTerminal()));
    assert.strictEqual(r.supported, false);
    assert.strictEqual(r.reason, "terminal-known-unsupported");
    assert.deepStrictEqual(r.terminal, O.some("Apple_Terminal"));
  });
  it("VTE 0.50 is terminal-known-supported", () => {
    const r = detect(snapshot(envFor.vte({ rawVersion: "5000" })));
    assert.strictEqual(r.supported, true);
    assert.strictEqual(r.reason, "terminal-known-supported");
  });
  it("VTE 0.49 is terminal-known-too-old", () => {
    const r = detect(snapshot(envFor.vte({ rawVersion: "4900" })));
    assert.strictEqual(r.supported, false);
    assert.strictEqual(r.reason, "terminal-known-too-old");
  });
  it("Terminal with no minVersion (e.g. WezTerm) is supported regardless", () => {
    const r = detect(snapshot(envFor.wezterm()));
    assert.strictEqual(r.supported, true);
    assert.strictEqual(r.reason, "terminal-known-supported");
  });
  it("unidentifiable terminal is terminal-unknown", () => {
    const r = detect(snapshot(envFor.unknown()));
    assert.strictEqual(r.supported, false);
    assert.strictEqual(r.reason, "terminal-unknown");
    assert.deepStrictEqual(r.terminal, O.none());
  });
  it("Alacritty (any version) is terminal-known-supported", () => {
    const r = detect(snapshot(envFor.alacritty()));
    assert.strictEqual(
      r.supported,
      true,
      "TERM=alacritty carries no version, so a minVersion gate would always report terminal-known-too-old"
    );
    assert.strictEqual(r.reason, "terminal-known-supported");
    assert.deepStrictEqual(r.terminal, O.some("Alacritty"));
  });
});

describe("detect — capabilities", () => {
  it("populates capabilities for supported known terminals", () => {
    const r = detect(snapshot(envFor.iterm()));
    assert.deepStrictEqual(r.capabilities, {
      params: true,
      fileUrls: true,
      fileUrlsRemoteUnsafe: false,
    });
  });
  it("zeros capabilities for unknown terminals", () => {
    const r = detect(snapshot(envFor.unknown()));
    assert.deepStrictEqual(r.capabilities, {
      params: false,
      fileUrls: false,
      fileUrlsRemoteUnsafe: false,
    });
  });
  it("zeros capabilities for known-unsupported terminals", () => {
    const r = detect(snapshot(envFor.appleTerminal()));
    assert.strictEqual(r.capabilities.params, false);
  });
  it("populates capabilities for known terminals even when stdout is not a TTY", () => {
    const r = detect(snapshot(envFor.iterm(), false, true));
    assert.strictEqual(r.supported, false);
    assert.strictEqual(r.reason, "not-a-tty");
    assert.deepStrictEqual(
      r.capabilities,
      {
        params: true,
        fileUrls: true,
        fileUrlsRemoteUnsafe: false,
      },
      "capabilities are intrinsic to the terminal; a piped stdout only stops OSC8 emission"
    );
  });
  it("populates capabilities for known terminals even inside a wrapper", () => {
    const r = detect(snapshot({ ...envFor.iterm(), TMUX: "x" }));
    assert.strictEqual(r.supported, false);
    assert.strictEqual(r.reason, "wrapper-strips");
    assert.strictEqual(r.capabilities.params, true);
  });
});

describe("detect — supportedForStderr divergence", () => {
  it("stdout-piped, stderr-TTY, known terminal: stderr supported, stdout not", () => {
    const r = detect(snapshot(envFor.iterm(), false, true));
    assert.strictEqual(r.supported, false);
    assert.strictEqual(
      r.supportedForStderr,
      true,
      "stdout and stderr disagree only on TTY state; overrides, wrapper and allowlist agree by construction"
    );
  });
  it("FORCE_HYPERLINK lifts both streams regardless of TTY", () => {
    const r = detect(snapshot({ FORCE_HYPERLINK: "1" }, false, false));
    assert.strictEqual(r.supported, true);
    assert.strictEqual(r.supportedForStderr, true);
  });
  it("NO_HYPERLINK disables both streams regardless of TTY", () => {
    const r = detect(snapshot({ ...envFor.iterm(), NO_HYPERLINK: "1" }));
    assert.strictEqual(r.supported, false);
    assert.strictEqual(r.supportedForStderr, false);
  });
  it("terminal-known-too-old applies symmetrically to both streams", () => {
    const r = detect(snapshot(envFor.iterm({ version: "3.0.0" })));
    assert.strictEqual(r.supported, false);
    assert.strictEqual(r.supportedForStderr, false);
  });
});

describe("detect — explanation", () => {
  it("provides a non-empty human-readable string", () => {
    const r = detect(snapshot(envFor.iterm()));
    assert.strictEqual(typeof r.explanation, "string");
    assert.isAbove(r.explanation.length, 0);
  });
});

describe("detectOsc8 — projection", () => {
  it("maps supported/supportedForStderr to stdout/stderr and the terminal to an Option", () => {
    const r = detectOsc8(envFor.iterm({ version: "3.5.0" }), true, false);
    assert.strictEqual(r.stdout, true);
    assert.strictEqual(r.stderr, false);
    assert.deepStrictEqual(r.terminal, O.some({ name: "iTerm.app", version: O.some("3.5.0") }));
  });
  it("projects an unidentified terminal to None", () => {
    const r = detectOsc8(envFor.unknown(), true, true);
    assert.strictEqual(r.stdout, false);
    assert.deepStrictEqual(r.terminal, O.none());
  });
  it("keeps a terminal with no version as Some with a None version", () => {
    const r = detectOsc8(envFor.kitty(), true, true);
    assert.deepStrictEqual(r.terminal, O.some({ name: "kitty", version: O.none() }));
  });
});
