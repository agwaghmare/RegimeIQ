/**
 * PodcastButton — draggable FAB, same size as bolt button
 */

import React, { useRef, useEffect, useCallback } from 'react';
import './PodcastButton.css';

interface PodcastButtonProps {
  onClick: () => void;
}

export const PodcastButton: React.FC<PodcastButtonProps> = ({ onClick }) => {
  const btnRef      = useRef<HTMLButtonElement>(null);
  const posRef      = useRef({ x: 0, y: 0 });
  const offsetRef   = useRef({ x: 0, y: 0 });
  const dragging    = useRef(false);
  const moved       = useRef(false);

  useEffect(() => {
    // Initial: above the bolt FAB (bolt is fixed bottom-6 left-6 = 24px, h-14 = 56px)
    const x = 24;
    const y = window.innerHeight - 56 - 24 - 56 - 10;
    posRef.current = { x, y };
    if (btnRef.current) {
      btnRef.current.style.left = `${x}px`;
      btnRef.current.style.top  = `${y}px`;
    }
  }, []);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging.current) return;
    moved.current = true;
    const bw = btnRef.current?.offsetWidth  ?? 56;
    const bh = btnRef.current?.offsetHeight ?? 56;
    const x = Math.max(0, Math.min(window.innerWidth  - bw, e.clientX - offsetRef.current.x));
    const y = Math.max(0, Math.min(window.innerHeight - bh, e.clientY - offsetRef.current.y));
    posRef.current = { x, y };
    if (btnRef.current) {
      btnRef.current.style.left = `${x}px`;
      btnRef.current.style.top  = `${y}px`;
    }
  }, []);

  const onMouseUp = useCallback(() => {
    dragging.current = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup',   onMouseUp);
  }, [onMouseMove]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = btnRef.current!.getBoundingClientRect();
    offsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    moved.current  = false;
    dragging.current = true;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup',   onMouseUp);
  };

  const handleClick = () => {
    if (!moved.current) onClick();
  };

  return (
    <button
      ref={btnRef}
      className="podcast-fab"
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      title="Listen to Macro Briefing"
    >
      <span className="material-symbols-outlined">podcasts</span>
    </button>
  );
};