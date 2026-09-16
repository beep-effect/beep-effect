---
"@beep/repo-cli": patch
---

`yeet inbox ack --observed` now acknowledges `pr-merge-ready` rows as well as
proof-job rows, `yeet inbox list` treats merge-ready rows as live instead of
wave-scoped, and the yeet skill documents `yeet monitor --until-ready --detach`
plus `yeet job wait` as the canonical PR babysit recipe. A head whose checks registered never re-enters the
settle rule's registration window: an empty check census afterwards is a bad read counted
against the poll-error budget (ruling 50).
