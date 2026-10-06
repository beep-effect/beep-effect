# P10 — anchor dominance and correspondents, bundle `2026-10-07-01`

Date: 2026-10-07. Decisions: SPEC D-23, D-24. Counts only; no client data.

## Build

Same corpus root, salvage run, extraction and docket register as `-03`, plus
the attorney's normalised contacts (produced by the Box workstream's pass-2
table, out of the repo), and the practice's own mail domains (current and the
previous firm) so their addresses are marked. Claims carried from `-03`.

`verify.ts`: ok — 15,002 nodes, 6,597 edges, 187 matters, 572 dockets, 600
correspondent rows, 0 correspondents without a matter, 0 dangling edges, 0
unresolved references; 16 claims (14 with a source document). `--self-check`:
ok, store format 4, extension 0.4.0, 11 tools.

## `-03` -> `-04`

| | `-03` | `-04` |
| --- | --- | --- |
| Matters / with a client | 187 / 159 | 187 / 159 |
| Dockets | 572 | 572 |
| Application and patent memberships on dockets | — | +37 gained, 0 lost |
| Edges | 6,574 | 6,597 |

No matter or docket was added or dropped and no matter changed client. The
diff covered each docket's application and patent numbers, as the P9 process
change requires. The application that lost its matter in `-03` is attached
again, now as `mention-dominance`.

## Measured before choosing the D-23 thresholds

On `-03`, 61 anchors were cited by documents in attributed families: 35 in one
family, 26 in several. Of the 26, 4 had a client-keyed top family holding at
least 80% of the citing documents with at least 3; 9 more had a top family at
least twice the runner-up; 11 were weak; 2 had an unattributed top family.
The rule admits the first group only; the second stays mention-only.

## Correspondents

600 rows: 206 distinct addresses across 23 matters; 127 rows are the
practice's own addresses (marked, not removed); 96 rows join to a contact.
Contacts carry 225 client links: 95 from email the attorney filed in a client
folder, 80 from client-and-docket references in email subjects, 50 from
organisation-name matches. Of the non-practice addresses, 91 write about one
matter and the rest about several (up to 19, mostly foreign associates and
the previous firm), which is why an address never resolves a matter on its
own. 3 email documents had no readable header metadata and were skipped.

## Still out

19 files over 200 MB; 8 PDFs that time out; pages hit by Tesseract crashes;
USPTO enrichment for the working-files run; email attachments.
