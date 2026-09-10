# Instance

- id: `document-violation-flags`
- file:line: `apps/professional-desktop/src/chat/ui/ComposerPolicy.ts:151`
- symbol: `DocumentViolationFlags`
- members: `complexity`, `footnote`, `htmlProjection`, `scalar`, `url`
- evidence classes:
  - E1 at `packages/foundation/modeling/md/src/Md.safe.ts:739-747` — a
    document over the bounded-node ceiling returns only the complexity
    violation; otherwise the detailed scanners run, so complexity never
    coexists with a detailed category in production output.
  - E2 at `apps/professional-desktop/src/chat/ui/ComposerPolicy.ts:192-217`
    — the reason matcher gives complexity a first, exclusive arm, then matches
    combinations of the independent detailed categories.

# Current shape

`documentViolationFlags` folds a violation list into five booleans. Four are
independent category-presence facts. Moving `main` added `complexity`, whose
upstream safety scan is fail-closed: it returns the singleton complexity
violation instead of traversing the detailed scanners. The flat class can
represent complexity together with any detailed category even though the
production writer never creates those combinations.

# Cardinality gap

Five booleans represent 32 combinations. Seventeen are legal: one complexity
case and all 16 combinations of the four detailed facts. Complexity combined
with any detailed flag accounts for the 15 impossible states.

# Target schema

Replace the flat class with a private named tagged union:
`complexity | detailed({ footnote, htmlProjection, scalar, url })`. The
detailed payload intentionally retains four independent booleans; their full
power set is legal and must not be collapsed. Classify an input list as
complexity when any `DocumentComplexity` member is present, preserving the
current first-arm precedence even for synthetic callers, otherwise fold the
detailed payload exactly as today.

# Migration inventory

- `ComposerPolicy.ts:151-170` — replace `DocumentViolationFlags` and its
  five-boolean empty value with the named tagged owner and a detailed-case
  empty payload.
- `ComposerPolicy.ts:178-190` — classify complexity once, then fold only the
  detailed case; `RawNode` remains the no-flag fallback.
- `ComposerPolicy.ts:192-217` — match the outer case exhaustively and retain
  the exact existing priority table inside `detailed`.
- `apps/professional-desktop/test/composer-policy.test.ts` — preserve every
  refusal string and add a synthetic complexity-plus-detail list proving the
  existing complexity-first result.
- `packages/foundation/modeling/md/src/Md.safe.ts:739-747` is evidence only;
  do not move the safety boundary or change its fail-closed scan in this PR.

# Guard-deletion accounting

Delete the top-level `complexity: boolean`, the complexity-first object
pattern guard, and all representable complexity-plus-detail combinations.
Retain the detailed category match table because those facts are independent
and its copy precedence is intentional.

# Encoded-side impact

None. The state is private, derived for refusal copy, and never persisted or
encoded. `DocumentSafetyViolation`, Markdown wire shapes, and refusal strings
remain unchanged.

# Test impact

Table-test complexity, raw-node fallback, each detailed category, the existing
multi-category messages, and synthetic complexity-plus-detail precedence. Keep
tests importing package source through `@beep/*` aliases. Run the focused
composer policy suite and the full professional-desktop package verification.

# Risk and sequencing

Tier 1D. The primary risk is accidentally treating all five facts as mutually
exclusive or changing user-visible refusal precedence. Preserve the bounded
Markdown scan and the four-field detailed power set exactly.
