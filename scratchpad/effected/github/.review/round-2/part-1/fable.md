<!-- seat: grok-4.7 medium (third seat; Fable and cursor Opus quota exhausted, 2026-10-09) -->
I'll review the named GitHub port files against the pinned upstream oracle and the round-1 inventory, and report only new findings.Round 1 is closed and the port notes already record those deviations. I’ll compare the current focus files with the pinned oracle and look only for new gaps.The closed round-1 items stay closed. Next I’ll read the implementations in the focus files and line them up with the pinned oracle.### fable-2-1
- file: scratchpad/effected/github/GitHubContent.ts:183
- class: bug   severity: required
- standard: D9 / section 14   evidence: The pinned oracle (`packages/github/src/GitHubContent.ts:105-110`) interpolates `JSON.stringify(content.encoding)` inside `GitHubError.rejected`. `@octokit/openapi-types` `types.d.ts:16444` types that field as `encoding?: string`. `JsonValue` is `S.fromJsonString(S.String)` (`GitHubContent.ts:18`), so `S.encodeEffect` fails on `undefined` or `null` and `Effect.orDie` turns that into a defect. A present string still encodes to the same quoted JSON text as `JSON.stringify`.
- failure: A file payload whose `encoding` is omitted or `null` dies while building the rejection message. Callers of `getFile` / `getFileOption` that handle `GitHubError` never see the 422. Upstream returns `GitHubError.rejected` whose message contains `undefined` or `null`.
- fix: Render the encoding with a total expression that matches that interpolation (`undefined` to the word `undefined`, `null` to `null`, strings JSON-quoted) and pass the string to `GitHubError.rejected`. Do not `orDie` a schema encode on this path.

### fable-2-2
- file: scratchpad/effected/github/GitHubError.ts:478
- class: type-safety   severity: required
- standard: D15; `standards/effect-laws-v1.md` law 17   evidence: `isRecord` is `P.isObjectOrArray`, which is `typeof === "object" && input !== null` and includes arrays (`effect/Predicate.ts:1038-1039`). The predicate then claims `value is Record<string, unknown>`. `readThrowable` (`:463`) and `asRecord` (`:480`) use it for the throwable, `response`, `headers`, `data`, and each validation entry. This is the same user-defined narrowing round 1 required removed from `internal/octokit.ts`; the D15 `as` scan cannot see it, and this copy is still here.
- failure: An array-shaped throwable or header object is typed as a string-keyed record. Indexed reads then run on a value that does not have a string index signature, which is the unverified narrowing D15 forbids.
- fix: Narrow with `P.isObjectOrArray(value) && !A.isArray(value)` (or a schema-derived record guard) before the record reads. If dropping array values changes which throwables classify, record that under law 17.

### fable-2-3
- file: scratchpad/effected/github/GitHubCommit.ts:486
- class: tsgo   severity: required
- standard: tsgo `preferSucceedSomeOrNone` (`tsconfig.base.json:193`, severity `error`); `standards/effect-laws-v1.md` law 21   evidence: The rule is on and the gate is green, but the explicit type-argument form is still present: `GitHubCommit.ts:486` and `:495` (`O.none<ReadonlyArray<CommitFile>>`), `GitBranch.ts:449` (`O.none<string>`), `GitHubContent.ts:197` (`O.none<string>`), and `GitHubRelease.ts:320` (`O.none<ReleaseInfo>`). Round 1 showed this shape does not trip the diagnostic. `Effect.succeedNone` is `Effect<Option<never>>` and is assignable at each of these success types.
- failure: The idiom the compiler is configured to reject is still in these five `PageSource` and `notFound` branches.
- fix: Replace each `Effect.succeed(O.none<...>())` with `Effect.succeedNone`. Leave the surrounding `catchIf` and pagination completion logic as they are.

REQUIRED: 3
BACKLOG: 0
