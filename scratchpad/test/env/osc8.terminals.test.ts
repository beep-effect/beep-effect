import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { assert, describe, it } from "@effect/vitest";
import { terminalKeys } from "../../effected/env/internal/osc8/detect.ts";
import { lookupTerminal } from "../../effected/env/internal/osc8/terminals.ts";
import { envFor } from "./osc8.fixtures.ts";

describe("lookupTerminal", () => {
	it("returns null when no terminal is identified", () => {
		assert.strictEqual(lookupTerminal(envFor.unknown()), null);
	});

	describe("iTerm.app", () => {
		it("identifies iTerm2 with TERM_PROGRAM=iTerm.app", () => {
			const m = lookupTerminal(envFor.iterm({ version: "3.5.0" }));
			assert.isNotNull(m);
			assert.strictEqual(m?.entry.name, "iTerm.app");
			assert.strictEqual(m?.entry.supported, true);
			assert.strictEqual(m?.identify.version, "3.5.0");
			assert.strictEqual(m?.identify.rawIdentifier, "iTerm.app");
		});
		it("populates capabilities (params + fileUrls true)", () => {
			const m = lookupTerminal(envFor.iterm());
			assert.strictEqual(m?.entry.capabilities.params, true);
			assert.strictEqual(m?.entry.capabilities.fileUrls, true);
		});
	});

	describe("Apple_Terminal", () => {
		it("identifies Apple Terminal as known but unsupported", () => {
			const m = lookupTerminal(envFor.appleTerminal());
			assert.strictEqual(m?.entry.name, "Apple_Terminal");
			assert.strictEqual(m?.entry.supported, false);
			assert.strictEqual(m?.entry.capabilities.params, false);
			assert.strictEqual(m?.entry.capabilities.fileUrls, false);
		});
	});

	describe("VTE-based terminals", () => {
		it("decodes VTE_VERSION packed integer to semver", () => {
			const m = lookupTerminal(envFor.vte({ rawVersion: "5202" }));
			assert.strictEqual(m?.entry.name, "VTE");
			assert.strictEqual(m?.identify.version, "0.52.2");
		});
		it("min version is 0.50.0", () => {
			const m = lookupTerminal(envFor.vte());
			assert.strictEqual(m?.entry.minVersion, "0.50.0");
		});
	});

	describe("Konsole", () => {
		it("decodes KONSOLE_VERSION packed integer", () => {
			const m = lookupTerminal(envFor.konsole({ rawVersion: "240200" }));
			assert.strictEqual(m?.entry.name, "Konsole");
			assert.strictEqual(m?.identify.version, "24.2.0");
		});
		it("min version is 22.4.0", () => {
			const m = lookupTerminal(envFor.konsole());
			assert.strictEqual(m?.entry.minVersion, "22.4.0");
		});
	});

	describe("WezTerm", () => {
		it("identifies WezTerm with any version", () => {
			const m = lookupTerminal(envFor.wezterm());
			assert.strictEqual(m?.entry.name, "WezTerm");
			assert.strictEqual(m?.entry.minVersion, null);
		});
	});

	describe("kitty", () => {
		it("identifies kitty via TERM=xterm-kitty", () => {
			const m = lookupTerminal(envFor.kitty());
			assert.strictEqual(m?.entry.name, "kitty");
		});
	});

	describe("vscode", () => {
		it("identifies VS Code with min version 1.71", () => {
			const m = lookupTerminal(envFor.vscode());
			assert.strictEqual(m?.entry.name, "vscode");
			assert.strictEqual(m?.entry.minVersion, "1.71.0");
			assert.strictEqual(m?.entry.capabilities.fileUrlsRemoteUnsafe, true);
		});
	});

	describe("Hyper", () => {
		it("identifies Hyper with min version 3.0", () => {
			const m = lookupTerminal(envFor.hyper());
			assert.strictEqual(m?.entry.name, "Hyper");
			assert.strictEqual(m?.entry.minVersion, "3.0.0");
		});
	});

	describe("mintty", () => {
		it("identifies mintty with min version 3.6", () => {
			const m = lookupTerminal(envFor.mintty());
			assert.strictEqual(m?.entry.name, "mintty");
			assert.strictEqual(m?.entry.minVersion, "3.6.0");
		});
	});

	describe("WindowsTerminal", () => {
		it("identifies via WT_SESSION", () => {
			const m = lookupTerminal(envFor.windowsTerminal());
			assert.strictEqual(m?.entry.name, "WindowsTerminal");
			assert.strictEqual(m?.identify.rawIdentifier, "abc-123");
		});
	});

	describe("Alacritty", () => {
		it("identifies via TERM=alacritty with no version gate", () => {
			const m = lookupTerminal(envFor.alacritty());
			assert.strictEqual(m?.entry.name, "Alacritty");
			// minVersion is null because TERM=alacritty carries no version info;
			// gating on a minVersion would falsely reject every Alacritty user.
			assert.strictEqual(m?.entry.minVersion, null);
		});
	});

	describe("Ghostty", () => {
		it("identifies via TERM_PROGRAM=ghostty", () => {
			const m = lookupTerminal(envFor.ghostty());
			assert.strictEqual(m?.entry.name, "Ghostty");
		});
	});

	describe("JediTerm", () => {
		it("identifies via TERMINAL_EMULATOR=JetBrains-JediTerm", () => {
			const m = lookupTerminal(envFor.jediTerm());
			assert.strictEqual(m?.entry.name, "JediTerm");
		});
	});

	describe("Tabby", () => {
		it("identifies via TERM_PROGRAM=Tabby", () => {
			const m = lookupTerminal(envFor.tabby());
			assert.strictEqual(m?.entry.name, "Tabby");
		});
	});

	describe("Foot", () => {
		it("identifies via TERM=foot", () => {
			const m = lookupTerminal(envFor.foot());
			assert.strictEqual(m?.entry.name, "Foot");
		});
	});

	describe("Rio", () => {
		it("identifies via TERM_PROGRAM=rio", () => {
			const m = lookupTerminal(envFor.rio());
			assert.strictEqual(m?.entry.name, "Rio");
		});
	});

	describe("Contour", () => {
		it("identifies via TERMINAL_NAME=contour", () => {
			const m = lookupTerminal(envFor.contour());
			assert.strictEqual(m?.entry.name, "Contour");
		});
	});

	describe("ConEmu", () => {
		it("identifies via ConEmuPID being set", () => {
			const m = lookupTerminal(envFor.conemu());
			assert.strictEqual(m?.entry.name, "ConEmu");
		});
	});

	describe("WarpTerminal", () => {
		it("identifies via TERM_PROGRAM=WarpTerminal", () => {
			const m = lookupTerminal(envFor.warp());
			assert.strictEqual(m?.entry.name, "WarpTerminal");
		});
	});

	describe("WaveTerminal", () => {
		it("identifies via TERM_PROGRAM=WaveTerminal", () => {
			const m = lookupTerminal(envFor.wave());
			assert.strictEqual(m?.entry.name, "WaveTerminal");
		});
	});

	describe("Terminology", () => {
		it("identifies as known unsupported", () => {
			const m = lookupTerminal(envFor.terminology());
			assert.strictEqual(m?.entry.name, "Terminology");
			assert.strictEqual(m?.entry.supported, false);
		});
	});
});

// Added by the port (not in std-osc8): the key list and the detectors cannot drift.
describe("terminalKeys", () => {
	it("lists every env key the ported detectors read", () => {
		const dir = fileURLToPath(new URL("../src/internal/osc8/", import.meta.url));
		const sources = ["env", "semver", "wrappers", "terminals", "detect"].map((f) =>
			readFileSync(`${dir}${f}.ts`, "utf8"),
		);
		const read = new Set(
			sources.flatMap((source) =>
				[...source.matchAll(/(?<![\w./])env(?:\.([A-Za-z_]+)|\[\s*"([A-Za-z_]+)"\s*\])/g)].flatMap((m) => {
					const key = m[1] ?? m[2];
					return key === undefined ? [] : [key];
				}),
			),
		);
		assert.isAbove(read.size, 10, "the regex found the reads (control)");
		for (const key of read) assert.include(terminalKeys, key, `terminalKeys is missing ${key}`);
	});
});
