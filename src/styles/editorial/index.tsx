import "../../design/fonts";
import "./fonts";
import type { StyleDef } from "../types";
import { Paper } from "./Background";
import { EditorialIntro } from "./Intro";
import { PageWipe } from "./PageWipe";
import { EditorialChapter } from "./scenes/Chapter";
import { EditorialList } from "./scenes/List";
import { EditorialOutro } from "./scenes/Outro";
import { EditorialStat } from "./scenes/Stat";
import { EditorialStatement } from "./scenes/Statement";
import tokens from "./tokens";

/**
 * Editorial overrides the type-led scenes (statement, chapter, stat, list, outro) and keeps the
 * shared diagram, sequence, compare and code scenes, which take its paper palette and fonts.
 */
const editorial: StyleDef = {
  tokens,
  scenes: { statement: EditorialStatement, chapter: EditorialChapter, stat: EditorialStat, list: EditorialList, outro: EditorialOutro },
  Background: Paper,
  Overlay: PageWipe,
  Intro: EditorialIntro,
};

export default editorial;
