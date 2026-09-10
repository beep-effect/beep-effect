---
"@beep/repo-cli": patch
---

Keep the journal-lock reap adopter election exclusive: a contender whose adopter
listing predates the winner's claim rename could recreate the claim from the
still-dead lock and adopt a second time. The election now re-checks after the
claim link and drops a claim it recreated while a live adopter exists.
