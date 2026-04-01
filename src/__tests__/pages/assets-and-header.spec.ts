import { test, expect } from "@playwright/test";

test.describe("API verification tests", () => {
  test("clients API returns Conscia", async ({ request }) => {
    const res = await request.get("/api/clients");
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    const conscia = data.find((c: { name: string }) => c.name === "Conscia");
    expect(conscia).toBeTruthy();
  });

  test("timesheet API returns 60-min meeting entry for Mar 27", async ({
    request,
  }) => {
    const clientsRes = await request.get("/api/clients");
    const clients = await clientsRes.json();
    const conscia = clients.find((c: { name: string }) => c.name === "Conscia");

    const res = await request.get(
      `/api/timesheet?clientId=${conscia.id}&from=2026-03-23T00:00:00Z&to=2026-03-29T23:59:59Z`,
    );
    expect(res.status()).toBe(200);
    const entries = await res.json();
    expect(entries.length).toBeGreaterThan(0);

    const meetingEntry = entries.find(
      (e: { description: string }) =>
        e.description === "Conscia - LoveSac Project Kickoff",
    );
    expect(meetingEntry).toBeTruthy();
    expect(meetingEntry.duration_minutes).toBe(60);
    expect(meetingEntry.category).toBe("Meeting");
  });

  test("transcript download API returns SRT content", async ({ request }) => {
    const clientsRes = await request.get("/api/clients");
    const clients = await clientsRes.json();
    const conscia = clients.find((c: { name: string }) => c.name === "Conscia");

    const timesheetRes = await request.get(
      `/api/timesheet?clientId=${conscia.id}&from=2026-03-23T00:00:00Z&to=2026-03-29T23:59:59Z`,
    );
    const entries = await timesheetRes.json();
    const meetingEntry = entries.find(
      (e: { meeting_id: string | null }) => e.meeting_id !== null,
    );

    const transcriptRes = await request.get(
      `/api/meetings/${meetingEntry.meeting_id}/transcript`,
    );
    expect(transcriptRes.status()).toBe(200);
    expect(transcriptRes.headers()["content-type"]).toContain("text/plain");
    const text = await transcriptRes.text();
    expect(text).toContain("[Sana]");
    expect(text).toContain("[David]");
  });
});
