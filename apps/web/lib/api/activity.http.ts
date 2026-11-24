import { authenticated, postJson } from './http';
import type { Page } from './ratings';
import type {
  Applicants,
  Candidate,
  CandidateStatus,
  JobCard,
  JobDetail,
  JobRole,
  JobState,
  MyApplication,
  OpportunityChanges,
  OpportunityDetails,
  OwnedOpportunity,
  PendingSelection,
  Publication,
} from './activity';

const opportunityPath = (id: string) => '/opportunities/' + encodeURIComponent(id);
const jobPath = (id: string) => '/jobs/' + encodeURIComponent(id);
const selectionPath = (id: string) => '/selections/' + encodeURIComponent(id);
const post = { method: 'POST' };

export const activityApi = {
  applications: (state: 'active' | 'all', page: number) =>
    authenticated<Page<MyApplication>>(`/applications/mine?state=${state}&page=${page}`),
  publications: (page: number) =>
    authenticated<Page<Publication>>(`/opportunities/mine?page=${page}`),
  own: (id: string) =>
    authenticated<OwnedOpportunity>('/opportunities/mine/' + encodeURIComponent(id)),
  details: (id: string) => authenticated<OpportunityDetails>(opportunityPath(id)),
  update: (id: string, changes: OpportunityChanges) =>
    authenticated<OwnedOpportunity>(opportunityPath(id), { ...postJson(changes), method: 'PATCH' }),
  address: (id: string, address: string) =>
    authenticated<void>(opportunityPath(id) + '/address', {
      ...postJson({ address }),
      method: 'PUT',
    }),
  changeStatus: (id: string, action: 'pause' | 'close' | 'cancel', reason: string) =>
    authenticated<OwnedOpportunity>(opportunityPath(id) + '/' + action, postJson({ reason })),
  resume: (id: string) => authenticated<OwnedOpportunity>(opportunityPath(id) + '/resume', post),
  applicants: (id: string) => authenticated<Applicants>(opportunityPath(id) + '/applicants'),
  select: (id: string, applicationIds: string[]) =>
    authenticated(opportunityPath(id) + '/selections', postJson({ applicationIds })),
  candidates: (id: string) => authenticated<Candidate[]>(opportunityPath(id) + '/candidates'),
  changeCandidate: (id: string, status: CandidateStatus) =>
    authenticated<{ id: string; status: CandidateStatus }>(
      '/applications/' + encodeURIComponent(id) + '/status',
      { ...postJson({ status }), method: 'PATCH' },
    ),
  selections: () => authenticated<PendingSelection[]>('/selections/mine'),
  accept: (id: string) =>
    authenticated<{ id: string }>(selectionPath(id) + '/accept', postJson({ acceptTerms: true })),
  reject: (id: string) => authenticated<void>(selectionPath(id) + '/reject', post),
  jobs: (role: JobRole, state: JobState, page: number) =>
    authenticated<Page<JobCard>>(`/jobs?role=${role}&state=${state}&page=${page}`),
  job: (id: string) => authenticated<JobDetail>(jobPath(id)),
  finish: (id: string, action: 'finish' | 'confirm-finish') =>
    authenticated<void>(jobPath(id) + '/' + action, post),
  cancelJob: (id: string, reason: string) =>
    authenticated<void>(jobPath(id) + '/cancel', postJson({ reason })),
};
