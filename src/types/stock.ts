/** Van load fields used for stock calculations (API routes) */
export type VanLoadStock = {
  itemName: string;
  loaded: number;
  returned: number;
  casePrice: number;
  schemeBottles: number;
};

export type VanLoadWithUser = VanLoadStock & {
  id: string;
  userId: string;
  date: Date | string;
  user: { username: string };
};

/** Sale fields used for stock / quantity calculations */
export type SaleQuantity = {
  itemName: string;
  quantity: number;
};

export type SaleRecord = SaleQuantity & {
  id: string;
  billNumber: string;
  billTitle: string;
  unitPrice: number;
  totalAmount: number;
  paymentMethod: string;
  createdAt: Date;
  userId: string;
  user?: { username: string };
};

export type SaleWithUser = SaleRecord & {
  user: {
    id: string;
    username: string;
  };
};
