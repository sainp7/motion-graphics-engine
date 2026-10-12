/**
 * Import this from a pure-JS/TS custom scene (videos/<id>/scenes/<Name>.js|.ts):
 *
 *   import { defineScene } from "../../../src/custom/script-kit";
 *   import gsap from "gsap";
 *
 *   export default defineScene({
 *     setup(ctx) {
 *       const el = document.createElement("div"); ctx.root.append(el);
 *       const tl = gsap.timeline({ paused: true }).from(el, { y: 80, opacity: 0, duration: 0.6 }, ctx.cues.hit ?? 0);
 *       return { seek: (t) => tl.seek(t, false) };
 *     },
 *   });
 */
export { defineScene } from "./script";
export type { ScriptContext, ScriptInstance, ScriptScene } from "./script";
