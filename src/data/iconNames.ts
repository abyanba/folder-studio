/**
 * Phosphor icon catalog shown in the Icons panel, ported verbatim from the
 * legacy `ICON_NAMES` (public/legacy.html L340-348). Keys are category tabs;
 * values are Iconify names in the `ph` icon set.
 */

export const ICON_NAMES: Record<string, string[]> = {
  General: ["house", "magnifying-glass", "bell", "bell-ringing", "gear", "gear-six", "user", "users", "user-circle", "user-plus", "heart", "star", "bookmark", "bookmarks", "archive", "trash", "folder", "folder-open", "file", "file-text", "link", "lock", "lock-open", "eye", "eye-slash", "check-circle", "x-circle", "plus-circle", "question", "key", "info", "warning-circle", "shield", "share-network", "arrow-right", "arrow-left", "arrow-up", "arrow-down", "arrows-clockwise"],
  Media: ["image", "images", "camera", "camera-rotate", "video-camera", "microphone", "microphone-slash", "speaker-high", "speaker-slash", "headphones", "music-note", "music-notes", "disc", "film-strip", "play-circle", "pause-circle", "stop-circle", "skip-forward", "skip-back", "shuffle", "repeat", "broadcast", "record", "playlist", "television", "radio", "rewind", "fast-forward"],
  Communication: ["chat", "chat-text", "chat-dots", "chats", "envelope", "envelope-open", "phone", "phone-call", "phone-slash", "paper-plane", "megaphone", "share", "at", "address-book", "user-circle", "chat-circle", "chat-centered", "chat-teardrop", "chats-circle", "paper-plane-tilt", "megaphone-simple", "bell-ringing"],
  "Dev & Files": ["code", "terminal", "brackets-curly", "brackets-round", "brackets-square", "git-branch", "git-commit", "git-merge", "git-pull-request", "database", "cloud", "cloud-arrow-up", "cloud-arrow-down", "cloud-check", "hard-drive", "cpu", "wifi-high", "globe", "monitor", "laptop", "device-mobile", "keyboard", "bug", "hash", "plug", "file-code", "file-zip", "package", "stack", "stack-simple"],
  UI: ["squares-four", "circle", "triangle", "diamonds-four", "hexagon", "octagon", "shield", "sliders", "sliders-horizontal", "list", "list-bullets", "list-checks", "list-numbers", "table", "layout", "sidebar", "columns", "rows", "grid-four", "dots-nine", "app-window", "browsers", "faders", "funnel", "tag", "frame-corners", "selection", "star", "check-square", "minus-square"],
  Commerce: ["shopping-cart", "shopping-bag", "tag", "tag-simple", "credit-card", "wallet", "bank", "currency-dollar", "currency-eur", "currency-btc", "coin", "coins", "chart-bar", "chart-line", "chart-pie", "chart-donut", "trend-up", "trend-down", "receipt", "gift", "handshake", "percent", "seal-check", "buildings", "briefcase", "barcode", "qr-code"],
  Nature: ["sun", "sun-dim", "moon", "moon-stars", "cloud", "cloud-rain", "cloud-snow", "cloud-sun", "cloud-lightning", "snowflake", "leaf", "flower", "flower-tulip", "tree", "tree-evergreen", "drop", "fire", "lightning", "mountains", "planet", "compass", "map-trifold", "map-pin", "anchor", "waves", "paw-print", "sparkle", "thermometer", "wind", "umbrella", "feather"],
};

export const ICON_CATEGORIES = Object.keys(ICON_NAMES);
