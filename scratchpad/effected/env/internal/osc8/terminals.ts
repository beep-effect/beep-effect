// Ported from std-osc8 v0.2.0 (MIT, C. Spencer Beggs), src/terminals.ts. Pure: no process reads.
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as S from "effect/Schema";
import type { Env } from "../types.ts";
import { parseKonsoleVersion, parseVteVersion } from "./semver.ts";

const $I = $ScratchpadId.create("effected/env/internal/osc8/terminals");

/**
 * The detected terminal program: one literal per allowlist entry.
 *
 * **Example** (Validate a known terminal name)
 *
 * ```ts
 * import { KnownTerminal } from "@beep/scratchpad/effected/env/internal/osc8/terminals"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(KnownTerminal)("kitty")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const KnownTerminal = LiteralKit([
	"iTerm.app",
	"WezTerm",
	"kitty",
	"Apple_Terminal",
	"vscode",
	"Hyper",
	"mintty",
	"WindowsTerminal",
	"Konsole",
	"VTE",
	"Alacritty",
	"Ghostty",
	"JediTerm",
	"Tabby",
	"Foot",
	"Rio",
	"Contour",
	"ConEmu",
	"WarpTerminal",
	"WaveTerminal",
	"Terminology",
]).annotate($I.annote("KnownTerminal", { description: "The detected terminal program: one literal per allowlist entry." }));
/**
 * A terminal program name accepted by the allowlist schema.
 *
 * @see {@link KnownTerminal} for the runtime literal schema.
 * @category type-level
 * @since 0.0.0
 */
export type KnownTerminal = typeof KnownTerminal.Type;

/**
 * Describe sub-feature capabilities of the detected terminal.
 *
 * **Details**
 *
 * When the terminal is unknown or unsupported, all fields are `false`.
 *
 * **Example** (Validate terminal capabilities)
 *
 * ```ts
 * import { Osc8Capabilities } from "@beep/scratchpad/effected/env/internal/osc8/terminals"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(Osc8Capabilities)({
 *   params: true, fileUrls: true, fileUrlsRemoteUnsafe: false
 * })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Osc8Capabilities = S.Struct({
	/** Terminal supports `id=` / `key=value` params. */
	params: S.Boolean.pipe($I.annoteKey("Osc8Capabilities.params", { description: "Terminal supports `id=` / `key=value` params." })),
	/** Terminal renders `file://` URLs. */
	fileUrls: S.Boolean.pipe($I.annoteKey("Osc8Capabilities.fileUrls", { description: "Terminal renders `file://` URLs." })),
	/** When true, `file://` URLs misbehave over SSH/remote sessions. */
	fileUrlsRemoteUnsafe: S.Boolean.pipe($I.annoteKey("Osc8Capabilities.fileUrlsRemoteUnsafe", { description: "When true, `file://` URLs misbehave over SSH/remote sessions." })),
}).annotate($I.annote("Osc8Capabilities", { description: "Sub-feature capabilities of the detected terminal. When the terminal is unknown or unsupported, all fields are false." }));
/**
 * The decoded sub-feature capability record for a detected terminal.
 *
 * @see {@link Osc8Capabilities} for the runtime capability schema.
 * @category type-level
 * @since 0.0.0
 */
export type Osc8Capabilities = typeof Osc8Capabilities.Type;

/**
 * Capture the result of identifying a terminal from an environment snapshot.
 *
 * **Example** (Validate an identified terminal version)
 *
 * ```ts
 * import { IdentifyResult } from "@beep/scratchpad/effected/env/internal/osc8/terminals"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(IdentifyResult)({ version: "3.1.0", rawIdentifier: "iTerm.app" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const IdentifyResult = S.Struct({
	/** Detected version, if available. */
	version: S.NullOr(S.String).pipe($I.annoteKey("IdentifyResult.version", { description: "Detected version, if available." })),
	/** The raw env value used to identify the terminal. */
	rawIdentifier: S.String.pipe($I.annoteKey("IdentifyResult.rawIdentifier", { description: "The raw env value used to identify the terminal." })),
}).annotate($I.annote("IdentifyResult", { description: "Result of identifying a terminal from an env snapshot." }));
/**
 * The decoded version and raw identifier produced by terminal identification.
 *
 * @see {@link IdentifyResult} for the runtime identification schema.
 * @category type-level
 * @since 0.0.0
 */
export type IdentifyResult = typeof IdentifyResult.Type;

/**
 * Describe one row in the terminal allowlist.
 *
 * @category models
 * @since 0.0.0
 */
export interface TerminalEntry {
	/** Canonical terminal name. */
	readonly name: KnownTerminal;
	/** Pure function: identify this terminal from an env snapshot. */
	readonly identify: (env: Env) => IdentifyResult | null;
	/** Whether this terminal supports OSC8 at all. */
	readonly supported: boolean;
	/** Minimum version supporting OSC8. `null` means no minimum, or not applicable when unsupported. */
	readonly minVersion: string | null;
	/** Sub-feature capabilities (only consulted when supported && version OK). */
	readonly capabilities: Osc8Capabilities;
}

/**
 * Pair an allowlist entry with the result of identifying that terminal.
 *
 * @category models
 * @since 0.0.0
 */
export interface TerminalMatch {
	readonly entry: TerminalEntry;
	readonly identify: IdentifyResult;
}

/**
 * The shared all-false capability set for unsupported or unidentified terminals.
 *
 * **Example** (Inspect unsupported terminal capabilities)
 *
 * ```ts
 * import { NO_CAPS } from "@beep/scratchpad/effected/env/internal/osc8/terminals"
 *
 * console.log(NO_CAPS.params) // false
 * console.log(NO_CAPS.fileUrls) // false
 * console.log(NO_CAPS.fileUrlsRemoteUnsafe) // false
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
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
 *
 * **Details**
 *
 * Identification uses only the supplied environment snapshot. A match can describe an unsupported terminal;
 * callers must inspect the entry's support flag and minimum version before enabling OSC8.
 *
 * **Example** (Look up a terminal from a snapshot)
 *
 * ```ts
 * import { lookupTerminal } from "@beep/scratchpad/effected/env/internal/osc8/terminals"
 *
 * console.log(lookupTerminal({ TERM: "xterm-kitty" })?.entry.name) // kitty
 * console.log(lookupTerminal({})) // null
 * ```
 *
 * @category queries
 * @since 0.0.0
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
