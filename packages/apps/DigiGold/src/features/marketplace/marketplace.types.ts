export type Product = {
  id: string;
  code: string;
  title: string;
  imageUrl: string;
  imageAlt: string;
  price: number;
  currency: string;
  weight: number; // grams
  // Open-ended catalogue attributes (e.g. "22KT Gold", "Rose", "Ladies", "For Her"): the
  // filters are built from whatever values the loaded products carry.
  carat: string;
  color: string;
  // Display label, e.g. "Chain Pendant".
  category: string;
  // Catalogue id used in URLs (JEWELLERY_CATEGORIES), e.g. "chain-pendant".
  categoryId: string;
  designType: string;
  gender: string;
  collection: string;
  gifts: string;
  // Only shown as a certification claim when the catalogue says so — never assumed.
  isBisHallmarked?: boolean;
  isNew: boolean;
};

export type Category = {
  id: string;
  label: string;
  imageUrl: string;
  imageAlt: string;
  url: string;
};
