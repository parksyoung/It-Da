import React, { useEffect, useMemo, useState } from 'react';
import { RelationshipMode } from '../types';
import { counselConversation } from '../services/geminiService';
import { useLanguage } from '../contexts/LanguageContext';
import { getCounselMessages, saveCounselMessages } from '../services/firebase';

type ChatRole = 'user' | 'assistant';

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}

interface CounselChatProps {
  history: string[];
  mode: RelationshipMode;
  speaker1Name: string;
  speaker2Name: string;
}

const CounselChat: React.FC<CounselChatProps> = ({ history, mode, speaker1Name, speaker2Name }) => {
  const { language } = useLanguage();
  const welcomeMessage = useMemo<ChatMessage>(() => {
    return {
      id: 'welcome',
      role: 'assistant',
      content:
        language === 'ko'
          ? `${speaker2Name}님과의 누적 대화를 바탕으로, 고민을 자유롭게 적어주면 같이 정리해볼게요. (예: “이 상황에서 뭐라고 답장할까?”, “요즘 분위기가 왜 이런 것 같아?”)`
          : `Ask anything about your conversations with ${speaker2Name}. I’ll use your accumulated chat history to help you think through it.`,
    };
  }, [language, speaker2Name]);

  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const historyString = useMemo(() => {
    return (history || []).join('\n\n---\n\n');
  }, [history]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const stored = await getCounselMessages(speaker2Name);
        if (cancelled) return;
        const restored: ChatMessage[] = stored.map((m) => ({ id: m.id, role: m.role, content: m.content }));
        setMessages([welcomeMessage, ...restored]);
      } catch (e: any) {
        if (cancelled) return;
        console.error('[CounselChat] Failed to load counsel messages:', e);
        setMessages([welcomeMessage]);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [speaker2Name, welcomeMessage]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending) return;

    setError(null);
    setIsSending(true);

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: text,
    };

    const base = messages.filter((m) => m.id !== 'welcome');
    const afterUser = [...base, userMsg];
    setMessages([welcomeMessage, ...afterUser]);
    setInput('');

    try {
      await saveCounselMessages(speaker2Name, afterUser.map((m) => ({ id: m.id, role: m.role, content: m.content })));
    } catch (e: any) {
      console.warn('[CounselChat] Failed to persist user message:', e);
    }

    try {
      const answer = await counselConversation(historyString, text, mode, language as any, speaker1Name, speaker2Name);
      const aiMsg: ChatMessage = {
        id: `a_${Date.now()}`,
        role: 'assistant',
        content: answer,
      };
      const afterAi = [...afterUser, aiMsg];
      setMessages([welcomeMessage, ...afterAi]);

      try {
        await saveCounselMessages(speaker2Name, afterAi.map((m) => ({ id: m.id, role: m.role, content: m.content })));
      } catch (e: any) {
        console.warn('[CounselChat] Failed to persist assistant message:', e);
      }
    } catch (e: any) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="itda-card p-5 md:p-7">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <div className="text-xl font-black text-gray-800">상담 챗봇</div>
          <div className="text-sm text-gray-600">{speaker2Name} · {mode}</div>
        </div>
        <div className="itda-pill">beta</div>
      </div>

      <div className="itda-card-soft p-4 md:p-5" style={{ maxHeight: 420, overflow: 'auto' }}>
        <div className="space-y-3">
          {messages.map((m) => (
            <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={m.role === 'user' ? 'max-w-[92%] md:max-w-[78%] itda-alert' : 'max-w-[92%] md:max-w-[78%] itda-alert'}
                style={{
                  background:
                    m.role === 'user'
                      ? 'rgba(126, 162, 200, 0.14)'
                      : 'rgba(197, 139, 215, 0.12)',
                  borderColor:
                    m.role === 'user'
                      ? 'rgba(126, 162, 200, 0.22)'
                      : 'rgba(197, 139, 215, 0.22)',
                }}
              >
                <div className="text-sm whitespace-pre-line text-gray-800">{m.content}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && <div className="itda-alert itda-alert-error mt-4">{error}</div>}

      <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-start">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={language === 'ko' ? '고민을 자유롭게 적어주세요…' : 'Ask your question…'}
          className="itda-field smooth-transition min-h-[90px]"
        />
        <button
          onClick={handleSend}
          disabled={isSending || !input.trim()}
          className="itda-btn itda-btn-primary px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSending ? (language === 'ko' ? '작성 중…' : 'Thinking…') : (language === 'ko' ? '보내기' : 'Send')}
        </button>
      </div>
    </div>
  );
};

export default CounselChat;
