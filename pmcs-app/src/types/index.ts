export interface User {
  dodId: string;
  rank: string;
  lastName: string;
  firstName: string;
  mi: string;
  unit: string;
  defaultInspectionType?: InspectionType;
  theme?: 'dark' | 'light';
}

export type VehicleType = 'M1151' | 'M1152' | 'LMTV_M1078' | 'M1101_TRAILER' | 'MEP803A';

export interface VehicleRegistryEntry {
  type: VehicleType;
  name: string;
  nickname: string;
  tmReference: string;
  itemCount: number;
}

export interface Vehicle {
  id: string;
  type: VehicleType;
  bumperNumber: string;
  serialNumber?: string;
  registrationNumber?: string;
  odometer: number;
  unitAssigned?: string;
}

export type InspectionType = 'BEFORE' | 'DURING' | 'AFTER' | '30_DAY';
export type StepStatus = 'NOT_CHECKED' | 'GO' | 'FAULT';
export type SessionStatus = 'IN_PROGRESS' | 'COMPLETED';

export interface InspectionSession {
  id: string;
  date: string;
  vehicleId: string;
  vehicleType: VehicleType;
  bumperNumber: string;
  serialNumber?: string;
  registrationNumber?: string;
  odometer: number;
  inspectorDodId: string;
  inspectorRank: string;
  inspectorName: string;
  unit: string;
  inspectionType: InspectionType;
  status: SessionStatus;
  remarks?: string;
  supervisorName?: string;
  supervisorDodId?: string;
  createdAt: string;
  completedAt?: string;
}

export interface PmcsStepData {
  id: string;
  sequence: number;
  zone: string;
  zoneId: string;
  item: string;
  itemDescription: string;
  procedure: string;
  conditionSet: string;
  isNoGo: boolean;
  noGoCondition?: string;
}

export interface StepResult {
  id: string;
  sessionId: string;
  stepId: string;
  sequence: number;
  zone: string;
  itemDescription: string;
  status: StepStatus;
  checkedAt?: string;
}

export interface Fault {
  id: string;
  sessionId: string;
  vehicleId: string;
  stepId: string;
  zone: string;
  item: string;
  itemDescription: string;
  categoryId: string;
  readiness: 'PMC' | 'NMC';
  description: string;
  tmReference?: string;
  partNeeded: boolean;
  partDescription?: string;
  nsn?: string;
  correctedOnSite: boolean;
  correctiveAction?: string;
  needsMaintenance: boolean;
  createdAt: string;
}

export interface FaultPhoto {
  id: string;
  faultId: string;
  sessionId: string;
  dataUrl: string;
  createdAt: string;
}

export interface PmcsZone {
  id: string;
  name: string;
  description: string;
  steps: PmcsStepData[];
}

export interface PmcsVehicleData {
  vehicleType: string;
  tmReference: string;
  zones: PmcsZone[];
}
