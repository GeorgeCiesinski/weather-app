/**
 * Per-location Advisor overlay: chat transcript, segmented scope, presets, and custom ask.
 *
 * Stays mounted while closed (inert / non-interactive). Portaled to document.body so
 * position:fixed is not clipped by weather-card overflow on iOS WebKit. Does not fetch —
 * parent owns history and askAdvice. Scope segment drives whether asks use location or day context.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Brand from './Brand';
import type { AdviceMessage, AdviceScope } from '../types/advice';
import { attachFocusTrap } from '../utils/focusTrap';

const LOCATION_PRESETS = [
  'What should I wear over the next five days?',
  'Any good days for outdoor plans?',
  'Do I need an umbrella soon?',
  'Will it feel hot or cold?',
  'Anything I should watch for?',
  'What is the air quality like?',
] as const;

const DAY_PRESETS = [
  'What should I wear this day?',
  'Is this a good day for outdoor plans?',
  'Do I need an umbrella this day?',
  'Will it feel hot or cold this day?',
  'Anything I should watch for this day?',
  'What is the air quality like today?',
] as const;

type AdviceAdvisorOverlayProps = {
  id: string;
  isOpen: boolean;
  locationName: string;
  dayLabel: string;
  history: AdviceMessage[];
  isLoading?: boolean;
  error?: string | null;
  onClose: () => void;
  onAsk: (scope: AdviceScope, question: string) => void;
  disabled?: boolean;
};

/**
 * Renders the weather advisor dialog for one location card.
 *
 * Opening the overlay resets question scope to the next five days and clears the
 * custom input; chat history is owned by the parent and is not cleared.
 *
 * @param props - Component props.
 * @param props.id - DOM id for aria-controls from the Ask Advisor trigger.
 * @param props.isOpen - Whether the overlay is visible and interactive.
 * @param props.locationName - Location title shown in the toolbar.
 * @param props.dayLabel - Label for the day segment (tracks card selected day).
 * @param props.history - Session chat turns for this location (display only).
 * @param props.isLoading - Whether an advice request is in progress.
 * @param props.error - Error message after a failed request.
 * @param props.onClose - Called when the user closes the overlay.
 * @param props.onAsk - Called with active scope and a trimmed question.
 * @param props.disabled - Disables composer controls while a request is in flight.
 * @returns The advisor overlay UI.
 */
export default function AdviceAdvisorOverlay({
  id,
  isOpen,
  locationName,
  dayLabel,
  history,
  isLoading = false,
  error = null,
  onClose,
  onAsk,
  disabled = false,
}: AdviceAdvisorOverlayProps) {
  const titleId = useId();
  const inputId = useId();
  const overlayRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [adviceScope, setAdviceScope] = useState<AdviceScope>('location');
  const [customQuestion, setCustomQuestion] = useState('');
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  // Reset composer when the overlay opens; keep chat history intact.
  if (isOpen && !prevIsOpen) {
    setPrevIsOpen(true);
    setAdviceScope('location');
    setCustomQuestion('');
  } else if (!isOpen && prevIsOpen) {
    setPrevIsOpen(false);
  }

  const presets = adviceScope === 'location' ? LOCATION_PRESETS : DAY_PRESETS;
  const scopeName = adviceScope === 'location' ? 'the next five days' : dayLabel;
  const placeholder =
    adviceScope === 'location' ? 'Ask about the next five days...' : `Ask about ${dayLabel}...`;
  const composerDisabled = disabled || isLoading;

  // Autofocus the question input when the overlay opens.
  useEffect(() => {
    if (!isOpen) return;

    const frameId = requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
    });

    return () => cancelAnimationFrame(frameId);
  }, [isOpen]);

  // Escape closes the overlay while it is open.
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  // Inert the app shell and trap Tab inside the portaled overlay while open.
  useEffect(() => {
    if (!isOpen) return;

    const root = document.getElementById('root');
    const overlay = overlayRef.current;
    if (!root || !overlay) return;

    const previousRootInert = root.inert;
    root.inert = true;
    const releaseTrap = attachFocusTrap(overlay);

    return () => {
      root.inert = previousRootInert;
      releaseTrap();
    };
  }, [isOpen]);

  // Keep the latest message in view when history or loading state changes.
  useEffect(() => {
    if (!isOpen) return;
    chatEndRef.current?.scrollIntoView({ block: 'end' });
  }, [isOpen, history, isLoading, error]);

  /**
   * Submits a trimmed question for the active scope, then clears the custom input.
   *
   * @param question - Preset or custom question text.
   */
  function submitQuestion(question: string): void {
    const trimmed = question.trim();
    if (!trimmed || composerDisabled) return;
    onAsk(adviceScope, trimmed);
    setCustomQuestion('');
  }

  /**
   * Handles the custom question form submit.
   *
   * @param event - Form submit event.
   */
  function handleCustomSubmit(event: React.FormEvent): void {
    event.preventDefault();
    submitQuestion(customQuestion);
  }

  return createPortal(
    <div
      ref={overlayRef}
      id={id}
      className="advice-overlay"
      data-open={isOpen ? 'true' : 'false'}
      inert={isOpen ? undefined : true}
    >
      <div
        className="advice-overlay__panel"
        role={isOpen ? 'dialog' : undefined}
        aria-modal={isOpen ? true : undefined}
        aria-labelledby={titleId}
      >
        <Brand />
        <div className="advice-overlay__toolbar">
          <h2 id={titleId} className="advice-overlay__title">
            {locationName}
          </h2>
          <button
            type="button"
            className="advice-overlay__close"
            onClick={onClose}
            aria-label="Close advisor"
          >
            Close
          </button>
        </div>

        <div className="advice-overlay__chat" aria-live="polite">
          {history.length === 0 ? (
            <p className="advice-overlay__empty">Ask a question to get started.</p>
          ) : (
            history.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`advice-overlay__bubble advice-overlay__bubble--${message.role}`}
              >
                <p className="advice-overlay__bubble-text">{message.content}</p>
              </div>
            ))
          )}

          {isLoading ? <p className="advice-overlay__status">Thinking…</p> : null}
          {error ? <p className="advice-overlay__error">{error}</p> : null}
          <div ref={chatEndRef} />
        </div>

        <div className="advice-overlay__composer">
          <div className="advice-overlay__segments" role="tablist" aria-label="Question scope">
            <button
              type="button"
              role="tab"
              className={`advice-overlay__segment${adviceScope === 'location' ? ' advice-overlay__segment--active' : ''}`}
              aria-selected={adviceScope === 'location'}
              onClick={() => setAdviceScope('location')}
              disabled={composerDisabled}
            >
              Next 5 days
            </button>
            <button
              type="button"
              role="tab"
              className={`advice-overlay__segment${adviceScope === 'day' ? ' advice-overlay__segment--active' : ''}`}
              aria-selected={adviceScope === 'day'}
              onClick={() => setAdviceScope('day')}
              disabled={composerDisabled}
            >
              {dayLabel}
            </button>
          </div>

          <div
            className="advice-overlay__presets"
            role="group"
            aria-label={`Suggested questions about ${scopeName}`}
          >
            {presets.map((question) => (
              <button
                key={question}
                type="button"
                className="advice-overlay__preset"
                onClick={() => submitQuestion(question)}
                disabled={composerDisabled}
              >
                {question}
              </button>
            ))}
          </div>

          <form className="advice-overlay__form" onSubmit={handleCustomSubmit}>
            <label className="advice-overlay__label" htmlFor={inputId}>
              Ask a question about {scopeName}
            </label>
            <input
              ref={inputRef}
              id={inputId}
              name="advice-question"
              type="text"
              className="advice-overlay__input"
              value={customQuestion}
              onChange={(e) => setCustomQuestion(e.target.value)}
              placeholder={placeholder}
              disabled={composerDisabled}
              maxLength={500}
              aria-label={`Ask a question about ${scopeName}`}
            />
            <button
              type="submit"
              className="advice-overlay__send"
              disabled={composerDisabled || !customQuestion.trim()}
              aria-label={`Send question about ${scopeName}`}
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
}
