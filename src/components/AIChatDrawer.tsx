import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Send, 
  Sparkles, 
  Bot, 
  User, 
  RotateCw, 
  HelpCircle,
  Lightbulb,
  CheckCircle2
} from 'lucide-react';

interface AIChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export const AIChatDrawer: React.FC<AIChatDrawerProps> = ({
  isOpen,
  onClose,
  isDark,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Hello! I am your **Nifty Accumulation Zone AI Mentor** powered by **Gemini 3.7 Flash** and embedded **DuckDB** analytics.\n\nI can answer questions regarding Wyckoff accumulation structures, institutional delivery volume footprints, risk-reward ratios, and backtest parameter optimizations. How can I help you today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const quickPrompts = [
    'What is the Accumulation Zone (+5% to +6%) strategy?',
    'Why is delivery volume % critical on the NSE?',
    'How should I place stop losses around anchor lows?',
    'What are the best backtest parameters for Nifty 50?',
  ];

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim() || loading) return;

    const userMsg: Message = {
      id: String(Date.now()),
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query }),
      });
      if (!res.ok) throw new Error('AI Chat request failed');
      const data = await res.json();

      const assistantMsg: Message = {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: data.reply || 'No response received.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('AI Chat error:', err);
      const errorMsg: Message = {
        id: String(Date.now() + 1),
        role: 'assistant',
        content: 'I encountered an error connecting to the Gemini intelligence engine. Please ensure your API key or network connection is active.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#09090b]/70 backdrop-blur-xs transition-opacity duration-300">
      <div className={`w-full max-w-lg h-full border-l shadow-2xl flex flex-col transition-colors ${
        isDark ? 'bg-[#0c0c0e] border-[#27272a] text-[#e4e4e7]' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        {/* Header */}
        <div className={`p-3 px-4 border-b flex items-center justify-between ${
          isDark ? 'bg-[#0c0c0e] border-[#27272a]' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="font-bold text-xs uppercase tracking-tight font-mono text-purple-300">
                Gemini AI Trading Advisor
              </h3>
              <p className="text-[10px] text-[#71717a] font-mono">Institutional Wyckoff & NSE Quantitative Mentor</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded border border-[#27272a] hover:bg-[#18181b] text-[#71717a] hover:text-[#e4e4e7] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Quick Prompts */}
        <div className={`p-2 px-3 border-b overflow-x-auto flex space-x-1.5 scrollbar-none ${
          isDark ? 'bg-[#09090b] border-[#27272a]' : 'bg-slate-50/50 border-slate-200'
        }`}>
          {quickPrompts.map((p, i) => (
            <button
              key={i}
              onClick={() => handleSend(p)}
              disabled={loading}
              className={`px-2 py-0.5 rounded text-[10px] font-mono whitespace-nowrap border transition-all ${
                isDark
                  ? 'bg-[#121214] border-[#27272a] text-[#a1a1aa] hover:text-purple-300 hover:border-purple-500/40'
                  : 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Message History */}
        <div className="flex-1 p-3 space-y-3 overflow-y-auto">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex items-start space-x-2 ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}
            >
              <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 text-xs font-mono ${
                msg.role === 'user'
                  ? 'bg-emerald-500 text-[#09090b] font-bold'
                  : 'bg-purple-600/30 border border-purple-500/40 text-purple-300'
              }`}>
                {msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
              </div>

              <div className={`max-w-[88%] p-2.5 rounded text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-emerald-500 text-[#09090b] font-medium'
                  : isDark
                  ? 'bg-[#121214] border border-[#27272a] text-[#e4e4e7]'
                  : 'bg-slate-100 border border-slate-200 text-slate-800'
              }`}>
                <div className="whitespace-pre-line text-xs font-sans">{msg.content}</div>
                <div className={`text-[9px] font-mono mt-1 text-right ${msg.role === 'user' ? 'text-[#09090b]/70' : 'text-[#71717a]'}`}>
                  {msg.timestamp}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center space-x-2 text-xs font-mono text-purple-400 p-2">
              <RotateCw className="w-3.5 h-3.5 animate-spin" />
              <span>Gemini is synthesizing market intelligence...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className={`p-2.5 border-t ${
          isDark ? 'bg-[#0c0c0e] border-[#27272a]' : 'bg-slate-50 border-slate-200'
        }`}>
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center space-x-1.5"
          >
            <input
              type="text"
              placeholder="Ask about accumulation zones, setups, delivery %..."
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={loading}
              className={`flex-1 py-1.5 px-2.5 text-xs rounded border transition-all font-mono ${
                isDark
                  ? 'bg-[#121214] border-[#27272a] text-[#e4e4e7] placeholder-[#71717a] focus:border-purple-500'
                  : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-purple-500'
              } focus:outline-hidden`}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-1.5 rounded bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-colors disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
