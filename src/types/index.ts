export interface User {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  companyId: string;
  locationId?: string;
  regionId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  ADMIN = 'admin',
  COMPANY_OWNER = 'company_owner',
  COMPANY_MANAGER = 'company_manager',
  REGION_MANAGER = 'region_manager',
  LAB_MANAGER = 'lab_manager',
  USER = 'user',
  VIEWER = 'viewer'
}

export interface Company {
  id: string;
  name: string;
  logo?: string;
  theme?: CompanyTheme;
  subscription: Subscription;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompanyTheme {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
}

export interface Subscription {
  id: string;
  companyId: string;
  plan: 'monthly' | 'yearly';
  status: 'active' | 'suspended' | 'cancelled';
  startDate: Date;
  endDate: Date;
  itemCount: number;
  monthlyFee: number;
  perItemFee: number;
}

export interface Location {
  id: string;
  companyId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  parentLocationId?: string;
  level: 'company' | 'region' | 'office' | 'lab';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryItem {
  id: string;
  companyId: string;
  locationId: string;
  itemType: string;
  nickname?: string;
  labId?: string;
  make: string;
  model: string;
  serialNumber: string;
  dateReceived: Date;
  datePlacedInService: Date;
  location: string;
  calibrationDate?: Date;
  nextCalibrationDue: Date;
  calibrationInterval: number; // in days
  calibrationMethod: string;
  maintenanceDate?: Date;
  maintenanceDue: Date;
  maintenanceInterval: number; // in days
  isOutsourced: boolean;
  isOutOfService: boolean;
  outOfServiceDate?: Date;
  outOfServiceReason?: string;
  notes?: string;
  image?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CalibrationRecord {
  id: string;
  itemId: string;
  userId: string;
  calibrationDate: Date;
  nextCalibrationDue: Date;
  method: string;
  results: string;
  certificate?: string;
  notes?: string;
  createdAt: Date;
}

export interface MaintenanceRecord {
  id: string;
  itemId: string;
  userId: string;
  maintenanceDate: Date;
  nextMaintenanceDue: Date;
  type: string;
  description: string;
  parts?: string;
  cost?: number;
  notes?: string;
  createdAt: Date;
}

export interface ChangelogEntry {
  id: string;
  itemId: string;
  userId: string;
  action: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  timestamp: Date;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'calibration_due' | 'maintenance_due' | 'overdue' | 'system';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}

export interface InviteCode {
  id: string;
  companyId: string;
  code: string;
  role: UserRole;
  locationId?: string;
  regionId?: string;
  expiresAt: Date;
  isUsed: boolean;
  createdAt: Date;
}
