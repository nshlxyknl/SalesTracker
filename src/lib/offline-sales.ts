import { generateLocalId, isOnline, offlineStorage } from "./offline-storage";
import { queueSyncOperation, forceSyncNow } from "./sync-manager";

export type PendingSaleItem = {
  itemName: string;
  quantity: number;
  unitPrice: number;
};

export type PendingSalePayload = {
  localId: string;
  userId: string;
  billTitle: string;
  items: PendingSaleItem[];
  paymentMethod: string;
  billImageBase64: string | null;
  billImageName: string | null;
  createdAt: string;
  syncStatus: "pending" | "synced" | "failed";
};

const PENDING_SALES_KEY = "pending_sales_index";

async function readPendingIndex(): Promise<string[]> {
  const index = await offlineStorage.retrieve<string[]>(PENDING_SALES_KEY);
  return index ?? [];
}

async function writePendingIndex(localIds: string[]): Promise<void> {
  await offlineStorage.store(PENDING_SALES_KEY, localIds);
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function savePendingSale(params: {
  userId: string;
  billTitle: string;
  items: PendingSaleItem[];
  paymentMethod: string;
  billFile: File | null;
}): Promise<{ localId: string }> {
  const localId = generateLocalId();

  let billImageBase64: string | null = null;
  let billImageName: string | null = null;
  if (params.billFile && params.billFile.size > 0) {
    billImageBase64 = await fileToDataUrl(params.billFile);
    billImageName = params.billFile.name;
  }

  const payload: PendingSalePayload = {
    localId,
    userId: params.userId,
    billTitle: params.billTitle,
    items: params.items,
    paymentMethod: params.paymentMethod,
    billImageBase64,
    billImageName,
    createdAt: new Date().toISOString(),
    syncStatus: "pending",
  };

  await offlineStorage.store(`pending_sale:${localId}`, payload);

  const index = await readPendingIndex();
  if (!index.includes(localId)) {
    await writePendingIndex([localId, ...index]);
  }

  await queueSyncOperation({
    type: "CREATE",
    endpoint: "/api/sales",
    data: payload,
    maxRetries: 5,
  });

  return { localId };
}

export async function getPendingSales(userId?: string): Promise<PendingSalePayload[]> {
  const index = await readPendingIndex();
  const sales: PendingSalePayload[] = [];

  for (const localId of index) {
    const payload = await offlineStorage.retrieve<PendingSalePayload>(`pending_sale:${localId}`);
    if (payload && payload.syncStatus === "pending") {
      if (!userId || payload.userId === userId) {
        sales.push(payload);
      }
    }
  }

  return sales.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function markPendingSaleSynced(localId: string): Promise<void> {
  const payload = await offlineStorage.retrieve<PendingSalePayload>(`pending_sale:${localId}`);
  if (payload) {
    await offlineStorage.store(`pending_sale:${localId}`, {
      ...payload,
      syncStatus: "synced",
    });
  }
  const index = await readPendingIndex();
  await writePendingIndex(index.filter((id) => id !== localId));
}

/** Submit sale online directly, or queue for sync when offline. */
export async function submitSaleWithOfflineSupport(params: {
  userId: string;
  billTitle: string;
  items: PendingSaleItem[];
  paymentMethod: string;
  billFile: File | null;
}): Promise<{ ok: boolean; offline: boolean; error?: string }> {
  if (!isOnline()) {
    await savePendingSale(params);
    return { ok: true, offline: true };
  }

  const fd = new FormData();
  fd.append("billTitle", params.billTitle.trim() || "Untitled Bill");
  fd.append("items", JSON.stringify(params.items));
  fd.append("paymentMethod", params.paymentMethod);
  if (params.billFile && params.billFile.size > 0) {
    fd.append("billImage", params.billFile);
  }

  try {
    const res = await fetch("/api/sales", {
      method: "POST",
      body: fd,
      credentials: "include",
    });

    if (res.ok) {
      return { ok: true, offline: false };
    }

    const data = await res.json().catch(() => ({}));
    return { ok: false, offline: false, error: data.error ?? "Failed to save sale" };
  } catch {
    await savePendingSale(params);
    return { ok: true, offline: true };
  }
}

export async function syncPendingSalesNow(): Promise<void> {
  if (!isOnline()) {
    throw new Error("Cannot sync while offline");
  }
  await forceSyncNow();
}

/** Expand pending bills into line items for the sales table UI */
export function pendingSalesToDisplayRows(
  pending: PendingSalePayload[]
): Array<{
  id: string;
  billNumber: string;
  billTitle: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  paymentMethod: string;
  billImageBase64: string | null;
  createdAt: string;
  pendingSync: boolean;
}> {
  const rows: Array<{
    id: string;
    billNumber: string;
    billTitle: string;
    itemName: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
    paymentMethod: string;
    billImageBase64: string | null;
    createdAt: string;
    pendingSync: boolean;
  }> = [];

  for (const bill of pending) {
    bill.items.forEach((item, index) => {
      rows.push({
        id: `${bill.localId}-${index}`,
        billNumber: `local-${bill.localId.slice(-6)}`,
        billTitle: bill.billTitle,
        itemName: item.itemName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalAmount: item.quantity * item.unitPrice,
        paymentMethod: bill.paymentMethod,
        billImageBase64: bill.billImageBase64,
        createdAt: bill.createdAt,
        pendingSync: true,
      });
    });
  }

  return rows;
}
