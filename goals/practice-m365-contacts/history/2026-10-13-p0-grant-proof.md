# Contacts grant observations

The orchestrator handback records:

```text
2026-10-13T19:12:05Z contacts-inscope attorney=True other=False
```

The `Application Contacts.ReadWrite` assignment uses scope
`beep-practice-contacts-mailbox`. Existing Mail.ReadWrite, Mail.Send and
Calendars.ReadWrite authorization rows are True for both mailboxes under the
shared docket scope. This worker changes none of those assignments.

The exact suppressed contacts-env verification passed. The first wrapper
launch could not reach the user bus; its admitted replacement used the standard
user-systemd environment and reached Graph. The fixed folder-list test alone
runs; three unrelated/write tests are skipped on every attempt.

| Probe | UTC start | Result |
| --- | --- | --- |
| 1 | 19:14:35 | HTTP 403 |
| 2 | 19:25:14 | HTTP 403 |
| 3 | 19:35:29 | HTTP 403 |
| 4 | 19:46:16 | HTTP 403 |
| 5 | 19:56:58 | HTTP 403 |
| 6 | 20:07:30 | HTTP 403 |
| 7 | 20:17:54 | HTTP 403 |
| 8 | 20:38:24 | HTTP 403; ten-minute heavy admission wait |
| 9 | 20:56:10 | HTTP 403; seven-minute heavy admission wait |
| 10 | 21:17:50 | Pass; submitted for 21:06:10, delayed by heavy admission |

Retries followed the ten-minute propagation interval. The last retry was
submitted before the two-hour deadline and passed after its heavy admission
wait. No subsequent retry was submitted. The provisional stop assessment at
the deadline was superseded by this terminal result; runtime access is proven.
Export and the online plan must still precede every live write.
