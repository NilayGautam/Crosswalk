---
version: 1
slug: "src-app"
primary_target: "src/app"
related_targets: []
---

# Crosswalk web app

Scope: every screen of the v1 web app (login, sign up, projects, device code, linked devices, canvas).
Visitor mode: Operate.

Audience and job: a researcher at a desk in daylight, in a long session beside a terminal and a spreadsheet, putting their datasets on a canvas and arranging them.
Task: sign in, make a project, link the command line tool, see dataset cards arrive, drag them, read a column's profile.
Constraints: standard web controls only, WCAG 2.2 AA, every canvas action reachable by keyboard, column names shown exactly as written in the file.
Memorable moment: a card appears on the open canvas the instant the terminal sends it.
Unresolved: none.

## Direction contract

THESIS: A dataset card is a page of a codebook: variable name, dotted leader, type. It refuses the grey dotted node-editor canvas with rounded cards and a blue accent.

OWN-WORLD: Paper ground #f7f6f2, white leaves, ink #1b1b1b, one red rubric #b3261e, grey #5f646b for secondary text, green only for the live state. Square corners, 1px ink borders, a double rule under every card header. Courier Prime for dataset and column names, Libre Franklin for all interface text. Wherever a label meets a value they are joined by a dotted leader.

STORY: The researcher sees their own files listed the way documentation lists them, trusts that nothing but names and profiles was sent, and arranges the cards.

FIRST VIEWPORT: A white top bar ruled in 2px ink holds the wordmark, the project name, the live status and the account menu. Below it the paper canvas fills the window. Cards are 304px white leaves: header with the file name in Courier and row and column counts, a double rule, then one 30px row per column. The focused column turns rubric and opens its codebook entry beside the card. The primary action on an empty canvas is the install and link steps, centred.

FORM: The Codebook, first on my ordered list of seven; seed:2a1e40dbd4c9650f.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
