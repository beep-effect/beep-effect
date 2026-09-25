# Cache baseline reconciliation after qualification merge

The three-way comparison preserves main's expanded pilot exclusions, projection
sources, and the two changed lint nodes for test-runner and fc-runs. It also
retains this branch's 50 dependency-list changes for data, schema, codegen-kit,
colors, cosmos, and OBS. The two node-change sets are disjoint; no node
configuration or command from the goal branch replaces main's policy changes.

Prior review bases remain in `obs-cache-review.md` and the qualification packet's
`utils-main-merge-review.md`. This is conflict reconciliation, not new cache
qualification or performance evidence.
