# Lovesac — Actions & Decisions from 15 April 2026 Meetings

Two meetings with Lovesac on 15 April 2026, plus a follow-up Slack thread from Sana and Laurel.

| Meeting | Time | Duration | Attendees |
|---|---|---|---|
| Lovesac × Conscia PIM Project Kickoff | 15:03 UTC | 60 min | Morgan, Sana, Laurel, David (Conscia); Amelia, Tate, Suresh, Eric, Jim (Lovesac) |
| Lovesac Post-Demo Debrief: Spreadsheet Workflow & DX Graph Strategy | 16:05 UTC | 45 min | Sana, David, Laurel, Morgan (Conscia internal) |

Two reprocessed copies of the debrief exist in the DB (identical content) — duplicate action items are consolidated below.

---

## Meeting 1 — PIM Project Kickoff (Lovesac × Conscia)

### Purpose & outcome
Official project kickoff. Conscia introduced the DXGraph platform, walked through early findings from Lovesac's product data, and demoed initial work in staging. The meeting surfaced a major workflow question: **should Conscia become the product system of record, with Lovesac creating products directly in DXGraph and pushing them downstream (including to NetSuite)?** Amelia confirmed this is the direction she wants.

### Context that matters for the actions below
- **NetSuite has two separate feeds** (not one, as David's diagram showed): one to Adobe Commerce, one to Salesforce Retail Cloud. Product logic is fragmented across systems — e.g. 3Kit rules reach Lovesac.com but not Retail Cloud.
- **Celigo is a pass-through**, not a transformation layer — original Conscia assumption was wrong.
- **Eric does substantial manual data prep in spreadsheets** before feeding NetSuite. The spreadsheet coordinates across teams (costing, MSRP, etc.) for ~1 month before a product is fully ready. New covers can mean 50–60 SKUs at once.
- **Tate's concerns** about flipping NetSuite from upstream to downstream: bulk uploads must be supported; NetSuite has required fields (vendors, accounts) that may not be set up early, causing SKU creation failures; need to know required fields and what test/sandbox values to use.
- **Likely outcome:** phased approach. Move part of the workflow to Conscia now, defer the rest to phase two if comfort isn't there. Existing covers (bulk of work) feasible for phase one; brand-new fabrics need more logic work.
- **Demo glitch:** staging hierarchy view was mid-update (Duane adding the right-hand SKU grid Amelia requested previously), so the right panel wasn't loading. Conscia will send screenshots.

### Actions — kickoff meeting

**1. Update architecture diagram to show two NetSuite feeds** — *David · medium*
Replace the current diagram (which incorrectly shows NetSuite → Adobe Commerce only) with one reflecting the two direct NetSuite feeds (Adobe Commerce + Retail Cloud) and the fragmentation of product logic across systems.
**Why:** Amelia corrected the architecture live in the meeting. Keeping the diagram wrong would mis-frame every downstream conversation about where logic should consolidate.

**2. Create end-to-end workflow diagram (spreadsheet → Conscia → NetSuite → channels)** — *David · high*
Supersede the architecture diagram with a workflow diagram showing the full lifecycle: spreadsheet/UI input → validation in Conscia → export to NetSuite → confirmation back → push to TILs, website, and other channels. Include data validation checkpoints and back-feeds.
**Why:** The meeting shifted the framing from "what systems exist" to "who does what, when." A workflow view will make the phased migration discussion concrete and will force decisions about data ownership at each step.

**3. Provide sample spreadsheet feeding NetSuite plus field mappings** — *Eric · high*
Send Conscia a sample of the spreadsheet loaded into NetSuite, including field-to-ERP mapping (including duplicate mappings), required-for-upload flags, and which absences cause failure.
**Why:** This becomes the contract document for the new workflow. Without it Conscia can't confirm whether DXGraph rules can replicate the spreadsheet logic, and can't design the staging-collection validation.

**4. Book working session: Eric walks through the current spreadsheet process** — *Morgan · high*
Schedule a session where Eric demonstrates exactly what he does today to prepare product data before it goes into NetSuite, including any hierarchy mapping currently done in Visio.
**Why:** Sana flagged "devil's in the details." Replicating the workflow in DXGraph requires seeing the exact steps, not just reading the output. Also: Eric is the power user whose buy-in matters most (see stakeholder strategy below).

**5. Book working session with a NetSuite stakeholder** — *Morgan · high*
Arrange a session with Lovesac's NetSuite owner to show what happens once Eric's spreadsheet prep is complete and data lands in NetSuite.
**Why:** Needed to document the required-fields contract (for Tate's concerns) and to design the Conscia → NetSuite push for phase one.

**6. Book working session with a Celigo stakeholder** — *Morgan · high*
Arrange a session with whoever can describe what Celigo does today between NetSuite and Adobe Commerce / Retail Cloud.
**Why:** Current belief is "pure pass-through" but this must be confirmed. If any transformation logic exists in Celigo it has to be captured before Conscia can safely replace or bypass that step.

**7. Try to provide existing Celigo contract documentation** — *Amelia · low*
Search for any Celigo integration contracts or documentation from initial implementation. Amelia indicated docs are sparse so this may not exist.
**Why:** Could short-circuit the Celigo discovery session. Low priority because the documentation is unlikely to exist in usable form.

**8. Send screenshots of the updated taxonomy/hierarchy view with right-hand SKU grid** — *Sana / Conscia team · medium*
Capture and share screenshots of the updated taxonomy management page now showing the SKU grid alongside the taxonomy value (the change Amelia requested previously). Page was mid-update during the demo so it couldn't be shown live.
**Why:** Amelia had previously requested this change; showing it delivered — even via screenshot — closes that loop and reinforces Conscia responsiveness. Also needed by Amelia for her internal leadership sync (see action 13).

**9. Provide sandbox access to Lovesac team** — *Morgan · high*
Send Amelia a follow-up email requesting names of Lovesac team members who should be set up in the Conscia sandbox for read-only clicking-around.
**Why:** Gets Lovesac users hands-on with the platform early. Familiarity builds confidence, which underpins the phase-one migration decision.

**10. Send list of names for sandbox access** — *Amelia · high*
Reply to Morgan with the list of Lovesac team members for sandbox access.
**Why:** Paired action to 9. Sandbox access can't happen until this arrives.

**11. Send the kickoff meeting recording to the Lovesac team** — *Morgan · medium*
Distribute the recording so attendees (especially Jim, who dropped at the half hour) can review.
**Why:** Jim owns Business Process Improvement and needs to see the architectural discussion that happened after he dropped off. Also gives Amelia something tangible to circulate.

**12. Re-send the discovery questions Word document, split by stakeholder role** — *David · medium*
Take the previously-sent discovery questions document and split by role (data expert ~12 questions, integration ~6, project management, etc.) so relevant questions can be pre-sent to the right Lovesac people ahead of each follow-up working session.
**Why:** Follow-up meetings are role-specific (NetSuite, Celigo, Eric's spreadsheet). Role-targeted questions let attendees prep properly, shortening each session and improving answer quality.

**13. Send any updated kickoff slides to Amelia by end of day for her leadership sync** — *Morgan · high*
Amelia has a sync with her leadership team the next day to introduce the project as "discovery." Any slides updated based on today's discussion need to be with her by EOD.
**Why:** Amelia is the primary executive sponsor on the Lovesac side. Arming her with the latest framing is the fastest path to internal alignment.

**14. Schedule focused call on replicating spreadsheet logic in DXGraph rules interface** — *Sana / David · high*
Run a dedicated working session to verify that everything Eric does in the spreadsheet today — especially fabric tagging, hierarchy mapping, metadata application — can be replicated or improved through the DXGraph taxonomy/rules interface.
**Why:** Sana said "devil's in the details" and wants this confirmed before committing that phase one drops the spreadsheet. Treating this as its own working session (rather than folding it into #4) signals seriousness and forces a decision before the migration is promised.

**15. Decide phased approach: which parts of the product-creation workflow move to Conscia in phase one vs phase two** — *Amelia · high*
Once the workflow walkthrough sessions are complete, decide what moves now vs later. Sana suggested some parts move now; others can defer if comfort isn't there. Existing covers likely feasible for phase one; brand-new fabrics may need more logic work.
**Why:** Without this decision, scope creeps. Phasing protects the timeline and lets Lovesac validate on lower-risk data before migrating the higher-risk new-fabric workflow.

**16. Document required NetSuite fields and acceptable test/sandbox values** — *Eric / Tate · medium*
Capture which NetSuite fields are required for SKU creation and what sandbox-safe values can be used when those fields aren't yet configured (e.g. vendor or account not yet set up for a brand-new product).
**Why:** Directly addresses Tate's concern about SKU creation failures. Also becomes the field contract Conscia uses when generating the push from DXGraph to NetSuite.

**17. Confirm Conscia's initial compatibility rules against Lovesac product logic** — *Tate / Eric · medium*
Review the dynamic relationships Conscia encoded (e.g. cover SKU → compatible insert SKUs), built from analysis of Lovesac's data files, and feed back changes.
**Why:** Conscia's rules are their best guess from data alone. Only Lovesac product experts can confirm business correctness. If wrong rules ship, the platform's credibility with Eric and Tate erodes — exactly the wrong risk given Eric's stakeholder importance.

---

## Meeting 2 — Post-Demo Debrief (Conscia internal)

### Purpose & outcome
Internal Conscia retrospective on the kickoff demo, plus strategy session for how to handle Lovesac's spreadsheet-to-ERP workflow and how to approach Eric as the key power user. Output: the **staging-collection architecture** proposal and a stakeholder strategy focused on small, focused sessions with Eric.

### Context that matters for the actions below
- **Staging collection pattern** (Sana's proposal):
  - Phase 1: spreadsheet uploads land in a separate "staging" collection (not master). Validation cards check the data. Users flag records "Ready to Publish." A back-end process merges approved records into master. Delta pushes to ERP.
  - Phase 2: eliminate spreadsheets entirely — records created directly in the staging collection via DXGraph forms, still with the staging-to-master validation gate.
  - Reference precedent: Government of Ontario uses spreadsheet ingest into Conscia.
- **David cited parallel from Argos**: a campaign-manager spreadsheet shared across 150 people became unmanageable due to local copies, merge conflicts, and overwrites. Lovesac's spreadsheet-based workflow has the same risk profile. This framing matters for selling the direction to Amelia.
- **Bulk SKU generation** (20–60 fabric SKUs per cover) is a first-order requirement. Three implementation options discussed:
  1. **Conscia Operation** (custom grid operation) — ~1 day of low-code JS+JSON once the operations framework is familiar. Sana to check with Duane on making this easier for Laurel.
  2. **DX Engine Orchestration Flow** — endpoint that accepts a list and writes to DXGraph. Easier than building an operation; better suited to power users like Eric.
  3. **MCP server / CLI** — expose the orchestration flow via MCP so Eric's AI agent can call it directly. DX Engine is positioned as a universal MCP server.
- **Industry shift noted**: CLIs gaining favour over MCP for productivity tools (~70% CLI vs ~20% MCP preference) due to token efficiency. UCP/MCP still relevant for end-user purchasing flows. Underlying orchestration flow is the same — protocol is the wrapper.
- **Stakeholder strategy**:
  - Eric (4 yr tenure) is the key power user and de facto technical decision-maker — Morgan called him "the Steve of the situation." He's the one to win over; he's also a connector to other projects.
  - Amelia, Kate, Tate(um) are all relatively new. Tate will defer to Amelia. Amelia and Kate are already bought in.
  - New hires don't yet anticipate change-management complications (e.g. detaching marketing teams from spreadsheets) — works in Conscia's favour.
  - Shift from large group meetings to small focused sessions (2–3 people) with Eric and actual operators.
- **Demo standard:** one complete, fully-working demo must be ready before Lovesac gets staging access, so any subsequent breakage is clearly user error, not platform. Staging caveats ("new data coming in") are acceptable now but everything must work by production cutover.

### Actions — debrief meeting

**18. Produce Mermaid diagram of Lovesac's current spreadsheet-to-ERP workflow** — *Sana · high*
Capture Conscia's current understanding of Lovesac's spreadsheet → Celigo (API gateway only) → NetSuite → downstream flow.
**Why:** Use it to validate understanding with Lovesac in the upcoming working sessions, then drill into each step to assess what can move into DXGraph. Also forces Conscia's current understanding to be explicit, which exposes gaps before Lovesac has to.

**19. Document and propose the staging-collection architecture for Lovesac** — *Sana · high*
Write out the two-collection pattern (staging + master), the "Ready to Publish" flag, the back-end merge, and the delta-to-ERP sync. Cover both phase 1 (spreadsheet uploads) and phase 2 (direct form entry).
**Why:** This is the proposal Lovesac will accept or reject at the next working session. It needs to be concrete and written down — not just verbal — so Amelia can share with leadership and Eric can critique it on his terms. Also depends on understanding the exact spreadsheet logic first (action 3).

**20. Confirm with Duane the approach for a custom "Generate Fabrics" operation** — *Sana · medium*
Validate with Duane that a custom DXGraph operation is the right approach for bulk SKU generation, explore easier alternatives, and check whether operation creation can be made more low-code so someone like Laurel can build operations in ~1 day with JS + JSON config.
**Why:** Bulk SKU generation is the most tangible pain point for Eric. Solving it well wins him over. Also: if Laurel can build operations quickly, Conscia's delivery capacity on Lovesac (and future clients) expands materially.

**21. Prototype: orchestration flow exposed as MCP endpoint writing to DXGraph** — *Laurel · medium*
Build a proof-of-concept: one DX Engine orchestration flow that writes to DXGraph (e.g. bulk fabric/SKU creation), expose via MCP server endpoint, hand to a test agent to evaluate DX.
**Why:** Tests the "agent-creates-products" hypothesis directly. If it works, Conscia can offer Eric an AI-native workflow that his current spreadsheet can't match — a tangible differentiator. If it doesn't work, Conscia learns that before investing further.

**22. Add the MCP/CLI experiment to Laurel's tracked experiments sheet** — *Laurel · low*
Log the MCP-endpoint-on-orchestration-flow experiment, plus CLI as alternative given the ~70/20 CLI/MCP industry split.
**Why:** Keeps experiments traceable across clients. Same pattern may serve other customers, so learnings should compound.

**23. Coordinate small focused working sessions with Eric (and operators)** — *Morgan · high*
Reach out to Amelia and propose 2–3 person focused sessions instead of large group calls. Morgan to fire this out shortly.
**Why:** Eric is the key stakeholder; big meetings dilute the conversations needed to win him over. Smaller sessions also surface specifics that large meetings don't have time for. Amelia/Kate don't need to be in every session since they're already bought in.

**24. Ensure one complete, working demo is ready before Lovesac gets staging access** — *Conscia team · high*
Once Duane's hierarchy view fix is deployed, run through a clean end-to-end demo to set the baseline.
**Why:** Without a known-good baseline, any breakage Lovesac encounters in staging becomes ambiguous — was it them or the platform? A polished baseline turns all subsequent issues into "you clicked something" rather than "this doesn't work."

**25. In follow-up Lovesac sessions, capture exact spreadsheet logic step-by-step** — *Conscia team · medium*
Walk through exactly what users (especially Eric) do in spreadsheets today — fields populated, validations performed, bulk operations run, upload vs metadata — to confirm DXGraph can fully replicate the workflow before recommending the spreadsheet be retired.
**Why:** "Funky logic" discovered late is the biggest risk to phase one. Finding it in the sessions is cheap; finding it after cutover is expensive.

**26. Investigate adding regex validation to DXGraph form fields** — *Conscia product · low*
Currently only email and URI format validation is available out of the box — no regex. Given Lovesac's data-quality needs, evaluate adding regex so inspector cards aren't the only way to enforce pattern-based rules.
**Why:** Product gap surfaced during the demo. Not blocking for Lovesac (inspector cards cover it) but worth flagging to avoid the same gap biting other customers.

---

## Follow-up Slack thread (Sana + Laurel, after the meetings)

### Next sessions Sana wants set up with Lovesac
1. **Celigo** — how does Celigo process data from the NetSuite ERP? *(= action 6 above, now specifically framed around Celigo's processing behaviour)*
2. **Spreadsheet → NetSuite** — what data manipulation happens inside the spreadsheet? Can that process come into Conscia? *(= actions 3 + 4 above, now framed as a single combined session)*
3. **NetSuite** — what fields are added in the ERP before they're pushed to Celigo → Retail Cloud and Adobe Commerce? *(= action 5 above, sharpened to focus on the field set)*

### Artifacts Sana wants to see
- **Sample spreadsheet file** — covered by action 3 (Eric)
- **Set of fields uploaded to NetSuite and their default values** — covered by action 16 (Eric/Tate). Sana's ask adds explicit default-value capture to that action.
- **Data export to Retail Cloud** — new ask, not covered by any action above. Should become a separate work item:
  - **Action 27. Obtain sample data export from NetSuite to Retail Cloud** — *Amelia to source (owner TBD) · high*. Needed to understand exactly what Retail Cloud receives today, so Conscia can plan the phase-one Retail Cloud write path without reverse-engineering from partial information.

### Laurel's addition — configurator session
- Session with someone familiar with **the Sactionals configurator** to validate current compatibility rules and surface any adjacency rules Conscia hasn't encoded.
  - **Action 28. Book working session with Sactionals configurator owner** — *Morgan · medium*. Complements action 17 (compatibility rules confirmation). The configurator likely encodes rules that never made it into the data files Conscia analysed — particularly adjacency rules (which SKUs can sit next to which), a category Conscia hasn't handled yet.

### Side-by-side grid screenshot
Laurel shared a screenshot of the updated side-by-side taxonomy grid (the layout Amelia requested previously — covered by action 8 above). Note from Laurel: there is a rendering issue the team is fixing (expected fixed by 16 Apr); she did some manual touch-up on the image so it looks correct.

- **Action 29. Share side-by-side grid screenshot with Amelia ahead of her 16 Apr internal leadership sync** — *David · high*. The screenshot proves Amelia's prior request was delivered and gives her a visual to reference in that meeting. Flag that the rendering issue is fixed/being-fixed so she doesn't get caught out if someone clicks through live.

---

## Consolidated action owner summary

| # | Action | Owner | Priority |
|---|---|---|---|
| 1 | Update architecture diagram (two NetSuite feeds) | David | medium |
| 2 | Create end-to-end workflow diagram | David | high |
| 3 | Provide sample spreadsheet + field mappings | Eric | high |
| 4 | Book session: Eric walks through spreadsheet process | Morgan | high |
| 5 | Book session with NetSuite stakeholder | Morgan | high |
| 6 | Book session with Celigo stakeholder | Morgan | high |
| 7 | Try to find existing Celigo docs | Amelia | low |
| 8 | Send screenshots of updated taxonomy view | Conscia team | medium |
| 9 | Send follow-up requesting sandbox names | Morgan | high |
| 10 | Send list of sandbox users | Amelia | high |
| 11 | Send meeting recording | Morgan | medium |
| 12 | Re-send discovery questions split by role | David | medium |
| 13 | Send updated kickoff slides to Amelia by EOD | Morgan | high |
| 14 | Schedule focused call on replicating spreadsheet logic | Sana / David | high |
| 15 | Decide phase-1 vs phase-2 workflow split | Amelia | high |
| 16 | Document required NetSuite fields + default/sandbox values | Eric / Tate | medium |
| 17 | Confirm Conscia's compatibility rules | Tate / Eric | medium |
| 18 | Mermaid diagram of current spreadsheet-to-ERP workflow | Sana | high |
| 19 | Document staging-collection architecture | Sana | high |
| 20 | Confirm "Generate Fabrics" operation approach with Duane | Sana | medium |
| 21 | Prototype MCP-endpoint orchestration flow | Laurel | medium |
| 22 | Add MCP/CLI experiment to tracked sheet | Laurel | low |
| 23 | Coordinate focused sessions with Eric | Morgan | high |
| 24 | Polish end-to-end demo before staging handover | Conscia team | high |
| 25 | Capture exact spreadsheet logic step-by-step | Conscia team | medium |
| 26 | Investigate regex validation in DXGraph forms | Conscia product | low |
| 27 | Obtain sample data export from NetSuite to Retail Cloud (new, from Sana's Slack) | TBD (via Amelia) | high |
| 28 | Book working session with Sactionals configurator owner (new, from Laurel's Slack) | Morgan | medium |
| 29 | Share side-by-side grid screenshot with Amelia ahead of 16 Apr sync | David | high |

---

## Reading guide

- **Actions 1–17**: decided in the Lovesac kickoff meeting. Mix of Conscia and Lovesac owners. These are "on the record" with Lovesac.
- **Actions 18–26**: decided internally after the kickoff. Conscia-only actions. Frame the approach that gets proposed to Lovesac at the next working session.
- **Actions 27–29**: new work surfaced after the meetings via the Sana/Laurel Slack thread. Should be folded into the existing meeting-booking and session-prep workstreams rather than tracked separately.
