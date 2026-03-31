import { useState } from 'react';
import { MessageCircleQuestion, Send, Loader2 } from 'lucide-react';
import { askAboutStep, getApiKey } from '../../utils/ai';
import type { PmcsStepData } from '../../types';

interface AskAIProps {
  step: PmcsStepData;
  vehicleType: string;
}

export function AskAI({ step, vehicleType }: AskAIProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const hasKey = !!getApiKey();

  const handleAsk = async () => {
    if (!question.trim() || isLoading) return;
    setIsLoading(true);
    setError('');
    setAnswer('');
    try {
      const response = await askAboutStep(question.trim(), {
        vehicleType,
        zone: step.zone,
        item: step.item,
        itemDescription: step.itemDescription,
        procedure: step.procedure,
        isNoGo: step.isNoGo,
        noGoCondition: step.noGoCondition,
      });
      setAnswer(response);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to get answer');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 text-accent-blue text-sm font-medium min-h-[44px]"
      >
        <MessageCircleQuestion size={18} />
        Ask AI about this step
      </button>
    );
  }

  return (
    <div className="bg-bg-tertiary rounded-[var(--radius-md)] p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-text-secondary font-display">ASK AI</span>
        <button onClick={() => { setIsOpen(false); setAnswer(''); setQuestion(''); setError(''); }} className="text-xs text-text-secondary min-h-[44px] px-2">
          Close
        </button>
      </div>

      {!hasKey ? (
        <p className="text-sm text-accent-amber">Add your Gemini API key in Settings to use AI.</p>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
              placeholder="e.g., What does milky oil look like?"
              className="flex-1 min-h-[44px] px-3 text-base bg-bg-secondary text-text-primary border border-border rounded-[var(--radius-md)] placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent-blue"
            />
            <button
              onClick={handleAsk}
              disabled={!question.trim() || isLoading}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-accent-blue text-white rounded-[var(--radius-md)] disabled:opacity-40"
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>

          {error && <p className="text-sm text-accent-red">{error}</p>}

          {answer && (
            <div className="bg-bg-secondary rounded-[var(--radius-sm)] p-3 border border-border">
              <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">{answer}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
