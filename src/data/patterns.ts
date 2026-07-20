/**
 * Closed catalog of the Hero Patterns motifs the app ships, keyed by the
 * `hero-patterns` npm export name. Curated down from the library's 87: the
 * omissions are tiles whose detail dissolves at icon scale, or that another
 * entry already covers once the rotation control is in play.
 *
 * Hero Patterns © Steve Schoger, licensed CC BY 4.0
 * (https://creativecommons.org/licenses/by/4.0/) — see README for attribution.
 *
 * Edit this list, then re-run `npm run generate:patterns`. The generator FAILS
 * on a name that doesn't resolve, so a typo here can't ship silently.
 */

export interface PatternCatalogEntry {
  /** `hero-patterns` export name. */
  key: string;
  /** Display name in the picker. */
  name: string;
}

export const PATTERN_CATALOG: PatternCatalogEntry[] = [
  { key: "aztec", name: "Aztec" },
  { key: "autumn", name: "Autumn" },
  { key: "bathroomFloor", name: "Bathroom Floor" },
  { key: "boxes", name: "Boxes" },
  { key: "brickWall", name: "Brick Wall" },
  { key: "bubbles", name: "Bubbles" },
  { key: "cage", name: "Cage" },
  { key: "charlieBrown", name: "Charlie Brown" },
  { key: "circlesAndSquares", name: "Circles & Squares" },
  { key: "circuitBoard", name: "Circuit Board" },
  { key: "current", name: "Current" },
  { key: "curtain", name: "Curtain" },
  { key: "cutout", name: "Cutout" },
  { key: "deathStar", name: "Death Star" },
  { key: "diagonalStripes", name: "Diagonal Stripes" },
  { key: "dominos", name: "Dominos" },
  { key: "endlessClouds", name: "Endless Clouds" },
  { key: "fancyRectangles", name: "Fancy Rectangles" },
  { key: "formalInvitation", name: "Formal Invitation" },
  { key: "fourPointStars", name: "4 Point Stars" },
  { key: "happyIntersection", name: "Happy Intersection" },
  { key: "hexagons", name: "Hexagons" },
  { key: "houndstooth", name: "Houndstooth" },
  { key: "intersectingCircles", name: "Intersecting Circles" },
  { key: "jupiter", name: "Jupiter" },
  { key: "leaf", name: "Leaf" },
  { key: "lips", name: "Lips" },
  { key: "lisbon", name: "Lisbon" },
  { key: "melt", name: "Melt" },
  { key: "moroccan", name: "Moroccan" },
  { key: "overlappingCircles", name: "Overlapping Circles" },
  { key: "overlappingDiamonds", name: "Overlapping Diamonds" },
  { key: "pixelDots", name: "Pixel Dots" },
  { key: "polkaDots", name: "Polka Dots" },
  { key: "roundedPlusConnected", name: "Rounded Plus Connected" },
  { key: "signal", name: "Signal" },
  { key: "slantedStars", name: "Slanted Stars" },
  { key: "squaresInSquares", name: "Squares in Squares" },
  { key: "temple", name: "Temple" },
  { key: "ticTacToe", name: "Tic Tac Toe" },
  { key: "topography", name: "Topography" },
  { key: "volcanoLamp", name: "Volcano Lamp" },
  { key: "wiggle", name: "Wiggle" },
];
