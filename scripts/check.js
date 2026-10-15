// Checks the token rules that are easy to break and hard to see.
// Run it after `npm run build`; it reads the token files, the demo CSS and
// dist/tokens.css, prints one line per check, and exits with an error if any fail.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------- reading

const jsonFiles = (dir) =>
  existsSync(dir)
    ? readdirSync(dir, { recursive: true })
        .filter((file) => file.endsWith('.json'))
        .map((file) => join(dir, file))
    : [];

// Every token in a file, as { path: 'color.fill.brand', value, file }.
function tokensIn(file) {
  const found = [];
  const walk = (node, path) => {
    if (node && typeof node === 'object' && '$value' in node) {
      found.push({ path: path.join('.'), value: node.$value, file });
      return;
    }
    for (const [key, child] of Object.entries(node ?? {})) {
      if (!key.startsWith('$')) walk(child, [...path, key]);
    }
  };
  walk(JSON.parse(readFileSync(file, 'utf8')), []);
  return found;
}

const layer = (name) => jsonFiles(join('tokens', name)).flatMap(tokensIn);
const primitives = layer('primitives');
const semantics = layer('semantics');
const brands = layer('brands');

const names = (tokens) => new Set(tokens.map((token) => token.path));
const primitiveNames = names(primitives);
const semanticNames = names(semantics);

const cssName = (path) => `--${path.replaceAll('.', '-')}`;
const referenceIn = (value) => (typeof value === 'string' ? value.match(/^\{([^}]+)\}$/)?.[1] : undefined);

// ---------------------------------------------------------------- reporting

let failed = 0;
function check(title, problems) {
  if (problems.length === 0) {
    console.log(`✔ ${title}`);
    return;
  }
  failed += 1;
  console.log(`✖ ${title}`);
  for (const problem of problems.slice(0, 5)) console.log(`    ${problem}`);
  if (problems.length > 5) console.log(`    …and ${problems.length - 5} more like these.`);
}

// ---------------------------------------------------------------- the checks

// 1. Raw colours live in primitives and nowhere else.
const COLOUR_LITERAL = /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\(/i;
const demoCss = existsSync('demo')
  ? readdirSync('demo')
      .filter((file) => file.endsWith('.css'))
      .map((file) => ({ file: join('demo', file), text: readFileSync(join('demo', file), 'utf8') }))
  : [];

check('Colour values appear only in tokens/primitives', [
  ...[...semantics, ...brands]
    .filter(({ value }) =>
      typeof value === 'object' ? 'colorSpace' in value : COLOUR_LITERAL.test(String(value)),
    )
    .map(({ path, file }) => `${file}: ${path} holds a colour value. Point it at a primitive instead.`),
  ...demoCss.flatMap(({ file, text }) =>
    text
      .split('\n')
      .map((line, i) => ({ line: line.replace(/\/\*.*?\*\//g, ''), number: i + 1 }))
      .filter(({ line }) => COLOUR_LITERAL.test(line))
      .map(({ number }) => `${file}:${number} uses a colour value. Use a semantic token instead.`),
  ),
]);

// 2. Semantics and brands point at primitives, never at raw values or at each other.
check('Semantic and brand tokens point at primitives only', [...semantics, ...brands].flatMap(({ path, value, file }) => {
  const target = referenceIn(value);
  if (!target) return [`${file}: ${path} holds a value. Semantics and brands only point at primitives.`];
  if (!primitiveNames.has(target)) return [`${file}: ${path} points at {${target}}, which is not a primitive.`];
  return [];
}));

// 3. The demo reads semantic tokens, never primitives.
const primitiveCss = new Set([...primitiveNames].map(cssName));
check('Demo CSS reads no primitives', demoCss.flatMap(({ file, text }) =>
  [...text.matchAll(/var\((--[\w-]+)/g)]
    .filter(([, name]) => primitiveCss.has(name))
    .map(([, name]) => `${file} reads ${name}, a primitive. Use the semantic token for that job.`),
));

// 4. A brand file only re-points semantics that exist.
function closest(word, options) {
  const distance = (a, b) => {
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let previous = row[0];
      row[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const current = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
        previous = current;
      }
    }
    return row[b.length];
  };
  return [...options].sort((a, b) => distance(word, a) - distance(word, b))[0];
}
check('Brand files only set semantic tokens that exist', brands
  .filter(({ path }) => !semanticNames.has(path))
  .map(({ path, file }) => `${file}: ${path} is not a semantic token. Did you mean ${closest(path, semanticNames)}?`));

// 5 and 6 read the built CSS.
if (!existsSync('dist/tokens.css')) {
  console.log('✖ dist/tokens.css is missing. Run npm run build first.');
  process.exit(1);
}
const blocks = [...readFileSync('dist/tokens.css', 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .matchAll(/([^{}]+)\{([^}]*)\}/g)]
  .map(([, selector, body]) => ({
    selector: selector.trim(),
    declarations: [...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => ({ name, value: value.trim() })),
  }));
const semanticCss = new Set([...semanticNames].map(cssName));
const isBrandBlock = (selector) => /\[data-brand="/.test(selector);
const builtSemantics = blocks.flatMap(({ selector, declarations }) =>
  declarations.filter(({ name }) => semanticCss.has(name)).map((declaration) => ({ ...declaration, selector })),
);

// 5. In the built CSS, every semantic is still a reference.
check('Every semantic in dist/tokens.css is a var() reference', builtSemantics
  .filter(({ value }) => !value.startsWith('var('))
  .map(({ name, value, selector }) => `${name} is baked to ${value} under ${selector}. A brand that re-points what it reads will not reach it.`));

// 6. Semantics are declared on every brand scope, before the brand blocks.
const firstBrand = blocks.findIndex(({ selector }) => isBrandBlock(selector));
const lastBase = blocks.findLastIndex(({ selector, declarations }) =>
  !isBrandBlock(selector) && declarations.some(({ name }) => semanticCss.has(name)));
check('Semantics are declared on :root and [data-brand], before the brands', [
  ...builtSemantics
    .filter(({ selector }) => !isBrandBlock(selector))
    .filter(({ selector }) => !selector.split(',').some((part) => part.trim() === '[data-brand]'))
    .map(({ name, selector }) => `${name} is declared under "${selector}" only. Anything that reads it inside a data-brand would keep the page's value.`),
  ...(firstBrand !== -1 && lastBase > firstBrand ? ['A brand block comes before the semantics, so the semantics would undo it.'] : []),
]);

if (failed > 0) {
  console.log(`\n${failed} check${failed === 1 ? '' : 's'} failed.`);
  process.exit(1);
}
console.log('\nAll checks passed.');
