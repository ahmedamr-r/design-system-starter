// Checks the token rules that are easy to break and hard to see.
// Run it after `npm run build`; it reads the token files, the demo CSS,
// dist/tokens.css, and the scripts, workflows and config files that must not
// name a brand. It prints one line per check, and exits with an error if any fail.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
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
const components = layer('components');
const brands = layer('brands');

const names = (tokens) => new Set(tokens.map((token) => token.path));
const primitiveNames = names(primitives);
const semanticNames = names(semantics);
const componentNames = names(components);
const layeredNames = new Set([...semanticNames, ...componentNames]);

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
  ...[...semantics, ...components, ...brands]
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

// 2. Every token points one layer down: semantics at primitives, components at
//    semantics. A brand follows the rule of the token it re-points.
const pointsDown = (token, below, belowName) => {
  const target = referenceIn(token.value);
  if (!target) return [`${token.file}: ${token.path} holds a value. It should point at a ${belowName} token.`];
  if (!below.has(target)) return [`${token.file}: ${token.path} points at {${target}}, which is not a ${belowName} token.`];
  return [];
};
check('Every token points one layer down', [
  ...semantics.flatMap((token) => pointsDown(token, primitiveNames, 'primitive')),
  ...components.flatMap((token) => pointsDown(token, semanticNames, 'semantic')),
  ...brands.flatMap((token) =>
    componentNames.has(token.path)
      ? pointsDown(token, semanticNames, 'semantic')
      : pointsDown(token, primitiveNames, 'primitive'),
  ),
]);

// 3. The demo reads semantic tokens, never primitives.
const primitiveCss = new Set([...primitiveNames].map(cssName));
check('Demo CSS reads no primitives', demoCss.flatMap(({ file, text }) =>
  [...text.matchAll(/var\((--[\w-]+)/g)]
    .filter(([, name]) => primitiveCss.has(name))
    .map(([, name]) => `${file} reads ${name}, a primitive. Use the semantic token for that job.`),
));

// 4. A brand file only re-points tokens that exist.
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
check('Brand files only set tokens that exist', brands
  .filter(({ path }) => !layeredNames.has(path))
  .map(({ path, file }) => `${file}: ${path} is not a semantic or component token. Did you mean ${closest(path, layeredNames)}?`));

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
const semanticCss = new Set([...layeredNames].map(cssName));
const isBrandBlock = (selector) => /\[data-brand="/.test(selector);
const builtSemantics = blocks.flatMap(({ selector, declarations }) =>
  declarations.filter(({ name }) => semanticCss.has(name)).map((declaration) => ({ ...declaration, selector })),
);

// 5. In the built CSS, every semantic and component token is still a reference.
check('Every semantic and component token in dist/tokens.css is a var() reference', builtSemantics
  .filter(({ value }) => !value.startsWith('var('))
  .map(({ name, value, selector }) => `${name} is baked to ${value} under ${selector}. A brand that re-points what it reads will not reach it.`));

// 6. Semantics and component tokens are declared on every brand scope, before the brands.
const firstBrand = blocks.findIndex(({ selector }) => isBrandBlock(selector));
const lastBase = blocks.findLastIndex(({ selector, declarations }) =>
  !isBrandBlock(selector) && declarations.some(({ name }) => semanticCss.has(name)));
check('Semantic and component tokens are declared on :root and [data-brand], before the brands', [
  ...builtSemantics
    .filter(({ selector }) => !isBrandBlock(selector))
    .filter(({ selector }) => !selector.split(',').some((part) => part.trim() === '[data-brand]'))
    .map(({ name, selector }) => `${name} is declared under "${selector}" only. Anything that reads it inside a data-brand would keep the page's value.`),
  ...(firstBrand !== -1 && lastBase > firstBrand ? ['A brand block comes before the tokens it re-points, so they would undo it.'] : []),
]);

// 7. A semantic colour is named color.<role>.<intent>, with an optional -state
//    at the end, and names a job, not a colour. The colour words are the ramps
//    in tokens/primitives/color.json, so a new ramp is covered once it is added.
//    Grey and gray count as the same word.
const ROLES = ['surface', 'fill', 'text', 'border'];
const sameWord = (word) => (word.toLowerCase() === 'grey' ? 'gray' : word.toLowerCase());
const rampFile = join('tokens', 'primitives', 'color.json');
const ramps = new Set(
  Object.keys(existsSync(rampFile) ? JSON.parse(readFileSync(rampFile, 'utf8')).color ?? {} : {})
    .filter((key) => !key.startsWith('$'))
    .map(sameWord),
);
// A semantic is a colour if it sits under color, or points at a colour primitive.
const isColour = ({ path, value }) => path.startsWith('color.') || Boolean(referenceIn(value)?.startsWith('color.'));
check('Semantic colours are named color.<role>.<intent> after a job, not a colour', semantics
  .filter(isColour)
  .flatMap(({ path, file }) => {
    const [first, role, intent, ...extra] = path.split('.');
    const problems = [];
    if (first !== 'color' || !intent || extra.length > 0 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(intent)) {
      problems.push(`${file}: ${path} should be named color.<role>.<intent>, with an optional -state at the end, as in color.fill.brand-hover.`);
    } else if (!ROLES.includes(role)) {
      problems.push(`${file}: ${path} has the role "${role}". The role is surface, fill, text or border.`);
    }
    const colourWords = new Set(path.split(/[.-]/).filter((word) => ramps.has(sameWord(word))));
    for (const word of colourWords) {
      problems.push(`${file}: ${path} names the colour ${word}. Name the job it does instead, as in color.fill.brand.`);
    }
    return problems;
  }));

// 8. No script, workflow or root config file names a brand. The brand names are
//    the file names in tokens/brands/, read the way the build reads them, so
//    none is written here. Root config files are dotfiles such as .nvmrc and
//    files such as package.json or vite.config.js. package-lock.json is left
//    out: npm writes it, and it lists packages, not brands.
const brandNames = existsSync(join('tokens', 'brands'))
  ? readdirSync(join('tokens', 'brands'))
      .filter((file) => file.endsWith('.json'))
      .map((file) => file.replace(/\.json$/, ''))
  : [];
const filesIn = (dir) =>
  existsSync(dir)
    ? readdirSync(dir, { recursive: true })
        .map((file) => join(dir, file))
        .filter((file) => statSync(file).isFile())
    : [];
const CONFIG_ENDINGS = ['.json', '.js', '.mjs', '.cjs', '.ts', '.yml', '.yaml', '.toml'];
const rootConfig = readdirSync('.')
  .filter((file) => file !== 'package-lock.json' && file !== '.DS_Store')
  .filter((file) => file.startsWith('.') || CONFIG_ENDINGS.some((ending) => file.endsWith(ending)))
  .filter((file) => statSync(file).isFile());
const escapeForRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// A whole word: no letter, digit or underscore right before or after it.
const brandWord = new RegExp(`(?<!\\w)(?:${brandNames.map(escapeForRegExp).join('|')})(?!\\w)`, 'gi');
check('No script, workflow or root config file names a brand', brandNames.length === 0 ? [] :
  [...filesIn('scripts'), ...filesIn('.github'), ...rootConfig].flatMap((file) =>
    readFileSync(file, 'utf8')
      .split('\n')
      .flatMap((line, i) => [...line.matchAll(brandWord)].map(([name]) =>
        `${file}:${i + 1} names the brand ${name}. Brands are the files in tokens/brands/, so read them from there instead.`)),
  ));

if (failed > 0) {
  console.log(`\n${failed} check${failed === 1 ? '' : 's'} failed.`);
  process.exit(1);
}
console.log('\nAll checks passed.');
