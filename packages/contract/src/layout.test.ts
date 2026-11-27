import { describe, expect, it } from "vitest";
import { CARD_GAP, CARD_WIDTH, cardHeight, placeCards, type Rect } from "./layout";

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

describe("cardHeight", () => {
  it("grows with the column count up to the visible limit", () => {
    expect(cardHeight(3)).toBeGreaterThan(cardHeight(1));
    expect(cardHeight(500)).toBe(cardHeight(12));
  });

  it("gives an empty dataset room for its message", () => {
    expect(cardHeight(0)).toBeGreaterThan(cardHeight(1) - 30);
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

  it("gives the same answer for the same input", () => {
    const existing: Rect[] = [{ x: 0, y: 0, width: CARD_WIDTH, height: 200 }];
    expect(placeCards(existing, [100, 400, 100])).toEqual(placeCards(existing, [100, 400, 100]));
  });
});
