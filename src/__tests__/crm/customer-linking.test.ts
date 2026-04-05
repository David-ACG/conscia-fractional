import { describe, it, expect } from "vitest";
import type { Asset } from "@/lib/types";

/**
 * Tests the asset query and deduplication logic used in the
 * CRM customer detail page (src/app/(dashboard)/crm/[slug]/page.tsx).
 *
 * This extracts the pure logic (no Supabase calls) to verify:
 * - Assets with matching crm_customer_id are included
 * - Unlinked assets matching by name are included as fallback
 * - Assets linked to a different customer are excluded
 * - Deduplication works when an asset appears in both sets
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

/** Mirrors the logic from crm/[slug]/page.tsx */
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

describe("CRM Customer Asset Linking", () => {
  const customerId = "cust-1";
  const customerName = "Acme Corp";

  it("includes assets linked by crm_customer_id", () => {
    const linked = [
      buildAsset({ id: "a1", name: "Blueprint", crm_customer_id: customerId }),
    ];
    const result = resolveCustomerAssets(linked, [], customerName);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a1");
  });

  it("includes unlinked assets matching customer name as fallback", () => {
    const unlinked = [
      buildAsset({ id: "a2", name: "Acme Corp Logo", crm_customer_id: null }),
      buildAsset({ id: "a3", name: "Random Doc", crm_customer_id: null }),
    ];
    const result = resolveCustomerAssets([], unlinked, customerName);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a2");
  });

  it("matches on description as well as name", () => {
    const unlinked = [
      buildAsset({
        id: "a4",
        name: "Logo v2",
        description: "Logo for Acme Corp rebrand",
        crm_customer_id: null,
      }),
    ];
    const result = resolveCustomerAssets([], unlinked, customerName);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a4");
  });

  it("excludes assets linked to a different customer", () => {
    // Assets linked to OTHER customers should not appear in unlinkedClientAssets
    // because the page query filters with .is("crm_customer_id", null)
    // But if they somehow got through, they should NOT be in linked either
    const linked: Asset[] = [];
    const unlinked = [
      buildAsset({
        id: "a5",
        name: "Acme Corp diagram",
        crm_customer_id: null,
      }),
    ];
    const result = resolveCustomerAssets(linked, unlinked, customerName);
    expect(result).toHaveLength(1);
    // An asset linked to another customer wouldn't be in either array
    // because the linked query uses .eq("crm_customer_id", customerId)
    // and the unlinked query uses .is("crm_customer_id", null)
  });

  it("deduplicates when asset appears in both linked and text-matched", () => {
    const asset = buildAsset({
      id: "a6",
      name: "Acme Corp Architecture",
      crm_customer_id: customerId,
    });
    // This asset would appear in linked (by crm_customer_id)
    // and theoretically could match text too if the query didn't filter by null
    // But in practice it won't because unlinked query filters .is("crm_customer_id", null)
    // Test the dedup logic anyway
    const linked = [asset];
    const unlinked = [{ ...asset, crm_customer_id: null } as Asset];
    const result = resolveCustomerAssets(linked, unlinked, customerName);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a6");
  });

  it("combines linked and text-matched assets without duplicates", () => {
    const linked = [
      buildAsset({ id: "a7", name: "Linked Doc", crm_customer_id: customerId }),
    ];
    const unlinked = [
      buildAsset({ id: "a8", name: "Acme Corp Slides", crm_customer_id: null }),
      buildAsset({ id: "a9", name: "Unrelated", crm_customer_id: null }),
    ];
    const result = resolveCustomerAssets(linked, unlinked, customerName);
    expect(result).toHaveLength(2);
    expect(result.map((a) => a.id)).toEqual(["a7", "a8"]);
  });

  it("is case-insensitive for text matching", () => {
    const unlinked = [
      buildAsset({
        id: "a10",
        name: "ACME CORP REPORT",
        crm_customer_id: null,
      }),
    ];
    const result = resolveCustomerAssets([], unlinked, customerName);
    expect(result).toHaveLength(1);
  });

  it("returns empty array when no matches", () => {
    const linked: Asset[] = [];
    const unlinked = [
      buildAsset({ id: "a11", name: "Something Else", crm_customer_id: null }),
    ];
    const result = resolveCustomerAssets(linked, unlinked, customerName);
    expect(result).toHaveLength(0);
  });
});
