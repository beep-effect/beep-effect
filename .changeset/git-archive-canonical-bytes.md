---
"@beep/repo-cli": patch
---

Pin `git archive` to the repository's canonical LF bytes. `.gitattributes` declares `* text=auto` and
Git children inherit the ambient environment, so a contributor carrying `core.autocrlf=true` archived
different bytes than CI for byte-identical objects. The knowledge semantic-delta compares those bytes
exactly, so such a host reported a standing `index-drift` finding on `goals/INDEX.md` whose
remediation (`beep goals index --write`) could never clear it. `writeGitArchive` now leads its
argument vector with `-c core.autocrlf=false -c core.eol=lf`, and the vector is a pure exported value
so the contract is asserted without spawning a process.
