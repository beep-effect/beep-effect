# GOAL: implement the configurable full document editor

State: paused and authored-but-not-started.

Do not begin P0 until `goals/lexical-playground-capability-atlas` satisfies its
completion gate and delivers the ratified atlas/profile contract. On resume, P0
must refresh this packet from that contract, enumerate every semantic batch and
covered atlas ID, and obtain user ratification before P1.

Outcome: implement every production-eligible single-user Playground document
semantic, authoring mechanic, and projection in ratified semantic batches
behind the capability registry. Keep `@beep/md` canonical, make projection loss
explicit, and prove the D13 parity bar.

Read these as the contract:

- `goals/configurable-full-document-editor/{README,SPEC,PLAN}.md`
- `goals/configurable-full-document-editor/ops/manifest.json`
- `goals/configurable-full-document-editor/research/SOURCES.md`
- `goals/lexical-playground-capability-atlas/{SPEC,PLAN}.md`
- `explorations/full-document-editor/{DECISIONS,BRIEF,MAP}.md`

Then read `AGENTS.md`, `CLAUDE.md`, and the sources named by `SPEC.md`.

Scope:

- In: ratified `@beep/md` semantics; `@beep/lexical-schema` wire/codecs;
  `@beep/editor` mechanics; Storybook; existing dock seams; migrations, tests,
  docs, and recorded browser QA.
- Out: persistence/autosave/revisions/sharing; collaboration/Yjs; redlining;
  executable DOCX; authoritative PDF; Prose-to-Proof workflow; product-specific
  lifecycles; executable user plugins; the seven gated successor packets.

Execution:

1. Verify the prerequisite. Keep the packet paused if it is unmet.
2. In P0, refresh current source anchors and map every D13-eligible atlas entry
   to a semantic batch, schema/projection work, migration, owner, and focused
   proof. Obtain user ratification of the complete map.
3. Implement batches in dependency order through Goal A's registry. Preserve
   existing consumers with explicit compatibility defaults.
4. Prove each batch with schema/codec/runtime tests, package/app checks,
   Storybook, and recorded browser QA.
5. Reconcile every eligible atlas ID and approved exception before P3.
6. When authorized, Yeet to `merge-ready: yes` and close with `/reflect`.

Non-negotiable constraints:

- A common-feature subset is not parity. Every eligible atlas entry needs a
  ratified batch or a user-approved, successor-owned exception.
- Lexical, Markdown, HTML, raw Lexical JSON, Pandoc, DOCX, and PDF are
  projections. None replaces canonical `@beep/md`.
- Controls, registrations, commands, activation paths, bindings, importers,
  and generated help derive from one resolved capability state.
- Disabled authoring keeps supported content readable and lossless.
- Remote media is network-inert on open. Private payloads stay out of URLs, and
  authored data grants no execution authority.
- Pointer, drag, and hover mechanics require keyboard, focus, labeling,
  responsive, and touch proof through the recorded browser QA loop.

Acceptance requires every `SPEC.md` criterion, no unexplained D13-eligible atlas
entry, green required verification, and no unrelated churn. Run every command in
`ops/manifest.json` `verificationCommands`.

Stop on an unmet prerequisite, unratified batch map, authority conflict,
successor-scope leak, unauthorized egress/security change, unplanned migration,
dependency/lockfile change, or unavailable required proof. Done only after
acceptance, exact-head hosted checks, zero unresolved threads, and
`merge-ready: yes`.
