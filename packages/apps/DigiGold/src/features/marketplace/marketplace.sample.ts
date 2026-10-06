// Which parts of the marketplace run on sample data (MainServer has no catalogue
// endpoints yet). Pages use these to label sample products as such.

// True when the jewellery category and product pages show the sample catalogue.
export function isJewellerySample(): boolean {
  return process.env.NEXT_PUBLIC_USE_MOCK_MARKETPLACE_CATEGORY === 'true';
}

// True when the home page's trending products and categories are sample data.
export function isMarketplaceSample(): boolean {
  return process.env.NEXT_PUBLIC_USE_MOCK_MARKETPLACE === 'true';
}
