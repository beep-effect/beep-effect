// Micro greedy line-breaker: pure arithmetic over pre-measured word widths.
// The 20-line kernel of the layout-as-unit-tests proof — see README.md.
// Deliberately NOT pretext (no segmentation, no glue rules, no engine
// profiles): just enough to prove the metrics-value pipeline. Trailing
// collapsible spaces hang at line end (the pretext RESEARCH.md lesson), so a
// break is charged `space + word`, never a dangling space.

export type WordMetrics = {
  readonly words: Readonly<Record<string, number>>;
  readonly spaceWidth: number;
};

// Content-aware minimum: the tightest width at which the text stays on one
// line — pretext's "shrinkwrap" (missing from the web platform), and exactly
// the pure input a dock constraint solver needs ("this panel's title wants
// 142px") without ever asking the DOM.
export const naturalWidth = (sentence: string, metrics: WordMetrics): number => {
  let total = 0;
  let first = true;
  for (const word of sentence.split(" ")) {
    const w = metrics.words[word];
    if (w === undefined) throw new Error(`unmeasured word: ${word}`);
    total += first ? w : metrics.spaceWidth + w;
    first = false;
  }
  return total;
};

export const layoutLineCount = (
  sentence: string,
  metrics: WordMetrics,
  maxWidth: number
): number => {
  let lineCount = 0;
  let lineWidth = 0;
  let lineEmpty = true;
  for (const word of sentence.split(" ")) {
    const w = metrics.words[word];
    if (w === undefined) throw new Error(`unmeasured word: ${word}`);
    const needed = lineEmpty ? w : lineWidth + metrics.spaceWidth + w;
    if (!lineEmpty && needed > maxWidth) {
      lineCount += 1;
      lineWidth = w;
    } else {
      lineWidth = needed;
      if (lineEmpty) {
        lineCount += 1;
        lineEmpty = false;
      }
    }
  }
  return lineCount;
};
