import type { Adapter } from "../types";
import { applyguyAdapter } from "./applyguy";
import { aprameyakAdapter, jobbieAdapter, jobrightAdapter, resumaxAdapter, zshahAdapter } from "./more";
import { simplifyAdapter } from "./simplify";
import { slashpipeAdapter } from "./slashpipe";
import { speedyapplyAdapter } from "./speedyapply";
import { vanshAdapter } from "./vansh";

const ALL = [
  simplifyAdapter,
  vanshAdapter,
  speedyapplyAdapter,
  applyguyAdapter,
  slashpipeAdapter,
  aprameyakAdapter,
  jobbieAdapter,
  resumaxAdapter,
  zshahAdapter,
  jobrightAdapter,
];
export const ADAPTERS: Record<string, Adapter> = Object.fromEntries(ALL.map((a) => [a.id, a]));
export {
  aprameyakAdapter,
  jobbieAdapter,
  resumaxAdapter,
  zshahAdapter,
  jobrightAdapter,
  simplifyAdapter,
  vanshAdapter,
  speedyapplyAdapter,
  applyguyAdapter,
  slashpipeAdapter,
};
