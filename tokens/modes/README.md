# Modes

`dark.json` is the one mode file. It re-points colour semantics at other primitives, the way a brand file does, adds no tokens of its own, and never touches a primitive, so `color.gray.900` is the same colour in both modes. Light is what the semantics already hold, so it needs no file.

`dark.json` answers every colour semantic, even where dark is the same as light, so a colour semantic added later cannot be forgotten here. The build writes each semantic whose two answers differ as `light-dark(light, dark)`, which has only those two answers, so no other mode file can go here.

`data-mode="dark"` or `data-mode="light"` on any element sets `color-scheme`, which picks the answer for that element and everything inside it, and it combines with any brand. A page that sets no mode follows the reader's setting.
