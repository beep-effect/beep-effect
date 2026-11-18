---
title: "Keep the Diff, Xml and annotation template owners per request"
date: 2026-11-13
lane: "perf/citation-hoist-installs"
reversal: "Hoist makeCitationDiffWorker, makeCitationXmlWorker and makeCitationAnnotationTemplates once the worker-v3 lane replaces their per-owner state."
---

Stop rule. The Diff and Xml workers wrap MarkupWorker, whose private semaphores would become engine-wide and whose native owner captures a Scope; sharing them would change process ownership and queueing between concurrent requests. They are not regex evaluator call sites, and goals/citation-regex-worker-v3 replaces them with the lane's one-occupant rule. makeCitationAnnotationTemplates captures the request reservation at construction, so AnnotationWrap installs its evaluator once and exposes the template constructor; makeCitationWrapAnnotationSpans builds the templates per request, where it built the whole wrapper before. The HTML discovery evaluator around the Diff worker is installed once (installCitationHtmlGeometry).
