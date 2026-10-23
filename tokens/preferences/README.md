# Preferences

One file per setting a reader can turn on in their own system that the tokens answer, named for it, such as `reduced-motion.json`. A preference file re-points tokens that already exist and sets nothing else: no tokens of its own. What a reader gets with no preference is what the tokens already hold, so that has no file.

No attribute picks a preference. The reader's setting does, through a media query, so it holds for the whole page and no page or script can turn it on or off. The build writes each file as a `:root` block inside `@media (prefers-<name>: reduce)`, after every other block, so `reduced-motion.json` becomes:

```css
@media (prefers-reduced-motion: reduce) {
  :root {
    --motion-duration-base: var(--duration-0);
    --motion-duration-slow: var(--duration-0);
  }
}
```

`reduced-motion.json` is the first. It points the two durations for movement at 0ms and leaves the one for colour and opacity alone, so fades stay and nothing travels:

| Token | Used for | No preference | Reduced motion |
| --- | --- | --- | --- |
| `motion.duration.fast` | a change of colour or opacity | 150ms (`duration.150`) | 150ms, left alone |
| `motion.duration.base` | a small movement | 250ms (`duration.250`) | 0ms (`duration.0`) |
| `motion.duration.slow` | a large movement | 400ms (`duration.400`) | 0ms (`duration.0`) |

A movement at 0ms still happens, at once: a card that lifts under the pointer is lifted straight away instead of travelling there.

This only works if every transition that moves something reads `motion.duration.base` or `motion.duration.slow`. One that reads `fast`, a primitive or a time of its own, such as `200ms`, would still travel for a reader who asked for less motion. `npm run check` fails it, in check 31.

What a preference may set is written down once, in `tokens/switch-scopes.json`, next to what a brand, a mode, a locale and a density may set: today `motion.duration.base` and `motion.duration.slow`. `fast` is left out of that list on purpose, so check 30 fails a reduced-motion file that would take the fades away too. Check 6 makes sure the block is there, inside its media query and after the declarations it re-points.
