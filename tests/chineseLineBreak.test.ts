import assert from 'node:assert/strict';
import test from 'node:test';
import {
  layoutChineseParagraph,
  type ChineseLayoutToken,
} from '../src/utils/chineseLineBreak.ts';

function layout(text: string, width: number) {
  const tokens = [...text.matchAll(/[A-Za-z-]+|./gu)].map(([token]) => ({
    text: token,
    width: /^[A-Za-z]/.test(token) ? token.length * 8 : token === ' ' ? 5 : 16,
  }));
  const lines = layoutChineseParagraph(tokens, width, 16);
  assert.ok(lines);
  return lines.map(({ start, end, beforeAdjustments, adjustments }) => {
    const line = tokens.slice(start, end);
    const used = line.reduce(
      (total, token, index) =>
        total + token.width + beforeAdjustments[index]! + adjustments[index]!,
      0,
    );
    assert.ok(used <= width + 1e-6);
    return { line, text: line.map(({ text }) => text).join(''), adjustments };
  });
}

test('keeps opening quotes off automatic line boundaries in tight columns', () => {
  for (const width of [48, 64, 72, 80, 96]) {
    const lines = layout('甲乙丙“冠状病毒已在武汉传播”？下一段', width);
    assert.ok(lines.length > 1);
    for (const { text } of lines) {
      assert.doesNotMatch(text, /^[“”？]|“$/u);
    }
  }
});

function quoteFixture(text: string, quoteWidth: number) {
  const ink: Record<string, NonNullable<ChineseLayoutToken['ink']>> = {
    '“': { left: 1, right: 7 },
    '”': { left: 2, right: 8 },
    '，': { left: 1, right: 7 },
    '。': { left: 2, right: 8 },
  };
  const tokens = Array.from(text, (char): ChineseLayoutToken => ({
    text: char,
    width: /[“”]/u.test(char) ? quoteWidth : 16,
    ...(ink[char] ? { ink: ink[char] } : {}),
  }));
  return positionTokens(tokens);
}

function positionTokens(tokens: ChineseLayoutToken[]) {
  const lines = layoutChineseParagraph(tokens, 240, 16);
  assert.equal(lines?.length, 1);
  const line = lines![0]!;
  let next = 0;
  return tokens.map(({ width, ink }, index) => {
    const start = next;
    const origin = start + line.beforeAdjustments[index]!;
    next = origin + width + line.adjustments[index]!;
    return {
      start,
      end: next,
      inkStart: origin + (ink?.left ?? 0),
      inkEnd: origin + (ink?.right ?? width),
    };
  });
}

test('isolated quotes reserve a Han cell and align to the quoted text', () => {
  for (const width of [9, 16]) {
    const [, opening, , closing] = quoteFixture('甲“乙”', width);
    assert.equal(opening!.end - opening!.start, 16);
    assert.equal(opening!.inkEnd, opening!.end);
    assert.equal(closing!.end - closing!.start, 16);
    assert.equal(closing!.inkStart, closing!.start);
  }
});

test('adjacent punctuation squeezes the whitespace without overlapping ink', () => {
  const layout = quoteFixture('甲，“乙”。甲', 9);
  const [, comma, opening, , closing, period, last] = layout;
  assert.equal(opening!.end - comma!.start, 24);
  assert.equal(period!.end - closing!.start, 24);
  assert.ok(comma!.inkEnd < opening!.inkStart);
  assert.ok(closing!.inkEnd < period!.inkStart);
  assert.equal(last!.start, 80);
});

test('footnotes squeeze on both sides next to punctuation and stay attached', () => {
  const tokens: ChineseLayoutToken[] = [
    { text: '甲', width: 16 },
    { text: '”', width: 9, ink: { left: 2, right: 8 } },
    {
      text: '\ufffc',
      width: 8,
      ink: { left: 1, right: 7 },
      annotation: 'footnote',
    },
    { text: '。', width: 16, ink: { left: 2, right: 8 } },
    ...Array.from('乙丙丁', (text) => ({ text, width: 16 })),
  ];
  const [, quote, note, period] = positionTokens(tokens);
  assert.equal(note!.inkStart - quote!.inkEnd, 1);
  assert.equal(period!.inkStart - note!.inkEnd, 1);

  const lines = layoutChineseParagraph(tokens, 48, 16);
  assert.ok(lines && lines.length > 1);
  const first = lines[0]!;
  assert.equal(first.start, 0);
  assert.ok(first.end > 3);

  tokens[2]!.annotation = 'script';
  const [, scriptQuote, script] = positionTokens(tokens);
  assert.equal(script!.inkStart - scriptQuote!.inkEnd, 11);
});

test('moves a hyphenated English term onto a line where it fits', () => {
  const lines = layout('甲乙丙 Decoder-only 丁戊己庚辛壬', 110);
  assert.deepEqual(
    lines.map(({ text }) => text),
    ['甲乙丙', 'Decoder-only', '丁戊己庚辛壬'],
  );
});

test('spaces percent and plus next to Han without opening gaps within Western text', () => {
  assert.deepEqual(
    layout('约80%的比例', 240)[0]?.adjustments,
    [4, 0, 0, 4, 0, 0, 0],
  );
  assert.deepEqual(
    layout('敏感词+人工审查', 240)[0]?.adjustments,
    [0, 0, 4, 4, 0, 0, 0, 0],
  );
  assert.deepEqual(layout('增长+5%', 240)[0]?.adjustments, [0, 4, 0, 0, 0]);
});

test('bounds explicit and implicit mixed-script spacing and varies it per line', () => {
  const sample = '甲 A乙 BC丙 D丁 Foo戊 Bar己 Q庚辛壬癸';
  const latin = /^[A-Za-z]/;
  const han = /^\p{Script=Han}/u;
  for (const width of [37, 51, 64, 90, 96]) {
    const lines = layout(sample, width);
    const gapsByLine = lines.map(({ line, adjustments }) =>
      line.flatMap(({ text, width }, index) => {
        const next = line[index + 1]?.text;
        const previous = text === ' ' ? line[index - 1]?.text : text;
        if (!previous || !next) return [];
        const mixed =
          (latin.test(previous) && han.test(next)) ||
          (han.test(previous) && latin.test(next));
        if (!mixed) return [];
        return [(text === ' ' ? width : 0) + adjustments[index]!];
      }),
    );
    const firstGaps = gapsByLine.flatMap((gaps) => gaps.slice(0, 1));
    assert.ok(firstGaps.some((gap) => Math.abs(gap - firstGaps[0]!) > 0.1));
    for (const gap of gapsByLine.flat()) {
      assert.ok(
        gap >= 2 - 1e-6 && gap <= 8 + 1e-6,
        `width ${width}, gap ${gap}`,
      );
    }
  }
});
