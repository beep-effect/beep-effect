I'll review the github-actions installer and internal surface against the pinned upstream oracle and the round-2 inventory, and report only new findings.Round-2 already closed the installer, secret, JWT, archive, and unstubbed defects. I'll read the binding decisions and the current sources, then look only for new divergences.The round-3 diagnosis is already in hand. I am checking the four cited sites so the line numbers in the report match the current files.The four sites match the earlier read. I am checking the law text, the filesystem calls, and whether these defects are already recorded.### grok-3-1
- file: scratchpad/effected/github-actions/PackageManagerInstaller.ts:707
- class: bug   severity: required
- standard: D11; D9 / section 14 (`upstream-bug`). The containment comment at 701–706. Effect `FileSystem.stat` follows links (`NFS.stat` in `packages/platform/node-shared/src/NodeFileSystem.ts:610`); `makeFileInfo` only reports `SymbolicLink` from an lstat-style result (`NodeFileSystem.ts:581`); `NFS.chmod` (`NodeFileSystem.ts:107`) and `NFS.copyFile` (`NodeFileSystem.ts:97`) follow an existing link. `tarExtractCommand` passes `xzf` with no dereference flag (`archiveCommands.ts:269`).
- failure: `path.relative` is lexical, and `typeAt` (`fsProbe.ts:33`) uses `fs.stat`. A tarball whose `package/` entry is a symlink to a directory passes the directory check at `PackageManagerInstaller.ts:1102`. A bin whose lexical path stays inside `package/` but is a symlink, or sits under a symlink directory, passes the check at 707–713, then `assertFile` sees a file. `chmod` at 1041 and `copyFile` at 1028 and 1034 follow that link and change a file outside the extract tree. The shim then execs the link. Cache hits use the same `readPackageManifest`. Upstream `PackageManagerInstaller.ts:539–544` has the same lexical check; round 2 did not cover it.
- fix: Before `assertFile`, overlay, or `chmod`, require `fs.readLink(packageDir)` to fail and require `fs.realPath` of every bin and every overlay destination to stay inside `fs.realPath(packageDir)` via `path.relative`. Keep a symlink whose real path stays inside the package. Add a regression with a symlink bin and a symlink `package/` root. Record the upstream bug centrally.

### grok-3-2
- file: scratchpad/effected/github-actions/PackageManagerInstaller.ts:466
- class: bug   severity: required
- standard: D11; D9 / section 14 (`upstream-bug`). Node’s CLI treats an argv that begins with `-` as an option until `--`; `-e` evaluates the rest of that argv. Round-2 r13 made the full shim target, including cache-root bytes, part of the literal-invocation contract. `WindowsShimTarget` (`PackageManagerInstaller.ts:48`) still admits `-`.
- failure: `posixShim` emits `exec node '<target>' "$@"` and `cmdShim` (`PackageManagerInstaller.ts:471`) emits `node "<target>" %*`, with no `--`. `ToolInstaller.cachePath` (`ToolInstaller.ts:682`) interpolates the cache root as the first path segment. A root whose text is `-eprocess.exit(1)//` is one argv. After the round-2 quoting, the shell passes it through and Node evaluates it. Absolute roots that start with `/` or a drive letter stay scripts. Upstream `posixShim` (`PackageManagerInstaller.ts:323–324`) has the same hole. This is the option parse left after r13’s shell quoting, which the snapshots at `PackageManagerInstaller.test.ts:347` still pin.
- fix: On the `isNodeScript` branches only, emit `exec node -- ${literal} "$@"` and `node -- "${target}" %*`. Leave the direct-exec branches unchanged. Update the shim snapshots and add a dash-leading cache-root regression. Record the upstream bug centrally.

### grok-3-3
- file: scratchpad/effected/github-actions/internal/archiveCommands.ts:232
- class: bug   severity: required
- standard: D11; D9 / section 14 (`upstream-bug`). Info-ZIP treats an operand that begins with `-` as an option until `--`. `-d exdir` is valid before the archive. `-h` prints help and exits 0 (`PK_OK`). Same class as round-2 r18, which inserted `--` for `zip` only.
- failure: POSIX argv is `["-oq", source, "-d", destination]`. `ToolInstaller.extractZip` (`ToolInstaller.ts:520`) passes the public archive string through, and `extractWith` (`ToolInstaller.ts:364`) treats exit code 0 as a finished extract. `unzip -oq -h -d <dest>` is help, exits 0, and leaves the destination empty. `archiveCommands.test.ts:195` pins the current argv. Upstream `archiveCommands.ts:186` matches it. The Windows `ExtractToDirectory` branch is quoted and stays as it is.
- fix: Use `["-oq", "-d", options.destination, "--", options.source]`. Update the POSIX assertion and add a source of `-h`. Leave `tarExtractCommand` on `["xzf", archive, "-C", destination]`: `f` consumes the next argv, including one that starts with `-`. Record the upstream bug centrally.

### grok-3-4
- file: scratchpad/effected/github-actions/internal/cacheService.ts:90
- class: effect-idiom   severity: required
- standard: effect-laws-v1 law 12; EF-7b; D11. Round-2 r12 required this form in `DryRun.ts` because the green law gate does not flag `condition ? Effect : Effect`. These two sites are still on this commit and were not in that inventory.
- failure: `reserveUpload` chooses `Effect.fail` or `Effect.succeedSome` with `!isOk(created) || url === undefined ? … : …` (lines 90–92). `finalizeUpload` chooses `Effect.fail` or `Effect.void` with `finalized === CONFLICT || !isOk(finalized) ? … : …` (lines 133–135). Both are boolean branches in runtime orchestration. Results stay correct.
- fix: Import `effect/Boolean` as `Bool` and use `Bool.match` with lazy branches at both sites, preserving the conflict short-circuit, the missing-url refusal, and the success values. `lookupDownload` returns an `Option`, so it stays out of this change.

REQUIRED: 4
BACKLOG: 0
