import { assert, describe, it } from "@effect/vitest";
import { detectWrapper } from "../../effected/env/internal/osc8/wrappers.ts";

describe("detectWrapper", () => {
	it("returns null when neither TMUX nor STY is set", () => {
		assert.strictEqual(detectWrapper({}), null);
		assert.strictEqual(detectWrapper({ TERM: "xterm-256color" }), null);
	});
	it("detects tmux when TMUX is set", () => {
		assert.deepStrictEqual(detectWrapper({ TMUX: "/tmp/tmux-501/default,123,0" }), {
			name: "tmux",
			passesThrough: false,
		});
	});
	it("detects screen when STY is set", () => {
		assert.deepStrictEqual(detectWrapper({ STY: "12345.pts-0.host" }), {
			name: "screen",
			passesThrough: false,
		});
	});
	it("prefers tmux when both TMUX and STY are set", () => {
		assert.strictEqual(detectWrapper({ TMUX: "x", STY: "y" })?.name, "tmux");
	});
});
