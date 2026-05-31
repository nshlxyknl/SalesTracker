// Each item can have multiple price variants (e.g. retail, wholesale, special)
export interface PriceVariant {
  label: string;
  price: number;
}

export interface CaseInfo {
  bottlesPerCase: number;
  casePrice?: number; // Optional case pricing
}

export interface Item {
  name: string;
  variants: PriceVariant[];
  caseInfo: CaseInfo;
}

export const ITEMS: Item[] = [
  {
    name: "NP-250 ml",
    variants: [
      { label: "Standard", price: 0 }, // Price will be user-entered
    ],
    caseInfo: { bottlesPerCase: 16 }
  },
  {
    name: "Cola-250 ml",
    variants: [
      { label: "Standard", price: 0 },
    ],
    caseInfo: { bottlesPerCase: 16 }
  },
  {
    name: "NP-600 ml",
    variants: [
      { label: "Standard", price: 0 },
    ],
    caseInfo: { bottlesPerCase: 24 }
  },
  {
    name: "NP-1 l",
    variants: [
      { label: "Standard", price: 0 },
    ],
    caseInfo: { bottlesPerCase: 6 }
  },
  {
    name: "NP-1.5 l",
    variants: [
      { label: "Standard", price: 0 },
    ],
    caseInfo: { bottlesPerCase: 6 }
  },
  {
    name: "NP-2.25 l",
    variants: [
      { label: "Standard", price: 0 },
    ],
    caseInfo: { bottlesPerCase: 6 }
  },
  {
    name: "Cola-1.5 l",
    variants: [
      { label: "Standard", price: 0 },
    ],
    caseInfo: { bottlesPerCase: 6 }
  },
  {
    name: "Cola-2.5 l",
    variants: [
      { label: "Standard", price: 0 },
    ],
    caseInfo: { bottlesPerCase: 6 }
  },
  {
    name: "Fruit Gems",
    variants: [
      { label: "Standard", price: 0 },
    ],
    caseInfo: { bottlesPerCase: 24 }
  },
  {
    name: "Joiner",
    variants: [
      { label: "Standard", price: 0 },
    ],
    caseInfo: { bottlesPerCase: 24 }
  },
  {
    name: "NPET-250ml",
    variants: [
      { label: "Standard", price: 0 },
    ],
    caseInfo: { bottlesPerCase: 24 }
  },
];

// Utility functions for case/bottle conversions
export const convertBottlesToCases = (bottles: number, bottlesPerCase: number) => {
  const cases = Math.floor(bottles / bottlesPerCase);
  const remainingBottles = bottles % bottlesPerCase;
  return { cases, bottles: remainingBottles };
};

export const convertCasesToBottles = (cases: number, bottles: number, bottlesPerCase: number) => {
  return (cases * bottlesPerCase) + bottles;
};

export const formatCaseBottleDisplay = (totalBottles: number, bottlesPerCase: number) => {
  const { cases, bottles } = convertBottlesToCases(totalBottles, bottlesPerCase);
  if (cases === 0) return `${bottles} bottles`;
  if (bottles === 0) return `${cases} cases`;
  return `${cases} cases + ${bottles} bottles`;
};

export const getItemByName = (name: string): Item | undefined => {
  return ITEMS.find(item => item.name === name);
};
