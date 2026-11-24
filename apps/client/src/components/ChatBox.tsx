import { useState, useRef, useEffect, useCallback, useMemo, KeyboardEvent } from 'react';
import { useEventsStore } from '../stores/events';
import { TargetSelector } from './TargetSelector';
import { QuestionMessage, ChatItem, isQuestionMessage, SpeechRecognition, SpeechRecognitionEvent, SpeechRecognitionErrorEvent } from '../types';
import { useShortcut } from '../hooks/useKeybindings';
import './ChatBox.css';

export function ChatBox() {
  const selectedTarget = useEventsStore((s) => s.selectedTarget);
  const sendMessage = useEventsStore((s) => s.sendMessage);
  const cycleTarget = useEventsStore((s) => s.cycleTarget);
  const fetchMessages = useEventsStore((s) => s.fetchMessages);
  const answerQuestion = useEventsStore((s) => s.answerQuestion);
  const getChatItems = useEventsStore((s) => s.getChatItems);
  const toggleChatPanel = useEventsStore((s) => s.toggleChatPanel);

  const chatItems = useMemo(
    () => getChatItems(selectedTarget),
    [getChatItems, selectedTarget]
  );

  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTargetHint, setShowTargetHint] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [isSpeechSupported, setIsSpeechSupported] = useState(() =>
    'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Fetch messages when target changes
  useEffect(() => {
    fetchMessages(selectedTarget);
  }, [selectedTarget, fetchMessages]);

  // Shortcut to cycle target
  useShortcut('cycleChatTarget', () => {
    cycleTarget();
    setShowTargetHint(true);
    setTimeout(() => setShowTargetHint(false), 1500);
  });

  // Shortcut to focus input
  useShortcut('focusChat', () => {
    inputRef.current?.focus();
  });

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const el = messagesEndRef.current;
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatItems]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = inputValue.trim();
    if (!text || isSending) return;

    setIsSending(true);
    setError(null);

    try {
      await sendMessage(selectedTarget, text);
      setInputValue('');
    } catch {
      setError('Failed to send message. Check connection and try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      toggleChatPanel();
    }
  };

  const handleCycleTarget = () => {
    cycleTarget();
    setShowTargetHint(true);
    setTimeout(() => setShowTargetHint(false), 1500);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  const startListening = useCallback(() => {
    if (isListening || !isSpeechSupported || recognitionRef.current) return;

    const SpeechRecognitionCtor = window.SpeechRecognition || (window as Window & { webkitSpeechRecognition: { new (): SpeechRecognition } }).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setIsSpeechSupported(false);
      setSpeechError('Speech recognition not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setSpeechError(null);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInputValue(transcript);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setIsListening(false);
      recognitionRef.current = null;
      const errorMessages: Record<string, string> = {
        'not-allowed': 'Microphone permission denied',
        'no-speech': 'No speech detected',
        'network': 'Network error occurred',
        'audio-capture': 'Audio capture failed',
        'service-not-allowed': 'Speech recognition service not allowed',
        'bad-grammar': 'Grammar error',
        'aborted': 'Speech recognition aborted',
      };
      setSpeechError(errorMessages[event.error] || `Speech recognition error: ${event.error}`);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isListening, isSpeechSupported, setInputValue, setSpeechError, setIsListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Handle keyboard activation of microphone button
  const handleMicKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleListening();
    }
  };

  return (
    <div className="chat-box">
      {/* Header with target selector */}
      <div className="chat-header">
        <div className="chat-header-left">
          <span className="chat-title">Messages</span>
          <TargetSelector />
        </div>
        <div className="chat-header-right">
          {showTargetHint && (
            <span className="target-hint">Target: {selectedTarget}</span>
          )}
          <button
            className="chat-cycle-btn"
            onClick={handleCycleTarget}
            title="Cycle target (Meta+Shift+K)"
            aria-label="Cycle message target"
            type="button"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="chat-error" role="alert">
          {error}
          <button onClick={() => setError(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      {/* Message history */}
      <div className="chat-messages" role="log" aria-live="polite" aria-label="Message history">
        {chatItems.length === 0 ? (
          <div className="chat-empty">
            <p>No messages for <strong>{selectedTarget}</strong></p>
            <p className="chat-empty-hint">Type a message below to start the conversation</p>
          </div>
        ) : (
          chatItems.map((item, idx) => (
            <ChatItemRenderer
              key={`${selectedTarget}-${item.created_at}-${idx}`}
              item={item}
              target={selectedTarget}
              onAnswerQuestion={answerQuestion}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <form className="chat-input-form" onSubmit={handleSubmit}>
        <textarea
          ref={inputRef}
          className="chat-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onClick={(e) => { e.currentTarget.focus(); }}
          onMouseDown={(e) => { e.currentTarget.focus(); }}
          placeholder={`Message to ${selectedTarget}... (Enter to send, Shift+Enter for new line)`}
          disabled={isSending}
          rows={1}
          style={{ height: 'auto', minHeight: '40px', maxHeight: '120px' }}
          aria-label={`Message input for ${selectedTarget}`}
        />
        <button
          type="button"
          className={`chat-mic-btn ${isListening ? 'listening' : ''} ${speechError ? 'error' : ''}`}
          onClick={toggleListening}
          onKeyDown={handleMicKeyDown}
          disabled={!isSpeechSupported || isSending}
          aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
          aria-pressed={isListening}
          title={isListening ? 'Stop listening (click or press Enter/Space)' : isSpeechSupported ? 'Start voice input (click or press Enter/Space)' : 'Speech recognition not supported'}
        >
          {isListening ? '🔴' : '🎤'}
        </button>
        <button
          className="chat-send-btn"
          type="submit"
          disabled={!inputValue.trim() || isSending}
          aria-label="Send message"
        >
          {isSending ? '⏳' : '➤'}
        </button>
      </form>

      {/* Speech error display */}
      {speechError && (
        <div className="chat-speech-error" role="alert">
          {speechError}
          <button onClick={() => setSpeechError(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      {!isSpeechSupported && (
        <div className="chat-speech-error" role="alert">
          Speech recognition not supported in this browser
        </div>
      )}

      {/* Shortcut hints */}
      <div className="chat-shortcuts">
        <kbd className="shortcut-key">Alt+M</kbd> Focus chat
        <kbd className="shortcut-key">Alt+T</kbd> Cycle target
        <kbd className="shortcut-key">Esc</kbd> Toggle panel
      </div>
    </div>
  );
}

interface ChatItemRendererProps {
  item: ChatItem;
  target: string;
  onAnswerQuestion: (questionId: number, answer: string) => Promise<void>;
}

function ChatItemRenderer({ item, target, onAnswerQuestion }: ChatItemRendererProps) {
  const time = new Date(item.created_at * 1000).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const sessionLabel = item.session_id
    ? ` (${item.session_id.slice(0, 8)})`
    : '';

  if (isQuestionMessage(item)) {
    return <QuestionItem question={item} onAnswerQuestion={onAnswerQuestion} time={time} sessionLabel={sessionLabel} />;
  }

  // Regular message
  const isIncoming = !!item.session_id;

  return (
    <div className={`chat-message ${isIncoming ? 'incoming' : 'outgoing'}`}>
      <div className="chat-message-header">
        <span className="chat-message-target">
          {isIncoming ? `📩 From ${target}` : `📤 To ${target}`}
        </span>
        <span className="chat-message-time">{time}{sessionLabel}</span>
      </div>
      <div className="chat-message-text">{item.text}</div>
    </div>
  );
}

function QuestionItem({ question, onAnswerQuestion, time, sessionLabel }: {
  question: QuestionMessage;
  onAnswerQuestion: (questionId: number, answer: string) => Promise<void>;
  time: string;
  sessionLabel: string;
}) {
  const [isAnswering, setIsAnswering] = useState(false);
  const [answerText, setAnswerText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const answerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isAnswering && answerRef.current) {
      answerRef.current.focus();
    }
  }, [isAnswering]);

  const handleAnswerSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = answerText.trim();
    if (!text || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await onAnswerQuestion(question.id, text);
      setIsAnswering(false);
      setAnswerText('');
    } catch {
      setError('Failed to send answer. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setIsAnswering(false);
    setAnswerText('');
    setError(null);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleAnswerSubmit(event);
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      if (isAnswering) {
        setIsAnswering(false);
        setAnswerText('');
        setError(null);
      }
      // Note: ESC to close panel is handled in ChatBox input handler
    }
  };

  // If answered, don't render (will be filtered out by getChatItems)
  if (question.status === 'answered') {
    return null;
  }

  return (
    <div className="chat-message question incoming">
      <div className="chat-message-header">
        <span className="chat-message-target question-badge">❓ Question from {question.agent_name}</span>
        <span className="chat-message-time">{time}{sessionLabel}</span>
      </div>
      <div className="chat-message-text question-text">{question.question_text}</div>

      {!isAnswering ? (
        <button
          className="question-answer-btn"
          onClick={() => setIsAnswering(true)}
          type="button"
        >
          Answer
        </button>
      ) : (
        <form className="question-answer-form" onSubmit={handleAnswerSubmit}>
          <textarea
            ref={answerRef}
            className="question-answer-input"
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your answer..."
            rows={3}
            disabled={isSubmitting}
            aria-label="Your answer"
          />
          {error && <div className="question-error" role="alert">{error}</div>}
          <div className="question-answer-actions">
            <button type="button" className="btn-cancel" onClick={handleCancel} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn-submit" disabled={!answerText.trim() || isSubmitting}>
              {isSubmitting ? '⏳' : 'Send Answer'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}