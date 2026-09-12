# Typeface choice and license receipts

Revised 2026-09-11 after Benjamin replaced the Terminal of Record direction
with a standard product site in his own palette (deep green + parchment). All
faces are SIL Open Font License 1.1; the license texts ship beside the
binaries under `apps/todox/public/fonts/OFL-*.txt`. Self-hosted as woff2
(converted from the google/fonts upstream TTFs with `woff2_compress`).

| Role | Face | Files | License | Why it won |
| --- | --- | --- | --- | --- |
| Display | Fraunces (variable: opsz, wght, SOFT, WONK) | `Fraunces-Variable.woff2`, `OFL-Fraunces.txt` | OFL 1.1 | A warm old-style display face that gives the parchment-and-green world an editorial voice; the optical-size axis keeps the 4.5rem hero and the 1.45rem pillar headings in one family. |
| Body | Geist (variable wght) | `Geist-Variable.woff2`, `OFL-Geist.txt` | OFL 1.1 | A clean, contemporary sans for reading measure and UI; pairs with Fraunces without competing, and the weight axis covers buttons, labels, and body. |
| Records and code | Martian Mono (variable wght, wdth) | `MartianMono-Variable.woff2`, `OFL-MartianMono.txt` | OFL 1.1 | Tabular by construction for the session console; width and weight axes carry the three actor voices without a second face. Retained from the first build. |

Retired 2026-09-11 with the Terminal of Record world: Courier Prime and
Workbench (both OFL) were removed from `public/fonts`.

Calibration ban list respected: no Space Mono, no IBM Plex, no Inter as
display.
