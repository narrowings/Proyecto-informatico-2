import { z } from 'zod';
import { ApiError, authenticated, postJson } from './http';
import type { RatingsApi } from './ratings';

export const ratingsApi: RatingsApi = {
  async rateJob(jobId, rating) {
    if (!z.uuid().safeParse(jobId).success) return { status: 'not_found' };
    try {
      const saved = await authenticated<{ publishedAt: string | null }>(
        `/jobs/${encodeURIComponent(jobId)}/ratings`,
        postJson(rating),
      );
      return { status: 'rated', published: saved.publishedAt !== null };
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 404) return { status: 'not_found' };
        if (error.problem.code === 'ALREADY_RATED') return { status: 'already_rated' };
        if (error.problem.code === 'JOB_NOT_COMPLETED') return { status: 'not_completed' };
        if (error.status === 400 && error.problem.errors)
          return { status: 'invalid', errors: error.problem.errors };
      }
      throw error;
    }
  },
  getMyRatings(page, pageSize = 10) {
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    return authenticated(`/ratings/mine?${query}`);
  },
};
