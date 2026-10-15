// Builds dist/tokens.css in layers, one block each:
//   1. primitives on :root, as plain values;
//   2. semantics on :root and on [data-brand], as var() references to primitives.
// Keeping the references means a brand can re-point one semantic and everything
// that reads it follows. Declaring semantics on [data-brand] as well makes a
// brand set on any element re-resolve them right there, instead of inheriting
// the colours already worked out for the page.
import StyleDictionary from 'style-dictionary';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const PARTS = 'dist/.parts/';
const inLayer = (layer) => (token) => token.filePath.startsWith(`tokens/${layer}/`);

const sd = new StyleDictionary({
  source: ['tokens/**/*.json'],
  platforms: {
    css: {
      transformGroup: 'css',
      buildPath: PARTS,
      // Semantics point at primitives that sit in the block above them, which
      // Style Dictionary reports as "filtered out references". The split is on
      // purpose. A reference to a token that does not exist still fails the build.
      log: { warnings: 'disabled' },
      options: { showFileHeader: false },
      files: [
        { destination: 'primitives.css', format: 'css/variables', filter: inLayer('primitives') },
        {
          destination: 'semantics.css',
          format: 'css/variables',
          filter: inLayer('semantics'),
          options: { outputReferences: true, selector: ':root, [data-brand]' },
        },
      ],
    },
  },
});

await sd.buildAllPlatforms();

const blocks = await Promise.all(
  ['primitives.css', 'semantics.css'].map((file) => readFile(PARTS + file, 'utf8')),
);
await mkdir('dist', { recursive: true });
await writeFile(
  'dist/tokens.css',
  `/* Built by scripts/build.js from tokens/. Do not edit by hand. */\n\n${blocks.join('\n')}`,
);
await rm(PARTS, { recursive: true });
console.log('Wrote dist/tokens.css');
