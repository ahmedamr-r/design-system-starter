Add focus.width and focus.offset, both 2px, beside the focus colour that already exists, and make the button and the link draw their ring from all three. Draw it with outline, never box-shadow, and tell me in one sentence why. Make the check fail when a focus style removes the outline or draws a ring with box-shadow.

The focus colour already has a pair in tokens/contrast-pairs.json, at 3:1. Make sure it lists every surface a ring can sit on, and add any that's missing. Add a focused button to the demo's row of states.
