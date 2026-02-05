
export interface FieldDefinition {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select';
  options?: string[]; // For select type
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  purchaseDate: string;
  // PocketBase stores JSON in a specific field, we'll parse it
  customValues: Record<string, string | number>; 
  created?: string;
  updated?: string;
}

export interface StockOutRecord {
  id: string;
  name: string;
  quantity: number;
  totalCost: number; // Calculated based on FIFO
  date: string;
  notes?: string; 
}

export type UserRole = 'manager' | 'warehouse';

export interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  avatar?: string;
  role: UserRole; // 'manager' or 'warehouse'
}
