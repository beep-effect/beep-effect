# Consolidated delivery

On 2026-09-27 the operator directed the remaining goal work to ship in one PR
and reaffirmed permission to merge that PR after review and required checks.
This supersedes D13 separate-PR packaging and the previous per-wave delivery
approach. Dependency ordering, D12 phase order, assertion preservation, test
floors, exception review, and final acceptance remain binding.

The integration branch starts from main at `1f7a14ec4e03a06a7c790f23c5bb31006dc484db`. Constituent heads are
retained in Git history, preserving their repairs and evidence. Package receipts
remain historical proofs of their recorded inputs; fresh combined proof is
required before merge.

## Constituent PR heads

| PR | Head |
| --- | --- |
| #1281 | `166721d72c510a04092462f15fbdb5bd8c06e736` |
| #1282 | `769c458492713cf271732e5e10ecb37a7f1a046e` |
| #1285 | `565bb88600adf02484675d941e786942f87d9d1b` |
| #1287 | `29c8d7355d6f3c8315d7cdef5780a7a787a2781d` |
| #1290 | `3d79b3530aa77ccf6d3af7005a8cf9e02db5d489` |
| #1293 | `abb9ab2cea6b289dfb1e89de2b1495d1bda87216` |
| #1294 | `80e01f276dbd9420cc6d19573ebd67fa4e3cf56b` |
| #1295 | `9ab680a91284e255bc389cc70980ef502f0af6d3` |
| #1296 | `c03a3983e8839e13597791e8ca2569b4b9c0e356` |
| #1297 | `09a8f7339788aadabce6933897d8c03ce65b2419` |
| #1298 | `4fd64599c9b8cd4f3b456d4cc3b545b82ad108e8` |
| #1299 | `6ad006114beb6e0fa00adcc71636e8b233b50806` |
| #1300 | `9b8d959e1d641dc40b4aa6e6138445790ead670b` |
| #1301 | `a97ca9c183b2cf7cdacb4a5c78bfcb5b949bbaae` |
| #1302 | `441bfec4e5acf966cf893ee5ab4b40aacef96b8f` |
| #1303 | `91a23ba8a3c697c32c3c59f30bcf3d9c4c07f043` |
| #1304 | `3194e465b6c74077ef53af50ec25c6cb172163d7` |
| #1305 | `95738112455580bb379b3b87f3173c63ef488da7` |
| #1306 | `46452d68158d07cb817e3454e892273ef93aa76d` |

## Closeout

Do not close a constituent PR until its recorded head is an ancestor of the
consolidated branch and that branch is published. Carry forward outstanding
review findings. Preserve old branch references until integration is verified.
Continue the existing legitimate inventories before the final remainder census.

## Initial integration verification

All 19 recorded heads are ancestors of the integration branch. All 249 changed
package/app file versions match their originating branch exactly. The cache
review basis digest matches its receipt. The configured Effect Vitest ratchet
scanned 1,177 files and reported 7,005 findings with zero introduced and zero
resolved findings against the combined baseline. This is ratchet evidence, not
goal completion or full repository proof.

The old per-PR local jobs were explicitly stopped as superseded. Their terminal
results and prior failed hosted jobs are historical evidence, not passing credit.
