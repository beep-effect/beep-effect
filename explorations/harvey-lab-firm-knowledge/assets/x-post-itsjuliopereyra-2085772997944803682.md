# Post by @ItsJulioPereyra

Author: Julio Pereyra @ItsJulioPereyra
Posted: Fri, 07 Aug 2026 17:00:09 GMT
URL: [https://x\.com/ItsJulioPereyra/status/2085772997944803682](https://x.com/ItsJulioPereyra/status/2085772997944803682)
Likes: 175 | Retweets: 18

## Post

We are open-sourcing our next LAB expansion: a synthetic law firm, Calderwood &amp; Harkness (“C&amp;H” or “the firm”). Built in collaboration with @engramlab, the firm contains work product from more than 250 client matters, comprising nearly 10,000 files and more than 100 million tokens.

The environment contains 250 tasks spanning various forms of knowledge retrieval and reasoning. Each task mirrors the type of retrieval and reasoning tasks a firm might ask of their document management systems and is designed to be a stress-test of agent capabilities — the context needed to answer any one of these questions is distributed, there are often no keywords to grep for, and at 100 million tokens the corpus is too large to exhaustively search.

In this post, we describe how law firms are structured, how we built a grounded, synthetic law firm environment that mirrors that structure, and what baseline runs reveal about current agents’ ability to access scaled knowledge corpora.

## How a Law Firm is Structured

Law firms organize their work through a common set of relationships: clients for whom they work and matters that they work on for those clients. We ground C&amp;H in these core relationships.

The firm has 46 fictional clients, representing different corporations and individuals for whom it works. We intentionally define diverse clients to get a broad range of work — PE firms require different legal services than industrial manufacturers.

The firm works for those clients across distinct practices. These practice areas represent different types of legal expertise ranging across common practice groups at medium-sized and large law firms.

The actual work done by the firm is represented by client matters. A client can have many matters and matters may involve lawyers from multiple practice areas. The firm currently has 266 in progress or completed matters in its file system.

These three concepts set the scope of C&amp;H: who is it working for, what expertise can it bring to bear, and what specific projects is it working on.

## Building the Dataset

Each client matter starts with a specification that defines relevant firm structural details: which client it is for and what is the general shape of the project. These are then enriched by a concrete set of substantive facts that the matter must contain in order to ground a particular task.

These can be narrow facts — a 10% escrow or a two-year non-compete in a particular agreement — or structural ones: a litigation was dismissed or settled. These features allow us to define and review ground truths from short specifications rather than a large, unstructured corpus. Overall, a matter can be specified in around 1,000 tokens while carrying many task-salient features.

Our synthetic data pipeline then renders each specification into a file system of 10-200 realistic documents (depending on matter state, size, and type) that express the relevant features. Features are pinned to specific documents to allow features to be traced to both the matter and file level. The matters themselves are loosely structured collections of files that contain the major aspects of a matter: engagement, execution of phases, major decisions and final outcomes. The exact filesystem is not standardized and reflects logical organization based on matter types, partner preference, and how any specific matter unfolded.

## Environment and Task Definition

The firm’s matters are treated as a persistent corpus with every task running against the entire file system. The tasks themselves are enumerated against the short-form specifications of matters, with ground truths computed as matters or documents containing a particular mix of features. A matter's underlying features are not shown to agents at run-time, they must recover them from the unstructured file system through a mix of search and reasoning.

Although the features themselves are structured, they allow for flexibility in expressing various types of search and reasoning tasks. These include searching for precedent, understanding industry trends, and identifying client-level preferences or outcomes.

In standard LAB form, agents are graded using LLM judges against a rubric that elaborates the ground-truth into atomic criteria required for successful task completion.

## Current Performance

We measure baseline performance using the standard LAB harness as well as two strong foundation models: GPT-5.6-sol and Opus-4.8. We find that both struggle on overall task performance, as well as latency-effective performance. Both solve a common set of easy tasks, and a unique set of harder tasks but take five or more minutes per task and satisfy only around half of all grading criteria.

From reviewing trajectories we would expect both cost and latency to increase with corpus size, which poses real problems for true enterprise scale corpuses which can exceed C&amp;H by multiple orders of magnitude.

Failures are largely explicable by an inability to comprehensively search and understand the corpus. Models mostly reason correctly about what they find, but often fail to find every relevant piece of information.

This failure mode is particularly severe on tasks requiring enumeration of a large set of relevant matters, files, or pieces of information. As the number of atomic points required for successful task completion increases, both models regress to 0% all-pass.

This is not a failure of search strategy. Agents consistently find the core information and satisfy around half the criteria. It is instead a failure to know when to keep looking for additional information. This suggests that agents do not build an effective intermediate model of what the corpus contains that allows them to know when their searches have been sufficiently exhaustive.

Successful task completion against enterprise knowledge requires improving this particular capability.

## Conclusion

Legal work requires an understanding of how a problem relates to prior work: which precedent is relevant to a client or what market standard looks like. Today's agents attempt to derive that knowledge from scratch on every task.

C&amp;H shows that this strategy is costly and weak at enterprise knowledge scale. We think that a promising direction to improve agents in this capacity is to allow them to build richer representations of the corpus up front — indexes, summaries, memory — and amortize the cost of building such representations across subsequent runs. Because the environment is persistent, these one-time understanding costs pay off across many tasks. We’ll be sharing more about our work here soon.

The synthetic law firm data we created for this post is available in our open source repo. The current version of C&amp;H covers only part of the work performed by a law firm, and its tasks represent only a subset of the questions lawyers may want to ask of their institutional knowledge. We plan to add to both over time.

We’d particularly like to thank the following contributors for their feedback on both the dataset and write up: Dan Biderman (Engram), Jessy Lin (Engram), Mayee Chen (Engram), Neel Guha (Columbia Law School / Engram), Shizhe He (Engram), Calvin Qi (Harvey), Gabe Pereyra (Harvey)

## Thread

### 1. Thread Post
Author: @EngramLab
Posted: Fri, 07 Aug 2026 17:31:20 GMT
URL: [https://x\.com/EngramLab/status/2085780845793784219](https://x.com/EngramLab/status/2085780845793784219)

> Calderwood &amp; Harkness is nothing without its people ❤️

Likes: 19 | Retweets: 0

### 2. Thread Post
Author: @DivinciAi
Posted: Fri, 07 Aug 2026 17:13:55 GMT
URL: [https://x\.com/DivinciAi/status/2085776463236944252](https://x.com/DivinciAi/status/2085776463236944252)

> Love the collaborative and open spirit! 😃💕 We're going to crunch the docs into a custom (RAG /Supervised-Fine-Tuned) LLM and do a little write up on it! 📚👀

Likes: 9 | Retweets: 0

### 3. Thread Post
Author: @jeffreyhuber
Posted: Fri, 07 Aug 2026 20:08:00 GMT
URL: [https://x\.com/jeffreyhuber/status/2085820271903306220](https://x.com/jeffreyhuber/status/2085820271903306220)

> 100M tokens is ~0.4GB? i think you can ripgrep over that in &lt;500ms @jxmnop

Likes: 6 | Retweets: 0

## Top Comments

### 1. @EngramLab
Author: Engram
Posted: Fri, 07 Aug 2026 17:31:20 GMT
URL: [https://x\.com/EngramLab/status/2085780845793784219](https://x.com/EngramLab/status/2085780845793784219)

> Calderwood &amp; Harkness is nothing without its people ❤️

Likes: 19

### 2. @DivinciAi
Author: Divinci AI
Posted: Fri, 07 Aug 2026 17:13:55 GMT
URL: [https://x\.com/DivinciAi/status/2085776463236944252](https://x.com/DivinciAi/status/2085776463236944252)

> Love the collaborative and open spirit! 😃💕 We're going to crunch the docs into a custom (RAG /Supervised-Fine-Tuned) LLM and do a little write up on it! 📚👀

Likes: 9

### 3. @jeffreyhuber
Author: Jeff Huber
Posted: Fri, 07 Aug 2026 20:08:00 GMT
URL: [https://x\.com/jeffreyhuber/status/2085820271903306220](https://x.com/jeffreyhuber/status/2085820271903306220)

> 100M tokens is ~0.4GB? i think you can ripgrep over that in &lt;500ms @jxmnop

Likes: 6
