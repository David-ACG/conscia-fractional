# Lovesac — Slack Q&A Notes

_David's questions with Sana's responses — 30 March 2026_

---

## Q1: SAP vs NetSuite

**David:** The solution design mentions "an SAP backend" but Lovesac's ERP is NetSuite, according to the target architecture diagram.

**Sana:** SAP is likely a typo.

**Status:** 🟢 Resolved — update solution design to reference NetSuite, not SAP.

---

## Q2: PLM / Product Master

**David:** I'm assuming Conscia will be the PLM (TBD) in the diagram as it is the Product Master.

**Sana:** I'm not sure if they'll have a PLM at all.

**Status:** 🟡 Confirm at kickoff — does Lovesac plan to implement a PLM, or is Conscia DX Graph the de facto product master?

---

## Q3: Celigo Integration Hub

**David:** The architecture shows Celigo as the Integration Hub through which all system-to-system data flows. The solution design describes DX Graph Jobs pulling data from "up to three source backends" but doesn't mention Celigo. Should we assume Celigo is involved?

**Sana:** I don't think they want Celigo to be directly involved, but we can confirm that. We should push for data to be directly ingested into the DX Graph through Conscia's jobs (part of the Core) and do any transformation there. Involving Celigo will become a whole new project. I do believe though that Celigo may already be creating feeds that can be pushed to Conscia's Bucket.

**Status:** 🟡 Push at kickoff — advocate for direct Conscia ingestion. If Celigo is producing existing feeds, we can consume those feeds, but avoid making Celigo a dependency. Involving Celigo as middleware = scope creep.

---

## Q4: BOM Explosion → OMS Delivery Path

**David:** Section 4.4 of `lovesac-solution-design.docx` describes the BOM Explosion flow and lists four output shapes — POS ring-up line items, OMS fulfilment BOM, warehouse pick list, and marketplace bundle feed. But it only describes what the _response payload looks like_. It never describes **how that response reaches the OMS**.

**Sana:** Is this in our solution document or their document?

**David:** Section 4.4 of `lovesac-solution-design.docx` — it describes what the response payload looks like but not how it reaches the OMS (Manhattan). Does DX Engine call Manhattan directly? Does it go via Celigo? Does Lovesac's OMS team need to build a receiver?

**Status:** 🔴 Open — need to define the delivery mechanism. Options:

1. DX Engine responds to API caller (POS/website) who then sends to OMS
2. DX Engine pushes directly to Manhattan via API
3. DX Engine writes to a queue/bucket that Celigo or Manhattan consumes
   Needs a decision at kickoff. Most likely option: DX Engine responds to the caller, the caller is responsible for routing the BOM to Manhattan.

---

## Q5: Threekit Coexistence Plan

**David:** Threekit is Lovesac's live customer-facing configurator (as documented in the Builder Guide). In Phase 1, DX Graph and DX Engine will coexist with Threekit — Threekit won't be decommissioned. There needs to be an explicit plan for the transition period: does Threekit continue to serve the web configurator while DX Engine is being built? When does the switchover happen? Who owns the Threekit rules until then?

**Sana:** This is where a lot of ambiguity lies. In Phase 1, we're just supposed to stand up the DX Engine as the POC. They'll decide at that point whether it makes sense for them to integrate it into lovesac.com and POS. Threekit is being used on lovesac.com on their Magento website. My guess is that eventually they'll transition away from holding on to config rules in Threekit and it will talk directly to Conscia's APIs.

**Status:** 🟡 Acknowledged ambiguity — Phase 1 is POC only. Threekit continues as-is during Phase 1. Transition decision is post-POC. Document this explicitly so Lovesac doesn't expect Threekit replacement in Phase 1 scope.

---

## Q6: POS System Name

**David:** The solution design refers to "POS Channel" and "POS terminals" throughout, but the architecture names the system as Salesforce Retail Cloud. Should we update the solution design to match the diagram?

**Sana:** Sure, that sounds reasonable.

**Status:** 🟢 Resolved — update solution design to reference "Salesforce Retail Cloud" instead of generic "POS Channel" / "POS terminals".

---

## Q7: Quickship / Inventory

**David:** Quickship availability is an inventory concept — if Quickship reflects live stock in NetSuite rather than a product classification, the Quickship Experience Rule will need a real-time inventory call that isn't currently designed. This connects directly to Open Question 6 in the solution design.

**Sana:** From what I understand, inventory is not to live in the PIM. However, we should bring that up and ask where it is being managed. We can talk about this further.

**Status:** 🟡 Confirm at kickoff — where does inventory live? If Quickship is a live inventory status (not a product classification), the DX Engine Experience Rule needs a real-time inventory API connector to NetSuite, which is not currently designed. This is a significant architectural addition.

---

## Summary: Actions for Kickoff

| #   | Item                          | Status          | Action                            |
| --- | ----------------------------- | --------------- | --------------------------------- |
| 1   | SAP → NetSuite typo           | 🟢 Fixed        | Update solution design            |
| 2   | PLM role                      | 🟡 Open         | Confirm at kickoff                |
| 3   | Celigo involvement            | 🟡 Decision     | Push for direct Conscia ingestion |
| 4   | BOM → OMS path                | 🔴 Undefined    | Define delivery mechanism         |
| 5   | Threekit coexistence          | 🟡 Acknowledged | Document as Phase 1 = POC only    |
| 6   | POS → Salesforce Retail Cloud | 🟢 Fixed        | Update solution design            |
| 7   | Quickship / inventory         | 🟡 Open         | Confirm inventory source          |
