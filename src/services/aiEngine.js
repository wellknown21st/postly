const Groq = require('groq-sdk');
const logger = require('../utils/logger');

const defaultGroq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const getPlatformRules = (platform) => {
  switch (platform.toUpperCase()) {
    case 'TWITTER':
      return "Must be under 280 characters. Use engaging tone, 1-2 relevant hashtags, and short sentences. No emojis overload.";
    case 'LINKEDIN':
      return "Must be 800-1300 characters. Use professional tone, clear paragraphs, bullet points if helpful, and 3-5 relevant hashtags. Include a hook at the beginning and a call-to-action at the end.";
    case 'INSTAGRAM':
      return "Provide a catchy caption and a separate block of 10-15 relevant hashtags. Use emojis naturally.";
    case 'THREADS':
      return "Must be under 500 characters. Conversational, punchy, and engaging. Ask a question to drive replies.";
    default:
      return "";
  }
};

const buildSystemPrompt = (platforms, postType, tone, language) => {
  let prompt = `You are an expert social media manager. You need to write a ${postType} post in ${language} with a ${tone} tone. \n\n`;
  prompt += "You must generate content tailored for the following platforms. Your output MUST be a valid JSON object where keys are the platform names (e.g., 'TWITTER', 'LINKEDIN') and values are the generated content for that platform. DO NOT include any other text besides the JSON.\n\n";
  prompt += "Platform specific rules:\n";
  platforms.forEach(p => {
    prompt += `- ${p}: ${getPlatformRules(p)}\n`;
  });
  return prompt;
};

const parseJsonOutput = (text) => {
  try {
    const match = text.match(/```(?:json)?\n?([\s\S]*?)```/i);
    if (match) {
      return JSON.parse(match[1].trim());
    }
    return JSON.parse(text.trim());
  } catch (error) {
    logger.error('Failed to parse AI output as JSON', error);
    throw new Error('AI failed to return valid JSON');
  }
};

const generate = async ({ idea, postType = 'TEXT', platforms, tone, language, model, userKeys = {} }) => {
  if (!process.env.GROQ_API_KEY && !userKeys.groq) {
    logger.warn('GROQ_API_KEY is missing. Using mock response for development.');
    const mockContent = {};
    platforms.forEach(p => mockContent[p] = `Mocked ${p} content for idea: ${idea}`);
    return { platforms: mockContent, metadata: { charCounts: {}, tokensUsed: {}, model: 'MOCK' } };
  }

  const systemPrompt = buildSystemPrompt(platforms, postType, tone, language);
  const userPrompt = `Here is the core idea for the post:\n"${idea}"\n\nGenerate the platform-specific contents based on this idea.`;

  try {
    const client = userKeys.groq ? new Groq({ apiKey: userKeys.groq }) : defaultGroq;
    
    const response = await client.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      model: 'llama3-8b-8192',
      response_format: { type: 'json_object' }
    });

    const responseText = response.choices[0]?.message?.content || '{}';
    const platformContents = parseJsonOutput(responseText);
    
    const charCounts = {};
    for (const [platform, content] of Object.entries(platformContents)) {
      charCounts[platform] = typeof content === 'string' ? content.length : JSON.stringify(content).length;
    }

    return {
      platforms: platformContents,
      metadata: {
        charCounts,
        tokensUsed: {
          prompt: response.usage?.prompt_tokens || 0,
          completion: response.usage?.completion_tokens || 0,
          total: response.usage?.total_tokens || 0
        },
        model: 'GROQ_LLAMA_3'
      }
    };
  } catch (error) {
    logger.error('AI Generation Error:', error);
    throw new Error(`AI generation failed: ${error.message}`);
  }
};

module.exports = { generate };
