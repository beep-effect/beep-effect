# Worked examples

Taken from the tree at a1b08269809. Line numbers are historical.

## T, delete

`packages/drivers/freshbooks/test/Freshbooks.token.test.ts:214`

```ts skip-type-checking
// Every fiber observed the same rotated access token.
const values = A.map(tokens, Redacted.value);
expect(A.every(values, (value) => value === "access-1")).toBe(true);
```

The assertion says it.

## T that a generator re-creates

`packages/drivers/ffmpeg/vitest.config.ts:8`: `// Package-specific overrides`
inside `test: {}`. 142 vitest configs carry it, and three sources write it:
`CreatePackage/templates/vitest.config.ts.hbs:8`,
`Architecture/internal/ModelFirstContext.ts:421` and
`Architecture/internal/PackageShell.ts:293`. Change the sources first, in their
own PR, or every new package brings it back.

## S, delete, and look for what it was hiding

`packages/drivers/git/src/Git.ts:636`

```ts skip-type-checking
// Runs a NUL-separated, ref-free path listing (the working-tree queries) and
// classifies through the shared path. No ref is involved, so `unknownRef`
// cannot arise in practice ...
```

`workingDiffOptions` in the same file now passes a caller-supplied `head` into
both diffs, so a ref is involved. The arm it calls unreachable reports
`UnknownRefError` with `ref: "working tree"` (`refFailureArms(cwd, "working tree")`).
Verdict S, and a defect to fix: the error should name the head.

## S by attachment

`packages/drivers/git/src/Gitmodules.ts:396` describes rendering a `.gitmodules`
document and sits on `renderGitBoolean`. The sentence is true of another
function. S, note names that function. Move nothing.

## X, one family, not four rows

`packages/drivers/exiftool/src/Exiftool.models.ts:33`

```ts skip-type-checking
// shared driver boundary idiom; no in-family home; future foundation capability candidate.
// fallow-ignore-next-line code-duplication -- ... Exit: import it and delete this copy once a foundation capability package exports the idiom.
export const PositiveMilliseconds = S.Finite.check(
```

`PositiveMilliseconds` is declared in exiftool, ffmpeg and obs. The prose line is
X; the `fallow-ignore` line is a directive and stays. The directive already names
owner and exit, so the family takes its fix from there. The same prose sits above
four more clones in exiftool (`Exiftool.errors.ts:17` and `:81`,
`Exiftool.models.ts:13`, `Exiftool.service.ts:83`). Each clone's fix is a move to
a shared home; group by the thing to export, not by the sentence.

## X against a law

`packages/law-practice/domain/src/values/ClaimElement/Antecedent.policy.ts:1136`

```ts skip-type-checking
// Internal scan outcomes: -1 exhausts work, 0 has no candidate, 1 finds a possible basis. No result escapes policy.
```

It explains sentinel numbers that a `LiteralKit` would name. X, family
`numeric-sentinel-outcomes`; the same file's siblings and
`ClaimClauseRole` disposition codes join it.

## D, decision file first

`packages/drivers/freshbooks/src/Freshbooks.token.ts:356`

```ts skip-type-checking
// Once the single-use credential is sent, caller cancellation must wait for
// the response and its durable replacement. Permit acquisition stays
// interruptible, so cancelled queued callers never start an exchange.
```

Alternative: a fully interruptible exchange. Harm: a consumed refresh token with
no stored successor. Title: "A sent refresh-token exchange runs to persistence."
Write the file, commit it, then delete.

## H, home name

`packages/drivers/exiftool/src/Exiftool.service.ts:351` explains why the ceiling
is 128 MiB. The migration half ("the hand-rolled fold had no ceiling") is stale,
the reason for raising it is not. H, home `keep`: a name such as
`readTagsBatchOutputCeiling` says what the value is for but not why it is 128 MiB,
so a rename is not a home for this reason. Only the stale migration half is
removed; the reason stays under the ratchet until a test title or a typed
constant states it. A home must carry the reason, not just the topic.

## H, home test

`packages/drivers/exiftool/test/Exiftool.models.test.ts:329`: "exiftool 13.55
returns numeric-looking values as JSON numbers." Home `test`: it belongs in the
test title.

## Repeated H

"Unary by contract: no dual because input is unknown; options stays on
X.decodeEffect." appears 14 times (3 in exiftool, 11 in ffmpeg). Same verdict for all: H,
home `type`. One absorption PR, not 14.

## N, retained

`packages/drivers/freshbooks/test/Freshbooks.token.test.ts:239`: "TestClock
starts at zero; expires_in is 43200 seconds." above `expiresAt: 43_200_000`. The
arithmetic is not visible. N, home `name`.

## Empty block

`packages/foundation/capability/cli-kit/src/Cancelled.ts:75` is a block whose only
content is a comment. The ledger marks it protected (`only content of a block`). Ten such blocks exist in the enforced
zones. This one is an ignored setter: H. A `catch` that drops an error is X.

## Never deletable, though they look like prose

- `packages/drivers/cosmos/src/Cosmos.renderer.ts:7`: `/// <reference ...>`.
  Deleting it leaves the AST equal and can break the type check. Twelve exist.
- `.semgrep/first-party.ts:20`: `// ruleid: ...`. The semgrep test reads it.
- `packages/foundation/modeling/identity/src/packages.ts:289`:
  `// GENERATED LAB COMPOSERS END`. `create-package` edits between the markers.
- Line two of a two-line `// biome-ignore` reason.
- JSDoc on `const meta` in a `*.stories.tsx` file tagged `autodocs`: Storybook
  renders it.
