# Omoide source provenance Resources

## Knowledge

Paths below are on the workstation, outside this repo; the Omoide checkout root is
`$HOME/YeeBois/workstation-apps/Omoide-ux7`.

- Repo doc: `$HOME/YeeBois/workstation-apps/Omoide-ux7/docs/curation/source-registration.md` (branch codex/curation-human-authority).
  The contract for the registration manifest: fields, ancestry kinds, what is refused, and the
  "operator attestation, not verified fact" trust boundary (lines 72–84). Use for: any question
  about what a manifest field claims.
- Repo doc: `$HOME/YeeBois/workstation-apps/Omoide-ux7/docs/curation/production-authority.md`.
  Grants, passkey ceremonies and decision binding. Use for: what a human accept actually signs.
- Repo doc: `$HOME/YeeBois/workstation-apps/Omoide-ux7/docs/curation/deployment.md`.
  Register-inside-the-runtime, verify/reattest after restarts. Use for: why volume identity matters.
- Repo code: `$HOME/YeeBois/workstation-apps/Omoide-ux7/app/services/curation_registration.py`.
  The validator that enforces the rules above. Use for: the exact error codes.
- Handoff: `$HOME/ai/docs/implementation/krea2-curation-production/pilot-checklist.md`.
  What only Benjamin can supply for the pilot. Use for: the list of decisions this mission serves.

## Wisdom (Communities)

- None yet. This is a private, in-house contract; the practitioners are the people who wrote the
  Omoide curation docs (this agent lineage) and Benjamin himself.

## Gaps

- No external, high-trust source has been vetted for image provenance standards (C2PA / Content
  Credentials) in this workspace. Add one only after reading the current spec, not from memory.
