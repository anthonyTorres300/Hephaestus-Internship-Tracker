import type { FormState } from "@/components/forms/fields";
import type { Application, Note, Task } from "@/lib/data/types";
export interface ApplicationDuplicate {
  id: string;
  company_name: string;
  role_title: string;
  status: string;
  reason: string;
}
export type ApplicationSaveState = FormState & { applicationId?: string; duplicates?: ApplicationDuplicate[] };
export interface JobSuggestion {
  company_name?: string;
  role_title?: string;
  locations?: string[];
  requisition_id?: string;
}
export interface ApplyIntent {
  company_name?: string;
  role_title?: string;
  application_url: string;
  job_id?: string;
  applicationId?: string;
}
export interface DrawerDetail {
  app: Application;
  notes: Note[];
  tasks: Task[];
  timezone: string;
}
