# Product direction and technical roadmap

## Status

This document describes the intended overhaul of Logbook. It is a roadmap, not a description of the current implementation. Items are considered implemented only when code, tests, and documentation for them exist in the repository.

## Product objective

Logbook should become a full-stack training intelligence system that records enough context to answer three practical questions:

1. What did I actually do?
2. Am I progressing and recovering at an appropriate rate?
3. What should I change next, and what evidence supports that recommendation?

The application should reduce reliance on memory, make workout execution repeatable, and keep its conclusions traceable to logged data. It is not intended to diagnose medical conditions or replace a qualified coach or clinician.

## Target capabilities

### Training record

- Exercises, sets, repetitions, load, RIR/RPE, tempo, range of motion, rest time, warm-ups, and session duration
- Machine identity and settings: seat, backrest, pin position, handles, cable height, attachments, and user notes
- Exercise variants and equipment profiles so differently configured movements are not incorrectly compared
- Planned versus completed work, skipped sets, substitutions, and reasons for deviations
- Body weight, circumference measurements, and optional progress media
- Data provenance for every measurement: manual entry, imported file, wearable, calculated value, or AI-extracted value
- Units, timestamps, timezone, edit history, and confidence/quality flags

### Lifestyle and recovery record

- Sleep duration and subjective sleep quality
- Calories and macronutrients, with explicit distinction between measured, imported, and estimated values
- Steps and optional wearable activity data
- Stress, soreness, pain/discomfort, motivation, illness, and schedule disruptions
- Habit completion and user-defined daily targets

### Deterministic analytics

The first analytics engine should be rules-and-formulas based, versioned, and independently testable. AI must not calculate or silently alter canonical metrics.

- Volume: set count, repetition count, and volume load (`sets × reps × load` where meaningful)
- Effective-set counts based on configurable RIR/RPE and rep-range criteria
- Intensity: absolute load, relative load where an estimated or tested maximum exists, RPE/RIR distribution, and proximity to failure
- Progression: changes in load, repetitions, estimated 1RM, work capacity, execution quality, and rep/load PRs
- Frequency and adherence by movement and muscle group
- Planned-versus-completed compliance and consistency trends
- Acute and rolling workload summaries
- Recovery/readiness trend using training and lifestyle inputs
- Plateau, abrupt workload change, repeated target misses, possible under-training, and possible overreaching flags
- Energy-intake tracking presented as an accounting analogy: observed intake and weight trend, not a claim of exact calorie expenditure

“Over-training” cannot be established reliably from workout logs alone. The product should report evidence-based risk signals such as sustained performance decline, elevated perceived effort, worsening recovery markers, and abrupt workload changes. It should label uncertainty and recommend professional assessment when appropriate. “Under-training” should likewise be expressed as a configurable signal—such as insufficient frequency, volume, effort, or progression—not as a medical conclusion.

Every computed result should store or expose:

- metric name and version
- inputs and time window
- formula or rule used
- missing-data and confidence indicators
- generated timestamp

## Proposed system architecture

```text
Web/mobile client
       |
Versioned HTTP API
       |
Application services ───── background jobs
       |                         |
PostgreSQL + vector index   imports / analytics / embeddings
       |                         |
Deterministic metric engine ─ AI orchestration layer
                                  |
                     tool calls + retrieval + model provider
```

### Selected initial stack

- Frontend: TypeScript and a component-based web framework, selected during the first architecture decision record
- Backend: Python with FastAPI and typed validation
- Database: PostgreSQL
- Vector retrieval: PostgreSQL with `pgvector` initially, avoiding a separate vector database until scale requires one
- Background processing: a durable job queue added when imports, embeddings, or recalculation no longer fit request/response execution
- API contract: OpenAPI generated from backend schemas
- Local development: containerized application and database

Python is the selected backend language because the roadmap emphasizes analytics, data processing, retrieval, and possible machine-learning experiments. The initial system will remain a modular monolith rather than introducing another backend language for practice alone.

Go or Rust may be explored later in an isolated component only when there is a measured reason—such as a CPU-bound parser, high-throughput ingestion path, or constrained deployment target—and after benchmarking it against the Python implementation. Any such addition requires an architecture decision record covering the operational cost, interface boundary, testing strategy, and demonstrated benefit.

The existing browser application should remain usable while the new backend is built. Data export/import becomes the migration boundary rather than requiring a risky all-at-once rewrite.

## Core data model

The normalized model is expected to include:

- `users`, `sessions`, and revocable authentication sessions
- `workouts`, `workout_exercises`, and `sets`
- `exercise_definitions`, `exercise_variants`, `equipment`, and `machine_settings`
- `programs`, `planned_workouts`, and `planned_sets`
- `body_measurements`, `nutrition_entries`, `recovery_entries`, and `habits`
- `wearable_connections`, `imports`, and immutable source records
- `metric_results`, `insights`, `assistant_threads`, and `assistant_messages`
- `documents`, `document_chunks`, and embeddings for retrieval
- audit events for important creation, edit, import, and deletion operations

Canonical workout and lifestyle facts belong in relational tables. Embeddings are indexes for retrieval, not the source of truth. Raw provider payloads should be retained separately from normalized records so parser changes can be replayed and audited.

## AI architecture

The assistant should combine two mechanisms rather than treating all questions as RAG:

1. **Structured tool access:** questions about volume, progression, adherence, recovery, or nutrition call typed analytics/query functions over canonical database records.
2. **Retrieval-augmented generation:** questions requiring unstructured context retrieve relevant user notes, prior assistant discussions, program documents, exercise guidance, and imported reference material.

The model may ask follow-up questions when information is missing—for example, whether a load is per hand, whether machine settings changed, or why planned work was skipped. Extracted facts must be shown for confirmation before becoming canonical data.

Each answer should include its evidence window, relevant records, metric versions, missing inputs, and uncertainty. Prompt text and vector similarity alone must never be used to produce authoritative numeric training metrics.

### Personalization and machine learning

The first useful system does not require training a custom model. It should begin with a general model constrained by tools, retrieval, structured outputs, and product-specific prompts. This gives the assistant access to more relevant personal context without claiming that the model itself has been trained on that user.

Machine-learning components should be introduced only after sufficient clean longitudinal data and outcome labels exist. Possible later experiments include:

- individualized readiness or performance forecasts
- anomaly detection in workload, recovery, and execution
- exercise-note classification and entity extraction
- personalized progression-response estimates

Any learned model requires a documented dataset, leakage-safe time-based evaluation, baseline comparison, calibration checks, model/version tracking, and a fallback to deterministic behavior. A model should not be shipped merely because it produces plausible text.

## Authentication, privacy, and safety

- Use a server-side identity system with secure, HTTP-only, same-site cookies or an established OAuth/OIDC provider
- Keep third-party refresh/access tokens encrypted on the server; never expose them to application JavaScript or persist them in browser storage
- Request the minimum provider scopes and support connection revocation and account deletion
- Separate users at every query and retrieval boundary; retrieval filters must be applied before semantic search results reach the model
- Treat workout, health, nutrition, and lifestyle records as sensitive personal data
- Encrypt transport, protect secrets through deployment configuration, rate-limit sensitive endpoints, and audit privileged actions
- Define retention, export, deletion, backup, and recovery behavior
- Defend assistant ingestion and retrieval against prompt injection and untrusted document content
- Distinguish training observations from medical advice and make pain/injury escalation behavior explicit

No direct Garmin Connect integration should be advertised until an authorized, documented API path is implemented and tested. File imports must identify their actual supported formats and never replace missing measurements with fabricated defaults.

## Testing and evaluation strategy

- Unit tests for formulas, parsers, normalization, authorization rules, and date/time behavior
- Property-based tests for metric invariants and import edge cases
- Mutation testing for the high-value metric and authorization modules
- Integration tests against a real ephemeral PostgreSQL instance
- API contract and migration tests
- Browser end-to-end tests for logging, planning, imports, authentication, and data export/deletion
- Golden datasets with hand-calculated expected training metrics
- AI evaluations for tool selection, citation correctness, unsupported-claim rate, missing-data behavior, prompt injection, and cross-user data isolation
- Observability for failed imports, analytics jobs, model calls, latency, cost, and user corrections

## Delivery phases

### Phase 0 — trustworthy baseline

- Keep documentation aligned with implemented behavior
- Add tests around current calculations, storage, and supported imports
- Define a versioned export schema and validate all imported data
- Remove remaining inline handlers and isolate domain logic from DOM code

### Phase 1 — full-stack foundation

- Record architecture decisions and select the frontend/backend stack
- Create authentication, PostgreSQL schema, migrations, and versioned API
- Migrate local records through the versioned export format
- Add authorization, audit events, backups, CI, and reproducible deployment

### Phase 2 — planning and analytics

- Implement programs and planned-versus-completed workouts
- Ship the deterministic metric engine with golden test fixtures
- Add machine settings, lifestyle/recovery data, habits, and data-quality indicators
- Present progression, adherence, workload, and recovery evidence without AI-generated calculations

### Phase 3 — assistant with structured tools

- Add assistant conversations and typed read-only analytics tools
- Make the assistant ask targeted questions and cite the records behind its answers
- Add explicit confirmation before AI-extracted facts are saved
- Establish evaluation datasets and safety/privacy tests before enabling write tools

### Phase 4 — retrieval and knowledge

- Ingest user-approved notes and reference documents
- Add chunking, embeddings, metadata filtering, citations, deletion, and re-indexing
- Evaluate retrieval relevance and cross-user isolation

### Phase 5 — validated personalization

- Collect explicit outcomes and user corrections
- Compare simple statistical baselines before training custom models
- Deploy only models that improve defined offline and prospective evaluation metrics

## Definition of done for a capability

A roadmap capability is complete only when:

- its behavior and limitations are documented
- authorization and privacy boundaries are defined
- domain logic has automated tests
- user-facing conclusions expose their source data and uncertainty
- imports and external APIs fail visibly rather than fabricating successful data
- deployment and rollback procedures exist for production changes

## Open architecture decisions

- TypeScript web framework and client state/query approach
- Criteria and measured thresholds that could justify a future Go or Rust component
- authentication provider versus self-hosted identity
- first supported wearable and nutrition providers with legitimate API access
- hosted-model, local-model, or hybrid inference strategy
- acceptable data residency, retention, model cost, and response-latency constraints
- objective definitions and user-configurable thresholds for effective volume, under-training, and overreaching signals
