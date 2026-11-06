# Hosted native citation qualification receipts

These are observed hosted results, not inferred from an unrelated green job.
The action logs show the law-practice-server integration task and actual tests.
They prove the assertions at the named heads, not the entire citation engine
or later changed test/implementation bytes.

## Unicode replay at 54d61ce7a2

- PR head: 54d61ce7a24fc00ca408c0699146ebc69900fa5c.
- Executed merge commit: 31124a582ff768d7dc52e213a13ffe59fa9cb296.
- Merge base: 5200ca9f357e37c79301ea46e7cf4e818c81ff59.
- Verified tree of both head and merge: 2f7056dec88c5125ee00f2e5284d78aaf0946735.
- Run 41534842472, job 125588573856: success.
- CitationHtmlUnicode.test.ts passed in 365.562 seconds; the actual task ran.
- Its assertions require 2,016 histories, 6,412 snapshots, 482 expected parser
  failures, 1,025 independently checked child exits and zero final admission use.
- Test SHA-256: 4a2bc19c4dd7da57de28d5017c053fc133df0e80dd8723c0b97ddad11bcfead0.
- Retained excerpt: logs/hosted-unicode-54d61ce7a2.log; SHA-256
  6a94d546f786e87e35cc7607dd399d479fdf34016093ac0204cf2550a458ccf2.
- Hosted job: https://github.com/beep-effect/beep-effect/actions/runs/41534842472/job/125588573856

## Native controlled replay and Unicode replay at d738c948ba

- PR head: d738c948ba3b4f2341c3f2db6c44c8c31d5f0b95.
- Executed merge commit: 1a4ab0f35e97440350f0e4f23fcfbfccfe851916.
- Merge base: 5200ca9f357e37c79301ea46e7cf4e818c81ff59.
- Verified tree of both head and merge: 4c6db9cbb125ad74cd93060e97e1847b7b448cd4.
- Run 41537599779, job 125595405334: success, completed 2026-11-02 22:44:09 UTC.
- CitationCleanerNativeCustom.test.ts passed in 15.775 seconds. It requires
  eleven scenes, twelve runs, 59 selected callback/iterator/hash/equality events,
  one previously approved native-resource difference, exact final registry
  snapshots and ten independently checked child exits.
- Test SHA-256: 83fae8bded3bebe4a8ff45ed85f34aeb579c2474607436ecd43f595eb6d3fc07.
- CitationHtmlUnicode.test.ts also passed, in 504.723 seconds, with the same
  test hash and complete assertions as the earlier head above.
- Both law-practice integration files ran and passed; no environment skip or
  result from another package is substituted for execution.
- Retained excerpt: logs/hosted-native-d738c948ba.log; SHA-256
  ce2e9f00dce365699d3d9a42fa6ad162d63c1d65cbcc3d81677d278ead327800.
- Hosted job: https://github.com/beep-effect/beep-effect/actions/runs/41537599779/job/125595405334

The strengthened builtin-boundary checks, strict ESRCH exit probe and 504-case
named HTML replay added after this head require their own hosted result.
These receipts do not close source accounting, extraction, annotation, public
composition, canonical parity rows or final exact-head PR readiness.
