export type Product = {
  id: string;
  code: string;
  title: string;
  imageUrl: string;
  imageAlt: string;
  price: number;
  currency: string;
  weight: number;
  carat: '18KT Gold' | '22KT Gold' | '9KT Gold';
  color: 'Rose' | 'Yellow';
  category: string;
  designType: string;
  gender: 'Ladies';
  collection: string;
  gifts: 'For Her' | 'For Him';
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
