/**
 * TraitDefinition — a reusable block of expertise an agent can mix in through `traits`.
 * Identity is the filename stem.
 */
export type TraitDefinition = {
  name: string;
  body: string;
  /** Skills every agent using this trait gains. */
  skills: string[];
  /** Instructions every agent using this trait gains. */
  instructions: string[];
};
