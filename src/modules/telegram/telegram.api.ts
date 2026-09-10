// src/modules/telegram/telegram.api.ts
//
// Thin client for the Telegram Bot API. Every call takes the bot's plaintext
// token (decrypted by the caller just before use) and talks to
// https://api.telegram.org/bot<token>/<method>.
//
// Docs: https://core.telegram.org/bots/api

import axios from 'axios';

const API_BASE = 'https://api.telegram.org';

const url = (token: string, method: string) => `${API_BASE}/bot${token}/${method}`;

export interface TelegramBotInfo {
  id: number;
  is_bot: boolean;
  first_name: string;
  username: string;
  can_join_groups?: boolean;
  can_read_all_group_messages?: boolean;
}

/**
 * Validate a bot token and return the bot's identity. Throws if the token is
 * invalid (Telegram returns 401 / ok:false).
 */
export const getMe = async (token: string): Promise<TelegramBotInfo> => {
  const res = await axios.get(url(token, 'getMe'), { timeout: 15000 });
  if (!res.data?.ok || !res.data?.result) {
    throw new Error('Telegram rejected the bot token');
  }
  return res.data.result as TelegramBotInfo;
};

/**
 * Point Telegram at our webhook. `secretToken` is echoed back by Telegram in the
 * `X-Telegram-Bot-Api-Secret-Token` header on every update, so we can verify the
 * caller really is Telegram.
 */
export const setWebhook = async (
  token: string,
  webhookUrl: string,
  secretToken: string
): Promise<void> => {
  const res = await axios.post(
    url(token, 'setWebhook'),
    {
      url: webhookUrl,
      secret_token: secretToken,
      allowed_updates: ['message', 'edited_message', 'callback_query'],
      drop_pending_updates: true,
    },
    { timeout: 15000 }
  );
  if (!res.data?.ok) {
    throw new Error(res.data?.description || 'Failed to set Telegram webhook');
  }
};

/** Remove the webhook (used on disconnect). Best-effort. */
export const deleteWebhook = async (token: string): Promise<void> => {
  try {
    await axios.post(url(token, 'deleteWebhook'), { drop_pending_updates: false }, { timeout: 15000 });
  } catch {
    // best-effort; the bot may already be gone
  }
};

export interface SentTelegramMessage {
  message_id: number;
  date: number;
  chat: { id: number };
}

/**
 * Send a text message to a chat. Returns the sent message so the caller can
 * store Telegram's message id.
 */
export const sendMessage = async (
  token: string,
  chatId: string | number,
  text: string,
  extra?: Record<string, any>
): Promise<SentTelegramMessage> => {
  const res = await axios.post(
    url(token, 'sendMessage'),
    { chat_id: chatId, text, ...extra },
    { timeout: 20000 }
  );
  if (!res.data?.ok || !res.data?.result) {
    throw new Error(res.data?.description || 'Failed to send Telegram message');
  }
  return res.data.result as SentTelegramMessage;
};

/**
 * Send a media file to a chat via multipart upload. `method`/`field` are one of
 * sendPhoto/photo, sendDocument/document, sendVideo/video, sendAudio/audio,
 * sendVoice/voice. Returns the sent message (which carries the new file_id).
 */
export const sendMedia = async (
  token: string,
  chatId: string | number,
  method: string,
  field: string,
  buffer: Buffer,
  filename: string,
  caption?: string
): Promise<any> => {
  // Lazy require so this stays a plain module in tests that never send media.
  const FormData = require('form-data');
  const form = new FormData();
  form.append('chat_id', String(chatId));
  if (caption) form.append('caption', caption);
  form.append(field, buffer, { filename: filename || 'file' });

  const res = await axios.post(url(token, method), form, {
    headers: form.getHeaders(),
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    timeout: 120000,
  });
  if (!res.data?.ok || !res.data?.result) {
    throw new Error(res.data?.description || 'Failed to send Telegram media');
  }
  return res.data.result;
};

/** Acknowledge a tapped inline button so its loading spinner stops. */
export const answerCallbackQuery = async (
  token: string,
  callbackQueryId: string,
  text?: string
): Promise<void> => {
  try {
    await axios.post(
      url(token, 'answerCallbackQuery'),
      { callback_query_id: callbackQueryId, ...(text ? { text } : {}) },
      { timeout: 15000 }
    );
  } catch {
    // best-effort; the callback expires quickly and a failure is non-fatal
  }
};

/**
 * Send media by reference — a public URL or a previously-returned file_id (as a
 * plain string, no upload). Lets a broadcast upload once and reuse the file_id.
 * `method`/`field` = sendPhoto/photo, sendVideo/video, sendDocument/document, …
 */
export const sendMediaByRef = async (
  token: string,
  chatId: string | number,
  method: string,
  field: string,
  ref: string,
  caption?: string,
  extra?: Record<string, any>
): Promise<any> => {
  const res = await axios.post(
    url(token, method),
    { chat_id: chatId, [field]: ref, ...(caption ? { caption } : {}), ...(extra || {}) },
    { timeout: 30000 }
  );
  if (!res.data?.ok || !res.data?.result) {
    throw new Error(res.data?.description || 'Failed to send Telegram media');
  }
  return res.data.result;
};

export interface TelegramWebhookInfo {
  url?: string;
  has_custom_certificate?: boolean;
  pending_update_count?: number;
  ip_address?: string;
  last_error_date?: number;
  last_error_message?: string;
  max_connections?: number;
  allowed_updates?: string[];
}

/**
 * Ask Telegram for the live status of this bot's webhook — the URL it actually
 * has registered, how many updates are queued, and the last delivery error.
 * Real health data, not a synthetic ping.
 */
export const getWebhookInfo = async (token: string): Promise<TelegramWebhookInfo> => {
  const res = await axios.get(url(token, 'getWebhookInfo'), { timeout: 15000 });
  if (!res.data?.ok) {
    throw new Error(res.data?.description || 'Failed to read webhook info');
  }
  return (res.data.result || {}) as TelegramWebhookInfo;
};

export interface TelegramCommand {
  command: string;
  description: string;
}

/**
 * Publish the bot's command menu (the "/" list users see in Telegram).
 * Passing an empty array clears the menu. Telegram enforces: command is
 * 1–32 chars of lowercase letters, digits and underscores; description 1–256.
 */
export const setMyCommands = async (
  token: string,
  commands: TelegramCommand[]
): Promise<void> => {
  const res = await axios.post(
    url(token, 'setMyCommands'),
    { commands },
    { timeout: 15000 }
  );
  if (!res.data?.ok) {
    throw new Error(res.data?.description || 'Failed to set Telegram commands');
  }
};

/** Read the bot's currently-published command menu. */
export const getMyCommands = async (token: string): Promise<TelegramCommand[]> => {
  const res = await axios.get(url(token, 'getMyCommands'), { timeout: 15000 });
  if (!res.data?.ok) {
    throw new Error(res.data?.description || 'Failed to read Telegram commands');
  }
  return (res.data.result as TelegramCommand[]) || [];
};

/** Resolve a file_id to its download path on Telegram's file server. */
export const getFilePath = async (token: string, fileId: string): Promise<string> => {
  const res = await axios.get(url(token, 'getFile'), {
    params: { file_id: fileId },
    timeout: 15000,
  });
  const path = res.data?.result?.file_path;
  if (!res.data?.ok || !path) {
    throw new Error(res.data?.description || 'Telegram file not found');
  }
  return path as string;
};

/** Open a streaming download for a resolved file path (bot token stays server-side). */
export const downloadFileStream = (token: string, filePath: string) =>
  axios.get(`${API_BASE}/file/bot${token}/${filePath}`, {
    responseType: 'stream',
    timeout: 60000,
  });
