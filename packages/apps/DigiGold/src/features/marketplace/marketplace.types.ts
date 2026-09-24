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
  isNew: boolean;
  url: string;
};

export type Category = {
  id: string;
  label: string;
  imageUrl: string;
  imageAlt: string;
  url: string;
};
