import { useState, useRef, useEffect, KeyboardEvent, useMemo } from 'react';
import { useEventsStore } from '../stores/events';
import './TargetSelector.css';

interface TargetSelectorProps {
  className?: string;
}

export function TargetSelector({ className = '' }: TargetSelectorProps) {
  const selectedTarget = useEventsStore((s) => s.selectedTarget);
  const availableTargets = useEventsStore((s) => s.availableTargets);
  const setSelectedTarget = useEventsStore((s) => s.setSelectedTarget);
  const updateAvailableTargets = useEventsStore((s) => s.updateAvailableTargets);
  const events = useEventsStore((s) => s.events);

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Update targets when events change
  useEffect(() => {
    updateAvailableTargets();
  }, [updateAvailableTargets]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        setIsOpen(!isOpen);
        break;
      case 'Escape':
        setIsOpen(false);
        buttonRef.current?.focus();
        break;
      case 'ArrowDown':
        event.preventDefault();
        setIsOpen(true);
        // Focus first option
        setTimeout(() => {
          const firstOption = dropdownRef.current?.querySelector('[role="option"]') as HTMLElement;
          firstOption?.focus();
        }, 0);
        break;
    }
  };

  const handleOptionKeyDown = (event: KeyboardEvent<HTMLDivElement>, target: string) => {
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        setSelectedTarget(target);
        setIsOpen(false);
        buttonRef.current?.focus();
        break;
      case 'Escape':
        setIsOpen(false);
        buttonRef.current?.focus();
        break;
      case 'ArrowDown':
        event.preventDefault();
        focusNextOption(event.currentTarget);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusPrevOption(event.currentTarget);
        break;
    }
  };

  const focusNextOption = (current: HTMLElement) => {
    const options = Array.from(dropdownRef.current?.querySelectorAll('[role="option"]') || []);
    const currentIndex = options.indexOf(current);
    const next = options[(currentIndex + 1) % options.length] as HTMLElement;
    next?.focus();
  };

  const focusPrevOption = (current: HTMLElement) => {
    const options = Array.from(dropdownRef.current?.querySelectorAll('[role="option"]') || []);
    const currentIndex = options.indexOf(current);
    const prev = options[(currentIndex - 1 + options.length) % options.length] as HTMLElement;
    prev?.focus();
  };

  const getTargetLabel = useMemo(() => {
    return (target: string): { label: string; type: 'lead' | 'package' | 'agent' } => {
      if (target === 'lead') return { label: 'Lead Agent', type: 'lead' };
      // Check if it's a known source_app (package) or agent_name
      const safeEvents = events || [];
      const sourceApps = new Set(safeEvents.map(e => e.source_app).filter(Boolean));
      const agentNames = new Set(safeEvents.map(e => e.agent_name).filter(Boolean));

      if (sourceApps.has(target)) return { label: target, type: 'package' };
      if (agentNames.has(target)) return { label: target, type: 'agent' };
      return { label: target, type: 'package' };
    };
  }, [events]);

  const { label, type } = getTargetLabel(selectedTarget);

  return (
    <div className={`target-selector ${className}`} ref={dropdownRef}>
      <button
        ref={buttonRef}
        className="target-selector-button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Current target: ${label}`}
        type="button"
      >
        <span className="target-selector-label">{label}</span>
        <span className={`target-selector-badge ${type}`}>{type}</span>
        <span className="target-selector-arrow">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="target-selector-dropdown" role="listbox" aria-label="Select message target">
          {availableTargets.map((target) => {
            const { label: optionLabel, type: optionType } = getTargetLabel(target);
            const isSelected = target === selectedTarget;
            return (
              <div
                key={target}
                className={`target-selector-option ${isSelected ? 'selected' : ''} ${optionType}`}
                role="option"
                aria-selected={isSelected}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => {
                  setSelectedTarget(target);
                  setIsOpen(false);
                }}
                onKeyDown={(e) => handleOptionKeyDown(e, target)}
              >
                <span className="target-option-label">{optionLabel}</span>
                <span className={`target-option-badge ${optionType}`}>{optionType}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}