// Each item can have multiple price variants (e.g. retail, wholesale, special)
export interface PriceVariant {
  label: string;
  price: number;
}

export interface Item {
  name: string;
  variants: PriceVariant[];
}

export const ITEMS: Item[] = [
  {
    name: "NP-250 ml",
    variants: [
      { label: "Retail", price: 735 },
      { label: "Wholesale", price: 680 },
    ],
  },
  {
    name: "NP-600 ml",
    variants: [
      { label: "Retail", price: 1970 },
      { label: "Wholesale", price: 1800 },
    ],
  },
  {
    name: "NP-1 l",
    variants: [
      { label: "Retail", price: 775 },
      { label: "Wholesale", price: 720 },
    ],
  },
  {
    name: "NP-1.5 l",
    variants: [
      { label: "Retail", price: 1105 },
      { label: "Wholesale", price: 1020 },
    ],
  },
  {
    name: "NP-2.25 l",
    variants: [
      { label: "Retail", price: 1530 },
      { label: "Wholesale", price: 1400 },
    ],
  },
  {
    name: "joiner",
    variants: [
      { label: "Retail", price: 115 },
      { label: "Wholesale", price: 100 },
    ],
  },
  {
    name: "Fruit Gems",
    variants: [
      { label: "Retail", price: 70 },
      { label: "Wholesale", price: 60 },
    ],
  },
];
