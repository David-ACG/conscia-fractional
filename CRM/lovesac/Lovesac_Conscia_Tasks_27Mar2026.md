# Lovesac / Conscia — Task list

_Extracted from team call, 27 March 2026 — Sana, David, Laurel_

---

## Before kickoff meeting

| #   | Task                                                                                                                                                                                                                                           | Owner         | Priority |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | -------- |
| 1   | Read and review all documents in the shared drive — solution design, requirements doc, product hierarchy PDF, compatibility rules, kickoff deck, target architecture. Poke holes; Sana expects ~75% accuracy and actively wants critique.      | David, Laurel | High     |
| 2   | Forward the new data file from Amelia (received during the call) to David and Laurel.                                                                                                                                                          | Morgan        | High     |
| 3   | Confirm kickoff meeting date, time, and attendees with Amelia. Originally flagged as Monday but likely Tuesday or Wednesday due to Holt Renfrew clash — stagger so both projects don't land simultaneously.                                    | Morgan        | High     |
| 4   | Prepare list of questions to bring to kickoff: (1) How/where will they provide product data — file feed or API endpoint? (2) Can they provide or verify the compatibility rules? (3) What does the target 3-level hierarchy look like exactly? | David, Laurel | High     |
| 5   | Add architecture diagram (Canva/Mermaid) to the shared drive folder. Sana shared it via Slack during the call but it isn't in the drive yet. Simple diagram showing DX Graph + DX Engine relationship.                                         | Sana          | Medium   |

---

## Solution design & documentation

| #   | Task                                                                                                                                                                                                                                                                                                                          | Owner | Priority |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | -------- |
| 6   | Enrich the solution document with additional architecture diagrams. Use Mermaid (or Excalidraw CLI — David flagged it now supports programmatic/API usage). Show DX Graph + DX Engine working together, plus a "DX Graph only" comparison to justify the DX Engine layer.                                                     | David | High     |
| 7   | Create an internal business sell deck ("inside sell") for Amelia. She needs to go back to her business and IT teams to explain what Conscia is building. Audience is non-technical. Deck should translate technology into business value — cost of errors today, what real-time validation gives them, omnichannel readiness. | David | High     |
| 8   | Build a "before vs after" narrative for the sell deck using Lovesac's own pain point: store associate takes an order with an incompatible fabric/component combo → customer called back after leaving the store → bad experience → lost loyalty. Frame as revenue and experience risk, then show what the solution prevents.  | David | Medium   |
| 9   | Update Conscia documentation to clarify that DX Graph supports relationships within the same collection. Sana found that AI-assisted solutioning was confused about this; docs need to make it explicit so it doesn't regress in future.                                                                                      | Sana  | Medium   |

---

## Compatibility rules & data ingestion

| #   | Task                                                                                                                                                                                                                                                                           | Owner            | Priority |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- | -------- |
| 10  | Present AI-generated compatibility rules to Amelia for validation. Sana generated these from the 28k-record dataset using Pandas-backed analysis. Risk: Lovesac may not have a formal rules document — all rules are currently hard-coded in Threekits.                        | Sana             | High     |
| 11  | Ask Lovesac at kickoff: can they export rules from Threekits, or do they need to be derived from data? Current logic is hard-coded in the front-end visualiser. Establish whether any structured export exists, or whether the AI-derived rules are the starting point.        | Team             | High     |
| 12  | Establish data ingestion format and cadence with Lovesac. Conscia needs JSON format for ongoing operational ingestion. Clarify: do they have an existing API endpoint, or will they provide file feeds? Source systems are SAP, Magento/Adobe Commerce, and Threekits.         | Team             | High     |
| 13  | Start POC: load product data into DX Graph and build initial compatibility relationships. Sana wants to start immediately — enough data exists to show something in ~1 week. Priority 1 is data ingestion + hierarchy. Priority 2 is the DX Engine orchestration layer on top. | David, Laurel    | High     |
| 14  | Align with Lovesac on final 3-level product hierarchy design. They currently have 7 levels and want to flatten to ~3. Fabric was previously a hierarchy level — confirm it becomes an attribute on the product entity, not a level.                                            | Lovesac (Amelia) | Medium   |

---

## Later / pipeline items

| #   | Task                                                                                                                                                                                                                                                | Owner         | Priority |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | -------- |
| 15  | Build DX Engine orchestration flow for real-time configuration validation (POS integration POC). POS will call Conscia in real time to validate a configuration. Target: integration-ready by 30 June. Lovesac unlikely to go live until post-June. | David, Laurel | Medium   |
| 16  | Write a configurator white paper targeting the automotive vertical. Use the Lovesac solution as a template and publish. Position Conscia as the modern, API-first alternative to legacy CPQ engines. Jaguar is a live prospect.                     | Sana          | Low      |
| 17  | Share David's AI course with Laurel for feedback once ready (~50% complete).                                                                                                                                                                        | David         | Low      |
| 18  | Introduce Laurel to Dwayne — to happen week of kickoff (Dwayne is currently in Vegas with Sana).                                                                                                                                                    | Sana          | Low      |

---

## Key context notes

**DX Engine is a freebie for year one.** It wasn't in the original scope and Lovesac doesn't have budget for it. Sana committed to giving it at no charge for a year because the solution doesn't work without it. Making the POC impressive is important for converting this into a paid renewal.

**Compatibility rules are the critical-path blocker.** All current rules are hard-coded in Threekits (the front-end visualiser). Lovesac may have no structured rules document at all. Sana AI-generated a candidate rule set from the product data, but these need business validation before being loaded into DX Graph.

**Amelia (VP Consumer Experience, Lovesac) is non-technical.** David's primary role is stakeholder translation — making sure Amelia and her business teams understand what is being built and why. She is managing ~10 concurrent projects and needs help aligning her internal teams.

**Laurel's role on Lovesac is hands-on solutioning and implementation.** Her Holt Renfrew involvement is lighter for now (shadowing, not leading) so Lovesac is her main focus in the near term.
