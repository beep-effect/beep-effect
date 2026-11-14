---
title: "Stop B1 at the shared HTML cleaner Markup boundary"
date: 2026-11-14
reversal: "Resume lane wiring after the cleaner boundary is included in an amended design."
---

B1 is stopped before the lane service contract. MarkupWorker serves both XmlWorker (which reads CitationInvocation) and HtmlWorker. BuiltinCleaners constructs HtmlWorker and exposes CitationBuiltinCleaners.invoke with R=never. Routing every MarkupWorker start through invocation.lane.start introduces CitationInvocation into that closed cleaner service; the binding design only exempts Recognizer. An optional lookup or independent fallback would violate the hard invocation authority and would not prove the one-lane bound. Proposed reshape: explicitly scope B1 lane wiring to invocation-owned Xml work, retain the standalone HTML cleaner owner behind its existing boundary, and specify how engine clean propagates lane authority through the cleaner port before migrating that path. Do not weaken the cleaner service contract, queue guards or retirement. Independent limits-policy v2 work is retained; native wiring and real-process proofs are not implemented.
