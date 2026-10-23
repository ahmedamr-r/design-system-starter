// Builds the demo's panels from dist/brands.json, which npm run build writes
// from the files in tokens/brands/. Nothing here names a brand, so a new brand
// file gets its panels at the next build, and npm run check fails if a brand
// name turns up anywhere in demo/.
//
// Every panel shows the card from the <template> in index.html:
//   1. no brand, in light and in dark;
//   2. each brand, in light and in dark;
//   3. a card of the next brand in the list inside a light panel of each brand,
//      and 4. the same inside a dark panel (the last brand holds the first);
//   5. a dark panel with no brand inside a light panel of each brand;
//   6. a card of each brand inside a light panel inside a dark one.
//
// Each of those panels comes once for each language in copy.json: first in the
// page's own language, the one on <html>, then right after it in each other
// language. A panel in another language sets lang and dir, and the direction
// is always asked of Intl.Locale, never typed. The panel labels and the
// comparison links stay in the page's language, so inside such a panel they
// set the page's lang and dir again.

const main = document.querySelector('.panels');
const template = document.querySelector('#card');

// The page's own language, which the panel labels are written in.
const pageLanguage = document.documentElement.lang;
const languageNames = new Intl.DisplayNames([pageLanguage], { type: 'language' });

// The direction a language reads in, from Intl.Locale. getTextInfo() is the
// current name, and textInfo the one older browsers have. undefined if the
// browser has neither.
function directionOf(language) {
  const locale = new Intl.Locale(language);
  return (locale.getTextInfo?.() ?? locale.textInfo)?.direction;
}

// lang and dir always go together, so nothing here sets one without the other.
function setLanguage(element, language) {
  element.lang = language;
  element.dir = directionOf(language);
}

// Reads a JSON file next to the page, or says in the console why it cannot.
async function readJson(path, why) {
  try {
    const response = await fetch(new URL(path, import.meta.url));
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.error(`demo.js could not read ${path.replace('../', '')} (${error.message}). ${why}`);
    return undefined;
  }
}

// The brands, as [{ id, displayName, hue }]. If the file cannot be read, the
// page shows the panels with no brand.
const brands = (await readJson('../dist/brands.json', 'Run npm run build, which writes it.')) ?? [];

// The card's words, as { <language>: { <name>: a string, or a list of them } }.
// Keys that start with $ are notes, not languages.
const copy = await readJson('copy.json', 'The cards have no words without it.');

// The page's language first, then each other language whose direction this
// browser can tell. One it cannot is left out, and the console says why.
const languages = copy === undefined ? [] : [
  pageLanguage,
  ...Object.keys(copy).filter((language) => !language.startsWith('$') && language !== pageLanguage),
].filter((language) => {
  if (directionOf(language)) return true;
  console.error(`This browser cannot tell which way ${language} reads, since its Intl.Locale has no getTextInfo(), so the panels in ${language} are left out.`);
  return false;
});
const inOtherLanguage = (language) => language !== pageLanguage;

// A panel: a section named by its heading, with data-brand and data-mode when
// given. level is the heading's level: 2 for a panel on the page, 3 for one
// inside another. A panel in another language sets its lang and dir, its
// label keeps the page's, and a panel on the page names its language in the
// label.
let headings = 0;
function panel({ label, brand, mode, language, level = 2 }, ...children) {
  const section = document.createElement('section');
  section.className = 'panel';
  if (brand) section.dataset.brand = brand.id;
  if (mode) section.dataset.mode = mode;
  const heading = document.createElement(`h${level}`);
  heading.className = 'panel-label';
  heading.id = `panel-label-${++headings}`;
  heading.textContent = label;
  if (inOtherLanguage(language)) {
    setLanguage(section, language);
    setLanguage(heading, pageLanguage);
    if (level === 2) heading.textContent += `, in ${languageNames.of(language)}`;
  }
  section.setAttribute('aria-labelledby', heading.id);
  section.append(heading, ...children);
  return section;
}

// Puts one language's words into a copy of the card: the string named by each
// data-copy, and for a list, one copy of its first item per string, with the
// string after what the item already holds (the tick).
function fill(element, words) {
  for (const target of element.querySelectorAll('[data-copy]')) {
    const name = target.dataset.copy;
    const text = words[name];
    if (text === undefined) {
      console.error(`copy.json has no ${name} in this language. npm run check says which strings are missing.`);
    } else if (Array.isArray(text)) {
      const item = target.firstElementChild;
      target.replaceChildren(...text.map((line) => {
        const itemCopy = item.cloneNode(true);
        itemCopy.append(line);
        return itemCopy;
      }));
    } else {
      target.textContent = text;
    }
  }
}

// A copy of the card in a language, with data-brand when given and never a
// data-mode, so it takes its mode from the panel around it, and its language
// too. Its plan name is one heading level under that panel's label.
function card({ brand, language, level = 3 }) {
  const cardCopy = template.content.firstElementChild.cloneNode(true);
  if (brand) cardCopy.dataset.brand = brand.id;
  fill(cardCopy, copy[language]);
  const plan = cardCopy.querySelector('.plan');
  const heading = document.createElement(`h${level}`);
  heading.className = plan.className;
  heading.textContent = plan.textContent;
  plan.replaceWith(heading);
  return cardCopy;
}

// A link in the colours of the panel it sits in, to compare with the card. Its
// words are the page's, like a label's.
function link(text, language) {
  const anchor = document.createElement('a');
  anchor.className = 'link';
  anchor.href = '#';
  anchor.textContent = text;
  if (inOtherLanguage(language)) setLanguage(anchor, pageLanguage);
  return anchor;
}

// Each case is a function of the language, so it can be built once per language.
const modes = ['light', 'dark'];
const cases = [];

// 1 and 2. No brand, then each brand, in light and in dark.
for (const mode of modes) {
  cases.push((language) => panel({ label: `No brand, ${mode}`, mode, language }, card({ language })));
}
for (const brand of brands) {
  for (const mode of modes) {
    cases.push((language) => panel({ label: `${brand.displayName}, ${mode}`, brand, mode, language }, card({ language })));
  }
}

// 3 and 4. The cascade tests: a card with the next brand's data-brand inside a
// panel of each brand must come out in the next brand's colours, next to a
// link in the panel's own. In the dark panel it must also stay dark, since the
// card sets no mode. They need two brands.
const next = (i) => brands[(i + 1) % brands.length];
if (brands.length > 1) {
  for (const mode of modes) {
    brands.forEach((outer, i) => {
      const inner = next(i);
      cases.push((language) => panel(
        { label: `${inner.displayName} inside ${mode === 'dark' ? 'dark ' : ''}${outer.displayName}`, brand: outer, mode, language },
        link(`A ${outer.displayName} link, for comparison`, language),
        card({ brand: inner, language }),
      ));
    });
  }
}

// 5. The other way round: a dark panel with no brand of its own, inside a light
// panel of each brand, must turn dark and keep that brand's colours.
for (const brand of brands) {
  cases.push((language) => panel(
    { label: `Dark inside ${brand.displayName}`, brand, mode: 'light', language },
    link(`A ${brand.displayName} link, for comparison`, language),
    panel({ label: 'Dark panel, no brand of its own', mode: 'dark', language, level: 3 }, card({ language, level: 4 })),
  ));
}

// 6. A card of each brand inside a light panel inside a dark one must come out
// light, from the panel nearest to it, and in its own brand's colours.
for (const brand of brands) {
  cases.push((language) => panel(
    { label: `${brand.displayName} inside light inside dark`, mode: 'dark', language },
    panel({ label: 'Light panel, no brand of its own', mode: 'light', language, level: 3 }, card({ brand, language, level: 4 })),
  ));
}

// Each case in every language, one after another. Without copy.json the page
// keeps its message, and the console says why.
if (languages.length > 0) {
  main.replaceChildren(...cases.flatMap((build) => languages.map((language) => build(language))));
}
