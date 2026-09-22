# Runner import detector prerequisite

Benjamin authorized remediation of the existing legitimate inventory before
refreshing the newer-main inventory delta. The identity wave needs an upstream
instrumented runner because test-utils already depends on identity. The runner
extraction remains in `codex/effect-vitest-runner-leaf`; identity remediation
remains in `codex/effect-vitest-p1-reconcile`.

This branch contains only the CLI detector prerequisite and packet evidence,
preserving D13's separate tooling/tool wave. It recognizes `it` from
`@beep/test-runner` and `@beep/test-runner/Vitest` using the same provenance path
as the existing compatibility entrypoint. Root, alias, namespace, nested layer
and shadowing cases retain the existing rules. Error constructor imports and
namespace error members are not promoted to test registrations.

All 194 focused detector tests pass. The first draft included an invalid API
fixture (`it.TestHang`), which was replaced by a valid namespace error-constructor
case. A premature full package run was explicitly interrupted; it supplies no
proof. The corrected full package proof is running. Main was integrated at
f23cbd2ffa; its three added commits were documentation changes.

After package and Yeet proof, publish this small prerequisite for review and
hosted checks. Benjamin merges. Then integrate it into the runner extraction,
reconcile moved-file evidence, publish that prerequisite, and resume identity
adoption. No broader census refresh is needed before these backlog fixes.
