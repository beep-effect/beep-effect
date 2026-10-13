I'll review the listed CLI files against the port laws, the round-1 inventory, and the upstream oracle, and report only new findings.Round 1 is inventoried. I'll compare this commit's focus files with the oracle and the recorded deviations, and look only for new defects.The recorded deviations and round-1 dispositions are in hand. Next I’ll read the sixteen focus files against the oracle for new defects.I'll finish the unread bodies of the sixteen files and check the two open schema candidates against the ledger and the upstream oracle before writing findings.### grok-2-1
- file: scratchpad/effected/cli/CliLinks.ts:32
- class: schema   severity: required
- standard: D5; `standards/effect-laws-v1.md` short laws 17 and 19; `standards/effect-first-development.md` EF-12b. Same bar as round-1 cli-8. The cli schema-first ledger row converts color, token, status, key, and span only.
- evidence: `export type EditorLinks = "auto" | "vscode" | "file" | "off"` at line 32, `MODES` at line 91, and `parseSetting` at lines 93–94 repeat that domain, and `parseSetting` is a hand membership test. The resolved mode `"vscode" | "file" | "off"` is spelled again at lines 43, 100, 193, and 287. The four gated laws (effect-imports, effect-fn, terse-effect, native-runtime) do not check LiteralKit.
- failure: Adding a mode to the type leaves `parseSetting` and the `${MODES.join("|")}` warning blind to it, and the resolved-mode union can omit it. Types, enumeration, and the env-var guard have no single annotation-bearing schema.
- fix: Add an identity-annotated `LiteralKit` for those four literals, derive `EditorLinks` from its type, accept env values with `S.is`, and type the resolved mode as that kit excluding `"auto"`. Keep the literal order and the invalid-setting message.

### grok-2-2
- file: scratchpad/effected/cli/CliAudience.ts:27
- class: schema   severity: required
- standard: D5; `standards/effect-laws-v1.md` short laws 17 and 19; AGENTS.md Code Laws (named `LiteralKit` domains and `S.is` guards). Same bar as round-1 cli-14, which fixed `scanAudience` and left this call site.
- evidence: `const KINDS: ReadonlyArray<AudienceKind> = ["human", "agent", "ci"]` is passed to `Flag.Literals("audience", KINDS)` at line 199. `scratchpad/effected/env/Audience.ts:31` already owns `AudienceKind = LiteralKit(["human", "agent", "ci"])`, and `scanAudience.ts:62` guards with `S.is(AudienceKind)`. `env/index.ts:12` exports `AudienceKind` as a type only. A `ReadonlyArray<AudienceKind>` does not require every kit member. The four gated laws do not check this.
- failure: A fourth `AudienceKind` still typechecks in `KINDS`, so `--audience` stays blind to it while the pre-parse scan accepts it. The flag vocabulary and `scanAudience` can disagree.
- fix: Import the `AudienceKind` value from `../env/Audience.ts` and pass `AudienceKind.literals` to `Flag.Literals`. Delete `KINDS`. Leave `env/index.ts` unchanged.

REQUIRED: 2
BACKLOG: 0
