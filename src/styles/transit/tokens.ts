import type { StyleTokens } from "../../design/style-tokens";
import { EASE, FONT, PALETTES, TYPE } from "../../design/tokens";

/**
 * Transit: the system is a transit map. Stations, coloured lines that stay painted, signage type
 * (Overpass, the face of US highway signs), a line that wipes between scenes. Calm, precise,
 * diagram-first. The original studio style.
 */
export const TRANSIT_TOKENS: StyleTokens = {
  id: "transit",
  name: "Transit",
  description:
    "The system is a transit map: components are stations, requests ride coloured lines that stay painted, text is signage, scenes change with a line wipe. Calm, precise and diagram-first; made for system design explainers.",
  palettes: PALETTES,
  fonts: { sans: FONT.sans, mono: FONT.mono },
  displayRoles: [],
  type: TYPE,
  ease: EASE,
  defaults: { music: "transit-drive", theme: "dark" },
};
export default TRANSIT_TOKENS;
