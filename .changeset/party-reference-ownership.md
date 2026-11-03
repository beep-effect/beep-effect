---
"@beep/law-practice-domain": major
---

Rename the law-practice `Party` aggregate to `LegalPartyReference`. Import the
new name from the package root or `entities/LegalPartyReference`; the old
aggregate and module path are removed. The shared integer `PartyId` and record
fields remain unchanged. Identity resolution belongs to the party slice.
