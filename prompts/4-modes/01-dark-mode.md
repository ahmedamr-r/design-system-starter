Add dark mode as tokens/modes/dark.json. A mode file re-points semantic colours and never touches a primitive, so color.gray.900 holds the same colour in both modes. Answer every colour semantic in it, even where dark is the same as light, so a colour added later can't be forgotten. For now re-point only the neutrals: the page and card surfaces to gray 950 and 900, body and secondary text to gray 50 and 400, and the default border to gray 800. Leave the brand roles as they are.

In the build, write each semantic whose two answers differ as light-dark(light, dark), and make data-mode set color-scheme, with light dark on :root so a page that sets no mode follows the reader's setting.

Give every demo panel a data-mode, add a dark panel for each brand, and add a Grove card inside a dark Harbor panel and a dark panel inside a Grove section. Every element with a data-mode, and every card, sets its own background and text colour from the semantics, because a colour an element inherits was worked out on the ancestor that set it. A panel with a data-mode paints the page surface, with some padding.

Update the check so it fails when:
1. a mode file holds a colour value, sets a primitive, or sets a token that isn't a colour or doesn't exist
2. a colour semantic has no answer in tokens/modes/dark.json
3. tokens/modes/ holds a mode other than dark, since light-dark() knows only two
4. the demo reads a variable the build doesn't write (suggest the closest name)
and so light-dark() of two references counts as a reference. Add new checks after the eight that are there, so those keep their numbers. Then explain why the Grove card stays dark.
