import { openDB } from 'idb';

const DB_NAME = 'kpi-dashboard';
const STORE_NAME = 'csv-data';

export async function initDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
}

export async function saveData(key: string, data: any): Promise<void> {
  try {
    const db = await initDB();
    await db.put(STORE_NAME, data, key);
  } catch (error) {
    console.warn(`Failed to save data for ${key} to IndexedDB`, error);
  }
}

export async function loadData(key: string): Promise<any | null> {
  try {
    const db = await initDB();
    const data = await db.get(STORE_NAME, key);
    return data || null;
  } catch (error) {
    console.warn(`Failed to load data for ${key} from IndexedDB`, error);
    return null;
  }
}

export async function deleteData(key: string): Promise<void> {
  try {
    const db = await initDB();
    await db.delete(STORE_NAME, key);
  } catch (error) {
    console.warn(`Failed to delete data for ${key} from IndexedDB`, error);
  }
}

export async function clearAllData(): Promise<void> {
  try {
    const db = await initDB();
    await db.clear(STORE_NAME);
  } catch (error) {
    console.warn(`Failed to clear IndexedDB`, error);
  }
}

export async function listKeys(): Promise<string[]> {
  try {
    const db = await initDB();
    const keys = await db.getAllKeys(STORE_NAME);
    return keys.map(k => String(k));
  } catch (error) {
    console.warn(`Failed to list keys from IndexedDB`, error);
    return [];
  }
}

export async function getStorageSize(): Promise<number> {
  try {
    const db = await initDB();
    const allData = await db.getAll(STORE_NAME);
    const sizeBytes = new Blob([JSON.stringify(allData)]).size;
    return Number((sizeBytes / (1024 * 1024)).toFixed(2));
  } catch (error) {
    console.warn(`Failed to calculate storage size`, error);
    return 0;
  }
}
