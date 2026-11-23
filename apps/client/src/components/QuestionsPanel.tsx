/** Placeholder for P5.4 QuestionsPanel component.
 * This is a minimal implementation to allow spec tests to import it.
 * The actual implementation will be added when P5.4 is implemented.
 */

import { useEventsStore, Question } from '../stores/events';
import { useState, useEffect } from 'react';
import './QuestionsPanel.css';

export function QuestionsPanel() {
  const { questions, answerQuestion, startQuestionsPolling, stopQuestionsPolling } =
    useEventsStore();

  const [pendingQuestions, setPendingQuestions] = useState<Question[]>([]);
  const [answeringId, setAnsweringId] = useState<number | null>(null);
  const [answerText, setAnswerText] = useState<string>('');

  useEffect(() => {
    // Filter to pending questions for display
    setPendingQuestions(questions.filter((q) => q.status === 'pending'));

    // Start polling when component mounts
    startQuestionsPolling();
    return () => stopQuestionsPolling();
  }, [questions, startQuestionsPolling, stopQuestionsPolling]);

  const handleAnswerSubmit = async (questionId: number) => {
    if (!answerText.trim()) return;
    await answerQuestion(questionId, answerText.trim());
    setAnswerText('');
    setAnsweringId(null);
  };

  const handleStartAnswer = (questionId: number) => {
    setAnsweringId(questionId);
    setAnswerText('');
  };

  if (pendingQuestions.length === 0) {
    return (
      <div className="questions-panel">
        <div className="questions-header">
          <h3>Agent Questions</h3>
          <span className="questions-count">No pending questions</span>
        </div>
        <div className="questions-empty">Waiting for agents to ask questions...</div>
      </div>
    );
  }

  return (
    <div className="questions-panel">
      <div className="questions-header">
        <h3>Agent Questions</h3>
        <span className="questions-count">{pendingQuestions.length} pending</span>
      </div>
      <div className="questions-list">
        {pendingQuestions.map((question) => (
          <div key={question.id} className="question-card">
            <div className="question-meta">
              <span className="question-agent">{question.agent_name}</span>
              <span className="question-session">Session: {question.session_id.slice(0, 8)}...</span>
            </div>
            <div className="question-text">{question.question_text}</div>

            {answeringId === question.id ? (
              <div className="answer-form">
                <textarea
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  placeholder="Type your answer..."
                  rows={3}
                  autoFocus
                />
                <div className="answer-actions">
                  <button onClick={() => setAnsweringId(null)} className="btn-cancel">
                    Cancel
                  </button>
                  <button
                    onClick={() => handleAnswerSubmit(question.id)}
                    className="btn-submit"
                    disabled={!answerText.trim()}
                  >
                    Send Answer
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => handleStartAnswer(question.id)}
                className="btn-answer"
              >
                Answer
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}