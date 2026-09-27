# NLP inventory identity reconciliation

The frozen detector inventory has 97 identities; the current-main baseline
had 102. Their union contains 113 identities. Sixteen current identities are
added without deleting or replacing any frozen evidence. These counts include
line/occurrence drift and must not be presented as 113 distinct source defects.

Forty-one detector rows now cite existing implementation commits: eighteen
assertion rows, twenty-two native property registrations, and the CoreModels
native runner import. Five human property rows likewise cite the committed
monoid/floor or graph payload-law changes. Seventy-two detector rows and the
remaining human findings stay open pending a commit for the staged repairs.
No synthetic fix SHA is used for staged work.

The updated five-lens inventory passes strict validation with zero missing
coverage. No-findings rows remain reasoned coverage records, not outstanding
actionable work. This reconciliation does not claim P1 acceptance or closure.
