// Builds dist/tokens.css in layers, one block each:
//   1. primitives on :root, as plain values;
//   2. semantics on :root and on [data-brand], as var() references to primitives.
//      A semantic whose answer in tokens/modes/dark.json differs from its light
//      one is written light-dark(light, dark), both still references. The type
//      semantics, everything under type, have a block of their own, on [lang]
//      as well;
//   3. component tokens, the same way, as references to semantics;
//   4. one block per brand, [data-brand="<name>"], re-pointing some semantics
//      (and, for a component a brand restyles on its own, component tokens);
//   5. one block per locale, :lang(<code>), re-pointing type semantics;
//   6. color-scheme: "light dark" on :root, so a page that sets no mode follows
//      the reader's setting, then one value per data-mode.
// Keeping the references means a brand can re-point one semantic and everything
// that reads it follows. Declaring semantics on [data-brand] as well makes a
// brand set on any element re-resolve them right there, instead of inheriting
// the colours already worked out for the page.
//
// Locales work the same way for type. :lang(ar) matches an element whose
// language is ar or any ar- code, such as ar-EG, set on it or on an ancestor,
// so tokens/locales/ar.json reaches every element inside lang="ar-EG". The
// type semantics are declared on [lang] too, so an element that sets another
// language inside, such as an English label in an Arabic panel, gets the
// default type back unless a locale block below matches it. No other token is
// declared on [lang]: that would put a token a brand re-points, such as the
// button's radius, back to its value with no brand on anything inside the
// brand that sets a language. The locale blocks come after the brands, so they
// win over [data-brand] on an element that sets both.
//
// A mode needs no block of semantics the way a brand does. light-dark() picks
// its answer where a colour is used, from that element's color-scheme, and
// color-scheme is inherited. So data-mode only sets color-scheme, and
// everything inside follows it.
//
// Brands are whatever files sit in tokens/brands/. Adding a brand is adding a
// file; nothing here lists them by name. A file whose name starts with an
// underscore is not a brand: _template.json lists every token a brand may set,
// for a new brand to be copied from. A brand file that sets nothing, empty or
// {}, gets no block, so data-brand with its name looks like no brand until it
// sets something; npm run check says what it is missing.
//
// Light is what the semantics hold, and dark.json is the only mode file the
// build reads: light-dark() has two answers.
//
// Next to dist/tokens.css it writes the brands it built a block for, read from
// the same folder: dist/brands.json lists each one's id, display name and hue,
// and dist/brands.d.ts has a Brand type listing the ids. The demo builds its
// panels from brands.json, so it names no brand either.
import StyleDictionary from 'style-dictionary';
import { usesReferences } from 'style-dictionary/utils';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';

const PARTS = 'dist/.parts/';
const BASE = ['tokens/primitives/**/*.json', 'tokens/semantics/**/*.json', 'tokens/components/**/*.json'];
const DARK = 'tokens/modes/dark.json';
const inLayer = (layer) => (token) => token.filePath.startsWith(`tokens/${layer}/`);
const isType = (token) => token.path[0] === 'type';

// Semantics and brands point at tokens that sit in another block, which
// Style Dictionary reports as "filtered out references". The split is on
// purpose, so its warnings are off and the last line of this script reports
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
  for (const token of allTokens) if (token.isSource) dark.set(token.path.join('.'), token);
}

// A token as its file wrote it: the reference when it has one, else its value.
const asWritten = (token) => (usesReferences(token.original.$value) ? token.original.$value : token.$value);

// css/variables, except that a token whose dark answer differs from its light
// one is written light-dark(light, dark). Style Dictionary then turns each
// reference inside into a var(), the same as any other reference.
const paired = [];
const lightDark = (args) => {
  const allTokens = args.dictionary.allTokens.map((token) => {
    const answer = dark.get(token.path.join('.'));
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

const base = new StyleDictionary({
  log,
  source: BASE,
  hooks: { formats: { 'css/variables-light-dark': lightDark } },
  platforms: platform([
    { destination: 'primitives.css', format: 'css/variables', filter: inLayer('primitives') },
    {
      destination: 'semantics.css',
      format: 'css/variables-light-dark',
      filter: (token) => inLayer('semantics')(token) && !isType(token),
      options: { outputReferences: true, selector: ':root, [data-brand]' },
    },
    {
      destination: 'type.css',
      format: 'css/variables',
      filter: (token) => inLayer('semantics')(token) && isType(token),
      options: { outputReferences: true, selector: ':root, [data-brand], [lang]' },
    },
    {
      destination: 'components.css',
      format: 'css/variables',
      filter: inLayer('components'),
      options: { outputReferences: true, selector: ':root, [data-brand]' },
    },
  ]),
});
await base.buildAllPlatforms();

const brands = (await readdir('tokens/brands'))
  .filter((file) => file.endsWith('.json') && !file.startsWith('_'))
  .map((file) => file.replace(/\.json$/, ''))
  .sort();

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

// Style Dictionary writes no file for a brand that sets nothing, and cannot
// read an empty one at all, so those are set aside here instead of failing.
const empty = [];
for (const brand of brands) {
  const source = `tokens/brands/${brand}.json`;
  if ((await readFile(source, 'utf8')).trim() === '') {
    empty.push(brand);
    continue;
  }
  const sd = new StyleDictionary({
    log,
    include: BASE,
    source: [source],
    platforms: platform([
      {
        destination: `brand-${brand}.css`,
        format: 'css/variables',
        filter: (token) => token.isSource,
        options: { outputReferences: true, selector: `[data-brand="${brand}"]` },
      },
    ]),
  });
  const { allTokens } = await sd.getPlatformTokens('css');
  if (!allTokens.some((token) => token.isSource)) {
    empty.push(brand);
    continue;
  }
  hues.set(brand, hueOf(allTokens.filter((token) => token.isSource)));
  await sd.buildAllPlatforms();
}
const built = brands.filter((brand) => !empty.includes(brand));

// One block per file in tokens/locales/, named by its language code, such as
// ar.json. npm run check makes sure the name is a language and that the file
// sets only type semantics. A file that is empty or sets nothing gets no block.
const locales = existsSync('tokens/locales')
  ? (await readdir('tokens/locales')).filter((file) => file.endsWith('.json')).map((file) => file.replace(/\.json$/, '')).sort()
  : [];
const localeBlocks = [];
for (const locale of locales) {
  const source = `tokens/locales/${locale}.json`;
  if ((await readFile(source, 'utf8')).trim() === '') continue;
  const sd = new StyleDictionary({
    log,
    include: BASE,
    source: [source],
    platforms: platform([
      {
        destination: `locale-${locale}.css`,
        format: 'css/variables',
        filter: (token) => token.isSource,
        options: { outputReferences: true, selector: `:lang(${locale})` },
      },
    ]),
  });
  const { allTokens } = await sd.getPlatformTokens('css');
  if (!allTokens.some((token) => token.isSource)) continue;
  localeBlocks.push(locale);
  await sd.buildAllPlatforms();
}

// color-scheme picks the answer every light-dark() gives. These come after the
// :root blocks, so data-mode on <html> wins over the "light dark" set there.
const schemes = dark.size === 0 ? [] : [
  ':root {\n  color-scheme: light dark;\n}\n',
  '[data-mode="light"] {\n  color-scheme: light;\n}\n',
  '[data-mode="dark"] {\n  color-scheme: dark;\n}\n',
];

const order = [
  'primitives.css',
  'semantics.css',
  'type.css',
  'components.css',
  ...built.map((b) => `brand-${b}.css`),
  ...localeBlocks.map((l) => `locale-${l}.css`),
];
const blocks = await Promise.all(order.map((file) => readFile(PARTS + file, 'utf8')));
await mkdir('dist', { recursive: true });
await writeFile(
  'dist/tokens.css',
  `/* Built by scripts/build.js from tokens/. Do not edit by hand. */\n\n${[...blocks, ...schemes].join('\n')}`,
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
console.log(`Wrote ${localeBlocks.length} locale block${localeBlocks.length === 1 ? '' : 's'} after the brands: ${localeBlocks.map((l) => `:lang(${l})`).join(', ') || 'none'}`);
if (dark.size > 0) console.log(`Dark mode differs from light in ${paired.length} semantics: ${paired.join(', ')}`);
