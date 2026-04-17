import type { Page, Route } from "@playwright/test";

export type TrelloMockState = {
  boards: { id: string; name: string; url: string }[];
  listsByBoard: Record<string, { id: string; name: string; pos: number }[]>;
  cardPostCount: number;
  rateLimitFirstCall?: boolean;
  rateLimitCalls: number;
};

export function createTrelloMocks(): TrelloMockState {
  return {
    boards: [{ id: "b1", name: "FractionalBuddy Board", url: "https://trello.com/b/b1" }],
    listsByBoard: {
      b1: [
        { id: "l_todo", name: "To Do", pos: 1 },
        { id: "l_doing", name: "Doing", pos: 2 },
        { id: "l_done", name: "Done", pos: 3 },
      ],
    },
    cardPostCount: 0,
    rateLimitCalls: 0,
  };
}

export async function installTrelloRoutes(
  page: Page,
  state: TrelloMockState,
): Promise<void> {
  await page.route("**/api.trello.com/1/members/me/boards**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(state.boards),
    });
  });

  await page.route("**/api.trello.com/1/boards/*/lists**", async (route: Route) => {
    const url = new URL(route.request().url());
    const match = /\/boards\/([^/]+)\/lists/.exec(url.pathname);
    const boardId = match?.[1] ?? "";
    const lists = state.listsByBoard[boardId] ?? [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(lists),
    });
  });

  await page.route("**/api.trello.com/1/cards**", async (route: Route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    state.cardPostCount++;
    if (state.rateLimitFirstCall && state.rateLimitCalls === 0) {
      state.rateLimitCalls++;
      await route.fulfill({
        status: 429,
        headers: { "Retry-After": "1" },
        contentType: "application/json",
        body: JSON.stringify({ error: "rate_limited" }),
      });
      return;
    }
    state.rateLimitCalls++;
    const id = `c_${Date.now()}_${state.cardPostCount}`;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id }),
    });
  });
}
