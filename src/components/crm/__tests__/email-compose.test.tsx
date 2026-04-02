import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { EmailCompose, type ReplyContext } from "../email-compose";

// ──────────────────────────────────────────────────────────
// Mocks
// ──────────────────────────────────────────────────────────

const mockFetch = vi.fn();
global.fetch = mockFetch;

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { toast } from "sonner";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

function mockFetchSequence(
  responses: { urlFragment: string; body: unknown; ok?: boolean }[],
) {
  mockFetch.mockImplementation((url: string, init?: RequestInit) => {
    const match = responses.find((r) => url.includes(r.urlFragment));
    if (!match) {
      return Promise.resolve({
        ok: false,
        json: async () => ({ error: "not found" }),
      });
    }
    return Promise.resolve({
      ok: match.ok !== false,
      status: match.ok !== false ? 200 : 400,
      json: async () => match.body,
    });
  });
}

const defaultIntegrations = {
  integrations: [{ id: "int-1", account_identifier: "user@gmail.com" }],
  sendIntegrations: [{ id: "int-1", account_identifier: "user@gmail.com" }],
};

const defaultContacts = {
  contacts: [{ email: "alice@acme.com", name: "Alice" }],
};

const defaultReply: ReplyContext = {
  messageId: "msg-1",
  threadId: "thread-1",
  subject: "Original Subject",
  from: "sender@example.com",
  snippet: "This is the original message content",
  inReplyTo: "<msg-id-1@mail.gmail.com>",
  references: "<msg-id-1@mail.gmail.com>",
};

function renderCompose(
  props: Partial<Parameters<typeof EmailCompose>[0]> = {},
) {
  return render(
    <EmailCompose
      customerId="customer-1"
      open={true}
      onOpenChange={vi.fn()}
      {...props}
    />,
  );
}

// ──────────────────────────────────────────────────────────
// Tests: Basic rendering
// ──────────────────────────────────────────────────────────

describe("EmailCompose — basic rendering", () => {
  it("renders compose form with To pre-populated from contacts", async () => {
    mockFetchSequence([
      { urlFragment: "gmail/integrations", body: defaultIntegrations },
      { urlFragment: "contacts", body: defaultContacts },
    ]);

    renderCompose();

    await waitFor(() => {
      const toInput = screen.getByTestId("compose-to-input");
      expect(toInput).toHaveValue("alice@acme.com");
    });
  });

  it("shows no-send-access message when no send integrations", async () => {
    mockFetchSequence([
      {
        urlFragment: "gmail/integrations",
        body: { integrations: [], sendIntegrations: [] },
      },
      { urlFragment: "contacts", body: defaultContacts },
    ]);

    renderCompose();

    await waitFor(() => {
      expect(screen.getByTestId("no-send-access")).toBeInTheDocument();
    });

    expect(
      screen.getByText(/No Gmail account with send access/),
    ).toBeInTheDocument();
  });

  it("shows from selector when multiple send integrations", async () => {
    mockFetchSequence([
      {
        urlFragment: "gmail/integrations",
        body: {
          integrations: [
            { id: "int-1", account_identifier: "first@gmail.com" },
            { id: "int-2", account_identifier: "second@gmail.com" },
          ],
          sendIntegrations: [
            { id: "int-1", account_identifier: "first@gmail.com" },
            { id: "int-2", account_identifier: "second@gmail.com" },
          ],
        },
      },
      { urlFragment: "contacts", body: defaultContacts },
    ]);

    renderCompose();

    await waitFor(() => {
      expect(screen.getByTestId("compose-from-select")).toBeInTheDocument();
    });
  });
});

// ──────────────────────────────────────────────────────────
// Tests: Reply mode
// ──────────────────────────────────────────────────────────

describe("EmailCompose — reply mode", () => {
  it("pre-fills subject with Re: prefix", async () => {
    mockFetchSequence([
      { urlFragment: "gmail/integrations", body: defaultIntegrations },
      { urlFragment: "contacts", body: defaultContacts },
    ]);

    renderCompose({ replyTo: defaultReply });

    await waitFor(() => {
      const subjectInput = screen.getByTestId("compose-subject-input");
      expect(subjectInput).toHaveValue("Re: Original Subject");
    });
  });

  it("does not double Re: prefix", async () => {
    mockFetchSequence([
      { urlFragment: "gmail/integrations", body: defaultIntegrations },
      { urlFragment: "contacts", body: defaultContacts },
    ]);

    renderCompose({
      replyTo: { ...defaultReply, subject: "Re: Already prefixed" },
    });

    await waitFor(() => {
      const subjectInput = screen.getByTestId("compose-subject-input");
      expect(subjectInput).toHaveValue("Re: Already prefixed");
    });
  });

  it("includes quoted original snippet in body", async () => {
    mockFetchSequence([
      { urlFragment: "gmail/integrations", body: defaultIntegrations },
      { urlFragment: "contacts", body: defaultContacts },
    ]);

    renderCompose({ replyTo: defaultReply });

    await waitFor(() => {
      const bodyTextarea = screen.getByTestId(
        "compose-body-textarea",
      ) as HTMLTextAreaElement;
      expect(bodyTextarea.value).toContain("--- Original message ---");
      expect(bodyTextarea.value).toContain(
        "This is the original message content",
      );
    });
  });

  it("pre-fills To with sender of original email", async () => {
    mockFetchSequence([
      { urlFragment: "gmail/integrations", body: defaultIntegrations },
      { urlFragment: "contacts", body: defaultContacts },
    ]);

    renderCompose({ replyTo: defaultReply });

    await waitFor(() => {
      // When contacts exist, it renders a select. The reply from address
      // may be set via the select or input depending on contacts count.
      const toInput = screen.getByTestId("compose-to-input");
      expect(toInput).toHaveValue("sender@example.com");
    });
  });
});

// ──────────────────────────────────────────────────────────
// Tests: Send and Draft
// ──────────────────────────────────────────────────────────

describe("EmailCompose — send email", () => {
  it("calls send API on Send button click", async () => {
    mockFetchSequence([
      { urlFragment: "gmail/integrations", body: defaultIntegrations },
      { urlFragment: "contacts", body: defaultContacts },
      { urlFragment: "gmail/send", body: { message_id: "sent-1" } },
    ]);

    const onSent = vi.fn();
    renderCompose({ onSent });

    // Wait for form to load
    await waitFor(() => {
      expect(screen.getByTestId("compose-to-input")).toBeInTheDocument();
    });

    // Fill in subject (To is pre-populated)
    fireEvent.change(screen.getByTestId("compose-subject-input"), {
      target: { value: "Test Subject" },
    });

    fireEvent.change(screen.getByTestId("compose-body-textarea"), {
      target: { value: "Test body" },
    });

    fireEvent.click(screen.getByTestId("compose-send"));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Email sent");
    });
  });

  it("calls draft API on Save Draft button click", async () => {
    mockFetchSequence([
      { urlFragment: "gmail/integrations", body: defaultIntegrations },
      { urlFragment: "contacts", body: defaultContacts },
      { urlFragment: "gmail/draft", body: { draft_id: "draft-1" } },
    ]);

    renderCompose();

    await waitFor(() => {
      expect(screen.getByTestId("compose-to-input")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId("compose-subject-input"), {
      target: { value: "Draft Subject" },
    });

    fireEvent.click(screen.getByTestId("compose-save-draft"));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Draft saved to Gmail");
    });
  });
});

// ──────────────────────────────────────────────────────────
// Tests: Validation
// ──────────────────────────────────────────────────────────

describe("EmailCompose — validation", () => {
  it("shows error toast when To is empty", async () => {
    mockFetchSequence([
      { urlFragment: "gmail/integrations", body: defaultIntegrations },
      { urlFragment: "contacts", body: { contacts: [] } },
    ]);

    renderCompose();

    await waitFor(() => {
      expect(screen.getByTestId("compose-to-input")).toBeInTheDocument();
    });

    // Clear the To field and set a subject
    fireEvent.change(screen.getByTestId("compose-to-input"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByTestId("compose-subject-input"), {
      target: { value: "Subject" },
    });

    fireEvent.click(screen.getByTestId("compose-send"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("To and Subject are required");
    });
  });

  it("shows error toast when Subject is empty", async () => {
    mockFetchSequence([
      { urlFragment: "gmail/integrations", body: defaultIntegrations },
      { urlFragment: "contacts", body: defaultContacts },
    ]);

    renderCompose();

    await waitFor(() => {
      expect(screen.getByTestId("compose-to-input")).toBeInTheDocument();
    });

    // Subject is initially empty, don't set it
    fireEvent.click(screen.getByTestId("compose-send"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("To and Subject are required");
    });
  });
});

// ──────────────────────────────────────────────────────────
// Tests: Error handling
// ──────────────────────────────────────────────────────────

describe("EmailCompose — error handling", () => {
  it("shows error toast on send failure", async () => {
    mockFetchSequence([
      { urlFragment: "gmail/integrations", body: defaultIntegrations },
      { urlFragment: "contacts", body: defaultContacts },
      {
        urlFragment: "gmail/send",
        body: { error: "Gmail rate limit exceeded" },
        ok: false,
      },
    ]);

    renderCompose();

    await waitFor(() => {
      expect(screen.getByTestId("compose-to-input")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId("compose-subject-input"), {
      target: { value: "Subject" },
    });

    fireEvent.click(screen.getByTestId("compose-send"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Gmail rate limit exceeded");
    });
  });
});
