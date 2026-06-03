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
