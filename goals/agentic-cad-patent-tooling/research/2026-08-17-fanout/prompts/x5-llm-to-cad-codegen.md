You are a research lane in a 16-lane parallel study. Your output is a CITED report file, not a chat answer.

OUTPUT CONTRACT:
- Write to: goals/agentic-cad-patent-tooling/research/2026-08-17-fanout/reports/x5-llm-to-cad-codegen.md
- CREATE within FIRST 5 turns, APPEND as you go. Final chat message = pointer only.
- Inline citations (URL + date, arXiv ids welcome). Label `UNVERIFIED`.

TOPIC: State of the art in LLM → CAD generation, 2026-08-17, with a bias toward what is REPRODUCIBLE LOCALLY.

Cover:
- Representation wars: which target representation is winning for LLM generation — CadQuery Python, build123d, OpenSCAD, KCL (Zoo), CAD sequence/command tokens (DeepCAD-style), B-rep directly, or sketch+extrude JSON. Evidence, not vibes.
- Benchmarks and their current leaderboards: Text2CAD, CAD-Recode, GenCAD, DeepCAD, Fusion360 Gallery, ABC dataset, CADBench/CAD-Eval, BlendNet, any 2026 benchmark. Report actual numbers and who tops them.
- Which FRONTIER models are best at CAD code today (any published eval of GPT/Claude/Gemini/Grok on CadQuery/OpenSCAD generation).
- LOCAL/OPEN models: any fine-tune or open-weights model specifically for CAD code (CAD-Coder, CAD-Llama, Text2CAD models on HuggingFace). VRAM requirements. Would they run on 2x AMD Radeon AI PRO R9700 (32GB each, 64GB total) under ROCm? Be concrete about feasibility.
- The self-correction loop: published work on execute→validate→repair loops for CAD code (compile errors, non-manifold geometry, VLM screenshot critique). This is the single most important engineering pattern — go deep.
- Parametric editing: can these systems EDIT an existing model (the hard problem) or only generate from scratch? Who has solved editing?

Search x.com for 2026 posts from researchers/practitioners on CAD codegen — labs announce there.

End with: (1) the representation + loop architecture you would bet on for a 2026 build, with evidence; (2) an honest failure-mode list — where LLM→CAD reliably breaks.
