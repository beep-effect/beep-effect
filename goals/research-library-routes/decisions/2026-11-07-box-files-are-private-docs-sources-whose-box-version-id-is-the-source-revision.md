---
title: "Box files are private docs sources whose Box version id is the source revision"
date: 2026-11-07
lane: "feat/research-library-routes"
reversal: "Model Box files under a new source kind via an ontology-core change, or record the version only in capturedRevision"
---

LibrarySourceKind is ontology-core's vocabulary, so Box files are kind docs at https://app.box.com/file/<id> and route to box by locator. The version id is the source revision so a new Box version is acquired once and old captures stay valid; capturedRevision is <fileId>:<versionId>. Sources and artifacts default to private (--box-public opts out). An explicit DMS_BOX_USER_ID wins over the enterprise subject because the service account returned an error for a user-owned file in the live probe.
