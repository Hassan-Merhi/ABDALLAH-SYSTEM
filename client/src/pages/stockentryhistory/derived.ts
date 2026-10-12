export interface StockEntryWorker {
  id: number;
  active: boolean;
  fullName?: string;
  full_name?: string;
  name?: string;
}

export interface WorkerCategory {
  id: number;
  workerIds?: number[];
}
