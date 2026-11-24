---
title: "The DailyNotice draft-path test is a new schema test"
date: 2026-11-24
lane: "p6"
reversal: "Fold the assertions into an existing DailyNotice test file if one is added."
---

Design path 7 names a DailyNotice schema test to edit, but none existed on this head. DailyNotice.schemas.test.ts is new: the encoded NoticeMessage definition has exactly the subject and body fields, both required strings, so a draft can carry no matter or client field. The definition allows additional properties, which is the schema encoder's default, so the test does not assert a closed object.
