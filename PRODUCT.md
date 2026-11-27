# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js (App Router, React 19, static export), Tailwind CSS v4, React Flow for the canvas, served by a Hono server.
A Python command line tool runs on the user's machine.
The full record is in `spec/Tech.md`.

## Users

Academic researchers and their research assistants who work with tabular datasets.
The first users are one professor and one research assistant.
Later users are a research group, and then any researcher.
They range from people who have never opened a terminal to people who want to read every line of a script.
They use Crosswalk at a desk, on a laptop or a large monitor, in long working sessions next to a terminal and a spreadsheet.

## Product Purpose

Crosswalk replaces the routine part of a research assistant's job.
A researcher shows it their datasets, describes what they want done, confirms a plan they can see, and gets the finished file without writing code.
The four jobs are joining datasets, enriching one with another, analysis, and constructing new datasets.
Success is a professor finishing a real request without contacting their research assistant.

## Positioning

The datasets stay on the user's machine and only what the user allows leaves it.
A command line tool reads the files and sends column names and profiles, and the web app plans against those.
Matching recipes are tested code, not code an AI writes fresh each time, and every AI matching run ends with an accuracy audit.

## Operating Context

- The user installs the `crosswalk` command, links it to their account with a short code, and runs it in a folder of datasets.
- Each dataset appears on a canvas as a card that lists its columns.
- Datasets are CSV, TSV, Excel, Parquet, and Stata files, often licensed, often with hundreds of columns.
- Column names are the user's own and can be long, cryptic, or duplicated.
- The canvas is where later versions draw arrows between columns to describe joins and matches.

## Capabilities and Constraints

Version 1 has accounts, named projects, linking the command line tool, schema cards with column profiles, and a canvas with draggable cards whose positions are saved.
Version 1 has no arrows, no chat, no scripts, and no AI.
Version 1 runs on one laptop.
A column profile holds a type, the share of empty cells, the number of different values, and a description of what values look like.
A profile never contains a cell value.

Terms that must stay consistent: project, dataset, card, column, profile, link, canvas.
A crosswalk is the table that maps one dataset's identifiers onto another's.

## Brand Commitments

The name is Crosswalk.
Copy is plain and direct, written for someone who is not a programmer.
No em dashes anywhere.

## Evidence on Hand

There are no customers, testimonials, benchmarks, or prices, and none may be invented.
Demonstration datasets must be synthetic and must not come from the Lex Machina project's data.

## Product Principles

- The user decides what leaves the machine.
- Confirm before run.
- Deterministic before fuzzy before AI.
- Measure, do not approve.
- Simple for the least technical user: if a screen needs explaining, the screen is wrong.

## Accessibility & Inclusion

WCAG 2.2 AA.
Every canvas action also works from the keyboard.
Reduced motion is respected.
