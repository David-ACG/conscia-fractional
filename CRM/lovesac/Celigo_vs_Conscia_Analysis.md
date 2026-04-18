# Celigo vs Conscia — Analysis for the Lovesac Engagement

**Author:** Conscia (David / pre-kickoff research)
**Date:** April 2026
**Status:** Internal working doc — informs kickoff questions for Emilia and Tate

---

## 1. Why this document exists

Celigo appears in the Lovesac target architecture diagram as the "integration hub" sitting between source systems (NetSuite, Threekit, Magento/Adobe Commerce, Manhattan Active Omni, Salesforce Retail Cloud) and downstream consumers. It is **not** mentioned anywhere in the current Conscia solution design. Laurel raised this in our 1 April working session as an open question: *"Are we receiving data from Celigo? Do we have to integrate with them? How does it work?"*

We also have direct evidence Lovesac is already a Celigo customer — Kimberly Dietz (Omni Channel Product Manager, Lovesac) is quoted publicly on Celigo's NetSuite–Magento connector page praising the integration. So Celigo is almost certainly staying. The question is not "Celigo or Conscia?" — it is **"where does the boundary sit, and who owns what?"**

This doc lays out:
1. What Celigo actually is and does
2. Where Celigo is weak relative to what Lovesac needs Conscia for
3. What Celigo does for Lovesac today (inferred)
4. What it will continue to do once Conscia is in place
5. How Conscia integrates with Celigo in practice
6. Open questions for the kickoff with Emilia and Tate

---

## 2. What Celigo is

Celigo is an **iPaaS** (Integration Platform as a Service) — its flagship product is `integrator.io`. It is best understood as middleware: a cloud-based hub that moves data between SaaS applications, ERPs, ecommerce platforms, and databases. Founded around 2010 with a strong NetSuite heritage, it now claims 4,000+ customers and 1,000+ prebuilt connectors. Gartner named it a 2025 Customers' Choice for iPaaS.

**Core capabilities**

- **Prebuilt connectors and "Integration Apps"** — packaged, opinionated integrations for common pairings (NetSuite ↔ Magento, NetSuite ↔ Salesforce, NetSuite ↔ Shopify, etc.). The Magento 2 ↔ NetSuite Integration App is the most relevant for Lovesac: it ships prebuilt flows for syncing customers, orders, items (including matrix items, kits, bundles), inventory, and fulfilments.
- **Visual flow builder** — drag-and-drop construction of import/export flows, scheduled or event-triggered.
- **Universal connectors** — REST, GraphQL, SOAP, HTTP, FTP, JDBC, AS2, webhooks for anything not covered by a prebuilt connector.
- **Data mapping & transformation** — field-level mapping, handlebar expressions, JavaScript hooks for transforming data in flight.
- **Error management** — first-class exception handling with AI-assisted auto-resolution, retries, and alerting. This is one of Celigo's strongest differentiators in the iPaaS market.
- **B2B / EDI Manager** — for trading-partner integrations.
- **API Management** — turn flows into published APIs for internal/external consumers.
- **High-volume data loader** — bulk ETL for large data movements.
- **Celigo Ora** — newer natural-language layer over the platform (their AI agent push).
- **MCP Server** — yes, Celigo also recently shipped an MCP server, putting them in the same conversation as Conscia for agentic integration.

**Mental model:** Celigo is a **pipes and plumbing** platform. It moves bytes between systems on a schedule (or in response to an event), with mapping and error handling on the way through. It is record-by-record, integration-flow-by-integration-flow, source-to-destination thinking.

---

## 3. Where Celigo is weak compared to Conscia

Celigo is genuinely good at what it is for. The weaknesses below are not "Celigo is bad" — they are **category limits**. iPaaS and a governed semantic data layer + experience orchestration platform are different categories of tool, and Lovesac needs both. The gap matters because the architecture diagram currently implies Celigo can serve roles it structurally cannot.

### 3.1 No semantic data model — it's a pipe, not a brain

Celigo moves records from A to B with field mapping. It does **not** hold a unified, queryable, governed model of "what a Sactional is." There is no concept in Celigo of `COMPATIBLE_WITH`, `BUNDLES`, `CONTAINS`, or `MAPS_TO` as first-class relationships. You cannot ask Celigo "given this base config, what covers are valid next?" — that question has no home in an iPaaS.

Conscia's DX Graph is purpose-built for exactly this: SKU Collections, Configuration Collections, Taxonomy Collections, and dynamic relationships expressed as graph edges, all with built-in semantic search.

### 3.2 No real-time configuration validation engine

Celigo flows are predominantly **batch and scheduled** (or webhook-triggered). They are not designed to be hit synchronously by a POS terminal during a sales associate's checkout flow with sub-second latency expectations. iPaaS platforms generally optimise for throughput and reliability over latency.

Conscia's DX Engine is the opposite: synchronous, low-latency, request/response orchestration optimised for being on the critical path of a user interaction. The Configuration Validation flow, the Wizard Step Options flow, the Config ID → BOM Explosion flow — none of these belong in an iPaaS, and trying to build them in one would be painful.

### 3.3 No rules engine at the experience layer

Celigo has logic — branches, mapping rules, conditional routing inside a flow. It does **not** have an experience-rules engine in the Conscia sense: per-component rules with priority ordering, A/B testing, audience segmentation, context-driven activation, business-user-friendly UI. iPaaS rules are developer/integration-builder facing; Conscia's Experience Rules are also accessible to merchandisers and ops users.

For Lovesac's "series & channel constraints" requirement (Phase 1 scope in our kickoff deck), this matters: we want business users to be able to say "this Sactional series only ships to these regions on this channel" without raising an integration ticket.

### 3.4 No Backend-for-Frontend (BFF) pattern

Conscia's whole reason for existing is that frontends — Lovesac.com, the POS in Salesforce Retail Cloud, Google Shopping, ChatGPT, an in-store kiosk — should make **one call** to a single Experience API and get back a unified, personalised, channel-shaped JSON response. Celigo doesn't do that. Celigo would require each frontend to either talk to multiple Celigo flows or for someone to assemble a custom BFF on top of Celigo (which is exactly the code-heavy alternative Conscia is built to replace).

### 3.5 Agentic / MCP capability is shallower

Celigo *has* an MCP server now, but it exposes integration flows. Conscia's MCP server exposes governed Experience APIs that already encapsulate semantic relationships, business rules, and personalisation. For a question like "what Sactional configurations are valid for a 6-seat L-shape with StealthTech in Charcoal Tweed?", a Celigo MCP tool would have to fan out to multiple source systems and reassemble the answer; a Conscia MCP tool answers from DX Graph in one call because the relationship already lives there.

### 3.6 SKU-explosion problem is not solved by moving data faster

This is the heart of it. The problem the kickoff deck names — *"13+ attribute dimensions driving SKU explosion, no compatibility model, fragmented source systems, no real-time orchestration"* — is not an integration-pipe problem. Pumping the same fragmented data faster between the same systems doesn't unify the model, doesn't encode compatibility, and doesn't give you a real-time API. **Celigo could be running perfectly today and Lovesac would still have every problem we're being hired to solve.** That is the cleanest argument for why Conscia is additive, not duplicative.

### 3.7 Other notable gaps relative to enterprise needs

Industry analysis (G2, ONEiO, others) consistently flags Celigo as having lighter governance and API lifecycle management compared to enterprise-focused iPaaS like MuleSoft, and limited specialised connectors for highly regulated verticals. Not directly relevant to Lovesac, but worth keeping in mind if Conscia is asked to compare across the broader landscape.

---

## 4. What Celigo does for Lovesac today (inferred)

We don't have a Celigo flow inventory from Lovesac yet (this is a kickoff question), but based on the architecture diagram, the public Lovesac/Celigo testimonial, and the standard shape of a Celigo NetSuite–Magento deployment, the working hypothesis is:

| Flow | Source | Destination | Purpose |
|---|---|---|---|
| Item / product sync | NetSuite | Magento (Adobe Commerce) | Push item master, matrix items, kits, pricing, images, categories to the storefront |
| Inventory sync | NetSuite | Magento | Keep storefront stock levels current |
| Order sync | Magento | NetSuite | Create sales orders in NetSuite from web orders |
| Customer sync | Magento ↔ NetSuite | both ways | Keep customer records aligned |
| Fulfilment sync | NetSuite | Magento | Push shipping/tracking back to the storefront |
| (Likely) Order routing | NetSuite or Magento | Manhattan Active Omni | Hand off orders to OMS for fulfilment |
| (Likely) POS sync | Salesforce Retail Cloud | NetSuite | Push in-store transactions back to ERP |

This is bread-and-butter Celigo. It's also exactly what Celigo is good at and what Conscia has no business replacing.

The CSVs in the project knowledge — `Itemdelta...`, `ItemFull...`, `CeligoMagento2ItemExportSearch...`, `bundle_skusin.csv` — strongly suggest these flows are already in production: the file names follow Celigo's standard saved-search export naming convention, and the columns align with what the Magento 2 ↔ NetSuite Integration App syncs.

---

## 5. What Celigo will do once Conscia is live

**Short answer:** the same things it does today, minus nothing. We are not displacing any Celigo flow.

**Slightly longer answer:** Celigo continues to be the operational integration plumbing that keeps NetSuite, Magento, Manhattan Active Omni, and Salesforce Retail Cloud transactionally consistent. Conscia sits **alongside** that plumbing as a new, governed semantic layer and orchestration tier that the channels query for product structure, compatibility, configuration, and BOM resolution.

A useful split:

| Concern | Celigo (today and future) | Conscia (new) |
|---|---|---|
| Move customer records between systems | ✅ Celigo | — |
| Move order records between systems | ✅ Celigo | — |
| Move inventory between systems | ✅ Celigo | — |
| Move fulfilment/tracking | ✅ Celigo | — |
| Source product item master from NetSuite | ✅ Celigo (to Magento, etc.) | Conscia ingests in parallel |
| Hold the canonical configurable-product model | — | ✅ Conscia (DX Graph) |
| Encode component compatibility rules | — | ✅ Conscia |
| Validate a configuration in real time from POS | — | ✅ Conscia (DX Engine) |
| Power the wizard step-options flow | — | ✅ Conscia |
| Generate and persist Config IDs | — | ✅ Conscia |
| Explode a Config ID into a BOM for OMS | — | ✅ Conscia (then handed off to Celigo or direct to MAO) |
| Serve agentic channels (Google Shopping, ChatGPT) | — | ✅ Conscia (via MCP) |
| Update marketplace feeds | partly Celigo today | Conscia takes over the 2 feeds in scope |

Note the one place where there *is* genuine overlap: **marketplace feeds.** The kickoff deck commits Conscia to "Update up to 2 existing marketplace feeds." If those feeds are currently produced by Celigo flows, then there is a real handoff conversation to have — does Conscia take ownership of those two flows, or do we provide the data and Celigo continues to ship them? Worth asking at kickoff.

---

## 6. How Conscia integrates with Celigo

Three viable patterns. We probably want a hybrid — pattern A for ingest, pattern C for the BOM hand-off downstream.

### Pattern A — Celigo as a source feed into DX Graph (recommended for ingest)

The simplest, lowest-disruption pattern. Celigo already has clean, normalised, transformed item data flowing out of NetSuite (it has to, in order to feed Magento). We **piggyback on that work** rather than building a parallel NetSuite ingest:

- Add a new Celigo export flow that writes the same item/matrix/kit data to a destination Conscia can consume — either a webhook into a Conscia DX Engine Listener, an SFTP drop that a DX Graph Job picks up, or a direct REST call to a Conscia ingest endpoint.
- Cadence: probably nightly delta + on-demand full refresh, mirroring how Celigo already runs its NetSuite→Magento delta exports.
- Format: JSON (Sana's stated preference for ingest).
- Conscia transforms and loads into DX Graph SKU/Configuration/Taxonomy collections.

**Why this is the right default:** Lovesac has already paid for Celigo's NetSuite expertise. Lovesac's NetSuite saved searches, field mappings, custom fields, and the eTail/Magento configuration on item records are all already wired up in Celigo. Re-implementing that ingest in DX Graph Jobs against raw NetSuite is duplicative and slow. Let Celigo do what it's good at and consume its output.

### Pattern B — Conscia ingests from NetSuite directly (fallback)

If Celigo's existing flows can't be cleanly extended (e.g. their item exports drop fields Conscia needs, or Lovesac doesn't want to add Celigo flows for governance reasons), DX Graph Jobs can connect directly to NetSuite via SuiteTalk REST or saved-search RESTlets. This is more work, but the Connectors page on conscia.ai lists NetSuite, so there is precedent.

This is Plan B, not Plan A, because it duplicates work Celigo is already doing well.

### Pattern C — Conscia hands off downstream via Celigo (BOM explosion path)

The Config ID → BOM Explosion flow is a Conscia-side capability, but the *consumer* of the exploded BOM is Manhattan Active Omni (the OMS). Two options:

- **C1 — Conscia → Celigo → Manhattan Active Omni.** Conscia produces the exploded BOM and hands it to a Celigo flow that already knows how to talk to Manhattan Active Omni. Celigo does the format-and-deliver job it's good at.
- **C2 — Conscia → Manhattan Active Omni directly.** Conscia builds its own connection. More work, but cuts a hop.

C1 is almost certainly the right call for Phase 1 — it respects existing Celigo investment in the OMS path and keeps Conscia focused on the configuration brain rather than logistics plumbing. Worth confirming with Lovesac whether such a flow exists yet.

### Pattern D — POS → Conscia direct (no Celigo on the read path)

For real-time POS configuration validation, Salesforce Retail Cloud calls Conscia's Experience API **directly**. Celigo is not on this path at all, and shouldn't be — this is a synchronous request/response on the critical path of a checkout, exactly the latency profile Celigo isn't built for. This is the Phase 1 POC the kickoff deck commits to.

### A picture of the end state

```
                    ┌──────────────┐
                    │   NetSuite   │  ◄── product master + ERP
                    └──────┬───────┘
                           │
                  ┌────────▼─────────┐
                  │      Celigo      │  ◄── operational pipes
                  │  (NetSuite ↔ Magento,
                  │   ↔ MAO, ↔ Salesforce,
                  │   item/order/inv/fulfilment)
                  └─┬────────┬───────┘
                    │        │
                    │        ├──► Magento (Adobe Commerce)
                    │        ├──► Manhattan Active Omni
                    │        └──► Salesforce Retail Cloud (back-office sync)
                    │
                    │ (new) item/matrix/kit feed
                    ▼
              ┌──────────────────────┐
              │      DX Graph        │  ◄── governed semantic model
              │  SKU / Config / Tax  │       compatibility relationships
              │      Collections     │
              └──────────┬───────────┘
                         │
              ┌──────────▼───────────┐
              │      DX Engine       │  ◄── real-time orchestration
              │  Validation, Wizard, │       Experience API + MCP
              │  Config ID, BOM      │
              └─┬───────┬──────┬─────┘
                │       │      │
                │       │      └──► Google Shopping / ChatGPT (MCP)
                │       └─────────► Lovesac.com (when Threekit calls Conscia)
                └─────────────────► Salesforce Retail Cloud POS
                                    (real-time config validation)

      [BOM explosion result] ──► Celigo flow ──► Manhattan Active Omni
```

Celigo and Conscia are **complementary tiers**, not competitors. Celigo is the integration substrate underneath; Conscia is the semantic + experience layer above.

---

## 7. Open questions for the kickoff with Emilia and Tate

These are the things we genuinely need answered before the solution design can be finalised. Recommend adding to the existing pre-kickoff questions doc.

1. **Is Celigo staying?** (Confirm what we're 95% sure of.)
2. **What flows does Lovesac currently run in Celigo?** Specifically: which source/destination pairs, which Integration Apps (NetSuite ↔ Magento? something for Manhattan Active Omni? something for Salesforce Retail Cloud?), and roughly how many flows.
3. **Does Celigo currently produce the marketplace feeds in Phase 1 scope?** If yes, are those feeds being moved to Conscia, or does Conscia provide upstream data that Celigo continues to format and ship?
4. **Can Conscia ingest from Celigo's existing item/matrix exports rather than going direct to NetSuite?** Strong preference for yes — same data, less duplicated work, leverages existing field mappings.
5. **Format and cadence of the Celigo → Conscia feed.** JSON over webhook (preferred), JSON over SFTP, or direct REST. Nightly delta plus on-demand full?
6. **For the BOM explosion → OMS path, does an existing Celigo flow to Manhattan Active Omni exist that we can hand off to?** Or do we need to plan for direct Conscia → MAO?
7. **Does Celigo do any data manipulation we depend on?** (Laurel's specific question — "does it manipulate the data in any way?") If Celigo is enriching, normalising, or deriving fields, we need to know which ones so we don't lose them on ingest.
8. **Who owns Celigo at Lovesac?** Kimberly Dietz is publicly quoted as Omni Channel Product Manager — is she the day-to-day owner, and should she be in the kickoff or a follow-up session?
9. **Is Celigo's MCP server in scope anywhere on the Lovesac roadmap?** If Lovesac is already thinking about Celigo MCP for agentic use cases, we need to be clear about which questions belong to Conscia's MCP vs theirs.

---

## 8. Bottom line for the kickoff narrative

If asked "why do you need Conscia if we already have Celigo?", the answer is:

> Celigo moves data between systems. Conscia gives that data meaning. The Sactional SKU explosion isn't a transport problem — it's a model problem and a real-time orchestration problem. Celigo can't tell a POS terminal in 200ms whether a Charcoal Tweed cover is compatible with a StealthTech-equipped seat, because that question has no home in any iPaaS. It can't power a wizard step. It can't return an MCP tool response to ChatGPT. It can't hold the compatibility graph. Those are exactly the things DX Graph and DX Engine exist to do, and they sit naturally on top of the integration substrate Celigo already provides. We're additive, not substitutive — and the cleanest implementation pattern leverages Celigo's existing NetSuite expertise as our ingest source rather than rebuilding it.

That framing also disarms the most likely political risk on the Lovesac side: nobody at Lovesac wants to hear "rip out the thing Kimberly is publicly quoted endorsing." We're not asking them to.
