/**
 * Card geometry shared by the server, which places new cards, and the canvas,
 * which draws them. All values are in canvas pixels.
 */
export const CARD_WIDTH = 304;
export const CARD_HEADER_HEIGHT = 68;
export const CARD_ROW_HEIGHT = 30;
export const CARD_FOOTER_HEIGHT = 10;
/** A card shows at most this many columns before its list scrolls. */
export const CARD_MAX_VISIBLE_ROWS = 12;
export const CARD_EMPTY_BODY_HEIGHT = 44;
export const CARD_GAP = 48;
const GRID_COLUMNS = 4;
const SCAN_STEP = 24;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function cardHeight(columnCount: number): number {
  const body =
    columnCount === 0
      ? CARD_EMPTY_BODY_HEIGHT
      : Math.min(columnCount, CARD_MAX_VISIBLE_ROWS) * CARD_ROW_HEIGHT;
  return CARD_HEADER_HEIGHT + body + CARD_FOOTER_HEIGHT;
}

function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width + CARD_GAP &&
    b.x < a.x + a.width + CARD_GAP &&
    a.y < b.y + b.height + CARD_GAP &&
    b.y < a.y + a.height + CARD_GAP
  );
}

/**
 * Finds a position for each new card so that it overlaps neither an existing
 * card nor another new one. Cards fill a grid of fixed columns from the top
 * left, row by row, and the result only depends on the inputs.
 */
export function placeCards(existing: Rect[], heights: number[]): { x: number; y: number }[] {
  const taken = [...existing];
  return heights.map((height) => {
    const spot = firstFreeSpot(taken, height);
    taken.push(spot);
    return { x: spot.x, y: spot.y };
  });
}

function firstFreeSpot(taken: Rect[], height: number): Rect {
  for (let y = 0; ; y += SCAN_STEP) {
    for (let column = 0; column < GRID_COLUMNS; column += 1) {
      const candidate: Rect = {
        x: column * (CARD_WIDTH + CARD_GAP),
        y,
        width: CARD_WIDTH,
        height,
      };
      if (!taken.some((rect) => overlaps(candidate, rect))) {
        return candidate;
      }
    }
  }
}
