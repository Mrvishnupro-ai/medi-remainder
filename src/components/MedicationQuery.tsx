import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { queryMedicationWithAI, fetchUserContext, ChatMessage } from '../lib/gemini';
import {
  Send as SendIcon,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const QUICK_REPLIES = [
  'What happens if I miss a dose?',
  'Remind me of my next medication.',
  'Are there any side effects?',
];

interface MessageWithTimestamp extends ChatMessage {
  timestamp?: string;
  id?: string;
}

export default function MedicationQuery() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<MessageWithTimestamp[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const getTimeString = () => {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM is fully updated
    const scrollToBottom = () => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }
    };

    // Scroll immediately
    scrollToBottom();
    
    // Also scroll after a small delay to catch any animations
    const timeoutId = setTimeout(scrollToBottom, 100);
    
    return () => clearTimeout(timeoutId);
  }, [messages, loading]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!query.trim() || !user || loading) return;

    const trimmedQuery = query.trim();
    const userMessage: MessageWithTimestamp = { 
      role: 'user', 
      content: trimmedQuery,
      timestamp: getTimeString(),
      id: `msg-${Date.now()}-user`
    };

    // Optimistically add user message
    setMessages(prev => [...prev, userMessage]);
    setQuery('');
    setError(null);
    setLoading(true);

    try {
      const userContext = await fetchUserContext(user.id);
      const aiResponse = await queryMedicationWithAI(
        trimmedQuery, 
        userContext, 
        messages.map(m => ({ role: m.role, content: m.content }))
      );

      const assistantMessage: MessageWithTimestamp = { 
        role: 'assistant', 
        content: aiResponse,
        timestamp: getTimeString(),
        id: `msg-${Date.now()}-assistant`
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Error querying AI:', err);
      setError(err instanceof Error ? err.message : 'An error occurred. Please try again.');
      setMessages(prev => prev.filter(m => m.id !== userMessage.id));
    } finally {
      setLoading(false);
    }
  };

  const handleQuickReply = (reply: string) => {
    setQuery(reply);
  };

  const showQuickReplies =
    messages.length === 0 || (messages[messages.length - 1]?.role === 'assistant' && !loading);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Messages Container - Scrollable */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
      >
        {messages.length === 0 && !loading && (
          <div className="flex h-full items-center justify-center text-center text-slate-400">
            <div className="max-w-sm space-y-2">
              <p className="text-sm font-medium">Hello! 👋</p>
              <p className="text-xs">Start a conversation by typing a message or choosing a quick reply below</p>
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={message.id || `${message.role}-${index}`}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
          >
            <div className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'} gap-1 max-w-xs`}>
              <div
                className={`px-4 py-3 text-sm leading-relaxed rounded-2xl break-words ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-none shadow-sm'
                    : 'bg-gray-100 text-slate-800 border border-gray-200 rounded-bl-none shadow-sm'
                }`}
              >
                {message.role === 'assistant' ? (
                  <div className="prose prose-sm max-w-none prose-p:m-0 prose-ul:m-0 prose-li:m-0 text-slate-800">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {message.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{message.content}</div>
                )}
              </div>
              {message.timestamp && (
                <span className={`text-xs font-medium ${message.role === 'user' ? 'text-slate-500' : 'text-slate-400'}`}>
                  {message.timestamp}
                </span>
              )}
              {message.role === 'assistant' && index === messages.length - 1 && !loading && (
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    className="text-xs px-3 py-1.5 rounded-full bg-blue-600 text-white font-medium transition hover:bg-blue-700 active:scale-95"
                  >
                    Thank you!
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start animate-fade-in">
            <div className="flex items-center gap-2 px-4 py-3 rounded-2xl rounded-bl-none bg-gray-100 border border-gray-200">
              <div className="flex gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0s' }}></span>
                <span className="inline-block h-2 w-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                <span className="inline-block h-2 w-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0.4s' }}></span>
              </div>
              <span className="text-xs text-blue-600 font-medium ml-1">Lyro AI is thinking</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} className="h-0" />
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-3 mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Quick Replies - Only show when appropriate */}
      {showQuickReplies && messages.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-100 bg-white flex-shrink-0">
          <div className="flex flex-wrap gap-2">
            {QUICK_REPLIES.map((reply) => (
              <button
                key={reply}
                type="button"
                onClick={() => handleQuickReply(reply)}
                disabled={loading}
                className="rounded-full border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-600 transition hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {reply}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-gray-200 bg-white px-4 py-3 flex-shrink-0">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="flex flex-1 items-center rounded-full border border-gray-300 bg-white px-4 py-2.5 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 border-none bg-transparent text-sm focus:outline-none focus:ring-0 placeholder-gray-400"
              placeholder="Type in a message..."
              disabled={loading}
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="inline-flex items-center justify-center rounded-full bg-blue-600 p-2.5 text-white shadow-md transition hover:bg-blue-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Send message"
          >
            <SendIcon size={18} strokeWidth={2.5} />
          </button>
        </form>

        {/* Footer Attribution */}
        <div className="mt-2 flex justify-end pr-1">
          <p className="text-xs text-gray-400">POWERED BY Ai</p>
        </div>
      </div>
    </div>
  );
}
