# repo-crispening-orchestration — Sources & Provenance

- **Source exploration:** none. This packet was **directly authored**, not
  graduated from an `explorations/` packet — there is no
  `explorations/<slug>/research/SOURCES.md` to inherit from.
- **Provenance:** the packet's entire authoring corpus is in-repo:
  `research/prompt-2026-07-05.md` (the verbatim 2026-07-05 authoring prompt,
  itself grounded by an 8-agent read-only survey per its own §0) and
  `research/decisions-locked.md` (the D1–D5 / G1–G7 rulings from the
  follow-up `/grill-with-docs` session that closed the prompt's remaining
  leaf choices). `SPEC.md` is authored from both, per its own header.

## 1. Mined source corpus

Not applicable. No external corpus was mined for this packet — it is a
synthesis of existing repo doctrine (skills, standards, sibling goal
packets, and the enforcement/mechanization source files below), not a
literature or prior-art review. The "mining" that did happen is documented
as the 8-agent read-only survey referenced in `research/prompt-2026-07-05.md`
§0 and folded directly into that prompt's §1 (five settled decisions) and §2
(verified API corrections) — there is no separate mined-source table to
reproduce because the prompt already *is* that table's output.

## 2. Upstream repositories & licenses

None. This packet composes only first-party `@beep/*` packages and the
vendored `.repos/effect-v4` reference subtree already present in this
repository; it introduces no new upstream dependency, port, or clean-room
reimplementation.

## 3. External research sources

None — no external URLs, papers, or upstream repos were consulted in
authoring this packet. Every claim traces to an in-repo file cited by path
in `SPEC.md`, `research/decisions-locked.md`, or this file's §4.

## 4. In-repo capability references

The `@beep/*` bricks this packet composes or extends. Every path below was
re-verified with `rg`/`ls` on 2026-07-05, per the packet's own
"re-verify before citing" discipline (SPEC.md "Verified API Corrections").

| Brick | Path | Disposition |
| --- | --- | --- |
| `EffectSchema` factory | `packages/foundation/modeling/schema/src/EffectSchema.ts` | reuse — S1 targets call this as a factory, not a value |
| `PromiseSchema` value | `packages/foundation/modeling/schema/src/PromiseSchema.ts` | reuse — S1 targets pass this directly, no call |
| `Fn` function-contract schema | `packages/foundation/modeling/schema/src/Fn/Fn.schema.ts` | reuse — `SFV4-fn-schema` detector's proposed target |
| `LiteralKit` | `packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts` | reuse — S3 literal-domain/tagged-union targets |
| `MappedLiteralKit` | `packages/foundation/modeling/schema/src/MappedLiteralKit/MappedLiteralKit.schema.ts` | reuse — S3 reversible-code-map targets |
| `SchemaUtils.withCodecStatics` | `packages/foundation/modeling/schema/src/SchemaUtils/withCodecStatics.ts` | reuse — S4 colocation targets |
| `SchemaUtils.withConstructorDefaults` | `packages/foundation/modeling/schema/src/SchemaUtils/withConstructorDefaults.ts` | reuse — S2 `?? d` → constructor-default targets |
| `SchemaUtils.withKeyDefaults` | `packages/foundation/modeling/schema/src/SchemaUtils/withKeyDefaults.ts` | reuse — S2 missing-key-on-decode default targets |
| `SchemaUtils.withEncodeDefault` | `packages/foundation/modeling/schema/src/SchemaUtils/withEncodeDefault.ts` | reuse — S2 encode-side default targets |
| `SchemaUtils.toEquivalence` | `packages/foundation/modeling/schema/src/SchemaUtils/toEquivalence.ts` | reuse — S5 hand-written-equality targets |
| `O.getSomesStruct` | `packages/foundation/modeling/utils/src/Option.ts:102` | reuse — `SFV4-getsomes-struct` detector's proposed target; already used at `packages/drivers/firecrawl/src/Firecrawl.service.ts` (via the `OptionUtils` alias) and `packages/drivers/acp/src/AcpClient.service.ts` (via the `O` alias) |
| `P.chainRefinements` | `packages/foundation/modeling/utils/src/Predicate.ts:203-335` | reuse — S3 no-`as` narrowing targets; `@beep/utils`-added, not in `effect-v4` |
| `$RepoUtilsId` / `$SchemaId` identity composers | `packages/foundation/modeling/identity/src/packages.ts:200,354` | reuse — every schema/error this packet's own enforcement code adds must use these, never a bare string identifier |
| `SchemaFirst.ts` lint enforcer | `packages/tooling/tool/cli/src/commands/Lint/SchemaFirst.ts` | extend — hosts the existing `SchemaFirstPolicyRuleId` LiteralKit (`:113-123`), `schemaFirstLintHasFailures` (`:1464-1477`), and the `lintSchemaFirstCommand` (`:1531-1539`, registers `bun run beep lint schema-first`); the four novel cards and the policy-ratchet consult land here |
| `QualityIssueIndex.ts` Yeet parsing | `packages/tooling/tool/cli/src/commands/Yeet/internal/QualityIssueIndex.ts` | extend — routes `[schema-first:issue]` findings (including the four novel ruleIds) into Yeet's `schema-first-policy` issue category |
| `TSMorphService` | `packages/tooling/library/repo-utils/src/TSMorph/TSMorph.service.ts` | extend (new callers) — `updateSourceFile` (`:364-368`, live impl `:1273-1317`) is the P1.5 codemod entry point; today's only consumers are read-only `inspectProject` callers at `packages/tooling/tool/cli/src/commands/Laws/DualArity.ts:11,1278,1297` and `Laws/EffectFn.ts:10,393-394`; no `.updateSourceFile(` caller exists yet anywhere in the repo (verified via repo-wide `rg`) |
| `schema-first.inventory.jsonc` | `standards/schema-first.inventory.jsonc` | extend — the tracked baseline+exception artifact the P1 discoveries and Exception Ledger populate |
| `.claude/skills/effect-first-development/SKILL.md` Laws 20 & 47 | lines 99, 126 | extend (amend) — both currently endorse `R.getSomes({...})` unconditionally; D5/G6 amend them to prefer `O.getSomesStruct` for heterogeneous struct-spreads |
| `.claude/skills/schema-first-development/SKILL.md` Law 20/47 mirror | line 96 | extend (amend) — same `R.getSomes({...})` endorsement, amended alongside the primary Laws |
| `standards/architecture/DECISIONS.md` | repo root | extend — receives the one consolidated G6 ADR entry |
| `standards/architecture/README.md` migration-bucket rule | lines 48-52 | reference — the "Cleanup-On-Touch is scoped to the boundary being edited" rule this packet's family-scoped waves must stay inside of |
| `.claude/skills/crispen/SKILL.md` | repo root | reference — the crispening ladder (8 rungs) and "when NOT to crispen" list this packet's Non-Goals fences codify |

## 5. Cross-links & provenance

- **Sibling packets (cross-link, never supersede — D1):**
  - `goals/schema-first-v4-capabilities/SPEC.md` — owns the nine existing
    `SFV4-*` rule cards this packet reuses (`schema-first-inventory`,
    `literal-kit-const-assertion`, `SFV4-defaults`, `SFV4-static-api`,
    `SFV4-precision-audit`, `SFV4-arbitrary-tests`, `SFV4-equivalence`,
    `SFV4-numeric-domain`, `SFV4-boundary-codec`).
  - `goals/schema-first-zero-actionables/SPEC.md` — owns the
    baseline-to-zero-actionables method and the detector-first
    false-positive-audit discipline this packet applies per family (§5.5).
  - `goals/effect-native-migration/SPEC.md` and its
    `ops/progress.json` — owns native-collection migration (fence 7); this
    packet's own `ops/progress.json` mirrors its resumable per-package model
    (see `_note` field for the shape mapping).
  - `goals/beep-schema-topology/SPEC.md` — owns `@beep/schema`'s canonical
    package topology; this packet's waves must keep
    `bun run beep lint schema-topology` green and never restructure that
    package's layout.
- **This packet's own decision log:** `SPEC.md` (normative, Source
  Hierarchy #4), `research/decisions-locked.md` (locked D1–D5/G1–G7,
  Source Hierarchy #3 — outranks `SPEC.md` on conflict), and
  `research/prompt-2026-07-05.md` (Source Hierarchy #1, the original
  authoring prompt archived verbatim).
- **No `codex review` or upstream synthesis section exists for this
  packet** — it was authored in a single Claude Code session from the
  prompt + grill, not reviewed by a separate agent prior to this packet's
  first commit.
