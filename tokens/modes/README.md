# Modes

`dark.json` is the one mode file. It re-points colour semantics at other primitives or other steps of the brand ramp, adds no tokens of its own, and never touches a primitive or a step of the ramp, so `color.gray.900` is the same colour in both modes and each brand keeps its ramp. Light is what the semantics already hold, so it needs no file.

`dark.json` answers every colour semantic but the ramp's steps, even where dark is the same as light, so a colour semantic added later cannot be forgotten here. The brand semantics answer with a step, such as `color.brand.400` for `color.text.link`, so every brand gets its own dark answer from this one file. The build writes each semantic whose two answers differ as `light-dark(light, dark)`, which has only those two answers, so no other mode file can go here.

`data-mode="dark"` or `data-mode="light"` on any element sets `color-scheme`, which picks the answer for that element and everything inside it, and it combines with any brand. A page that sets no mode follows the reader's setting.
