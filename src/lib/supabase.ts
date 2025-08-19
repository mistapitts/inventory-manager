import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Database types
export interface InventoryItem {
  id: string;
  companyId: string;
  itemType: string;
  nickname?: string;
  labId?: string;
  make: string;
  model: string;
  serialNumber: string;
  condition: string;
  dateReceived: string;
  datePlacedInService: string;
  location: string;
  calibrationDate?: string;
  nextCalibrationDue: string;
  calibrationInterval: number;
  calibrationIntervalType: string;
  calibrationMethod: string;
  maintenanceDate?: string;
  maintenanceDue?: string;
  maintenanceInterval?: number;
  maintenanceIntervalType?: string;
  isOutsourced: boolean;
  isOutOfService: boolean;
  outOfServiceDate?: string;
  outOfServiceReason?: string;
  notes?: string;
  image?: string;
  listId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface List {
  id: string;
  companyId: string;
  name: string;
  color: string;
  textColor: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  companyId: string;
  regionId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
