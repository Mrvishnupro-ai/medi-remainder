
import { GoogleGenAI } from '@google/genai';
import { supabase } from './supabase';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Initialize Gemini API
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

// Initialize client
const ai = new GoogleGenAI({
  apiKey: API_KEY,
});

// Model to use
const MODEL_NAME = 'gemini-2.5-flash';

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

    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ]
    });

    // Check compatibility with new SDK response structure
    const text = result.text || result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) return [];

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

    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ]
    });

    const text = result.text || result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) return [];

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
  if (!API_KEY) return "I'm sorry, I cannot process your request because the AI service is not configured (Missing API Key).";

  try {
    const systemInstruction = `You are a helpful medication assistant named Lyro. 
    Use the following context about the user to answer their questions.
    If the user asks about their medications, refer to the list provided.
    If the user asks general medical questions, provide general information but always advise consulting a healthcare professional.
    Keep answers concise and friendly.
    
    ${context}`;

    // Map history to new format
    const contents = [
      { role: 'user', parts: [{ text: systemInstruction }] },
      { role: 'model', parts: [{ text: "Understood. I am Lyro, your medication assistant. use the provided context to answer questions." }] },
      ...history.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }))
    ];

    // Add current query
    contents.push({ role: 'user', parts: [{ text: query }] });

    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: contents as any
    });

    const text = result.text || result.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!text) return "I didn't get a clear response.";

    return text;
  } catch (error) {
    console.error('Error querying Gemini:', error);
    return "I'm having trouble connecting to the AI right now. Please try again later.";
  }
};
