import { describe, expect, it } from "vitest";

import { buildTransitionSequence } from "../utils/TransitionSelector";

describe("buildTransitionSequence", () => {
  it("keeps viral transition durations within the requested range and avoids repeats", () => {
    const transitions = buildTransitionSequence(
      [
        { id: "a", start: 0, end: 1.2, energy: 0.2 },
        { id: "b", start: 1.2, end: 2.4, energy: 0.55 },
        { id: "c", start: 2.4, end: 3.3, energy: 0.88 },
        { id: "d", start: 3.3, end: 4.5, energy: 0.61 },
      ],
      "viral"
    );

    expect(transitions).toHaveLength(3);
    expect(transitions.every((transition) => transition.duration >= 0.15 && transition.duration <= 0.6)).toBe(true);
    for (let i = 1; i < transitions.length; i++) {
      expect(transitions[i].type).not.toBe(transitions[i - 1].type);
    }
  });
});
