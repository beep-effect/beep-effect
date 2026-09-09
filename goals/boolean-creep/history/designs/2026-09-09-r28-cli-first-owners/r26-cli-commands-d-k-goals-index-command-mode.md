# Instance

- id: `r26-cli-commands-d-k-goals-index-command-mode`
- exact source SHA: `3330f9881a50c96d3f2ec0fcad76f0f7a09027e4`
- corpus source SHA: `52fcc8d1353db9481ef9edb6cc9619500f95568d`
- file:line: `packages/tooling/tool/cli/src/commands/Goals/PortfolioIndex.ts:321`
- symbol: `goalsIndexCommand.mode`
- members: `write`, `check`
- evidence:
  - E2 at `PortfolioIndex.ts:278-299` — combined true is rejected before index
    generation or file I/O; the remaining rows dispatch write, check, or print.

`PortfolioIndex.ts:253-260,321-326` establishes ownership: the named Command
carrier parses both default-false flags together and passes them to its handler.
That ownership fact is not a separate E3 claim; qualification rests on the
exclusive read and explicit rejection.

The old `goals-portfolio-index-mode` ID named the withdrawn function-parameter
record. This r26 ID names the surviving Command declaration and must remain
distinct. Formal P3 remains pending.

# Current shape

Effect CLI exposes independent `--write` and `--check` Boolean flags, both
defaulting to false. The named `goalsIndexCommand` passes them into
`runGoalsIndex`, which first rejects combined true with exact console and
reported-exit messages. It then:

- writes the generated ignored `goals/INDEX.md` and logs its path for write;
- generates expected content and compares an existing local copy for check;
- prints generated content for the default no-flag row.

Check deliberately accepts an absent local index. It fails only when a present
copy differs. The rendered index bytes, invalid-manifest visibility, stable
sorting, and write/check/print output are independent of the representation
chosen for the resolved mode.

# Cardinality gap

Two flags represent four combinations. Exactly three are valid command modes:

| Write | Check | Mode |
| --- | --- | --- |
| false | false | `print` |
| true | false | `write` |
| false | true | `check` |

Combined true remains a parsed input but is not a legal resolved mode. It fails
before `buildPortfolioIndexContent`, `writePortfolioIndex`, index reads/writes,
or generated content reaches stdout. The resulting 4/3 cardinality is exact.

Do not include the Option recording whether `INDEX.md` exists in this carrier.
That fact is observed only inside check mode and deliberately distinguishes
absent-success, matching-success, and drift-failure without changing the
command mode.

# Target schema

Add one private LiteralKit in `PortfolioIndex.ts`:

```ts
const GoalsIndexMode = LiteralKit(["print", "write", "check"]).pipe(
  $I.annoteSchema("GoalsIndexMode", {
    description: "Validated output mode for the goals portfolio index command.",
  })
);
type GoalsIndexMode = typeof GoalsIndexMode.Type;
```

Resolve raw flags once at the Command boundary. Preserve the combined-true
failure and exact error order, then pass one `GoalsIndexMode` to
`runGoalsIndex`. Match it exhaustively. Do not add a tagged union because none
of the three modes carries payload, and do not move local-index presence into
the literal.

The raw flags remain at the Effect CLI parser so existing syntax/defaults and
the intentional validation failure survive. The literal is the first validated
internal value.

# Migration inventory

- `PortfolioIndex.ts:30-50` — retain `PORTFOLIO_INDEX_PATH`, ignored projection
  semantics, and existing identity/annotation infrastructure; import/reuse the
  repository LiteralKit owner.
- `PortfolioIndex.ts:100-170` — preserve exact Markdown generation, ordering,
  headings, counts, links, status grouping, invalid packet copy, and terminal
  newline.
- `PortfolioIndex.ts:193-229` — preserve manifest reading/decoding, invalid
  accumulation, README mission fallback, phase counts, and deterministic sort.
- `PortfolioIndex.ts:247-251` — preserve write generation before the contained
  overwrite and return the exact generated content.
- `PortfolioIndex.ts:253-260` — keep both public flags, their names,
  default-false values, and descriptions.
- `PortfolioIndex.ts:262-276` — keep absent index acceptance, byte comparison,
  drift error, OK copy, and reported-exit behavior.
- `PortfolioIndex.ts:278-299` — change `runGoalsIndex` to accept
  `GoalsIndexMode`; remove Boolean branches and exhaustively match print/write/
  check while retaining the existing operations and log order.
- `PortfolioIndex.ts:321-326` — resolve `{write,check}` immediately. Combined
  true must emit the current console error and reported exit before calling the
  mode runner; all other inputs produce exactly one literal.
- `Goals.command.ts:18,40,55` and the Goals barrel — retain command composition,
  help syntax `[--write | --check]`, and export name.

No persisted schema or public TypeScript function accepts the new literal. The
withdrawn `runGoalsIndex` flag object was private and is replaced rather than
revived as a canonical inventory owner.

# Guard-deletion accounting

Delete `runGoalsIndex`'s `{write:boolean,check:boolean}` parameter, its
combined-true check, `if (write)`, and `if (check)` branches. The Command
boundary retains one combined-flag validation solely to preserve raw CLI error
behavior, then returns one LiteralKit member. The runner consumes only the
literal through an exhaustive match.

Do not return the original booleans with the mode, create `isWrite`/`isCheck`
helpers, or derive local-index presence outside the check arm.

# Encoded-side impact

None. The external contract remains:

- no flags prints the generated Markdown;
- `--write` overwrites the ignored projection;
- `--check` accepts absence/match and fails on drift;
- `--write --check` parses, prints
  `[goals:index] --write and --check are mutually exclusive.`, and reports
  `goals index: --write and --check are mutually exclusive.`.

Flag defaults, help, exit behavior, filesystem containment, INDEX bytes, and
stdout/stderr ordering remain unchanged. The literal is transient and never
encoded.

# Test impact

Extend the `goals index command` block at
`packages/tooling/tool/cli/test/goals-bootstrap-plan.test.ts:422-441`:

- assert default print succeeds without writing the local projection;
- retain absent-check, write, matching-check, and drift-check behavior;
- add combined `--write --check`, assert the reported exit and exact messages,
  and prove the local file is neither generated nor overwritten;
- characterize the three resolved modes through actual CLI arguments rather
  than exposing the private literal to tests.

Retain deterministic byte-generation tests, manifest capability parity,
Codex-findings byte identity, and Yeet's derived-index guard. No browser QA is
needed for this CLI-only change.

# Risk and sequencing

Tier 1 internal command migration. The main risk is generating content before
rejecting combined flags or changing check's intentional absent-file success.
Keep validation at the command boundary and the existing mode-arm operations.

Run focused Goals CLI tests and full package verification during implementation.
Formal P3 must confirm 4/3,
exact errors, and no index I/O on the invalid row.

# Qualification recommendation

Promote `r26-cli-commands-d-k-goals-index-command-mode` with members
`write,check`, cardinality 4/3, `storage=stored`, `exposure=internal`,
`targetShape=literalkit`, and Tier 1. Keep the withdrawn anonymous-function ID
only in history.
