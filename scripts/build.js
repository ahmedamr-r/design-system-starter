// Builds dist/tokens.css in layers, one block each:
//   1. primitives on :root, as plain values;
//   2. semantics, as var() references to primitives. A semantic whose answer
//      in tokens/modes/dark.json differs from its light one is written
//      light-dark(light, dark), both still references;
//   3. component tokens, the same way, as references to semantics;
//   4. for each switch in tokens/switch-scopes.json that has a block, in the
//      order it lists them, one block per file: [data-brand="<name>"] for each
//      brand, :lang(<code>) for each locale, [data-density="<name>"] for each
//      density, and :root inside @media (prefers-<name>: reduce) for each
//      reader preference, re-pointing what that switch may change. A block
//      the list gives as a list, at-rule first, is nested by Style
//      Dictionary's own css/variables format;
//   5. color-scheme: "light dark" on :root, so a page that sets no mode follows
//      the reader's setting, then one value per data-mode.
//
// Where a token is declared comes from tokens/switch-scopes.json, the one list
// of which tokens each switch may change, which npm run check reads as well.
// Every semantic and component token is declared on :root, and on the
// attribute of each switch that may change it or anything it reads, and on no
// other. So color.fill.brand, which reads a step of the brand ramp, is
// declared on [data-brand] too, and a brand set on any element works it out
// again right there, instead of inheriting the colour worked out for the page.
// The spacing is declared on [data-density] and on nothing else, so a card
// that sets its own brand or language inside a compact panel inherits the
// compact spacing: declared on [data-brand] or [lang], it would be put back to
// its default there. What a token reads counts its dark answer too, and
// anything those read in turn.
//
// A mode needs no attribute. light-dark() picks its answer where a colour is
// used, from that element's color-scheme, and color-scheme is inherited. So
// data-mode only sets color-scheme, and everything inside follows it. Light
// is what the semantics hold, and dark.json is the only mode file the build
// reads: light-dark() has two answers.
//
// :lang(ar) matches an element whose language is ar or any ar- code, such as
// ar-EG, set on it or on an ancestor, so tokens/locales/ar.json reaches every
// element inside lang="ar-EG". The type tokens are declared on [lang], so an
// element that sets another language inside, such as an English label in an
// Arabic panel, gets the default type back unless a locale block matches it.
//
// Brands are whatever files sit in tokens/brands/. Adding a brand is adding a
// file; nothing here lists them by name. In every switch folder, a file whose
// name starts with an underscore is not an option: _template.json lists every
// token a brand may set, for a new brand to be copied from, and
// tokens/switch-scopes.json points at it for the brand's list. A brand file
// that sets nothing, empty or {}, gets no block, so data-brand with its name
// looks like no brand until it sets something; npm run check says what it is
// missing. A locale or density file that sets nothing gets no block either.
//
// Next to dist/tokens.css it writes the brands it built a block for, read from
// the same folder: dist/brands.json lists each one's id, display name and hue,
// and dist/brands.d.ts has a Brand type listing the ids. The demo builds its
// panels from brands.json, so it names no brand either.
import StyleDictionary from 'style-dictionary';
import { usesReferences } from 'style-dictionary/utils';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { SCOPES, blockName, readScopes } from './lib/scopes.js';

const PARTS = 'dist/.parts/';
const BASE = ['tokens/primitives/**/*.json', 'tokens/semantics/**/*.json', 'tokens/components/**/*.json'];
const DARK = 'tokens/modes/dark.json';
const inLayer = (layer) => (token) => token.filePath.startsWith(`tokens/${layer}/`);
const pathOf = (token) => token.path.join('.');

// The list of what each switch may change. The build stops on a list it
// cannot read, since it could not say where to declare anything.
const { switches, problems } = readScopes();
if (problems.length > 0) {
  for (const problem of problems) console.error(problem);
  console.error(`Fix ${SCOPES}, then build again.`);
  process.exit(1);
}

// Semantics and brands point at tokens that sit in another block, which
// Style Dictionary reports as "filtered out references". The split is on
// purpose, so its warnings are off and the last lines of this script report
// what was written. A reference to a token that does not exist still fails.
const log = { warnings: 'disabled', verbosity: 'silent' };

const platform = (files) => ({
  css: { transformGroup: 'css', buildPath: PARTS, log, options: { showFileHeader: false }, files },
});

// The dark answers, keyed by token path. Style Dictionary reads the mode file
// the way it reads a brand, so a reference to a token that does not exist
// fails here as well.
const dark = new Map();
if (existsSync(DARK)) {
  const sd = new StyleDictionary({ log, include: BASE, source: [DARK], platforms: platform([]) });
  const { allTokens } = await sd.getPlatformTokens('css');
  for (const token of allTokens) if (token.isSource) dark.set(pathOf(token), token);
}

// A token as its file wrote it: the reference when it has one, else its value.
const asWritten = (token) => (usesReferences(token.original.$value) ? token.original.$value : token.$value);

// What each token reads: every reference in its value and in its dark answer.
const referencesIn = (value) => [...JSON.stringify(value ?? '').matchAll(/\{([^{}]+)\}/g)].map(([, path]) => path);
const { allTokens: baseTokens } = await new StyleDictionary({ log, source: BASE, platforms: platform([]) }).getPlatformTokens('css');
const reads = new Map(baseTokens.map((token) => [
  pathOf(token),
  [...referencesIn(token.original.$value), ...referencesIn(dark.get(pathOf(token))?.original.$value)],
]));
// A token, and everything it reads, all the way down.
const readsAll = (path, seen = new Set()) => {
  if (seen.has(path)) return seen;
  seen.add(path);
  for (const next of reads.get(path) ?? []) readsAll(next, seen);
  return seen;
};

// Where each semantic and component token is declared: :root, and the
// attribute of every switch that may change it or anything it reads.
const selectorOf = new Map();
for (const token of baseTokens.filter((t) => !inLayer('primitives')(t))) {
  const chain = [...readsAll(pathOf(token))];
  const attributes = switches
    .filter(({ declaredOn, covers }) => declaredOn !== null && chain.some(covers))
    .map(({ declaredOn }) => declaredOn);
  selectorOf.set(pathOf(token), [':root', ...attributes].join(', '));
}
// :root alone first, then by the switches' order in the list.
const rank = (selector) => selector.split(', ').map((part) => (part === ':root' ? 0 : 1 + switches.findIndex(({ declaredOn }) => declaredOn === part)));
const byRank = (a, b) => {
  const [one, other] = [rank(a), rank(b)];
  for (let i = 0; i < Math.max(one.length, other.length); i++) {
    if (one[i] === undefined) return -1;
    if (other[i] === undefined) return 1;
    if (one[i] !== other[i]) return one[i] - other[i];
  }
  return 0;
};

// css/variables, except that a token whose dark answer differs from its light
// one is written light-dark(light, dark). Style Dictionary then turns each
// reference inside into a var(), the same as any other reference.
const paired = [];
const lightDark = (args) => {
  const allTokens = args.dictionary.allTokens.map((token) => {
    const answer = dark.get(pathOf(token));
    if (!answer || asWritten(answer) === asWritten(token)) return token;
    paired.push(token.name);
    return {
      ...token,
      $value: `light-dark(${token.$value}, ${answer.$value})`,
      original: { ...token.original, $value: `light-dark(${asWritten(token)}, ${asWritten(answer)})` },
    };
  });
  return StyleDictionary.hooks.formats['css/variables']({ ...args, dictionary: { ...args.dictionary, allTokens } });
};

// One block per layer and selector, such as the semantics on ":root" alone
// and the semantics on ":root, [data-brand]".
const layerFiles = (layer) => [...new Set(baseTokens.filter(inLayer(layer)).map((token) => selectorOf.get(pathOf(token))))]
  .sort(byRank)
  .map((selector, i) => ({
    destination: `${layer}-${i}.css`,
    format: 'css/variables-light-dark',
    filter: (token) => inLayer(layer)(token) && selectorOf.get(pathOf(token)) === selector,
    options: { outputReferences: true, selector },
  }));
const baseFiles = [
  { destination: 'primitives.css', format: 'css/variables', filter: inLayer('primitives') },
  ...layerFiles('semantics'),
  ...layerFiles('components'),
];
const base = new StyleDictionary({
  log,
  source: BASE,
  hooks: { formats: { 'css/variables-light-dark': lightDark } },
  platforms: platform(baseFiles),
});
await base.buildAllPlatforms();

// A brand's hue is the primitive ramp its brand ramp points at: blue for a
// brand that points color.brand.600 at {color.blue.600}. Check 4 makes every
// step point at the same ramp. A brand whose steps point at more than one, or
// that sets no step, gets null, and npm run check says what is wrong with it.
const STEP_TARGET = /^\{color\.([^.{}]+)\.[^.{}]+\}$/;
const hueOf = (tokens) => {
  const found = new Set(tokens
    .filter(({ path }) => path.length === 3 && path[0] === 'color' && path[1] === 'brand')
    .map((token) => String(token.original.$value).match(STEP_TARGET)?.[1] ?? null));
  return found.size === 1 ? [...found][0] : null;
};
const hues = new Map();

// One block per file of each switch that has a block, in the list's order.
// Style Dictionary writes no file for a file that sets nothing, and cannot
// read an empty one at all, so those are set aside here instead of failing.
const isBrands = ({ name }) => name === 'brand';
const switchBlocks = [];
const empty = [];
const built = [];
for (const each of switches.filter(({ block }) => block !== null)) {
  const blocks = [];
  for (const source of each.options()) {
    const id = basename(source, '.json');
    const setsNothing = () => (isBrands(each) ? empty.push(id) : undefined);
    if ((await readFile(source, 'utf8')).trim() === '') {
      setsNothing();
      continue;
    }
    const destination = `${each.name}-${id}.css`;
    const sd = new StyleDictionary({
      log,
      include: BASE,
      source: [source],
      platforms: platform([
        {
          destination,
          format: 'css/variables',
          filter: (token) => token.isSource,
          options: { outputReferences: true, selector: each.blockFor(source) },
        },
      ]),
    });
    const { allTokens } = await sd.getPlatformTokens('css');
    const own = allTokens.filter((token) => token.isSource);
    if (own.length === 0) {
      setsNothing();
      continue;
    }
    if (isBrands(each)) {
      hues.set(id, hueOf(own));
      built.push(id);
    }
    await sd.buildAllPlatforms();
    blocks.push({ destination, selector: each.blockFor(source) });
  }
  switchBlocks.push({ name: each.name, blocks });
}

// color-scheme picks the answer every light-dark() gives. These come after the
// :root blocks, so data-mode on <html> wins over the "light dark" set there.
const schemes = dark.size === 0 ? [] : [
  ':root {\n  color-scheme: light dark;\n}\n',
  '[data-mode="light"] {\n  color-scheme: light;\n}\n',
  '[data-mode="dark"] {\n  color-scheme: dark;\n}\n',
];

const order = [
  ...baseFiles.map(({ destination }) => destination),
  ...switchBlocks.flatMap(({ blocks }) => blocks.map(({ destination }) => destination)),
];
const parts = await Promise.all(order.map((file) => readFile(PARTS + file, 'utf8')));
await mkdir('dist', { recursive: true });
await writeFile(
  'dist/tokens.css',
  `/* Built by scripts/build.js from tokens/. Do not edit by hand. */\n\n${[...parts, ...schemes].join('\n')}`,
);
await rm(PARTS, { recursive: true });

// The brands with a block, in the same order. The display name is the id with
// a capital letter. A brand that sets nothing is not listed: it has no block,
// so a panel for it would only show no brand under its name.
const list = built.map((id) => ({ id, displayName: id.charAt(0).toUpperCase() + id.slice(1), hue: hues.get(id) }));
await writeFile('dist/brands.json', `${JSON.stringify(list, null, 2)}\n`);
await writeFile(
  'dist/brands.d.ts',
  `// Built by scripts/build.js from tokens/brands/. Do not edit by hand.\n\nexport type Brand = ${built.length === 0 ? 'never' : built.map((id) => JSON.stringify(id)).join(' | ')};\n`,
);

console.log(`Wrote dist/tokens.css, dist/brands.json and dist/brands.d.ts with ${built.length} brands: ${built.join(', ')}`);
for (const brand of empty) {
  console.log(`Left out ${brand}: tokens/brands/${brand}.json sets nothing, so data-brand="${brand}" looks like no brand and dist/brands.json does not list it. npm run check lists what it needs.`);
}
for (const { name, blocks } of switchBlocks.filter((each) => !isBrands(each))) {
  console.log(`Wrote ${blocks.length} ${name} block${blocks.length === 1 ? '' : 's'}: ${blocks.map(({ selector }) => blockName(selector)).join(', ') || 'none'}`);
}
const counts = new Map();
for (const selector of selectorOf.values()) counts.set(selector, (counts.get(selector) ?? 0) + 1);
console.log(`Declared ${selectorOf.size} semantic and component tokens, as ${SCOPES} says: ${[...counts].sort(([a], [b]) => byRank(a, b)).map(([selector, count]) => `${count} on ${selector}`).join(', ')}`);
if (dark.size > 0) console.log(`Dark mode differs from light in ${paired.length} semantics: ${paired.join(', ')}`);
