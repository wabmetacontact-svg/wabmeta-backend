// check-models.js
const { GoogleGenerativeAI } = require('@google/generative-ai');

const API_KEY = 'AIzaSyC7UxHwUKKgzeRzcDZmZLRvQdYjM0HHu78';

async function listModels() {
  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    
    // Fetch available models
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`
    );
    const data = await response.json();
    
    console.log('\n✅ Available Models:\n');
    
    if (data.models) {
      data.models
        .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
        .forEach(m => {
          console.log(`📌 ${m.name}`);
          console.log(`   Display: ${m.displayName}`);
          console.log(`   Methods: ${m.supportedGenerationMethods?.join(', ')}`);
          console.log('');
        });
    } else {
      console.log('Response:', JSON.stringify(data, null, 2));
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

listModels();
