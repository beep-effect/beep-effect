# Main Party integration and citation cache posture

Reviewed the merge of origin/main at 304565d49f into the citation lane.
The Party contact adapter adds a Node-only boundary test and package exports/
dependencies. Citation tests require Bun and keep full integration separate.
The merged implementation command runs Bun unit tests excluding both integration
and the Node-only boundary file, then runs that boundary file under Node. The
citation test tsconfig and explicit integration/parallel routes are preserved.
The frozen dependency install and generated package-script audit pass.

Re-record only the law-practice server's actual combined manifest/command
fingerprint. Preserve Party changes, every other baseline review, qualification
scope, cache flags, outputs, inputs and producer trust. This grants no cache
qualification. Main's Party review and the earlier citation review remain in
history; neither alone describes the combined server manifest. The generated
baseline writer must reject changes to any other subject.

The merge also carries the new Party packages and the main regression tests.
Focused citation and Node boundary tests plus server lint/type checks are the
local proof; full repository and integration proof remains hosted. To reverse,
revert this merge and regenerate the preceding reviewed server posture.
