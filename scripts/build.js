// Builds dist/tokens.css in layers, one block each:
//   1. primitives on :root, as plain values;
//   2. semantics on :root and on [data-brand], as var() references to primitives;
//   3. one block per brand, [data-brand="<name>"], re-pointing some semantics.
// Keeping the references means a brand can re-point one semantic and everything
// that reads it follows. Declaring semantics on [data-brand] as well makes a
// brand set on any element re-resolve them right there, instead of inheriting
// the colours already worked out for the page.
//
// Brands are whatever files sit in tokens/brands/. Adding a brand is adding a
// file; nothing here lists them by name.
import StyleDictionary from 'style-dictionary';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';

const PARTS = 'dist/.parts/';
const BASE = ['tokens/primitives/**/*.json', 'tokens/semantics/**/*.json'];
const inLayer = (layer) => (token) => token.filePath.startsWith(`tokens/${layer}/`);

// Semantics and brands point at tokens that sit in another block, which
// Style Dictionary reports as "filtered out references". The split is on
// purpose, so its warnings are off and the last line of this script reports
// what was written. A reference to a token that does not exist still fails.
const log = { warnings: 'disabled', verbosity: 'silent' };

const platform = (files) => ({
  css: { transformGroup: 'css', buildPath: PARTS, log, options: { showFileHeader: false }, files },
});

const base = new StyleDictionary({
  log,
  source: BASE,
  platforms: platform([
    { destination: 'primitives.css', format: 'css/variables', filter: inLayer('primitives') },
    {
      destination: 'semantics.css',
      format: 'css/variables',
      filter: inLayer('semantics'),
      options: { outputReferences: true, selector: ':root, [data-brand]' },
    },
  ]),
});
await base.buildAllPlatforms();

const brands = (await readdir('tokens/brands'))
  .filter((file) => file.endsWith('.json'))
  .map((file) => file.replace(/\.json$/, ''))
  .sort();

for (const brand of brands) {
  const sd = new StyleDictionary({
    log,
    include: BASE,
    source: [`tokens/brands/${brand}.json`],
    platforms: platform([
      {
        destination: `brand-${brand}.css`,
        format: 'css/variables',
        filter: (token) => token.isSource,
        options: { outputReferences: true, selector: `[data-brand="${brand}"]` },
      },
    ]),
  });
  await sd.buildAllPlatforms();
}

const order = ['primitives.css', 'semantics.css', ...brands.map((b) => `brand-${b}.css`)];
const blocks = await Promise.all(order.map((file) => readFile(PARTS + file, 'utf8')));
await mkdir('dist', { recursive: true });
await writeFile(
  'dist/tokens.css',
  `/* Built by scripts/build.js from tokens/. Do not edit by hand. */\n\n${blocks.join('\n')}`,
);
await rm(PARTS, { recursive: true });
console.log(`Wrote dist/tokens.css with ${brands.length} brands: ${brands.join(', ')}`);
