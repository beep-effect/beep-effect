# Accepted-source dependency repeatability and later drift

Two serial credential-free inspections at `b0c9bab1e13b7aa9d785a5ea5e8d44c6667e4d72` produced the same raw dependency identity. The [first run](https://github.com/beep-effect/beep-effect/actions/runs/42315200356) and [second run](https://github.com/beep-effect/beep-effect/actions/runs/42316571895) each executed the reusable Heavy definition at that exact revision.

Both observations reported dependency SHA-256 `7bb708159bee071af7da6eccdc3c6b3f54904ecde3094d4d5b016ceecb512c38`, 2,269 package groups and 330 node-gyp detail records. Source bytes remained unchanged, each diagnostic's two snapshots matched, and both observed digests matched the declared digest. The pair had no changed groups, files or source-report fields. No digest normalization or file exclusion was used.

The detail records contained 58 Python-source files and 272 other files, with no Python-bytecode records. The job-scoped bytecode guard was active. These observations establish repeatability at the recorded source, rather than proving which mechanism caused earlier mismatches.

Diagnostic execution took 46.049 and 45.260 seconds. Combined source and diagnostic reports measured 3,485,525 and 3,485,524 bytes, within the four-MiB aggregate limit. The ten-minute job ceiling, two archive passes, existing reader limits and one-day provider retention remained unchanged. The companion JSON records provider archive/report hashes and expiry timestamps. Retaining private copies does not extend provider availability.

## Applicability after the dependency refresh

This report was prepared at accepted revision `ce87ff21b246877706c8c27c599ef65b9acc0fe4`. Its root manifest and lockfile differ from the observed revision. The other eleven source controls match. The old pair remains valid evidence for its recorded revision; it does not establish dependency equality for the newer profile. Obtain a fresh real pair before using that profile for protected execution.

The four declared R2 adapter build inputs still match the retained candidate from run 42281221097. Commit movement alone does not require rebuilding that candidate. Current workflow/profile approval, provider availability and protected runtime proof remain separate requirements. The recorded candidate artifact expiry is November 7 at 19:47:19 UTC; it was not revalidated during this report preparation.

Neither inspection received cache or issuer credentials or ran a quality task. This report grants no independent approval, activates no signing or capability, qualifies no task, and completes no representative observation window.
