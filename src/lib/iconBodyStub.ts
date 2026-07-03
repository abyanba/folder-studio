/**
 * Temporary icon-body provider for Phase 4/5. The real Iconify fetch + in-memory
 * cache lands in Phase 6; until then this returns a single star body for any
 * requested icon so seeded/sample icon elements render and export. Swap the call
 * sites (`ElementView`, `ExportDialog`) for the real cache hook in Phase 6.
 */

import type { IconBody } from "@/lib/export/elementSvg";

const STAR: IconBody = {
  width: 256,
  height: 256,
  body: '<path fill="currentColor" d="M128 24l30 62 68 10-49 48 12 68-61-32-61 32 12-68-49-48 68-10z"/>',
};

export function getIconBodyStub(_name: string, _variant: string): IconBody | null {
  return STAR;
}
