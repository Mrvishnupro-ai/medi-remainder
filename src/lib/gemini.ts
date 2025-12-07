
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from './supabase';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}


// Initialize Gemini API
// Note: In a production environment, you should never expose API keys on the client side.
// This should be proxied through a backend/Edge Function.
// For this prototype, we'll use the key from environment variables.
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

export interface MedicationSuggestion {
  name: string;
  dosage: string;
  type: string;
  description: string;
}

export interface HealthTip {
  title: string;
  content: string;
  category: 'medication' | 'lifestyle' | 'nutrition';
}

export const getMedicationSuggestions = async (query: string): Promise<MedicationSuggestion[]> => {
  if (!query || query.length < 2 || !API_KEY) return [];

  try {
    const prompt = `Suggest 3 medications that match the search term "${query}". 
    Return strictly a JSON array with objects having fields: name, dosage (common), type (Pill, Syrup, etc), description (1 sentence). 
    Do not include markdown formatting.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const cleanText = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanText) as MedicationSuggestion[];
  } catch (error) {
    console.error('Error fetching medication suggestions:', error);
    return [];
  }
};

export const getHealthTips = async (
  medications: string[],
  conditions: string[]
): Promise<HealthTip[]> => {
  if (!API_KEY) return [
    { title: 'Stay Hydrated', content: 'Remember to drink plenty of water with your medications.', category: 'lifestyle' }
  ];

  try {
    const prompt = `Generate 3 personalized health tips based on:
    Medications: ${medications.join(', ')}
    Conditions: ${conditions.join(', ')}
    
    Return strictly a JSON array with objects: title, content, category (medication|lifestyle|nutrition).
    One tip should be a "Medifact" about one of the medications.
    Do not include markdown formatting.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const cleanText = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanText) as HealthTip[];
  } catch (error) {
    console.error('Error fetching health tips:', error);
    return [
      { title: 'General Advice', content: 'Consult your doctor for personalized advice.', category: 'lifestyle' }
    ];
  }
};

export const fetchUserContext = async (userId: string): Promise<string> => {
  // Fetch user profile
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  // Fetch active medications
  const { data: medications } = await supabase
    .from('medications')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true);

  if (!profile && !medications) return "";

  let context = "User Context:\n";
  if (profile) {
    context += `Name: ${profile.full_name}\n`;
  }
  if (medications && medications.length > 0) {
    context += "Active Medications:\n";
    medications.forEach((med: any) => {
      context += `- ${med.medication_name} (${med.dosage}): ${med.instructions || 'No instructions'}\n`;
    });
  } else {
    context += "No active medications listed.\n";
  }
  return context;
};

export const queryMedicationWithAI = async (
  query: string,
  context: string,
  history: ChatMessage[]
): Promise<string> => {
  // @ts-ignore - API_KEY is defined in scope
  if (!API_KEY) return "I'm sorry, I cannot process your request because the AI service is not configured.";

  try {
    const chatModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Construct the chat history for Gemini
    const systemInstruction = `You are a helpful medication assistant named Lyro. 
    Use the following context about the user to answer their questions.
    If the user asks about their medications, refer to the list provided.
    If the user asks general medical questions, provide general information but always advise consulting a healthcare professional.
    Keep answers concise and friendly.
    
    ${context}`;

    const chat = chatModel.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: systemInstruction }],
        },
        {
          role: "model",
          parts: [{ text: "Understood. I am Lyro, your medication assistant. use the provided context to answer questions." }],
        },
        ...history.map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        })) as any
      ],
      generationConfig: {
        maxOutputTokens: 500,
      },
    });

    const result = await chat.sendMessage(query);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error querying Gemini:', error);
    return "I'm having trouble connecting to the AI right now. Please try again later.";
  }
};
