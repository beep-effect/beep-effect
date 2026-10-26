<!-- seat: grok-4.7 medium (third seat; Fable and cursor Opus quota exhausted, 2026-10-09) -->
I'll review the github-actions slice read-only against the pinned upstream oracle, skipping closed round-1 items and recorded deviations. First I'll load the prior inventory, port notes, and the binding decisions.Round 1 already closed a large set of findings. I'll read the port notes and the focus files at this commit, and only raise defects that inventory did not already record.### fable-2-1
- file: scratchpad/effected/github-actions/PackageManagerInstaller.ts:451
- class: bug   severity: required
- standard: D9 and D11; section 14 (`upstream-bug`). The manifest is treated as attacker-supplied at lines 661–664 and 686–692, and the new name check only constrains the shim filename.   evidence: `posixShim` and `cmdShim` interpolate the bin target inside one pair of double quotes (`exec node "${target}"` / `node "${target}"`). `readPackageManifest` only rejects a target whose resolved path leaves the package (`..` or absolute). A target that stays inside the package can still contain `"`, `` ` ``, `$(...)`, `%VAR%`, or a newline. `isNodeScript` only checks the suffix, so `bin/pnpm"; id; echo "` is not a Node script and `bin/$(id).js` is. `assertFile` succeeds when the tarball contains that filename. The pinned oracle writes the same unescaped templates (`posixShim` / `cmdShim` in upstream `PackageManagerInstaller.ts`).
- failure: The shim is a shell or cmd script. On invocation the shell splits or expands the target, so a package from `options.registry` (or a compromised pin) runs attacker-controlled commands in the job. Ordinary pins such as `bin/pnpm.cjs` still match the existing shim snapshots.
- fix: Reject, as `layoutUnexpected`, any bin target containing `"`, `'`, `` ` ``, `$`, `%`, `\`, newline, or carriage return before `writeShims`, or shell-escape those bytes in both shim bodies. Keep the current text for safe paths. Record the upstream bug centrally.

### fable-2-2
- file: scratchpad/effected/github-actions/PackageManagerInstaller.ts:508
- class: bug   severity: required
- standard: D11; section 14 (`upstream-bug`); same own-property contract as round-1 `ActionInput` `__proto__` (r2), which this site does not share.   evidence: `normalizeBins` copies manifest keys with `entries[name] = value.replace(...)`. `R.toEntries` is `Object.keys`, so an own enumerable `__proto__` from `JSON.parse` / `S.fromJsonString` is visited. In this ESM module that assignment calls `Object.setPrototypeOf` with a string and throws `TypeError: Object prototype may only be an Object or null`. The call sits in the `readPackageManifest` generator outside `Effect.try`, so the fiber dies instead of failing with `layoutUnexpected`. Upstream `normalizeBins` uses the same assignment. `R.assignProperty` is the helper that defines `__proto__` as an own data property.
- failure: A `package.json` `bin` map that includes `__proto__` aborts installation as an untyped defect. The key never reaches `isBinName` or the shim-destination check, and any sibling bins are dropped with it.
- fix: Build the bin map with `R.assignProperty`. Then let the existing `BinName` and destination checks accept or reject that name. Add a `__proto__` bin regression to `PackageManagerInstaller.test.ts`. Record the upstream bug centrally.

### fable-2-3
- file: scratchpad/effected/github-actions/PackageManagerInstaller.ts:35
- class: bug   severity: required
- standard: D11; the containment rule added for round-1 r21 (validate every bin name and resolved shim destination before any write).   evidence: `BinName` is `/^(?!\.{1,2}$)[^/\\:\x00]+$/`, so `nul`, `con`, `aux`, `prn`, `com1`, and `lpt1` pass. On Windows `shimFileName` appends `.cmd`. `validateShimDestinations` then accepts the name because `path.resolve(shimDir, "nul.cmd")` is still lexically inside `.bin` (`path.relative` is `nul.cmd`). Windows reserves those names with any extension, and `writeFileString` of `...\nul.cmd` opens the NUL device rather than a file in `.bin`. The same path string is what r21’s `..` check looks at, so this case does not trip it.
- failure: On a Windows runner an archive bin named `nul` or `con` passes the new containment gate. The install can succeed while the shim is discarded or attached to the console device, so the published `.bin` command is not the file the check claimed to confine.
- fix: Reject those reserved basenames, with or without a trailing extension, in `BinName` before `writeShims`, using the existing `layoutUnexpected` subject. Keep `..`, slash, colon, and NUL rejection. Add a Windows reserved-name case next to the escaping-bin regression.

REQUIRED: 3
BACKLOG: 0
