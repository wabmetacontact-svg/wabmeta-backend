// src/modules/meta/coexistenceFreeDemo.ts
//
// Coexistence - connecting a number that keeps running the WhatsApp Business
// app on the phone - is not offered on the free demo. A demo connects through
// the Cloud API only.
//
// "Free demo" is decided the way the rest of the app decides it
// (planLimits.isSubscriptionActive): no subscription, a FREE_DEMO plan, or a
// paid plan that has expired or been cancelled.

import { AppError } from '../../middleware/errorHandler';
import { isSubscriptionActive } from '../../middleware/planLimits';

export const COEXISTENCE_FREE_DEMO_MESSAGE =
  'Connecting a number that runs the WhatsApp Business app is not available on the free demo. ' +
  'Upgrade your plan, or connect a new number through the Cloud API.';

export const isFreeDemo = async (organizationId: string): Promise<boolean> =>
  (await isSubscriptionActive(organizationId)).planType === 'FREE_DEMO';

/** Throws when a free demo tries to connect a WhatsApp Business app number. */
export const assertCoexistenceAllowed = async (organizationId: string): Promise<void> => {
  if (await isFreeDemo(organizationId)) {
    throw new AppError(COEXISTENCE_FREE_DEMO_MESSAGE, 403, 'COEXISTENCE_NOT_ON_FREE_DEMO');
  }
};
