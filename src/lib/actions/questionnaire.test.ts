import { describe, it, expect } from "vitest";
import {
  generateQuestionnaire,
  getFullQuestionBank,
  getQuestionCategories,
} from "./questionnaire";

describe("Questionnaire Logic", () => {
  it("full question bank has 27 questions", async () => {
    const bank = await getFullQuestionBank();
    expect(bank.length).toBe(27);
  });

  it("full question bank covers all 6 categories", async () => {
    const bank = await getFullQuestionBank();
    const categories = await getQuestionCategories(bank);
    expect(categories).toEqual([
      "Communication & Availability",
      "Meetings & Cadence",
      "Tools & Templates",
      "Decision Making & Approvals",
      "Team & Culture",
      "Onboarding & Access",
    ]);
  });

  it("generates all questions when contract data is empty", async () => {
    const questions = await generateQuestionnaire({});
    expect(questions.length).toBe(27);
  });

  it("skips key_people question when contract has key_contacts", async () => {
    const questions = await generateQuestionnaire({
      key_contacts: ["Sana Remekie", "Morgan Johanson"],
    });
    const ids = questions.map((q) => q.id);
    expect(ids).not.toContain("key_people");
    expect(questions.length).toBe(26);
  });

  it("skips timezone question when contract has timezone", async () => {
    const questions = await generateQuestionnaire({ timezone: "ET" });
    const ids = questions.map((q) => q.id);
    expect(ids).not.toContain("timezone");
  });

  it("skips working hours question when contract has working_hours", async () => {
    const questions = await generateQuestionnaire({ working_hours: "9-5 ET" });
    const ids = questions.map((q) => q.id);
    expect(ids).not.toContain("core_working_hours");
  });

  it("skips tools-related questions when contract has tools", async () => {
    const questions = await generateQuestionnaire({
      tools: ["Confluence", "Jira"],
    });
    const ids = questions.map((q) => q.id);
    expect(ids).not.toContain("file_sharing");
    expect(ids).not.toContain("diagram_tool");
    expect(ids).not.toContain("code_repo");
  });

  it("skips meetings-related questions when contract has meetings", async () => {
    const questions = await generateQuestionnaire({
      meetings: ["Daily standup", "Weekly sync"],
    });
    const ids = questions.map((q) => q.id);
    expect(ids).not.toContain("recurring_meetings");
    expect(ids).not.toContain("standup");
  });

  it("does not skip questions when contract data keys are empty", async () => {
    const questions = await generateQuestionnaire({
      key_contacts: [],
      tools: [],
      meetings: [],
    });
    // Empty arrays are falsy for our check, so no questions skipped
    expect(questions.length).toBe(27);
  });

  it("every question has required fields", async () => {
    const bank = await getFullQuestionBank();
    for (const q of bank) {
      expect(q.id).toBeTruthy();
      expect(q.category).toBeTruthy();
      expect(q.question).toBeTruthy();
      expect(["text", "textarea", "select", "multiselect", "toggle"]).toContain(
        q.type,
      );
      expect(typeof q.required).toBe("boolean");
    }
  });

  it("select-type questions have options", async () => {
    const bank = await getFullQuestionBank();
    const selects = bank.filter((q) => q.type === "select");
    for (const q of selects) {
      expect(q.options).toBeDefined();
      expect(q.options!.length).toBeGreaterThan(0);
    }
  });

  it("category grouping preserves order", async () => {
    const questions = await generateQuestionnaire({});
    const categories = await getQuestionCategories(questions);
    // First question should be in first category
    expect(questions[0]!.category).toBe(categories[0]);
  });
});
