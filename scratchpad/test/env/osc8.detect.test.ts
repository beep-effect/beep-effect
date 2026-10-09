import { assert, describe, it } from "@effect/vitest";
import * as O from "effect/Option";
import type { ProcessSnapshot } from "../../effected/env/internal/osc8/detect.ts";
import { detect, detectOsc8 } from "../../effected/env/internal/osc8/detect.ts";
import type { Env } from "../../effected/env/internal/types.ts";
import { envFor } from "./osc8.fixtures.ts";

const snapshot = (env: Env = {}, isStdoutTTY = true, isStderrTTY = true): ProcessSnapshot => ({
	env,
	isStdoutTTY,
	isStderrTTY,
});

describe("detect — overrides", () => {
	it("FORCE_HYPERLINK=1 forces on, even when not a TTY", () => {
		const r = detect(snapshot({ FORCE_HYPERLINK: "1" }, false, false));
		assert.strictEqual(r.supported, true);
		assert.strictEqual(r.reason, "force-env");
		assert.strictEqual(r.override, "force-hyperlink");
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
		assert.strictEqual(r.override, "no-hyperlink");
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
		assert.strictEqual(r.override, "no-color");
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
		assert.deepStrictEqual(r.wrapper, { name: "tmux", passesThrough: false });
	});
});

describe("detect — terminal allowlist", () => {
	it("iTerm 3.5 is terminal-known-supported", () => {
		const r = detect(snapshot(envFor.iterm({ version: "3.5.0" })));
		assert.strictEqual(r.supported, true);
		assert.strictEqual(r.reason, "terminal-known-supported");
		assert.strictEqual(r.terminal, "iTerm.app");
		assert.strictEqual(r.terminalVersion, "3.5.0");
	});
	it("iTerm 3.0 is terminal-known-too-old", () => {
		const r = detect(snapshot(envFor.iterm({ version: "3.0.0" })));
		assert.strictEqual(r.supported, false);
		assert.strictEqual(r.reason, "terminal-known-too-old");
		assert.strictEqual(r.terminal, "iTerm.app");
	});
	it("Apple Terminal is terminal-known-unsupported", () => {
		const r = detect(snapshot(envFor.appleTerminal()));
		assert.strictEqual(r.supported, false);
		assert.strictEqual(r.reason, "terminal-known-unsupported");
		assert.strictEqual(r.terminal, "Apple_Terminal");
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
	it("Terminal with null minVersion (e.g. WezTerm) is supported regardless", () => {
		const r = detect(snapshot(envFor.wezterm()));
		assert.strictEqual(r.supported, true);
		assert.strictEqual(r.reason, "terminal-known-supported");
	});
	it("unidentifiable terminal is terminal-unknown", () => {
		const r = detect(snapshot(envFor.unknown()));
		assert.strictEqual(r.supported, false);
		assert.strictEqual(r.reason, "terminal-unknown");
		assert.strictEqual(r.terminal, null);
	});
	it("Alacritty (any version) is terminal-known-supported", () => {
		// Regression: Alacritty's TERM=alacritty carries no version info,
		// so a minVersion gate would always fire 'terminal-known-too-old'.
		const r = detect(snapshot(envFor.alacritty()));
		assert.strictEqual(r.supported, true);
		assert.strictEqual(r.reason, "terminal-known-supported");
		assert.strictEqual(r.terminal, "Alacritty");
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
		// Capabilities are an intrinsic terminal property, decoupled from
		// stream TTY state. A piped stdout doesn't change what the terminal
		// can do — only whether we're emitting OSC8 right now.
		const r = detect(snapshot(envFor.iterm(), false, true));
		assert.strictEqual(r.supported, false);
		assert.strictEqual(r.reason, "not-a-tty");
		assert.deepStrictEqual(r.capabilities, {
			params: true,
			fileUrls: true,
			fileUrlsRemoteUnsafe: false,
		});
	});
	it("populates capabilities for known terminals even inside a wrapper", () => {
		const r = detect(snapshot({ ...envFor.iterm(), TMUX: "x" }));
		assert.strictEqual(r.supported, false);
		assert.strictEqual(r.reason, "wrapper-strips");
		assert.strictEqual(r.capabilities.params, true);
	});
});

describe("detect — supportedForStderr divergence", () => {
	// These exercise the bug class the stderrSupported IIFE was fragile to:
	// stdout and stderr can disagree only on TTY state; everything else
	// (overrides, wrapper, allowlist) agrees by construction.
	it("stdout-piped, stderr-TTY, known terminal: stderr supported, stdout not", () => {
		const r = detect(snapshot(envFor.iterm(), false, true));
		assert.strictEqual(r.supported, false);
		assert.strictEqual(r.supportedForStderr, true);
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

// Added by the port (not in std-osc8): detectOsc8 projects detect() onto the
// Option-carrying shape the package surfaces.
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
