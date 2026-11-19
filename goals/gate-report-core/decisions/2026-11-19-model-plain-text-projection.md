---
title: "The model owns the plain-text projection and the budget fit"
date: 2026-11-19
lane: "feat/gate-report-core"
reversal: "Move the projection module into the gate-run library and test the laws there."
---

The model turns a report into a console document and also into plain lines, so laws 1 to 3 are property-tested in the model with no service. The gate-run library maps the same fitted document onto `@beep/cli-kit` for colour. Fitting keeps fold lines first, then the longest run of failure entries that fits the budget; the cap line counts every dropped entry and fold. A budget must hold eight full lines and a line limit of at least 40 characters.
