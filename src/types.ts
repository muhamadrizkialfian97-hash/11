export type EmployeeStatus = 'Active' | 'Onboarding' | 'Suspended';

export interface Employee {
  id: string;
  name: string;
  role: string;
  department: string;
  email: string;
  phone: string;
  status: EmployeeStatus;
  joinedAt: string; // ISO format date (YYYY-MM-DD)
  createdBy: string;
  createdAt: any; // Firebase serverTimestamp
  updatedAt?: any; // Firebase serverTimestamp
}

export interface EmployeeFormInput {
  name: string;
  role: string;
  department: string;
  email: string;
  phone: string;
  status: EmployeeStatus;
  joinedAt: string;
}
