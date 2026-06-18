import { getRedis } from '../src/config/redis';

async function main() {
  const redis = getRedis();
  if (!redis) {
    console.log('Redis is not connected or getRedis() returned null');
    return;
  }

  console.log('--- REDIS CHATBOT SESSIONS ---');
  const keys = await redis.keys('chatbot:session:*');
  console.log(`Found ${keys.length} active sessions`);

  for (const key of keys) {
    const data = await redis.get(key);
    if (data) {
      const session = JSON.parse(data);
      console.log(`\nKey: ${key}`);
      console.log(`Phone: ${session.senderPhone} | ChatbotId: ${session.chatbotId}`);
      console.log(`CurrentNodeId: ${session.currentNodeId} | WaitingForInput: ${session.waitingForInput}`);
      console.log(`Variables:`, JSON.stringify(session.variables, null, 2));
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => {
    // Redis might keep process open, we force exit after a delay
    setTimeout(() => process.exit(0), 1000);
  });
