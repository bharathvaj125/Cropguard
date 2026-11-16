import { config } from '../config.js';
import { ApiError } from '../utils/errors.js';

/**
 * Thin client for the Python inference service.
 *
 * POST /analyze returns, for each requested model, the probability of every class
 * sorted from most to least likely. Interpreting those numbers (thresholds, crop
 * filtering, wording) is done in services/diagnosis.js, not here.
 */
export async function analyzeImage(buffer, { mode = 'both', explain = true } = {}) {
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: 'image/jpeg' }), 'upload.jpg');
  form.append('mode', mode);
  form.append('explain', String(explain));

  let response;
  try {
    response = await fetch(`${config.mlServiceUrl}/analyze`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(config.mlTimeoutMs),
    });
  } catch (err) {
    const timedOut = err.name === 'TimeoutError';
    throw new ApiError(
      503,
      timedOut
        ? 'The analysis took too long. Please try again.'
        : 'The AI analysis service is not reachable right now. Please try again in a moment.',
    );
  }

  if (response.status === 422 || response.status === 400) {
    const body = await response.json().catch(() => ({}));
    throw ApiError.badRequest(body.detail || 'The image could not be analysed');
  }
  if (!response.ok) throw new ApiError(502, 'The AI analysis service returned an error');
  return response.json();
}

/** Model metadata and health, shown in the admin panel. Never throws. */
export async function mlStatus() {
  try {
    const response = await fetch(`${config.mlServiceUrl}/models`, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) return { online: false, models: [] };
    const body = await response.json();
    return { online: true, models: body.models || [] };
  } catch {
    return { online: false, models: [] };
  }
}
