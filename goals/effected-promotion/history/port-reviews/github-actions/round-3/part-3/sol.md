### sol-3-1
- file: scratchpad/effected/github-actions/ToolInstaller.ts:494
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`); ToolInstaller’s documented staging invariant.   evidence: A read-only `bun --eval` differential probe used filesystem stubs that only recorded calls in memory. In both the port and pinned oracle, `cacheFile("/source", "../victim", "tool", "1")` returned `/cache/tool/1/x64` successfully. With staging `/cache/.staging-example`, the recorded copy destination was `/cache/victim`, followed by publication of the staging directory.
- failure: The accepted filename escapes staging. Installation can overwrite a neighboring file, publish an entry without the requested binary, and leave the escaped write outside staging cleanup.
- fix: Before copying, validate that the actual joined destination resolves strictly inside staging; return the existing `cacheFailed` error for an escape. Add a regression asserting rejection before any copy or cache publication, and record the verified upstream bug under section 14.

### sol-3-2
- file: scratchpad/effected/github-actions/internal/sigv4.ts:164
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`); `SigV4Request.headers` accepts names in any case, and `sign` promises headers matching what was signed.   evidence: A read-only differential probe supplied `Host: stale.example.test` and `X-Amz-Date: 20000101T000000Z`. Both implementations signed `host:example.test` and `x-amz-date:20240101T000000Z`, but retained the differently cased originals in the returned record. `new Headers(sign(...))` produced `host: stale.example.test, example.test` and `x-amz-date: 20000101T000000Z, 20240101T000000Z`. The lowercase map discards duplicates while the returned record retains them.
- failure: Transport normalization sends different header values from those covered by the signature. Valid mixed-case input can therefore produce a rejected signed request. Ordinary duplicate names such as `X-Test` and `x-test` have the same mismatch.
- fix: Normalize names into one record before adding generated signing headers, handle ordinary duplicates consistently with the transport, and derive both canonical headers and returned headers from that record. Add mixed-case collision regressions and record the verified upstream bug.

### sol-3-3
- file: scratchpad/effected/github-actions/PackageManagerInstaller.ts:873
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`); the documented requirement to validate foreign cache-hit layout before returning usable bins.   evidence: A read-only differential probe modeled a Windows pnpm cache containing the extensionless native `pnpm` file and an existing `pnpm.cmd` shim, but no `pnpm.exe`. Its manifest declared the native optional dependency. Both implementations returned success with `bins.pnpm="/cache/pnpm/pnpm.exe"` while the stub’s existence check returned `false`. Recorded stat calls checked only the extensionless file and existing shim; the retargeted executable was never checked.
- failure: A cache hit can return a nonexistent executable. If the shim needs regeneration, it can also be written to invoke that nonexistent `.exe`, despite installation reporting success.
- fix: Validate the final bin targets after `nativeWindowsBins` retargeting and before shim creation or reuse. Use the existing `assertFile`/`layoutUnexpected` path for a missing target. Add a cache-hit regression with the extensionless binary present and `.exe` absent, and record the verified upstream bug.

### sol-3-4
- file: scratchpad/effected/github-actions/internal/runnerFile.ts:113
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`); runner-file value fidelity; GitHub runner’s [FileCommandManager heredoc parser](https://github.com/actions/runner/blob/main/src/Runner.Worker/FileCommandManager.cs#L371).   evidence: The runner’s Windows reader recognizes CRLF and excludes the final value line’s newline from the extracted substring. A read-only probe implementing that reader over port and pinned-oracle output produced `input="abc\r", windows="abc"` and `input="\r", windows=""`; POSIX retained the original values. The builder’s appended LF combines with the value’s final CR. The current property test removes fixed framing with `slice`, so it misses this parser behavior.
- failure: Windows `GITHUB_OUTPUT` values ending in a bare carriage return silently lose that byte. The shared framing helper therefore fails its claimed byte-fidelity property.
- fix: Parameterize framing with the runner’s line ending and use CRLF separators on Windows, retaining LF on POSIX. Pass that selection from the runner-file callers. Add regressions against the runner’s parsing rules for terminal CR, CRLF, and LF, and record the verified upstream bug.

### sol-3-5
- file: scratchpad/effected/github-actions/ToolInstaller.ts:387
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`); ToolInstaller’s documented interoperability with the shared runner tool cache; official [tool-cache lookup and completion-marker implementation](https://github.com/actions/toolkit/blob/main/packages/tool-cache/src/tool-cache.ts#L484).   evidence: `@actions/tool-cache.find` and `findAllVersions` require both the entry directory and its sibling `<arch>.complete` marker. The port and pinned oracle publish by renaming staging and returning immediately; neither creates that marker. The differential cache probe recorded directory creation, copy, removal, and rename, with no marker write. Existing tests verify the directory layout and this module’s own lookup, which does not require the marker.
- failure: A successfully installed tool in a fresh cache is invisible to subsequent actions using `@actions/tool-cache`, contrary to the stated shared-cache contract. Those actions treat the installation as a miss and may download and replace it.
- fix: Invalidate any stale completion marker before replacement and create the empty sibling marker only after successful publication, mapping marker failures to `cacheFailed`. Add a regression for a fresh entry’s discoverability under the official lookup predicate and record the verified upstream bug.

### sol-3-6
- file: scratchpad/effected/github-actions/internal/actionsResults.ts:26
- class: schema   severity: required
- standard: standards/ARCHITECTURE.md, “Schemas Are Executable Contracts”; standards/effect-first-development.md EF-33; standards/schema-first-development-prompt.md, “Schema owns pure data”; D5/D11.   evidence: At the pinned commit, multiple concrete configuration, result, and protocol models remain exclusively TypeScript declarations with no corresponding runtime schema: `BackendIds` and `ResultsBackend` here; `PackageManagerInstallOptions` in `PackageManagerInstaller.ts:169`; `ExtractOptions`, `ProvisionFileOptions`, and `ProvisionedFile` in `ToolInstaller.ts:127,179,208`; the three command-option models in `internal/archiveCommands.ts:76,196,240`; `CacheHit` in `internal/cacheService.ts:145`; `JwtPayloadFailure` in `internal/jwt.ts:28`; `SigV4Credentials` and `SigV4Request` in `internal/sigv4.ts:66,80`; `SpawnOnceResult` in `internal/spawn.ts:30`; and `TwirpFailure` in `internal/twirp.ts:63`. These declarations contain representable pure data, rather than service methods or overload machinery. The green gates leave this semantic schema-first violation intact.
- failure: These data contracts have no executable source from which callers can derive guards, decoding, equivalence, annotations, or schema arbitraries. Their separately implemented parsing and construction logic continues to own the contracts, contrary to EF-33.
- fix: Replace these pure-data declarations with identity-annotated schemas and derive the same-name types. Use `S.Struct` where preserving plain-object construction is necessary, retain existing optional/explicit-undefined semantics and failure discriminants, and preserve current acceptance behavior. Keep service and generic utility contracts as TypeScript types. Add the required schema properties and record the law-forced additions centrally.

REQUIRED: 6
BACKLOG: 0