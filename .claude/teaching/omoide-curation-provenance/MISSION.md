# Mission: Omoide source provenance and rights attestations

## Why
Benjamin has to sign real provenance and rights statements for the first Omoide still-curation
pilot (subject `aubri`, 12 T7 files) using his own passkey. Those statements are written verbatim
into the registration manifest and gate what may be trained on. He wants to sign them
understanding exactly what each field claims, so the pilot's evidence is honest and defensible.

## Success looks like
- Explain, without notes, the difference between `original_capture`, `non_generative_derivative`
  and the refused kinds, and why the registry refuses `unknown`.
- Write the ancestry statement, rights statement and evidence reference for the aubri manifest
  himself, and say what each one does and does not prove.
- Predict what the registry will do with a given manifest (accept, refuse, and the error code).

## Constraints
- Explanations "like I'm 5" first, then the schema/type view (he learns through types, flows and
  diagrams).
- Lessons must be short; he is mid-deployment and reads between steps.
- Everything must cite the repository's own contract docs, not general AI-provenance lore.

## Out of scope
- WebAuthn internals (a separate mission if wanted).
- Legal advice on image rights; the lesson explains what the software records, not what the law
  requires.
