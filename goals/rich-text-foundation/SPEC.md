# Rich Text Foundation Spec

## Objective

The repo has one canonical rich-text pipeline as foundation substrate:
`@beep/md`'s AST as the portable document model, `@beep/lexical-schema`
(`packages/foundation/modeling/lexical`) as schema-first models of Lexical
serialized editor state with Md ↔ Lexical codecs, and `@beep/editor`
(`packages/foundation/ui-system/editor`) as the React editor kit — proven by
rendering a fixture assistant turn end-to-end in `apps/storybook`.

Provenance: graduated from `explorations/agent-chat-interface` (back-links:
[`BRIEF.md`](../../explorations/agent-chat-interface/BRIEF.md),
[`DECISIONS.md`](../../explorations/agent-chat-interface/DECISIONS.md),
[`MAP.md`](../../explorations/agent-chat-interface/MAP.md)). Proof-repo
reference (read-only): the effect-lexical-chat project (machine-local checkout)
(same effect catalog `4.0.0-beta.79`).

## Non-Goals

- No `@lobehub/editor` dependency (antd/`@lobehub/ui`/motion peers; Lexical
  0.42 pin + core patch). Design reference only.
- No collaboration (`@lexical/yjs`).
- No driver package for Lexical — only if `@lexical/headless`
  engine-wrapping appears later (mirror `drivers/konva` then).
- No PDF export.
- No persistence, rpc, or app wiring — that is `workspace-thread-domain`
  and `desktop-chat-surface`.
- No third parallel rich-text AST: the AI structured-output vocabulary and
  Lexical state convert to/from `@beep/md`'s AST via codecs.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards (`standards/ARCHITECTURE.md`;
   `standards/architecture/{01,02,07}-*.md`).
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/foundation/modeling/lexical` (**new**: `@beep/lexical-schema`).
- `packages/foundation/ui-system/editor` (**new**: `@beep/editor`).
- `apps/storybook` (fixture-turn rendering proof).
- Root workspace/export maps and `standards/repo-exports.catalog` shards as
  generation requires.

## Constraints

(From the exploration's rabbit holes.)

- `@beep/lexical-schema` has **zero runtime `lexical` imports** (proof
  pattern: the proof's `shared/lexical-schema.ts` imports only `effect`).
  `lexical` is a devDependency for dtslint type-conformance tests only.
- Run the **lossiness check** before locking the codec profile: Lexical
  format bitmask / alignment / indent have no markdown equivalent. Document
  the supported profile in the package README.
- Lexical ships monthly minor-breaking releases; serialized-state durability
  is app-managed. Persisted state must not couple to raw Lexical
  serialization — the schema package owns the contract.
- v1 node scope is locked: md-core (paragraph, heading, code, list, quote +
  inline marks) + `artifact-ref`; mention + slash-command are composer
  affordances, not persisted blocks.
- Placement precedents: `packages/foundation/modeling/{rdf,ontology,md}`
  (modeling hosts external formats); `@beep/ui` already declares `lexical`
  0.45 (ui-system hosts the React ecosystem).
- Follow beep conventions: `$I` identity annotations, lint gates,
  `bun run beep` quality gates, schema-first patterns.

### Schema conventions: nullish capture at the boundary

Worked sketch (non-normative, has known issues — this spec is normative):
`scratchpad/Lexical.schemas.ts`.

- **Nullish values become `O.Option` at decode, never in function logic.**
  Lexical's wire format is full of `null` / `undefined` / optional keys
  (`direction: null`, optional `textFormat`/`textStyle`/`$`). Capture them
  at the schema level with the Option-from combinators instead of writing
  null checks at the top of functions:
  - `S.optionalKey` → `S.OptionFromOptionalKey`
  - `S.NullOr` → `S.OptionFromNullOr`
  - `S.UndefinedOr` → `S.OptionFromUndefinedOr`
  - `S.NullishOr` → `S.OptionFromNullishOr`
  - combined optional + null forms → `S.OptionFromOptionalNullOr` etc.
  Downstream logic maps/matches `O.Option`; the encoded side keeps the
  exact Lexical wire shape (round-trip fidelity is non-negotiable).
- **Consequence: `Type` and `Encoded` diverge**, so the recursive knot
  must be typed by hand. For mutually recursive nodes (`children` via
  `S.suspend`), each class gets a companion `declare namespace` with
  hand-written `Type` and `Encoded` interfaces, and the suspend is typed
  `S.Codec<X.Type, X.Encoded>` referencing only those namespace types
  (referencing the classes makes the base expressions circular). Watch the
  classic mistakes: an `Encoded` interface must extend the parent's
  `Encoded` (not `Type`), and recursive fields must use
  `LexicalNode.Encoded` on the encoded side — e.g. `BaseNode.Type` has
  `"$": O.Option<Record<string, unknown>>` while `BaseNode.Encoded` has
  `"$"?: undefined | Record<string, unknown>`.
- **Tags only on concrete leaf classes.** `S.tag` literals cannot be
  overridden through `.extend` (intersecting `{type: "text"}` with
  `{type: "tab"}` is `never`), so Lexical's `TabNode extends TextNode`
  flattens to sibling classes over a shared untagged `TextBase`.

## Acceptance Criteria

- [ ] `@beep/lexical-schema` decodes the proof-fixture serialized editor
      state, and the md-core + artifact-ref node unions round-trip
      Md ↔ Lexical with the lossiness profile documented.
- [ ] `@beep/editor` exposes a read-only viewer and composer primitives
      (theme, node registration, markdown shortcuts) on `lexical` 0.45.
- [ ] A fixture assistant turn (md-core blocks) renders through
      `@beep/lexical-schema` → `@beep/editor` viewer in `apps/storybook`.
- [ ] dtslint conformance tests pin schema ↔ `lexical` types without a
      runtime dependency.
- [ ] Repo quality gates pass (`bun run beep yeet verify` or the packet's
      named subset).
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/rich-text-foundation/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/rich-text-foundation/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/rich-text-foundation` | Passes |
| Quality gates | `bun run beep yeet verify` | Green |
| Storybook proof | story rendering the fixture turn; evidence in `history/` | Renders |

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed named scope.
- Verification requires credentials, cost, destructive side effects, or policy
  approval not named in this spec.
- The same blocker repeats after reasonable investigation.

## Decision Log

Inherited from `explorations/agent-chat-interface/DECISIONS.md` (2026-06-12):
build custom kit (lobehub demoted to reference); foundation carve scoped to
`@beep/lexical-schema` + `@beep/editor` (the `@beep/md` move already landed in
PR #240); one canonical AST with codecs; v1 block scope.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
