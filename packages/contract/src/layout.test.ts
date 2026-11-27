import { describe, expect, it } from "vitest";
import { CARD_GAP, CARD_WIDTH, cardHeight, placeCards, type Rect } from "./layout";

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

describe("cardHeight", () => {
  // A card is a 68 high header, one 30 high row per column, and a 10 high footer.
  it("adds one row per column up to the twelve that are visible", () => {
    expect(cardHeight(1)).toBe(108);
    expect(cardHeight(3)).toBe(168);
    expect(cardHeight(12)).toBe(438);
    expect(cardHeight(500)).toBe(438);
  });

  it("gives an empty dataset a 44 high body for its message", () => {
    expect(cardHeight(0)).toBe(122);
  });
});

describe("placeCards", () => {
  it("starts at the origin on an empty canvas", () => {
    expect(placeCards([], [cardHeight(4)])).toEqual([{ x: 0, y: 0 }]);
  });

  it("never overlaps new cards with each other", () => {
    const heights = Array.from({ length: 11 }, (_, index) => cardHeight(index * 2));
    const spots = placeCards([], heights);
    const rects = spots.map((spot, index) => ({
      ...spot,
      width: CARD_WIDTH,
      height: heights[index] as number,
    }));
    for (let a = 0; a < rects.length; a += 1) {
      for (let b = a + 1; b < rects.length; b += 1) {
        expect(intersects(rects[a] as Rect, rects[b] as Rect)).toBe(false);
      }
    }
  });

  it("keeps a gap from cards the user already moved", () => {
    const moved: Rect = { x: 40, y: 10, width: CARD_WIDTH, height: 300 };
    const [spot] = placeCards([moved], [200]);
    expect(spot).toBeDefined();
    const placed: Rect = { x: spot?.x ?? 0, y: spot?.y ?? 0, width: CARD_WIDTH, height: 200 };
    const padded: Rect = {
      x: moved.x - CARD_GAP + 1,
      y: moved.y - CARD_GAP + 1,
      width: CARD_WIDTH + 2 * CARD_GAP - 2,
      height: moved.height + 2 * CARD_GAP - 2,
    };
    expect(intersects(placed, padded)).toBe(false);
  });

  // Cards are 304 wide with a 48 gap, so the four grid columns start at
  // 0, 352, 704, and 1056.
  it("fills the rest of the first row beside a card at the origin, then starts a new row", () => {
    const existing: Rect[] = [{ x: 0, y: 0, width: CARD_WIDTH, height: 200 }];
    const spots = placeCards(existing, [200, 200, 200, 200]);
    expect(spots.slice(0, 3)).toEqual([
      { x: 352, y: 0 },
      { x: 704, y: 0 },
      { x: 1056, y: 0 },
    ]);
    const below = spots[3];
    expect(below?.x).toBe(0);
    expect(below?.y).toBeGreaterThanOrEqual(200 + CARD_GAP);
    expect(below?.y).toBeLessThan(200 + 2 * CARD_GAP);
  });
});
