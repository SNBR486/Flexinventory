import PocketBase from 'pocketbase';
import { FieldDefinition, InventoryItem, StockOutRecord } from '../types';

const normalizeBaseUrl = (url: string): string => url.trim().replace(/\/+$/, '');

const resolvePocketBaseUrl = (): string => {
  const fromEnv = (import.meta as any).env?.VITE_POCKETBASE_URL;
  if (fromEnv) return normalizeBaseUrl(fromEnv);

  if (typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location;

    // If frontend is already served by PocketBase static hosting (default 8090),
    // keep same-origin to avoid mixed-origin/cors surprises.
    if (port === '8090') {
      return normalizeBaseUrl(`${protocol}//${hostname}:8090`);
    }

    // Dev server (e.g. 3000/5173) -> target PocketBase on the same LAN host.
    return normalizeBaseUrl(`${protocol}//${hostname}:8090`);
  }

  return 'http://127.0.0.1:8090';
};

export const pb = new PocketBase(resolvePocketBaseUrl());

const mapInventory = (r: any): InventoryItem => ({
  id: r.id,
  name: r.name || '',
  quantity: Number(r.quantity || 0),
  price: Number(r.price || 0),
  purchaseDate: r.purchaseDate || '',
  customValues: r.customValues && typeof r.customValues === 'object' ? r.customValues : {},
  created: r.created,
  updated: r.updated,
});

const mapField = (r: any): FieldDefinition => ({
  id: r.id,
  name: r.name || '',
  type: (r.type || 'text') as FieldDefinition['type'],
  options: Array.isArray(r.options) ? r.options : undefined,
});

const mapStockRecord = (r: any): StockOutRecord => ({
  id: r.id,
  name: r.name || '',
  quantity: Number(r.quantity || 0),
  totalCost: Number(r.totalCost || 0),
  date: r.date || '',
  notes: r.notes,
});

export const getItems = async (): Promise<InventoryItem[]> => {
  const list = await pb.collection('inventory').getFullList({ sort: '-purchaseDate,-created' });
  return list.map(mapInventory);
};

export const saveItem = async (item: Partial<InventoryItem>): Promise<InventoryItem> => {
  const payload = {
    name: item.name,
    quantity: Number(item.quantity || 0),
    price: Number(item.price || 0),
    purchaseDate: item.purchaseDate,
    customValues: item.customValues || {},
  };

  const record = item.id
    ? await pb.collection('inventory').update(item.id, payload)
    : await pb.collection('inventory').create(payload);

  return mapInventory(record);
};

export const deleteItem = async (id: string): Promise<void> => {
  await pb.collection('inventory').delete(id);
};

export const getFields = async (): Promise<FieldDefinition[]> => {
  const list = await pb.collection('fields').getFullList({ sort: 'created' });
  return list.map(mapField);
};

export const createField = async (field: Partial<FieldDefinition>): Promise<FieldDefinition> => {
  const record = await pb.collection('fields').create({
    name: field.name,
    type: field.type || 'text',
    options: field.options || [],
  });

  return mapField(record);
};

export const deleteField = async (id: string): Promise<void> => {
  await pb.collection('fields').delete(id);
};

export const getStockOutRecords = async (): Promise<StockOutRecord[]> => {
  const list = await pb.collection('stock_records').getFullList({ sort: '-date,-created' });
  return list.map(mapStockRecord);
};

export const createStockOutRecord = async (
  record: Partial<StockOutRecord>,
): Promise<StockOutRecord> => {
  const created = await pb.collection('stock_records').create({
    name: record.name,
    quantity: Number(record.quantity || 0),
    totalCost: Number(record.totalCost || 0),
    date: record.date,
    notes: record.notes || '',
  });

  return mapStockRecord(created);
};

export const logout = (): void => {
  pb.authStore.clear();
};
