# Round 3 fix report — docgen class members (jsonc / yaml / glob)

- `fixer`: jsdoc-annotation-specialist
- `round`: 3
- `owned`:
  - `scratchpad/jsonc/Jsonc.ts`
  - `scratchpad/jsonc/JsoncNode.ts`
  - `scratchpad/jsonc/JsoncFingerprint.ts`
  - `scratchpad/jsonc/JsoncModifier.ts`
  - `scratchpad/jsonc/JsoncFormatter.ts`
  - `scratchpad/jsonc/JsoncVisitor.ts`
  - `scratchpad/jsonc/JsoncEdit.ts`
  - `scratchpad/yaml/Yaml.ts`
  - `scratchpad/yaml/YamlDiagnostic.ts`
  - `scratchpad/glob/GlobSet.ts`
- `status`: flagged members documented (lead + titled Example + `@since 0.0.0`)

Runtime behavior was not changed. JSDoc only.

Docgen `checkClass` requires a description and a titled `**Example**` on class
methods, instance getters, and non-`private`-keyword properties. `@since` is
not enforced on members; it was added on flagged members as requested.
`parseMethod` does not skip `#private` methods, and `parseProperties` only
filters the `private` keyword, so `#` fields on `GlobSet` were in the fail set.

## Changed files

jsonc:

- `scratchpad/jsonc/Jsonc.ts`
- `scratchpad/jsonc/JsoncNode.ts`
- `scratchpad/jsonc/JsoncFingerprint.ts`
- `scratchpad/jsonc/JsoncModifier.ts`
- `scratchpad/jsonc/JsoncFormatter.ts`
- `scratchpad/jsonc/JsoncVisitor.ts`
- `scratchpad/jsonc/JsoncEdit.ts`

yaml:

- `scratchpad/yaml/Yaml.ts`
- `scratchpad/yaml/YamlDiagnostic.ts`

glob:

- `scratchpad/glob/GlobSet.ts`

## Members documented

Each flagged member now has a one-paragraph lead, one titled
`**Example** (Title)` with a single `ts` fence importing
`@beep/scratchpad/<kit>`, and `@since 0.0.0`. Existing `@param` / `@returns` /
`@throws` / `@see` tags were kept and ordered after the Example.

### `Jsonc.ts` — 8 findings / 6 members

Missing description + example (`override get message`):

- `JsoncParseError.message`
- `JsoncStringifyError.message`

Missing example:

- `Jsonc.equals`
- `Jsonc.equalsValue`
- `Jsonc.fromString`
- `Jsonc.schema`

Static `Effect.fn` / `readonly` properties (`parse`, `parseTree`, `stringify`,
`JsoncFromString`) are not parsed as methods and were left as-is.

### `JsoncNode.ts` — 4 members

- `find`
- `findAtOffset`
- `pathAt`
- `toValue`

### `JsoncFingerprint.ts` — 3 findings / 2 members

- `JsoncCanonicalizeError.message` (missing description + example)
- `JsoncFingerprint.normalizeEol` (missing example)

`canonicalize` / `hash` / `hashText` are static properties (not parsed). Hash
stills require `Crypto.Crypto` and stay composition-only in the class docs.

### `JsoncModifier.ts` — 2 findings / 1 member

- `JsoncModificationError.message`

`JsoncModifier.modify` is a static `Effect.fn` property and was not flagged.

### `JsoncFormatter.ts` — 2 members

- `format`
- `formatToString`

### `JsoncVisitor.ts` — 1 member

- `visit`

### `JsoncEdit.ts` — 1 member

- `applyAll`

### `Yaml.ts` — 10 findings / 8 members

Missing description + example:

- `YamlParseError.message`
- `YamlStringifyError.message`

Missing example:

- `stripComments`
- `equals`
- `equalsValue`
- `fromString`
- `allFromString`
- `schema`

### `YamlDiagnostic.ts` — 2 members

- `isFatal`
- `fromRaw`

### `GlobSet.ts` — 8 findings / 4 members

`#` private fields/methods are visible to docgen (no `private` keyword filter
on `#`):

- `#classified`
- `#literalSet`
- `#classify`
- `#literals`

Private-member Examples go through `GlobSet.compileResult` plus public
`literals` / `wildcards` / `excludes` / `matches`. Public members already had
titled Examples.

## Residual risk

- This subagent has no shell tool, so live `bun run docgen:local` and package
  `check` were not executed here. Re-run the commands below on the host.
- `{@link}` targets are described but not typechecked by docgen.
- `JsoncFingerprint.hash` / `hashText` still cannot show a digest without a
  `Crypto` layer (not in scratchpad `examplesCompilerOptions.paths`).
- Private `GlobSet` members are not callable from Examples; fences prove the
  public compile/match path that fills those caches.

## Commands to run

```bash
zsh -ic 'bun run --cwd scratchpad docgen --include "jsonc/Jsonc.ts,jsonc/JsoncNode.ts,jsonc/JsoncFingerprint.ts,jsonc/JsoncModifier.ts,jsonc/JsoncFormatter.ts,jsonc/JsoncVisitor.ts,jsonc/JsoncEdit.ts,yaml/Yaml.ts,yaml/YamlDiagnostic.ts,glob/GlobSet.ts"'
zsh -ic 'bun run docgen:local -- --package @beep/scratchpad'
zsh -ic 'bunx tsgo -p scratchpad/tsconfig.json --noEmit --pretty false'
```
