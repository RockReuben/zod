import { useEffect, useState } from 'react';
import { useEventsStore } from '../stores/events';
import { PlanAssumption, PlanQuestion, PlanReply } from '../types';
import './AssumptionsPanel.css';

interface AssumptionsPanelProps {
  planName: string | null;
}

export function AssumptionsPanel({ planName }: AssumptionsPanelProps) {
  const planAssumptions = useEventsStore((s) => s.planAssumptions);
  const planAssumptionsLoading = useEventsStore((s) => s.planAssumptionsLoading);
  const planAssumptionsError = useEventsStore((s) => s.planAssumptionsError);
  const fetchPlanAssumptions = useEventsStore((s) => s.fetchPlanAssumptions);
  const sendPlanReply = useEventsStore((s) => s.sendPlanReply);
  const clearPlanAssumptions = useEventsStore((s) => s.clearPlanAssumptions);

  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<Record<string, boolean>>({});
  const [sendErrors, setSendErrors] = useState<Record<string, string | null>>({});

  // Fetch assumptions when plan changes
  useEffect(() => {
    if (planName) {
      clearPlanAssumptions();
      fetchPlanAssumptions(planName);
    } else {
      clearPlanAssumptions();
    }
  }, [planName, fetchPlanAssumptions, clearPlanAssumptions]);

  const handleReplyChange = (itemId: string, text: string) => {
    setReplyTexts(prev => ({ ...prev, [itemId]: text }));
    setSendErrors(prev => ({ ...prev, [itemId]: null }));
  };

  const handleSendReply = async (itemId: string, itemType: 'assumption' | 'question', text: string) => {
    if (!text.trim() || !planName) return;

    setSending(prev => ({ ...prev, [itemId]: true }));
    setSendErrors(prev => ({ ...prev, [itemId]: null }));

    try {
      const reply: PlanReply = { itemId, itemType, reply: text.trim() };
      await sendPlanReply(planName, reply);
      // Clear the reply text on success
      setReplyTexts(prev => ({ ...prev, [itemId]: '' }));
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to send reply';
      setSendErrors(prev => ({ ...prev, [itemId]: errorMessage }));
    } finally {
      setSending(prev => ({ ...prev, [itemId]: false }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, itemId: string, itemType: 'assumption' | 'question', text: string) => {
    // Ctrl/Cmd + Enter to send
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSendReply(itemId, itemType, text);
    }
  };

  if (!planName) {
    return (
      <div className="assumptions-panel">
        <div className="assumptions-empty">
          <p>Select a plan to view assumptions and open questions</p>
        </div>
      </div>
    );
  }

  if (planAssumptionsLoading) {
    return (
      <div className="assumptions-panel">
        <div className="assumptions-loading">
          <div className="loading-spinner" />
          <p>Loading plan assumptions…</p>
        </div>
      </div>
    );
  }

  if (planAssumptionsError) {
    return (
      <div className="assumptions-panel">
        <div className="assumptions-error">
          <p>Error: {planAssumptionsError}</p>
        </div>
      </div>
    );
  }

  if (!planAssumptions) {
    return (
      <div className="assumptions-panel">
        <div className="assumptions-empty">
          <p>No assumptions data available</p>
        </div>
      </div>
    );
  }

  const { assumptions, openQuestions } = planAssumptions;

  return (
    <div className="assumptions-panel">
      {/* Assumptions Section */}
      <section className="assumptions-section">
        <h3 className="assumptions-section-title">
          Assumptions
          <span className="assumptions-count">({assumptions.length})</span>
        </h3>
        {assumptions.length === 0 ? (
          <p className="assumptions-empty-text">No assumptions in this plan</p>
        ) : (
          <ul className="assumptions-list">
            {assumptions.map((assumption: PlanAssumption) => (
              <li key={assumption.id} className="assumption-item">
                <div className="assumption-content">
                  <span className="assumption-text">{assumption.text}</span>
                </div>
                <AssumptionReplyBox
                  itemId={assumption.id}
                  itemType="assumption"
                  replyText={replyTexts[assumption.id] || ''}
                  onReplyChange={handleReplyChange}
                  onSendReply={handleSendReply}
                  onKeyDown={handleKeyDown}
                  sending={sending[assumption.id] || false}
                  error={sendErrors[assumption.id] || null}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Open Questions Section */}
      <section className="assumptions-section">
        <h3 className="assumptions-section-title">
          Open Questions
          <span className="assumptions-count">({openQuestions.length})</span>
        </h3>
        {openQuestions.length === 0 ? (
          <p className="assumptions-empty-text">No open questions in this plan</p>
        ) : (
          <ul className="assumptions-list">
            {openQuestions.map((question: PlanQuestion) => (
              <li key={question.id} className="assumption-item">
                <div className="assumption-content">
                  <span className="assumption-text">{question.text}</span>
                </div>
                <AssumptionReplyBox
                  itemId={question.id}
                  itemType="question"
                  replyText={replyTexts[question.id] || ''}
                  onReplyChange={handleReplyChange}
                  onSendReply={handleSendReply}
                  onKeyDown={handleKeyDown}
                  sending={sending[question.id] || false}
                  error={sendErrors[question.id] || null}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

interface AssumptionReplyBoxProps {
  itemId: string;
  itemType: 'assumption' | 'question';
  replyText: string;
  onReplyChange: (itemId: string, text: string) => void;
  onSendReply: (itemId: string, itemType: 'assumption' | 'question', text: string) => void;
  onKeyDown: (e: React.KeyboardEvent, itemId: string, itemType: 'assumption' | 'question', text: string) => void;
  sending: boolean;
  error: string | null;
}

function AssumptionReplyBox({
  itemId,
  itemType,
  replyText,
  onReplyChange,
  onSendReply,
  onKeyDown,
  sending,
  error,
}: AssumptionReplyBoxProps) {
  const charCount = replyText.length;
  const isOverLimit = charCount > 500;

  return (
    <div className="assumption-reply-box">
      <textarea
        className="assumption-reply-input"
        placeholder={`Reply to ${itemType}… (Ctrl+Enter to send)`}
        value={replyText}
        onChange={(e) => onReplyChange(itemId, e.target.value)}
        onKeyDown={(e) => onKeyDown(e, itemId, itemType, replyText)}
        disabled={sending}
        rows={2}
        aria-label={`Reply to ${itemType} ${itemId}`}
      />
      <div className="assumption-reply-footer">
        <span className={`assumption-char-count ${isOverLimit ? 'over-limit' : ''}`}>
          {charCount}/500
        </span>
        {error && <span className="assumption-error-text">{error}</span>}
        <button
          className="assumption-send-btn"
          onClick={() => onSendReply(itemId, itemType, replyText)}
          disabled={sending || !replyText.trim() || isOverLimit}
        >
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  );
}