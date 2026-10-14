### sol-3-1
- file: scratchpad/effected/yaml/internal/stringifier.ts:1591
- class: bug   severity: required
- standard: D10 formatter fidelity; D11; section 14, verified upstream bug.   evidence: A read-only Bun probe against commit `c3fc60bdbfd5574dc69623d132dced0a552a586a` and the pinned oracle parsed `"{a: [1, # inner\n 2]}\n"` through `YamlDocument.parse`, then called the document’s default `stringify()`. Both emitted `"{a: [   1, # inner   2 ]}\n"`. Reparsing returned `Failure` in both implementations; the independent `yaml` parser reported `BAD_INDENT` and `MISSING_CHAR`. The sibling flow-sequence paths at lines 1968 and 1979 also flatten rendered child lines with `.join(" ")`.
- failure: A nested flow collection can render across lines because it contains comments, while its enclosing flow collection flattens those lines into one. The inner `#` then consumes subsequent values and closing delimiters. Default document stringification turns valid YAML into invalid YAML.
- fix: Preserve multiline child renderings in flow maps and sequences. Promote the enclosing collection to multiline layout when any rendered child spans multiple lines, and append commas and parent-level trailing comments after the child’s final line. Add nested map/sequence comment round-trip regressions and record the verified upstream-bug deviation.

### sol-3-2
- file: scratchpad/effected/yaml/internal/stringifier.ts:1592
- class: bug   severity: required
- standard: D10 formatter fidelity; D11; section 14, verified upstream bug.   evidence: A read-only Bun probe parsed `"x: &a key\ny: {*a : val}\n"` successfully in both the port and pinned oracle, yielding `{ x: "key", y: { key: "val" } }`. Default document stringification emitted `"x: &a key\ny: {*a: val}\n"` in both. The independent parser rejected the output with `MISSING_CHAR`. The comment-bearing flow-map branch at line 1581 emits the same delimiter-tight form. The block-map branch already handles alias-key separation at lines 1710–1718.
- failure: Flow mappings omit the required separation between an alias key and its value indicator. The emitted colon becomes part of the alias name, so a valid alias-key mapping cannot round-trip.
- fix: Apply the block-map key-separator logic to both flow-map rendering branches, emitting `*a : val` for alias keys and preserving separation for metadata-only empty keys. Add regressions for flow maps with and without comments and record the verified upstream-bug deviation.

### sol-3-3
- file: scratchpad/effected/yaml/internal/composer/anchors.ts:44
- class: bug   severity: required
- standard: D11; section 14, verified upstream bug; the composer’s alias-property validation contract.   evidence: Read-only probes of both the port and pinned oracle returned `Success({ a: 1, b: 1 })` for `"a: &x 1\nb: !!str *x\n"` and `Success([1, 1])` for `"- &x 1\n- !!str *x\n"`. The independent `yaml` parser rejected both with `ALIAS_PROPS`. `checkAnchorOnAlias` checks only `pendingMeta.anchor`; pending tags pass through and are discarded when the alias is constructed.
- failure: Strict parsing accepts tags attached to aliases and silently ignores them. For example, `!!str *x` produces the referenced number without reporting the invalid property.
- fix: Extend the shared alias-property check to reject a pending tag with an existing fatal diagnostic such as `UnexpectedToken`, using `tagSpan` for its position. Retain the existing anchor check and alias recovery behavior. Add block-map and block-sequence regressions and record the verified upstream-bug deviation.

### sol-3-4
- file: scratchpad/effected/yaml/internal/composer/block.ts:1671
- class: bug   severity: required
- standard: D11; section 14, verified upstream bug; `checkMultilineImplicitKeys`’ contract restricts **implicit** keys, while explicit keys may span lines.   evidence: A read-only probe of `Yaml.parseResult("? \"a\n b\"\n: value\n")` returned `Failure` with `UnexpectedToken: Implicit mapping key must not span multiple lines` in both the port and pinned oracle. The independent parser accepted the source and returned `{ "a b": "value" }`. The quoted-scalar arm performs no explicit-key exemption, although the flow-collection arm applies `wasIntroducedByExplicitKeyIndicator` at line 1687.
- failure: Valid explicit multiline quoted mapping keys are rejected as implicit keys.
- fix: Apply the explicit-key exemption before checking a quoted scalar’s source for line breaks. Preserve rejection of multiline implicit keys. Add single-quoted and double-quoted explicit-key regressions and record the verified upstream-bug deviation.

### sol-3-5
- file: scratchpad/effected/yaml/internal/composer/block.ts:1421
- class: bug   severity: required
- standard: D11; section 14, verified upstream bug; the block composer’s documented comment-attribution contract and default document stringification’s comment preservation.   evidence: Read-only parse/stringify probes against both the port and pinned oracle transformed `": # before\n  1 # after\n"` into `": 1 # after\n"` and `":\n  # lead\n  1\n"` into `": 1\n"`. `consumeValueNodeForNullKey` skips comments and returns only `{ node, nextIdx }`; the caller at lines 1182–1191 therefore cannot attach the consumed separator-line or leading comments.
- failure: Comments between an empty key’s `:` and its value disappear during composition. Subsequent stringification permanently loses them, although equivalent named-key entries retain their comment fields.
- fix: Return the existing `ConsumedValue` payload from the empty-key consumer and apply its `sameLineComments` and `leadingComments` in the empty-key caller, following the named-key attribution path. Preserve the cross-line next-key lookahead. Add both comment regressions and record the verified upstream-bug deviation.

### sol-3-6
- file: scratchpad/effected/yaml/internal/stringifier.ts:2132
- class: bug   severity: required
- standard: D11; section 14, verified upstream bug; `YamlStringifyOptions.finalNewline` specifies whether emitted YAML ends with a newline (`Yaml.ts:217`).   evidence: A read-only probe parsed `"---\n"` and called `document.stringify({ forceDefaultStyles: true, finalNewline: false })`. Both the port and pinned oracle returned `"---\n"`. The canonical empty-document branch returns literal marker strings before applying `finalNewline`; its explicit-end-marker form also ends with a newline.
- failure: Empty documents with explicit framing ignore `finalNewline: false` in canonical mode, violating the option’s public contract.
- fix: Apply `finalNewline` to the assembled empty-document marker output, trimming only its final newline while retaining the separator between `---` and `...`. Add start-only and start/end-marker regressions and record the verified upstream-bug deviation.

### sol-3-7
- file: scratchpad/effected/yaml/internal/composer/block.ts:590
- class: bug   severity: required
- standard: D11; section 14, verified upstream bug. This is new evidence for metadata collapsing across multiple lines, beyond the closed round-2 same-line duplicate-property cases.   evidence: Read-only probes of both the port and pinned oracle accepted `"a: !!str\n  !!int\n  1\n"` as `{ a: 1 }` and `"a: &x\n  &y\n  foo\n"` as `{ a: "foo" }`, with zero document errors. The recovered scalars retained only `tag: "!!int"` or `anchor: "y"`. The independent parser rejected these inputs with `MULTIPLE_TAGS` and `MULTIPLE_ANCHORS`. At scalar consumption, `commitOuterIfNewlineSeen()` merges and clears `pendingMeta` before `validateNoDoubleAnchorOnScalar` examines the two slots.
- failure: A newline after the second property bypasses duplicate-property validation. Two properties belonging to the same scalar are silently reduced to the last property, so strict parsing accepts malformed YAML despite the round-2 repair.
- fix: Run scalar duplicate-property validation before merging or clearing the outer and pending metadata slots. Preserve the legal outer-container/inner-key split and the recovered last-property AST after recording the fatal diagnostic. Add both multiline counterexamples and extend the recorded upstream-bug deviation with this evidence.

REQUIRED: 7
BACKLOG: 0