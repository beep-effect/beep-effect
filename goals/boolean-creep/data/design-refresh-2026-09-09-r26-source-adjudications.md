# Round 26 remaining source adjudications

Source `7440cb8c4302ce64b87860069a464bafbf65f576`, packages/apps corpus
`9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`. New upstream `52fcc8d135`
requires a separate post-merge evidence refresh. These decisions do not claim
current-main convergence.

## Admitted D1/D2 records

- `r26-apps-box-auth-ccg-subject`: `Layer.ts:262-280` owns independently
  optional enterprise and user subject IDs in one configuration. Either,
  neither, and both are supported; both selects enterprise by priority.
- `r26-apps-box-auth-mode-priority`: `Layer.ts:262-294` permits an incomplete
  CCG configuration to fall back to the independent token. At the token-read
  boundary all four CCG/token presence pairs can occur. Valid CCG returns
  earlier, before reading the token; preserve that read and logging order.
- `r26-cli-commands-a-c-cleanup-refresh-staging-exists`:
  `Findings.refresh.ts:1174-1183` reads backup and packet existence separately.
  All four filesystem observations are meaningful. Backup-only invokes
  recovery; the remaining combinations proceed to staging cleanup.
- `r26-cli-commands-a-c-findings-cleanup-refresh-remove-options`: the same
  staging cleanup's `recursive` and `force` fields mirror the Effect
  FileSystem API options at line 1183. Admit D2.
- `r26-cli-commands-a-c-validate-pst-export-acceptance-gates`:
  `RestorationTransformations.ts:1247-1252` materializes child reconciliation
  and source-integrity observations separately. Mixed failures and joint
  success are meaningful; warnings are a separate retained diagnostic input.
- `r26-cli-commands-d-k-seed-snapshot-prior-presence`:
  `Migration.command.ts:323-329,380-401` stores the independently read events
  directory presence and optional trace snapshot in `SeedSnapshot`.
  Rollback handles their separate restoration paths at lines 431 and 467.
- Both `r26-tool-docgen-cli-*-compiler-options-source` records:
  `CLI.ts:118-134,155-166` puts each file/text pair in the named Command
  options carrier. `resolveCompilerOptionsInput` at lines 104-114 permits
  neither, either, or both, selecting the file before inline JSON. The raw
  declaration-line anchors were corrected to the actual command declaration.
- `r26-cli-internal-root-jsdoc-opener-gates`:
  `JSDocSections.ts:119-134` materializes independent prefix-whitespace and
  post-opener-text observations. Prefix and suffix can vary independently;
  either failed observation skips the opener without inventing a phase.

## Excluded raw callable or synthetic-member reports

- CreatePackage kind guards at `CreatePackage.command.ts:262` are callable
  `S.is` values, not Boolean state. Do not admit the raw kind-guard D1.
- `familyEvidenceDigestsMatch`, `familyEvidenceCeilingsMatch`, and
  `familyEvidenceTerminalsMatch` at `RestorationTransformations.ts:4872-4892`
  are functions, not three co-carried Boolean results. Do not admit the raw
  family-evidence D1.
- The three subject/void/observable rubric reports describe callable policies
  at `Quality.rubric.ts:50-86`. Their logical relations do not establish a
  sibling value carrier. Exclude the raw qualified and both raw D1 proposals.
  The remaining old `r3-tooling-quality-rubric-void-example-gates` row is
  likewise archived and withdrawn; its two members are functions at lines
  50 and 55, invoked through the subject-aware policy.
- MatchPerson backend platform support functions at `MatchPerson.ts:89-98`
  are callable classifiers. Do not admit the raw platform-support D1.
- `isDocgenSourceFile` at `Core.ts:87-89` has one returned Boolean and inline
  suffix predicates. `hasSourceFileExtension` and
  `hasDeclarationFileExtension` are invented member names. Exclude the raw
  source-extension D1.
- `hasDocumentedExample` at `Checker.ts:20-21` returns one inline aggregate
  Boolean. Its reported `hasExampleTags` and `hasTitledDescriptionExample`
  members are not declarations. Exclude the raw example-source D1.
- Rust's `cfg!(debug_assertions)` at `lib.rs:1445` is an inline compile-time
  expression beside the `ipc` local, not a second named Boolean member.
  Exclude the raw spawn/debug D1.

## Held for complete-owner or compatibility audit

The CreatePackage mutation facts omit the related `retiredNameReused` local;
its relation to `retiredNameCleared` needs a complete owner audit. The
PackageInventory coverage report likewise needs correction because missing
configuration forces two enforcement flags false. These raw D1 conclusions
are not admitted on the strength of the original independence claims.

The Docgen filesystem-write observation, CoverageTaskOptions overlap, and
remaining Worktree/Yeet records still require final reconciliation. No new
design or product implementation is authorized by a raw report alone.
