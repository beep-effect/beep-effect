# Guarded dependency repeatability: two real CI observations

After PR #2782 merged, two serial source-only CI observations ran at
`df3ccd1b77aba565a72abd63c910ef3edde23929`. The caller and resolved Heavy workflow
both used that revision. Runs [42269287143](https://github.com/beep-effect/beep-effect/actions/runs/42269287143)
and [42270163848](https://github.com/beep-effect/beep-effect/actions/runs/42270163848)
both succeeded, with only the inspection job executing.

The [paired receipt](guarded-dependency-repeatability-2026-11-06.json) records
the actual job and artifact identities, retained report hashes, reviewed controls
and original resource bounds. Both canonical dependency digests are
`165cc66fc16d1983c5148490b5b7cb9c5227045057d85690d2a19232e37c7499`.
The source reports are byte-identical. All 2,266 package groups agree, and all
330 recorded node-gyp file hashes agree: 272 other files and 58 Python source
files, with no Python bytecode files. Each observation preserves source bytes,
agrees across two archive passes and matches its declared dependency digest.
Diagnostics took 49.343 and 42.107 seconds; each combined report is 3,479,551
bytes, inside the unchanged 4 MiB aggregate limit. Cloud artifacts retain the
existing one-day expiry; private raw reports were retained once and hash-checked.

This is a passing controlled prevention observation, without digest normalization,
file exclusions or post-install cleanup. The exact historical bytecode-generation
mechanism remains unproven. The [earlier failed pair](file-level-dependency-drift-2026-11-06.json)
remains failed and retains its original source identity and actual hashes.
These observations do not compare performance savings against that older source.

## Next boundary

The source-only dependency repeatability prerequisite now has actual evidence at
this source and profile. Independent current source/tool/profile approval,
protected workflow configuration and capability delivery checks, and bounded real
producer execution/publication/import remain required. These observations do not
approve the producer, execute task bodies, activate signing or change runtime
credentials. Both full Turbo goals remain active, with production trust,
computation qualification/adoption, economics and representative windows open.

No manual local verify, publish, tests, check, docgen or package-quality suite was
run for this evidence change. Hosted CI remains the quality authority.
