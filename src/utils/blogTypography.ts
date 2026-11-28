import {
  clearCache,
  measureNaturalWidth,
  prepareWithSegments,
} from '@chenglou/pretext';
import {
  layoutChineseParagraph,
  type ChineseLayoutToken,
} from './chineseLineBreak';

type Position = { node: Text; offset: number } | { node: Element };
type Token = ChineseLayoutToken & { start: Position; end: Position };
type Edit = {
  node: HTMLElement;
  position: Position;
  side: 'before' | 'after';
  endOffset?: number;
};
type Run = { tokens: Token[]; hardBreak: Position | undefined };
type Word = { token: Token; style: CSSStyleDeclaration; lang: string };
type Paragraph = {
  width: number;
  runs?: Run[] | null;
  restore?: () => void;
};

const han = /\p{Script=Han}/u;
const hanGrapheme = /^\p{Unified_Ideograph}\p{Variation_Selector}*$/u;
const eastAsian =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const punctuation = /^[\p{Punctuation}－～]\p{Variation_Selector}*$/u;
const wordPunctuation = /^[.'’_:/@%+-]$/u;
const rightToLeft = /[\p{Script=Arabic}\p{Script=Hebrew}\p{Bidi_Control}]/u;
const explicitBreak = /^[\r\n]+$/;
const collapsible = /^[\t\f\r ]+$/;
const latinWord = /^(?=.*\p{Script=Latin})[\p{L}\p{M}\p{N}.'’_:/@%+-]+$/u;
const explicitHyphen = /[-‐]$/u;
const segmenter =
  typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('zh', { granularity: 'grapheme' })
    : undefined;

const inlineTags =
  'a, abbr, b, del, em, i, ins, mark, s, small, span, strong, u';
const footnoteLink = 'a[data-footnote-ref]';
const atomicTags = `code, kbd, samp, sub, sup, .katex, ${footnoteLink}`;
const excluded =
  'header, .footnotes, .not-prose, astro-island, [popover], [contenteditable], [hidden]';

const measuredWidths = new Map<string, Map<string, number>>();
const measuredInk = new Map<string, NonNullable<ChineseLayoutToken['ink']>>();
let measurementContext: CanvasRenderingContext2D | null | undefined;

function measurementFont(style: CSSStyleDeclaration) {
  return `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
}

function textWidth(text: string, style: CSSStyleDeclaration) {
  const font = measurementFont(style);
  const letterSpacing = Number.parseFloat(style.letterSpacing) || 0;
  const wordSpacing = Number.parseFloat(style.wordSpacing) || 0;
  const key = `${font}/${letterSpacing}/${wordSpacing}`;
  let widths = measuredWidths.get(key);
  if (!widths) {
    widths = new Map();
    measuredWidths.set(key, widths);
  }
  const cached = widths.get(text);
  if (cached !== undefined) return cached;

  const prepared = prepareWithSegments(text, font, {
    whiteSpace: 'pre-wrap',
    letterSpacing,
  });
  const width =
    text === ' '
      ? (prepared.widths[0] ?? 0) + wordSpacing
      : measureNaturalWidth(prepared);
  widths.set(text, width);
  return width;
}

function glyphInk(text: string, style: CSSStyleDeclaration) {
  if (measurementContext === undefined)
    measurementContext = document.createElement('canvas').getContext('2d');
  if (!measurementContext) return {};
  const font = measurementFont(style);
  const key = `${font}/${text}`;
  let ink = measuredInk.get(key);
  if (!ink) {
    measurementContext.font = font;
    const metrics = measurementContext.measureText(text);
    const left = -metrics.actualBoundingBoxLeft;
    const right = metrics.actualBoundingBoxRight;
    if (!Number.isFinite(left) || !Number.isFinite(right) || right <= left)
      return {};
    ink = { left, right };
    measuredInk.set(key, ink);
  }
  return { ink };
}

const hyphenationBreaks = new Map<string, number[]>();

function hyphenationLanguage(node: Node) {
  const lang =
    node.parentElement?.closest('[lang]')?.getAttribute('lang') ?? '';
  // Latin words in Chinese prose are mostly English.
  return !lang || /^(?:zh|ja|ko)\b/i.test(lang) ? 'en' : lang;
}

/**
 * Ask the browser where it may break each word instead of computing
 * hyphenation points: lay the words out with `hyphens: auto` in a column
 * narrower than any fragment, so every opportunity becomes a line break,
 * and read the offsets back from the line each grapheme lands on.
 */
function probeHyphenation(words: Word[], graphemes: Intl.Segmenter) {
  const missing = new Map<string, { text: string; lang: string }>();
  for (const { token, lang } of words) {
    const key = `${lang}\0${token.text}`;
    if (!hyphenationBreaks.has(key))
      missing.set(key, { text: token.text, lang });
  }
  if (!missing.size) return;

  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText =
    'position:absolute;top:0;left:0;width:0;visibility:hidden;' +
    'hyphens:auto;-webkit-hyphens:auto;white-space:normal;' +
    'word-break:normal;overflow-wrap:normal';
  const probes = [...missing].map(([key, { text, lang }]) => {
    const probe = document.createElement('div');
    probe.lang = lang;
    probe.textContent = text;
    host.append(probe);
    return { key, node: probe.firstChild as Text };
  });
  document.body.append(host);
  const range = document.createRange();
  for (const { key, node } of probes) {
    const breaks: number[] = [];
    let top: number | undefined;
    for (const { segment, index } of graphemes.segment(node.data)) {
      range.setStart(node, index);
      range.setEnd(node, index + segment.length);
      const rect = range.getBoundingClientRect();
      if (top !== undefined && rect.top > top + 1) breaks.push(index);
      top = rect.top;
    }
    hyphenationBreaks.set(key, breaks);
  }
  host.remove();
}

/** Split words at the breaks the browser allows into discretionary fragments. */
function splitWords(runs: Run[], words: Word[], graphemes: Intl.Segmenter) {
  if (!words.length) return runs;
  probeHyphenation(words, graphemes);
  const fragments = new Map<Token, Token[]>();
  for (const { token, style, lang } of words) {
    const breaks = hyphenationBreaks.get(`${lang}\0${token.text}`);
    const { text, start } = token;
    if (!breaks?.length || !('offset' in start)) continue;

    const parts: Token[] = [];
    let from = 0;
    let left = 0;
    const cut = (offset: number, hyphen?: Token['hyphen']) => {
      // Measure prefixes so the fragments keep the kerning of the word.
      const right =
        offset === text.length
          ? token.width
          : textWidth(text.slice(0, offset), style);
      parts.push({
        text: text.slice(from, offset),
        width: Math.max(0, right - left),
        start: { node: start.node, offset: start.offset + from },
        end: { node: start.node, offset: start.offset + offset },
        ...(hyphen ? { hyphen } : {}),
      });
      from = offset;
      left = right;
    };
    for (const offset of breaks) {
      const before = text.slice(0, offset);
      const explicit = explicitHyphen.test(before);
      // Keep hyphenation inside letters and breaks after a typed hyphen;
      // ignore other opportunities such as after a slash.
      if (
        !explicit &&
        !(/\p{L}\p{M}*$/u.test(before) && /^\p{L}/u.test(text.slice(offset)))
      )
        continue;
      cut(offset, {
        width: explicit ? 0 : textWidth('-', style),
        automatic: !explicit,
      });
    }
    if (!parts.length) continue;
    cut(text.length);
    fragments.set(token, parts);
  }
  if (!fragments.size) return runs;
  return runs.map(({ tokens, hardBreak }) => ({
    hardBreak,
    tokens: tokens.flatMap((token) => fragments.get(token) ?? [token]),
  }));
}

function tokenize(text: string, segmenter: Intl.Segmenter) {
  const parts = [...segmenter.segment(text)];
  const tokens: { text: string; index: number }[] = [];
  let word: { text: string; index: number } | undefined;
  const isWordCharacter = (value: string) =>
    !eastAsian.test(value) && /[\p{L}\p{N}\p{M}]/u.test(value);

  for (const [index, { segment, index: offset }] of parts.entries()) {
    const next = parts[index + 1]?.segment ?? '';
    if (
      !collapsible.test(segment) &&
      !explicitBreak.test(segment) &&
      !eastAsian.test(segment) &&
      (!punctuation.test(segment) ||
        (word && wordPunctuation.test(segment) && isWordCharacter(next)))
    ) {
      if (word) word.text += segment;
      else {
        word = { text: segment, index: offset };
        tokens.push(word);
      }
    } else {
      word = undefined;
      tokens.push({ text: segment, index: offset });
    }
  }
  return tokens;
}

function readRuns(paragraph: HTMLParagraphElement): Run[] | null {
  if (!segmenter || rightToLeft.test(paragraph.textContent)) return null;
  const graphemes = segmenter;
  const paragraphStyle = getComputedStyle(paragraph);
  if (
    paragraphStyle.display !== 'block' ||
    !['start', 'left'].includes(paragraphStyle.textAlign) ||
    !['normal', 'pre-line'].includes(paragraphStyle.whiteSpace)
  ) {
    return null;
  }

  const runs: Run[] = [];
  const words: Word[] = [];
  let tokens: Token[] = [];
  let pendingSpace: Token | undefined;
  const push = (token: Token) => {
    if (pendingSpace && tokens.length) tokens.push(pendingSpace);
    pendingSpace = undefined;
    tokens.push(token);
  };
  const endRun = (hardBreak?: Position) => {
    runs.push({ tokens, hardBreak });
    tokens = [];
    pendingSpace = undefined;
  };

  function visit(parent: Element): boolean {
    const style =
      parent === paragraph ? paragraphStyle : getComputedStyle(parent);
    if (
      style.direction !== 'ltr' ||
      style.writingMode !== 'horizontal-tb' ||
      style.textTransform !== 'none' ||
      style.textIndent !== '0px' ||
      style.whiteSpace !== paragraphStyle.whiteSpace
    )
      return false;

    for (const node of parent.childNodes) {
      if (node instanceof Text) {
        for (const { text, index } of tokenize(node.data, graphemes)) {
          const start = { node, offset: index };
          const end = { node, offset: index + text.length };
          if (explicitBreak.test(text) && style.whiteSpace === 'pre-line') {
            endRun(end);
          } else if (explicitBreak.test(text) || collapsible.test(text)) {
            pendingSpace ??= {
              text: ' ',
              width: textWidth(' ', style),
              start,
              end,
            };
          } else {
            const token: Token = {
              text,
              width: textWidth(text, style),
              ...(punctuation.test(text) ? glyphInk(text, style) : {}),
              start,
              end,
            };
            push(token);
            if (latinWord.test(text))
              words.push({ token, style, lang: hyphenationLanguage(node) });
          }
        }
        continue;
      }
      if (!(node instanceof Element)) continue;
      if (node.matches(excluded)) return false;
      if (node.matches('br')) endRun();
      else if (
        node.matches(atomicTags) ||
        (node.matches(inlineTags) &&
          getComputedStyle(node).display === 'inline-block')
      ) {
        // Measure the box on one line. Formulas such as KaTeX leave break
        // opportunities between their parts and report several fragments,
        // even on a single line, so take the union of fragments that share
        // the line.
        const element = node as HTMLElement;
        const { whiteSpace } = element.style;
        element.style.whiteSpace = 'nowrap';
        const boxes = [...node.getClientRects()];
        element.style.whiteSpace = whiteSpace;
        const first = boxes[0];
        if (
          !first ||
          boxes.some(
            ({ top, bottom }) =>
              Math.abs(top - first.top) > 1 ||
              Math.abs(bottom - first.bottom) > 1,
          )
        )
          return false;
        const left = Math.min(...boxes.map(({ left }) => left));
        const box = {
          left,
          width: Math.max(...boxes.map(({ right }) => right)) - left,
        };
        if (box.width === 0) return false;
        const footnote = node.matches(footnoteLink)
          ? node
          : node.querySelector(footnoteLink);
        const annotation = footnote
          ? 'footnote'
          : node.matches('sub, sup')
            ? 'script'
            : undefined;
        const ink =
          footnote &&
          glyphInk(footnote.textContent.trim(), getComputedStyle(footnote)).ink;
        const inset = footnote
          ? footnote.getBoundingClientRect().left - box.left
          : 0;
        const position = { node };
        push({
          text: '\uFFFC',
          width: box.width,
          start: position,
          end: position,
          ...(annotation ? { annotation } : {}),
          ...(ink
            ? { ink: { left: ink.left + inset, right: ink.right + inset } }
            : {}),
        });
      } else if (!node.matches(inlineTags) || !visit(node)) return false;
    }
    return true;
  }

  if (!visit(paragraph)) return null;
  endRun();
  return splitWords(runs, words, graphemes);
}

function spacing(position: Position, side: Edit['side'], amount: number): Edit {
  const node = document.createElement('span');
  // An empty inline box moves the following text without adding copyable spaces.
  node.style.marginInlineEnd = `${amount}px`;
  node.className = 'print:hidden';
  node.setAttribute('aria-hidden', 'true');
  return { node, position, side };
}

function spacedText(
  start: { node: Text; offset: number },
  endOffset: number,
  baseSpacing: number,
  amount: number,
): Edit {
  const node = document.createElement('span');
  node.className = 'blog-letter-spacing';
  node.style.setProperty('--blog-letter-spacing', `${baseSpacing + amount}px`);
  // Inline letter spacing also advances the last glyph. Keep the original
  // spacing at the end of the span so only its internal gaps are adjusted.
  node.style.setProperty('--blog-letter-spacing-end', `${-amount}px`);
  node.textContent = start.node.data.slice(start.offset, endOffset);
  return { node, position: start, side: 'before', endOffset };
}

function hyphen(position: Position): Edit {
  const node = document.createElement('span');
  // Generated content is neither copied nor part of the text.
  node.className = "print:hidden after:content-['-']";
  node.setAttribute('aria-hidden', 'true');
  return { node, position, side: 'after' };
}

function lineBreak(position: Position): Edit {
  const node = document.createElement('span');
  // A generated newline breaks the line without adding copyable text.
  node.className = 'print:hidden after:generated-newline';
  node.setAttribute('aria-hidden', 'true');
  return { node, position, side: 'after' };
}

function applyEdits(edits: Edit[]) {
  const textEdits = new Map<
    Text,
    { offset: number; endOffset: number; node: Node }[]
  >();
  const afterElement = new Map<Element, Node>();
  const added: Node[] = [];
  for (const { node, position, side, endOffset } of edits) {
    added.push(node);
    if ('offset' in position) {
      const edits = textEdits.get(position.node) ?? [];
      edits.push({
        offset: position.offset,
        endOffset: endOffset ?? position.offset,
        node,
      });
      textEdits.set(position.node, edits);
    } else if (side === 'before') {
      position.node.before(node);
    } else {
      const previous = afterElement.get(position.node) ?? position.node;
      previous.parentNode?.insertBefore(node, previous.nextSibling);
      afterElement.set(position.node, node);
    }
  }

  const originals = new Map<Text, string>();
  for (const [text, edits] of textEdits) {
    originals.set(text, text.data);
    const fragment = document.createDocumentFragment();
    let start = 0;
    for (const { offset, endOffset, node } of edits.sort(
      (a, b) => a.offset - b.offset,
    )) {
      if (offset > start) {
        const chunk = document.createTextNode(text.data.slice(start, offset));
        fragment.append(chunk);
        added.push(chunk);
      }
      fragment.append(node);
      start = endOffset;
    }
    if (start < text.length) {
      const rest = document.createTextNode(text.data.slice(start));
      fragment.append(rest);
      added.push(rest);
    }
    text.data = '';
    text.after(fragment);
  }

  return () => {
    for (const node of added) node.parentNode?.removeChild(node);
    for (const [text, value] of originals) text.data = value;
  };
}

function measureInBrowser(runs: Run[], punctuationOnly = false): Run[] {
  const sources = new Map<Token, Element>();
  const probes = new Map<Element, Map<string, HTMLElement>>();
  for (const { tokens } of runs) {
    for (const token of tokens) {
      if (
        punctuationOnly &&
        token.annotation !== 'footnote' &&
        !punctuation.test(token.text)
      )
        continue;
      if (!('offset' in token.start)) {
        sources.set(token, token.start.node);
        continue;
      }
      const parent = token.start.node.parentElement!;
      let byText = probes.get(parent);
      if (!byText) {
        byText = new Map();
        probes.set(parent, byText);
      }
      let probe = byText.get(token.text);
      if (!probe) {
        // WebKit may round the edges of text ranges. Measure a box whose
        // width is the text advance, with the typography of the source text.
        probe = document.createElement('span');
        probe.style.cssText =
          'position:absolute;left:0;top:0;width:max-content;' +
          'visibility:hidden;white-space:pre';
        probe.textContent = token.text;
        parent.append(probe);
        byText.set(token.text, probe);
      }
      sources.set(token, probe);
    }
  }

  const widths = new Map<Element, number>();
  for (const source of sources.values()) {
    if (!widths.has(source))
      widths.set(source, source.getBoundingClientRect().width);
  }
  for (const byText of probes.values()) {
    for (const probe of byText.values()) probe.remove();
  }
  return runs.map(({ tokens, hardBreak }) => ({
    hardBreak,
    tokens: tokens.map((token) => {
      const source = sources.get(token);
      return source ? { ...token, width: widths.get(source)! } : token;
    }),
  }));
}

function renderRuns(
  runs: Run[],
  width: number,
  em: number,
  hanWidth: number,
  mergeSpacing: boolean,
) {
  const edits: Edit[] = [];
  const lineEnds: { node: HTMLElement; justified: boolean }[] = [];
  const baseSpacings = new Map<Element, number>();
  for (const { tokens, hardBreak } of runs) {
    if (tokens.length) {
      const lines = layoutChineseParagraph(tokens, width, em, hanWidth);
      if (!lines) return;
      for (const [index, line] of lines.entries()) {
        for (let index = 0; index < line.adjustments.length; index++) {
          const token = tokens[line.start + index]!;
          const before = line.beforeAdjustments[index]!;
          if (before) edits.push(spacing(token.start, 'before', before));
          const amount = line.adjustments[index]!;
          if (mergeSpacing && amount && hanGrapheme.test(token.text)) {
            const { start } = token;
            let end = token.end;
            if ('offset' in start && 'offset' in end) {
              while (
                index + 1 < line.adjustments.length &&
                line.adjustments[index] === amount &&
                !line.beforeAdjustments[index + 1]
              ) {
                const next = tokens[line.start + index + 1]!;
                if (
                  !hanGrapheme.test(next.text) ||
                  !('offset' in next.start) ||
                  !('offset' in next.end) ||
                  next.start.node !== start.node ||
                  next.start.offset !== end.offset
                )
                  break;
                index++;
                end = next.end;
              }
              if (end !== token.end) {
                const parent = start.node.parentElement!;
                let base = baseSpacings.get(parent);
                if (base === undefined) {
                  base =
                    Number.parseFloat(getComputedStyle(parent).letterSpacing) ||
                    0;
                  baseSpacings.set(parent, base);
                }
                edits.push(spacedText(start, end.offset, base, amount));
              }
            }
          }
          const after = line.adjustments[index]!;
          if (after)
            edits.push(
              spacing(tokens[line.start + index]!.end, 'after', after),
            );
        }
        const end = tokens[line.end - 1]!.end;
        if (line.hyphenated) edits.push(hyphen(end));
        const justified = index < lines.length - 1;
        const marker = justified ? lineBreak(end) : spacing(end, 'after', 0);
        edits.push(marker);
        lineEnds.push({ node: marker.node, justified });
      }
    }
    if (hardBreak) edits.push(lineBreak(hardBreak));
  }
  if (!edits.length) return;
  return {
    restore: applyEdits(edits),
    lineEnds,
    merged: baseSpacings.size > 0,
  };
}

function typeset(paragraph: HTMLParagraphElement, state: Paragraph) {
  state.restore?.();
  delete state.restore;
  if (!state.width || !paragraph.isConnected) return;
  const firstMeasurement = !state.runs;
  state.runs ??= readRuns(paragraph);
  if (!state.runs) return;

  const style = getComputedStyle(paragraph);
  const em = Number.parseFloat(style.fontSize);
  const hanWidth = textWidth('汉', style) || em;
  const leftInset = paragraph.clientLeft + Number.parseFloat(style.paddingLeft);
  paragraph.classList.add('blog-typeset');
  // Match the browser's punctuation advance when it differs from Canvas.
  if (firstMeasurement) state.runs = measureInBrowser(state.runs, true);
  /** Render, rejecting overflow, and report how far justified lines miss the edge. */
  const render = (
    runs: Run[],
    mergeSpacing = true,
  ): { restore: () => void; misalignment: number } | undefined => {
    const result = renderRuns(runs, state.width, em, hanWidth, mergeSpacing);
    if (!result) return undefined;
    const right =
      paragraph.getBoundingClientRect().left + leftInset + state.width;
    let misalignment = 0;
    for (const { node, justified } of result.lineEnds) {
      const offset = node.getBoundingClientRect().right - right;
      if (
        offset > 1 ||
        (result.merged && justified && Math.abs(offset) > 0.5)
      ) {
        result.restore();
        // Keep explicit gaps if the browser advances inline spacing differently.
        return result.merged ? render(runs, false) : undefined;
      }
      if (justified) misalignment = Math.max(misalignment, Math.abs(offset));
    }
    return { restore: result.restore, misalignment };
  };

  let rendered = render(state.runs);
  if (!rendered || rendered.misalignment > 0.5) {
    // CSS shaping and Canvas measurement can differ, which overflows lines
    // or leaves them short of the edge. Retry with the widths the browser
    // actually lays out, and keep whichever aligns better.
    const canvasMisalignment = rendered?.misalignment;
    rendered?.restore();
    const browserRuns = measureInBrowser(state.runs);
    rendered = render(browserRuns);
    if (
      rendered &&
      (canvasMisalignment === undefined ||
        rendered.misalignment <= canvasMisalignment)
    ) {
      state.runs = browserRuns;
    } else if (canvasMisalignment !== undefined) {
      rendered?.restore();
      rendered = render(state.runs);
    }
  }
  const restore = rendered?.restore;
  if (!restore) {
    paragraph.classList.remove('blog-typeset');
    return;
  }
  state.restore = () => {
    restore();
    paragraph.classList.remove('blog-typeset');
  };
}

export function setupBlogTypography() {
  if (!segmenter || typeof ResizeObserver !== 'function') return;
  const paragraphs = new Map<HTMLParagraphElement, Paragraph>();
  const pending = new Set<HTMLParagraphElement>();
  let frame = 0;
  const enqueue = (paragraph: HTMLParagraphElement) => {
    pending.add(paragraph);
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      for (const paragraph of pending)
        typeset(paragraph, paragraphs.get(paragraph)!);
      pending.clear();
    });
  };
  const observer = new ResizeObserver((entries) => {
    for (const { target, contentRect } of entries) {
      const paragraph = target as HTMLParagraphElement;
      const state = paragraphs.get(paragraph);
      if (!state || state.width === contentRect.width) continue;
      state.width = contentRect.width;
      enqueue(paragraph);
    }
  });
  for (const paragraph of document.querySelectorAll<HTMLParagraphElement>(
    '[data-blog-typography] p',
  )) {
    if (paragraph.closest(excluded) || !han.test(paragraph.textContent))
      continue;
    paragraph.classList.add('blog-typeset-wrap');
    paragraphs.set(paragraph, { width: 0 });
    observer.observe(paragraph);
  }
  if (!paragraphs.size) return;

  // Browser font caches must be invalidated when a web font replaces its fallback.
  document.fonts.addEventListener('loadingdone', () => {
    clearCache();
    measuredWidths.clear();
    measuredInk.clear();
    for (const [paragraph, state] of paragraphs) {
      delete state.runs;
      enqueue(paragraph);
    }
  });
}
