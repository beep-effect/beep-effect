# Real-root entrypoint selection and reference containment

Source base: `68d37217c6ab10f6b1ca70316ab6544c87d23c38`. The isolated candidate
adds one negative input to identity lint: `!$TURBO_ROOT$/.repos/**`. Its cache
setting remains false. The root strict-entrypoint flag remains absent.

## Actual baseline refusal and narrow repair

Native stable 2.11.10 completed build/check/lint metadata dry runs. Native canary
2.11.11-canary.1 completed build/check but refused lint with `input symlink leaves
repository`, resolving a manifest through an external `.repos` reference link.
This happened with strict entrypoint selection disabled, so it is not evidence
of a strict-entrypoint regression. The original five successful baseline reports
and sixth refusal remain retained; the root configuration was restored exactly.

Only identity lint contributes the repository-wide manifest input pattern in the
observed lint graph. Its package command is the generated `biome check .` wrapper;
its lint profile selects identity and primitive types, while `.repos` is ignored
reference material with no tracked files. Exclude that external reference tree
explicitly from identity's broad repository metadata inputs. Preserve all other
positive inputs and exclusions, profile routing, dependencies and cache:false.

The same canary lint dry run succeeds with this one exclusion, while the root
strict flag is still off. On stable, before/after lint task IDs and every input
path are identical. Only identity's edited `turbo.json` input content hash changes;
no observed stable input is dropped. This is metadata containment evidence,
not a lint execution or qualification result.

## Twelve real-root graph observations

Both pinned native binaries ran `build`, `check` and `lint` with strict entrypoint
selection absent and then true, changing no other future flag. All twelve dry
runs succeeded with the candidate input exclusion. The exact original root
configuration was restored after observation. No quality task body executed,
no secret was loaded and no remote credential or cache capability was supplied.

Both clients show the same scheduling changes:

| Request | Removed graph nodes | Removed executable commands | Other retained changes |
| --- | ---: | ---: | --- |
| build | 2 | 0 | 29 dependent lists |
| check | 4 | 2 | 79 dependent lists |
| lint | 2 | 0 | None |

The commandless removed entrypoints are scratchpad and tsgo-shim. For `check`,
the executable dependency branches `@beep/drizzle#build` and `@beep/repo-cli#build`
also disappear. This is a concrete opportunity for execution and critical-path
review; metadata alone does not prove they can safely be omitted in each caller,
or how much time would be saved. Keep strict entrypoint selection disabled until
that proof is complete. Existing synthetic observations remain separately bound
to their recorded sources and clients.

The [receipt](real-root-entrypoint-and-reference-inputs-2026-11-06.json) retains
raw-report hashes, counts, exact binary pins, source/candidate configuration
hashes, all changed task IDs and resource limits. Native metadata processes used
scrubbed environments, at most thirty seconds each, bounded output and lower
priority. The complete candidate comparison took twelve metadata invocations;
there was no manual local verify, publish, check, test, docgen or package-quality
suite. Hosted CI remains the source-change quality authority.

## Remaining gates and reversal

The source repair needs current hosted proof and primary acceptance. The changed
identity input profile must be independently bound before any protected trial;
old source/profile evidence is not rewritten. Strict-flag semantic/execution
review, broader task qualification, adoption and every whole-goal criterion
remain open. Reverse the repair by removing its one exclusion while preserving
the original refusal and candidate observations.
