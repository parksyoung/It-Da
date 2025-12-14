import React, { useState } from 'react';
import { AnalysisResult, RelationshipMode } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { askRelationshipCoach } from '../services/geminiService';
import { ArrowLeftIcon } from './icons';

interface RomanceChatbotModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: AnalysisResult;
  mode: RelationshipMode;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const RomanceChatbotModal: React.FC<RomanceChatbotModalProps> = ({ isOpen, onClose, result, mode }) => {
  const { t, language } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const response = await askRelationshipCoach(userMessage, result, mode, language);
      setMessages((prev) => [...prev, { role: 'assistant', content: response }]);
    } catch (error: any) {
      const errorMessage = error.message || (language === 'ko' 
        ? '답변을 생성하는 중 오류가 발생했습니다.' 
        : 'An error occurred while generating a response.');
      setMessages((prev) => [...prev, { 
        role: 'assistant', 
        content: errorMessage 
      }]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black bg-opacity-50 fade-in">
      <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-xl w-full md:w-[600px] md:max-h-[80vh] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-xl font-bold text-gray-800">{t('romanceChatbotTitle')}</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              <p className="text-sm">
                {language === 'ko' 
                  ? '관계에 대해 궁금한 것을 물어보세요.'
                  : 'Ask anything about your relationship.'}
              </p>
            </div>
          )}
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 text-sm ${
                  msg.role === 'user'
                    ? 'bg-pink-500 text-white'
                    : 'bg-white text-gray-800 border border-gray-200'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-200 bg-white">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={t('romanceChatbotPlaceholder')}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="px-6 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('romanceChatbotSend')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RomanceChatbotModal;

