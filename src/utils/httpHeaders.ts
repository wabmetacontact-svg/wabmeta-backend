// src/utils/httpHeaders.ts
//
// axios 1.20 ne response.headers ka type badal diya: pehle string milta tha,
// ab `string | number | boolean | string[] | AxiosHeaders` mil sakta hai.
// Hum in headers ko seedha res.setHeader() me aur .split(';') par bhejte hain,
// jahan sirf string chalti hai.
//
// Ye helper ek hi jagah wo narrowing karta hai, har call site par cast lagane
// ke bajaye.

/**
 * axios/Node header value se ek string. Array ho to pehli value, missing ya
 * boolean ho to fallback.
 */
export const headerString = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') return value || fallback;
  if (Array.isArray(value)) {
    const first = value.find((v) => v != null);
    return first != null ? String(first) : fallback;
  }
  if (value == null || typeof value === 'boolean') return fallback;
  return String(value);
};

/** Content-Type se sirf mime, parameters (charset, boundary) hata kar. */
export const mimeFromHeader = (value: unknown, fallback = ''): string =>
  headerString(value, fallback).split(';')[0].trim() || fallback;

export default { headerString, mimeFromHeader };
