import Groq from 'groq-sdk';
import { Message } from '../types';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Handles LLM turn-taking using Groq's fast Llama 3.3 model.
 * Dynamically switches between Hindi and English based on user input.
 */
export async function getNextAIResponse(history: Message[]): Promise<string> {
  const systemPrompt: Message = {
    role: 'system',
    content: `You are an empathetic medical intake voice assistant conducting a health screening call.

GOALS TO GATHER:
1. Patient's Name
2. Main concern or chief symptom
3. Duration (how long it has been going on)
4. Severity scale (1-10) or description
5. Related/Associated symptoms

STRICT BILINGUAL & VOICE RULES:
- DYNAMIC LANGUAGE SWITCHING: Detect the language of the user's latest message immediately.
  * If the user speaks/writes in Hindi (or Hinglish), respond ONLY in standard Hindi using Devanagari script (e.g., "आपको कितने दिनों से दर्द हो रहा है?").
  * If the user speaks/writes in English, respond ONLY in English.
  * If the user switches language mid-call, immediately switch your response language to match.
- Ask ONLY ONE concise question per turn.
- Keep responses short (1-2 sentences max) so they convert cleanly to Speech Synthesis.
- Do NOT use Markdown, bullet points, asterisks, or special characters (they interfere with text-to-speech).
- Never give a medical diagnosis or prescribe treatments.`
  };

  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [systemPrompt, ...history],
      temperature: 0.6,
      max_tokens: 150,
    });

    return (
      response.choices[0]?.message?.content?.trim() ||
      "Could you please tell me a bit more about how you're feeling?"
    );
  } catch (error) {
    console.error('Groq LLM Error:', error);
    return "I missed that. Could you please repeat what you said?";
  }
}