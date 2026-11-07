# Original extraction corpus through default production assembly

Both focused and complete public extraction corpus replays now build
`CitationEngineDefaultLive` through the shared default-engine fixture. The
previous replay used the separately configured Layer with preassembled owners.
The source resolver now checks the operation admission owned by the default
Layer, and final quiescence checks use its operation and native admission owners.
The actual child spawner still records independent exit acknowledgements.

No expected source outcome, source document selection or semantic comparison is
changed. The replay still compares all eight citation families, original cleaned
plain text, source metadata, candidate and selected editions, vocabulary
identities, full spans and pin-cite-inclusive spans. HTML documents enter as raw
markup with the production HTML cleaner selected. Resolution is required to
finish but is not independently qualified by the extraction expectations.

The focused replay selects seven source documents on each runtime. The complete
36-document replay remains in the hosted integration suite for both Bun and
Node. Completion of that hosted replay must be checked at the published head;
this change does not itself establish its result. The controlled missing-page
identity provider remains test-only, and no production identity allocator is
claimed. Full source/donor accounting, representation laws, safety/scaling and
final lifecycle acceptance remain open.

Server package lint/types and the scoped Fallow new-only audit pass with zero
introduced findings. Both focused runtime tests pass (176.88 seconds), replaying
seven original source documents on each runtime through the default Layer.
The broader cheap-gates scan identified a Bluebook Option-none comparison; it
now uses upstream `assertNone` with the same operand. All eight Bluebook tests
pass (30.87 seconds), including both 100-example properties. A direct rerun of
the canonical detector on that file returns zero findings. The complete broad
cheap-gates run is not claimed green: it also reported a Fallow dependency
inventory finding, while the scoped new-only audit passes. No inventory baseline
is refreshed. Full hosted integration remains pending.
