---
"@beep/law-practice-domain": patch
"@beep/law-practice-use-cases": patch
---

Stop adding `P: Unmatched - review` to below-threshold mail whose only
evidence is a contact address or domain. The review category now marks a
below-threshold decision only when its best candidate carries identifier
evidence (an application, patent, or docket number, or conversation
carryover); ambiguous and needs-attorney outcomes are unchanged.
