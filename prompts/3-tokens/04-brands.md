Add two brands, Harbor (blue) and Grove (green), as one file each in tokens/brands/. A brand file only re-points existing semantic tokens at different primitives. It adds nothing new.

The build should find brands by reading that folder, so adding a brand never means editing code. Write each brand as a [data-brand="name"] block after the semantics.
