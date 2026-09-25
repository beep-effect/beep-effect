# Corrected OBS local-owner ruling

The earlier private D1 recommendation was too strict and is superseded. It incorrectly required two Booleans inside the correlated cluster rather than in the actual complete scope. SPEC.md:33-38 defines the >=2 Boolean recall net per scope; SPEC.md:58-60 allows independently adjudicated clusters in a declaration; DECISIONS.md:117 explicitly admits Boolean/payload-presence E3. No binding text forbids preserving an independent existing axis when a real eligible owner contains that alias. SweepGitState's admitted one-Boolean/Option cluster in a larger Boolean-bearing owner is consistent with this reading.

At Obs.service.ts:179-188, sceneExists and inputCreated are both actual coexisting Boolean locals; existingSettings is their sibling Option payload. This complete local projection has8representable/4legal tuples. The scene axis remains independent; every combination of scene existence and global input existence remains supported. The E3 gap is solely inputCreated===O.isNone(existingSettings). No unrelated restriction or invented axis is needed.

Still reject historical16/4 and rawR33 eight/four based on sceneExists/sceneCreated/inputCreated: sceneCreated223 belongs to the returned EnsureQaSceneResult, not to the local scope. inputAttached203 is branch-local, not simultaneous with both alternatives of the parent carrier. The corrected row uses sceneExists/existingSettings/inputCreated and E3 only.

The corrected design removes the private alias, preserves the existing Option source and exported result Booleans, and performs no public-contract migration. The earlier D1 artifacts remain in superseded-minimal-cluster-ruling/ for candid provenance. Canonical inventory/design remain untouched. No implementation/P3/dry-round credit.
