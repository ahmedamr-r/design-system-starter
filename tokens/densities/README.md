# Densities

One file per density that differs from the default, named for it, such as `compact.json`. A density file re-points the spacing roles in `tokens/semantics/space.json`, `space.padding` and `space.gap` in small, medium and large, at other steps of the size scale, and sets nothing else: no colour, no type, no corners and no tokens of its own. The default spacing is what the roles already hold, so it has no file.

`compact.json` is the first. It moves every padding and every gap one step down the size scale in `tokens/primitives/size.json`:

| Role | Default | Compact |
| --- | --- | --- |
| `space.padding.small` | 8px (`size.200`) | 6px (`size.150`) |
| `space.padding.medium` | 16px (`size.400`) | 12px (`size.300`) |
| `space.padding.large` | 24px (`size.600`) | 16px (`size.400`) |
| `space.gap.small` | 8px (`size.200`) | 6px (`size.150`) |
| `space.gap.medium` | 12px (`size.300`) | 8px (`size.200`) |
| `space.gap.large` | 24px (`size.600`) | 16px (`size.400`) |

`data-density="compact"` on any element picks it for that element and everything inside it, and it combines with any brand, mode and language. The build writes each file as a `[data-density="<name>"]` block after the brands and the locales.

Only a density changes spacing. Brands, modes and languages never do, so the spacing tokens are declared on `:root` and `[data-density]` and on nothing else. A card that sets its own brand or language inside a compact panel inherits the compact spacing instead of putting the default back, and a card that sets `data-density` with a name that has no file, such as `data-density="default"`, gets the default spacing back inside a compact panel.

What a density may set is written down once, in `tokens/switch-scopes.json`, next to what a brand, a mode and a locale may set. `npm run build` reads it to decide where each token is declared, and `npm run check` reads it too: check 30 fails a density file that sets anything else, and check 6 fails a token declared anywhere the list does not say. Padding and gaps the demo types as raw sizes, such as the badge's 12px at the start and end, read no role, so a density does not move them until they do.
