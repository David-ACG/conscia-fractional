#!/bin/bash
set -e

echo "=== Running Portal Unit Tests ==="
npx vitest run src/__tests__/actions/portal-actions.test.ts src/__tests__/crm/customer-data-query.test.ts src/__tests__/portal/ src/__tests__/settings/portal-sharing.test.tsx

echo ""
echo "=== Running Portal E2E Tests ==="
npx playwright test src/__tests__/e2e/portal.spec.ts src/__tests__/e2e/crm-linking.spec.ts src/__tests__/e2e/portal-settings.spec.ts

echo ""
echo "=== All portal tests complete ==="
