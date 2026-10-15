// Turns every token file under tokens/ into CSS custom properties in dist/tokens.css.
import StyleDictionary from 'style-dictionary';

const sd = new StyleDictionary({
  source: ['tokens/**/*.json'],
  platforms: {
    css: {
      transformGroup: 'css',
      buildPath: 'dist/',
      files: [{ destination: 'tokens.css', format: 'css/variables' }],
    },
  },
});

await sd.buildAllPlatforms();
