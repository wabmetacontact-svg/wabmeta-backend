// src/modules/gupshup/gupshup.api.ts
//
// Gupshup Partner API ka chhota client - sirf wahi calls jo hum use karte hain.
// Do tarah se chalta hai, jo env me diya ho:
//
// 1. Email + client secret (GUPSHUP_PARTNER_EMAIL + GUPSHUP_CLIENT_SECRET) -
//    partner-docs.gupshup.io wale documented APIs:
//      POST /partner/account/login             -> partner token (24h, khud renew)
//      GET  /partner/app/:appId/token          -> app token (expire nahi hota)
//      POST /partner/app/:appId/subscription   (app token)
//      POST /partner/app/:appId/v3/message     (app token)
//
// 2. Universal Token (GUPSHUP_UNIVERSAL_TOKEN) - bizgate-docs.gupshup.io:
//      POST /partner/bizgate/app/:appId/messaging/subscription, POST /partner/bizgate/app/:appId/messaging
//    Bizgate pages "Bearer <UT>" dikhate hain par Link App page bina "Bearer" ke,
//    isliye 401 par ek baar doosra format.
//
// Dono me app link / status ek hi hain (tech-partner-hosted-embed-sign-up-flow):
//      POST /partner/tpp/app, GET /partner/app/:appId/pipeline

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { config } from '../../config';
import logger from '../../utils/logger';

type AuthStyle = 'bearer' | 'raw';
type Auth = { kind: 'partner' } | { kind: 'app'; appId: string };

const PARTNER_TOKEN_TTL_MS = 23 * 60 * 60 * 1000; // Gupshup: 24h

export class GupshupApiError extends Error {
  status?: number;
  data?: any;
  constructor(message: string, status?: number, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export interface PipelineStatus {
  creationStage?: string;
  pipeLineStage?: string;
  embedStage?: string;
  uiFormStage?: string;
  whatsappVerificationStatus?: string;
}

/**
 * Token galat / expire: 401, ya 403 "Invalid Access Token" (app token API ka
 * documented jawab). "You do not have the required permissions" wala 403
 * token badalne se theek nahi hota, isliye use retry nahi karte.
 */
function isAuthFailure(err: any): boolean {
  const status = err?.response?.status;
  if (status === 401) return true;
  const msg = String(err?.response?.data?.message || '').toLowerCase();
  return status === 403 && msg.includes('invalid access token');
}

class GupshupApi {
  private client: AxiosInstance;
  private utStyle: AuthStyle = 'bearer';
  private partnerToken: { value: string; at: number } | null = null;
  private appTokens = new Map<string, string>();

  constructor() {
    this.client = axios.create({ baseURL: config.gupshup.baseUrl, timeout: 20000 });
  }

  private usesUniversalToken(): boolean {
    return !!config.gupshup.universalToken;
  }

  isConfigured(): boolean {
    return this.usesUniversalToken() || (!!config.gupshup.partnerEmail && !!config.gupshup.clientSecret);
  }

  /** Client secret se partner token (24h). Cache me rakhte hain, ~23h par naya. */
  private async getPartnerToken(force = false): Promise<string> {
    if (!force && this.partnerToken && Date.now() - this.partnerToken.at < PARTNER_TOKEN_TTL_MS) {
      return this.partnerToken.value;
    }
    try {
      const body = new URLSearchParams({
        email: config.gupshup.partnerEmail,
        secret: config.gupshup.clientSecret,
      });
      const res = await this.client.post('/partner/account/login', body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      });
      const token = res.data?.token;
      if (!token) throw new GupshupApiError('[Gupshup] login: no token returned', res.status, res.data);
      this.partnerToken = { value: String(token), at: Date.now() };
      // Login ka jawab account ka haal bhi batata hai - setup ki galti yahin dikh jaati hai
      logger.info(
        `[Gupshup] partner login ok (partner ${res.data?.id}, isTpp=${res.data?.isTpp}, ` +
          `enableInrWallet=${res.data?.enableInrWallet}, billing=${res.data?.billingType})`
      );
      return this.partnerToken.value;
    } catch (err: any) {
      if (err instanceof GupshupApiError) throw err;
      throw this.toError(err, 'login');
    }
  }

  /** App ka access token - Gupshup ke hisaab se expire nahi hota, process me cache. */
  private async getAppToken(appId: string, force = false): Promise<string> {
    const cached = this.appTokens.get(appId);
    if (cached && !force) return cached;
    const data = await this.request<any>(
      { method: 'GET', url: `/partner/app/${encodeURIComponent(appId)}/token` },
      'appToken',
      { kind: 'partner' }
    );
    const token = data?.token?.token || data?.token;
    if (!token || typeof token !== 'string') {
      throw new GupshupApiError('[Gupshup] appToken: no token returned', 200, data);
    }
    this.appTokens.set(appId, token);
    return token;
  }

  private async headerFor(auth: Auth, style: AuthStyle, force = false): Promise<string> {
    if (this.usesUniversalToken()) {
      const t = config.gupshup.universalToken;
      return style === 'bearer' ? `Bearer ${t}` : t;
    }
    // Partner / app token: docs me bina "Bearer" ke
    return auth.kind === 'app' ? this.getAppToken(auth.appId, force) : this.getPartnerToken(force);
  }

  private async request<T = any>(req: AxiosRequestConfig, label: string, auth: Auth): Promise<T> {
    if (!this.isConfigured()) {
      throw new GupshupApiError('Gupshup is not configured (set GUPSHUP_PARTNER_EMAIL + GUPSHUP_CLIENT_SECRET)');
    }

    const attempt = async (style: AuthStyle, force = false) => {
      const value = await this.headerFor(auth, style, force);
      // App token API ke OpenAPI me partner token "token" header me hai, jabki
      // sample curl "Authorization" me - token mode me dono bhejte hain.
      const tokenHeader = this.usesUniversalToken() ? {} : { token: value };
      return this.client.request<T>({
        ...req,
        headers: { ...(req.headers || {}), Authorization: value, ...tokenHeader },
      });
    };

    try {
      return (await attempt(this.utStyle)).data;
    } catch (err: any) {
      if (err instanceof GupshupApiError) throw err;
      if (!isAuthFailure(err)) throw this.toError(err, label);

      // Token nahi chala: UT me doosra header format, token mode me naya token
      try {
        if (this.usesUniversalToken()) {
          const other: AuthStyle = this.utStyle === 'bearer' ? 'raw' : 'bearer';
          const res = await attempt(other);
          this.utStyle = other;
          logger.info(`[Gupshup] universal token works with "${other}" header style`);
          return res.data;
        }
        if (auth.kind === 'app') this.appTokens.delete(auth.appId);
        return (await attempt(this.utStyle, true)).data;
      } catch (err2: any) {
        if (err2 instanceof GupshupApiError) throw err2;
        throw this.toError(err2, label);
      }
    }
  }

  private toError(err: any, label: string): GupshupApiError {
    const status = err?.response?.status;
    const data = err?.response?.data;
    const msg =
      data?.error?.message || // Meta error relayed back by the send API
      data?.message ||
      err?.message ||
      `${label} failed`;
    return new GupshupApiError(`[Gupshup] ${label}: ${msg}`, status, data);
  }

  /** WABA + number ko Gupshup app se jodo; Gupshup isi me number register karta hai. */
  async linkApp(input: { name: string; wabaId: string; phone: string; callbackUrl?: string }) {
    const body = new URLSearchParams({ name: input.name, wabaId: input.wabaId, phone: input.phone });
    if (input.callbackUrl) body.set('callbackUrl', input.callbackUrl);
    const data = await this.request<{ status: string; appId?: string; message?: string }>(
      {
        method: 'POST',
        url: '/partner/tpp/app',
        data: body.toString(),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
      'linkApp',
      { kind: 'partner' }
    );
    if (!data?.appId) throw new GupshupApiError(`[Gupshup] linkApp: ${data?.message || 'no appId returned'}`, 200, data);
    return { appId: data.appId };
  }

  async getPipeline(appId: string): Promise<PipelineStatus> {
    const data = await this.request<{ status: string; whatsapp?: PipelineStatus }>(
      { method: 'GET', url: `/partner/app/${encodeURIComponent(appId)}/pipeline` },
      'getPipeline',
      { kind: 'partner' }
    );
    return data?.whatsapp || {};
  }

  async createSubscription(appId: string, url: string, modes: string) {
    const body = new URLSearchParams({ modes, tag: 'wabmeta-primary', version: '3', url, showOnUI: 'true' });
    const path = this.usesUniversalToken()
      ? `/partner/bizgate/app/${encodeURIComponent(appId)}/messaging/subscription`
      : `/partner/app/${encodeURIComponent(appId)}/subscription`;
    const data = await this.request<any>(
      {
        method: 'POST',
        url: path,
        data: body.toString(),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      },
      'createSubscription',
      { kind: 'app', appId }
    );
    return { subscriptionId: data?.data?.subscription?.id || data?.subscription?.id || null };
  }

  /**
   * Meta Cloud API ka payload as-is Gupshup ko. Jawab bhi Cloud API jaisa
   * (messages[0].id), par wo id Gupshup message id hai - wamid baad me V3
   * status callback ke gs_id se milta hai (gupshup.service mapStatusIds).
   */
  async sendPassthrough(appId: string, payload: any): Promise<any> {
    const path = this.usesUniversalToken()
      ? `/partner/bizgate/app/${encodeURIComponent(appId)}/messaging`
      : `/partner/app/${encodeURIComponent(appId)}/v3/message`;
    return this.request<any>(
      {
        method: 'POST',
        url: path,
        data: payload,
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000,
      },
      'send',
      { kind: 'app', appId }
    );
  }
}

export const gupshupApi = new GupshupApi();
