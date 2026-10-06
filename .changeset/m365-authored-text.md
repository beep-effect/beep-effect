---
"@beep/m365": minor
---

Add `getMessageAuthoredText`: a read-only verb that `$select`s `uniqueBody`, `from`, `sender`,
`internetMessageId`, and `receivedDateTime` and sends `Prefer: outlook.body-content-type="text"`.
Its response schema requires a plain-text `uniqueBody`, so an HTML body fails to decode rather
than falling back to the full `body` or to tag-stripping. `getMessage` and `GraphMessage` are
unchanged.
