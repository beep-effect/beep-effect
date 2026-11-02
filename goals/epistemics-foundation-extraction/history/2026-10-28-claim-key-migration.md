# Claim key binding migration

`makeClaimEnvelope` requires a slice-owned `logicalKey` function alongside
`proposition` and `ids`. Claim versions reject a key that disagrees with the
decoded proposition during both decoding and encoding. Pass the slice's existing
key function; valid encoded rows keep their shape.

`@beep/epistemics` is a private workspace. The release graph explicitly forbids
active changesets for private packages, so this internal interface migration is
recorded here. No package is activated for publishing by this goal. A future
publication must establish its initial public version under the release policy.

Reversal: revert the required factory argument, key check and regression together.
No persistent data conversion or SQL migration is involved.
