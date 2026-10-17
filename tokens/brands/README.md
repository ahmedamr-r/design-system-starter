# Brands

One file per brand, named for it, such as `harbor.json`. A brand file points the ten steps of the brand ramp, `color.brand.50` to `color.brand.900`, at the same steps of one primitive ramp, such as `color.blue.50` to `color.blue.900`, and sets no other colour. The brand semantics read the ramp, so they all follow, in light and in dark. A brand file may also re-point a component token that is not a colour at another semantic, such as a pill-shaped button radius. It adds no tokens of its own.

`data-brand="harbor"` on any element picks that file for the element and everything inside it. Adding a brand should only ever mean adding a file here.

`_template.json` is not a brand: the build and the check skip any file whose name starts with an underscore. It lists every token a brand may set, each at its value with no brand and with a description of what it paints in light and in dark, and a brand may set nothing it does not list. Start a new brand by copying it.
