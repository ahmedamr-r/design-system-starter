# Modes

One file per mode, such as `dark.json`. A mode file re-points semantic tokens, the same way a brand file does, and adds no tokens of its own. Light is what the semantics already hold, so it needs no file.

`data-mode="dark"` on any element picks that file for the element and everything inside it, and it combines with any brand.
