// The archiver command lines this package spawns, spelled once.
//
// `Artifact` (pack and unpack) and `ToolInstaller` (unpack only) each spawn
// the same three shapes — a zip, an unzip, a tar extraction — and each has a
// Windows half that no test on a POSIX host can execute. Two hand-written
// copies drifted: `ToolInstaller.extractZip` learned the overwrite overload
// and the stderr capture below, `Artifact.download` did not, and a download
// into a non-empty directory kept failing on Windows with an EMPTY stderr.
// This module is the one spelling; the tests pin its text verbatim, which
// is the only proof the Windows halves get.
//
// **The pwsh unzip is deliberately belt-and-braces.** The THREE-argument
// `ExtractToDirectory(src, dest, $true)` overload overwrites existing files —
// the two-argument one refuses, which is what turned a repeated extraction
// into a hard failure — and the `$ErrorActionPreference = 'Stop'` plus
// try/catch writes the actual .NET exception text plainly to stderr and
// exits 1. pwsh's own error rendering does not reliably reach a captured
// stream, and an empty complaint costs a source dive to even hypothesize
// about.
//
// **The pwsh zip drives .NET's `ZipFile` directly, not `Compress-Archive`.**
// Microsoft's own reference for `Compress-Archive -Path` states both faults:
// handed individual file paths it stores every entry under its bare file
// name — directory structure is kept only when `-Path` names a directory —
// so `dir\b.txt` landed as `b.txt`, same-named files in different
// directories collided, and a Windows artifact was structurally different
// from the POSIX `zip -qr` one; and `-Path` expands wildcards, so a literal
// `report[1].txt` matched nothing and failed the upload. Stating every entry
// name explicitly through `CreateEntryFromFile(zip, source, entryName)`
// removes both: the source is `Path.Combine(root, rel)`, taken literally,
// and the entry name is `rel` with `\` turned to `/`, which is what `zip`
// records on POSIX.
//
// **The Windows script is constant-size: the file list travels in a manifest
// file, never in `-Command`.** `CreateProcessW` caps the whole command line
// at 32,767 characters, and inlining one `CreateEntryFromFile` statement per
// file (~214 characters each) hit that ceiling at roughly 150 files with
// `ENAMETOOLONG`. The script therefore reads `zipManifest`'s output (one relative path per
// line) with `File.ReadAllLines` and loops. **The two branches deliberately
// differ in mechanism**: POSIX `zip` takes the files as argv, whose ceiling
// (`ARG_MAX`, megabytes on the hosted runners) is far larger, so the only
// file-count ceiling left is that POSIX argv limit. The manifest is written by
// the caller (`Artifact.zip`) as UTF-8 WITHOUT a BOM, which is what
// `ReadAllLines` reads by default. Its BOM detection would consume a BOM
// rather than leak it into the first path (measured), so this is a
// plain-bytes preference, not a correctness guard.
//
// **Every `CreateEntryFromFile` is assigned to `$null`.** Unassigned, pwsh
// writes the returned `ZipArchiveEntry` to stdout — roughly 430 bytes of
// formatted object per file — and `internal/spawn.ts` interleaves stdout with
// stderr into the captured output, which is what `ArtifactError.stderr`
// carries. Left in, that chatter buried the one line that matters, the .NET
// exception, under kilobytes of entry listings.
//
// Every path handed to PowerShell is single-quoted, and a single quote inside
// one is doubled — the only escape a single-quoted PowerShell literal has.
//
// Pure: no filesystem, no environment, no spawn. `internal/spawn.ts` is the
// execution half. Reaches `effect/process` alone, so it is safe for
// any module to import (`__test__/reachability.test.ts`).
import { ChildProcess } from "effect/process";

/** A PowerShell single-quoted literal: `'` becomes `''`, nothing else is special. */
const pwshLiteral = (value: string): string => `'${value.replaceAll("'", "''")}'`;

/** A non-interactive pwsh invocation of one command line. */
const pwsh = (script: string, options?: ChildProcess.CommandOptions): ChildProcess.StandardCommand =>
	ChildProcess.make("pwsh", ["-NoProfile", "-NonInteractive", "-Command", script], options);

/** What {@link zipCommand} packs. */
export interface ZipCommandOptions {
	/** Whether the runner is Windows (`RUNNER_OS`), which selects the .NET `ZipFile` over `zip`. */
	readonly windows: boolean;
	/** The directory the archiver runs in; every entry is recorded relative to it. */
	readonly root: string;
	/**
	 * The files to pack, ALREADY relative to `root` — the caller relativizes,
	 * this module does not. POSIX passes them as `zip`'s argv; the Windows
	 * branch ignores them and reads `manifest` instead.
	 */
	readonly files: ReadonlyArray<string>;
	/**
	 * Windows only: the path of a file holding {@link zipManifest}'s output for
	 * the same `files`, which the pwsh script reads with `File.ReadAllLines`.
	 * Each line becomes an entry named with every `\` turned to `/`. Ignored
	 * by the POSIX branch, whose argv has no comparable ceiling (the module doc
	 * says why the two branches differ in mechanism).
	 */
	readonly manifest: string;
	/** Where the archive is written; an existing archive is replaced on both platforms. */
	readonly destination: string;
	/**
	 * The zlib level, clamped to `0..9` and truncated. `zip` takes it as
	 * `-<level>`; on Windows it maps onto .NET's `CompressionLevel`: `0` is
	 * `NoCompression`, `1..3` `Fastest`, `4..8` `Optimal`, `9` `SmallestSize`
	 * (.NET 6+, which pwsh 7.2+ on the hosted runners has).
	 */
	readonly level: number;
}

/** {@link ZipCommandOptions.level} clamped to `zip`'s `0..9` and truncated. */
const clampLevel = (level: number): number => Math.min(9, Math.max(0, Math.trunc(level)));

/** The .NET `CompressionLevel` member a clamped zlib level maps onto. */
const dotnetCompressionLevel = (level: number): string =>
	level === 0 ? "NoCompression" : level <= 3 ? "Fastest" : level <= 8 ? "Optimal" : "SmallestSize";

/**
 * The manifest the Windows zip script reads: `files` one per line, `\n`-joined,
 * with a trailing newline. Pure; the caller writes it (UTF-8, no BOM).
 *
 * @remarks
 * A path containing `\n` or `\r` is unrepresentable — it would split into two
 * entries — and this function does not check; `Artifact.zip` rejects such a
 * file as `invalidOptions`, naming it, before anything is written.
 *
 * @internal
 */
export const zipManifest = (files: ReadonlyArray<string>): string => files.map((file) => `${file}\n`).join("");

/**
 * Pack `files` into a zip: `zip -<level> -qr <destination> <files...>` with
 * `root` as the working directory, or on Windows a pwsh script that opens
 * `destination` with `ZipFile.Open(..., Create)` after a `File.Delete` (the
 * overwrite) and adds one `CreateEntryFromFile` per line of `manifest`,
 * naming each entry explicitly — under `$ErrorActionPreference = 'Stop'` and
 * a stderr-writing try/catch, and with the archive disposed in a `finally` so
 * a failed entry cannot leave the handle open (the module doc says why not
 * `Compress-Archive`, and why the list travels in a file).
 *
 * @internal
 */
export const zipCommand = (options: ZipCommandOptions): ChildProcess.StandardCommand => {
	const level = clampLevel(options.level);
	if (!options.windows) {
		return ChildProcess.make("zip", [`-${level}`, "-qr", options.destination, ...options.files], {
			cwd: options.root,
		});
	}
	const destination = pwshLiteral(options.destination);
	const root = pwshLiteral(options.root);
	const manifest = pwshLiteral(options.manifest);
	const compression = `[System.IO.Compression.CompressionLevel]::${dotnetCompressionLevel(level)}`;
	// `$rel.Replace('\', '/')` is .NET `String.Replace` — a literal substring
	// swap, not a regex — so the backslash needs no escaping. `ReadAllLines`
	// yields no entry for the manifest's trailing newline; the empty-line guard
	// is for a stray blank line, which would otherwise build an entry from
	// `root` itself.
	return pwsh(
		"$ErrorActionPreference = 'Stop'; try { Add-Type -AssemblyName System.IO.Compression; Add-Type -AssemblyName System.IO.Compression.FileSystem; " +
			`[System.IO.File]::Delete(${destination}); ` +
			`$zip = [System.IO.Compression.ZipFile]::Open(${destination}, [System.IO.Compression.ZipArchiveMode]::Create); ` +
			`try { foreach ($rel in [System.IO.File]::ReadAllLines(${manifest})) { if ($rel -ne '') { ` +
			`$null = [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, [System.IO.Path]::Combine(${root}, $rel), $rel.Replace('\\', '/'), ${compression}) ` +
			"} } } finally { $zip.Dispose() } } " +
			"catch { [Console]::Error.WriteLine($_.Exception.ToString()); exit 1 }",
		{ cwd: options.root },
	);
};

/** What {@link unzipCommand} unpacks. */
export interface UnzipCommandOptions {
	/** Whether the runner is Windows (`RUNNER_OS`), which selects the .NET `ZipFile` over `unzip`. */
	readonly windows: boolean;
	/** The archive. */
	readonly source: string;
	/** The directory its contents land in; existing files are overwritten on both platforms. */
	readonly destination: string;
}

/**
 * Unpack a zip into `destination`, overwriting: `unzip -oq <source> -d
 * <destination>`, or the three-argument `ExtractToDirectory` overload under
 * `$ErrorActionPreference = 'Stop'` and a stderr-writing try/catch on
 * Windows (the module doc says why both halves are load-bearing).
 *
 * @internal
 */
export const unzipCommand = (options: UnzipCommandOptions): ChildProcess.StandardCommand =>
	options.windows
		? pwsh(
				"$ErrorActionPreference = 'Stop'; try { Add-Type -AssemblyName System.IO.Compression.FileSystem; " +
					`[System.IO.Compression.ZipFile]::ExtractToDirectory(${pwshLiteral(options.source)}, ${pwshLiteral(options.destination)}, $true) } ` +
					"catch { [Console]::Error.WriteLine($_.Exception.ToString()); exit 1 }",
			)
		: ChildProcess.make("unzip", ["-oq", options.source, "-d", options.destination]);

/** What {@link tarExtractCommand} unpacks. */
export interface TarExtractCommandOptions {
	/** The tarball. */
	readonly archive: string;
	/** The directory its contents land in (`-C`). */
	readonly destination: string;
	/** `tar`'s flags; absent or empty means `xzf`. */
	readonly flags?: ReadonlyArray<string> | undefined;
}

/**
 * Extract a tarball: `tar <flags> <archive> -C <destination>`. The same on
 * every platform — bsdtar ships on the Windows runner image — so unlike the
 * zip pair there is no `windows` switch.
 *
 * @internal
 */
export const tarExtractCommand = (options: TarExtractCommandOptions): ChildProcess.StandardCommand => {
	const flags = options.flags === undefined || options.flags.length === 0 ? ["xzf"] : [...options.flags];
	return ChildProcess.make("tar", [...flags, options.archive, "-C", options.destination]);
};
