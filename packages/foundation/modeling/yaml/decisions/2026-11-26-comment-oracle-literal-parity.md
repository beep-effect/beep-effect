---
title: The comment-model suite pins committed yaml@2.9.0 literals for comment attribution and emission only
date: 2026-11-26
reversal: Compare every case against a live YAML.parseDocument call at test time and pin the reference's full output bytes.
governs:
  - test/comment-model-oracle.test.ts#commentsOf
  - test/comment-model-oracle.test.ts#pairComments
  - test/comment-model-oracle.test.ts#collectCommentedScalars
enforcedBy: []
---
The node-level comment suite compares against literals authored once, offline on 2026-08-16 in a scratch script outside the test run, from `yaml@2.9.0` `YAML.parseDocument` (reading `node.commentBefore`, `node.comment` and `node.spaceBefore`, with re-emission through `String(doc)`), following the `ORACLE.md` convention of `oracle-differential.test.ts`. The oracle is not consulted by this suite: the committed literals are the contract and are never regenerated with this package's parser.
The literals pin comment attribution and comment emission only. Reference behaviour that is not a comment decision stays this package's own: the reference drops a root block scalar's body indent, respaces flow collections to `{ b: 1 }` and does not spill an over-long implicit key (see `explicit-key-spill`).
Rejected: computing expectations from the `yaml` devDependency at test time, which would let an oracle upgrade move the contract silently; full byte parity with the reference, which would adopt the three non-comment behaviours above.
