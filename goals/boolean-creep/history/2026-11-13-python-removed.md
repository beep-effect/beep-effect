# Python removed from this packet (2026-11-13)

The `python-free-repo` goal bans tracked Python
([SPEC](../../../goals/python-free-repo/SPEC.md)). Nothing in a workflow, hook,
package script, skill, systemd unit or `opsScripts` entry still runs the
1 file(s) below, so they were deleted rather than ported. Their outputs and
the conclusions drawn from them stay in this packet, in the files listed under
"Recorded in".

Recover any script with
`git show 05ed8bc6b6cc50f2a284ed02caaab16f216bb9c3:<path>`. A resumed packet that needs to run one again
ports it to TypeScript first; tracked Python is no longer admitted.

| Deleted file | Recorded in (non-Python files that name it) |
| --- | --- |
| `ops/test_sweep_scratch.py` | none |
