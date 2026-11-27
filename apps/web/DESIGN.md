---

name: Crosswalk
description: A researcher's datasets set out as pages of a codebook on a paper canvas.
colors:
rubric: "#b3261e"
rubric-deep: "#8c1c16"
rubric-wash: "#fbe9e7"
live: "#2a6a3c"
paper: "#f7f6f2"
leaf: "#ffffff"
ink: "#1b1b1b"
ink-hover: "#3a3a3a"
mute: "#5f646b"
hair: "#d6d3c9"
wash: "#efede6"
typography:
headline:
fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
fontSize: "1.75rem"
fontWeight: 700
lineHeight: 1.333
letterSpacing: "-0.025em"
title:
fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
fontSize: "1.375rem"
fontWeight: 700
lineHeight: 1.4
subtitle:
fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
fontSize: "1.0625rem"
fontWeight: 700
lineHeight: 1.556
body:
fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
fontSize: "0.9375rem"
fontWeight: 400
lineHeight: 1.5
label:
fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
fontSize: "0.8125rem"
fontWeight: 600
lineHeight: 1.429
caption:
fontFamily: "Libre Franklin, ui-sans-serif, system-ui, sans-serif"
fontSize: "0.75rem"
fontWeight: 400
lineHeight: 1.333
verbatim-name:
fontFamily: "Courier Prime, ui-monospace, Courier New, monospace"
fontSize: "0.9375rem"
fontWeight: 700
lineHeight: "1.5rem"
verbatim:
fontFamily: "Courier Prime, ui-monospace, Courier New, monospace"
fontSize: "0.8125rem"
fontWeight: 400
lineHeight: "30px"
verbatim-code:
fontFamily: "Courier Prime, ui-monospace, Courier New, monospace"
fontSize: "1.75rem"
fontWeight: 700
letterSpacing: "0.2em"
rounded:
none: "0"
spacing:
leader-gap: "8px"
card-gutter: "14px"
page-gutter: "16px"
panel-gutter: "24px"
row-height: "30px"
card-gap: "48px"
components:
button-primary:
backgroundColor: "{colors.ink}"
textColor: "{colors.leaf}"
typography: "{typography.label}"
rounded: "{rounded.none}"
padding: "0 16px"
height: "40px"
button-primary-hover:
backgroundColor: "{colors.ink-hover}"
button-secondary:
backgroundColor: "{colors.leaf}"
textColor: "{colors.ink}"
typography: "{typography.label}"
rounded: "{rounded.none}"
padding: "0 16px"
height: "40px"
button-secondary-hover:
backgroundColor: "{colors.wash}"
button-secondary-active:
backgroundColor: "{colors.hair}"
button-danger:
backgroundColor: "{colors.rubric}"
textColor: "{colors.leaf}"
typography: "{typography.label}"
rounded: "{rounded.none}"
padding: "0 16px"
height: "40px"
button-danger-hover:
backgroundColor: "{colors.rubric-deep}"
button-quiet:
textColor: "{colors.ink}"
typography: "{typography.label}"
padding: "0 8px"
height: "32px"
button-quiet-hover:
textColor: "{colors.rubric-deep}"
input:
backgroundColor: "{colors.leaf}"
textColor: "{colors.ink}"
typography: "{typography.body}"
rounded: "{rounded.none}"
padding: "0 12px"
height: "44px"
problem:
backgroundColor: "{colors.rubric-wash}"
textColor: "{colors.rubric-deep}"
typography: "{typography.label}"
rounded: "{rounded.none}"
padding: "10px 12px"
dataset-card:
backgroundColor: "{colors.leaf}"
textColor: "{colors.ink}"
rounded: "{rounded.none}"
width: "304px"
column-row:
textColor: "{colors.ink}"
typography: "{typography.verbatim}"
padding: "0 14px"
height: "30px"
column-row-active:
backgroundColor: "{colors.rubric-wash}"
textColor: "{colors.rubric-deep}"
column-entry:
backgroundColor: "{colors.leaf}"
textColor: "{colors.ink}"
rounded: "{rounded.none}"
padding: "10px 14px 12px"
width: "256px"
command:
backgroundColor: "{colors.paper}"
textColor: "{colors.ink}"
typography: "{typography.verbatim-name}"
rounded: "{rounded.none}"
padding: "8px 12px"
top-bar:
backgroundColor: "{colors.leaf}"
textColor: "{colors.ink}"
padding: "8px 24px"
height: "56px"
---

# Design System: Crosswalk

## Overview

**Creative North Star: "The Codebook"**

A dataset card is a page of a codebook: variable name, dotted leader, type.
The whole interface is set the way printed data documentation is set, on warm paper, in ink, with one red rubric.
It is flat, ruled, and square, and it reads as a document a researcher already knows how to read.

The system is quiet and dense where the data is, and plain and roomy where the instructions are.
Two typefaces split the world in two: Courier Prime is the user's own material quoted exactly, and Libre Franklin is Crosswalk speaking.
That split is how the interface shows what was read from the user's machine and what was not.

The system refuses the grey dotted node-editor canvas with rounded cards and a blue accent.
The canvas is unmarked paper, cards are white leaves with ink borders, and nothing is blue.

**Key Characteristics:**

- Paper ground, white leaves, ink rules, one red rubric.
- Square corners everywhere, 1px ink borders, a 3px double rule under every heading that opens a list or a panel.
- A dotted leader wherever a label meets its value.
- Courier Prime for anything verbatim from the user's files or terminal, Libre Franklin for everything else.
- Shadow only on things that move or open above the paper.
- Tabular numerals throughout.

## Colors

Warm paper and near-black ink carry almost everything, and a single printer's red marks the one thing being read or the one thing going wrong.

### Primary

- **Rubric** (#b3261e): the fill of destructive buttons, the border of error boxes and invalid fields, the 3px top rule of the open column entry, and the text caret.
- **Rubric Deep** (#8c1c16): rubric as text, used for the active column row, error messages, and the hover colour of text links.
- **Rubric Wash** (#fbe9e7): the ground behind the active column row, error boxes, and delete confirmations.

### Secondary

- **Live Green** (#2a6a3c): the 8px dot beside the word "Live" in the top bar, and nothing else.

### Neutral

- **Paper** (#f7f6f2): the page and canvas ground, and the inset ground of a command line inside a white panel.
- **Leaf** (#ffffff): cards, panels, the top bar, inputs, and text on ink or rubric fills.
- **Ink** (#1b1b1b): text, 1px borders, the double rule, the primary button fill, the focus ring, and the text selection ground.
- **Ink Hover** (#3a3a3a): the hover fill of the primary button only.
- **Mute** (#5f646b): secondary text, type labels, placeholders, and the dotted leader.
- **Hair** (#d6d3c9): light dividers between list rows and inside panels, loading placeholders, and the pressed state of the secondary button.
- **Wash** (#efede6): the hover ground of secondary buttons, icon buttons, and canvas controls.

### Named Rules

**The Rubric Rule.** Rubric means one of three things: the active column, an error, or a destructive action.
It is never decoration, never a brand accent, and never the focus ring.

**The Live Rule.** Green appears only as the dot of the live connection state.
When the connection drops the dot becomes a hollow Mute ring and the word changes to "Reconnecting", so the state never rests on colour alone.

## Typography

**Display Font:** Libre Franklin (with ui-sans-serif, system-ui, sans-serif)
**Body Font:** Libre Franklin (with ui-sans-serif, system-ui, sans-serif)
**Label/Mono Font:** Courier Prime (with ui-monospace, Courier New, monospace)

**Character:** A plain grotesque for the interface beside a typewriter face for quoted material.
The pairing reads as a typeset report with typed inserts, which is what a codebook is.

### Hierarchy

- **Headline** (700, 1.75rem, 1.333, tracking -0.025em): the one page title on list and form pages.
- **Title** (700, 1.375rem, 1.4): the heading of a bordered panel, such as the log in form and the link steps.
- **Subtitle** (700, 1.0625rem, 1.556): section headings above a double rule, the wordmark, and project names in a list.
- **Body** (400, 0.9375rem, 1.5): running text, capped at 62ch.
- **Label** (600, 0.8125rem): buttons and field labels, and at weight 400 or 500 for hints, metadata, and navigation links.
- **Caption** (400, 0.75rem): the row and column counts under a card name, footnotes on the canvas, and the italic type label at the end of a column row.
- **Verbatim Name** (Courier Prime 700, 0.9375rem, 1.5rem): the dataset name in a card header and the column name in its entry.
  Device host names and commands use the same face at their container's size.
- **Verbatim** (Courier Prime 400, 0.8125rem, 30px line): one column name per card row.
- **Verbatim Code** (Courier Prime 700, 1.75rem, tracking 0.2em): the device code shown for confirmation.

### Named Rules

**The Verbatim Rule.** Courier Prime means "copied exactly from the user's files or terminal": dataset names, column names, commands, the device code, and device host names.
Everything else is Libre Franklin, including the wordmark and project names.

**The Untouched Name Rule.** Column and dataset names are never uppercased, title-cased, or otherwise altered.
A name too long for its row is truncated with an ellipsis and shown whole in its entry.
A blank name is shown as "(no name)".

**The Italic Type Rule.** A column's type is set in italic Libre Franklin at the end of the leader, in Mute.
Italic is not used for emphasis anywhere else.

## Layout

There are two frames.
The canvas frame fills the window: a top bar, then paper to every edge, with cards placed on it.
The page frame is a single centred column (max 48rem) under the same top bar, with 40px above the title and 32px between the lede and the content.
Forms that stand alone, such as log in, sit in a centred panel (max 24rem).

Card geometry is fixed and shared with the server that places cards: 304px wide, a 68px header, 30px per column row, a 10px foot, at most 12 rows before the list scrolls, and a 44px body for a file with no columns.
Cards are placed on a four-column grid with a 48px gap.
The canvas never fits cards below 0.9 zoom, so column names stay readable.

Gutters are 14px inside a card, 24px inside a panel, and 16px at the page edge, widening to 24px from 640px.
Lists are rows separated by a Hair rule with 16px above and below.
Below 640px a leader row stacks: the label sits above its value and the leader is dropped.
The account email in the top bar appears only from 1024px.

## Elevation & Depth

The system is flat.
Depth is stated by rules and by white on paper, not by shadow.
Shadow is kept for the two things that physically sit above the paper: a card that can be picked up, and a column entry that has opened beside its card.

### Shadow Vocabulary

- **Leaf** (`box-shadow: 0 1px 0 rgb(27 27 27 / 0.08), 0 14px 28px -18px rgb(27 27 27 / 0.45)`): a dataset card at rest on the canvas.
- **Lifted** (`box-shadow: 0 1px 0 rgb(27 27 27 / 0.1), 0 22px 36px -18px rgb(27 27 27 / 0.55)`): a card while it is dragged, and the open column entry.

### Named Rules

**The Loose Leaf Rule.** Shadow belongs only to draggable cards and the open column entry.
Static panels, forms, lists, error boxes, and the top bar have none.

## Shapes

Every corner is square (0 radius).
Boxes are drawn with a 1px Ink border.
The top bar closes with a 2px Ink rule.
A heading that opens a panel or a list sits on a 3px double Ink rule.
Dividers inside a panel or between list rows are 1px Hair.
The open column entry has a 3px Rubric top rule over its Ink border.

The only round shape is the 8px live status dot, which is a point, not a corner.

The dotted leader is a 1px dotted Mute line that fills the space between a label and its value, with 8px either side and a 24px minimum length, lifted 0.28em so it sits on the baseline.

**The Double Rule Rule.** A card header, a panel heading, and a section heading that opens a list all end in the same 3px double Ink rule.
A single Hair rule is for divisions inside what the double rule opened.

**The Leader Rule.** Wherever a label meets a value on one line they are joined by a dotted leader: column name to type, measure to figure, project to its count and date.

## Components

### Buttons

Plain ruled rectangles that say what they do.

- **Shape:** square, 1px border, 40px minimum height, 16px side padding, Label type.
  Buttons that close a form are 44px high.
- **Primary:** Ink fill with Leaf text.
  One per view.
- **Secondary:** Leaf fill, Ink border and text.
  This is the default.
- **Danger:** Rubric fill with Leaf text, used only to carry out a deletion or unlinking that has already been asked for.
- **Quiet:** no border or fill, underlined Ink text, 32px high, for dismissals.
- **Hover / Focus:** fills shift one step (Ink to Ink Hover, Leaf to Wash, Rubric to Rubric Deep) over 150ms.
  Focus is a 2px Ink outline offset 2px.
  Disabled and busy buttons drop to 55% opacity, and a busy button swaps its label for what is happening ("Creating", "Removing").
- **Small:** inside a card header, buttons are 28px high in Caption size at weight 600.

### Text links

- Ink, underlined at 1px with a 0.2em offset, turning Rubric Deep on hover.
- Navigation links in the top bar are not underlined at rest and gain an underline on hover and on the current page.
- Row actions such as Rename, Delete, and Unlink are text links in Label size, not buttons.

### Cards / Containers

- **Corner Style:** square.
- **Background:** Leaf on Paper.
- **Shadow Strategy:** none for panels; see Elevation & Depth for cards on the canvas.
- **Border:** 1px Ink.
- **Internal Padding:** 24px sides, with the heading on a double rule and any closing note above a Hair rule.

### Inputs / Fields

- **Style:** Leaf ground, 1px Ink border, square, 44px high, 12px side padding, Body type, Mute placeholder.
  The label sits above in Label type and a hint sits below in Mute.
- **Focus:** the 2px Ink outline, with a Rubric caret.
- **Error:** the border turns Rubric and the hint is replaced by the message in Rubric Deep at weight 500.
- **Code entry:** the field for the device code is set in Courier Prime, because the code is copied from the terminal.

### Problem box

A message that says what went wrong and what to do.
Rubric border, Rubric Wash ground, Rubric Deep text in Label size at weight 500, 12px by 10px padding.
A confirmation for a destructive action uses the same box with Ink text and a Danger button beside a Secondary one that keeps things as they are.

### Navigation

The top bar is a Leaf strip at least 56px high, closed by a 2px Ink rule.
It holds the wordmark in Subtitle type with tight tracking, then a Mute slash and the project name in bold Body type, then the live status, then the account links in Label size at weight 500.
It wraps onto a second line on narrow windows.

### Dataset card

The signature component: one page of the codebook.

- **Leaf:** 304px wide, Leaf ground, 1px Ink border, Leaf shadow at rest and Lifted shadow while dragged.
- **Header:** 68px, ending in the double rule.
  The file name in Verbatim Name type, truncated, with the full path as its title.
  Under it, in Mute Caption type, the row count, the column count, a slash, and the format.
  A 28px remove button with a drawn 14px cross sits at the right, Mute at rest and Ink on Wash on hover.
- **Rows:** 30px each.
  The column name in Verbatim type, a leader, then the type in italic Mute Caption type.
- **Active row:** the hovered or focused row takes a Rubric Wash ground and Rubric Deep text, type label included.
  Arrow keys, Home, and End move through the rows.
  The focus outline is drawn inside the row.
- **Removing:** the header's content is replaced in place by the question and two small buttons, Remove (Rubric) and Keep.
- **Arrival:** a card sent from the terminal while the canvas is open is revealed from its top edge over 420ms on an exponential ease-out, and not at all under reduced motion.

### Column entry

The codebook entry for the active column, opened 12px to the right of its card and level with its row.
256px wide, Leaf ground, 1px Ink border, 3px Rubric top rule, Lifted shadow.
It states the column's position in the file, its name in Verbatim Name type broken across lines rather than truncated, one sentence on what the values look like, and then, above a Hair rule, leader rows for the share of empty cells and the number of different values.
It never shows a cell value.

### Command

A line to copy into a terminal.
A 1px Ink box with the command in Courier Prime on the ground that contrasts with its surroundings (Paper inside a Leaf panel, Leaf on a Paper page), and a Copy button divided from it by a 1px Ink rule that reads "Copied" for a moment after use.

### Canvas controls

Zoom in, zoom out, and fit, stacked at the bottom left in a 1px Ink box.
Each is a 36px Leaf square divided by Hair rules, with Wash on hover.

### Loading placeholder

A Hair bar the height of the line it stands in for, pulsing, and still under reduced motion.

## Do's and Don'ts

### Do:

- **Do** set anything copied from the user's files or terminal in Courier Prime, exactly as it was written.
- **Do** join a label to its value with the dotted leader whenever they share a line.
- **Do** close every card header, panel heading, and list heading with the 3px double Ink rule.
- **Do** keep every box square with a 1px Ink border.
- **Do** use the 2px Ink outline, offset 2px, for focus on every control.
- **Do** keep row height at 30px and card width at 304px, taken from the shared layout constants.
- **Do** make a destructive action a two-step: a text link or icon first, then a Rubric button beside a button that keeps things as they are.
- **Do** write copy in plain sentences with no em dashes.
- **Do** pair every colour state with a word or shape change.

### Don't:

- **Don't** use Rubric for anything except the active column, an error, or a destructive action.
- **Don't** use green for anything except the live status dot.
- **Don't** uppercase, title-case, or otherwise alter a column or dataset name.
- **Don't** set the wordmark, project names, or interface text in Courier Prime.
- **Don't** round a corner.
  The live status dot is the only round shape.
- **Don't** put a shadow on a static panel, form, list, or message.
- **Don't** draw a grid, dots, or any pattern on the canvas.
  It is plain Paper.
- **Don't** add a blue accent or a second accent colour.
- **Don't** show a cell value anywhere.
  Cards and entries hold names and profiles only.
