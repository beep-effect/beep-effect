---
title: "a plain yeet publish on worker takes the yeet open posture and labels the PR compute-profile-worker"
date: 2026-11-08
lane: "goals/compute-profile-gate-routing-p1"
reversal: "Route yeetPublishCommand and yeetCommand back to runYeetMode publish and drop applyComputeProfileLabel; --force-local becomes a no-op."
---

yeetPublishPostureFor decides: mode publish on the worker profile without --force-local takes open. Publishes that reuse or amend a commit (--prove-first, --push-only, --reuse-verified, --amend, --no-edit, --staged-only) or run detached keep the publish route, because yeet open rejects those flags. Like yeet open, the redirect pushes the committed HEAD and refuses staged changes: commit first. With --message and no --body-file the body is synthesized from the message plus the deferral sentence, in a scoped temp file. On worker, yeet open adds the compute-profile-worker label through the REST issues endpoint, which creates a missing label. A failed add is one warning. The attempt fact gains an optional forceLocal, set only when --force-local was passed.
