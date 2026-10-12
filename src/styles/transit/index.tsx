import "../../design/fonts";
import { Stage } from "../../primitives/Stage";
import type { StyleDef } from "../types";
import { TransitIntro } from "./Intro";
import { LineWipes } from "./LineWipes";
import { TRANSIT_TOKENS } from "./tokens";

/** Transit uses the shared scene library as is: it is the style the library was drawn in. */
const transit: StyleDef = {
  tokens: TRANSIT_TOKENS,
  Background: Stage,
  Overlay: LineWipes,
  Intro: TransitIntro,
};

export default transit;
