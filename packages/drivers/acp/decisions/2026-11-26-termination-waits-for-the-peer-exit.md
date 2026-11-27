---
title: A broken pipe resolves to the peer's exit when the classifier reports one, within a five-second bound
date: 2026-11-26
reversal: Terminate with the pipe failure directly in terminateWithPipeFailure and drop ACP_PROTOCOL_TERMINATION_CLASSIFICATION_TIMEOUT.
governs:
  - src/AcpProtocol.service.ts#ACP_PROTOCOL_TERMINATION_CLASSIFICATION_TIMEOUT
  - src/AcpProtocol.service.ts#makeAcpPatchedProtocol
enforcedBy: []
---

A child's pipes break when it exits, so the writer's stdin sink and the reader's stdout stream can fail before the ended stdout reports the exit status, and the first of them ends the connection. With a classifier, such a pipe failure resolves to `AcpProcessExitedError` when the classifier reports one; any other classification, and one past the timeout, keeps the pipe failure.
Reason: the terminal error must not depend on which side noticed first. The bound exists because a peer that closes stdout but keeps running would otherwise hold every caller until it exits.
Rejected: the first-noticed pipe failure as the terminal error, and an unbounded wait for the exit status.
