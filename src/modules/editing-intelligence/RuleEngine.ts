import type { RuleContext, Rule } from "./types";

/**
 * Minimal, ordered rule runner.
 *
 * The engine itself knows nothing about individual editorial heuristics; that
 * keeps extension cheap and low-risk because new rules are just registrations.
 */
export class RuleEngine {
  private readonly rules: Rule[] = [];

  register(rule: Rule): this {
    this.rules.push(rule);
    return this;
  }

  run(context: RuleContext): RuleContext {
    return this.rules.reduce((currentContext, rule) => rule.apply(currentContext), context);
  }
}
