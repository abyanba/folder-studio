/** Encode an SVG string as a `data:image/svg+xml` URL for `new Image().src`. */
export function toSvgDataUrl(svg: string): string {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
