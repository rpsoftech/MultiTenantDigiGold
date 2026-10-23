-- Local dev only: gives each seeded tenant (see MainServerGo/internal/database/seed.go) a
-- different published storefront so the layout renderer, the Header block and the content
-- sections can be seen.
--
--   docker exec -i digigold_postgres psql -U admin -d digigold_db < scripts/seed-tenant-layouts.sql
--   docker exec digigold_redis redis-cli -a localredispass --no-auth-warning \
--     del "digiGold:tenant/full/tenant_uuid/<uuid>" "digiGold:tenant/full/tenant_short_name/<short>"
--
-- The API caches tenants in Redis for 30 minutes and this script bypasses its invalidation,
-- so clear the keys above (or publish through PATCH /admin/tenants/{uuid}/ui-layout instead).
-- The layout lives under "layout" next to the theme, so a tenant keeps its colours.
-- Re-running is safe: it just overwrites tenant_ui_json_config.

-- Platform tenant: every block. Promo, categories, essentials and products carry the
-- tenant's own content; the BuyGold block has no props.
UPDATE tenants SET tenant_ui_json_config = $json$
{
  "layout": [
    { "id": "header", "type": "Header", "variant": "1",
      "props": { "brandName": "DigiGold Platform" } },
    { "id": "promo", "type": "PromoCarousel", "variant": "1",
      "props": { "autoplayIntervalMs": 4000, "slides": [
        { "id": "s1", "imageUrl": "/marketplace/banner-11.jpg", "imageAlt": "Platform festive offer", "linkUrl": "/jewellery" },
        { "id": "s2", "imageUrl": "/marketplace/banner-12.jpg", "imageAlt": "Platform gold savings", "linkUrl": "/vault" }
      ] } },
    { "id": "hero", "type": "Hero", "variant": "1",
      "props": { "title": "Invest in 24K Digital Gold", "subtitle": "Secure, transparent, and instantly redeemable.", "ctaText": "Buy Gold" } },
    { "id": "rate", "type": "LiveRate", "variant": "1", "props": {} },
    { "id": "actions", "type": "QuickActions", "variant": "1", "props": { "showDelivery": true } },
    { "id": "categories", "type": "CategoryCarousel", "variant": "1",
      "props": { "title": "Platform collections", "categories": [
        { "id": "rings", "label": "Rings", "imageUrl": "/marketplace/categories/rings.jpg", "imageAlt": "Rings", "url": "/jewellery" },
        { "id": "chains", "label": "Chains", "imageUrl": "/marketplace/categories/chain.jpg", "imageAlt": "Chains", "url": "/jewellery" },
        { "id": "bangles", "label": "Bangles", "imageUrl": "/marketplace/categories/bangles.jpg", "imageAlt": "Bangles", "url": "/jewellery" }
      ] } },
    { "id": "essentials", "type": "DashboardEssentials", "variant": "1",
      "props": { "title": "Your gold, your way", "items": [
        { "id": "passbook", "title": "My Passbook", "description": "Ledger and redemptions.", "url": "/vault/passbook", "icon": "wallet", "module": "vault" },
        { "id": "shop", "title": "Explore Jewellery", "description": "Redeem gold for pieces.", "url": "/jewellery", "icon": "gem", "module": "ecommerce" }
      ] } },
    { "id": "trending", "type": "TrendingJewelry", "variant": "1",
      "props": { "title": "Platform picks", "subtitle": "Chosen by the platform team.", "products": [
        { "id": "p1", "title": "Heritage Necklace 24K", "imageUrl": "/marketplace/heritage-necklace-24k.jpg", "price": 185000, "currency": "INR", "isNew": true, "href": "/jewellery" },
        { "id": "p2", "title": "Minimalist Bengal 24K", "imageUrl": "/marketplace/minimalist-bengal1-24k.jpg", "price": 92000, "currency": "INR", "href": "/jewellery" }
      ] } },
    { "id": "portfolio", "type": "PortfolioSummary", "variant": "1", "props": {} },
    { "id": "buy", "type": "BuyGold", "variant": "1", "props": {} }
  ]
}
$json$::jsonb
WHERE tenant_uuid = '01900000-0000-7000-8000-000000000001';

-- Demo tenant: trading focus (rate first), a custom dark hero, its own brand name and theme.
-- The sections here publish no content of their own, so they use the built-in content.
UPDATE tenants SET tenant_ui_json_config = $json$
{
  "theme": { "colors": { "primary": "#B91C1C", "secondary": "#1F2937", "tertiary": "#991B1B", "neutral": "#FEF2F2" } },
  "layout": [
    { "id": "header", "type": "Header", "variant": "1",
      "props": { "brandName": "Demo Jewellers" } },
    { "id": "rate", "type": "LiveRate", "variant": "1", "props": {} },
    { "id": "hero", "type": "Hero", "variant": "1",
      "props": { "title": "Flash sale on digital gold", "subtitle": "Buy the dip with Demo Jewellers.", "ctaText": "Trade now", "backgroundColor": "#7F1D1D" } },
    { "id": "actions", "type": "QuickActions", "variant": "1", "props": { "showDelivery": false } },
    { "id": "promo", "type": "PromoCarousel", "variant": "1", "props": {} },
    { "id": "trending", "type": "TrendingJewelry", "variant": "1", "props": {} }
  ]
}
$json$::jsonb
WHERE tenant_uuid = '01900000-0000-7000-8000-000000000002';

-- Other tenant: a light hero, portfolio first, its own essentials, and entries the renderer
-- must skip safely (an unsupported block type, a malformed item, an invalid slide, an
-- external link) plus a header with an unsafe logo URL.
UPDATE tenants SET tenant_ui_json_config = $json$
{
  "theme": { "colors": { "primary": "#047857", "secondary": "#064E3B", "tertiary": "#065F46", "neutral": "#ECFDF5" } },
  "layout": [
    { "id": "header", "type": "Header", "variant": "1",
      "props": { "brandName": "Other Jewellers", "logoUrl": "javascript:alert(1)" } },
    { "id": "portfolio", "type": "PortfolioSummary", "variant": "1", "props": {} },
    { "id": "carousel", "type": "Carousel", "variant": "1", "props": {} },
    "not a block",
    { "id": "hero", "type": "Hero", "variant": "1",
      "props": { "title": "Gold, the Other Jewellers way", "subtitle": "Save a little every day.", "ctaText": "Start saving", "backgroundColor": "#D1FAE5" } },
    { "id": "promo", "type": "PromoCarousel", "variant": "1",
      "props": { "slides": [
        { "id": "ok", "imageUrl": "/marketplace/banner-12.jpg", "imageAlt": "Other Jewellers offer", "linkUrl": "https://evil.example" },
        { "id": "bad", "imageUrl": "http://insecure.example/x.png" }
      ] } },
    { "id": "essentials", "type": "DashboardEssentials", "variant": "1",
      "props": { "title": "Other Jewellers essentials", "items": [
        { "id": "vault", "title": "Open my vault", "description": "See your gold.", "url": "/vault", "icon": "coins", "module": "vault" },
        { "id": "ext", "title": "External", "url": "https://evil.example" }
      ] } },
    { "id": "rate", "type": "LiveRate", "variant": "1", "props": {} }
  ]
}
$json$::jsonb
WHERE tenant_uuid = '01900000-0000-7000-8000-000000000003';

SELECT tenant_short_name, jsonb_array_length(tenant_ui_json_config -> 'layout') AS blocks
FROM tenants ORDER BY tenant_id;
