/**
 * Self-hosted text-panel fonts (@fontsource, latin subsets) — replaces the
 * legacy Google Fonts <link>, so text editing and export work offline.
 *
 * Static packages (not -variable) are used deliberately: they register the
 * exact family names stored in documents ("Space Grotesk", not
 * "Space Grotesk Variable"), keeping legacy designs rendering identically.
 *
 * Weights mirror the legacy link (400/600/700 + italics where the family is
 * body-ish); the display faces are single-weight by design. Keep this list in
 * sync with FONTS in src/lib/constants.ts.
 */

// Original ten (legacy parity)
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/source-serif-4/400.css";
import "@fontsource/source-serif-4/600.css";
import "@fontsource/source-serif-4/700.css";
import "@fontsource/source-serif-4/400-italic.css";
import "@fontsource/playfair-display/400.css";
import "@fontsource/playfair-display/700.css";
import "@fontsource/playfair-display/400-italic.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/dm-sans/400-italic.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/libre-baskerville/400.css";
import "@fontsource/libre-baskerville/700.css";
import "@fontsource/libre-baskerville/400-italic.css";
import "@fontsource/fira-code/400.css";
import "@fontsource/fira-code/600.css";
import "@fontsource/merriweather/400.css";
import "@fontsource/merriweather/700.css";
import "@fontsource/merriweather/400-italic.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans/700.css";
import "@fontsource/outfit/400.css";
import "@fontsource/outfit/600.css";
import "@fontsource/outfit/700.css";

// Display faces for icon design (Phase 6 additions)
import "@fontsource/bebas-neue/400.css";
import "@fontsource/abril-fatface/400.css";
import "@fontsource/lobster/400.css";
import "@fontsource/pacifico/400.css";
import "@fontsource/caveat/400.css";
import "@fontsource/caveat/700.css";
import "@fontsource/permanent-marker/400.css";
import "@fontsource/orbitron/400.css";
import "@fontsource/orbitron/700.css";
import "@fontsource/bungee/400.css";
import "@fontsource/press-start-2p/400.css";
import "@fontsource/righteous/400.css";
