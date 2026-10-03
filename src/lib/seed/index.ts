import { EMPTY_STATE } from "../seedBase";
import type { State } from "../types";
import { baseState } from "./base";
import { populate } from "./populate";

/** Deterministic demo dataset. Same output for the same `now` bucket. */
export function buildSeed(): State {
  const now = Date.now();
  const s = baseState(now);
  populate(s, now);
  s.version = EMPTY_STATE.version;
  s.ready = true;
  delete s._now;
  return s;
}
