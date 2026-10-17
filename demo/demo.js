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

const main = document.querySelector('.panels');
const template = document.querySelector('#card');

// The brands, as [{ id, displayName, hue }]. If the file cannot be read, the
// page shows the panels with no brand, and the console says why.
async function readBrands() {
  try {
    const response = await fetch(new URL('../dist/brands.json', import.meta.url));
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.error(`demo.js could not read dist/brands.json (${error.message}). Run npm run build, which writes it.`);
    return [];
  }
}

// A panel: a section named by its heading, with data-brand and data-mode when
// given. level is the heading's level: 2 for a panel on the page, 3 for one
// inside another.
let headings = 0;
function panel({ label, brand, mode, level = 2 }, ...children) {
  const section = document.createElement('section');
  section.className = 'panel';
  if (brand) section.dataset.brand = brand.id;
  if (mode) section.dataset.mode = mode;
  const heading = document.createElement(`h${level}`);
  heading.className = 'panel-label';
  heading.id = `panel-label-${++headings}`;
  heading.textContent = label;
  section.setAttribute('aria-labelledby', heading.id);
  section.append(heading, ...children);
  return section;
}

// A copy of the card, with data-brand when given and never a data-mode, so it
// takes its mode from the panel around it. Its plan name is one heading level
// under that panel's label.
function card({ brand, level = 3 } = {}) {
  const copy = template.content.firstElementChild.cloneNode(true);
  if (brand) copy.dataset.brand = brand.id;
  const plan = copy.querySelector('.plan');
  const heading = document.createElement(`h${level}`);
  heading.className = plan.className;
  heading.textContent = plan.textContent;
  plan.replaceWith(heading);
  return copy;
}

// A link in the colours of the panel it sits in, to compare with the card.
function link(text) {
  const anchor = document.createElement('a');
  anchor.className = 'link';
  anchor.href = '#';
  anchor.textContent = text;
  return anchor;
}

const brands = await readBrands();
const modes = ['light', 'dark'];
const panels = [];

// 1 and 2. No brand, then each brand, in light and in dark.
for (const mode of modes) panels.push(panel({ label: `No brand, ${mode}`, mode }, card()));
for (const brand of brands) {
  for (const mode of modes) panels.push(panel({ label: `${brand.displayName}, ${mode}`, brand, mode }, card()));
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
      panels.push(panel(
        { label: `${inner.displayName} inside ${mode === 'dark' ? 'dark ' : ''}${outer.displayName}`, brand: outer, mode },
        link(`A ${outer.displayName} link, for comparison`),
        card({ brand: inner }),
      ));
    });
  }
}

// 5. The other way round: a dark panel with no brand of its own, inside a light
// panel of each brand, must turn dark and keep that brand's colours.
for (const brand of brands) {
  panels.push(panel(
    { label: `Dark inside ${brand.displayName}`, brand, mode: 'light' },
    link(`A ${brand.displayName} link, for comparison`),
    panel({ label: 'Dark panel, no brand of its own', mode: 'dark', level: 3 }, card({ level: 4 })),
  ));
}

// 6. A card of each brand inside a light panel inside a dark one must come out
// light, from the panel nearest to it, and in its own brand's colours.
for (const brand of brands) {
  panels.push(panel(
    { label: `${brand.displayName} inside light inside dark`, mode: 'dark' },
    panel({ label: 'Light panel, no brand of its own', mode: 'light', level: 3 }, card({ brand, level: 4 })),
  ));
}

main.replaceChildren(...panels);
