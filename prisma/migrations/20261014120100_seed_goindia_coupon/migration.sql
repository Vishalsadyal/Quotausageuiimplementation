-- Launch coupon: Pro Connect for a fixed ₹99 (one-time purchase, 30 days), once per user.
-- Editable / disable-able from Admin > Settings > Discount codes. Re-running is a no-op.
INSERT INTO "DiscountCode" ("id", "code", "description", "type", "target", "fixedPriceRupees", "usageLimitPerUser", "usedCount", "active", "createdAt", "updatedAt")
VALUES ('seed_goindia', 'GOINDIA', 'Launch offer: Pro Connect for ₹99 (30 days)', 'fixed_price', 'plan_connect', 99, 1, 0, true, NOW(), NOW())
ON CONFLICT ("code") DO NOTHING;
