---
"@beep/law-practice-server": minor
"@beep/practice-mail-tagging": minor
---

Take matter contact addresses from the practice KG's correspondent tables
behind a new switch, `PRACTICE_MAIL_TAGGING_CONTACT_EVIDENCE` (`off` by default,
or `kg`): only addresses the KG resolves to one matter count, and
`matter-contacts.json` becomes an optional addition read only under `kg`.
Mailbox addresses in quoted or `Name <addr>` form are read as the bare
lowercased address.
