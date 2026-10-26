### sol-2-1
- file: scratchpad/effected/github-actions/PackageManagerInstaller.ts:452
- class: bug   severity: required
- standard: D9, D11, section 14’s verified-upstream-bug route; `writeShims` must invoke the validated bin target.   evidence: A read-only probe using in-memory filesystem and installer doubles supplied `{"bin":{"pnpm":"bin/$tool.js"}}`. Both the port and pinned oracle installed successfully, returned `bins.pnpm = "/cache/pnpm/10/x64/bin/$tool.js"`, and generated `exec node "/cache/pnpm/10/x64/bin/$tool.js" "$@"`. A read-only shell argument probe using that quoting and the fixture environment `tool=expanded` produced `/cache/pnpm/10/x64/bin/expanded.js` instead of the recorded target.
- failure: Double quotes do not make a POSIX shell pathname literal: `$`, backticks, command substitution, backslashes, and embedded quotes retain shell meaning. An accepted filename or cache-root component can therefore make the installed command execute a different target or fail to start. This is separate from round-1 r21’s shim-destination containment defect; the demonstrated target remains inside the package directory.
- fix: Encode the complete target as a POSIX single-quoted literal, escaping embedded single quotes, and retain `"$@"` for forwarded arguments. Apply the literal to both the Node-script and direct-executable branches. Add regressions for metacharacters in bin targets and cache roots, and record the verified upstream bug under section 14.

### sol-2-2
- file: scratchpad/effected/github-actions/Secret.ts:105
- class: bug   severity: required
- standard: D9, D11, section 14’s verified-upstream-bug route; `Secret.forChildEnv` promises a plaintext environment entry for every supplied secret.   evidence: A read-only differential probe passed an own computed `__proto__` property and a normal property, both containing fixture `Redacted` values. Both the port and pinned oracle returned `{"keys":["NORMAL"],"ownProto":false,"maskedCount":2}`. The supplied entry is enumerated and masked, but assignment into `declassified = {}` does not create its corresponding own property.
- failure: A valid environment-variable name silently disappears from the successful handoff. A child receives no `__proto__` variable despite the parent supplying and masking it. Round-1 r2 repaired this mechanism in `ActionInput.pairs`; it did not cover this independent construction in `Secret`.
- fix: Replace `declassified[name] = plaintext` with `R.assignProperty(declassified, name, plaintext)`, preserving the plain-record shape and masking order. Add an own-property handoff regression for `__proto__` and record the verified upstream bug under section 14.

### sol-2-3
- file: scratchpad/effected/github-actions/internal/archiveCommands.ts:165
- class: bug   severity: required
- standard: D9, D11, section 14’s verified-upstream-bug route; the archive command must pack the supplied file paths literally.   evidence: Read-only command-construction probes against both the port and pinned oracle with `files: ["-h"]` produced `["-6","-qr","/out/artifact.zip","-h"]`. The installed `zip -h2` documentation states that arguments following `--` are read verbatim as paths rather than options. The contextual `Artifact.zip` caller passes relative filenames through this helper and rejects line breaks, but permits a filename such as `-h`.
- failure: A legitimate leading-dash filename is interpreted as a zip option. For example, `-h` selects help instead of packing the requested file; other names can alter archive behavior. The Windows branch treats the same path literally, so accepted artifact inputs have different behavior across platforms.
- fix: Insert `"--"` between `options.destination` and `...options.files` in the POSIX argv. Update the command-shape assertion and add a leading-dash filename regression. Record the verified upstream bug under section 14.

### sol-2-4
- file: scratchpad/effected/github-actions/PackageManagerInstaller.ts:677
- class: effect-idiom   severity: required
- standard: `standards/effect-first-development.md` EF-3 and EF-19 require Effect codecs at fallible boundaries and reserve Result codecs for intentional non-throwing synchronous helpers; EF-1 forbids throw-based domain control flow.   evidence: `readPackageManifest` wraps `Result.getOrThrowWith(S.decodeResult(Json)(raw), (error) => error)` in `Effect.try`. `registryIntegrity` repeats the pattern at line 900. `internal/jwt.ts:60–64` likewise unwraps a schema Result by throwing it and immediately catches it to construct another Result. These expressions remain on the specified green commit, demonstrating that the gates miss this throw-to-catch form. The recorded schema-first deviation accepts the changed schema-error identity; it does not require exception-based decoding.
- failure: Malformed external JSON takes a synchronous JavaScript exception detour even though decoding already supplied a typed failure. The installer paths convert Result → thrown exception → Effect failure, while the JWT path converts Result → thrown exception → Result failure. These are additional sites beyond round-1 r5–r8’s repaired paths.
- fix: Use `S.decodeEffect(Json)` with `Effect.mapError` for the two installer boundaries, preserving their existing error fields and schema-error causes. In `payloadOf`, use `Result.mapError` on `S.decodeResult(Json)(json.success)` to construct the existing `JwtPayloadFailure` directly. Preserve the accepted cause identity and existing malformed-input behavior.

REQUIRED: 4
BACKLOG: 0