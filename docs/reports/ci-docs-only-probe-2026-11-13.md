# Docs-only CI probe (2026-11-13)

Disposable probe for #3122. Do not merge. It checks on hosted runners which jobs do real work on a
documentation-only pull request. Expected: Repo Sanity's documentation path, Docs Policy, Secret
Scanning and Commitlint do work. Security, SAST, the code lanes, the test shards and the heavy matrix
skip.
