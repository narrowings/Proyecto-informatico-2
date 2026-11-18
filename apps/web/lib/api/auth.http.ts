import type { AuthApi, LegalDocuments } from './auth';
import { ApiError, authenticated, loginSession, logoutSession, postJson, request } from './http';

export const authApi: AuthApi = {
  async currentDocuments() {
    type Document = {
      type: 'TERMS' | 'PRIVACY_POLICY' | 'DATA_TREATMENT';
      version: string;
      url: string;
    };
    const documents = await request<Document[]>('/legal-documents/current');
    const find = (type: Document['type']) => {
      const doc = documents.find((item) => item.type === type);
      if (!doc) throw new Error('Falta un documento legal vigente.');
      return { version: doc.version, url: doc.url };
    };
    return {
      terms: find('TERMS'),
      privacy: find('PRIVACY_POLICY'),
      dataProcessing: find('DATA_TREATMENT'),
    } satisfies LegalDocuments;
  },
  async register(values) {
    try {
      await request('/auth/register', postJson(values));
      return { ok: true };
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 409 &&
        error.problem.code !== 'VERSION_LEGAL_DESACTUALIZADA'
      ) {
        return { ok: false, reason: 'email_taken' };
      }
      throw error;
    }
  },
  async confirmEmail(token) {
    try {
      await request('/auth/confirm-email', postJson({ token }));
      return { status: 'active' };
    } catch (error) {
      if (error instanceof ApiError && error.status === 410) return { status: 'expired' };
      throw error;
    }
  },
  async resendConfirmationLink(email) {
    await request('/auth/resend-confirmation', postJson({ email }));
  },
  async login(values) {
    try {
      const requiresTermsAcceptance = await loginSession(values);
      return { status: 'ok', requiresTermsAcceptance };
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 401) return { status: 'invalid_credentials' };
        if (error.problem.code === 'EMAIL_NOT_CONFIRMED') return { status: 'unconfirmed' };
        if (error.status === 429)
          return {
            status: 'locked',
            retryAfterMinutes: Math.max(1, Math.ceil(error.retryAfter / 60)),
          };
      }
      throw error;
    }
  },
  logout: logoutSession,
  async acceptTerms(consents) {
    await authenticated('/auth/consents', postJson(consents));
  },
};
