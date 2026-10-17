During the build, write dist/brands.json with each brand's id, display name (the id with a capital letter) and hue, and dist/brands.d.ts with a Brand type listing the ids, both read from the files in tokens/brands/.

Change the demo so it builds its panels from dist/brands.json and names no brand itself: a light and a dark panel for no brand and for each brand, the nested cases from before built from the list, and a branded card inside a light panel inside a dark one. Then make the check that no script names a brand cover the demo as well.
