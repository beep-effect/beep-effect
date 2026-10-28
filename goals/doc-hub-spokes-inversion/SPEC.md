# Doc Hub and Spokes Inversion Spec

## Objective

Make `@beep/md` a notation-free semantic document hub named `@beep/doc`, and make every
notation package a spoke that depends on it. Today lexical and pandoc already point into the
hub; markdown and html point the other way, and the hub carries a 1,800-line Markdown
string writer that the markdown spoke's `Markdown.stringify` supersedes. After this goal the
hub holds the model, behaviors, the trust refinement and the URL policy, and nothing that
knows a notation.

Graduated from [`explorations/doc-hub-spokes`](../../explorations/doc-hub-spokes/README.md)
on 2026-10-28 (`BRIEF.md` section C; `DECISIONS.md` D-04, D-10). Amends
`goals/effected-promotion` D-02 and D-50, whose recorded reversal path ("fold later; move
the bridge above `@beep/md`") this goal takes as a rule.

## Non-Goals

- Merging `@beep/markdown` into `@beep/doc`, or converging the two trees on one AST
  (effected-promotion D-02 holds; the judge scores stand).
- Changing the `Doc.Document` persisted JSON encoding; the rename is a package and
  namespace rename, not a schema change.
- Adding a positioned HTML parser (`html-spoke-parser`, gated on the POC).
- Any behaviour change in lexical or pandoc projections beyond import paths.
- Re-running effected-promotion's bridge or writer evidence beyond what the writer
  projection needs to prove parity.

## Source Hierarchy

1. The operator rulings in `explorations/doc-hub-spokes/DECISIONS.md` (D-04, D-08, D-10).
2. `AGENTS.md`, `CLAUDE.md`, required skills (`effect-first-development`,
   `schema-first-development`, `yeet`, `closeout`, `reflect`).
3. `standards/ARCHITECTURE.md`, `standards/architecture/07-non-slice-families.md`,
   `goals/effected-promotion/SPEC.md` (D-02, D-38..D-52).
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. `research/SOURCES.md`, `ops/`, `history/`.

## Target Surfaces

- `packages/foundation/modeling/md` renamed to `packages/foundation/modeling/doc`,
  package `@beep/doc`, namespace `Doc` (D-04), via the sanctioned path (`create-package`
  for the new identity, delete the old; never `mkdir` or copy by hand). About 560 import
  sites across apps and packages rewritten in one mechanical commit.
- `packages/foundation/modeling/markdown`: gains `Md.syntax`/`Md.parse` (as
  `@beep/markdown/Doc.syntax` and `Doc.parse`, or names the package's conventions choose)
  and a `Doc.Document -> Root` projection; `Markdown.stringify` becomes the one Markdown
  writer.
- `packages/foundation/modeling/html`: gains `renderSafeHtml` / `Document.toHtml` as a
  projection from `Doc`.
- `@beep/doc`: `Md.render.ts` deleted; `SafeDocument` trimmed to hub-native rules (D-10);
  the import-boundary test flips to assert the hub imports no spoke.
- `goals/effected-promotion/SPEC.md`: one Decision Log row amending D-02 and D-50 (written
  against `@beep/doc`), and the D-50 churn threshold retired as moot.
- `scratchpad/temp/*.ts`: imports rewired as the demonstration.
- Changesets: a major changeset for the public rename.

## Constraints

- **Phase 0 is the rename**, before any edge flip, so lexical, pandoc, the scratch program
  and the POC lane churn imports once.
- **One Markdown writer.** The `Doc.Document -> Root` projection is validated against
  `data/conformance/bridge-corpus.json` and the 2d-3 writer differential
  (`goals/effected-promotion/research/writer-differential-w2d3.md`) before `Md.render` is
  deleted; the ledger's writer column must not gain a newly divergent row, and the 79
  attributed divergences keep their attributions.
- **Direction of dependency**: after this goal, `@beep/doc` imports no spoke; every spoke
  imports `@beep/doc`. A test holds it, as `test/Md.import-boundary.test.ts` holds the
  current rule.
- **`SafeDocument` keeps hub-native rules only (D-10)**: raw-node rejection, URL policy,
  footnote uniqueness, string safety. Heading order and other conformance belong to the
  html spoke at projection time. Callers that relied on the html-proven guarantee
  (`apps/professional-desktop/src/chat/ui/ComposerPolicy.ts`,
  `packages/agents/client/src/Chat.atoms.ts`) are re-pointed at the spoke's proof.
- **Encoded JSON unchanged**: `Doc.Document` decodes every persisted `Md.Document`; a
  round-trip test over existing fixtures proves it.
- **Turbo cache**: a manifest edit drifts every package task; request a cache baseline per
  the repo's `cache baseline --request` recipe, and add any new `Effect.fn` spans to the
  observability catalog.
- Effect v4, schema-first, `effect/*` leaf imports, JSDoc law, `@beep/*` test imports.

## Acceptance Criteria

- [ ] `@beep/doc` exists with namespace `Doc`; `@beep/md` is gone from the workspace and
      recorded in `standards/changesets.retired-packages.json`; all import sites rewritten;
      `bun run beep quality package-verify` passes for `@beep/doc`, `@beep/markdown`,
      `@beep/html`, `@beep/lexical-schema`, `@beep/pandoc-ast`.
- [ ] `Doc.syntax` / `Doc.parse` live in `@beep/markdown`; the bridge corpus test passes
      unchanged.
- [ ] `Md.render.ts` deleted; the `Doc.Document -> Root` projection plus `Markdown.stringify`
      reproduces the writer differential with no newly divergent row.
- [ ] `renderSafeHtml` / `Document.toHtml` live in `@beep/html`; the scratch program and
      every product caller use them from there.
- [ ] Import-boundary test asserts the hub imports no spoke; every spoke depends on the hub.
- [ ] `SafeDocument` trimmed per D-10; callers re-pointed; a round-trip test over persisted
      fixtures proves the encoded JSON is unchanged.
- [ ] effected-promotion Decision Log row amending D-02 and D-50 landed in the same PR.
- [ ] Major changeset; cache baseline requested; observability catalog updated if spans
      were added.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/doc-hub-spokes-inversion/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/doc-hub-spokes-inversion/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/doc-hub-spokes-inversion` | Passes |
| Package verify | `bun run beep quality package-verify @beep/doc` (and the four spokes) | Passes |
| Import boundary | the hub's import-boundary test | Passes with the inverted assertion |
| Writer parity | bridge-corpus snapshot and writer differential | No newly divergent row |
| Old name retired | `rg -n '@beep/md[/"]' packages apps scratchpad` | No hits |
| Reflection | `bun run beep lint reflection-artifacts` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each in the Decision Log.

## Decision Log

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-10-28 | Inherits exploration D-04 (`@beep/doc`, namespace `Doc`), D-08 (model-path-first finding address, which the hub's source-map contract must support), D-10 (`SafeDocument` hub-native only). | Graduation seeds the contract from the exploration's rulings. | Reopen the exploration at decompose and amend. |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
