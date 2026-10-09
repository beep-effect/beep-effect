import type { Env } from "../../effected/env/internal/types.ts";

/**
 * Builders for synthetic Env values used in unit tests.
 *
 * Each builder produces an env that uniquely identifies one terminal.
 * Versions and other identifying values can be overridden per-call.
 */
export const envFor = {
	iterm: (opts: { version?: string } = {}): Env => ({
		TERM_PROGRAM: "iTerm.app",
		TERM_PROGRAM_VERSION: opts.version ?? "3.5.0",
	}),
	wezterm: (opts: { version?: string } = {}): Env => ({
		TERM_PROGRAM: "WezTerm",
		TERM_PROGRAM_VERSION: opts.version ?? "20240712",
	}),
	kitty: (): Env => ({
		TERM: "xterm-kitty",
		KITTY_WINDOW_ID: "1",
	}),
	appleTerminal: (): Env => ({
		TERM_PROGRAM: "Apple_Terminal",
		TERM_PROGRAM_VERSION: "455",
	}),
	vscode: (opts: { version?: string } = {}): Env => ({
		TERM_PROGRAM: "vscode",
		TERM_PROGRAM_VERSION: opts.version ?? "1.85.0",
	}),
	hyper: (opts: { version?: string } = {}): Env => ({
		TERM_PROGRAM: "Hyper",
		TERM_PROGRAM_VERSION: opts.version ?? "3.4.1",
	}),
	mintty: (opts: { version?: string } = {}): Env => ({
		TERM_PROGRAM: "mintty",
		TERM_PROGRAM_VERSION: opts.version ?? "3.7.0",
	}),
	windowsTerminal: (): Env => ({
		WT_SESSION: "abc-123",
	}),
	konsole: (opts: { rawVersion?: string } = {}): Env => ({
		KONSOLE_VERSION: opts.rawVersion ?? "240200",
	}),
	vte: (opts: { rawVersion?: string } = {}): Env => ({
		VTE_VERSION: opts.rawVersion ?? "7400",
	}),
	alacritty: (): Env => ({
		TERM: "alacritty",
	}),
	ghostty: (): Env => ({
		TERM_PROGRAM: "ghostty",
	}),
	jediTerm: (): Env => ({
		TERMINAL_EMULATOR: "JetBrains-JediTerm",
	}),
	tabby: (): Env => ({
		TERM_PROGRAM: "Tabby",
	}),
	foot: (): Env => ({
		TERM: "foot",
	}),
	rio: (): Env => ({
		TERM_PROGRAM: "rio",
	}),
	contour: (): Env => ({
		TERMINAL_NAME: "contour",
	}),
	conemu: (): Env => ({
		ConEmuPID: "12345",
	}),
	warp: (): Env => ({
		TERM_PROGRAM: "WarpTerminal",
	}),
	wave: (): Env => ({
		TERM_PROGRAM: "WaveTerminal",
	}),
	terminology: (): Env => ({
		TERMINOLOGY: "1",
	}),
	tmux: (): Env => ({
		TMUX: "/tmp/tmux-501/default,123,0",
	}),
	screen: (): Env => ({
		STY: "12345.pts-0.host",
	}),
	unknown: (): Env => ({
		TERM: "xterm-256color",
	}),
} as const;
