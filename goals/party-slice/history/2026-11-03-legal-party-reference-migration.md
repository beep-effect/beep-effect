# LegalPartyReference migration (2026-11-03)

## Internal breaking change

Rename the law-practice `Party` aggregate to `LegalPartyReference`. Import the
new name from the package root or `entities/LegalPartyReference`; the old
aggregate and module path are removed. The shared integer `PartyId` and record
fields remain unchanged. Identity resolution belongs to the party slice.

Update imports from `@beep/law-practice-domain` to use `LegalPartyReference`
instead of `Party`. Direct entity imports move from `entities/Party` to
`entities/LegalPartyReference`. There is no compatibility re-export of the old
aggregate. Existing PartyId values and record fields are preserved; no table or
stored-row migration is introduced.

## Release policy

`@beep/law-practice-domain` declares `private: true`. The repository's
[private release-note reset](../../../standards/architecture/DECISIONS.md)
and [changeset policy](../../../.changeset/README.md) prohibit pending release
notes for private workspaces. The initial major changeset was therefore removed
after PR #2658's hosted Repo Sanity check and the local source checker both
rejected it. This migration note retains the breaking-change guidance without
publishing the workspace or changing the release policy. A future deliberate
public release must evaluate the API version under the then-current policy.

## Reversal

Restore the prior entity name and import paths together, using the parent
version in git, and rerun law-practice package verification and boundary scans.
No persisted data needs conversion. The removed release-note text remains in
this note and in commit `a7174da5f5` for auditability.
