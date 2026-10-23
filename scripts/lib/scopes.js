// Reads tokens/switch-scopes.json, the one list of which tokens each switch
// may change, for scripts/build.js and scripts/check.js. A switch is a folder
// of files, one per option that differs from the default, such as
// tokens/densities/compact.json, picked by an attribute such as
// data-density="compact".
//
//   import { readScopes } from './lib/scopes.js';
//   const { switches, problems } = readScopes();
//   switches.find(({ name }) => name === 'density').covers('space.gap.small'); // → true
//
// Each switch comes back as { name, folder, block, declaredOn, mayChange,
// source, covers, blockFor, options }:
//   - mayChange is the list of groups and tokens it may set. When the file
//     names another file instead, as the brand switch names
//     tokens/brands/_template.json, the list is every token that file sets,
//     and source is that file; otherwise source is the list itself;
//   - covers(path) says whether the switch may change the token at path: the
//     path is in mayChange, or sits under a group that is;
//   - blockFor(file) is the selector a file of this switch is written under,
//     such as [data-density="compact"], or null for a switch with no block.
//     A block inside an at-rule is a list from the outside in, such as
//     ['@media (prefers-reduced-motion: reduce)', ':root'] for
//     tokens/preferences/reduced-motion.json, which Style Dictionary's
//     css/variables format nests one inside the other;
//   - options() lists the files in its folder, sorted, leaving out any whose
//     name starts with an underscore, which is not an option.
// problems lists what is wrong with the file itself, in plain words; the
// check prints them, and the build stops on them.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

export const SCOPES = 'tokens/switch-scopes.json';

// A block as CSS writes it, for messages: [data-density="compact"], or, for one
// inside an at-rule, @media (prefers-reduced-motion: reduce) { :root }.
export const blockName = (block) => (Array.isArray(block)
  ? block.reduceRight((inner, outer) => `${outer} { ${inner} }`)
  : String(block));

// Every token path a file sets, such as color.brand.600, leaving out $ keys.
export function tokenPathsIn(file) {
  const text = readFileSync(file, 'utf8');
  if (text.trim() === '') return [];
  const found = [];
  const walk = (node, path) => {
    if (node && typeof node === 'object' && '$value' in node) {
      found.push(path.join('.'));
      return;
    }
    for (const [key, child] of Object.entries(node ?? {})) {
      if (!key.startsWith('$')) walk(child, [...path, key]);
    }
  };
  walk(JSON.parse(text), []);
  return found;
}

export function readScopes(file = SCOPES) {
  const problems = [];
  if (!existsSync(file)) {
    return { switches: [], problems: [`${file} is missing. It lists which tokens each switch may change, and the build and the check both read it.`] };
  }
  let list;
  try {
    list = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    return { switches: [], problems: [`${file} is not valid JSON: ${error.message}`] };
  }
  const switches = [];
  for (const [name, entry] of Object.entries(list ?? {})) {
    if (name.startsWith('$')) continue;
    const { folder, block = null, declaredOn = null } = entry ?? {};
    if (typeof folder !== 'string') {
      problems.push(`${file}: ${name} has no folder, the one its files sit in, such as tokens/densities.`);
      continue;
    }
    let mayChange = entry.mayChange;
    let source = file;
    if (typeof mayChange === 'string') {
      source = mayChange;
      if (!existsSync(source)) {
        problems.push(`${file}: ${name} takes its list from ${source}, which is missing.`);
        mayChange = [];
      } else {
        try {
          mayChange = tokenPathsIn(source);
        } catch (error) {
          problems.push(`${file}: ${name} takes its list from ${source}, which is not valid JSON: ${error.message}`);
          mayChange = [];
        }
      }
    } else if (!Array.isArray(mayChange) || mayChange.some((path) => typeof path !== 'string')) {
      problems.push(`${file}: ${name}'s mayChange is a list of token groups and tokens, such as ["space.padding", "space.gap"], or the path of a file that lists them.`);
      mayChange = [];
    }
    const covers = (path) => mayChange.some((listed) => path === listed || path.startsWith(`${listed}.`));
    if (block !== null && typeof block !== 'string' && !(Array.isArray(block) && block.length > 0 && block.every((part) => typeof part === 'string'))) {
      problems.push(`${file}: ${name}'s block is the selector its files are written under, such as "[data-density=\\"{name}\\"]", a list from the outside in for one inside an at-rule, such as ["@media (prefers-{name}: reduce)", ":root"], or null.`);
      continue;
    }
    const blockFor = (option) => {
      if (block === null) return null;
      const named = (part) => part.replaceAll('{name}', basename(option, '.json'));
      return Array.isArray(block) ? block.map(named) : named(block);
    };
    const options = () => (existsSync(folder)
      ? readdirSync(folder).filter((option) => option.endsWith('.json') && !option.startsWith('_')).sort().map((option) => join(folder, option))
      : []);
    switches.push({ name, folder, block, declaredOn, mayChange, source, covers, blockFor, options });
  }
  return { switches, problems };
}
