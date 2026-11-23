// Ported from std-osc8 v0.2.0 (MIT, C. Spencer Beggs), src/terminals.ts. Pure: no process reads.
/**
 * The OSC 8 terminal allowlist: which terminal programs render hyperlinks, from which version, and with which
 * sub-features.
 *
 * **Details**
 *
 * Each row pairs a schema-described entry with a pure identification function of the environment record; the first
 * row whose function identifies the environment wins.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RuntimeEnvId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { parseKonsoleVersion, parseVteVersion } from "./semver.ts";
import type { Env } from "../types.ts";

const $I = $RuntimeEnvId.create("internal/osc8/terminals");

/**
 * **Example** (Validate a known terminal name)
 *
 * ```ts
 * import { KnownTerminal } from "@beep/runtime-env/internal/osc8/terminals"
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
]).pipe(
  $I.annoteSchema("KnownTerminal", { description: "The detected terminal program: one literal per allowlist entry." })
);

/**
 * A terminal program name accepted by the allowlist schema.
 *
 * @see {@link KnownTerminal} for the runtime literal schema.
 * @category type-level
 * @since 0.0.0
 */
export type KnownTerminal = typeof KnownTerminal.Type;

/**
 * **Details**
 *
 * When the terminal is unknown or unsupported, all fields are `false`.
 *
 * **Example** (Validate terminal capabilities)
 *
 * ```ts
 * import { Osc8Capabilities } from "@beep/runtime-env/internal/osc8/terminals"
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
export class Osc8Capabilities extends S.Opaque<Osc8Capabilities, { readonly brand: unique symbol }>()(
  S.Struct({
    /** Terminal supports `id=` / `key=value` params. */
    params: S.Boolean.pipe(
      $I.annoteKey("Osc8Capabilities.params", { description: "Terminal supports `id=` / `key=value` params." })
    ),
    /** Terminal renders `file://` URLs. */
    fileUrls: S.Boolean.pipe(
      $I.annoteKey("Osc8Capabilities.fileUrls", { description: "Terminal renders `file://` URLs." })
    ),
    /** When true, `file://` URLs misbehave over SSH/remote sessions. */
    fileUrlsRemoteUnsafe: S.Boolean.pipe(
      $I.annoteKey("Osc8Capabilities.fileUrlsRemoteUnsafe", {
        description: "When true, `file://` URLs misbehave over SSH/remote sessions.",
      })
    ),
  }).pipe(
    $I.annoteSchema("Osc8Capabilities", {
      description:
        "Sub-feature capabilities of the detected terminal. When the terminal is unknown or unsupported, all fields are false.",
    })
  )
) {}

/**
 * Capture the result of identifying a terminal from an environment snapshot.
 *
 * **Example** (Validate an identified terminal version)
 *
 * ```ts
 * import { IdentifyResult } from "@beep/runtime-env/internal/osc8/terminals"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(IdentifyResult)({ version: O.some("3.1.0"), rawIdentifier: "iTerm.app" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class IdentifyResult extends S.Opaque<IdentifyResult, { readonly brand: unique symbol }>()(
  S.Struct({
    /** Detected version, or `None` when the terminal exposes none. */
    version: S.Option(S.String).pipe(
      $I.annoteKey("IdentifyResult.version", {
        description: "Detected version, or None when the terminal exposes none.",
      })
    ),
    /** The raw env value used to identify the terminal. */
    rawIdentifier: S.String.pipe(
      $I.annoteKey("IdentifyResult.rawIdentifier", { description: "The raw env value used to identify the terminal." })
    ),
  }).pipe($I.annoteSchema("IdentifyResult", { description: "Result of identifying a terminal from an env snapshot." }))
) {}

/**
 * Describe one row in the terminal allowlist: the terminal, whether and from which version it supports OSC 8, and
 * its sub-feature capabilities.
 *
 * **Example** (Validate an allowlist row)
 *
 * ```ts
 * import { TerminalEntry } from "@beep/runtime-env/internal/osc8/terminals"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(TerminalEntry)({
 *   name: "kitty",
 *   supported: true,
 *   minVersion: O.none(),
 *   capabilities: { params: true, fileUrls: true, fileUrlsRemoteUnsafe: false },
 * })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class TerminalEntry extends S.Opaque<TerminalEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    /** Canonical terminal name. */
    name: KnownTerminal.pipe($I.annoteKey("TerminalEntry.name", { description: "Canonical terminal name." })),
    /** Whether this terminal supports OSC8 at all. */
    supported: S.Boolean.pipe(
      $I.annoteKey("TerminalEntry.supported", { description: "Whether this terminal supports OSC8 at all." })
    ),
    /** Minimum version supporting OSC8. `None` means no minimum, or not applicable when unsupported. */
    minVersion: S.Option(S.String).pipe(
      $I.annoteKey("TerminalEntry.minVersion", {
        description: "Minimum version supporting OSC8; None means no minimum, or not applicable when unsupported.",
      })
    ),
    /** Sub-feature capabilities (only consulted when supported && version OK). */
    capabilities: Osc8Capabilities.pipe(
      $I.annoteKey("TerminalEntry.capabilities", {
        description: "Sub-feature capabilities, only consulted when the terminal is supported at a sufficient version.",
      })
    ),
  }).pipe($I.annoteSchema("TerminalEntry", { description: "One row in the OSC 8 terminal allowlist." }))
) {}

/**
 * Pair an allowlist entry with the result of identifying that terminal.
 *
 * **Example** (Validate an identified allowlist row)
 *
 * ```ts
 * import { TerminalMatch } from "@beep/runtime-env/internal/osc8/terminals"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(TerminalMatch)({
 *   entry: {
 *     name: "kitty",
 *     supported: true,
 *     minVersion: O.none(),
 *     capabilities: { params: true, fileUrls: true, fileUrlsRemoteUnsafe: false },
 *   },
 *   identify: { version: O.none(), rawIdentifier: "xterm-kitty" },
 * })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class TerminalMatch extends S.Opaque<TerminalMatch, { readonly brand: unique symbol }>()(
  S.Struct({
    entry: TerminalEntry.pipe($I.annoteKey("TerminalMatch.entry", { description: "The matched allowlist row." })),
    identify: IdentifyResult.pipe(
      $I.annoteKey("TerminalMatch.identify", { description: "What identified the terminal in the environment." })
    ),
  }).pipe($I.annoteSchema("TerminalMatch", { description: "An allowlist row and the identification that matched it." }))
) {}

/**
 * The shared all-false capability set for unsupported or unidentified terminals.
 *
 * **Example** (Inspect unsupported terminal capabilities)
 *
 * ```ts
 * import { NO_CAPS } from "@beep/runtime-env/internal/osc8/terminals"
 *
 * console.log(NO_CAPS.params) // false
 * console.log(NO_CAPS.fileUrls) // false
 * console.log(NO_CAPS.fileUrlsRemoteUnsafe) // false
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const NO_CAPS: Osc8Capabilities = Osc8Capabilities.make({
  params: false,
  fileUrls: false,
  fileUrlsRemoteUnsafe: false,
});

/** Pure identification of one terminal from an environment snapshot. */
type Identify = (env: Env) => O.Option<IdentifyResult>;

const isSet = (value: string | undefined): value is string => value !== undefined && value !== "";

const identified = (version: O.Option<string>, rawIdentifier: string): O.Option<IdentifyResult> =>
  IdentifyResult.makeOption({ version, rawIdentifier });

/** A terminal that names itself in `TERM_PROGRAM` and its version in `TERM_PROGRAM_VERSION`. */
const byTermProgram =
  (program: string): Identify =>
  (env) =>
    env.TERM_PROGRAM === program ? identified(O.fromUndefinedOr(env.TERM_PROGRAM_VERSION), env.TERM_PROGRAM) : O.none();

/** A terminal that announces itself through a variable holding a packed version. */
const byPackedVersion =
  (raw: (env: Env) => string | undefined, decode: (raw: string) => O.Option<string>): Identify =>
  (env) =>
    O.flatMap(O.liftPredicate(raw(env), isSet), (value) => identified(decode(value), value));

/** A terminal that announces itself through a non-empty variable without a version. */
const byMarker =
  (raw: (env: Env) => string | undefined): Identify =>
  (env) =>
    O.flatMap(O.liftPredicate(raw(env), isSet), (value) => identified(O.none(), value));

/** A terminal that announces itself through a variable with one of a few exact values, without a version. */
const byValue =
  (raw: (env: Env) => string | undefined, values: ReadonlyArray<string>): Identify =>
  (env) =>
    O.flatMap(
      O.liftPredicate(raw(env), (value): value is string => value !== undefined && A.contains(values, value)),
      (value) => identified(O.none(), value)
    );

const caps = (params: boolean, fileUrls: boolean, fileUrlsRemoteUnsafe: boolean): Osc8Capabilities =>
  Osc8Capabilities.make({ params, fileUrls, fileUrlsRemoteUnsafe });

const FULL = caps(true, true, false);
const FILE_URLS = caps(false, true, false);

const row = (
  name: KnownTerminal,
  identify: Identify,
  supported: boolean,
  minVersion: O.Option<string>,
  capabilities: Osc8Capabilities
): readonly [TerminalEntry, Identify] => [TerminalEntry.make({ name, supported, minVersion, capabilities }), identify];

// Every row cites https://github.com/Alhadis/OSC8-Adoption (the row named after the terminal).
const TERMINALS: ReadonlyArray<readonly [TerminalEntry, Identify]> = [
  // iTerm2 — supported since 3.1
  row("iTerm.app", byTermProgram("iTerm.app"), true, O.some("3.1.0"), FULL),
  // Apple Terminal — does NOT support OSC8 as of macOS 15.
  row("Apple_Terminal", byTermProgram("Apple_Terminal"), false, O.none(), NO_CAPS),
  // VTE-based terminals: GNOME Terminal, Tilix, Terminator, xfce4-terminal,
  // Black Box, etc. All identify via VTE_VERSION (packed integer).
  // Min version 0.50.0 → 5000.
  row(
    "VTE",
    byPackedVersion((env) => env.VTE_VERSION, parseVteVersion),
    true,
    O.some("0.50.0"),
    FILE_URLS
  ),
  // Konsole — KDE's terminal. Supports OSC8 since 22.04.
  // KONSOLE_VERSION is packed YY*10000 + MM*100 + PATCH.
  row(
    "Konsole",
    byPackedVersion((env) => env.KONSOLE_VERSION, parseKonsoleVersion),
    true,
    O.some("22.4.0"),
    FULL
  ),
  // WezTerm — supported since first release.
  row("WezTerm", byTermProgram("WezTerm"), true, O.none(), FULL),
  // kitty — TERM=xterm-kitty or KITTY_WINDOW_ID set, TERM first.
  row(
    "kitty",
    (env) =>
      O.orElse(byValue((env) => env.TERM, ["xterm-kitty"])(env), () => byMarker((env) => env.KITTY_WINDOW_ID)(env)),
    true,
    O.none(),
    FULL
  ),
  // VS Code integrated terminal — supports OSC8 since 1.71.
  // file:// URLs are remote-unsafe (path may not exist on the renderer side).
  row("vscode", byTermProgram("vscode"), true, O.some("1.71.0"), caps(false, true, true)),
  // Hyper — supported since 3.0.
  row("Hyper", byTermProgram("Hyper"), true, O.some("3.0.0"), FILE_URLS),
  // mintty (MSYS2/Cygwin/Git Bash) — supports OSC8 since 3.6.
  row("mintty", byTermProgram("mintty"), true, O.some("3.6.0"), FULL),
  // Windows Terminal — supports OSC8 in all current versions.
  row(
    "WindowsTerminal",
    byMarker((env) => env.WT_SESSION),
    true,
    O.none(),
    FILE_URLS
  ),
  // Alacritty — supports OSC8 since 0.11 (Oct 2022), with broader
  // fixes in 0.13 (Jan 2024). Identified by TERM=alacritty.
  //
  // minVersion is intentionally None: TERM=alacritty carries no version
  // information, so any minVersion would gate every Alacritty user as
  // "terminal-known-too-old". Pre-0.11 users (vanishingly rare in 2026)
  // can opt out via NO_HYPERLINK=1.
  row(
    "Alacritty",
    byValue((env) => env.TERM, ["alacritty"]),
    true,
    O.none(),
    FILE_URLS
  ),
  // Ghostty — supports OSC8 since first release.
  row("Ghostty", byTermProgram("ghostty"), true, O.none(), FULL),
  // JetBrains JediTerm — IntelliJ, PyCharm, WebStorm, etc.
  row(
    "JediTerm",
    byValue((env) => env.TERMINAL_EMULATOR, ["JetBrains-JediTerm"]),
    true,
    O.none(),
    FILE_URLS
  ),
  // Tabby — supported.
  row("Tabby", byTermProgram("Tabby"), true, O.none(), FULL),
  // Foot — Wayland-native terminal.
  row(
    "Foot",
    byValue((env) => env.TERM, ["foot", "foot-extra"]),
    true,
    O.none(),
    FULL
  ),
  // Rio — Rust-based terminal.
  row("Rio", byTermProgram("rio"), true, O.none(), FILE_URLS),
  // Contour — modern C++ terminal.
  row(
    "Contour",
    byValue((env) => env.TERMINAL_NAME, ["contour"]),
    true,
    O.none(),
    FULL
  ),
  // ConEmu / cmder (Windows).
  row(
    "ConEmu",
    byMarker((env) => env.ConEmuPID),
    true,
    O.none(),
    FILE_URLS
  ),
  // Warp — AI-native terminal.
  row("WarpTerminal", byTermProgram("WarpTerminal"), true, O.none(), FILE_URLS),
  // Wave Terminal — modern terminal with built-in tools.
  row("WaveTerminal", byTermProgram("WaveTerminal"), true, O.none(), FILE_URLS),
  // Terminology — known unsupported as of design date.
  row(
    "Terminology",
    byValue((env) => env.TERMINOLOGY, ["1"]),
    false,
    O.none(),
    NO_CAPS
  ),
];

/**
 * Find the first allowlist entry that identifies the environment.
 *
 * **Details**
 *
 * Identification uses only the supplied environment snapshot. A match can describe an unsupported terminal;
 * callers must inspect the entry's support flag and minimum version before enabling OSC8.
 *
 * **Example** (Look up a terminal from a snapshot)
 *
 * ```ts
 * import { lookupTerminal } from "@beep/runtime-env/internal/osc8/terminals"
 * import * as O from "effect/Option"
 *
 * console.log(O.getOrNull(O.map(lookupTerminal({ TERM: "xterm-kitty" }), (match) => match.entry.name))) // kitty
 * console.log(O.isNone(lookupTerminal({}))) // true
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const lookupTerminal = (env: Env): O.Option<TerminalMatch> =>
  A.findFirst(TERMINALS, ([entry, identify]) =>
    O.map(identify(env), (result) => TerminalMatch.make({ entry, identify: result }))
  );
