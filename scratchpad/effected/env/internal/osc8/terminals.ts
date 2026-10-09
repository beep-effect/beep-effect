// Ported from std-osc8 v0.2.0 (MIT, C. Spencer Beggs), src/terminals.ts. Pure: no process reads.
import type { Env } from "../types.ts";
import { parseKonsoleVersion, parseVteVersion } from "./semver.ts";

/** The detected terminal program: one literal per allowlist entry. */
export type KnownTerminal =
	| "iTerm.app"
	| "WezTerm"
	| "kitty"
	| "Apple_Terminal"
	| "vscode"
	| "Hyper"
	| "mintty"
	| "WindowsTerminal"
	| "Konsole"
	| "VTE"
	| "Alacritty"
	| "Ghostty"
	| "JediTerm"
	| "Tabby"
	| "Foot"
	| "Rio"
	| "Contour"
	| "ConEmu"
	| "WarpTerminal"
	| "WaveTerminal"
	| "Terminology";

/**
 * Sub-feature capabilities of the detected terminal. When the terminal is
 * unknown or unsupported, all fields are `false`.
 */
export interface Osc8Capabilities {
	/** Terminal supports `id=` / `key=value` params. */
	readonly params: boolean;
	/** Terminal renders `file://` URLs. */
	readonly fileUrls: boolean;
	/** When true, `file://` URLs misbehave over SSH/remote sessions. */
	readonly fileUrlsRemoteUnsafe: boolean;
}

/**
 * Result of identifying a terminal from an env snapshot.
 */
export interface IdentifyResult {
	/** Detected version, if available. */
	readonly version: string | null;
	/** The raw env value used to identify the terminal. */
	readonly rawIdentifier: string;
}

/**
 * One row in the allowlist.
 */
export interface TerminalEntry {
	/** Canonical terminal name. */
	readonly name: KnownTerminal;
	/** Pure function: identify this terminal from an env snapshot. */
	readonly identify: (env: Env) => IdentifyResult | null;
	/** Whether this terminal supports OSC8 at all. */
	readonly supported: boolean;
	/** Min version supporting OSC8. null = any, or n/a if !supported. */
	readonly minVersion: string | null;
	/** Sub-feature capabilities (only consulted when supported && version OK). */
	readonly capabilities: Osc8Capabilities;
}

/**
 * Result of looking up a terminal in the allowlist.
 */
export interface TerminalMatch {
	readonly entry: TerminalEntry;
	readonly identify: IdentifyResult;
}

const NO_CAPS: Osc8Capabilities = {
	params: false,
	fileUrls: false,
	fileUrlsRemoteUnsafe: false,
};

const TERMINALS: readonly TerminalEntry[] = [
	{
		// iTerm2 — supported since 3.1
		// Source: https://github.com/Alhadis/OSC8-Adoption (iTerm2 row)
		name: "iTerm.app",
		identify: (env) =>
			env.TERM_PROGRAM === "iTerm.app"
				? {
						version: env.TERM_PROGRAM_VERSION ?? null,
						rawIdentifier: env.TERM_PROGRAM,
					}
				: null,
		supported: true,
		minVersion: "3.1.0",
		capabilities: { params: true, fileUrls: true, fileUrlsRemoteUnsafe: false },
	},
	{
		// Apple Terminal — does NOT support OSC8 as of macOS 15.
		// Source: https://github.com/Alhadis/OSC8-Adoption (Apple Terminal row)
		name: "Apple_Terminal",
		identify: (env) =>
			env.TERM_PROGRAM === "Apple_Terminal"
				? {
						version: env.TERM_PROGRAM_VERSION ?? null,
						rawIdentifier: env.TERM_PROGRAM,
					}
				: null,
		supported: false,
		minVersion: null,
		capabilities: NO_CAPS,
	},
	{
		// VTE-based terminals: GNOME Terminal, Tilix, Terminator, xfce4-terminal,
		// Black Box, etc. All identify via VTE_VERSION (packed integer).
		// Min version 0.50.0 → 5000.
		// Source: https://github.com/Alhadis/OSC8-Adoption (VTE row)
		name: "VTE",
		identify: (env) =>
			env.VTE_VERSION !== undefined && env.VTE_VERSION !== ""
				? {
						version: parseVteVersion(env.VTE_VERSION),
						rawIdentifier: env.VTE_VERSION,
					}
				: null,
		supported: true,
		minVersion: "0.50.0",
		capabilities: { params: false, fileUrls: true, fileUrlsRemoteUnsafe: false },
	},
	{
		// Konsole — KDE's terminal. Supports OSC8 since 22.04.
		// KONSOLE_VERSION is packed YY*10000 + MM*100 + PATCH.
		// Source: https://github.com/Alhadis/OSC8-Adoption (Konsole row)
		name: "Konsole",
		identify: (env) =>
			env.KONSOLE_VERSION !== undefined && env.KONSOLE_VERSION !== ""
				? {
						version: parseKonsoleVersion(env.KONSOLE_VERSION),
						rawIdentifier: env.KONSOLE_VERSION,
					}
				: null,
		supported: true,
		minVersion: "22.4.0",
		capabilities: { params: true, fileUrls: true, fileUrlsRemoteUnsafe: false },
	},
	{
		// WezTerm — supported since first release.
		// Source: https://github.com/Alhadis/OSC8-Adoption (WezTerm row)
		name: "WezTerm",
		identify: (env) =>
			env.TERM_PROGRAM === "WezTerm"
				? { version: env.TERM_PROGRAM_VERSION ?? null, rawIdentifier: env.TERM_PROGRAM }
				: null,
		supported: true,
		minVersion: null,
		capabilities: { params: true, fileUrls: true, fileUrlsRemoteUnsafe: false },
	},
	{
		// kitty — TERM=xterm-kitty or KITTY_WINDOW_ID set.
		// Source: https://github.com/Alhadis/OSC8-Adoption (kitty row)
		name: "kitty",
		identify: (env) => {
			if (env.TERM === "xterm-kitty") {
				return { version: null, rawIdentifier: env.TERM };
			}
			if (env.KITTY_WINDOW_ID !== undefined && env.KITTY_WINDOW_ID !== "") {
				return { version: null, rawIdentifier: env.KITTY_WINDOW_ID };
			}
			return null;
		},
		supported: true,
		minVersion: null,
		capabilities: { params: true, fileUrls: true, fileUrlsRemoteUnsafe: false },
	},
	{
		// VS Code integrated terminal — supports OSC8 since 1.71.
		// file:// URLs are remote-unsafe (path may not exist on the renderer side).
		// Source: https://github.com/Alhadis/OSC8-Adoption (VS Code row)
		name: "vscode",
		identify: (env) =>
			env.TERM_PROGRAM === "vscode"
				? { version: env.TERM_PROGRAM_VERSION ?? null, rawIdentifier: env.TERM_PROGRAM }
				: null,
		supported: true,
		minVersion: "1.71.0",
		capabilities: { params: false, fileUrls: true, fileUrlsRemoteUnsafe: true },
	},
	{
		// Hyper — supported since 3.0.
		// Source: https://github.com/Alhadis/OSC8-Adoption (Hyper row)
		name: "Hyper",
		identify: (env) =>
			env.TERM_PROGRAM === "Hyper"
				? { version: env.TERM_PROGRAM_VERSION ?? null, rawIdentifier: env.TERM_PROGRAM }
				: null,
		supported: true,
		minVersion: "3.0.0",
		capabilities: { params: false, fileUrls: true, fileUrlsRemoteUnsafe: false },
	},
	{
		// mintty (MSYS2/Cygwin/Git Bash) — supports OSC8 since 3.6.
		// Source: https://github.com/Alhadis/OSC8-Adoption (mintty row)
		name: "mintty",
		identify: (env) =>
			env.TERM_PROGRAM === "mintty"
				? { version: env.TERM_PROGRAM_VERSION ?? null, rawIdentifier: env.TERM_PROGRAM }
				: null,
		supported: true,
		minVersion: "3.6.0",
		capabilities: { params: true, fileUrls: true, fileUrlsRemoteUnsafe: false },
	},
	{
		// Windows Terminal — supports OSC8 in all current versions.
		// Source: https://github.com/Alhadis/OSC8-Adoption (Windows Terminal row)
		name: "WindowsTerminal",
		identify: (env) => (env.WT_SESSION !== undefined && env.WT_SESSION !== "" ? { version: null, rawIdentifier: env.WT_SESSION } : null),
		supported: true,
		minVersion: null,
		capabilities: { params: false, fileUrls: true, fileUrlsRemoteUnsafe: false },
	},
	{
		// Alacritty — supports OSC8 since 0.11 (Oct 2022), with broader
		// fixes in 0.13 (Jan 2024).
		// Identified by TERM=alacritty.
		// Source: https://github.com/Alhadis/OSC8-Adoption (Alacritty row)
		//
		// minVersion is intentionally null: TERM=alacritty carries no version
		// information, so any minVersion would gate every Alacritty user as
		// "terminal-known-too-old". Pre-0.11 users (vanishingly rare in 2026)
		// can opt out via NO_HYPERLINK=1.
		name: "Alacritty",
		identify: (env) => (env.TERM === "alacritty" ? { version: null, rawIdentifier: env.TERM } : null),
		supported: true,
		minVersion: null,
		capabilities: { params: false, fileUrls: true, fileUrlsRemoteUnsafe: false },
	},
	{
		// Ghostty — supports OSC8 since first release.
		// Source: https://github.com/Alhadis/OSC8-Adoption (Ghostty row)
		name: "Ghostty",
		identify: (env) =>
			env.TERM_PROGRAM === "ghostty"
				? { version: env.TERM_PROGRAM_VERSION ?? null, rawIdentifier: env.TERM_PROGRAM }
				: null,
		supported: true,
		minVersion: null,
		capabilities: { params: true, fileUrls: true, fileUrlsRemoteUnsafe: false },
	},
	{
		// JetBrains JediTerm — IntelliJ, PyCharm, WebStorm, etc.
		// Source: https://github.com/Alhadis/OSC8-Adoption (JediTerm row)
		name: "JediTerm",
		identify: (env) =>
			env.TERMINAL_EMULATOR === "JetBrains-JediTerm" ? { version: null, rawIdentifier: env.TERMINAL_EMULATOR } : null,
		supported: true,
		minVersion: null,
		capabilities: { params: false, fileUrls: true, fileUrlsRemoteUnsafe: false },
	},
	{
		// Tabby — supported.
		// Source: https://github.com/Alhadis/OSC8-Adoption (Tabby row)
		name: "Tabby",
		identify: (env) =>
			env.TERM_PROGRAM === "Tabby"
				? { version: env.TERM_PROGRAM_VERSION ?? null, rawIdentifier: env.TERM_PROGRAM }
				: null,
		supported: true,
		minVersion: null,
		capabilities: { params: true, fileUrls: true, fileUrlsRemoteUnsafe: false },
	},
	{
		// Foot — Wayland-native terminal.
		// Source: https://github.com/Alhadis/OSC8-Adoption (Foot row)
		name: "Foot",
		identify: (env) =>
			env.TERM === "foot" || env.TERM === "foot-extra" ? { version: null, rawIdentifier: env.TERM } : null,
		supported: true,
		minVersion: null,
		capabilities: { params: true, fileUrls: true, fileUrlsRemoteUnsafe: false },
	},
	{
		// Rio — Rust-based terminal.
		// Source: https://github.com/Alhadis/OSC8-Adoption (Rio row)
		name: "Rio",
		identify: (env) =>
			env.TERM_PROGRAM === "rio"
				? { version: env.TERM_PROGRAM_VERSION ?? null, rawIdentifier: env.TERM_PROGRAM }
				: null,
		supported: true,
		minVersion: null,
		capabilities: { params: false, fileUrls: true, fileUrlsRemoteUnsafe: false },
	},
	{
		// Contour — modern C++ terminal.
		// Source: https://github.com/Alhadis/OSC8-Adoption (Contour row)
		name: "Contour",
		identify: (env) => (env.TERMINAL_NAME === "contour" ? { version: null, rawIdentifier: env.TERMINAL_NAME } : null),
		supported: true,
		minVersion: null,
		capabilities: { params: true, fileUrls: true, fileUrlsRemoteUnsafe: false },
	},
	{
		// ConEmu / cmder (Windows).
		// Source: https://github.com/Alhadis/OSC8-Adoption (ConEmu row)
		name: "ConEmu",
		identify: (env) => (env.ConEmuPID !== undefined && env.ConEmuPID !== "" ? { version: null, rawIdentifier: env.ConEmuPID } : null),
		supported: true,
		minVersion: null,
		capabilities: { params: false, fileUrls: true, fileUrlsRemoteUnsafe: false },
	},
	{
		// Warp — AI-native terminal.
		// Source: https://github.com/Alhadis/OSC8-Adoption (Warp row)
		name: "WarpTerminal",
		identify: (env) =>
			env.TERM_PROGRAM === "WarpTerminal"
				? { version: env.TERM_PROGRAM_VERSION ?? null, rawIdentifier: env.TERM_PROGRAM }
				: null,
		supported: true,
		minVersion: null,
		capabilities: { params: false, fileUrls: true, fileUrlsRemoteUnsafe: false },
	},
	{
		// Wave Terminal — modern terminal with built-in tools.
		// Source: https://github.com/Alhadis/OSC8-Adoption (Wave row)
		name: "WaveTerminal",
		identify: (env) =>
			env.TERM_PROGRAM === "WaveTerminal"
				? { version: env.TERM_PROGRAM_VERSION ?? null, rawIdentifier: env.TERM_PROGRAM }
				: null,
		supported: true,
		minVersion: null,
		capabilities: { params: false, fileUrls: true, fileUrlsRemoteUnsafe: false },
	},
	{
		// Terminology — known unsupported as of design date.
		// Source: https://github.com/Alhadis/OSC8-Adoption (Terminology row)
		name: "Terminology",
		identify: (env) => (env.TERMINOLOGY === "1" ? { version: null, rawIdentifier: env.TERMINOLOGY } : null),
		supported: false,
		minVersion: null,
		capabilities: NO_CAPS,
	},
];

/**
 * Find the first allowlist entry whose `identify()` returns non-null.
 */
export const lookupTerminal = (env: Env): TerminalMatch | null => {
	for (const entry of TERMINALS) {
		const id = entry.identify(env);
		if (id !== null) return { entry, identify: id };
	}
	return null;
};

// `NO_CAPS` is the one definition of the all-false capability set: the unsupported entries above use it, and
// detect.ts imports it for a terminal that is not identified at all.
export { NO_CAPS };
