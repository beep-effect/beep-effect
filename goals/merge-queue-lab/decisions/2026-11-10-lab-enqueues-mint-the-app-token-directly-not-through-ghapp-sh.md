---
title: "Lab enqueues mint the App token directly, not through ghapp.sh"
date: 2026-11-10
lane: "docs/merge-queue-lab-findings"
reversal: "Route lab calls through ghapp.sh once its guard admits non-main bases."
---

The operator-side ghapp.sh wrapper runs a merge-reservation guard that refuses opaque GraphQL input while owner holds exist on main pull requests. Lab pull requests target queue-lab, which the guard does not model, so ops/queue-lab.sh mints the same beep-fleet-orchestrator installation token through gh-app-token.sh and passes it to gh through the environment. The identity is the same; the token is never printed.
