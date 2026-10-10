/**
 * KEYWORD automation is message par lagegi ya nahi.
 *
 * Web form keywords ko `split(',')` karke bina khaali entries hataye save
 * karta hai, isliye "hi, hello," se [..., ""] aata hai - aur
 * "kuch bhi".includes("") true hai, yani wo automation har message par
 * chal jati thi. Khaali keyword kabhi match nahi karta.
 */
export function keywordTriggerMatches(
  triggerConfig: { keywords?: unknown; exactMatch?: boolean } | null | undefined,
  message: string | null | undefined
): boolean {
  const messageL = (message || '').toLowerCase().trim();
  if (!messageL) return false;

  const keywords = Array.isArray(triggerConfig?.keywords) ? triggerConfig!.keywords : [];
  const exactMatch = !!triggerConfig?.exactMatch;

  return keywords.some((keyword) => {
    const keywordL = String(keyword ?? '').toLowerCase().trim();
    if (!keywordL) return false;
    return exactMatch ? messageL === keywordL : messageL.includes(keywordL);
  });
}
