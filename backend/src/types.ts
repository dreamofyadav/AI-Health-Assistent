export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CallSession {
  id: string;
  history: Message[];
  status: 'active' | 'ended';
  startedAt: Date;
  languagePref: string;
  isInterrupted: boolean;
}

export interface HealthReport {
  patientName: string | null;
  chiefComplaint: string;
  duration: string | null;
  severity: string | null;
  associatedSymptoms: string[];
  flaggedForFollowUp: string[];
  callCompleteness: 'Complete' | 'Incomplete';
  summaryNotes: string;
}