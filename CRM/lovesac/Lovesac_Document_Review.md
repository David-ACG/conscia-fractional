# Lovesac × Conscia — Document Review & Critique

_David's pre-kickoff review of all project documents — March 2026_

---

## How to use this document

Each section covers one document. Structure is:

1. **What it says** — a short summary so we have a shared baseline
2. **What's good** — things that are solid and shouldn't be changed
3. **Gaps & concerns** — genuine problems, not nitpicks
4. **Questions to raise** — specific things to verify with Lovesac or Conscia

Severity tags: 🔴 Blocker — must resolve before building | 🟡 Risk — needs a decision soon | 🟢 Minor — worth fixing but not urgent

---

## Doc 1: Solution Design (`lovesac-solution-design.docx`)

_Prepared by Conscia — the primary technical reference for the engagement_

### What it says

A detailed design covering the DX Graph entity model (SKU Collection, Configuration Collection, up to 3 Taxonomy Collections), five DX Engine Orchestration Flows (Config Validation, Wizard Step Options, Config ID Creation, BOM Explosion, POS Channel), and seven open questions. Proposes a single unified SKU Collection for all 28k+ SKUs across Sactional, Sac, Snugg, and Accessories brands.

### What's good

- The decision to use a **single SKU Collection** for all brands (distinguished by the `Line` and `Brand` fields) is architecturally sound. It avoids join overhead and keeps the relationship model clean.
- The **Dynamic Relationship for COMPATIBLE_WITH** (matching on `Product` + `Sactional_Size`) is elegant — it automatically covers new SKUs without re-tagging. This is the right call given 15,506 Cover SKUs.
- The **separation of concerns** between DX Graph ("what is true?") and DX Engine ("what should happen?") is well articulated and should be used verbatim in the business sell deck.
- Flagging the **DX Engine write-back** for Config ID creation as an explicit API Connection (not native DX Engine write) is correct and shows platform knowledge — this would catch out someone less familiar with Conscia.
- The **BOM explosion** output shaping by channel (POS ring-up, OMS fulfilment, warehouse pick list) is a good detail that will resonate with Lovesac operationally.

### Gaps & concerns

🔴 **Open Question 7 (physical adjacency rules) has no owner and no deadline**
The document flags component-to-component adjacency rules as unresolved and provides two resolution paths (adjacency matrix or free-connect confirmation), but there is no owner assigned, no due date, and no consequence described if it isn't resolved. Given this blocks the second COMPATIBLE_WITH Relationship (1:M Lookup), it blocks a significant portion of real-time configuration validation. This needs to be the first agenda item at kickoff with a named owner at Lovesac and a date.

🔴 **Three source backends are unnamed**
Section 3.3 describes "up to three existing source systems" but does not name them. From context (the transcript, the Hierarchy doc, the Magento data) we can infer SAP (ERP/BOM), Magento/Adobe Commerce (ecommerce catalog), and possibly Threekits or NetSuite — but this is not stated. The transformation approach and timeline differ significantly depending on whether each source offers an API or only file exports. This must be confirmed at kickoff.

🟡 **The Configuration Collection transaction load concern is buried and then dropped**
Section 4.3 raises a valid architectural concern: at high order volumes, writing Configuration Records to DX Graph creates transactional load on what is primarily a governed data layer. It then says "evaluate post-POC." This is the right answer for now but it should be explicitly stated at kickoff so Lovesac understands this is not the final architecture for production scale. If their order volumes are high, this could be a significant rework.

🟡 **Quickship modelling assumption is fragile**
Open Question 6 asks whether Quickship is a product-type flag or a live inventory status. The design currently models it as a `Type` attribute (classification). If it's actually live inventory, the entire Channel-specific Experience Rule approach breaks — you'd need a real-time inventory API connector. This needs to be resolved before the DX Engine rules are built, not after.

🟡 **The Outdoor Platform restriction handling is a smell**
The design proposes enforcing the Outdoor restriction (100 Outdoor covers → Outdoor-fill inserts only) as an Experience Rule in DX Engine, keeping the Dynamic Relationship clean. Architecturally defensible, but it means there's compatibility logic split across two layers (DX Graph for Cover↔Insert by Product/Series, DX Engine for Outdoor platform). This should be documented explicitly as an intentional design decision with a rationale comment, otherwise a future engineer will try to consolidate it and break the model.

🟡 **Inactive/Discontinued SKU filtering is mentioned but not designed**
Section 6.5 of the compatibility rules document says these should be filtered "at query time in DX Engine Orchestration Flows, or alternatively as a field-level filter in the Dynamic Relationship definition." There's no decision made. This needs to be resolved — if an Inactive SKU is in a saved Config ID, what happens on BOM explosion? The OMS would reject it, but DX Engine wouldn't know to warn.

🟢 **The end-to-end flow diagram (Section 5) is a text table, not an actual diagram**
This will not land with a non-technical audience. It needs to be a proper visual. Use this as the first diagram to build — it's the clearest way to show the architecture and the DX Engine's role.

🟢 **No performance/latency targets stated**
The POS use case requires real-time validation. No SLAs or latency targets are stated anywhere. For a POS terminal in-store, 500ms is probably the ceiling. If DX Engine + DX Graph adds 2s, that's a problem. Conscia should confirm expected latency in the sandbox.

🟢 **Taxonomy Collections are modelled but not designed**
The document says "up to three Taxonomy Collections" but doesn't define what Level 1/2/3 looks like for any of them. The Hierarchy Review doc (see below) shows Lovesac hasn't finalised this internally. The dependency — DX Graph taxonomy modelling requires Lovesac's hierarchy to be settled first — should be called out explicitly as a sequencing dependency.

### Questions to raise at kickoff

1. Open Question 7: Who owns this at Lovesac? What is the deadline? (suggest April 3)
2. Name the three source backends and confirm: API or file export for each?
3. Confirm Quickship: classification flag or live inventory status?
4. What are Lovesac's expected POS call volumes and latency requirements?
5. Is the Config ID write-back to DX Graph acceptable long-term, or should we plan for OMS integration from day one?

---

## Doc 2: Compatibility Rules (`lovesac-compatibility-rules.docx`)

_Prepared by Conscia — AI-generated from 28,089 SKU analysis_

### What it says

Documents AI-derived compatibility rules for Cover↔Insert pairs across Sactional (6 Series and 5 Series), Sac (bean bags), and Snugg product lines. Key finding: a two-field Dynamic Relationship (`Product == Product AND Sactional_Size == Sactional_Size`) covers all 15,506 Cover SKUs automatically. Also identifies Cover-only components (no insert needed) and Insert-only components (StealthTech).

### What's good

- The **Dynamic Relationship recommendation is correct and well-argued**. The comparison against 1:M Lookup is clear enough to use directly in a Lovesac conversation.
- **StealthTech inserts are correctly identified as insert-only** (no paired cover). This is a subtle edge case that would cause silent data errors if missed.
- **Cover-only components are explicitly called out** with reasoning. This prevents DX Engine from attempting COMPATIBLE_WITH lookups on Reclining Seat Footrests, Piping pieces, etc.
- The **Sac and Snugg compatibility sections** show the analysis extended beyond Sactionals, which is good — the rules are simpler (Product match only, no series dimension) but they're documented.
- The **data volume reference table** (Section 6.6) is useful and should be cited when explaining scope to Lovesac.

### Gaps & concerns

🔴 **These rules have not been validated by Lovesac**
This is the single biggest risk in the entire project. The rules were AI-derived from the product data — which is a clever approach — but the data itself may be inconsistent. Sana said in the call: _"I hope it's not hallucinating."_ The rules need to go to Amelia's product team for sign-off before a single Relationship is built in DX Graph. Present them as: "We derived these from your data — please validate or correct."

🔴 **Component-to-component adjacency rules are entirely absent**
The document covers Cover↔Insert compatibility thoroughly but makes no attempt to derive component-to-component adjacency rules (which Seats can sit next to which Sides, deep/standard mixing, etc.). This is acknowledged, but it's the harder problem — and it's the one that causes real-world fulfillment errors (the scenario Sana described where a store associate takes a bad order). The DX Engine Config Validation flow is incomplete without it.

🟡 **5 Series fill types appear more limited than stated**
The 5 Series table shows only Standard Foam and Outdoor as fill types — no Lovesoft or Down Blend. But the Sactional Builder Guide (doc 5) doesn't explicitly list 5 Series vs 6 Series differences. If Lovesac is still selling 5 Series covers, customers may be confused if Lovesoft is unavailable for their generation. Confirm this is accurate — if so, the Experience Rule for fill options must check `Sactional_Size` before presenting fill options.

🟡 **Squattoman has multiple fill types including Polystyrene Beads**
The Squattoman is listed under Sac with Durafoam + Polystyrene Beads + Shredded Mattress Fiber + Standard Foam. This is the most complex fill-type mapping in the Sac line. Check whether the `Product == Product` Dynamic Relationship handles this correctly or whether the Squattoman needs an explicit filter.

🟡 **The Outdoor restriction is split — it must be documented as an architectural decision**
100 Outdoor Covers should only pair with Outdoor-fill Inserts. The compatibility rules document proposes handling this in DX Engine (Experience Rule) rather than DX Graph (Relationship definition). This is the right call but it creates a rule that lives in a different layer than all other compatibility rules. Whoever builds the DX Engine flows needs to be explicitly briefed on this — it won't be obvious from the DX Graph model alone.

🟢 **The Snugg section matches Insert by "Seat Set," "Back insert," "Beam insert" etc. — these need SKU mapping**
Section 5 describes structural components by description (e.g. "Matched by Seat Set insert") rather than by Product field values. If the Product field in the data uses different terminology, the Dynamic Relationship won't match. Verify the exact `Product` field values in the data against what's documented here.

🟢 **No validation methodology described**
The document says the rules were derived by "feeding in the 28k records" using Pandas analysis. There's no description of what validation was done — e.g. were random samples spot-checked? Were any anomalies found and discarded? A brief methodology note would strengthen confidence in the output, especially when presenting to Lovesac.

### Questions to raise at kickoff

1. Can Lovesac's product team review and sign off these rules by [date]? This is the critical path item for DX Graph relationship configuration.
2. Do the Snugg Product field values in the data match the descriptions in Section 5?
3. Confirm 5 Series: Lovesoft and Down Blend genuinely not available?
4. Can Lovesac confirm or deny that Squattoman fill type options are complete and accurate?

---

## Doc 3: Requirements Definition (`Requirements_Definition.docx`)

_Prepared by Lovesac — the contracted scope document_

### What it says

A brief bulleted list of deliverables: DX Graph provisioning, catalog modelling, up to 3 taxonomy versions, data ingestion from up to 3 backends, 2 marketplace feed updates, relationship building for compatibility. DX Engine POC: contextual rules, and four Orchestration Flows (Config Validation, Visual Configurator, Config ID creation, BOM explosion).

### What's good

- It's concise and unambiguous on counts (3 backends, 3 taxonomies, 2 feeds). These are contractual anchors.
- The four DX Engine flows are explicitly named, which means any scope creep can be pushed back against this list.

### Gaps & concerns

🔴 **This document is 200 words for a multi-month implementation**
It is far too thin to protect either party. There is no definition of "done" for any deliverable, no acceptance criteria, no performance requirements, and no description of what Lovesac is providing (data formats, API access, timely rule sign-off). If there's a dispute at the end of the project, this document settles nothing.

🟡 **"Build relationships between SKUs to support compatibility requirements" is dangerously vague**
What compatibility requirements? The adjacency rules don't exist yet. If Lovesac later claims the solution doesn't handle component-to-component adjacency, Conscia has no contractual protection — this line is broad enough to include it.

🟡 **DX Engine is called a "POC" in the requirements but Lovesac is treating this as the project**
Sana clarified in the call that DX Engine is being given free for a year as a POC. But from a requirements standpoint, there's no clarity on what success for the POC looks like, or what triggers the paid conversion. This should be documented somewhere.

🟢 **"Model product catalog within the DX Graph based on channel requirements"** — which channels?
Not named. POS and Lovesac.com are implied from context but not stated. The marketplace taxonomy (Google Shopping, ChatGPT) is the third channel but it's not explicitly listed here.

### Questions to raise

1. Can we extend this with acceptance criteria for each deliverable before the project kicks off? Even a half-page addendum would provide protection.
2. Get explicit agreement in writing that component adjacency rules are out of scope until Lovesac provides the rule definition.

---

## Doc 4: Kickoff Deck (`lovesackickoffpptxpdf.pdf`)

_Prepared by Conscia — 11 slides for today's (March 30) kickoff meeting_

### What it says

Covers agenda, why we're here (SKU complexity + 3 structural gaps), the solution (DX Graph + DX Engine), architecture, project scope, team/governance, open questions, and next steps. 12-week phased timeline (Weeks 1–3 foundation, 4–6 taxonomy, 7–10 DX Engine, 11–12 testing).

### What's good

- The **"What is true?" / "What should happen?"** separation is a clean talking point for a non-technical audience like Amelia.
- The **open questions slide** is explicit and will drive a useful conversation — good that it's in the deck rather than a separate document.
- The **next steps slide** has named owners and dates (April 3 deadlines for Lovesac, April 7 for Conscia). This is the right approach and it creates accountability immediately.
- The **team structure table** naming David as Solution Architect and Laurel as Solution Engineer gives Lovesac clarity on who to go to for what.

### Gaps & concerns

🟡 **The 12-week timeline has no dependency on open question resolution**
The Phase 1 timeline (Weeks 1–3: "Configure data ingest Jobs from 3 backends") assumes the three backends are known and accessible. But Open Question 1 asks which backends they are. If Lovesac takes two weeks to answer, the timeline slides by two weeks. There should be a note that the timeline is contingent on open questions being resolved by April 3.

🟡 **No Lovesac PM is named**
The team structure table has "Conscia PM: Morgan" and "Lovesac PM: —" blank. If there's no named PM on Lovesac's side, who approves deliverables? Who unblocks access issues? This should be filled in at kickoff and the blank should be flagged as an action.

🟡 **The architecture slide (slide 6) is text, not a diagram**
For an executive audience, a linear text stack of SOURCE BACKENDS → DX GRAPH → DX ENGINE → CHANNELS is not visually clear enough. This should be a proper architecture diagram (the one Sana referenced in the call needs to be added here, or a new one built). Worth updating before the meeting if time allows.

🟢 **Open Question 5 (Config ID format) may already be answered**
The solution design assumes Conscia generates the Config ID. If this is already agreed internally, this question can be pre-answered on the slide with "Conscia-generated unless Lovesac specifies format" to avoid wasting meeting time.

🟢 **The "agentic commerce" mention on slide 3 may confuse a non-technical audience**
Mentioning Google Shopping and ChatGPT as channels is great for strategic framing, but if Amelia doesn't understand what an "AI agent" is in this context, it could derail the meeting. Have a one-sentence plain-English explanation ready: "This means your product data could be discovered and purchased through AI assistants, not just your own website."

### Questions to raise

1. Get a Lovesac PM name on the team structure slide before or during kickoff.
2. Confirm: does Lovesac want to generate Config IDs in their own format, or is Conscia-generated fine?

---

## Doc 5: Product Hierarchy Review (`2026_03_12_New_Product_Hiearchy_Review.pdf`)

_Prepared by Lovesac — internal proposal for a new 3-level hierarchy_

### What it says

Lovesac's internal proposal to flatten their current 7-level product hierarchy to 3 levels. Current hierarchy: Brand → Platform → Line → Product Category → Product → Type → Fabric → Color. Proposed: 3 levels (exact definition still TBD — three alternative proposals shown). Known issues: the current structure has inconsistencies (PACF vs PACF JR on different levels, Sactionals cover components spread across two categories, Level 2 Indoor/Outdoor not actively used). The document's "Next Steps" include socialising with business areas, defining Level 1/2/3, and exploring PIM capability.

### What's good

- The **explicit acknowledgement that the current hierarchy has too many levels** is useful — this validates Conscia's approach and means Lovesac's own team has bought in to the simplification.
- The **best practices slide** (simplicity, intuitive, reflective of customer journey, scalable) is good framing for the conversation about DX Graph taxonomy design.
- **Fabric and Color becoming attributes rather than hierarchy levels** is exactly what the solution design assumes, and it's good to see Lovesac has proposed this internally.

### Gaps & concerns

🔴 **The hierarchy is not finalised — three competing proposals are still on the table**
This is a genuine blocker for DX Graph Taxonomy Collection modelling. The solution design says "up to three Taxonomy Collections" but doesn't define what Level 1/2/3 looks like. Until Lovesac picks one of the three hierarchy proposals, or defines a fourth, the taxonomy modelling cannot start. This has to be resolved before Week 4 of the project.

🔴 **Unresolved classification edge cases will cause data loading problems**
Slide 15 lists open issues that aren't resolved:

- Is a Sactional Recliner under Sactionals or Recliners?
- Is Squattoman a Sac or an Ottoman?
- Are Feet and Clamps part of Furniture, Operations, or Spare Parts?
  These ambiguities mean someone loading data into DX Graph will have to make a call. If they make the wrong call, the taxonomy will be wrong. Lovesac needs to resolve these before the data loading Job is configured.

🟡 **"Operations / Misc" as a category (Boxes, Desiccants, Instruction Manuals, Demo Blocks) shouldn't be in the customer-facing taxonomy**
The hierarchy proposal includes operational items that are clearly internal only. These shouldn't appear in the Lovesac.com or Google Shopping taxonomies. The three-taxonomy approach (Internal, Lovesac.com, Marketplace) handles this correctly in the solution design — but it needs to be made explicit to Lovesac's team that the taxonomy design differs by channel.

🟡 **Winifred's hierarchy variant (slide 14) adds Bedding — is this in scope?**
A slide titled "Proposed New Product Hierarchy w/ Winifred" adds Beds, Mattresses, Sheets, Cubbies, and Blankets. If Lovesac is planning to expand into bedding, this affects the taxonomy design. Is this future roadmap or current scope?

🟢 **The "Product Master Data Vision" slides (16–20) are largely blank in the text extraction**
These slides appear to contain diagrams or visual content that didn't extract as text. Worth reviewing the actual JPEG slides to understand what Lovesac's vision looks like — it may contain useful framing for the sell deck.

### Questions to raise at kickoff

1. Which of the three hierarchy proposals (A, B, or C) is being adopted, or is a new one needed?
2. Resolve the edge cases: Recliner under Sactionals or Recliners? Squattoman — Sac or Ottoman?
3. Is the bedding category (Winifred slide) in scope for Phase 1 taxonomy modelling?
4. When does Lovesac expect to finalise the hierarchy? This blocks Taxonomy Collection design.

---

## Doc 6: Target Architecture (`2026_03_12_Lovesac_Target_Architecture.jpg`)

_Prepared by Lovesac — a visual diagram of their desired future state_

### What it says

A JPEG image (1148×644) — not readable as text. Based on context from the transcript and other documents, this shows Lovesac's desired omnichannel architecture with DX Graph and DX Engine in the data layer, feeding POS, Lovesac.com, OMS, and marketplace channels. This was the document Sana referenced when she identified the compatibility gap — "I looked at their target architecture and I saw a big gap."

### Gaps & concerns

🟡 **I cannot fully analyse this without viewing the actual image**
The JPEG needs to be reviewed visually. Key things to check: Does it show three source backends (confirming which systems)? Does it show the DX Engine as a distinct layer or is it collapsed into DX Graph? Does it show any real-time POS call path? Are there systems shown that aren't mentioned in the solution design (e.g., a CDP, a CRM, or a pricing engine)?

🟡 **If the target architecture shows systems that aren't in the solution design, there's a scope gap**
The solution design was built partly from this document, but Sana acknowledged she may have missed things. Cross-referencing the two is important.

### Action

Review the JPEG directly and annotate any systems or flows shown that don't appear in the solution design.

---

## Doc 7: Sactional Builder Guide (`Lovesac_Sactional_Builder_Guide.docx`)

_Prepared by Conscia — documented from lovesac.com/sactionals/build_

### What it says

A complete walkthrough of the 8-step online Sactional configurator, covering all arm/back side styles, 25+ preset configurations, seat types, 175+ fabrics across 8 families, fill types, StealthTech add-ons, and accessories. Includes pricing reference and compatibility rules for side styles (which can be used as arm vs. back).

### What's good

- This is **gold for understanding the physical adjacency rules** that are missing from the compatibility rules document. The Side Style arm/back usage table (end of doc) tells us exactly:
  - Swept Arm and Roll Arm = arm only (cannot be used as back)
  - Deep Side and Deep Angled Side = back only (cannot be used as arm)
  - Standard and Angled Sides = dual purpose
  - StealthTech Charge Side = dual purpose
- **Reclining Seat requirements are documented explicitly**: "Must be placed next to a Sactionals Seat, Side, or AnyTable on both sides." This is a physical adjacency rule that _exists_ — it just hasn't been encoded in the DX Graph model yet.
- **Deep layout requirements are documented**: "Deep Seats require Deep Sides to properly align when using 3+ Deep Seats in a row." This is another adjacency constraint derivable from public information.

### Gaps & concerns

🔴 **The physical adjacency rules are here — they just haven't been put into the compatibility rules doc**
This is a significant finding. The Sactional Builder Guide contains clear arm/back usage constraints and deep/standard mixing constraints that directly answer parts of Open Question 7. Specifically:

- Swept Arm → cannot be a back side
- Roll Arm → cannot be a back side
- Deep Side → cannot be an arm side
- Deep Angled Side → cannot be an arm side
- Reclining Seat → must be adjacent to a Seat, Side, or AnyTable (not a free edge)
- Deep Seats + Deep Sides → required pairing when 3+ Deep Seats in a row

These should be drafted as proposed adjacency rules and presented to Lovesac for confirmation, rather than waiting for Lovesac to produce an adjacency matrix from scratch.

🟡 **Wedge Seat adjacency is underdefined**
The builder guide says: "The Wedge Seat creates a 45° turn — use 1 Wedge for each corner." This implies a Wedge Seat can only be placed at a corner, not in a straight run. But what components are valid adjacent to a Wedge? This is a constraint that probably exists but isn't documented here.

🟡 **Fill type options on the website don't fully match the compatibility rules doc**
The builder guide shows only two fill options for the online configurator: Standard Foam and Lovesoft. The compatibility rules document shows Down Blend and Outdoor as additional fill types for 6 Series. This is expected (the website is a simplified configurator) but it means the DX Graph model needs to handle fill types that the online builder doesn't expose — presumably for POS or custom orders.

🟢 **Accessories have compatibility constraints that aren't modelled**
The Power Hub "sits inside a Side insert" — so it's compatible with any Side. The Coaster is compatible with Standard Sides only; the Angled Side Coaster with Angled Sides only; the Roll Arm Drink Holder with Roll Arm Sides only. These are accessory-level compatibility rules. Are they in scope for the COMPATIBLE_WITH model, or out of scope for Phase 1?

🟢 **Pricing data here is current as of March 2026 but not maintained**
The pricing reference table is useful context but will go stale. Don't use it as a data source — pricing should come from SAP or the commerce engine directly.

### Action — this is immediately useful

Draft a proposed component adjacency rule table from this document and include it in the kickoff presentation. This demonstrates proactivity and may resolve Open Question 7 (or most of it) without waiting for Lovesac's product team.

---

## Doc 8: Conscia Platform Docs (`conscia.pdf` + `consciabff.pdf`)

_Prepared by Conscia/FractionalBuddy — SA reference material_

### What they say

The conscia.pdf is a platform research reference covering DX Engine (Components, Flows, Channels, Context, Experience Rules, Universal API Connector, etc.) and DX Graph (semantic knowledge base, vector index, RAG, data sync). The consciabff.pdf is a step-by-step BFF implementation playbook covering all phases from environment setup through to CI/CD and monitoring.

### What's good

- The **Day 1 checklist** (sandbox tenant, System API token, customer code, environment codes, docs access) is immediately actionable — this is what needs to be requested from Conscia before the environment is provisioned.
- The **"what happens where" table** (Conscia UI vs Claude Code vs both) is a useful working agreement to share with Laurel.
- The **caching TTL guidance table** is practical — use it when designing the DX Engine flows.
- The **pitfalls section** has genuinely useful warnings: especially "building logic in the frontend that belongs in DX Engine" and "not scoping context correctly." Both are real risks on this project.
- **Context schema definition** should happen early — channel, locale, customer ID, device type, and navigation path as baseline fields. This needs to be defined for POS and Lovesac.com before the flows are built.

### Gaps & concerns

🟡 **The BFF playbook assumes a commerce/content BFF, not a product compatibility engine**
The playbook is built around standard BFF patterns: PDP, PLP, cart, checkout. The Lovesac use case is unusual — it's primarily a configuration validation and BOM explosion engine, not a content aggregator. Some of the standard patterns (caching product catalogue data, merging with real-time pricing) apply, but the playbook doesn't cover the DX Graph-as-rules-engine pattern that this project requires. We're somewhat in uncharted territory for the BFF doc.

🟡 **DX Graph is described primarily as "AI-native semantic knowledge base" in the overview doc but that's not how it's being used here**
The Conscia research doc emphasises DX Graph for RAG, vector search, and conversational agents. For Lovesac, DX Graph is being used as a product graph with explicit relationship types. This is a valid use of the platform but the documentation framing may confuse Laurel if she reads it expecting the AI-agent use case. The relevant sections are: Collections, Relationships, Taxonomies, and Data Sync — not the RAG/vector search sections.

🟢 **The preserveSecrets=true flag on environment export/import is a critical operational note**
Call this out explicitly when setting up the CI/CD pipeline — it's easy to miss and would overwrite production credentials.

🟢 **No mention of DX Graph API rate limits or write throughput**
When Config ID creation writes back to DX Graph via the REST API (Section 4.3 of solution design), what are the write throughput limits? At POS scale (many simultaneous in-store sessions during peak hours), this could be a bottleneck. Ask Conscia in the first technical session.

---

## Cross-document issues

### 🔴 The physical adjacency rules exist in Doc 7 but are missing from Doc 2

The Sactional Builder Guide contains documented arm/back constraints and deep/standard mixing rules. These need to be extracted, formatted as a proposed adjacency rule set, and presented to Lovesac for confirmation. This partially resolves Open Question 7 without waiting for Lovesac to produce something from scratch.

### 🔴 The hierarchy (Doc 5) must be resolved before taxonomy modelling (Doc 1 Section 3.1)

The solution design assumes three Taxonomy Collections but cannot define their structure until Lovesac picks a hierarchy proposal. This dependency isn't called out in either document.

### 🟡 Lovesac's internal product line boundaries are ambiguous

Doc 5 (hierarchy) and Doc 7 (builder) show different facets of the product catalogue. The hierarchy includes "Operations/Misc" items (Boxes, Desiccants) and potential future bedding. The builder shows only the consumer-facing Sactional. The DX Graph SKU Collection needs to handle all of these, but the scoping is unclear. Clarify: is the DX Graph SKU Collection the _entire_ Lovesac item master (all 28k+ SKUs including operations items), or only the customer-facing configurable products?

### 🟡 StealthTech modelling needs cross-document consistency

In Doc 2 (compatibility rules), StealthTech components are described as Insert-only records with no paired cover. In Doc 7 (builder), StealthTech Charge Sides are listed as compatible with both arm and back positions. These aren't contradictory — the cover is the physical Side piece already in the configuration, and the StealthTech component replaces the standard Side insert. But this needs to be explicitly modelled: when a customer selects a StealthTech Charge Side, the COMPATIBLE_WITH query for that position should return the StealthTech insert, not the standard foam insert. The solution design doesn't cover this explicitly.

### 🟢 Pricing is inconsistent across documents

Doc 7 (builder) has a pricing table (Standard Seat $510, Lovesoft upgrade +$250, etc.). Doc 1 (solution design) says pricing is out of scope for Phase 1. The compatibility rules doc doesn't mention pricing. This is fine but the builder pricing data should not be used as a data source — it's informational only.

---

## Proposed adjacency rules table (derived from Doc 7)

_To be presented to Lovesac at kickoff as a proposed resolution to Open Question 6/7_

| Component Type          | Valid as Arm? | Valid as Back? | Notes                                                    |
| ----------------------- | ------------- | -------------- | -------------------------------------------------------- |
| Standard Side           | Yes           | Yes            | Most versatile — dual purpose                            |
| Angled Side             | Yes           | Yes            | Contemporary; slight recline as back                     |
| Swept Arm Side          | Yes           | No             | Arm only — shorter profile                               |
| Roll Arm Side           | Yes           | No             | Arm only — curved, traditional                           |
| Deep Side               | No            | Yes            | Back only — required with 3+ Deep Seats in a row         |
| Deep Angled Side        | No            | Yes            | Back only — Deep Seat configurations                     |
| StealthTech Charge Side | Yes           | Yes            | With wireless charging; $575                             |
| Reclining Seat          | n/a           | n/a            | Must be flanked by Seat, Side, or AnyTable on both sides |
| Wedge Seat              | n/a           | n/a            | Corner position only; creates 45° turn                   |
| Deep Seat               | n/a           | n/a            | Requires Deep Sides when 3+ in a row                     |

**Proposed as Open Question 7 resolution** — present this to Lovesac's product team and ask: "Is this complete and accurate? Are there any additional constraints we're missing?"

---

## Priority action list (for David, pre-kickoff)

| #   | Action                                                                                                        | Time needed |
| --- | ------------------------------------------------------------------------------------------------------------- | ----------- |
| 1   | View the target architecture JPEG and annotate any systems not in the solution design                         | 30 min      |
| 2   | Draft the proposed adjacency rules table (above) as a slide or handout for kickoff                            | 1 hour      |
| 3   | Prepare a one-page "what we need from you by April 3" list for Amelia's team                                  | 30 min      |
| 4   | Flag to Sana: the hierarchy must be resolved before Week 4 — raise this at kickoff                            | 15 min      |
| 5   | Build the architecture diagram that's missing from both the solution design and the kickoff deck              | 1–2 hours   |
| 6   | Read the Conscia BFF playbook sections on Context schema and caching — these define early technical decisions | 1 hour      |
