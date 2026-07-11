---
"@beep/ontology-server": patch
"@beep/professional-desktop": patch
"@beep/workspace-server": patch
---

Harden ontology filesystem authority and workspace entity public IDs.

Ontology open and save operations now require a configured workspace root,
accept only root-relative Turtle paths, and reject traversal and symlink
escapes. Workspace threads, turns, and messages now use independently
generated public IDs so concurrent inserts cannot collide on predicted
database sequence values.
