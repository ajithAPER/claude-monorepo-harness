---
name: requirements
description: Structured requirement gathering before task planning. Asks targeted questions to produce complete requirements with scope boundaries and acceptance criteria. Use when the user describes a feature, says "gather requirements", "what do I need", or before invoking /task-plan on a vague request.
user-invocable: true
---

# Requirement Gathering

A four-phase conversational funnel that produces a structured requirements document. Designed to front-load clarity before task decomposition so downstream agents don't need to guess.

## When to Use

- Before `/task-plan` when the feature description is vague or incomplete
- When the user says "gather requirements", "what do I need to define", or similar
- The planner agent invokes this automatically as Step 0

## When to Skip

- The user provides a detailed spec that already covers scope + acceptance criteria
- Bug fix with a clear reproduction case
- User explicitly says "skip requirements" or "just plan this"

## Workflow

### Phase 1: Framing (1-2 turns)

If the user hasn't already described the feature, ask a single open question:

> "Describe the feature you want to build in 2-4 sentences."

From the response, silently identify:
- **Domain tags**: frontend, backend, devops, devex, qa (for later agent assignment)
- **Initial intent**: What the user wants to accomplish
- **Axes already covered**: Which 5W1H questions are already answered

Do NOT ask follow-up questions yet. Parse first.

### Phase 2: 5W1H Completeness (3-5 turns)

Check which of the six axes are missing or ambiguous in the framing response. Ask about missing axes **one question per turn**, in this priority order:

1. **Why** (business rationale) — Most valuable for generating acceptance criteria. Example: "What problem does this solve, or what outcome do you want?"
2. **Who** (actor/user) — "Who will use this feature? End users, admins, other services?"
3. **What** (behavior) — "What specifically should happen? Walk me through the interaction."
4. **How** (mechanism/constraints) — "Are there technical constraints or approaches you want to use?"
5. **When** (trigger/timing) — "What triggers this? On page load, user action, scheduled job?"
6. **Where** (context/environment) — "Where does this live? Which product, page, or service?"

**Rules:**
- Skip axes that are clearly answered in the framing response
- Ask exactly ONE question per turn — never batch questions
- Stop after all critical axes are covered OR after 5 turns, whichever comes first
- If the user gives a short answer, accept it and move on — don't push for more detail on the same axis

### Phase 3: Scope & Ambiguity (2-3 turns)

**Ambiguity scan** (silent): Review all answers so far for four ambiguity types:
- **Lexical**: A term has multiple meanings ("performance" = latency or throughput?)
- **Syntactic**: Sentence structure allows multiple parsings ("users and admins with roles")
- **Semantic**: Technically clear but contextually undefined ("fast" — how fast?)
- **Referential**: Pronouns or implicit references ("it should update it" — which it?)

Surface only the highest-risk ambiguity per turn. Frame as a clarifying question, not a criticism.

**Scope boundary question**: Ask once —

> "What should this feature explicitly NOT change or touch?"

This populates the Won't / Out of Scope list and prevents agent scope creep.

**MoSCoW prioritization**: If multiple requirements surfaced during 5W1H, ask:

> "Which of these are must-haves vs. nice-to-haves?"

Classify into Must / Should / Could / Won't.

### Phase 4: Requirements Summary (output)

Generate and present the structured requirements document:

```markdown
## Requirements Summary

### Intent
{1-2 sentence summary of the feature}

### 5W1H
| Axis | Answer |
|------|--------|
| **Why** | {business rationale} |
| **Who** | {actor/user} |
| **What** | {behavior/feature} |
| **How** | {mechanism/constraints} |
| **When** | {trigger/timing, if applicable} |
| **Where** | {context/environment, if applicable} |

### Scope
**In scope (Must)**:
- {must-have item 1}
- {must-have item 2}

**Should have**:
- {nice-to-have items, if any}

**Out of scope (Won't)**:
- {explicit exclusion 1}
- {explicit exclusion 2}

### Acceptance Criteria
- [ ] Given {precondition}, when {action}, then {expected outcome}
- [ ] Given {precondition}, when {action}, then {expected outcome}

### Domain Tags
{frontend, backend, devops, devex, qa — as identified}

### Open Questions
- {anything still unresolved, or "None"}
```

**Before presenting**, run a silent INVEST validation:
- **I**ndependent — Can this be built without coupling to unrelated work?
- **N**egotiable — Is the "how" flexible, or is the user prescribing implementation?
- **V**aluable — Does the Why clearly justify the work?
- **E**stimable — Is there enough detail to size tasks?
- **S**mall — Can this be completed in a reasonable number of sessions?
- **T**estable — Do the acceptance criteria have clear pass/fail conditions?

If any INVEST criterion fails, ask one targeted question to resolve it before presenting the summary.

After presenting, ask:

> "Does this capture your intent? Anything to add or change before I proceed to task planning?"

## Anti-Patterns

- **Never ask more than one question per turn** — batching reduces answer quality
- **Never suggest implementation during elicitation** — keep "what" separate from "how to build it"
- **Cap at ~10 turns total** before producing a draft — avoid over-elicitation fatigue
- **Don't re-ask answered axes** — if the framing response covers Why, skip it
- **Don't lead the witness** — ask "What should happen?" not "Should it use a REST API?"
- **Don't add requirements the user didn't mention** — elicit, don't invent

## Output Handoff

The requirements summary feeds directly into the task template:
- **Why** → Task `Objective` section
- **5W1H answers** → Task `Context` section
- **In Scope** → Task `Scope.Owns` (refined during planning)
- **Out of Scope** → Task `Constraints` + `Scope.Owns` exclusions
- **Acceptance Criteria** → Task `Acceptance Criteria.Automated`
- **MoSCoW Must** → `priority: high`; Should → `priority: medium`; Could → `priority: low`
- **Domain Tags** → Task `tags` (drives agent assignment)
- **Open Questions** → Flagged as risks in task files
