// src/config/monitoring.ts
//
// Error monitoring.
//
// Ab tak koi monitoring nahi thi - sab kuch console.log tha jo Render ke logs
// me chala jata tha aur kisi ko dikhta nahi tha. Iska matlab tha ki agar koi
// abhi hamla kar raha ho, ya koi handler har request par phat raha ho, pata
// hafton baad chalta.
//
// Sentry SENTRY_DSN par hi chalu hota hai. DSN na ho to sab kuch no-op hai -
// local development aur test bilkul waise hi chalte hain jaise pehle.

import * as Sentry from '@sentry/node';
import { config } from './index';

let enabled = false;

/**
 * DSN dekhne me Sentry ka DSN lagta hai ya nahi: https://<key>@<host>/<projectId>
 *
 * Alag se export isliye ki test ho sake - ye wahi jagah hai jahan galti karne
 * par poora API neeche ja sakta hai.
 */
export const isValidSentryDsn = (dsn: string): boolean =>
  /^https:\/\/[^@\s]+@[^/\s]+\/\d+$/.test((dsn || '').trim());

export const initMonitoring = (): boolean => {
  const dsn = (process.env.SENTRY_DSN || '').trim();
  if (!dsn) return false;

  // Shape ka check pehle. Sentry galat DSN par throw karta hai, aur ye
  // bootstrap() ke try block se bulaya jata hai - wahan se throw hone ka
  // matlab hai process.exit(1). Monitoring set up na hone se poora API
  // neeche nahi jaana chahiye.
  if (!isValidSentryDsn(dsn)) {
    console.error(
      '🚨 SENTRY_DSN does not look like a Sentry DSN (https://<key>@<host>/<project-id>) - monitoring disabled'
    );
    return false;
  }

  try {
    initSentry(dsn);
    enabled = true;
    return true;
  } catch (err: any) {
    // Yahan crash nahi hona chahiye. Monitoring optional hai, API nahi.
    console.error('🚨 Sentry init failed, continuing without monitoring:', err?.message || err);
    enabled = false;
    return false;
  }
};

const initSentry = (dsn: string): void => {
  Sentry.init({
    dsn,
    environment: config.app.env,
    release: process.env.RENDER_GIT_COMMIT || undefined,

    // Production me har request trace karne ki na zaroorat hai na budget.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0),

    // Error reports secrets le kar na jayein. Sentry ke apne scrubbing par
    // bharosa karne ke bajay hum khud hata dete hain.
    beforeSend(event) {
      const headers = event.request?.headers as Record<string, string> | undefined;
      if (headers) {
        for (const key of Object.keys(headers)) {
          if (/authorization|cookie|x-access-token|x-hub-signature/i.test(key)) {
            headers[key] = '[redacted]';
          }
        }
      }
      // Query strings me token/secret aa sakte hain.
      if (event.request?.query_string) event.request.query_string = '[redacted]';
      return event;
    },
  });
};

export const monitoringEnabled = (): boolean => enabled;

/** Error Sentry ko bhejo. DSN na ho to chup-chaap kuch nahi hota. */
export const captureError = (err: unknown, context?: Record<string, unknown>): void => {
  if (!enabled) return;
  try {
    Sentry.captureException(err, context ? { extra: context } : undefined);
  } catch {
    // Monitoring kabhi bhi asli request ko fail na kare.
  }
};

/** Aisi baat jo error nahi hai par dikhni chahiye - jaise lockout ya spoof attempt. */
export const captureWarning = (message: string, context?: Record<string, unknown>): void => {
  if (!enabled) return;
  try {
    Sentry.captureMessage(message, { level: 'warning', extra: context });
  } catch {
    // ignore
  }
};

export default { initMonitoring, captureError, captureWarning, monitoringEnabled };
