---
"@beep/repo-cli": patch
---

Pin `git archive` to the repository's canonical bytes. `.gitattributes` declares `* text=auto` and
Git children inherit the ambient environment, so a contributor's host state archived different bytes
than CI for byte-identical objects: `core.autocrlf=true` rewrote line endings, a global attributes
file (`$XDG_CONFIG_HOME/git/attributes` or a config-named `core.attributesFile`) attaching
`eol=crlf` overrode even explicit `-c core.eol=lf`, and ambient `tar.umask` rewrote tar header mode
bits. The knowledge semantic-delta compares archive bytes exactly, so such hosts reported a standing
`index-drift` finding on `goals/INDEX.md` whose remediation (`beep goals index --write`) could never
clear it. `writeGitArchive` now leads its argument vector with `-c core.autocrlf=false
-c core.eol=lf -c core.attributesFile=/dev/null -c tar.umask=0002` and spawns with
`GIT_ATTR_NOSYSTEM=1` (the one attribute layer without a `-c` override); both the vector and the env
are pure exported values (`gitArchiveArgs`, `gitArchiveEnv`) so the contract is unit-asserted, and a
hostile-profile differential test proves each profile live with a negative-control witness.
