# pstack guide and packaging notes

## Operating model

1. Prompt `/poteto-mode` with the result you want, the constraints that matter, and an observable finish condition; do not prescribe its internal skill sequence.
2. On every multi-step task, poteto-mode opens a todo list and reads its inline index of 21 engineering principles first.
3. It classifies the request against a bundled playbook, copies that playbook's steps into the todo list verbatim, and leaves any skipped step visible as `skip: <reason>`.
4. As those steps fire, it routes to focused skills such as `how`, `why`, `architect`, `arena`, `swarm`, `tdd`, `interrogate`, and verification or cleanup skills.
5. It owns the final synthesis: review delegated work, verify the real artifact, and reply for both the consumer and the maintainer instead of forwarding subagent claims.
6. The mode is sticky for the rest of the conversation; ordinary follow-ups such as `continue` retain the current playbook until the user opts out.
7. Say `new task` when changing subjects so the mode discards the prior route and classifies the new request afresh.
8. Use a principle name as compact steering, for example `apply prove it works`; the agent should name the concrete decision the principle changed, not merely cite it.
9. Parallel attempts belong in separate branches, worktrees, or sanitized directories; use Arena for competing answers to one brief and Swarm for independent slices or declared race arms.
10. An overnight contract names the goal, pass/fail finish condition, isolated worktree and base, granted permissions, decision-log requirement, wake loop, and a genuine-dead-end escape hatch.
11. Each autonomous iteration checks the predicate, makes the smallest justified change, verifies the real artifact, commits a win or discards a miss, records one decision row, and repeats without weakening the predicate.
12. The decision log is a local TSV, normally `decisions.tsv` or `.audit/<task-slug>.tsv`, with time, phase, decision, reason, evidence pointer, and result; a cross-model reviewer audits it before the morning summary.
13. Skill or prompt changes are tested as blinded behavioral experiments: identical organic prompts, isolated variants, neutral labels, one shared rubric, one cross-family judge, transcript-based chain checks, and a human read of every output.
14. `/setup-pstack` separates model roles for code, judgment, and review panels, while absent overrides retain bundled defaults and `auto` or `inherit-parent` delegates to the parent model.
15. `/automate-me` mines repeated preferences from the active workspace's recent transcripts, confirms them with the user, generates and unslops a personal `<name>-mode` skill over pstack, and updates it later from only the history since its last edit.

## Recipes and pitfalls

### Recipes

- Understand an unfamiliar subsystem: `use /how first to understand how this initialization works. then use /why to figure out why it broke recently.` Mechanics come first and history second; both reports identify the evidence sources they searched.
- Get a second opinion on a design: `ask /arena for a second opinion on this thread and our approach`. The current design becomes one candidate among several, and the synthesis reports whether another attempt was better or the panel confirmed it.
- Check independent slices in parallel: `/swarm check every package under packages/ against its check.sh. one worker per package. one report.` Give each worker one package and require the parent to aggregate all slices as `PASS`, `ISSUES`, or `BLOCKED` instead of returning raw worker dumps.
- Review a branch skeptically: `/interrogate the whole branch, but skeptically. don't change anything yet. no nitpicks unless it's an actual bug or regression in behavior.` The read-only constraint prevents edits, and the no-nitpick constraint filters review noise before findings reach `Act on`.
- Fix a bug through a failing test: `/poteto-mode repro the duplicate write first. if there's a cheap test path, /tdd it. then fix and rerun.` The cheap-test qualification permits a real command or executable check when brittle mocks would prove less.
- Keep a run honest while away: `im going to bed, keep going autonomously until every fixture passes. do not stop. keep a decision log i can audit in the morning.` This short form assumes the task and finish condition are already in context; otherwise use the full overnight contract.
- Redirect a drifting run with one line: `i said the goal is to repro. i did not ask for a fix yet.`, `apply prove it works. show me the real output, not the build log.`, or `/unslop that, no emdashes`. Restate the boundary or invoke the precise principle or skill instead of rewriting the whole prompt.
- Get the prior reply in plain words: `/bro`. It restates the last message more briefly, in ordinary language and without jargon.

### Pitfalls

- Enumerating skills in the prompt. A sequence such as `use /how then /architect then /arena` can reorder or omit steps already enforced by the playbook. State the goal and constraints; name a skill only to override the default route.
- Giving a vague finish condition. `Make it better` gives a wake loop no predicate. Name a command, artifact, stored value, flow, profile, or other result that can pass or fail.
- Running parallel agents in one worktree. They overwrite one another and make the diff hard to reconstruct. Allocate one worktree or isolated directory per attempt.
- Using Arena for coverage. Arena gives every candidate the same brief, selects a base, and grafts useful parts from other attempts. Swarm partitions independent slices or race arms and aggregates their outcomes.
- Accepting every review comment. Human and automated reviews mix bugs with noise. Classify findings, act on supported defects, dismiss disproved claims with reasons, and retain operator judgment.
- Treating `auto` as a model slug. Both `auto` and `inherit-parent` mean that the task omits its explicit model field and inherits the parent chat model.
- Reporting success from a green build. Compilation is only a proxy. Run the changed command or user flow, read the stored value, replay the input, or compare the profile, then include the evidence.
- Writing `SKILL.md` freehand. Use the authoring playbook and the host's skill generator so frontmatter, links, agent-facing instructions, verification, and review are checked.

## Reproducible eval methodology

The experiment asks whether a specific skill or prompt variant changes agent behavior. Define the variant before running anything, then write a judge-only rubric with three to six concrete criteria. Criteria should describe observable behavior or artifact quality. Do not show the rubric to workers. For an A/B comparison, keep the baseline and changed variant identical except for the change under test.

Blinding is strict. No candidate-visible prompt, directory, file, branch, slug, environment variable, or instruction may contain `eval`, `test`, `judge`, `experiment`, `rubric`, `score`, `compare`, `benchmark`, `candidate`, or `arena`. Use plausible project names and an organic request such as `build me a small todo cli`. Do not ask workers which skills, principles, or files they used. Do not tell them that other workers exist. Those cues change the behavior being measured.

To reproduce the method outside Cursor:

1. Choose the behavior under test and freeze one success rubric of three to six observable criteria for the judge only.
2. Create one isolated working directory for each run. Give it a plausible project name, the same project skeleton and fixtures, and exactly one installed variant. Include only the skills and context an organic run would naturally discover.
3. Prepare one user-like prompt that states the product goal rather than the experiment. Use the byte-identical prompt for every run.
4. Launch N workers in parallel, preferably across different model families, with the same permissions and tool access. Each worker receives only its directory and the organic prompt. Capture its final artifact, response, commands, file reads, and tool transcript.
5. Replace working-directory names and any other identifying metadata with neutral labels before judging. Do not reveal model names, variant names, or which labels share a variant.
6. Give one judge from a different model family every labeled output in one pass, together with the frozen rubric. For A/B work, the same judge must score both sets on the same scale in that single pass. Separate judge runs allow calibration to drift and are not comparable.
7. Audit instruction following from execution evidence. Inspect each run's file-access and tool transcript to determine which skill and principle files it actually opened, then compare that evidence with the resulting code shape. A citation does not prove a file was read, and a read does not prove the rule affected the artifact. Outside Cursor, use the host's trace, an audited tool proxy, or filesystem-access logs as the equivalent of Cursor's workspace-local `agent-transcripts/` record. Never sweep unrelated user or workspace histories.
8. Read every worker's response and artifact end to end yourself. Compare the artifacts, the access evidence, and the judge's verdict. A disagreement may expose model bias or an ambiguous rubric; resolve that before promoting the change.
9. Record the variant under test, frozen rubric, per-run notes under neutral labels, the judge's verdict, the coordinator's synthesis, and a promote or do-not-promote recommendation. Preserve the prompts, environment recipe, variants, traces, and outputs so another operator can rerun the experiment.

The method measures behavior, not self-description. Chain following is inferred from actual file reads plus the code or prose produced. A worker's claim that it applied a principle is not evidence.

## Packaging and host integration

The Cursor plugin manifest declares package metadata and two discovery roots:

- `"skills": "./skills/"` registers the directory of skill packages. Cursor discovers each skill from its `SKILL.md`; the manifest does not enumerate slash commands one by one.
- `"agents": "./agents/"` registers the bundled agent definitions, including `poteto-agent` and the read-only `Comment Sicko` reviewer.
- The manifest identifies the plugin as `pstack` version `0.14.5`, category `developer-tools`, authored by Lauren Tan, licensed under MIT, and hosted in `cursor/plugins`.
- The dormant `automations/benny/` pack is not registered as a skill or agent. Its setup copies the pack into a target repository and keeps user configuration outside the copied files.

`/setup-pstack` is an override writer, not a runtime service. It detects model slugs that the current Cursor account can use, loads any existing choices, shows every role, validates every explicit slug, and rewrites `~/.cursor/rules/pstack-models.mdc` idempotently with `alwaysApply: true`. Each line maps one role to a model; a missing line falls back to that skill's inline default. `auto` and `inherit-parent` are aliases that cause pstack to omit the subagent model field. Panel roles hold comma-separated lists, one worker per entry, so the list length controls fan-out. The Arena cross-judge pool is a list from which Arena prefers a model family different from the parent. `swarm workers` supplies the default worker model unless a race names models per arm. Setup changes apply to new sessions. It also offers, once, to generate a project-local verification skill when it cannot find a `verify-*` skill or an existing app-driving harness.

The role schema covers feature and refactoring code, bug fixes, performance work, hillclimbing, judgment and prose, hardest tasks, How explorers, explainers, and critics, Why investigators and synthesis, Reflect tooling and synthesis, Arena runners and cross-judge pool, Swarm workers, Architect runners, and Interrogate reviewers. A port should preserve the role labels or provide one explicit translation table, because the consuming skills read those labels directly.

Some workflows reference capabilities that pstack does not ship:

- `/deslop` comes from the separate `cursor-team-kit` plugin and cleans generated code before commit.
- `control-cli` comes from `cursor-team-kit` and provides live control and verification for command-line and terminal interfaces.
- `control-ui` comes from `cursor-team-kit` and provides live control and verification for browser, Electron, and web interfaces.
- Cursor's `/create-skill` is built in, not part of `cursor-team-kit`. Cursor also has a built-in `/babysit`, but poteto-mode's bundled Babysit playbook supersedes it for PR-status work.

Installing pstack alone therefore leaves the pre-commit deslop pass and live CLI/UI control references unresolved. Install `cursor-team-kit` alongside it in Cursor, or supply named port equivalents and update every reference. Do not misclassify `/create-skill` as a companion-plugin dependency.

## License, attribution, and pinned upstream

- Upstream repository: `https://github.com/cursor/plugins`, plugin path `pstack/`.
- Pinned upstream revision: `68836ddaf5697224520f1847d90cdb90ca8babaa` (`68836dd`).
- License: MIT, copyright 2026 Lauren Tan.
- MIT permits use, copying, modification, merging, publication, distribution, sublicensing, and sale.
- A vendored copy or substantial portion must include the upstream copyright notice and the full MIT permission notice. Preserve the upstream `LICENSE` text in the vendored distribution or in a clearly referenced third-party notices file that ships with it.
- Keep attribution specific enough to identify pstack, Lauren Tan, the MIT license, the upstream repository and plugin path, and the pinned revision. Mark local modifications and their provenance separately so readers do not attribute port-specific behavior to upstream.
- Preserve the MIT warranty and liability disclaimer. Do not imply upstream warranty, endorsement, support, or responsibility for the port.
