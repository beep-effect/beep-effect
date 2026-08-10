---
"@beep/repo-ai-metrics": patch
---

Resolve the hook-pulse codec's private-identifier salt exactly as the shell writer resolves
its own. `privateReference` called `hashPrivateIdentifier(value, undefined)` unconditionally,
so on a machine exporting `BEEP_AI_METRICS_HASH_SALT` the codec and
`.claude/hooks/hook-pulse.sh` produced different digests for the same identifier and their
rows could not be joined — latent only because nothing outside the module consumed the
raw-event path yet, and load-bearing at P4 replay.

The codec now walks the writer's own precedence — `BEEP_HOOK_PULSE_HASH_SALT`, then
`BEEP_AI_METRICS_HASH_SALT`, then the published local default — through the new exported
`hookPulseHashSalt` config, resolved once per decode. It reads the ambient `ConfigProvider`,
which is a `Context.Reference` with a `fromEnv` default, so the schemas' requirement channel
stays `never` and no caller changes. An unconfigured clone produces byte-identical digests to
before, and an already-64-hex identifier still passes through unhashed.

A writer-versus-codec parity test runs the real hook script under an explicit test salt and
asserts the codec reproduces its digests on all three rungs; unit tests pin the precedence,
including the whitespace-only rung where a shell reading and a trim-first reading could
disagree while both looked correct.
