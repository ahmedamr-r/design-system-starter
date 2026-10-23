// Works out the colour a token comes to in dist/tokens.css, for one brand or
// none, in light or dark, the way a browser does:
//   - an element with a data-brand sees what :root declares, then what
//     [data-brand] and its own [data-brand="<name>"] block declare, later
//     blocks winning, so a brand's re-pointing beats the :root answer;
//   - var() is followed through any number of tokens, until a hex colour;
//   - light-dark(light, dark) gives its first answer in light and its second
//     in dark, wherever it turns up along the way;
//   - a block inside a media query, such as the reduced-motion block, counts
//     only when the caller says that query holds, with { holds: [...] }.
// It reads the built CSS rather than the token files, so it measures what
// ships. A brand block writes var() with no light-dark(), so a token a brand
// re-points keeps that colour in dark as well, and this follows it the same way.
//
//   import { resolver } from './lib/resolve.js';
//   const colourOf = resolver(readFileSync('dist/tokens.css', 'utf8'));
//   colourOf('button.label', { brand: null, mode: 'dark' });
//   // → { hex: '#ffffff', chain: ['--button-label', '--color-text-on-fill', '--color-gray-0'] }

export const cssName = (path) => (path.startsWith('--') ? path : `--${path.replaceAll('.', '-')}`);

// The rule blocks of a CSS file, in source order, as
// { selector, within, declarations: [{ name, value }] }, with comments taken
// out. within lists the at-rules a rule sits inside, from the outside in, so
// the :root inside @media (prefers-reduced-motion: reduce) { :root { … } }
// comes back as { selector: ':root', within: ['@media (prefers-reduced-motion:
// reduce)'] }, and a rule at the top has within []. An at-rule's own prelude
// is never a selector.
export function readBlocks(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks = [];
  const open = [];
  let from = 0;
  for (let at = 0; at < text.length; at++) {
    const char = text[at];
    if (char === '{') {
      open.push({ prelude: text.slice(from, at).trim().replace(/\s+/g, ' '), body: at + 1 });
      from = at + 1;
    } else if (char === '}') {
      const rule = open.pop();
      if (rule && !rule.prelude.startsWith('@')) {
        blocks.push({
          selector: rule.prelude,
          within: open.map(({ prelude }) => prelude),
          declarations: [...text.slice(rule.body, at).matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)].map(([, name, value]) => ({ name, value: value.trim() })),
        });
      }
      from = at + 1;
    } else if (char === ';' && text.slice(from, at).trim().startsWith('@')) {
      from = at + 1; // A statement at-rule, such as @import, has no block.
    }
  }
  return blocks;
}

// Where a block is written, as CSS would nest it: :root, or
// @media (prefers-reduced-motion: reduce) { :root }.
export const placeOf = ({ selector, within = [] }) => [...within, selector].reduceRight((inner, outer) => `${outer} { ${inner} }`);

// Whether one part of a selector list reaches the page root (brand null), or
// an element with data-brand="<brand>".
const BRAND_SELECTOR = /^\[data-brand(?:=(["']?)([^"'\]]+)\1)?\]$/;
const reaches = (part, brand) => {
  if (brand === null) return part === ':root';
  const match = part.match(BRAND_SELECTOR);
  return Boolean(match) && (match[2] === undefined || match[2] === brand);
};

// Every custom property an element sees: what :root declares, which it
// inherits, then what is declared on the element itself, in source order. A
// block inside an at-rule counts only when every at-rule around it is in
// holds, such as ['@media (prefers-reduced-motion: reduce)'] for a reader who
// asked for less motion; by default none holds, and the page is read as for a
// reader with no preference.
export function variablesFor(blocks, brand = null, { holds = [] } = {}) {
  const seen = new Map();
  const declare = (who) => {
    for (const { selector, within = [], declarations } of blocks) {
      if (!within.every((atRule) => holds.includes(atRule))) continue;
      if (!selector.split(',').some((part) => reaches(part.trim(), who))) continue;
      for (const { name, value } of declarations) seen.set(name, value);
    }
  };
  declare(null);
  if (brand !== null) declare(brand);
  return seen;
}

// The two answers of light-dark(a, b), split at the comma between them, or
// undefined when the value is not a light-dark().
function lightDarkAnswers(value) {
  const match = value.match(/^light-dark\(([\s\S]*)\)$/);
  if (!match) return undefined;
  let depth = 0;
  for (let i = 0; i < match[1].length; i++) {
    const char = match[1][i];
    if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;
    else if (char === ',' && depth === 0) return [match[1].slice(0, i).trim(), match[1].slice(i + 1).trim()];
  }
  return undefined;
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const longHex = (hex) =>
  (hex.length === 4 ? `#${[...hex.slice(1)].map((digit) => digit + digit).join('')}` : hex).toLowerCase();

// The colour one token comes to, given the variables an element sees, in one
// mode. chain lists every custom property passed through, starting with the
// token's own, so a caller can tell which tokens a colour came from.
export function colourIn(variables, token, mode = 'light') {
  if (mode !== 'light' && mode !== 'dark') throw new Error(`The mode is light or dark, not ${mode}.`);
  const chain = [];
  let value = `var(${cssName(token)})`;
  for (;;) {
    const answers = lightDarkAnswers(value);
    if (answers) {
      value = mode === 'light' ? answers[0] : answers[1];
      continue;
    }
    const next = value.match(/^var\(\s*(--[\w-]+)\s*\)$/)?.[1];
    if (next) {
      if (chain.includes(next)) throw new Error(`${[...chain, next].join(' → ')} goes round in a circle.`);
      if (!variables.has(next)) {
        throw new Error(chain.length === 0
          ? `${next} is not written in dist/tokens.css.`
          : `${chain.at(-1)} points at ${next}, which is not written in dist/tokens.css.`);
      }
      chain.push(next);
      value = variables.get(next).trim();
      continue;
    }
    if (HEX.test(value)) return { hex: longHex(value), chain };
    throw new Error(`${chain.at(-1) ?? cssName(token)} comes to ${value}, which is not a hex colour.`);
  }
}

// Reads the built CSS once and answers colourOf(token, { brand, mode }), where
// token is a token path such as color.text.link or a CSS name such as
// --color-text-link, brand is a brand's name or null for none, and mode is
// light or dark.
export function resolver(css) {
  const blocks = readBlocks(css);
  const byBrand = new Map();
  return (token, { brand = null, mode = 'light', holds = [] } = {}) => {
    const key = JSON.stringify([brand, holds]);
    if (!byBrand.has(key)) byBrand.set(key, variablesFor(blocks, brand, { holds }));
    return colourIn(byBrand.get(key), token, mode);
  };
}
