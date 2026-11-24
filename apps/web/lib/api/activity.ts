import type { Zone, Category } from './catalogs';
import type { Reputation } from './reputation';

export type ApplicationStatus =
  'RECEIVED' | 'IN_REVIEW' | 'INTERVIEW' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';
export type CandidateStatus = Exclude<ApplicationStatus, 'RECEIVED' | 'WITHDRAWN'>;
export type OpportunityStatus = 'ACTIVE' | 'PAUSED' | 'CLOSED' | 'EXPIRED' | 'CANCELLED';
export type OpportunityDetails = {
  id: string;
  title: string;
  description: string;
  category: Category;
  zone: Zone;
  type: 'FORMAL_JOB' | 'QUICK_JOB' | 'TASK' | 'PROJECT' | 'SERVICE';
  status: OpportunityStatus;
  conditions: string | null;
  peopleNeeded: number | null;
  paymentCop: number | null;
  scheduledAt: string | null;
  durationMinutes: number | null;
  salaryMinCop: number | null;
  salaryMaxCop: number | null;
  modality: 'ONSITE' | 'REMOTE' | 'HYBRID' | null;
  schedule: 'FULL_TIME' | 'PART_TIME' | 'SHIFTS' | 'FLEXIBLE' | null;
  experienceRequired: string | null;
  requirements: string | null;
  closesAt: string | null;
};
export type OwnedOpportunity = OpportunityDetails & {
  updatedAt: string;
  statusReason: string | null;
  exactAddress: string | null;
  hiddenAt: string | null;
  hiddenReason: string | null;
};
export type Publication = OwnedOpportunity & { applicantsCount: number; acceptedCount: number };
export type OpportunityChanges = Partial<
  Omit<OpportunityDetails, 'id' | 'type' | 'status' | 'category' | 'zone'> & {
    categoryId: number;
    zoneId: number;
    acknowledgeLaborWarning: true;
  }
>;
export type MyApplication = {
  id: string;
  status: ApplicationStatus;
  opportunity: OpportunityDetails | null;
  createdAt: string;
};
export type Candidate = {
  id: string;
  status: ApplicationStatus;
  workerProfileId: string;
  worker: {
    displayName: string;
    photoUrl: string | null;
    zone: Zone;
    availability: 'AVAILABLE' | 'UNAVAILABLE';
    skills: string[];
  };
};
export type Applicants = {
  selected: number;
  needed: number;
  applicants: (Candidate & {
    selectionStatus: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | null;
    reputation: Reputation;
  })[];
};
export type PendingSelection = {
  id: string;
  expiresAt: string;
  opportunity: Pick<OpportunityDetails, 'id' | 'title' | 'zone' | 'scheduledAt'>;
};
export type JobRole = 'worker' | 'publisher';
export type JobState = 'active' | 'finished';
export type JobCard = {
  id: string;
  title: string;
  zone: Zone;
  scheduledAt: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  counterparty: { name: string | null };
};
export type JobDetail = Omit<JobCard, 'counterparty'> & {
  counterparty: { name: string; phone: string | null } | null;
  exactAddress: string | null;
  hasRated: boolean;
  finishMarkedAt: string | null;
  finishMarkedByMe: boolean;
  cancelledByMe: boolean;
  cancelReason: string | null;
};
