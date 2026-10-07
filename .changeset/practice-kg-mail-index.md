---
"@beep/law-practice-domain": minor
"@beep/law-practice-server": minor
"@beep/practice-kg-mcp": minor
---

Read the corpus provenance message index into the practice KG build
(`--mail-index`) and place each archive message on a matter by the docket
reference in its subject line (`subject-reference`), so `matter_correspondents`
covers the mail archives; add `matchPracticeKgMatterReferences` and the
`correspondentMatters` verify count.
