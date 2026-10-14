# P2 first-wave freeze amendment


### 2026-10-14: ordinals 8–9 freeze amendment under the 06:25Z fallback

The orchestrator explicitly permits a freeze amendment when the unchanged
launcher cannot execute from another worktree. Inspection proves that it
unconditionally changes directory to the corpus-restore lane before invoking
bun. Starting that launcher from an execution-only worktree would therefore
still execute this lane. Altering the launcher or shadowing command resolution
would change its frozen identity. No execution-only worktree was created.

Decision: use the ruling's fallback for unstarted ordinals 8 and 9 in this
lane, before either family-run-start. Original code head remains
6eb3d036771e868768846b3c56a5aafac69c3b2b in every immutable manifest.
Amended execution source is the restoration source at 17f42f572f4563289e07dc9d0affd9f6aa875e76.
Attached identity delta: history/evidence/p2-first-wave-2026-10-14-freeze-amendment.patch
(SHA-256 dfc0f6c519ad5c2f2dfb477032fdedee77e8e42aecc83878d76b8b0ef4a26bf2). It contains two inherited
#1636 native-array-to-Effect-Array.every substitutions, in signatureExtension
and isCompoundFileBinary. Restoration command, schemas and base writer source
are unchanged; libpff source is unchanged. No behavior equivalence is claimed.
This amendment governs only the two unstarted families; all earlier seals
retain their actual execution identities. The execution commit will be recorded
in the handoff immediately before launch, with this source delta unchanged.

The launcher, nine manifests, engine versions, membership, policy identities
and ceilings remain unchanged: ratio 4, attempt 7,200,000 ms, family
43,200,000 ms, output 2,147,483,648 bytes, 100,000,000,000-byte floor.
Five families are accepted; families 5 and 7 remain sealed failures.
Separate post-wave recovery covers their parser and elapsed-budget classes;
no sealed family is retried. Reversal: revert this documentation amendment
before launch; after launch retain all ledgers, claims, output and manifests
and revert only the documentation decision. No source or launcher edit.
