# Pretext scope phase

Seven original scoped-provider call sites now register isolated native layer
blocks: four canned-fixture cases and three native browser-service cases. Each
block has an explicit ten-second hook budget. The fixture layer decodes static
metrics; the native service layer contains the real browser implementation.
Neither acquires a live provider or substitutes the DOM/canvas subject.

Every original generator body, expected value, test name and skip condition is
preserved by a token comparison against the seven reviewed wrapper edits. The
models and equivalence files remain byte-identical. No provider helper is copied
or added. Node and Bun each pass 24 cases and retain one existing browser-only
skip across four suites. Whole-command observations are 3.520199 and 1.416128
seconds respectively; source hashes remain stable. Full package audit and
docgen pass. The existing browser skip is not credited as executed coverage.
