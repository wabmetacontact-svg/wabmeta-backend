import axios from 'axios';
import { logger } from '../../utils/logger';

const META_GRAPH_URL = 'https://graph.facebook.com/v19.0';

/**
 * Instagram par Direct Message bhejne ke liye
 */
export const sendIGMessage = async (accessToken: string, recipientId: string, text: string) => {
  try {
    const response = await axios.post(
      `${META_GRAPH_URL}/me/messages`,
      {
        recipient: { id: recipientId },
        message: { text: text },
      },
      {
        params: { access_token: accessToken },
      }
    );
    return response.data;
  } catch (error: any) {
    logger.error('❌ Meta IG Message Error:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Fetch the account's published media (posts, reels, carousels).
 * Needs instagram_basic. Returns newest first.
 */
export const getAccountMedia = async (accessToken: string, igUserId: string, limit = 25) => {
  const res = await axios.get(`${META_GRAPH_URL}/${igUserId}/media`, {
    params: {
      fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,like_count,comments_count,timestamp',
      limit,
      access_token: accessToken,
    },
    timeout: 20000,
  });
  return res.data?.data || [];
};

/**
 * Fetch the account's currently-active stories (24h window).
 * Needs instagram_manage_insights / the stories edge permission.
 */
export const getAccountStories = async (accessToken: string, igUserId: string) => {
  try {
    const res = await axios.get(`${META_GRAPH_URL}/${igUserId}/stories`, {
      params: { fields: 'id,media_type,media_url,thumbnail_url,permalink,timestamp', access_token: accessToken },
      timeout: 20000,
    });
    return res.data?.data || [];
  } catch {
    return []; // stories permission may be absent; degrade gracefully
  }
};

/**
 * Send a media attachment on Instagram. Meta fetches the file from `url`, so it
 * must be a publicly reachable URL. `type` is image | video | audio.
 */
export const sendIGAttachment = async (
  accessToken: string,
  recipientId: string,
  type: 'image' | 'video' | 'audio',
  url: string
) => {
  try {
    const response = await axios.post(
      `${META_GRAPH_URL}/me/messages`,
      {
        recipient: { id: recipientId },
        message: { attachment: { type, payload: { url } } },
      },
      { params: { access_token: accessToken } }
    );
    return response.data;
  } catch (error: any) {
    logger.error('❌ Meta IG Attachment Error:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Instagram Comment par reply karne ke liye
 */
export const replyToIGComment = async (accessToken: string, commentId: string, text: string) => {
  try {
    const response = await axios.post(
      `${META_GRAPH_URL}/${commentId}/replies`,
      { message: text },
      { params: { access_token: accessToken } }
    );
    return response.data;
  } catch (error: any) {
    logger.error('❌ Meta IG Comment Reply Error:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Subscribe a Facebook Page to this app so Meta actually delivers Instagram
 * webhooks (DMs, comments, story mentions) for its linked IG account.
 *
 * Without this call the connection looks fine in the UI but no event ever
 * arrives, so none of the automations can fire. Requires a PAGE access token.
 */
export const subscribePageToApp = async (pageAccessToken: string, pageId: string) => {
  const res = await axios.post(
    `${META_GRAPH_URL}/${pageId}/subscribed_apps`,
    null,
    {
      params: {
        subscribed_fields: [
          'messages',
          'messaging_postbacks',
          'message_reactions',
          'comments',
          'mentions',
        ].join(','),
        access_token: pageAccessToken,
      },
      timeout: 15000,
    }
  );
  return res.data?.success === true;
};
