export interface PageHint {
  /** Who uses it. */
  who: string;
  /** Under which conditions the user arrives here. */
  when: string;
  before: string[];
  after: string[];
  /** Why the flow/layout is the way it is. */
  why: string;
  /** Page sections and the reason each exists. */
  parts: [string, string][];
  /** What the designer must produce. */
  todo: string[];
  /** Questions to ask real users (A/B, keep/change). */
  ask: string[];
  /** Products to study and what to look at. */
  bench: string[];
}
export interface StateHint { when: string; why: string; reach?: string[]; ask?: string[] }
