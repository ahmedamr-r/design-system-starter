// Checks the token rules that are easy to break and hard to see.
// Run it after `npm run build`; it reads the token files, the demo's CSS and
// HTML, dist/tokens.css, tokens/contrast-pairs.json, and the scripts, workflows
// and config files that must not name a brand. It prints one line per check,
// and exits with an error if any fail.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { resolver } from './lib/resolve.js';

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
const modes = layer('modes');

const names = (tokens) => new Set(tokens.map((token) => token.path));
const primitiveNames = names(primitives);
const semanticNames = names(semantics);
const componentNames = names(components);
const layeredNames = new Set([...semanticNames, ...componentNames]);

const cssName = (path) => `--${path.replaceAll('.', '-')}`;
const referenceIn = (value) => (typeof value === 'string' ? value.match(/^\{([^}]+)\}$/)?.[1] : undefined);

// ---------------------------------------------------------------- reporting

// A check prints its first five problems, or every one with { all: true }.
let failed = 0;
function check(title, problems, { all = false } = {}) {
  if (problems.length === 0) {
    console.log(`✔ ${title}`);
    return;
  }
  failed += 1;
  console.log(`✖ ${title}`);
  const shown = all ? problems : problems.slice(0, 5);
  for (const problem of shown) console.log(`    ${problem}`);
  if (problems.length > shown.length) console.log(`    …and ${problems.length - shown.length} more like these.`);
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
//    semantics. A brand or mode follows the rule of the token it re-points.
const pointsDown = (token, below, belowName) => {
  const target = referenceIn(token.value);
  if (!target) return [`${token.file}: ${token.path} holds a value. It should point at a ${belowName} token.`];
  if (!below.has(target)) return [`${token.file}: ${token.path} points at {${target}}, which is not a ${belowName} token.`];
  return [];
};
check('Every token points one layer down', [
  ...semantics.flatMap((token) => pointsDown(token, primitiveNames, 'primitive')),
  ...components.flatMap((token) => pointsDown(token, semanticNames, 'semantic')),
  ...[...brands, ...modes].flatMap((token) =>
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
//    light-dark() of two references counts as one: it is how the build writes
//    a semantic whose dark answer differs from its light one.
const VAR = String.raw`var\(\s*--[\w-]+\s*\)`;
const LIGHT_DARK = new RegExp(String.raw`^light-dark\(\s*${VAR}\s*,\s*${VAR}\s*\)$`);
const isReference = (value) => value.startsWith('var(') || LIGHT_DARK.test(value);
check('Every semantic and component token in dist/tokens.css is a var() reference, or light-dark() of two', builtSemantics
  .filter(({ value }) => !isReference(value))
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

// 9. A mode file re-points colour semantics that exist, and nothing else. It
//    holds no colour value and sets no primitive, so color.gray.900 is the
//    same colour in every mode.
const colourSemantics = semantics.filter(isColour);
const colourSemanticNames = names(colourSemantics);
check('Mode files only re-point colour semantics that exist', modes.flatMap(({ path, value, file }) => {
  const problems = [];
  if (typeof value === 'object' ? 'colorSpace' in value : COLOUR_LITERAL.test(String(value))) {
    problems.push(`${file}: ${path} holds a colour value. Point it at a primitive instead.`);
  }
  if (primitiveNames.has(path)) {
    problems.push(`${file}: ${path} is a primitive. A mode re-points semantics and leaves primitives alone, so ${path} is the same colour in every mode.`);
  } else if (!semanticNames.has(path) && !componentNames.has(path)) {
    problems.push(`${file}: ${path} is not a token. Did you mean ${closest(path, colourSemanticNames)}?`);
  } else if (!colourSemanticNames.has(path)) {
    problems.push(`${file}: ${path} is not a colour semantic. A mode re-points colour semantics only.`);
  }
  return problems;
}));

// 10. Every colour semantic has an answer in tokens/modes/dark.json, even where
//     dark is the same as light, so a colour semantic added later cannot be
//     forgotten there.
const DARK = join('tokens', 'modes', 'dark.json');
const darkAnswers = names(modes.filter(({ file }) => file === DARK));
check('Every colour semantic has an answer in tokens/modes/dark.json', !existsSync(DARK)
  ? [`${DARK} is missing. Every colour semantic needs a dark answer there.`]
  : colourSemantics
      .filter(({ path }) => !darkAnswers.has(path))
      .map(({ path, value, file }) =>
        `${DARK} has no answer for ${path}. Add one; if dark is the same as light, that is ${value}, as in ${file}.`));

// 11. dark is the only mode. The build writes a mode as light-dark(), which has
//     a light answer and a dark one, and light is what the semantics hold.
check('tokens/modes holds no mode other than dark', jsonFiles(join('tokens', 'modes'))
  .filter((file) => file !== DARK)
  .map((file) => `${file} is a mode other than dark. light-dark() has only a light answer and a dark one, and light is what the semantics already hold.`));

// 12. The demo reads only variables dist/tokens.css writes, so a misspelt name
//     fails here instead of quietly falling back to an inherited or default value. The
//     suggestion leaves out primitives, which check 3 forbids the demo to read.
const written = new Set(blocks.flatMap(({ declarations }) => declarations.map(({ name }) => name)));
const readable = [...written].filter((name) => !primitiveCss.has(name));
// Comments are blanked, not removed, so line numbers stay right.
const blank = (comment) => comment.replace(/[^\n]/g, ' ');
const demoFiles = existsSync('demo')
  ? readdirSync('demo')
      .filter((file) => file.endsWith('.css') || file.endsWith('.html'))
      .map((file) => ({
        file: join('demo', file),
        text: readFileSync(join('demo', file), 'utf8').replace(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->/g, blank),
      }))
  : [];
check('The demo reads only variables the build writes', demoFiles.flatMap(({ file, text }) =>
  text.split('\n').flatMap((line, i) =>
    [...line.matchAll(/var\(\s*(--[\w-]+)/g)]
      .filter(([, name]) => !written.has(name))
      .map(([, name]) => `${file}:${i + 1} reads ${name}, which dist/tokens.css does not write. Did you mean ${closest(name, readable)}?`)),
));

// 13 and 14 read tokens/contrast-pairs.json: each text and focus colour, the
// surfaces and fills the demo puts it on, and the ratio it must reach there.
// Both colours of a pair are worked out from dist/tokens.css by
// scripts/lib/resolve.js, as the browser would, for every brand and for no
// brand, in light and in dark. Both checks print every problem they find.
const PAIRS = join('tokens', 'contrast-pairs.json');
const colourOf = resolver(readFileSync('dist/tokens.css', 'utf8'));
const contexts = [null, ...[...brandNames].sort()].flatMap((brand) =>
  ['light', 'dark'].map((mode) => ({ brand, mode })));
const contextName = ({ brand, mode }) => `${brand ?? 'no brand'}, ${mode}`;

// The pairs, as { foreground, background, ratio }, and anything wrong with the file.
const pairProblems = [];
const pairs = [];
let pairFile = {};
if (!existsSync(PAIRS)) {
  pairProblems.push(`${PAIRS} is missing. List each text and focus colour there, with the surfaces and fills it sits on and the ratio it must reach.`);
} else {
  try {
    pairFile = JSON.parse(readFileSync(PAIRS, 'utf8'));
  } catch (error) {
    pairProblems.push(`${PAIRS} is not valid JSON: ${error.message}`);
  }
}
for (const [foreground, entry] of Object.entries(pairFile)) {
  if (foreground.startsWith('$')) continue;
  if (!layeredNames.has(foreground)) {
    pairProblems.push(`${PAIRS}: ${foreground} is not a semantic or component token. Did you mean ${closest(foreground, layeredNames)}?`);
    continue;
  }
  const { ratio, on } = entry ?? {};
  if (typeof ratio !== 'number' || ratio < 1 || ratio > 21) {
    pairProblems.push(`${PAIRS}: ${foreground} needs a ratio between 1 and 21, such as 4.5 for text or 3 for a focus ring.`);
    continue;
  }
  if (!Array.isArray(on) || on.length === 0) {
    pairProblems.push(`${PAIRS}: ${foreground} needs "on", the list of surfaces and fills it sits on.`);
    continue;
  }
  for (const background of on) {
    if (layeredNames.has(background)) pairs.push({ foreground, background, ratio });
    else pairProblems.push(`${PAIRS}: ${foreground} sits on ${background}, which is not a semantic or component token. Did you mean ${closest(String(background), layeredNames)}?`);
  }
}

// WCAG 2 contrast: the relative luminance of each sRGB hex colour, then
// (lighter + 0.05) / (darker + 0.05), from 1:1 to 21:1. The ratio is compared
// as it is, never rounded, so 4.499:1 falls short of 4.5:1.
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5]
    .map((at) => parseInt(hex.slice(at, at + 2), 16) / 255)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (one, other) => {
  const [lighter, darker] = [luminance(one), luminance(other)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
};
// Shown cut to two decimals, so a ratio just short of the bar never prints as reaching it.
const twoPlaces = (ratio) => (Math.floor(ratio * 100) / 100).toFixed(2);

// Every pair in every brand and mode. covered collects each token a
// foreground passes through, so button.label also covers color.text.on-fill.
const measured = [];
const covered = new Set();
const unresolved = [];
for (const context of contexts) {
  for (const { foreground, background, ratio } of pairs) {
    try {
      const front = colourOf(foreground, context);
      for (const name of front.chain) covered.add(name);
      const back = colourOf(background, context);
      measured.push({ foreground, background, ratio, context, front: front.hex, back: back.hex, reached: contrast(front.hex, back.hex) });
    } catch (error) {
      unresolved.push(`${PAIRS}: ${foreground} on ${background} cannot be worked out for ${contextName(context)}. ${error.message}`);
    }
  }
}

// 13. Every text and focus colour has a pair. They are the color.text and
//     color.border.focus semantics, and any component token that points at
//     one of them, such as button.label.
const TEXT_OR_FOCUS = /^color\.(?:text\.|border\.focus(?:-|$))/;
const textOrFocusSemantics = new Set(colourSemantics.map(({ path }) => path).filter((path) => TEXT_OR_FOCUS.test(path)));
const textOrFocus = [
  ...textOrFocusSemantics,
  ...components.filter(({ value }) => textOrFocusSemantics.has(referenceIn(value))).map(({ path }) => path),
];
check(`Every text and focus colour has a pair in ${PAIRS}`, [
  ...pairProblems,
  ...textOrFocus
    .filter((path) => !covered.has(cssName(path)))
    .map((path) => `${PAIRS} has no pair for ${path}. Add it with each surface or fill the demo puts it on, and the ratio it must reach: 4.5 for text, 3 for a focus ring.`),
  ...unresolved,
], { all: true });

// 14. Every pair reaches its ratio, for every brand and for no brand, in light and in dark.
const shortfalls = measured.filter(({ reached, ratio }) => reached < ratio);
check(
  `Every pair in ${PAIRS} reaches its ratio, for each brand and no brand, in light and dark` +
    (shortfalls.length > 0 ? ` (${shortfalls.length} of ${measured.length} fall short)` : ''),
  shortfalls.map(({ foreground, background, ratio, context, front, back, reached }) =>
    `${contextName(context)}: ${foreground} on ${background} is ${twoPlaces(reached)}:1, needs ${ratio}:1 (${front} on ${back})`),
  { all: true },
);

if (failed > 0) {
  console.log(`\n${failed} check${failed === 1 ? '' : 's'} failed.`);
  process.exit(1);
}
console.log('\nAll checks passed.');
