# Agent Context Lifting and Grep Audits

## Agent context lifting

Documentation improves generated code only when the relevant parts reach the
agent. Lift selectively instead of copying an entire block without purpose.

### Generating a call site

Lift the signature, lead, When-to-use, Details, Gotchas, and applicable
`@deprecated`, `@effects`, `@precondition`, `@invariant`, `@throws`, and `@see`
content. Examples are useful when they demonstrate the exact composition at hand;
category and since metadata usually are not.

### Generating an implementation

Lift the signature, lead, Details, Gotchas, `@postcondition`, `@invariant`,
`@throws`, and `@effects`. These describe intent, preserved state, defects, and
required side effects.

### Choosing between symbols

Lift When-to-use, described `@see` relationships, release-stage tags, and
deprecation guidance. Prefer stable, non-deprecated APIs whose documented use case
matches the task.

`@remarks` and `@example` are retired across the repo. Use Details and Gotchas
for supporting prose and titled Example sections for examples. An untouched file
is not exempt from the zero-legacy rule.

## Grep audits

These commands are heuristics for focusing review. The inventory and docgen gates
remain authoritative.

### Export ownership and required metadata

```bash
rg -n '^export (const|function|class|interface|type|namespace)' --type ts
rg -n '@category|@since' --type ts
```

Classify owning exports before judging Example presence: value-level exports need
an Example; pure type-level exports need prose only.

### Retired carriers

```bash
rg -n '@remarks\b|@example\b' --type ts
rg -n '^\s*\* \*\*Example\*\*' --type ts
```

Treat matches as violations: move `@remarks` into Details or Gotchas and
convert `@example` to a titled Example section. Establish export ownership and
coordinate existing documentation owners before changing unrelated files. For
generated documentation, fix the owning generator and regenerate its output;
do not invent a residual exception.

### Section shape

```bash
rg -n '^\s*\* \*\*(When to use|Details|Gotchas|Example)\*\*' --type ts
rg -n '^\s*\* `{3}ts\s*$' --type ts
```

Review each matched block for canonical order, non-empty content, unique Example
titles, exactly one fence per Example, and no loose `ts` fence. Confirm When-to-use
opens with `Use to`, `Use when`, `Use as`, or `Use with`.

### TSDoc violations

```bash
rg -n '@(param|returns|throws)\s+\{' --type ts
rg -n '@template\b|@module\b|@returns\s+-\s|@throws\s+-\s' --type ts
```

### Described links

```bash
rg -n '@see\b' --type ts
rg -n '@deprecated\b' --type ts
```

Inspect every `@see` for a purpose phrase and every deprecation for a linked
replacement plus migration guidance. Link-target resolution is not yet automated.

### Import and Example safety

```bash
rg -n 'import \{ (Schema|Array|Option|Predicate|Record) \}' --type ts
rg -n 'from "@effect/schema"|: any| as unknown as |declare ' --type ts
rg -n 'Effect\.gen\(function\*\s*\(\)\s*\{' --type ts
```

Namespace imports are required for helper modules. Inspect generator matches for
empty bodies and all safety matches specifically within Example fences.

### Schema annotation gaps

```bash
rg -l 'extends S\.Class' --type ts | xargs rg -L 'annote'
rg -l 'extends S\.TaggedError' --type ts | xargs rg -L 'annote'
rg -n 'annoteSchema|\.annotate\(' --type ts
```

Use `references/annotation-patterns.md` to judge the appropriate annotation form.
