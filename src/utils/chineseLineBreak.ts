export interface ChineseLayoutToken {
  text: string;
  width: number;
  /** Visible horizontal glyph bounds relative to the glyph origin. */
  ink?: { left: number; right: number };
  /** Inline annotations share the preceding token's line. */
  annotation?: 'script' | 'footnote';
  /**
   * A discretionary break after this token inside a word. `width` is the
   * hyphen added at the end of the line, 0 after an explicit hyphen.
   */
  hyphen?: { width: number; automatic: boolean };
}

export interface ChineseLayoutLine {
  /** Token range, excluding collapsible spaces at either end. */
  start: number;
  end: number;
  /** Positioning in pixels before each token, including quote alignment. */
  beforeAdjustments: number[];
  /** Space in pixels after each token, including quote alignment and trim. */
  adjustments: number[];
  /** Whether the line ends at an automatic hyphenation point. */
  hyphenated: boolean;
}

interface Glue {
  width: number;
  stretch: number;
  shrink: number;
  cappedStretch: number;
}

interface Metrics extends Glue {
  minimumWidth: number;
}

interface Breakpoint {
  end: number;
  next: number;
  /** Penalty for breaking here, as in Knuth–Plass. */
  penalty: number;
  /** Width added to the line when breaking here, e.g. a hyphen. */
  width: number;
  /** Flagged penalties (hyphens) incur double hyphen demerits. */
  flagged: boolean;
}

interface QuoteCell {
  before: number;
  after: number;
  blank: number;
  opening: boolean;
}

interface State {
  previous: State | undefined;
  start: number;
  end: number;
  ratio: number;
  fitness: number;
  demerits: number;
  flagged: boolean;
  hyphenated: boolean;
}

// W3C CLReq §6.1 and §6.3 distinguish break prohibitions from the
// sidebearings of full-width opening and closing punctuation.
const prohibitedAtEnd =
  /[([{（［｛〔〖【〘〚《〈「『｟“‘«‹]\p{Variation_Selector}*$/u;
const prohibitedAtStart =
  /^[)\]}）］｝〕〗】〙〛》〉「」『』｠“”‘’«»‹›、。，．；：？！,.!?;:%％‰°℃℉…‥—–ー々〻·‧・/／‐‑－-]/u;
const fullWidthOpening = /^[（［｛〔〖【〘〚《〈「『｟“‘]$/u;
const fullWidthTrailingSpace = /^[）］｝〕〗】〙〛》〉」』｠”’、。，．]$/u;
const fullWidthPunctuation = /^[、。，．；：？！]$/u;
const openingQuote = /^[“‘「『«‹]\p{Variation_Selector}*$/u;
const closingQuote = /^[”’」』»›]\p{Variation_Selector}*$/u;
const adjacentPunctuation = /^\p{Punctuation}\p{Variation_Selector}*$/u;
const eastAsianLetter =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const ideographic =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Extended_Pictographic}\u3000-\u303f\uff01-\uff60\ufffc]/u;
const westernAtStart = /^[\p{Script=Latin}\p{Number}%+]/u;
const westernAtEnd = /[\p{Script=Latin}\p{Number}%+]\p{Mark}*$/u;
const noBreakAtStart = /^[\u00a0\u2007\u202f\u2060\ufeff]/u;
const noBreakAtEnd = /[\u00a0\u2007\u202f\u2060\ufeff]$/u;
const emptyGlue: Glue = { width: 0, stretch: 0, shrink: 0, cappedStretch: 0 };
const epsilon = 1e-6;

// The parameters of typeset's common.py and full.py (TeX82 values).
const linePenalty = 10;
const hyphenPenalty = 50;
// typeset.py's penalty for a lone last word or character.
const runtPenalty = 50;
const infiniteBadness = 10000;
const doubleHyphenDemerits = 3000; // alpha
const adjacentDemerits = 3000; // gamma

function canBreakAfter(
  left: string,
  right: ChineseLayoutToken,
  hasSpace: boolean,
): boolean {
  if (
    right.annotation ||
    prohibitedAtEnd.test(left) ||
    prohibitedAtStart.test(right.text) ||
    noBreakAtEnd.test(left) ||
    noBreakAtStart.test(right.text) ||
    (!hasSpace && westernAtEnd.test(left) && westernAtStart.test(right.text)) ||
    (/[-+±−－＋\p{Sc}]$/u.test(left) && /^\p{Number}/u.test(right.text)) ||
    (/\p{Number}$/u.test(left) && /^\p{Sc}/u.test(right.text))
  ) {
    return false;
  }

  return (
    hasSpace ||
    ideographic.test(left) ||
    ideographic.test(right.text) ||
    fullWidthOpening.test(right.text) ||
    fullWidthTrailingSpace.test(left) ||
    fullWidthPunctuation.test(left) ||
    /[…‥—–]$/u.test(left)
  );
}

function punctuationTrim(
  token: ChineseLayoutToken,
  em: number,
  pattern: RegExp,
): number {
  // Half-width fallback glyphs and punctuation already narrowed by the font
  // may have no extra sidebearing to remove.
  return pattern.test(token.text) ? Math.max(0, token.width - em / 2) : 0;
}

function quoteCell(
  token: ChineseLayoutToken,
  hanWidth: number,
): QuoteCell | undefined {
  const opening = openingQuote.test(token.text);
  if (!opening && !closingQuote.test(token.text)) return undefined;
  const face = Math.min(token.width, hanWidth / 2);
  const left = token.ink?.left ?? (opening ? token.width - face : 0);
  const right = token.ink?.right ?? (opening ? token.width : face);
  const before = opening ? hanWidth - right : -left;
  return {
    before,
    after: hanWidth - token.width - before,
    blank: Math.max(0, hanWidth - (right - left)),
    opening,
  };
}

function punctuationBlank(
  token: ChineseLayoutToken,
  quote: QuoteCell | undefined,
  side: 'before' | 'after',
  fallback: number,
) {
  if (quote) return (side === 'before') === quote.opening ? quote.blank : 0;
  if (!token.ink) return fallback;
  return Math.max(
    0,
    side === 'before' ? token.ink.left : token.width - token.ink.right,
  );
}

function gapBetween(
  tokens: readonly ChineseLayoutToken[],
  index: number,
  punctuationSpace: number,
  em: number,
  hanWidth: number,
  pairCompression: number | undefined,
): Glue {
  const left = tokens[index]!;
  const right = tokens[index + 1];
  if (!right) return emptyGlue;
  if (pairCompression !== undefined)
    return { ...emptyGlue, width: -pairCompression };
  if (right.annotation) return emptyGlue;

  const before = left.text === ' ' ? tokens[index - 1]?.text : left.text;
  if (
    before &&
    ((eastAsianLetter.test(before) && westernAtStart.test(right.text)) ||
      (westernAtEnd.test(before) && eastAsianLetter.test(right.text)))
  ) {
    const existing = left.text === ' ' ? left.width : 0;
    return {
      width: hanWidth / 4 - existing,
      stretch: hanWidth / 4,
      shrink: hanWidth / 8,
      cappedStretch: hanWidth / 4,
    };
  }

  if (left.text === ' ') {
    return { ...emptyGlue, stretch: left.width / 2, shrink: left.width / 3 };
  }

  if (
    right.text === ' ' ||
    noBreakAtEnd.test(left.text) ||
    noBreakAtStart.test(right.text) ||
    (westernAtEnd.test(left.text) && westernAtStart.test(right.text))
  ) {
    return emptyGlue;
  }

  if (punctuationSpace >= em / 8) {
    const compressed = Math.min(em / 2, punctuationSpace);
    const punctuationPair =
      (fullWidthOpening.test(left.text) ||
        fullWidthTrailingSpace.test(left.text) ||
        fullWidthPunctuation.test(left.text)) &&
      (fullWidthOpening.test(right.text) ||
        fullWidthTrailingSpace.test(right.text) ||
        fullWidthPunctuation.test(right.text));
    if (punctuationPair) {
      return { ...emptyGlue, width: -compressed };
    }
  }

  if (prohibitedAtEnd.test(left.text) || prohibitedAtStart.test(right.text)) {
    return emptyGlue;
  }

  if (
    (left.text === '\ufffc' &&
      !left.annotation &&
      eastAsianLetter.test(right.text)) ||
    (eastAsianLetter.test(left.text) && right.text === '\ufffc')
  ) {
    return { ...emptyGlue, width: em / 8, stretch: em / 8, shrink: em / 16 };
  }

  if (ideographic.test(left.text) || ideographic.test(right.text)) {
    return {
      width: 0,
      stretch: em / 12,
      shrink: Math.min(em / 4, punctuationSpace),
      cappedStretch: 0,
    };
  }

  return emptyGlue;
}

function breakpoints(
  tokens: readonly ChineseLayoutToken[],
  hyphenate: boolean,
): Breakpoint[] {
  const points: Breakpoint[] = [];
  let next = 0;
  while (tokens[next]?.text === ' ') next++;
  const plain = { penalty: 0, width: 0, flagged: false };
  points.push({ end: 0, next, ...plain });

  for (let index = next; index < tokens.length; index = next) {
    const end = index + 1;
    next = end;
    while (tokens[next]?.text === ' ') next++;

    const left = tokens[index]!;
    const right = tokens[next];
    if (!right || canBreakAfter(left.text, right, next > end)) {
      points.push({ end, next, ...plain });
    } else if (
      left.hyphen &&
      next === end &&
      (hyphenate || !left.hyphen.automatic)
    ) {
      points.push({
        end,
        next,
        penalty: hyphenPenalty,
        width: left.hyphen.width,
        flagged: true,
      });
    }
  }

  // Like typeset.py's runt penalty: charge the last break between words or
  // characters, so a lone word or character on the last line costs more.
  for (let index = points.length - 2; index > 0; index--) {
    const point = points[index]!;
    if (point.flagged) continue;
    point.penalty += runtPenalty;
    break;
  }
  return points;
}

/** typeset's badness(): rounded, and infinite for overfull lines. */
function badness(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio < -1) return infiniteBadness;
  return Math.min(
    infiniteBadness,
    Math.floor(100 * Math.abs(ratio) ** 3 + 0.5),
  );
}

/** typeset's demerits(); the paragraph end is a forced break. */
function lineDemerits(badness: number, penalty: number, forced: boolean) {
  const demerits = (linePenalty + badness) ** 2;
  if (forced) return demerits;
  return penalty >= 0 ? demerits + penalty ** 2 : demerits - penalty ** 2;
}

function fitnessClass(ratio: number): number {
  if (ratio < -0.5) return 0;
  if (ratio <= 0.5) return 1;
  if (ratio <= 1) return 2;
  return 3;
}

function adjustmentRatio(
  difference: number,
  stretch: number,
  shrink: number,
  cappedStretch: number,
): number {
  if (Math.abs(difference) <= epsilon) return 0;
  if (difference < 0) return difference / Math.max(0, shrink);
  if (difference <= stretch) return difference / stretch;
  // Inter-script gaps reach their maximum at ratio 1. Further stretch comes
  // from the remaining glue, with the mixed-script width held constant.
  return 1 + (difference - stretch) / Math.max(0, stretch - cappedStretch);
}

function chooseBreaks(
  points: Breakpoint[],
  prefixes: Metrics[],
  glues: Glue[],
  leading: number[],
  trailing: number[],
  width: number,
  em: number,
  tolerance: number,
  allowUnderfull = false,
): State | undefined {
  const origin: State = {
    previous: undefined,
    start: 0,
    end: 0,
    ratio: 0,
    fitness: 1,
    demerits: 0,
    flagged: false,
    hyphenated: false,
  };
  // Keep the best path per fitness class so an adjacent line can select a
  // different predecessor when jumping between loose and tight lines.
  const paths: Array<Array<State | undefined>> = points.map(() => []);
  paths[0]![origin.fitness] = origin;
  const last = points.length - 1;

  for (let from = 0; from < last; from++) {
    // Like full.py, keep a fitness class only if it can still beat the best
    // path here after paying the adjacent demerits.
    let least = Infinity;
    for (const state of paths[from]!) {
      if (state) least = Math.min(least, state.demerits);
    }
    const previousStates = paths[from]!.filter(
      (state): state is State =>
        state !== undefined && state.demerits <= least + adjacentDemerits,
    );
    if (previousStates.length === 0) continue;

    const start = points[from]!.next;
    const before = prefixes[start]!;
    for (let to = from + 1; to <= last; to++) {
      const point = points[to]!;
      const end = point.end;
      const after = prefixes[end]!;
      if (after.minimumWidth - before.minimumWidth > width + epsilon) break;

      const discardedGlue = glues[end - 1]!;
      const naturalWidth =
        after.width -
        before.width -
        discardedGlue.width -
        leading[start]! -
        trailing[end - 1]! +
        point.width;
      const difference = width - naturalWidth;
      const final = to === last;
      const stretch = after.stretch - before.stretch - discardedGlue.stretch;
      const shrink = after.shrink - before.shrink - discardedGlue.shrink;
      const capped =
        after.cappedStretch -
        before.cappedStretch -
        discardedGlue.cappedStretch;
      let ratio =
        final && difference > 0
          ? 0
          : adjustmentRatio(difference, stretch, shrink, capped);
      let unfilled = 0;
      if (ratio < -1 - epsilon) continue;
      if (ratio > tolerance + epsilon) {
        if (!allowUnderfull) continue;
        ratio = tolerance;
        unfilled = Math.max(
          0,
          difference - stretch - (ratio - 1) * Math.max(0, stretch - capped),
        );
      }
      // Keep each gap within its shrink limit even at floating point boundaries.
      ratio = Math.max(-1, ratio);

      const fitness = fitnessClass(ratio);
      // An underfull line of the last pass is also charged for the space it
      // leaves unfilled beyond the tolerance.
      const base = lineDemerits(
        badness(ratio) + 100 * (unfilled / em) ** 2,
        point.penalty,
        final,
      );
      const candidates = paths[to]!;
      for (const previous of previousStates) {
        let demerits = previous.demerits + base;
        if (point.flagged && previous.flagged) demerits += doubleHyphenDemerits;
        if (Math.abs(previous.fitness - fitness) > 1)
          demerits += adjacentDemerits;
        // "<=": among equals the later predecessor wins, like TeX.
        if (demerits <= (candidates[fitness]?.demerits ?? Infinity)) {
          candidates[fitness] = {
            previous,
            start,
            end,
            ratio,
            fitness,
            demerits,
            flagged: point.flagged,
            hyphenated: point.width > 0,
          };
        }
      }
    }
  }

  let best: State | undefined;
  for (const state of paths[last]!) {
    if (state && (!best || state.demerits <= best.demerits)) best = state;
  }
  return best;
}

/**
 * Optimize the whole paragraph using Knuth–Plass breakpoints, glue ratios
 * and fitness demerits. Return null when the paragraph needs native wrapping.
 */
export function layoutChineseParagraph(
  tokens: readonly ChineseLayoutToken[],
  width: number,
  em: number,
  hanWidth = em,
): ChineseLayoutLine[] | null {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(em) ||
    !Number.isFinite(hanWidth) ||
    width <= 0 ||
    em <= 0 ||
    hanWidth <= 0 ||
    tokens.some(({ width }) => !Number.isFinite(width) || width < 0)
  ) {
    return null;
  }

  const points = breakpoints(tokens, false);
  const hyphenatedPoints = tokens.some(({ hyphen }) => hyphen?.automatic)
    ? breakpoints(tokens, true)
    : points;
  if (hyphenatedPoints.length < 2) return null;

  const quoteCells = tokens.map((token) => quoteCell(token, hanWidth));
  const leading = tokens.map((token, index) =>
    quoteCells[index] ? 0 : punctuationTrim(token, em, fullWidthOpening),
  );
  const trailing = tokens.map((token, index) =>
    quoteCells[index] ? 0 : punctuationTrim(token, em, fullWidthTrailingSpace),
  );
  const beforeBlank = tokens.map((token, index) =>
    punctuationBlank(token, quoteCells[index], 'before', leading[index]!),
  );
  const afterBlank = tokens.map((token, index) =>
    punctuationBlank(token, quoteCells[index], 'after', trailing[index]!),
  );
  const compressiblePairs = tokens.map((token, index) => {
    const next = tokens[index + 1];
    if (!next) return undefined;
    const leftFootnote = token.annotation === 'footnote';
    const rightFootnote = next.annotation === 'footnote';
    if (
      !(
        quoteCells[index] ||
        quoteCells[index + 1] ||
        leftFootnote ||
        rightFootnote
      )
    )
      return undefined;
    if (
      !(leftFootnote || adjacentPunctuation.test(token.text)) ||
      !(rightFootnote || adjacentPunctuation.test(next.text))
    )
      return undefined;
    // Compress the facing bearings and retain a small gap where possible.
    const gap = afterBlank[index]! + beforeBlank[index + 1]!;
    const available = Math.max(0, gap - hanWidth / 16);
    return leftFootnote || rightFootnote
      ? available
      : Math.min(hanWidth / 2, available);
  });
  const glues = tokens.map((_, index) =>
    gapBetween(
      tokens,
      index,
      trailing[index]! + (leading[index + 1] ?? 0),
      em,
      hanWidth,
      compressiblePairs[index],
    ),
  );
  // A curly quote's cell may narrow from a full Han cell to 3/4 of one when
  // its line has to shrink. The space comes off its blank side, through the
  // glue there: before an opening quote, after a closing one. Quotes next to
  // other punctuation are already squeezed by the pair compression.
  const quoteShrink = quoteCells.map((cell, index) => {
    if (!cell) return 0;
    const gap = cell.opening ? index - 1 : index;
    if (gap < 0 || gap >= tokens.length - 1) return 0;
    if (compressiblePairs[gap] !== undefined) return 0;
    const shrink = Math.min(hanWidth / 4, cell.blank);
    const glue = glues[gap]!;
    glues[gap] = { ...glue, shrink: glue.shrink + shrink };
    return shrink;
  });
  const prefixes: Metrics[] = [{ ...emptyGlue, minimumWidth: 0 }];
  for (const [index, token] of tokens.entries()) {
    const previous = prefixes[index]!;
    const glue = glues[index]!;
    const advance = quoteCells[index] ? hanWidth : token.width;
    const before = Math.max(
      leading[index]!,
      Math.min(compressiblePairs[index - 1] ?? 0, beforeBlank[index]!),
    );
    const after = Math.max(
      trailing[index]!,
      Math.min(compressiblePairs[index] ?? 0, afterBlank[index]!),
    );
    prefixes.push({
      width: previous.width + advance + glue.width,
      stretch: previous.stretch + glue.stretch,
      shrink: previous.shrink + glue.shrink,
      cappedStretch: previous.cappedStretch + glue.cappedStretch,
      // Subtract every potentially trimmable sidebearing. This monotonic
      // lower bound lets us stop searching once a line cannot fit.
      minimumWidth:
        previous.minimumWidth +
        Math.max(
          0,
          advance -
            before -
            after -
            quoteShrink[index]! -
            (token.text === ' ' ? glue.shrink - Math.min(0, glue.width) : 0),
        ),
    });
  }

  // Like TeX, hyphenate words only when the first pass fails. Keep legal
  // breaks even when a narrow column must leave a short line.
  let state =
    chooseBreaks(points, prefixes, glues, leading, trailing, width, em, 1) ??
    chooseBreaks(
      hyphenatedPoints,
      prefixes,
      glues,
      leading,
      trailing,
      width,
      em,
      3,
    ) ??
    chooseBreaks(
      hyphenatedPoints,
      prefixes,
      glues,
      leading,
      trailing,
      width,
      em,
      3,
      true,
    );
  if (!state) return null;

  const lines: ChineseLayoutLine[] = [];
  while (state.previous) {
    const { start, end, ratio, hyphenated } = state;
    const adjustments = glues
      .slice(start, end)
      .map(
        (glue) =>
          glue.width +
          (ratio < 0
            ? ratio * glue.shrink
            : ratio * (glue.stretch - glue.cappedStretch) +
              Math.min(1, ratio) * glue.cappedStretch),
      );
    adjustments[adjustments.length - 1] = -trailing[end - 1]!;
    const beforeAdjustments = quoteCells
      .slice(start, end)
      .map((cell, index) => {
        adjustments[index] = adjustments[index]! + (cell?.after ?? 0);
        return (cell?.before ?? 0) - (index === 0 ? leading[start]! : 0);
      });
    lines.push({
      start,
      end,
      beforeAdjustments,
      adjustments,
      hyphenated,
    });
    state = state.previous;
  }
  return lines.reverse();
}
