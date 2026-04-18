# Threekit vs Conscia — Weaknesses & Integration Approach

*Internal analysis · Lovesac engagement · April 2026*

---

## 1. What Threekit actually is

Threekit positions itself as a **3D Visual Product Configurator** with an attached rules engine, virtual photographer, and (more recently) an "AI Visual Configurator" / "AI Guided Selling" agent layer. Its centre of gravity is the **front-end visual experience**: photoreal 3D rendering, AR, real-time visualisation as buyers tweak materials/dimensions, and a no-code editor for 3D artists and product teams to wire up attribute-driven scenes.

Lovesac is already a marquee customer — the Threekit website even quotes Lovesac directly on how 3D brought Sactionals to life on lovesac.com. So this is not a question of "is Threekit bad" — it's clearly doing its job as a visualiser. The question is whether Threekit is the right system to be the **source of truth for compatibility logic across every channel**, which is what the Conscia engagement is fundamentally about.

It is not.

---

## 2. Threekit's structural weaknesses (relative to what Lovesac needs)

### 2.1 Rules live inside the visualiser, not in a governed data layer

Threekit's rules engine is bound to the configurator runtime. Rules are authored against attributes of a Threekit asset/item and are evaluated client-side (or via Threekit's player) to refine UI options, swap meshes, hide attribute values, etc. This is exactly what Sana found when she pushed Lovesac on where compatibility logic actually lived: nobody on the Lovesac side could produce a rules document, because the rules are **hard-coded inside Threekit's front-end**. Even Threekit's own community docs note that simple configurations don't need rules at all and that custom scripts attached to rule actions don't always execute predictably (e.g. they're skipped during static publish initial loads unless moved onto a stage).

The consequence: rules are invisible to every other system. POS can't see them. NetSuite can't see them. AgentForce, Google Shopping, ChatGPT — none of them can ask "is this configuration valid?" because the only thing that knows is the JavaScript running inside the Sactional Builder on lovesac.com.

### 2.2 Front-end-shaped, not channel-agnostic

Threekit is built around the assumption that there is **a configurator**, singular, and customers interact with it visually. When the channel is a 3D web player on lovesac.com, that's a perfect fit. When the channel is:

- A Salesforce Retail Cloud POS terminal where an associate needs to validate a sofa configuration in <500ms,
- A ChatGPT plugin asking "what 5-Series covers fit my existing inserts?",
- A Google Shopping feed that needs every valid SKU bundle expanded out,
- An AgentForce agent doing guided selling,

…the Threekit player isn't the right shape. Threekit does have REST APIs and a developer portal, and you *can* drive configurations programmatically, but you're still going through a configurator-runtime abstraction designed to feed a visual player. You're not querying a graph; you're asking a visualiser to validate itself.

### 2.3 No semantic relationships between SKUs

Threekit models products as **assets with attributes**. There is no first-class concept of `COMPATIBLE_WITH`, `BUNDLES`, `CONTAINS`, `MAPS_TO` as queryable relationships independent of any one configurator. Compatibility is expressed *implicitly* via rule conditions on attribute selections within a given item.

Compare with what we found in the Lovesac data: Cover ↔ Insert compatibility across 15,506 Cover SKUs and 151 Insert SKUs reduces to a two-field match — Cover.Product == Insert.Product AND Cover.Sactional_Size == Insert.Sactional_Size — which DX Graph can model as a Dynamic Relationship with no row-by-row tagging. In Threekit you'd encode that as N attribute rules per item; in DX Graph it's one relationship definition.

### 2.4 No BOM explosion path to OMS

Threekit can output a "configured product" — typically a configuration ID plus attribute payload — and hand it off to a CPQ/ERP via integration. What it does **not** do well is the pattern Lovesac actually needs: a stored Config ID that can later be re-resolved to a channel-shaped Bill of Materials and pushed into Manhattan Active Omni for fulfilment. That's because the BOM explosion needs traversal of `CONTAINS` relationships across the SKU graph, plus channel-specific filtering (Quickship, Outdoor, region) — which is graph + rules orchestration, not 3D rendering.

### 2.5 Single-source-of-truth problem

If Threekit holds the rules and lovesac.com works fine, what happens when:

- Lovesac launches a new fabric and adds it to NetSuite → does Threekit pick it up automatically, or does someone have to re-publish a configurator?
- A retail associate quotes a Sactional in-store on the POS → are they bound by the same compatibility rules as the website, or can they sell a configuration the website would reject?
- An AI shopping agent (AgentForce, ChatGPT) needs to know "can I add a 6-Series Storage Seat to a 5-Series build?" → who answers that?

Today, the answer to all three is "Threekit, indirectly, by re-implementing the logic somewhere else." That's the **rule debt** problem the Conscia kickoff deck explicitly calls out — rules hardcoded across apps, cart-to-BOM mismatches, slower launches. It's the exact thing Sana identified as the gap when she first reviewed Lovesac's target architecture.

### 2.6 Visualiser pricing model and lock-in

Threekit's commercial model has historically been priced on configurator usage / leads / quotes. That's fine when the configurator is the only channel, but it scales awkwardly when you want compatibility logic to be queried by every channel hundreds of times per session. You don't want POS validation calls to be billed as Threekit "configurations."

### 2.7 The AI layer is bolted onto the visualiser

Threekit's newer "AI Guided Selling" / "AI Visual Configurator" positioning is real and compelling for B2B manufacturing — they've absorbed talent from BigMachines, Steelbrick, PROS — but architecturally it's still a layer sitting on top of the configurator. It is not a governed semantic layer that other AI agents (AgentForce, ChatGPT, Google Shopping's MCP-style agents) can query. For Lovesac's stated direction — agentic commerce as a first-class channel — that matters.

---

## 3. Where Conscia is structurally different

Quick recap, in plain terms, of what Conscia gives Lovesac that Threekit cannot:

| Concern | Threekit | Conscia (DX Graph + DX Engine) |
|---|---|---|
| Where rules live | Inside the configurator | Governed semantic layer queryable by anything |
| Compatibility model | Rule conditions per item | First-class graph relationships (`COMPATIBLE_WITH`, `BUNDLES`, `CONTAINS`, `MAPS_TO`) |
| Channels served | The Threekit player (+ feeds out) | POS, web, marketplace, AI agents — all from one source |
| Rule maintenance | Re-publish configurator | Dynamic relationships auto-update as catalogue grows |
| BOM explosion | Hand-off to CPQ/ERP | Native — `CONTAINS` traversal in DX Engine flow |
| AI agent fit | AI inside the configurator UX | Experience APIs callable by any agent, MCP-ready |
| Real-time POS validation | Not the use case it was built for | Exactly the use case (Config Validation flow, sub-500ms target) |

The key sentence to internalise (and to use with Emilia and Tate): **Threekit is a great visualiser. It is not a system of record for compatibility.** Conscia is not trying to replace Threekit as the visualiser — it's removing the burden of being the rules engine from a system that was never designed to be one.

---

## 4. How Conscia integrates with Threekit

The integration pattern is **invert the dependency**: today Threekit owns the rules and lovesac.com depends on Threekit for both rendering and validity. Tomorrow Threekit owns the rendering, and asks Conscia (via the DX Engine Experience API) for "what's valid here, and what's available next?"

There are three realistic integration shapes, in increasing order of ambition. For the POC and the first production phase, only the first is in scope; the others are future-state.

### 4.1 Phase 1 — Conscia behind, Threekit in front (loose coupling)

The simplest integration. Threekit continues to render the Sactional Builder on lovesac.com exactly as it does today. Behind the scenes:

1. **Catalogue ingestion remains unchanged on the Threekit side** — Threekit keeps getting whatever it gets from NetSuite/Celigo today for its asset library.
2. **Conscia ingests the same NetSuite/Celigo source data** into DX Graph as the governed semantic layer. The DX Graph SKU Collection becomes the canonical compatibility source.
3. **A rules-export workstream** runs in parallel: Lovesac (or we, by inference) extract Threekit's hard-coded rules, validate them against the AI-derived rules Sana already produced from the 28k-record dataset, reconcile, and load the canonical set into DX Graph as `COMPATIBLE_WITH` relationships.
4. **Threekit continues to enforce its rules client-side** for the visual builder — no change to the lovesac.com UX, no risk of breaking the existing buyer journey.
5. **POS, marketplaces, and agentic channels go directly to DX Engine** — they never touch Threekit. This is where Conscia's value lands first, because today these channels have no answer at all.

This is the lowest-risk path and matches what's already in the kickoff deck's scope. Threekit isn't displaced; Conscia just stops the bleeding everywhere Threekit doesn't reach.

### 4.2 Phase 2 — Threekit calls Conscia for rule decisions (tight coupling)

Once DX Graph is the validated source of truth and parity with Threekit's hardcoded rules has been demonstrated, the next step is to **make Threekit ask Conscia** rather than enforce its own copy.

Mechanically this works through Threekit's rules system and REST API:

- **Custom rule actions / scripts in Threekit** call out to a DX Engine Experience API endpoint (e.g. `/wizard-step-options`) with the current configuration state. The endpoint returns the valid next-step options, and the Threekit rule uses the response to enable/disable attribute values in the player.
- **The Configuration Validation flow** is called when the user clicks "Add to cart" — DX Engine returns pass/fail with structured error detail, and Threekit either commits the config or surfaces the error.
- **The Config ID Creation flow** is called to persist the final configuration in DX Graph; Threekit hands the resulting Config ID to Adobe Commerce / NetSuite as the canonical reference instead of its own internal config ID.
- **Latency is the hard constraint** here — Threekit's player is interactive, so each call needs to come back fast. Sub-300ms for wizard step options is the practical ceiling. This is why the DX Engine sandbox latency check is on the kickoff questions list.

Functionally this means Threekit becomes a *thin client* of Conscia. The visual experience is unchanged for the buyer, but every decision about what's valid is made in DX Graph. Lovesac then has **one rule book**, enforced everywhere — and rule changes propagate in real time without re-publishing the configurator.

### 4.3 Phase 3 — Threekit as one rendering channel among many

The endgame, which is worth flagging at kickoff but not committing to. Once DX Engine is orchestrating compatibility, Config ID creation, and BOM explosion across all channels, Threekit becomes one of several **rendering surfaces** that consume the same Experience APIs:

- The lovesac.com 3D builder (Threekit player)
- The POS quote screen on Salesforce Retail Cloud
- AgentForce's guided-selling UX
- ChatGPT / Google Shopping agent surfaces via MCP

Each renders differently, but all derive their state from the same DX Engine flows. This is where the "Every Channel. One Truth." slide in the kickoff deck actually pays off, and where the Sactional becomes truly omnichannel-configurable rather than "configurable on the website and approximated everywhere else."

---

## 5. Technical integration mechanics — what we'd actually build

For the Phase 1 / Phase 2 integration with Threekit specifically, the concrete pieces are:

**On the Conscia side**
- Experience API endpoints already in the kickoff scope: Configuration Validation, Wizard Step Options, Config ID Creation, BOM Explosion. No additions needed for Threekit specifically — the existing flows are channel-agnostic by design.
- A Threekit-specific **response shape adapter** in the DX Engine flow, to return option lists in the attribute/value structure Threekit's rule scripts expect (so the integration on the Threekit side is a pasted snippet, not a transformation layer).
- Optional: a small **state-mapping helper** that translates Threekit's current configuration state into the SKU Record IDs that Conscia's flows take as Context.

**On the Threekit side**
- One or more **custom rule scripts** that call the Experience API endpoint. Threekit supports custom JS in rule actions, so this is the natural extension point.
- An **auth layer** — Threekit will need a service token to call Conscia. Standard API key in a header, stored in Threekit's secrets/config, not exposed client-side.
- A **fallback path** — if Conscia is unreachable or slow, the Threekit rule should fall back to its existing hardcoded behaviour rather than block the buyer. This is essential for production rollout and lets us de-risk by running Conscia in shadow mode first (logging what it would have decided, without enforcing it).

**Operationally**
- **Shadow-mode rollout** — for the first two weeks of Phase 2, log every Conscia decision alongside the Threekit decision and diff them. Any divergence is either a rule we missed or a rule Threekit got wrong; both are valuable findings.
- **Latency monitoring** — DX Engine flows hit by the Threekit player should be tagged separately in Datadog (the consciabff doc already covers the Datadog logger pattern) so we can spot regressions immediately.
- **Versioned rule sets** in DX Graph — so a Threekit deployment can pin to a known-good rule version and we don't accidentally break the website by updating a relationship.

---

## 6. Talking points for kickoff

If Emilia or Tate ask "does this replace Threekit?", the answer is **no** — and we should be ready with this framing:

1. **Threekit stays as the visualiser.** Nothing about the lovesac.com Sactional Builder UX changes in Phase 1. Customers will see exactly what they see today.
2. **Conscia takes the rules out of Threekit's basement** so they can be used by POS, marketplaces, and AI agents — channels Threekit was never designed to serve.
3. **In Phase 2, Threekit gets simpler, not removed.** The hardcoded rules can be retired in favour of API calls to a single source of truth, which means rule changes don't require re-publishing the configurator and rule debt stops accumulating.
4. **The risk during transition is parity.** We need to be able to prove that DX Graph's rules match Threekit's behaviour before we cut over. The shadow-mode approach handles this, and the AI-derived rules from the 28k SKU analysis are already an excellent starting point — we're not building from zero.
5. **Latency is the gating technical question.** Whatever the Threekit integration looks like, it has to feel as fast as the current player. This needs sandbox confirmation early.

There's also an open question worth raising internally: **does Lovesac have a contractual relationship with Threekit that constrains what we can change?** If Threekit is on a multi-year contract, the Phase 1 "behind the scenes" approach is the only viable starting point regardless of architectural ambition. Worth knowing before kickoff.

---

## 7. The honest weakness comparison, summarised in one line each

- **Rules visibility**: Threekit hides them in the player; Conscia exposes them as queryable graph relationships.
- **Channel reach**: Threekit serves the configurator; Conscia serves every channel from the same source.
- **Real-time validation**: Threekit validates inside its own UX; Conscia validates over an API any system can call.
- **BOM explosion**: Threekit hands off to a CPQ; Conscia resolves it natively via `CONTAINS` traversal.
- **AI/agent readiness**: Threekit's AI lives inside the configurator; Conscia's flows are MCP-ready and channel-agnostic.
- **Rule maintenance**: Threekit needs re-publishing; DX Graph dynamic relationships update automatically as new SKUs land.
- **Lock-in risk**: Threekit owns both the rendering and the logic; Conscia separates them so each can evolve (or be replaced) independently.

Threekit's strength — and it is a real strength — is the visual experience and the artist tooling. Conscia isn't trying to compete on either of those, and the integration story should make that explicit. The two systems are complementary if Threekit is willing to give up being the rules engine, and the Phase 1 approach lets us prove the case without asking for that concession upfront.
