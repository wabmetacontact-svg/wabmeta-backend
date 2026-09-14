// src/modules/wallet/wallet.review.ts
//
// Wallet access request par kaunsa review action kis status se allowed hai.
//
// Pehle review sirf 'pending' par hota tha - ek baar reject hua request
// hamesha ke liye reject reh jata tha. Admin galti se reject kare, ya client
// baad me documents de de, to wapas approve karne ka koi rasta nahi tha; client
// ko 7 din ruk kar naya request daalna padta tha.
//
// Ab rejected request ko approve kiya ja sakta hai. Ulta (approved ko reject)
// jaan-boojhkar allowed nahi hai: approve hote hi wallet chalu ho jata hai aur
// usme balance ho sakta hai. Request ko "rejected" likh dene se wo wallet band
// nahi hota - chalu wallet ek jhoothe label ke peeche chhup jata. Wallet band
// karna Active Wallets -> toggle ka kaam hai, jo reason bhi maangta hai.

export type WalletRequestStatus = 'pending' | 'approved' | 'rejected';
export type ReviewAction = 'approve' | 'reject';

/** Har action kin statuses se shuru ho sakta hai. */
export const REVIEWABLE_FROM: Record<ReviewAction, WalletRequestStatus[]> = {
  approve: ['pending', 'rejected'],
  reject: ['pending'],
};

export const canReview = (status: string, action: ReviewAction): boolean =>
  (REVIEWABLE_FROM[action] as string[]).includes(status);

/** Jab action allowed na ho, admin ko kya bataya jaye. */
export const reviewBlockedMessage = (status: string, action: ReviewAction): string => {
  if (status === 'approved' && action === 'approve') {
    return 'This request is already approved';
  }
  if (status === 'approved' && action === 'reject') {
    return 'This request is approved and its wallet is live. To turn the wallet off, use Active Wallets instead.';
  }
  if (status === 'rejected' && action === 'reject') {
    return 'This request is already rejected';
  }
  return `A ${status} request cannot be ${action === 'approve' ? 'approved' : 'rejected'}`;
};

/** Review note jab admin ne khud kuch na likha ho. */
export const defaultReviewNote = (fromStatus: string, action: ReviewAction): string =>
  fromStatus === 'rejected' && action === 'approve'
    ? 'Approved after an earlier rejection'
    : `Admin ${action === 'approve' ? 'approved' : 'rejected'}`;
