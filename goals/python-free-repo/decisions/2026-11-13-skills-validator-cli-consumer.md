---
title: "Migrate the validator CLI regression consumer with its runner"
date: 2026-11-13
reversal: "Restore the regression consumer together with the prior validator runner"
---

The operator explicitly included packages/tooling/tool/cli/test/ontology-validator-cli-boundary.test.ts in this lane after final-check exposed its reference to the deleted validator. Replace all embedded Python with Bun probes against injected TypeScript argument and rendering boundaries. Preserve missing-repo-operand rejection before validation, valid argument forwarding, control-free flag and violation output, exact escape preservation, and stderr routing for unreadable manifests. The probes never validate ontology artifacts. Run the focused three-test suite and quality package-verify @beep/repo-cli --quick before publishing.
