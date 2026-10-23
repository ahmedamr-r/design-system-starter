// Checks the token rules that are easy to break and hard to see.
// Run it after `npm run build`; it reads the token files, the demo's CSS and
// HTML, dist/tokens.css, tokens/contrast-pairs.json, and the scripts, workflows,
// config files and demo files that must not name a brand, then the demo's
// script and demo/copy.json for language and direction, and last every CSS
// file and the CSS in every HTML file outside node_modules and the build
// folders, and each token's $description, for anything that names a side, and
// that same CSS again for line heights that read no token, then the files in
// tokens/locales/, that same CSS once more for italics and capitals, and last
// the icon names in the HTML, the demo's script, the CSS and the .svg files,
// for any named left or right, and last demo/copy.json for digits and the
// demo's HTML for a price typed in the price slot, then that demo/copy.json
// still holds a language that reads right to left, then that every focus
// style in the CSS keeps its outline and draws no box-shadow, and at the very
// end that every value in dist/tokens.css is one CSS can read. Check 12, that
// the CSS reads only variables the build writes, reads the same CSS as the
// side checks: every CSS file and the CSS in every HTML file. It prints one
// line per check, and exits with an error if any fail.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { resolver } from './lib/resolve.js';

// ---------------------------------------------------------------- reading

const jsonFiles = (dir) =>
  existsSync(dir)
    ? readdirSync(dir, { recursive: true })
        .filter((file) => file.endsWith('.json'))
        .map((file) => join(dir, file))
    : [];

// Every token in a file, as { path: 'color.fill.brand', value, file }. An
// empty file holds none.
function tokensIn(file) {
  const text = readFileSync(file, 'utf8');
  if (text.trim() === '') return [];
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
  walk(JSON.parse(text), []);
  return found;
}

const layer = (name) => jsonFiles(join('tokens', name)).flatMap(tokensIn);
const primitives = layer('primitives');
const semantics = layer('semantics');
const components = layer('components');
const modes = layer('modes');

// A file in tokens/brands/ whose name starts with an underscore is not a
// brand, here as in the build. _template.json is one: it lists every token a
// brand may set, each at its value with no brand, for a new brand to be copied
// from. Checks 1 and 2 still read every file in the folder; checks 4, 8 and 14
// read the brands.
const BRANDS = join('tokens', 'brands');
const TEMPLATE = join(BRANDS, '_template.json');
const isBrand = (file) => !basename(file).startsWith('_');
const brandFolder = layer('brands');
const brandFiles = jsonFiles(BRANDS).filter(isBrand);
const brands = brandFolder.filter(({ file }) => isBrand(file));
const template = brandFolder.filter(({ file }) => file === TEMPLATE);

const names = (tokens) => new Set(tokens.map((token) => token.path));
const primitiveNames = names(primitives);
const semanticNames = names(semantics);
const componentNames = names(components);
const layeredNames = new Set([...semanticNames, ...componentNames]);

const cssName = (path) => `--${path.replaceAll('.', '-')}`;
const referenceIn = (value) => (typeof value === 'string' ? value.match(/^\{([^}]+)\}$/)?.[1] : undefined);
// A token is a colour if it sits under color, or points at a colour token.
const isColour = ({ path, value }) => path.startsWith('color.') || Boolean(referenceIn(value)?.startsWith('color.'));

// The brand ramp: color.brand.<step>, where the step is a number such as 600.
// Its steps are semantics, in tokens/semantics/brand.json, and each points at a
// primitive. A brand file points every step at the same step of its own
// primitive ramp, and the brand semantics, such as color.fill.brand, point at
// steps, so a brand reaches all of them, in light and in dark, without
// re-pointing any. The steps are not jobs: no mode answers them and the demo
// never reads them.
const RAMP_STEP = /^color\.brand\.(\d+)$/;
const rampSteps = new Set([...semanticNames].filter((path) => RAMP_STEP.test(path)));
const stepOf = (path) => path.match(RAMP_STEP)[1];

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
  ...[...semantics, ...components, ...brandFolder]
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

// 2. Every token points one layer down: a step of the brand ramp at a
//    primitive, any other semantic at a primitive or a step of the ramp, and a
//    component token at a semantic. A brand or mode follows the rule of the
//    token it re-points.
const primitivesOrSteps = new Set([...primitiveNames, ...rampSteps]);
const mayPointAt = (path) => {
  if (componentNames.has(path)) return { allowed: semanticNames, what: 'a semantic token' };
  if (rampSteps.has(path)) return { allowed: primitiveNames, what: 'a primitive token' };
  return { allowed: primitivesOrSteps, what: 'a primitive token or a step of the brand ramp' };
};
const pointsDown = (token) => {
  const { allowed, what } = mayPointAt(token.path);
  const target = referenceIn(token.value);
  if (!target) return [`${token.file}: ${token.path} holds a value. It should point at ${what}.`];
  if (!allowed.has(target)) return [`${token.file}: ${token.path} points at {${target}}, which is not ${what}.`];
  return [];
};
check('Every token points one layer down, or at a step of the brand ramp',
  [...semantics, ...components, ...brandFolder, ...modes].flatMap(pointsDown));

// 3. The demo reads semantic tokens, never a primitive and never a step of the
//    brand ramp. A step has no dark answer: color.text.link turns lighter in
//    dark, but a page that read color.brand.700 would stay dark on dark.
//    Comments are blanked, not removed, so line numbers stay right.
const primitiveCss = new Set([...primitiveNames].map(cssName));
const rampCss = new Set([...rampSteps].map(cssName));
const blank = (comment) => comment.replace(/[^\n]/g, ' ');
const demoFiles = existsSync('demo')
  ? readdirSync('demo')
      .filter((file) => file.endsWith('.css') || file.endsWith('.html'))
      .map((file) => ({
        file: join('demo', file),
        text: readFileSync(join('demo', file), 'utf8').replace(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->/g, blank),
      }))
  : [];
const demoReads = demoFiles.flatMap(({ file, text }) =>
  text.split('\n').flatMap((line, i) =>
    [...line.matchAll(/var\(\s*(--[\w-]+)/g)].map(([, name]) => ({ file, line: i + 1, name }))));
check('The demo reads no primitive and no step of the brand ramp', demoReads.flatMap(({ file, line, name }) => {
  if (primitiveCss.has(name)) return [`${file}:${line} reads ${name}, a primitive. Use the semantic token for that job.`];
  if (rampCss.has(name)) {
    return [`${file}:${line} reads ${name}, a step of the brand ramp, which has no dark answer. Use the semantic token for that job, such as --color-fill-brand.`];
  }
  return [];
}));

// 4. A brand file sets every step of the brand ramp, its only colours, and
//    nothing tokens/brands/_template.json does not list.
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
// A brand's only colours are the steps of the brand ramp: every step, each at
// the same step of one primitive ramp, as color.brand.600 at {color.blue.600}.
// The brand semantics read the steps, so they follow the brand without being
// re-pointed, and each keeps the dark answer tokens/modes/dark.json gives it.
// Anything else a brand sets, such as button.radius, must be listed in the
// template. A brand file that sets nothing gets one problem saying what it is
// missing: the build writes no block for it, and check 14 leaves it out.
const PRIMITIVE_STEP = /^color\.([^.]+)\.([^.]+)$/;
const hasTemplate = existsSync(TEMPLATE);
const templateNames = names(template);
const brandProblems = (file) => {
  const own = brands.filter((token) => token.file === file);
  if (own.length === 0) {
    return [`${file} sets nothing. It is missing every step of the brand ramp: ${[...rampSteps].join(', ')}. Copy ${TEMPLATE}, which lists them and every other token a brand may set, and point each step at the same step of one primitive ramp. Until then the build writes no block for it, and the contrast check leaves it out.`];
  }
  const problems = [];
  for (const token of own) {
    const { path } = token;
    if (!layeredNames.has(path)) {
      problems.push(`${file}: ${path} is not a semantic or component token. Did you mean ${closest(path, templateNames.size > 0 ? templateNames : layeredNames)}?`);
    } else if (!rampSteps.has(path) && isColour(token)) {
      problems.push(componentNames.has(path)
        ? `${file}: ${path} is a colour, and a brand sets no colour but the brand ramp. ${path} follows the ramp through the semantic it reads in tokens/components/.`
        : `${file}: ${path} is a colour, and a brand sets no colour but the brand ramp. Point ${path} at a step of the ramp in tokens/semantics/ for light and tokens/modes/dark.json for dark, and every brand reaches it.`);
    } else if (hasTemplate && !templateNames.has(path)) {
      problems.push(`${file}: ${path} is not in ${TEMPLATE}, the list of every token a brand may set. Take it out, or, if every brand should be able to set it, add it to the template first, at its value with no brand.`);
    }
  }
  const steps = own.filter(({ path }) => rampSteps.has(path));
  const missing = [...rampSteps].filter((path) => !steps.some((token) => token.path === path));
  if (missing.length > 0) {
    problems.push(`${file} does not set ${missing.join(', ')}. A brand points every step of the brand ramp at the same step of one primitive ramp.`);
  }
  const rampsUsed = new Set();
  for (const { path, value } of steps) {
    const target = referenceIn(value);
    if (!target || !primitiveNames.has(target)) continue; // Check 2 reports these.
    const [, ramp, step] = target.match(PRIMITIVE_STEP) ?? [];
    if (!ramp) {
      problems.push(`${file}: ${path} points at {${target}}, which is not a step of a primitive colour ramp. Point it at {color.<ramp>.${stepOf(path)}}.`);
      continue;
    }
    rampsUsed.add(ramp);
    if (step !== stepOf(path)) {
      problems.push(`${file}: ${path} points at {${target}}. Point it at the same step, {color.${ramp}.${stepOf(path)}}.`);
    }
  }
  if (rampsUsed.size > 1) {
    problems.push(`${file} points the brand ramp at more than one primitive ramp: ${[...rampsUsed].join(', ')}. Point every step at one.`);
  }
  return problems;
};
check(`Brand files set every step of the brand ramp, step for step on one primitive ramp, and nothing ${TEMPLATE} does not list`, [
  ...(hasTemplate ? [] : [`${TEMPLATE} is missing. It lists every token a brand may set, each at its value with no brand, and a new brand is copied from it.`]),
  ...brandFiles.flatMap(brandProblems),
]);

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

// 6. Semantics and component tokens are declared on every brand scope, before
//    the brands. The type tokens, the semantics under type, are declared on
//    [lang] as well, so an element that sets a language gets the default type
//    back unless a locale re-points it, and no other token is: on [lang] it
//    would put a token a brand re-points back to its value with no brand, on
//    anything inside the brand that sets a language. Each file in
//    tokens/locales/ that sets something is a :lang(<code>) block, after the
//    brands, so :lang(ar) also reaches lang="ar-EG" and wins over [data-brand].
const LOCALES = join('tokens', 'locales');
const localeFiles = jsonFiles(LOCALES);
const locales = localeFiles.flatMap(tokensIn);
const typeCss = new Set([...semanticNames].filter((path) => path.startsWith('type.')).map(cssName));
// A block for one language: :lang(ar), or one built the wrong way, such as
// [lang="ar"], which the locale problems below report on their own.
const isLocaleBlock = (selector) => /:lang\(|\[\s*lang\s*[~|^$*]?=/i.test(selector);
const scopesOf = (selector) => selector.split(',').map((part) => part.trim());
const firstBrand = blocks.findIndex(({ selector }) => isBrandBlock(selector));
const lastBrand = blocks.findLastIndex(({ selector }) => isBrandBlock(selector));
const lastBase = blocks.findLastIndex(({ selector, declarations }) =>
  !isBrandBlock(selector) && !isLocaleBlock(selector) && declarations.some(({ name }) => semanticCss.has(name)));
const baseDeclarations = builtSemantics.filter(({ selector }) => !isBrandBlock(selector) && !isLocaleBlock(selector));
const localeBlockProblems = localeFiles
  .filter((file) => locales.some((token) => token.file === file))
  .flatMap((file) => {
    const code = basename(file, '.json');
    const at = blocks.findIndex(({ selector }) => scopesOf(selector).includes(`:lang(${code})`));
    if (at === -1) {
      return [`${file} has no :lang(${code}) block in dist/tokens.css. Build each locale as a :lang() block, so lang="${code}" reads it, and so does any lang that starts with ${code}-.`];
    }
    if (at < lastBrand) {
      return [`The :lang(${code}) block from ${file} comes before a brand block. Put the locale blocks after the brands, so a brand's [data-brand] does not undo them on an element that sets both.`];
    }
    return [];
  });
check('Semantic and component tokens are declared on :root and [data-brand], before the brands, type tokens on [lang] as well, and each locale is a :lang() block after the brands', [
  ...localeBlockProblems,
  ...baseDeclarations
    .filter(({ selector }) => !scopesOf(selector).includes('[data-brand]'))
    .map(({ name, selector }) => `${name} is declared under "${selector}" only. Anything that reads it inside a data-brand would keep the page's value.`),
  ...baseDeclarations
    .filter(({ name, selector }) => typeCss.has(name) && !scopesOf(selector).includes('[lang]'))
    .map(({ name, selector }) => `${name} is a type token declared under "${selector}" without [lang]. An element that sets a language inside an Arabic one, such as an English label, would keep the Arabic type. Declare the type tokens on ":root, [data-brand], [lang]".`),
  ...baseDeclarations
    .filter(({ name, selector }) => !typeCss.has(name) && scopesOf(selector).includes('[lang]'))
    .map(({ name, selector }) => `${name} is declared under "${selector}", and only type tokens go on [lang]. Anything inside a brand that sets a language would get ${name} back at its value with no brand.`),
  ...(firstBrand !== -1 && lastBase > firstBrand ? ['A brand block comes before the tokens it re-points, so they would undo it.'] : []),
]);

// 7. A semantic colour is named color.<role>.<intent>, with an optional -state
//    at the end, and names a job, not a colour. The colour words are the ramps
//    in tokens/primitives/color.json, so a new ramp is covered once it is added.
//    Grey and gray count as the same word. The brand ramp, color.brand.<step>,
//    is the one colour semantic that names no job: its steps are numbers.
const ROLES = ['surface', 'fill', 'text', 'border'];
const sameWord = (word) => (word.toLowerCase() === 'grey' ? 'gray' : word.toLowerCase());
const rampFile = join('tokens', 'primitives', 'color.json');
const ramps = new Set(
  Object.keys(existsSync(rampFile) ? JSON.parse(readFileSync(rampFile, 'utf8')).color ?? {} : {})
    .filter((key) => !key.startsWith('$'))
    .map(sameWord),
);
//
//    A state comes from one short list and goes at the end: -hover, -pressed,
//    -selected or -disabled. -subtle, the soft version of a fill or a text,
//    is kept too. Disabled replaces the intent, as in color.fill.disabled,
//    since a control that cannot be used looks the same whatever it would have
//    done. Any other state word fails with the one to use instead, read from
//    STATE_WORDS. That list holds the common ones, not every word there is.
//    Component colour tokens, such as button.background-hover, are held to
//    the state words too.
const STATES = ['hover', 'pressed', 'selected', 'disabled'];
// Each word that is not a state, and what to do instead: use names the state
// that takes its place in the name, and an entry with no use leaves the word
// out, since the name without a state is the control at rest.
const pressed = { use: 'pressed' };
const hover = { use: 'hover' };
const selected = { use: 'selected' };
const disabled = { use: 'disabled' };
const atRest = { advice: 'Leave it out: the name without a state is the control at rest.' };
const focused = { advice: 'Leave it out: a focused control keeps its colours and shows the ring, color.border.focus.' };
const STATE_WORDS = {
  active: { use: 'pressed', advice: 'Use -pressed instead, or -selected for the current tab or item.' },
  down: pressed,
  press: pressed,
  pressing: pressed,
  click: pressed,
  clicked: pressed,
  pushed: pressed,
  tapped: pressed,
  hovered: hover,
  hovering: hover,
  over: hover,
  mouseover: hover,
  checked: selected,
  current: selected,
  chosen: selected,
  picked: selected,
  toggled: selected,
  inactive: disabled,
  unavailable: disabled,
  dimmed: disabled,
  rest: atRest,
  resting: atRest,
  idle: atRest,
  normal: atRest,
  enabled: atRest,
  focus: focused,
  focused,
};
// The last part of a name, with one word swapped for another, or left out.
const withWords = (path, words) => {
  const parts = path.split('.');
  parts.pop();
  return words.length > 0 ? [...parts, words.join('-')].join('.') : undefined;
};
// focus on its own is a job, the ring's colour, as in color.border.focus.
const stateWordProblems = ({ path, file }) => {
  const words = path.split('.').at(-1).split('-');
  return words
    .filter((word) => Object.hasOwn(STATE_WORDS, word) && !(word === 'focus' && words.length === 1))
    .map((word) => {
      const { use, advice = `Use -${use} instead.` } = STATE_WORDS[word];
      const name = withWords(path, words.flatMap((each) => (each !== word ? [each] : use ? [use] : [])));
      return `${file}: ${path} uses the state word "${word}". The states are -${STATES.join(', -')}, with -subtle kept for soft fills and text. ${advice}${name ? ` Call it ${name}.` : ''}`;
    });
};
// Disabled replaces the intent, and every other state comes last.
const stateOrderProblems = ({ path, file }) => {
  const [, role, intent = ''] = path.split('.');
  const words = intent.split('-');
  const problems = [];
  if (words.length > 1 && words.includes('disabled')) {
    problems.push(`${file}: ${path} adds -disabled to an intent. Disabled replaces the intent, since a control that cannot be used looks the same whatever it would have done. Call it color.${role}.disabled.`);
  }
  for (const state of ['hover', 'pressed', 'selected']) {
    if (words.slice(0, -1).includes(state)) {
      problems.push(`${file}: ${path} puts -${state} before the end. A state comes last: call it ${withWords(path, [...words.filter((word) => word !== state), state])}.`);
    }
  }
  return problems;
};
check('Semantic colours are named color.<role>.<intent> after a job, not a colour, with a state from -hover, -pressed, -selected and -disabled', [
  ...components.filter(isColour).flatMap(stateWordProblems),
  ...semantics
    .filter(isColour)
    .filter(({ path }) => !rampSteps.has(path))
    .flatMap(({ path, file }) => {
      const [first, role, intent, ...extra] = path.split('.');
      const problems = [...stateWordProblems({ path, file }), ...stateOrderProblems({ path, file })];
      if (first === 'color' && role === 'brand') {
        problems.push(`${file}: ${path} is under color.brand, which holds only the steps of the brand ramp, numbered like the primitive ramps, as in color.brand.600. Name a job color.<role>.<intent> instead, as in color.fill.brand.`);
      } else if (first !== 'color' || !intent || extra.length > 0 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(intent)) {
        problems.push(`${file}: ${path} should be named color.<role>.<intent>, with an optional -state at the end, as in color.fill.brand-hover.`);
      } else if (!ROLES.includes(role)) {
        problems.push(`${file}: ${path} has the role "${role}". The role is surface, fill, text or border.`);
      }
      const colourWords = new Set(path.split(/[.-]/).filter((word) => ramps.has(sameWord(word))));
      for (const word of colourWords) {
        problems.push(`${file}: ${path} names the colour ${word}. Name the job it does instead, as in color.fill.brand.`);
      }
      return problems;
    }),
], { all: true });

// 8. No script, workflow, root config file or file in demo/ names a brand. The
//    brand names are the file names in tokens/brands/, read the way the build
//    reads them and leaving out any that starts with an underscore, so none is
//    written here. Root config files are dotfiles such as .nvmrc and files such
//    as package.json or vite.config.js. package-lock.json is left out: npm
//    writes it, and it lists packages, not brands. The demo builds its panels
//    from dist/brands.json, so it has no reason to name one either.
const brandNames = existsSync(BRANDS)
  ? readdirSync(BRANDS)
      .filter((file) => file.endsWith('.json') && !file.startsWith('_'))
      .map((file) => file.replace(/\.json$/, ''))
  : [];
const filesIn = (dir) =>
  existsSync(dir)
    ? readdirSync(dir, { recursive: true })
        .map((file) => join(dir, file))
        .filter((file) => basename(file) !== '.DS_Store' && statSync(file).isFile())
    : [];
const CONFIG_ENDINGS = ['.json', '.js', '.mjs', '.cjs', '.ts', '.yml', '.yaml', '.toml'];
const rootConfig = readdirSync('.')
  .filter((file) => file !== 'package-lock.json' && file !== '.DS_Store')
  .filter((file) => file.startsWith('.') || CONFIG_ENDINGS.some((ending) => file.endsWith(ending)))
  .filter((file) => statSync(file).isFile());
const escapeForRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// A whole word: no letter, digit or underscore right before or after it.
const brandWord = new RegExp(`(?<!\\w)(?:${brandNames.map(escapeForRegExp).join('|')})(?!\\w)`, 'gi');
const inDemo = (file) => file.split(/[\\/]/)[0] === 'demo';
check('No script, workflow, root config file or demo file names a brand', brandNames.length === 0 ? [] :
  [...filesIn('scripts'), ...filesIn('.github'), ...rootConfig, ...filesIn('demo')].flatMap((file) =>
    readFileSync(file, 'utf8')
      .split('\n')
      .flatMap((line, i) => [...line.matchAll(brandWord)].map(([name]) => inDemo(file)
        ? `${file}:${i + 1} names the brand ${name}. Build the demo's panels from dist/brands.json, which npm run build writes from tokens/brands/, instead.`
        : `${file}:${i + 1} names the brand ${name}. Brands are the files in tokens/brands/, so read them from there instead.`)),
  ));

// 9. A mode file re-points colour semantics that exist, and nothing else. It
//    holds no colour value, sets no primitive, so color.gray.900 is the same
//    colour in every mode, and never touches the brand ramp: the brands set
//    its steps, and a mode re-points the semantics that read them.
const colourSemantics = semantics.filter(isColour).filter(({ path }) => !rampSteps.has(path));
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
  } else if (rampSteps.has(path)) {
    problems.push(`${file}: ${path} is a step of the brand ramp, which only the brands set. Re-point the semantic that reads it instead, such as color.text.link.`);
  } else if (!colourSemanticNames.has(path)) {
    problems.push(`${file}: ${path} is not a colour semantic. A mode re-points colour semantics only.`);
  }
  return problems;
}));

// 10. Every colour semantic has an answer in tokens/modes/dark.json, even where
//     dark is the same as light, so a colour semantic added later cannot be
//     forgotten there. The steps of the brand ramp are not jobs, and get none.
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

// Every CSS file in the repository, and the CSS inside each HTML file: its
// <style> blocks and style attributes. Checks 12, 18, 20, 22, 23 and 26 read
// it. node_modules is left out wherever it sits, and so are .git and the build
// folders, dist/ and .vite-build/, since they are written from what is checked
// here. In HTML everything but the CSS is blanked, and a style attribute's
// quotes become braces, so the text keeps its length, every line number stays
// right, and an attribute reads as one rule body. Comments are blanked too.
const SKIPPED = new Set(['node_modules', '.git', 'dist', '.vite-build']);
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const path = dir === '.' ? entry.name : join(dir, entry.name);
  if (entry.isDirectory()) return SKIPPED.has(entry.name) ? [] : walk(path);
  return entry.isFile() ? [path] : [];
});
const STYLE_BLOCK = /(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)/gi;
const STYLE_ATTRIBUTE = /(\sstyle\s*=\s*)("[^"]*"|'[^']*')/gi;
const cssOfHtml = (html) => {
  const text = html.replace(/<!--[\s\S]*?-->/g, blank);
  const kept = text.replace(/[^\n]/g, ' ').split('');
  const keep = (from, part) => part.split('').forEach((char, i) => { kept[from + i] = char; });
  for (const { 1: open, 2: css, index } of text.matchAll(STYLE_BLOCK)) keep(index + open.length, css);
  for (const { 1: name, 2: quoted, index } of text.matchAll(STYLE_ATTRIBUTE)) {
    keep(index + name.length, `{${quoted.slice(1, -1)}}`);
  }
  return kept.join('');
};
const cssSources = walk('.')
  .filter((file) => /\.(?:css|html?)$/i.test(file))
  .map((file) => {
    const raw = readFileSync(file, 'utf8');
    const css = /\.css$/i.test(file) ? raw : cssOfHtml(raw);
    return { file, text: css.replace(/\/\*[\s\S]*?\*\//g, blank) };
  });
const lineAt = (text, index) => text.slice(0, index).split('\n').length;

// Every var() in a piece of CSS, as { name, fallback, index }. The fallback is
// what comes after the first comma, up to the var()'s own closing bracket, or
// undefined when there is no comma. A var() inside a fallback is found too,
// on its own.
const varsIn = (text) => [...text.matchAll(/\bvar\(\s*(--[\w-]+)/gi)].map(({ 0: open, 1: name, index }) => {
  let depth = 1;
  let at = index + open.length;
  while (at < text.length && depth > 0) {
    if (text[at] === '(') depth += 1;
    if (text[at] === ')') depth -= 1;
    at += 1;
  }
  const rest = text.slice(index + open.length, depth === 0 ? at - 1 : at).trim();
  return { name, index, fallback: rest.startsWith(',') ? rest.slice(1).trim().replace(/\s+/g, ' ') : undefined };
});
// The custom properties a piece of CSS declares itself: --name: in a rule
// body or a style attribute, and @property --name.
const declaredIn = (text) => new Set([
  ...[...text.matchAll(/(?:^|[{;\s])(--[\w-]+)\s*:/g)].map(([, name]) => name),
  ...[...text.matchAll(/@property\s+(--[\w-]+)/gi)].map(([, name]) => name),
]);

// 12. The CSS reads only variables dist/tokens.css writes, or that the same
//     file declares, so a misspelt name fails here instead of quietly falling
//     back to an inherited or default value. It reads every CSS file and the
//     CSS in every HTML file, the same CSS as check 18. A var() with a
//     fallback, as in var(--color-text-default, black), counts too: the
//     fallback hides the missing token, since the page shows the fallback and
//     nothing looks wrong. The suggestion is the closest name the build writes
//     or the file declares, leaving out primitives and the steps of the brand
//     ramp, which a page never reads.
const written = new Set(blocks.flatMap(({ declarations }) => declarations.map(({ name }) => name)));
const readable = [...written].filter((name) => !primitiveCss.has(name) && !rampCss.has(name));
const shorten = (text) => (text.length > 60 ? `${text.slice(0, 57)}...` : text);
check('The CSS reads only variables the build writes or its own file declares, with or without a fallback', cssSources.flatMap(({ file, text }) => {
  const declared = declaredIn(text);
  return varsIn(text)
    .filter(({ name }) => !written.has(name) && !declared.has(name))
    .map(({ name, fallback, index }) => {
      const where = `${file}:${lineAt(text, index)}`;
      const suggestion = closest(name, [...readable, ...declared]);
      if (fallback === undefined) {
        return `${where} reads ${name}, which dist/tokens.css does not write and ${file} does not declare, so what it sets falls back to an inherited or default value. Did you mean ${suggestion}?`;
      }
      return `${where} reads ${name} with the fallback ${shorten(fallback) || '(nothing)'}, but dist/tokens.css does not write ${name} and ${file} does not declare it. The fallback hides the missing token: the page shows the fallback and nothing looks wrong. Did you mean ${suggestion}?`;
    });
}).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })), { all: true });

// 13 and 14 read tokens/contrast-pairs.json: each text and focus colour, the
// surfaces and fills the demo puts it on, and the ratio it must reach there.
// Both colours of a pair are worked out from dist/tokens.css by
// scripts/lib/resolve.js, as the browser would, for every brand and for no
// brand, in light and in dark. Both checks print every problem they find. A
// brand file that sets nothing is left out: the build gives it no block, so it
// would only measure no brand again under its name. Check 4 says what it is
// missing, and check 14's title names it.
const PAIRS = join('tokens', 'contrast-pairs.json');
const colourOf = resolver(readFileSync('dist/tokens.css', 'utf8'));
const setsNothing = new Set(brandFiles
  .filter((file) => !brands.some((token) => token.file === file))
  .map((file) => basename(file, '.json')));
const leftOut = [...setsNothing].sort();
const contexts = [null, ...brandNames.filter((brand) => !setsNothing.has(brand)).sort()].flatMap((brand) =>
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
//     one of them, such as button.label. Disabled text, color.text.disabled,
//     needs none: WCAG sets no contrast minimum for a control that cannot be
//     used, its text and edges included, so it has no ratio to reach.
const TEXT_OR_FOCUS = /^color\.(?:text\.|border\.focus(?:-|$))/;
const DISABLED = /\.(?:[\w-]+-)?disabled$/;
const textOrFocusSemantics = new Set(colourSemantics
  .map(({ path }) => path)
  .filter((path) => TEXT_OR_FOCUS.test(path) && !DISABLED.test(path)));
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
    (leftOut.length > 0 ? `, leaving out the brands that set nothing: ${leftOut.join(', ')}` : '') +
    (shortfalls.length > 0 ? ` (${shortfalls.length} of ${measured.length} fall short)` : ''),
  shortfalls.map(({ foreground, background, ratio, context, front, back, reached }) =>
    `${contextName(context)}: ${foreground} on ${background} is ${twoPlaces(reached)}:1, needs ${ratio}:1 (${front} on ${back})`),
  { all: true },
);

// 15, 16 and 17 are about language and direction. lang and dir always go
// together, and the direction comes from the language: Intl.Locale knows which
// way each language reads, so nothing types it. The demo's words live in
// demo/copy.json, one set per language, and English is the full set.
const directionOf = (language) => new Intl.Locale(language).getTextInfo().direction;

// 15. Every element in the demo's HTML that has lang or dir has both, and its
//     dir is the one Intl.Locale gives for its lang. Comments are blanked, as
//     in check 3, so a tag in a comment does not count.
const TAG = /<([a-z][\w-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*\/?>/gi;
const ATTRIBUTE = /([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
const languageProblem = ({ where, lang, dir }) => {
  if (lang === undefined) {
    return `${where} has dir="${dir}" and no lang. lang and dir go together, and the direction comes from the language: add the lang its words are in.`;
  }
  let expected;
  try {
    expected = directionOf(lang);
  } catch (error) {
    return `${where} has lang="${lang}", which Intl.Locale does not read as a language code (${error.message}). Use a code such as en or ar.`;
  }
  if (dir === undefined) return `${where} has lang="${lang}" and no dir. lang and dir go together: add dir="${expected}", the way ${lang} reads.`;
  if (dir !== expected) return `${where} has lang="${lang}" with dir="${dir}", but ${lang} reads ${expected}. Set dir="${expected}": the direction comes from the language.`;
  return undefined;
};
check('Every element in the demo\'s HTML with lang or dir has both, and its dir is the way its lang reads', demoFiles
  .filter(({ file }) => file.endsWith('.html'))
  .flatMap(({ file, text }) => [...text.matchAll(TAG)].flatMap(({ 1: name, 2: attributeText, index }) => {
    const attributes = new Map([...attributeText.matchAll(ATTRIBUTE)]
      .map(([, key, double, single, bare]) => [key.toLowerCase(), double ?? single ?? bare ?? '']));
    const lang = attributes.get('lang');
    const dir = attributes.get('dir');
    if (lang === undefined && dir === undefined) return [];
    const problem = languageProblem({ where: `${file}:${lineAt(text, index)} <${name.toLowerCase()}>`, lang, dir });
    return problem ? [problem] : [];
  })));

// 16. The demo's script never types a direction: no "ltr" or "rtl" as a string,
//     and a script that sets dir asks Intl.Locale for it. Comments are blanked
//     and strings kept, so a comment may say rtl but code may not.
const CODE_PARTS = /('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`)|\/\/[^\n]*|\/\*[\s\S]*?\*\//g;
const demoScripts = existsSync('demo')
  ? readdirSync('demo')
      .filter((file) => /\.(?:js|mjs)$/.test(file))
      .map((file) => ({
        file: join('demo', file),
        text: readFileSync(join('demo', file), 'utf8').replace(CODE_PARTS, (part, string) => string ?? blank(part)),
      }))
  : [];
check('The demo\'s script asks Intl.Locale for each direction and never types one', demoScripts.flatMap(({ file, text }) => {
  const problems = [...text.matchAll(CODE_PARTS)]
    .filter(([, string]) => string !== undefined)
    .flatMap(({ 1: string, index }) => [...string.matchAll(/\b(?:ltr|rtl)\b/gi)]
      .map(([direction]) => `${file}:${lineAt(text, index)} types the direction "${direction}". Ask Intl.Locale for it from the language instead, as in new Intl.Locale(lang).getTextInfo().direction.`));
  // With the strings blanked too, so a message that mentions Intl.Locale is
  // not taken for a call to it.
  const code = text.replace(CODE_PARTS, (part, string) => (string === undefined ? part : string[0] + blank(string.slice(1, -1)) + string.at(-1)));
  const setsDir = /\.dir\s*=(?!=)|setAttribute\(\s*(['"`])dir\1/.test(text);
  if (setsDir && !/\bnew\s+Intl\.Locale\s*\(/.test(code)) {
    problems.push(`${file} sets dir without asking Intl.Locale. Work the direction out from the language, as in new Intl.Locale(lang).getTextInfo().direction.`);
  }
  return problems;
}));

// 17. Every language in demo/copy.json has every string English has: each
//     name, with a string that is not empty, and for a list, every item. Keys
//     that start with $ are notes, not languages or strings.
const COPY = join('demo', 'copy.json');
const SOURCE = 'en';
const copyProblems = [];
let copyFile;
if (!existsSync(COPY)) {
  copyProblems.push(`${COPY} is missing. It holds the card's words, in English and each other language the demo shows.`);
} else {
  try {
    copyFile = JSON.parse(readFileSync(COPY, 'utf8'));
  } catch (error) {
    copyProblems.push(`${COPY} is not valid JSON: ${error.message}`);
  }
}
const isWords = (value) => typeof value === 'string' && value.trim() !== '';
const english = copyFile?.[SOURCE];
if (copyFile && (typeof english !== 'object' || english === null)) {
  copyProblems.push(`${COPY} has no "${SOURCE}". English is the full set of strings every other language is measured against.`);
} else if (copyFile) {
  for (const [language, strings] of Object.entries(copyFile)) {
    if (language.startsWith('$') || language === SOURCE) continue;
    for (const [name, source] of Object.entries(english)) {
      if (name.startsWith('$')) continue;
      const translated = strings?.[name];
      if (!Array.isArray(source)) {
        if (!isWords(translated)) copyProblems.push(`${COPY}: ${language} has no ${name}. English has "${source}".`);
      } else if (!Array.isArray(translated)) {
        copyProblems.push(`${COPY}: ${language} has no ${name}. English has a list of ${source.length}: "${source.join('" / "')}".`);
      } else {
        source.forEach((item, i) => {
          if (!isWords(translated[i])) copyProblems.push(`${COPY}: ${language} is missing item ${i + 1} of ${name}. English has "${item}".`);
        });
      }
    }
  }
}
check(`Every language in ${COPY} has every string English has`, copyProblems, { all: true });

// 18 and 19 keep left and right out. Flex, grid and logical properties such
// as padding-inline-start follow dir, so one stylesheet works in both
// directions, as long as nothing names a side or asks which way the page reads.
// They read cssSources, every CSS file and the CSS in every HTML file, read
// before check 12, which reads it too.

// Every declaration, as { file, line, property, value, rule }, with
// !important dropped, and every selector or at-rule prelude, as
// { file, line, prelude, rule }. rule tells apart the rule bodies, so check 20
// can see what else the same rule sets, and check 18 which declarations sit
// under a selector: it is the file and where the rule's { is.
const declarations = [];
const preludes = [];
for (const { file, text } of cssSources) {
  for (const { 1: prelude, index } of text.matchAll(/([^{};]*)\{/g)) {
    if (prelude.trim() !== '') {
      preludes.push({ file, line: lineAt(text, index + prelude.search(/\S/)), prelude: prelude.trim(), rule: `${file}@${index + prelude.length}` });
    }
  }
  for (const { 1: body, index } of text.matchAll(/\{([^{}]*)\}/g)) {
    let at = index + 1;
    for (const part of body.split(';')) {
      const match = part.match(/^(\s*)([-\w]+)\s*:([\s\S]*)$/);
      if (match) {
        declarations.push({
          file,
          line: lineAt(text, at + match[1].length),
          property: match[2].toLowerCase(),
          value: match[3].replace(/!\s*important/i, '').trim().replace(/\s+/g, ' '),
          rule: `${file}@${index}`,
        });
      }
      at += part.length + 1;
    }
  }
}

// A property that names a side, and the logical one that follows dir. In a
// left-to-right line the start is the left; in a right-to-left one, the right.
const SIDE_PROPERTY = /^(margin|padding|scroll-margin|scroll-padding|border)-(left|right)(-width|-style|-color)?$/;
const CORNER = /^border-(top|bottom)-(left|right)-radius$/;
const logicalFor = (property) => {
  const side = property.match(SIDE_PROPERTY);
  if (side) return `${side[1]}-inline-${side[2] === 'left' ? 'start' : 'end'}${side[3] ?? ''}`;
  const corner = property.match(CORNER);
  if (corner) return `border-${corner[1] === 'top' ? 'start' : 'end'}-${corner[2] === 'left' ? 'start' : 'end'}-radius`;
  if (property === 'left') return 'inset-inline-start';
  if (property === 'right') return 'inset-inline-end';
  return undefined;
};
// Properties whose value can be a side, and the logical value to use instead.
const SIDE_VALUE = {
  'text-align': { left: 'start', right: 'end' },
  'text-align-last': { left: 'start', right: 'end' },
  float: { left: 'inline-start', right: 'inline-end' },
  clear: { left: 'inline-start', right: 'inline-end' },
};
// The shorthands that take four values, top, right, bottom and left.
const FOUR_SIDES = new Set(['margin', 'padding', 'inset']);
// A value's parts, split on spaces outside brackets, so calc(1px + 2px) is one.
const partsOf = (value) => {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const char of value) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (/\s/.test(char) && depth === 0) {
      if (current) parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current) parts.push(current);
  return parts;
};
// A negative number inside scale(), scaleX(), scaleY(), scaleZ() or scale3d(),
// or in the scale property, mirrors what it is on. calc(1 - 2) does not count:
// a minus with a space after it is a subtraction.
const NEGATIVE = /(?:^|[\s(,*/])-(?:\d|\.\d)/;
const SCALE_FUNCTION = /\bscale(?:x|y|z|3d)?\(([^()]*(?:\([^()]*\)[^()]*)*)\)/gi;
const flips = ({ property, value }) =>
  (property === 'scale' && NEGATIVE.test(value)) ||
  [...value.matchAll(SCALE_FUNCTION)].some(([, args]) => NEGATIVE.test(args));

const sideProblems = (declaration) => {
  const { file, line, property, value } = declaration;
  const where = `${file}:${line}`;
  const problems = [];
  const logical = logicalFor(property);
  if (logical) {
    problems.push(`${where} sets ${property}, which names a side. Use ${logical}, which follows dir, so it lands on the same side of the text in either direction.`);
  }
  const swap = SIDE_VALUE[property]?.[value.toLowerCase()];
  if (swap) {
    problems.push(`${where} sets ${property}: ${value}, which names a side. Use ${property}: ${swap}, which follows dir.`);
  }
  if (FOUR_SIDES.has(property)) {
    const parts = partsOf(value);
    if (parts.length === 4 && parts[1].toLowerCase() !== parts[3].toLowerCase()) {
      const [top, right, bottom, left] = parts;
      const block = top === bottom ? top : `${top} ${bottom}`;
      problems.push(`${where} sets ${property}: ${value}, which gives the right ${right} and the left ${left}. Use ${property}-block: ${block} and ${property}-inline: ${left} ${right}, so the start and the end follow dir.`);
    }
  }
  if (property === 'direction') {
    problems.push(`${where} sets direction. The direction comes from the language: set lang and dir together in the HTML, and leave direction out of the CSS.`);
  }
  if (flips(declaration)) {
    problems.push(`${where} flips something with a negative scale (${property}: ${value}). A mirrored shape is right for one direction only: draw it the way it should read, and place it with logical properties. ${ICON_HINT}`);
  }
  return problems;
};
// The one exception: the icon rule. An icon that points somewhere is drawn for
// a left-to-right language and named for where it leads, ending in -forward or
// -back, and one rule turns every such icon around where the text reads right
// to left, matched by its name:
//
//   [data-icon$="-forward"]:dir(rtl),
//   [data-icon$="-back"]:dir(rtl) {
//     scale: -1 1;
//   }
//
// Its selectors are exactly those two, in either order, and it sets nothing
// but the turn, scale: -1 1 or transform: scaleX(-1). The first such rule in
// the CSS is the icon rule; any other rule that asks for the direction or
// flips something fails, a second copy of the icon rule included.
const ICON_SELECTOR = /^\[data-icon\$=(["'])-(forward|back)\1\]:dir\(rtl\)$/i;
const ICON_RULE = '[data-icon$="-forward"]:dir(rtl), [data-icon$="-back"]:dir(rtl) { scale: -1 1; }';
const isIconSelector = (prelude) => {
  const ways = prelude.split(',').map((selector) => selector.replace(/\s+/g, '').match(ICON_SELECTOR)?.[2]?.toLowerCase());
  return ways.length === 2 && ways.includes('forward') && ways.includes('back');
};
const isTurn = ({ property, value }) => {
  const turn = value.toLowerCase().replace(/\s+/g, ' ');
  return (property === 'scale' && turn === '-1 1') || (property === 'transform' && /^scalex\( ?-1 ?\)$/.test(turn));
};
const iconRule = preludes.find(({ prelude, rule }) => {
  const body = declarations.filter((declaration) => declaration.rule === rule);
  return isIconSelector(prelude) && body.length === 1 && isTurn(body[0]);
});
const iconRuleAt = iconRule && `${iconRule.file}:${iconRule.line}`;
const inIconRule = ({ rule }) => rule === iconRule?.rule;
const ICON_HINT = iconRule
  ? `An icon that points somewhere turns around in the icon rule at ${iconRuleAt}: name it for where it leads, ending in -forward or -back.`
  : `An icon that points somewhere turns around in one icon rule, matched by its name: ${ICON_RULE}`;

const directionSelector = (selector) => {
  if (inIconRule(selector)) return [];
  const { file, line, prelude } = selector;
  if (isIconSelector(prelude)) {
    return [iconRule
      ? `${file}:${line} is a second icon rule. The one at ${iconRuleAt} already turns every icon named -forward or -back around: delete this one.`
      : `${file}:${line} matches the icons by name but sets more than the turn. The icon rule is ${ICON_RULE}, and nothing else goes in it.`];
  }
  const problems = [];
  if (/\[\s*dir\b/i.test(prelude)) {
    problems.push(`${file}:${line} checks the direction with [dir] in "${prelude}". Use logical properties, such as margin-inline-start, so one rule works in both directions. ${ICON_HINT}`);
  }
  if (/:dir\(/i.test(prelude)) {
    problems.push(`${file}:${line} checks the direction with :dir() in "${prelude}". Use logical properties, such as margin-inline-start, so one rule works in both directions. ${ICON_HINT}`);
  }
  return problems;
};

// 18. No CSS names a side, sets the direction, asks for it with [dir] or
//     :dir(), or mirrors something with a negative scale, but the icon rule.
check('No CSS names a side, sets or checks the direction, or flips with a negative scale, but the one icon rule', [
  ...preludes.flatMap(directionSelector),
  ...declarations.filter((declaration) => !inIconRule(declaration)).flatMap(sideProblems),
].sort((a, b) => a.localeCompare(b, 'en', { numeric: true })), { all: true });

// 19. No token's $description uses left or right for a side. "Left out" is
//     not a side, so the word counts only in a phrase about where something
//     sits: left and right, on the right, the left edge, right-to-left.
const SIDE_WORDS = String.raw`(?:left|right)`;
const SIDE_PHRASE = new RegExp([
  String.raw`\b${SIDE_WORDS}\s*(?:and|or|to|\/|-to-)\s*${SIDE_WORDS}\b`,
  String.raw`\b(?:on|to|at|from|toward|towards)\s+(?:the|its|their)\s+${SIDE_WORDS}\b`,
  String.raw`\b${SIDE_WORDS}(?:most|ward|-hand|-aligned|\s+aligned)\b`,
  String.raw`\b${SIDE_WORDS}[\s-]+(?:side|sides|edge|edges|padding|margin|margins|border|borders|corner|corners|inset|gutter|gutters|column|columns|half)\b`,
].join('|'), 'i');
const descriptions = [];
for (const file of jsonFiles('tokens')) {
  const text = readFileSync(file, 'utf8');
  if (text.trim() === '') continue;
  const visit = (node, path) => {
    if (!node || typeof node !== 'object') return;
    if (typeof node.$description === 'string') descriptions.push({ file, text, path: path.join('.'), description: node.$description });
    for (const [key, child] of Object.entries(node)) if (!key.startsWith('$')) visit(child, [...path, key]);
  };
  try {
    visit(JSON.parse(text), []);
  } catch {
    // Not valid JSON; the build and the checks above report it.
  }
}
check('No token\'s $description uses left or right for a side', descriptions.flatMap(({ file, text, path, description }) => {
  const phrase = description.match(SIDE_PHRASE)?.[0];
  if (!phrase) return [];
  const at = text.indexOf(JSON.stringify(description).slice(1, -1));
  const where = at === -1 ? file : `${file}:${lineAt(text, at)}`;
  return [`${where} ${path || 'the file'}'s $description says "${phrase}". Say start and end, the sides a line of text begins and ends on, since in Arabic the start is on the right.`];
}), { all: true });

// 20. Every line height in the CSS reads a token, so a locale or a brand can
//     re-point it. The one raw value is 1, for a single line set tight, such as
//     a tag or a price. It reads the same CSS as check 18. A line-height token
//     is a semantic or component token whose name ends in line-height, such as
//     type.body.line-height; a primitive does not count, as everywhere else on
//     a page. The font shorthand sets a line height too: after a slash, as in
//     font: 16px/1.5 sans-serif, and without one it sets it back to normal,
//     unless a line-height later in the same rule sets it again. inherit and
//     unset set nothing of their own, so they pass.
const lineHeightTokens = [...layeredNames].filter((path) => path.split('.').at(-1) === 'line-height').map(cssName);
const lineHeightList = lineHeightTokens.length > 0 ? lineHeightTokens.map((name) => `var(${name})`).join(', ') : 'none yet: add one under type in tokens/semantics/';
const TIGHT = /^1(?:\.0+)?$/;
const KEEPS = new Set(['inherit', 'unset']);
// What the font shorthand puts after its first slash outside brackets, up to
// the next space, or undefined when it has no slash.
const lineHeightInFont = (value) => {
  let depth = 0;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '(') depth += 1;
    if (value[i] === ')') depth -= 1;
    if (value[i] === '/' && depth === 0) return partsOf(value.slice(i + 1))[0] ?? '';
  }
  return undefined;
};
const lineHeightProblem = (where, setting, value) => {
  const lowered = value.toLowerCase();
  if (TIGHT.test(lowered) || KEEPS.has(lowered)) return [];
  const [, read, fallback] = value.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*(.*?))?\s*\)$/) ?? [];
  if (read && fallback !== undefined) {
    return [`${where} ${setting} with ${read} and a fallback of ${fallback}. Drop the fallback, so the line height always comes from the token.`];
  }
  if (read && lineHeightTokens.includes(read)) return [];
  if (read && primitiveCss.has(read)) {
    return [`${where} ${setting} with ${read}, a primitive. Read the semantic for that job: ${lineHeightList}.`];
  }
  if (read) {
    return [`${where} ${setting} with ${read}, which is not a line-height semantic. Read one that is: ${lineHeightList}.`];
  }
  return [`${where} ${setting} to ${value} without reading a token. Read ${lineHeightList}, or use 1 for a single line set tight, such as a tag or a price.`];
};
check('Every line height in the CSS reads a token, or is 1', declarations.flatMap((declaration, at) => {
  const { file, line, property, value, rule } = declaration;
  const where = `${file}:${line}`;
  if (property === 'line-height') return lineHeightProblem(where, 'sets line-height', value);
  if (property !== 'font' || KEEPS.has(value.toLowerCase())) return [];
  const inFont = lineHeightInFont(value);
  if (inFont !== undefined) return lineHeightProblem(where, `sets the line height in font: ${value}`, inFont);
  const setAgain = declarations.slice(at + 1).some((later) => later.rule === rule && later.property === 'line-height');
  return setAgain ? [] : [`${where} sets font: ${value}, which sets the line height back to normal. Add a line-height after it that reads ${lineHeightList}, or set font-size and font-family on their own.`];
}).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })), { all: true });

// 21. A file in tokens/locales/ is named for a language, and sets only type
//     tokens that exist. The name is the code :lang() is built with, so it
//     must be one Intl.DisplayNames can name, such as ar or ar-EG. A locale
//     changes how a language is set, its family, weights, sizes and line
//     heights, and nothing else: colours and shapes belong to brands and modes.
const languageNames = new Intl.DisplayNames(['en'], { type: 'language', fallback: 'none' });
const languageName = (code) => {
  try {
    return languageNames.of(code);
  } catch {
    return undefined;
  }
};
const typeNames = [...semanticNames].filter((path) => path.startsWith('type.'));
check(`Each file in ${LOCALES} is named for a language and sets only type tokens that exist`, localeFiles.flatMap((file) => {
  const code = basename(file, '.json');
  const problems = [];
  if (!languageName(code)) {
    problems.push(`${file} is named "${code}", which Intl.DisplayNames does not know as a language. Name it by a language code, such as ar.json for Arabic or ar-EG.json for Arabic in Egypt: the name is the code in :lang().`);
  }
  for (const { path } of locales.filter((token) => token.file === file)) {
    if (!path.startsWith('type.')) {
      problems.push(`${file}: ${path} is not a type token. A locale re-points type tokens and nothing else: ${typeNames.join(', ')}.`);
    } else if (!semanticNames.has(path)) {
      problems.push(`${file}: ${path} is not a type token that exists. Did you mean ${closest(path, typeNames)}?`);
    }
  }
  return problems;
}), { all: true });

// 22. No CSS sets italics or capitals. Arabic has no capitals, and the Arabic
//     family has no italic, so a browser would slant its letters on its own.
//     Emphasis uses weight, the same in every language. It reads the same CSS
//     as check 18: font-style and the font shorthand with italic or oblique,
//     text-transform with uppercase or capitalize, small caps and the other
//     capital forms in font-variant, font-variant-caps or the font shorthand,
//     and the small-cap features in font-feature-settings.
const ITALIC = /\b(?:italic|oblique)\b/i;
const CAPITAL_TRANSFORM = /\b(?:uppercase|capitalize)\b/i;
const CAPITAL_VARIANT = /\b(?:small-caps|all-small-caps|petite-caps|all-petite-caps|unicase|titling-caps)\b/i;
const CAPITAL_FEATURE = /(["'])(?:smcp|c2sc|pcap|c2pc|unic|titl)\1/i;
const WEIGHT_INSTEAD = 'Show emphasis with weight instead, such as font-weight: var(--type-title-weight).';
check('No CSS sets italics or capitals, so emphasis uses weight', declarations.flatMap(({ file, line, property, value }) => {
  const where = `${file}:${line}`;
  const problems = [];
  if ((property === 'font-style' || property === 'font') && ITALIC.test(value)) {
    problems.push(`${where} sets ${property}: ${value}, a slanted style. The Arabic family has no italic, so a browser would slant its letters on its own. ${WEIGHT_INSTEAD}`);
  }
  if (property === 'text-transform' && CAPITAL_TRANSFORM.test(value)) {
    problems.push(`${where} sets text-transform: ${value}. Arabic has no capitals, so it would do nothing there. Write the words the way they should read, and ${WEIGHT_INSTEAD.charAt(0).toLowerCase()}${WEIGHT_INSTEAD.slice(1)}`);
  }
  if (['font-variant', 'font-variant-caps', 'font'].includes(property) && CAPITAL_VARIANT.test(value)) {
    problems.push(`${where} sets ${property}: ${value}, which asks for capitals. Arabic has none. ${WEIGHT_INSTEAD}`);
  }
  if (property === 'font-feature-settings' && CAPITAL_FEATURE.test(value)) {
    problems.push(`${where} sets font-feature-settings: ${value}, which turns on small capitals. Arabic has none. ${WEIGHT_INSTEAD}`);
  }
  return problems;
}).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })), { all: true });

// 23. No icon is named for a side. An icon that points somewhere is named for
//     where it leads, and its name ends in -forward or -back, so the icon rule
//     in check 18 turns it around in a right-to-left language by its name
//     alone. Left is back in English and forward in Arabic, so a name with
//     left or right in it is wrong in one of them; and forward or back
//     anywhere but at the end, as in forward-arrow, would never turn. The
//     names are read from every data-icon in the HTML, with comments blanked,
//     from data-icon in the demo's script, from [data-icon] in the CSS, and
//     from the name of every .svg file, all in the same files check 18 reads.
//     A name is split into words at hyphens, other punctuation and capitals,
//     so arrowLeft and arrow_left count too.
const ICON_ATTRIBUTE_SELECTOR = /\[\s*data-icon\s*[~|^$*]?=\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]+))/gi;
const iconNames = [
  ...walk('.')
    .filter((file) => /\.html?$/i.test(file))
    .flatMap((file) => {
      const text = readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, blank);
      return [...text.matchAll(TAG)].flatMap(({ 2: attributeText, index }) => [...attributeText.matchAll(ATTRIBUTE)]
        .filter(([, key]) => key.toLowerCase() === 'data-icon')
        .map(([, , double, single, bare]) => ({ where: `${file}:${lineAt(text, index)}`, name: double ?? single ?? bare ?? '' })));
    }),
  ...demoScripts.flatMap(({ file, text }) => [
    ...text.matchAll(/\.dataset\.icon\s*=\s*(['"`])([^'"`]*)\1/g),
    ...text.matchAll(/setAttribute\(\s*(['"`])data-icon\1\s*,\s*(['"`])([^'"`]*)\2/g),
  ].map((match) => ({ where: `${file}:${lineAt(text, match.index)}`, name: match.at(-1) }))),
  ...preludes.flatMap(({ file, line, prelude }) => [...prelude.matchAll(ICON_ATTRIBUTE_SELECTOR)]
    .map(([, double, single, bare]) => ({ where: `${file}:${line}`, name: double ?? single ?? bare }))),
  ...walk('.')
    .filter((file) => /\.svg$/i.test(file))
    .map((file) => ({ where: file, name: basename(file).replace(/\.svg$/i, '') })),
];
const wordsOf = (name) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const WAY = { left: 'back', right: 'forward' };
const iconNameProblem = ({ where, name }) => {
  const words = wordsOf(name);
  const sides = words.filter((word) => word in WAY);
  const ways = words.filter((word) => word === 'forward' || word === 'back');
  const rest = words.filter((word) => !(word in WAY) && word !== 'forward' && word !== 'back');
  const named = (way) => `${rest.length > 0 ? rest.join('-') : 'arrow'}-${way}`;
  if (sides.length > 0) {
    const way = [...new Set(sides.map((side) => WAY[side]))];
    const suggestion = way.length === 1 ? `call it ${named(way[0])}` : 'name it for what it does, since it points both ways and never turns around';
    return [`${where} names an icon "${name}", after a side. Left is back in English and forward in Arabic, so name an icon for where it leads, not which side it points to: ${suggestion}. The icon rule turns every name ending in -forward or -back around in a right-to-left language.`];
  }
  if (ways.length > 0 && !(ways.length === 1 && new RegExp(`-${ways[0]}$`).test(name))) {
    return [`${where} names an icon "${name}". The icon rule turns an icon around only when its name ends in -forward or -back, so this one would never turn: call it ${named(ways.at(-1))}.`];
  }
  return [];
};
check('No icon is named left or right, and every name with forward or back ends in it', iconNames
  .flatMap(iconNameProblem)
  .sort((a, b) => a.localeCompare(b, 'en', { numeric: true })), { all: true });

// 24. Numbers are data, not words. No string in demo/copy.json writes a digit,
//     in any script: 0 to 9, Arabic-Indic or any other, since a digit typed in
//     the copy is in one language's digits and is never formatted for the
//     others. The price and the trial length live in demo/demo.js, which
//     formats them with Intl.NumberFormat for the panel's language, and a
//     string marks where one goes, as {days}. The template's price slot, the
//     element with data-price, must be there and empty, since demo.js puts the
//     formatted price in it. Keys that start with $ are notes. Comments in the
//     HTML are blanked, as in check 15.
const DIGIT = /\p{Nd}/u;
const stringsIn = (value, name) => (Array.isArray(value)
  ? value.flatMap((item, i) => stringsIn(item, `${name}, item ${i + 1}`))
  : typeof value === 'string' ? [{ name, text: value }] : []);
const digitProblems = copyFile
  ? Object.entries(copyFile)
      .filter(([language, strings]) => !language.startsWith('$') && typeof strings === 'object' && strings !== null)
      .flatMap(([language, strings]) => Object.entries(strings)
        .filter(([name]) => !name.startsWith('$'))
        .flatMap(([name, value]) => stringsIn(value, name))
        .filter(({ text }) => DIGIT.test(text))
        .map(({ name, text }) => `${COPY}: ${language} ${name} writes a digit: "${text}". Numbers are data in demo/demo.js, formatted for each panel's language. Put the number there and mark where it goes in the string, as {days}.`))
  : [];
const PRICE_SLOT = /<([a-z][\w-]*)(?=[\s>])[^>]*\sdata-price(?=[\s=>/])[^>]*>/gi;
const priceProblems = demoFiles
  .filter(({ file }) => file.endsWith('.html'))
  .flatMap(({ file, text }) => [...text.matchAll(PRICE_SLOT)].map(({ 0: open, 1: name, index }) => {
    const after = text.slice(index + open.length);
    if (new RegExp(`^\\s*</${name}\\s*>`, 'i').test(after)) return undefined;
    const held = after.slice(0, after.search(new RegExp(`</${name}\\s*>`, 'i'))).trim().replace(/\s+/g, ' ');
    return `${file}:${lineAt(text, index)} <${name.toLowerCase()} data-price> holds "${held.slice(0, 60)}". Leave the price slot empty: demo.js formats the price for the panel's language and puts it there.`;
  }).filter(Boolean));
const priceSlots = demoFiles
  .filter(({ file }) => file.endsWith('.html'))
  .reduce((count, { text }) => count + [...text.matchAll(PRICE_SLOT)].length, 0);
if (existsSync('demo') && priceSlots === 0) {
  priceProblems.push('The demo\'s HTML has no price slot. The card\'s price goes in an empty element with data-price, such as <span class="amount" data-price></span>, which demo.js fills.');
}
check(`No string in ${COPY} writes a digit, and the price slot in the demo's HTML is empty`, [...digitProblems, ...priceProblems], { all: true });

// 25. The demo's copy always holds a language that reads right to left, so the
//     demo always has panels in that direction to look at, and a change cannot
//     get through by dropping the Arabic set. English, the other direction, is
//     held by check 17. A language counts when Intl.Locale reads its code as
//     right to left and it has a set of strings; that the set is whole is
//     check 17's job. Keys that start with $ are notes.
const READS = { ltr: 'left to right', rtl: 'right to left' };
const copyLanguages = copyFile
  ? Object.entries(copyFile)
      .filter(([language, strings]) => !language.startsWith('$') && typeof strings === 'object' && strings !== null && !Array.isArray(strings))
      .map(([language]) => {
        try {
          return { language, direction: directionOf(language) };
        } catch {
          return { language, direction: undefined };
        }
      })
  : [];
const rightToLeftProblems = [];
if (!copyFile) {
  rightToLeftProblems.push(`${COPY} cannot be read, so it holds no language that reads right to left. Check 17 says why.`);
} else if (!copyLanguages.some(({ direction }) => direction === 'rtl')) {
  const held = copyLanguages.length === 0
    ? 'no language at all'
    : copyLanguages.map(({ language, direction }) => `${language}, which reads ${READS[direction] ?? 'no way Intl.Locale knows'}`).join('; ');
  rightToLeftProblems.push(`${COPY} holds no language that reads right to left. It holds ${held}. The demo shows one set of panels per language in ${COPY}, so without one there is nothing to look at right to left. Put the Arabic set back, or add another language that reads right to left, such as he or fa, with every string English has.`);
}
check(`${COPY} holds a language that reads right to left, so the demo always shows that direction`, rightToLeftProblems, { all: true });

// 26. A focus style keeps its outline and draws no box-shadow. The focus ring
//     is an outline, read from focus.width, focus.offset and
//     color.border.focus. Forced colours modes, such as Windows High
//     Contrast, drop every box-shadow but keep the outline, redrawn in the
//     reader's own colours, so a ring drawn with box-shadow, or a focus style
//     that takes the outline away, leaves a keyboard user there with no ring.
//     A focus style is a rule whose selector has :focus, :focus-visible or
//     :focus-within, leaving out what sits inside :not(), or
//     [data-state="focus"], the demo's stand-in for the keyboard. It reads the
//     same CSS as check 18. The outline is taken away by none or hidden, by a
//     width of 0, by transparent, and by initial or unset, which set it back
//     to none.
const FOCUS_SELECTOR = /:focus(?:-visible|-within)?(?![\w-])|\[\s*data-state\s*=\s*(["']?)focus\1\s*\]/i;
const NOT = /:not\((?:[^()]|\([^()]*\))*\)/gi;
const isFocusSelector = (prelude) => !prelude.startsWith('@') && FOCUS_SELECTOR.test(prelude.replace(NOT, ''));
const ZERO = /^[+-]?(?:0+\.?0*|\.0+)[a-z]*$/i;
const RING = 'outline: var(--focus-width) solid var(--color-border-focus) and outline-offset: var(--focus-offset)';
const removesOutline = ({ property, value }) => {
  const parts = partsOf(value.toLowerCase());
  const whole = parts.join(' ');
  if (['outline', 'outline-style'].includes(property) && (['initial', 'unset'].includes(whole) || parts.some((part) => part === 'none' || part === 'hidden'))) return true;
  if (['outline', 'outline-width'].includes(property) && parts.some((part) => ZERO.test(part))) return true;
  if (['outline', 'outline-color'].includes(property) && parts.includes('transparent')) return true;
  return false;
};
const focusRules = new Map(preludes.filter(({ prelude }) => isFocusSelector(prelude)).map((selector) => [selector.rule, selector]));
check('Every focus style keeps its outline, and none draws a ring with box-shadow', declarations
  .filter(({ rule }) => focusRules.has(rule))
  .flatMap((declaration) => {
    const { file, line, property, value } = declaration;
    const { prelude } = focusRules.get(declaration.rule);
    const where = `${file}:${line}`;
    if (property === 'box-shadow' && value.toLowerCase() !== 'none') {
      return [`${where} draws a focus ring with box-shadow: ${value}, in "${prelude}". Forced colours modes, such as Windows High Contrast, drop every box-shadow, so the ring would vanish there. Draw it with ${RING}.`];
    }
    if (removesOutline(declaration)) {
      return [`${where} takes the outline away with ${property}: ${value}, in "${prelude}". The outline is the focus ring, so a keyboard user would lose track of where they are. Keep ${RING}; :focus-visible already shows it to the keyboard and not to a click.`];
    }
    return [];
  })
  .sort((a, b) => a.localeCompare(b, 'en', { numeric: true })), { all: true });

// 27. Every value in dist/tokens.css is one CSS can read. When a token holds
//     something the build cannot turn into CSS, such as an object where it
//     expected a string or a number, it writes JavaScript's words for it,
//     undefined, null, NaN or [object Object], or nothing at all, and still
//     finishes. A browser takes a custom property with any of these, so
//     nothing fails until a page reads it: then the property that reads it is
//     dropped and falls back to an inherited or default value, with no error
//     anywhere. A reference in braces the build left as it was, such as
//     {color.blue.600}, fails too. Words inside quotes, such as a font's name,
//     do not count. Comments are blanked, so line numbers stay right. The
//     message names the token files that set the token, so the fix goes there.
const BUILT = 'dist/tokens.css';
const builtText = readFileSync(BUILT, 'utf8').replace(/\/\*[\s\S]*?\*\//g, blank);
const everyToken = [...primitives, ...semantics, ...components, ...brandFolder, ...modes, ...locales];
const UNREADABLE = [
  { pattern: /\[object [A-Za-z]+\]/, what: 'an object the build wrote as text' },
  { pattern: /(?<![\w-])(?:undefined|null|NaN|-?Infinity)(?![\w-])/, what: 'a value that was missing, or not a number, when the build wrote it' },
  { pattern: /[{}]/, what: 'a reference in braces the build did not resolve' },
];
check(`Every value in ${BUILT} is one CSS can read, never undefined, null, NaN, [object Object] or nothing`, [...builtText.matchAll(/(--[\w-]+)\s*:([^;]*);/g)]
  .flatMap(({ 1: name, 2: raw, index }) => {
    const value = raw.trim().replace(/\s+/g, ' ');
    const unquoted = value.replace(/'[^']*'|"[^"]*"/g, '""');
    const found = value === '' ? 'an empty value' : UNREADABLE.find(({ pattern }) => pattern.test(unquoted))?.what;
    if (!found) return [];
    const from = everyToken.filter(({ path }) => cssName(path) === name);
    const source = from.length > 0
      ? `It comes from ${from[0].path} in ${[...new Set(from.map(({ file }) => file))].join(', ')}: give it a value CSS can read there, such as a colour, a size or a reference to another token, then run npm run build.`
      : 'No token file sets it, so scripts/build.js wrote it: fix it there.';
    return [`${BUILT}:${lineAt(builtText, index)} writes ${name}: ${shorten(value) || '(nothing)'}, ${found}. Anything that reads var(${name}) drops that property and falls back to an inherited or default value, with no error anywhere. ${source}`];
  }), { all: true });

if (failed > 0) {
  console.log(`\n${failed} check${failed === 1 ? '' : 's'} failed.`);
  process.exit(1);
}
console.log('\nAll checks passed.');
