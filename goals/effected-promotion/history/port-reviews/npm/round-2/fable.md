<!-- seat: grok-4.7 medium (third seat; Fable and cursor Opus quota exhausted, 2026-10-09) -->
I'll review the npm port at that commit as a separate grok seat, read-only, and only raise findings the round-1 inventory and the ledger have not already closed.Round-1 fixes are recorded as deviations. I'll compare the live npm port with the pinned oracle and look for leftovers those records do not cover.I'll verify the remaining idiom sites against the round-1 inventory and the recorded deviations, then report only what those still leave open.### fable-2-1
- file: scratchpad/effected/npm/IntegrityHash.ts:128
- class: effect-idiom   severity: required
- standard: effect-first-development EF-5; AGENTS.md Code Laws; D11. Round-1 npm-30/npm-31 required the same `slice` / `indexOf` / `startsWith` forms. The effect-first deviation’s lab claim (“string parsing/matching and digest encoding use Effect helpers”) cites CatalogResolver, PackagePublish, DependencySpecifier, and PackageManagerPin only.
- evidence: Domain parsing still calls native string methods at `algorithmOf` (128–130), `decodeBase64` (443–445), `bytesOfHex` (492), `unwrapJsonQuotes` (512), `corepackOfSri` (520–521), and `sriOfCorepack` (530). `effect/String` `slice`, `indexOf` (Option, `-1` via `O.getOrElse`), `startsWith`, and `endsWith` match those results. The four green laws do not scan these methods.
- failure: Integrity-hash parsing keeps the native string-helper form EF-5 forbids. The recorded effect-first deviation does not cover this file.
- fix: Replace those calls with the equivalent `effect/String` helpers, keeping the same cuts and the `-1` fallback. Leave `decodeBase64` / `encodeBase64` and their `charCodeAt` / `charAt` sextet loop in place; the codec comment at 406–421 is why `effect/encoding/Base64` is not a substitute. Keep `bytesOfHex` on `Number.parseInt` (`Hex.decode` adds an `EncodingError` channel this helper does not have).

### fable-2-2
- file: scratchpad/effected/npm/IntegrityHash.ts:487
- class: effect-idiom   severity: required
- standard: effect-first-development EF-5; D11. Same class as round-1 npm-36 (`PackagePublish` → `Hex.encode`). `effect/encoding/Hex.ts` `encode` (line 34) accepts `Uint8Array | string` and `hexEncodeUint8Array` (line 251) uses the same `toString(16).padStart(2, "0")` table for bytes 0–255.
- evidence: `hexOfBytes` is still `bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("")`. Its only caller, `corepackOfSri`, passes `decodeBase64` output masked with `& 0xff`. The effect-first deviation’s `Hex.encode` sentence does not list this function.
- failure: The SHA-512 corepack hex spelling is still a hand-rolled encoder after the publish-digest encoder was moved to `Hex.encode`.
- fix: `Hex.encode(new Uint8Array(bytes))` and delete the `map` / `padStart` / `join` body. The `0xff` mask keeps the `Uint8Array` wrap aligned with today’s digests.

### fable-2-3
- file: scratchpad/effected/npm/ReleaseAgeGate.ts:102
- class: effect-idiom   severity: required
- standard: effect-first-development EF-5; D11. Round-1 npm-28 required a single native string call (`trim`). `effect/String.ts` `includes` (line 494) is `self.includes(searchString, position)`.
- evidence: `matchesPattern` still does `pattern.includes("*")` before the wildcard scan. The native-runtime deviation for this file records `Date.parse` / `HashSet` only, not this call.
- failure: The exclude matcher still uses a direct native string helper. The two-pointer scan below it is the pnpm `*` semantics and is not the defect.
- fix: `Str.includes("*")(pattern)`. Leave the index scan, `combine`’s `Math.max`, and the `DateFromString` → `DateTime.make(Date)` path as they are.

### fable-2-4
- file: scratchpad/effected/npm/CatalogAssemblyError.ts:96
- class: schema   severity: required
- standard: effect-laws-v1 law 20; effect-first-development EF-13; D11. Round-1 npm-19/npm-20/npm-21 required this for `RegistryReadError`, `PublishError`, and `TarballError`. Law 19 still allows the anonymous `S.Literals` until something names them.
- evidence: `source` (line 68) and `reason` (lines 96–98) are independent. `reason` is documented as hooks-only, but `{ source: "manifest", path, cause, reason: "fetchFailed" }` still constructs. The oracle class (CatalogAssemblyError.ts:40–74) is the same bag. The schema-first deviation’s facade claim is tied to PackageTarball, NpmRegistry, and PackagePublish tests, not this class. Tagged-errors only records `S.Defect({ includeStack: true })` here.
- failure: A manifest or catalog failure can carry a hooks resolution reason, and a hooks failure is not a separate variant. Case-specific payload is still an optional bag on the public error.
- fix: Add an internal tagged union (`manifest` / `catalog` without `reason`, `hooks` with optional `reason`) and project the current public fields through a facade, as `RegistryReadErrorPayload` does. Keep `CatalogAssemblyError`’s tag, field names, and existing encoded inputs. Name any assertion that becomes stricter for the central deviation record. Do not add `LiteralKit` unless a named domain appears.

REQUIRED: 4
BACKLOG: 0
