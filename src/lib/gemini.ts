import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from './supabase';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface UserContext {
  profile: {
    full_name: string;
    preferred_channel: string;
    email?: string;
  };
  medications: Array<{
    medication_name: string;
    dosage: string;
    instructions: string;
    active: boolean;
  }>;
  adherence: Array<{
    medication_name: string;
    scheduled_time: string;
    taken_at?: string;
    status: string;
  }>;
  recentQueries: string[];
}

export async function queryMedicationWithAI(
  query: string,
  userContext: UserContext,
  history: ChatMessage[] = []
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const conversationHistory = history
    .map(message => `${message.role === 'user' ? 'USER' : 'ASSISTANT'}: ${message.content}`)
    .join('\n');

  const contextPrompt = `
You are a helpful medication assistant. Use the following user context to provide personalized, accurate responses:

USER PROFILE:
- Name: ${userContext.profile.full_name}
- Preferred communication: ${userContext.profile.preferred_channel}
${userContext.profile.email ? `- Email: ${userContext.profile.email}` : ''}

CURRENT MEDICATIONS:
${userContext.medications.map(med => `- ${med.medication_name}: ${med.dosage}${med.instructions ? ` (${med.instructions})` : ''}${!med.active ? ' (Inactive)' : ''}`).join('\n')}

RECENT ADHERENCE HISTORY:
${userContext.adherence.slice(0, 10).map(log => `- ${log.medication_name}: ${log.status} on ${new Date(log.scheduled_time).toLocaleDateString()}${log.taken_at ? ` (taken at ${new Date(log.taken_at).toLocaleTimeString()})` : ''}`).join('\n')}

PREVIOUS QUERIES:
${userContext.recentQueries.slice(0, 5).map(q => `- ${q}`).join('\n')}

CONVERSATION HISTORY:
${conversationHistory || 'No prior messages.'}

INSTRUCTIONS:
- Provide accurate, helpful information about medications
- Consider the user's current medications and adherence history
- Be empathetic and encouraging about medication adherence
- Always recommend consulting healthcare professionals for medical advice
- If the query is about a medication not in their current regimen, provide general information but note it's not part of their current treatment
- Keep responses concise but informative
- Use the user's name when appropriate
- Respond in 3 to 5 Lines

LATEST USER QUERY: ${query}
`;

  try {
    const result = await model.generateContent(contextPrompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Gemini API error:', error);
    throw new Error('Failed to get AI response. Please try again.');
  }
}

export async function fetchUserContext(userId: string): Promise<UserContext> {
  // Fetch user profile
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  // Fetch current medications
  const { data: medications } = await supabase
    .from('medications')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true);

  // Fetch recent adherence logs (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: adherenceLogs } = await supabase
    .from('adherence_logs')
    .select(`
      *,
      medications (
        medication_name
      )
    `)
    .eq('user_id', userId)
    .gte('scheduled_time', thirtyDaysAgo.toISOString())
    .order('scheduled_time', { ascending: false })
    .limit(20);

  // For now, we'll initialize recentQueries as empty since we don't have a queries table
  // This can be enhanced later to track user queries
  const recentQueries: string[] = [];

  return {
    profile: {
      full_name: profile?.full_name || 'User',
      preferred_channel: profile?.preferred_channel || 'email',
      email: profile?.email,
    },
    medications: medications || [],
    adherence: (adherenceLogs || []).map(log => ({
      medication_name: log.medications?.medication_name || 'Unknown',
      scheduled_time: log.scheduled_time,
      taken_at: log.taken_at,
      status: log.status,
    })),
    recentQueries,
  };
}

