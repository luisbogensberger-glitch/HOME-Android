# V-Brain product contract

This file is the durable regression contract for V-Brain. It describes what the product must preserve while the implementation and personal interface evolve. It is **not** a request to redesign everything on every run. A working capability should remain untouched unless evidence shows a real defect or a better change is justified.

## 1. Product identity

V-Brain is a persistent, self-optimising personal digital brain / life operating system rather than a static task app. It is the personal Android project formerly called HOME and must remain separate from unrelated projects such as Veqrya.

Its long-term loop is:

`observe -> form a hypothesis -> adapt -> measure -> keep, improve or revert`

The model may become increasingly complex over months; the visible interface should remain calm enough to use every day.

## 2. Non-negotiable runtime rules

- **Local first.** Calendar, To-Dos, Tube state, Brain state and Gym history must remain usable when remote services fail.
- **One visual owner.** Do not revive competing historical patch/loader/personalizer layers alongside One UI.
- **Verified live updates.** Generic code changes use the verified live release path and rollback if unhealthy. Personal adaptations use the private command path.
- **No destructive simplification.** A fix must not solve one problem by deleting a working capability or accumulated user state.
- **No draft interruption.** Do not reload or replace a surface while the user is actively typing or completing an interaction.
- **Persistent updates.** An APK/live release must preserve tasks, notes, learning attempts, Brain branches, Gym history and accepted personal settings instead of treating a release as a fresh install.
- **Recovery without clutter.** Last-known-good state and recovery are reliability features; large technical backup/recovery controls should not dominate the everyday UI.

## 3. Home surface and daily guidance

The current core Home areas are Calendar, To-Dos, Tube Learning and Gym. Preserve the user's manual card order. Personal modules may augment the surface only when supported by evidence; they must not replace the four core routes.

The visual direction is restrained, premium, dark and mobile-first. The underlying Brain can be complicated without turning Home into a dense analytics dashboard.

When evidence makes it useful, the morning experience should quickly surface today's relevant commitments, actions and learning priorities without requiring a manual planning ritual.

## 4. Living Brain

The Behaviour Brain is a persistent graph, not a disposable daily summary.

- New goals, traits, knowledge areas, habits and relationships may create new branches.
- Stored branches and links must not be deleted merely because they are not currently rendered.
- Rendering may show a bounded subset for performance while persistence retains the larger graph.
- Traits should expose confidence, evidence counts and useful reasons where possible.
- Conversation-derived goals/preferences are context, not behavioural proof. Confidence should increasingly reflect observed app behaviour and real outcomes.
- Prompt errors, delivery tests and explicit system tests must not be misinterpreted as low ability or poor behaviour.

## 5. Evidence V-Brain should learn from

Use evidence that the app actually captured and successfully synchronized, including:

- screen visits and dwell;
- card/module impressions and actual opens;
- completions, restores and ignored exposures;
- foreground/background use and useful interaction timing;
- scroll-depth or equivalent content-consumption evidence when it materially improves inference;
- task creation, completion and contextual notes;
- Tube choices, quiz results, one-sentence reflections and valid semantic reviews;
- genuine Gym completions versus abandoned starts;
- manual card rearrangements and reminder responses.

Free text is private high-value evidence. Raw notes, messages and reflections must never be copied into public GitHub files, issues or logs. Generic telemetry should not record sensitive text merely to increase event volume.

## 6. To-Dos

To-Dos are local-first and deduplicated. Each task may expand into useful context, notes, links, tips or an outcome. Completed tasks move out of the active list while history remains recoverable.

V-Brain may create or enrich a task from real external evidence only when there is a concrete action, deadline, promised follow-up or clearly relevant commitment. Newsletters, generic FYI mail and ordinary conversation should not become tasks. Never invent task completion.

## 7. Tube Learning

Tube is a finite high-quality learning feed, not an infinite entertainment feed. Completed cards should be replaced, and cards that remain persistently ignored may be refreshed after a reasonable stale period rather than accumulating forever.

A completed learning loop should support:

1. a useful card with appropriate provenance;
2. a card-specific knowledge check;
3. a direct selection interaction;
4. a one-sentence recall/application/critique prompt;
5. persistent attempt storage;
6. semantic feedback;
7. longitudinal learning evidence.

Questions must be grounded in the specific card. Generic prompts that do not match the material are a product defect. Explicit prompt complaints or delivery tests are not learner-performance evidence.

Semantic reviews should distinguish understanding, application, precision, depth and task fulfilment, and should carry an `assessmentValid` signal when the row is suitable for ability inference.

## 8. Calendar

Calendar stays visually simple but gives V-Brain timing context. It should help answer what matters today and improve reminder/task timing. Calendar events should not automatically become duplicate To-Dos.

Future punctuality or movement inference may use location/movement only after explicit native permission integration. Never pretend precise-location evidence exists without that path.

## 9. Gym

Gym is one dimension of development. Only genuine completed sessions should count toward score or behavioural inference. Accidental starts and abandoned sessions are useful process evidence but not completed training.

## 10. Multidimensional development and score

V-Brain may support learning, follow-through, communication, fitness, study, entrepreneurship and other user-defined development goals. Do not optimise the entire system for task throughput alone.

The V Score / daily score should motivate without pretending that productivity is one-dimensional. It may use action, learning, movement and balance, must remain comparable over time, and should be explainable rather than a decorative number.

## 11. Notifications and nudges

Reminders should be sparse, evidence-based and respectful of quiet hours. Learn from delivery, opening, snoozing and suppression. Do not use shame, false urgency or repeated identical prompts after they fail.

## 12. External context

When explicitly available and authorized, V-Brain may use private signals from Gmail, WhatsApp/WhatsApp Business, Calendar and relevant connected context. Notification snippets are incomplete evidence and should be treated conservatively.

Connector access in ChatGPT is not the same thing as access inside the Android app. Never claim a source is live until the relevant path is verified.

Notion is not a product dependency. Historical method names may remain for compatibility if harmless, but the user experience and architecture must not require Notion.

## 13. Personal live adaptation

Personal interface changes should be evidence-driven.

- A temporary candidate uses `liveUi.experiment` with a finite expiry.
- A change that proves useful across adequate exposure may be promoted to `liveUi.baseline`.
- An accepted baseline persists until better evidence supports another change; it must not silently disappear after a short trial window.
- Keep a private longitudinal decision journal with hypothesis, aggregate evidence, success guardrails, activation acknowledgement and outcome.
- Do not churn the UI based on one hour or one session.
- New UI elements may deliberately create better interaction evidence when that added friction has a clear learning value, but data collection alone is not a reason to make the app annoying.

## 14. Persistence and recovery

Durable state includes at least active/completed To-Dos, task notes/details, Tube attempts and semantic reviews, learning progress, Brain nodes/links/context, behavioural history needed for adaptation, Gym history, card ordering and accepted personal UI state.

A render/view limit must never be implemented by deleting durable Brain state. A visible archive expiry must not silently destroy recoverable history.

## 15. Privacy and safety boundaries

- Public repository: generic code, tests, schemas and non-personal product rules only.
- Private backend: personal task context, learning reflections, message-derived context and Brain context.
- Do not collect credentials, passwords, PINs, OTPs or other authentication secrets as behavioural data.
- Do not loosen authentication/RLS or expose service credentials to the client to make adaptation easier.

## 16. Definition of a successful change

A change is complete only when the relevant layer is verified:

- code publication is not phone activation;
- a queued device command is not delivery;
- delivery acknowledgement is not UI rendering;
- UI rendering is not improved behaviour;
- a learning completion is not a semantic review;
- a Gym start is not a completed workout.

For generic code changes, pass the existing release verification and browser/Android smoke tests before publishing. For private personal adaptations, verify device and UI acknowledgements before marking the decision active.

## 17. Long-term direction

The personal V-Brain comes first. Multi-user productisation, interchangeable AI providers and broader integrations are future extensions. A future multi-user design must isolate each person's Brain, goals, tasks, learning history and credentials. These future goals must not destabilise the current personal system or force the product into a generic lowest-common-denominator interface.
