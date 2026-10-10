I'll review the markdown port against the pinned upstream oracle and the binding decisions, read-only, and report only findings. First I'm loading the port laws, ledger, and the files in scope.The four beep laws are already green, so I’m looking for behaviour drift the gates do not catch — especially `HashMap` replacing order-sensitive `Map`s, and schema changes on the public node types.The remaining bug hypotheses are the definition pre-pass and the literal-domain laws. I am reading those sites against the pinned oracle before writing findings.The footnote-label set is rebuilt during the definition walk. I am checking whether any inline parse runs before that walk returns.### grok-1-1
- file: scratchpad/effected/markdown/MarkdownNode.ts:106
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19; D5 (LiteralKit during S4); standards/schema-first-development-prompt.md "Use LiteralKit for a reusable discriminator domain"; jsonc bar (`JsoncNodeType`, `SyntaxKind`)   evidence: the named exports are `S.Literals(...).pipe($I.annoteSchema(...))`. Law 19 reserves `S.Literals` for an anonymous union that is never named. These values are exported and used as field codecs (`ReferenceType.annotateKey`, `HeadingDepth.annotateKey`, `TableAlign.pipe`, `FrontmatterFormat.annotateKey`). `LiteralKit` accepts the number members in `HeadingDepth` (`LiteralToKey` maps `1` to `"number1"`).
- failure: `ReferenceType` (106), `HeadingStyle` (121), `BreakStyle` (136), `FenceChar` (150), `BulletChar` (164), `ListDelimiter` (178), `ThematicBreakChar` (192), `EmphasisChar` (206), `HeadingDepth` (220), `TableAlign` (235), and `FrontmatterFormat` (1053) are named literal domains without the kit (`.Enum`, `.is`, `.$match`). The inline `escapeStyle` union at line 303 is unnamed and stays `S.Literals`.
- fix: Replace each named export with `LiteralKit([...]).pipe($I.annoteSchema(...))`, keeping the same members, annotations, and `typeof X.Type` aliases.

### grok-1-2
- file: scratchpad/effected/markdown/MarkdownNode.ts:45
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md section 14; effect-tsgo `schema-number` (the S1 tsgo gate already forces `S.Finite`)   evidence: Oracle `Point.line` / `column` / `offset`, `Code.fenceLength`, and `List.start` are `Schema.Number`. The port uses `S.Finite` at lines 45–47, 560, and 662. README Port notes and the markdown ledger row both say deviations are empty.
- failure: `Point.make` and decode reject `NaN` and `Infinity`, which upstream `Schema.Number` accepts. Parsed markdown never produces those values; direct construction and foreign mdast admission do. The law-forced change is unrecorded.
- fix: Add one ledger `deviations` entry and a README Port notes row citing `law:schema-number`. Leave the fields as `S.Finite`.

### grok-1-3
- file: scratchpad/effected/markdown/TomlFrontmatter.ts:9
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md (titled `**Example**` / `**Details**`; `@remarks` forbidden); operator order that S2 is after round 1   evidence: Focus files still use `@remarks`, `@public`, and `@example` (`TomlFrontmatter.ts`, `YamlFrontmatter.ts`, `MarkdownNode.ts`, `Mdast.ts`, `MarkdownVisitor.ts`, `index.ts`). The Toml and Yaml docs still call the engines `@effected/toml` and `@effected/yaml` optional peers; the imports are `../toml/index.ts` and `../yaml/index.ts`.
- failure: Exported docs are still on the upstream tag grammar, and the frontmatter codec docs name packages this module does not import.
- fix: Convert those blocks in S2. Retarget the Toml and Yaml peer sentences to the lab modules.

REQUIRED: 1
BACKLOG: 2
