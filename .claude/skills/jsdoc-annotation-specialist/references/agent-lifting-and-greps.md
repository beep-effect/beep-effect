# Agent Context Lifting Rules and Grep Verification Commands

## Contents

- [Agent Context Lifting Rules](#agent-context-lifting-rules)
- [Grep Verification Commands](#grep-verification-commands)

## Agent Context Lifting Rules

When a downstream agent loads a symbol's documentation as context for code
generation, surface tags selectively based on what the agent is doing:

### When generating a call site for a symbol

Lift these into the prompt:

- **Always**: `@deprecated` (with migration target) — block use of deprecated APIs
- **Always**: The TS signature
- **`@effects`** — so the agent reasons about side effects in surrounding code
- **`@precondition`** — so the agent verifies preconditions at the call site
- **`@invariant`** — so the agent knows what state is preserved
- **`@throws`** — so the agent handles defects
- **`@remarks`** — for non-obvious semantics

Skip:

- `@param` / `@returns` when they restate the signature (the agent can read
  the signature)
- `@example` (the agent generates its own usage)
- `@since` / `@category` (irrelevant to call-site generation)

### When generating an implementation for a symbol

Lift:

- The TS signature
- `@postcondition` — what the implementation must guarantee
- `@invariant` — what the implementation must preserve
- `@remarks` — describing intent and complexity
- `@throws` — defects the implementation may produce
- `@effects` — side effects the implementation must perform

### When choosing between candidate symbols

Lift:

- `@public` / `@beta` / `@alpha` / `@experimental` — prefer stable APIs
- `@deprecated` — never pick deprecated symbols when alternatives exist
- `@remarks` — to disambiguate similar APIs

This is the most direct lever for using documentation to improve agent output
quality. Generated tags that don't end up in agent context are write-only
information.

## Grep Verification Commands

Use these to audit a file or directory for compliance gaps:

### Required-tag presence

```bash
# Exports missing JSDoc (heuristic — check lines above each match)
rg "^export (const|function|class|interface|type)" --type ts

# Files with @example but missing @since
rg "@example" --type ts -l | xargs rg -L "@since"

# Files with @example but missing @category
rg "@example" --type ts -l | xargs rg -L "@category"
```

### TSDoc grammar violations

```bash
# Type braces in @param / @returns / @throws (TSDoc violation)
rg '@(param|returns|throws)\s+\{' --type ts

# @template instead of @typeParam
rg '@template\b' --type ts

# @returns with hyphen separator
rg '@returns\s+-\s' --type ts

# @module instead of @packageDocumentation
rg '@module\b' --type ts | rg -v '@packageDocumentation'
```

### Conditional tag quality

```bash
# @deprecated without {@link} migration target
rg -B0 -A2 '@deprecated' --type ts | rg -v '\{@link'

# Empty Effect.gen bodies in examples (heuristic)
rg -A1 'Effect\.gen\(function\*\s*\(\)\s*\{' --type ts | rg -B1 '^\s*\}\)'
```

### Import alias compliance

```bash
# Wrong Schema import alias
rg 'import \{ Schema \}' --type ts
rg 'from "@effect/schema"' --type ts

# Wrong Array / Option / Predicate / Record imports
rg 'import \{ (Array|Option|Predicate|Record) \}' --type ts
```

### Schema annotation gaps

```bash
# S.Class without $I.annote
rg "extends S\.Class" --type ts -l | xargs rg -L "annote"

# TaggedErrorClass without $I.annote
rg "extends TaggedErrorClass" --type ts -l | xargs rg -L "annote"
```

### Forbidden patterns

```bash
# Uses any type in examples or signatures
rg ': any' --type ts

# Type assertions
rg ' as unknown as ' --type ts
rg ' as [A-Z]\w+' --type ts
```

### Internal symbol leakage

```bash
# @internal symbols re-exported from package index (potential leak)
rg -l '@internal' --type ts | while read f; do
  base=$(basename "$f" .ts)
  if grep -q "$base" "$(dirname "$f")/../index.ts" 2>/dev/null; then
    echo "Potential @internal leak: $f"
  fi
done
```
