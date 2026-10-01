# Package lifecycle test migration preparation

The next existing-inventory cohort is create-package.test.ts,
create-package-lab.test.ts and delete-package.test.ts. The current source has
17, 10 and 13 runPromise boundaries respectively. The historical inventory
also contains earlier property migrations that require separate attribution.

All 62 expanded baseline cases pass on Node and Bun, with no temporary residue.
A dedicated TMPDIR root is used per runtime and removed by the harness.
Recorded wall times are 12.084 seconds on Node and 6.224 seconds on Bun; source
hashes, runtime versions, workstation load and pressure are retained. The
baseline overlaps the previous grouped package proof and is not a performance
claim.

The private migration draft moves the 40 runtime boundaries to public
it.effect and introduces one serial public service fixture per file. It
preserves all 321 audited assertion trees: 147 create, 113 lab and 61 delete,
including custom expectation helpers. Original registration options remain.
The two block-bodied delete callbacks keep their per-test spawned arrays and
terminal return positions. Per-case fake spawners and the non-CI configuration
provider are preserved as explicit service overrides.

Create fixtures will reuse the existing temporaryWorkingDirectory constructor,
then create `.git` only after cwd restoration and directory cleanup are
registered. Injected chdir and mkdir failures reproduce the original leak in
both helpers on Node and Bun. The private controls restore cwd and remove their
own leaked directories. The delete fixture will use a scoped temporary
directory and the same existing cwd constructor. All resource wrapper uses
are terminal in their owning callbacks, including through the named bootstrap
helpers; the source audit found no post-wrapper assertions.

Fresh per-case consoles supplement the existing explicit console boundaries.
The narrow withBunShim environment wrapper remains unchanged. It disappears
from the detector after nesting under the public fixture callback, so its
historical judgment stays open. Its disappearance is not a resolved finding.
The preview has only native-platform findings, but that is weaker than a full
semantic inventory result. No baseline update is proposed.

No direct clock, sleep or timeout APIs were found in the CreatePackage or
DeletePackage command trees. The draft adds no blanket live clock override;
execution still must verify native subprocess and transitive service behavior.
At this preparation checkpoint, none of the three source files has changed.
Draft typechecks, actual execution, repair controls, final ratchet and grouped
package proof remain pending until the previous package proof is terminal.

The two private create constructors now pass Node/Bun controls for success,
body failure, interruption, chdir failure and mkdir failure, always restoring
cwd and removing the directory. These are draft-only controls; after applying
the guarded source changes, re-extract the actual constructors and repeat them.
