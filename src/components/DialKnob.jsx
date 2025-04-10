import React, { useRef, useState, useEffect, useCallback } from "react";
import "../App.css";  // 全体のスタイルをここで管理

export default function DialKnob({ value, onChange }) {
  const knobRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const startValueRef = useRef(0);

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  const handleDragStart = (clientY) => {
    setIsDragging(true);
    startYRef.current = clientY;
    startValueRef.current = value;
  };

  // handleDragMove を useCallback でラップ
  const handleDragMove = useCallback((clientY) => {
    if (!isDragging) return;
    const deltaY = startYRef.current - clientY; // 上にドラッグすると正の値
    const sensitivity = 0.005; 
    const newValue = clamp(startValueRef.current + deltaY * sensitivity, 0, 1);
    onChange(newValue);
  }, [isDragging, onChange]);

  const handleDragEnd = () => setIsDragging(false);

  const handleMouseDown = (e) => {
    e.preventDefault();
    handleDragStart(e.clientY);
  };

  const handleTouchStart = (e) => {
    e.preventDefault();
    if (e.touches.length > 0) {
      handleDragStart(e.touches[0].clientY);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e) => handleDragMove(e.clientY);
    const handleMouseUp = () => handleDragEnd();
    const handleTouchMove = (e) => {
      if (e.touches.length > 0) {
        handleDragMove(e.touches[0].clientY);
      }
    };
    const handleTouchEnd = () => handleDragEnd();

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.addEventListener("touchmove", handleTouchMove);
      document.addEventListener("touchend", handleTouchEnd);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging, handleDragMove]);

  const rotation = -135 + value * 270;

  return (
    <div
      ref={knobRef}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      className="dial-knob"
    >
      <div
        className="dial-knob-indicator"
        style={{ "--rotation": `${rotation}deg` }}
      />
    </div>
  );
}
