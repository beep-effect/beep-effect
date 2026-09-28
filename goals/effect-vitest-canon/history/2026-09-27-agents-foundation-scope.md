# Agents foundation scope phase

The domain source-import parity case now uses one isolated native
it.layer(NodeServices.layer) block with a ten-second hook timeout. Its entire
generator body is token-identical, and the rest of the file is unchanged apart
from removing the provider-helper import. It still recursively reads real agents
source, sorts paths and reports exact violating imports. No MemoryFileSystem
substitution or shared mutable service was introduced. Tables has no acquired
resource to restructure; its current source is unchanged in this phase.

Domain Node and Bun each pass all 22 cases. Whole-command observations are
3.821099 and 1.868178 seconds, with stable source hashes. Full domain audit
(13.3 seconds) and docgen (8.1 seconds) pass. The prior table baseline passed all
six cases under both runtimes and full package audit/docgen. No assertions,
schema domains, property floors, existing case deadlines or production code changed.
