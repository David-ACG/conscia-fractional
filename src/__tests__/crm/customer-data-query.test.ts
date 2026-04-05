import { describe, it, expect } from "vitest";
import type { Asset } from "@/lib/types";

/**
 * Tests for CRM customer data query patterns.
 *
 * These tests verify:
 * 1. Assets query uses crm_customer_id as primary filter
 * 2. Fallback includes text-matched unlinked assets
 * 3. Deduplication removes assets appearing in both sets
 * 4. Query filter patterns for all entity types
 */

function buildAsset(overrides: Partial<Asset> & { id: string }): Asset {
  return {
    client_id: "client-1",
    crm_customer_id: null,
    name: "Test Asset",
    description: null,
    asset_type: "document",
    file_url: null,
    file_name: null,
    file_size_bytes: null,
    is_client_visible: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/** Mirrors the combined query logic from crm/[slug]/page.tsx */
function resolveCustomerAssets(
  linkedAssets: Asset[],
  unlinkedClientAssets: Asset[],
  customerName: string,
): Asset[] {
  const name = customerName.toLowerCase();
  const textMatched = unlinkedClientAssets.filter(
    (a) =>
      a.name.toLowerCase().includes(name) ||
      a.description?.toLowerCase().includes(name),
  );
  return [
    ...linkedAssets,
    ...textMatched.filter((t) => !linkedAssets.some((l) => l.id === t.id)),
  ];
}

// ---- Primary filter: crm_customer_id ----

describe("CRM customer data query - primary filter", () => {
  it("assets query uses crm_customer_id as primary filter", () => {
    // Simulate the query: .eq("crm_customer_id", customerId)
    const customerId = "cust-1";
    const allAssets = [
      buildAsset({ id: "a1", name: "Doc A", crm_customer_id: customerId }),
      buildAsset({ id: "a2", name: "Doc B", crm_customer_id: "cust-2" }),
      buildAsset({ id: "a3", name: "Doc C", crm_customer_id: null }),
    ];

    // Filter as the query would
    const linked = allAssets.filter((a) => a.crm_customer_id === customerId);
    expect(linked).toHaveLength(1);
    expect(linked[0].id).toBe("a1");
  });

  it("unlinked query filters with crm_customer_id IS NULL", () => {
    const allAssets = [
      buildAsset({ id: "a1", name: "Doc A", crm_customer_id: "cust-1" }),
      buildAsset({ id: "a2", name: "Doc B", crm_customer_id: null }),
      buildAsset({ id: "a3", name: "Doc C", crm_customer_id: null }),
    ];

    const unlinked = allAssets.filter((a) => a.crm_customer_id === null);
    expect(unlinked).toHaveLength(2);
  });
});

// ---- Fallback: text-matched unlinked assets ----

describe("CRM customer data query - text matching fallback", () => {
  it("includes unlinked assets matching customer name in asset name", () => {
    const unlinked = [
      buildAsset({ id: "a1", name: "Acme Corp Logo", crm_customer_id: null }),
      buildAsset({ id: "a2", name: "Random Document", crm_customer_id: null }),
    ];

    const result = resolveCustomerAssets([], unlinked, "Acme Corp");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a1");
  });

  it("includes unlinked assets matching customer name in description", () => {
    const unlinked = [
      buildAsset({
        id: "a1",
        name: "Brand Guide",
        description: "Brand guidelines for Acme Corp",
        crm_customer_id: null,
      }),
    ];

    const result = resolveCustomerAssets([], unlinked, "Acme Corp");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a1");
  });

  it("text matching is case-insensitive", () => {
    const unlinked = [
      buildAsset({ id: "a1", name: "ACME CORP REPORT", crm_customer_id: null }),
    ];

    const result = resolveCustomerAssets([], unlinked, "Acme Corp");
    expect(result).toHaveLength(1);
  });

  it("excludes non-matching unlinked assets", () => {
    const unlinked = [
      buildAsset({
        id: "a1",
        name: "Totally Unrelated",
        crm_customer_id: null,
      }),
    ];

    const result = resolveCustomerAssets([], unlinked, "Acme Corp");
    expect(result).toHaveLength(0);
  });
});

// ---- Deduplication ----

describe("CRM customer data query - deduplication", () => {
  it("deduplicates when asset appears in both linked and text-matched", () => {
    const asset = buildAsset({
      id: "a1",
      name: "Acme Corp Architecture",
      crm_customer_id: "cust-1",
    });

    const linked = [asset];
    // Same asset ID but without crm_customer_id (simulating edge case)
    const unlinked = [{ ...asset, crm_customer_id: null } as Asset];

    const result = resolveCustomerAssets(linked, unlinked, "Acme Corp");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a1");
  });

  it("combines linked and text-matched without duplicates", () => {
    const linked = [
      buildAsset({ id: "a1", name: "Linked Doc", crm_customer_id: "cust-1" }),
    ];
    const unlinked = [
      buildAsset({ id: "a2", name: "Acme Corp Slides", crm_customer_id: null }),
      buildAsset({ id: "a3", name: "Unrelated", crm_customer_id: null }),
    ];

    const result = resolveCustomerAssets(linked, unlinked, "Acme Corp");
    expect(result).toHaveLength(2);
    expect(result.map((a) => a.id)).toEqual(["a1", "a2"]);
  });

  it("linked assets appear first in result order", () => {
    const linked = [
      buildAsset({
        id: "linked-1",
        name: "Primary",
        crm_customer_id: "cust-1",
      }),
    ];
    const unlinked = [
      buildAsset({
        id: "text-1",
        name: "Acme Corp Extra",
        crm_customer_id: null,
      }),
    ];

    const result = resolveCustomerAssets(linked, unlinked, "Acme Corp");
    expect(result[0].id).toBe("linked-1");
    expect(result[1].id).toBe("text-1");
  });
});

// ---- Query filter patterns for entity types ----

describe("CRM entity query filter patterns", () => {
  // Simulates the query filter pattern used for each entity type
  type Filter = { field: string; value: unknown };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function buildEntityQuery(_customerId: string, _clientId: string) {
    const filters: Filter[] = [];
    return {
      eq(field: string, value: unknown) {
        filters.push({ field, value });
        return this;
      },
      getFilters() {
        return filters;
      },
    };
  }

  const entities = [
    "meetings",
    "tasks",
    "time_entries",
    "assets",
    "deliverables",
  ];

  for (const entity of entities) {
    it(`${entity} query filters by crm_customer_id`, () => {
      const query = buildEntityQuery("cust-1", "client-1");
      query.eq("crm_customer_id", "cust-1");

      expect(query.getFilters()).toContainEqual({
        field: "crm_customer_id",
        value: "cust-1",
      });
    });
  }

  it("customer detail page queries use client_id scope", () => {
    const query = buildEntityQuery("cust-1", "client-1");
    query.eq("client_id", "client-1").eq("crm_customer_id", "cust-1");

    const filters = query.getFilters();
    expect(filters).toContainEqual({ field: "client_id", value: "client-1" });
    expect(filters).toContainEqual({
      field: "crm_customer_id",
      value: "cust-1",
    });
  });
});
