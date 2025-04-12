import DialKnob from "./components/DialKnob.jsx";
import "./App.css";
import { useState, useRef, useEffect, useCallback } from "react";

const NUM_STEPS = 16;
const NUM_TRACKS = 4;
const DEFAULT_PARAMS = {
  cutoff: 0.5,
  decay: 0.5,
  pitch: 0.5,
  pitchDecay: 0.3,
  resonance: 0.2,
  fm: false,
  fmAmount: 0.5,
  fmDecay: 0.3,
  modP: 0.5,
  volume: 1.0,
  noiseMix: 0.0,
};
const DEFAULT_BPM = 120;

const labelMap = {
  cutoff: "cut",
  decay: "dec",
  pitch: "pit",
  pitchDecay: "pDec",
  resonance: "res",
  fmAmount: "fmA",
  fmDecay: "fmD",
  modP: "modP",
  volume: "vol",
  noiseMix: "noi",
};

export default function Skew2() {
  // 各トラックのステップ状態
  const [steps, setSteps] = useState(
    Array(NUM_TRACKS).fill(null).map(() => Array(NUM_STEPS).fill(false))
  );
  const stepsRef = useRef(steps);
  useEffect(() => { stepsRef.current = steps; }, [steps]);

  // 各トラックのOSCパラメータ
  const [params, setParams] = useState(
    Array(NUM_TRACKS).fill(null).map(() => ({ ...DEFAULT_PARAMS }))
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [bpm, setBpm] = useState(DEFAULT_BPM);
  const [muteStates, setMuteStates] = useState(Array(NUM_TRACKS).fill(false));
  const [soloStates, setSoloStates] = useState(Array(NUM_TRACKS).fill(false));
  const prevMuteStatesRef = useRef(Array(NUM_TRACKS).fill(false));

  const muteStatesRef = useRef(muteStates);
  useEffect(() => { muteStatesRef.current = muteStates; }, [muteStates]);
  const soloStatesRef = useRef(soloStates);
  useEffect(() => { soloStatesRef.current = soloStates; }, [soloStates]);

  // AudioContext 関連
  const audioCtxRef = useRef(null);
  const schedulerIntervalRef = useRef(null);
  const playNoteRef = useRef(null);
  const stepRef = useRef(0);
  const bpmRef = useRef(bpm);
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);

  // グローバル出力（リミッター付き）
  const globalOutputRef = useRef(null);
  const initAudioContext = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const limiter = audioCtxRef.current.createDynamicsCompressor();
      limiter.threshold.setValueAtTime(-1, audioCtxRef.current.currentTime);
      limiter.knee.setValueAtTime(0, audioCtxRef.current.currentTime);
      limiter.ratio.setValueAtTime(15, audioCtxRef.current.currentTime);
      limiter.attack.setValueAtTime(0.003, audioCtxRef.current.currentTime);
      limiter.release.setValueAtTime(0.20, audioCtxRef.current.currentTime);

      const globalOutput = audioCtxRef.current.createGain();
      globalOutput.gain.setValueAtTime(1, audioCtxRef.current.currentTime);
      globalOutput.connect(limiter);
      limiter.connect(audioCtxRef.current.destination);
      globalOutputRef.current = globalOutput;
    }
  };

  // モバイル判定
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 600);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 600);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  // モバイル用に表示するトラック番号
  const [selectedTrack, setSelectedTrack] = useState(0);

  const toggleStep = (track, step) => {
    const updated = [...steps];
    updated[track][step] = !updated[track][step];
    setSteps(updated);
  };

  const updateParam = (track, param, value) => {
    const updated = [...params];
    updated[track][param] = value;
    setParams(updated);
  };

  const toggleFM = (track) => {
    const updated = [...params];
    updated[track].fm = !updated[track].fm;
    setParams(updated);
  };

  const toggleMute = (track) => {
    if (soloStates[track]) return;
    setMuteStates((prev) => {
      const next = [...prev];
      next[track] = !next[track];
      return next;
    });
  };

  const toggleSolo = (track) => {
    setSoloStates((prev) => {
      const next = [...prev];
      const newState = !next[track];
      next[track] = newState;
      if (newState) {
        prevMuteStatesRef.current[track] = muteStates[track];
        setMuteStates((prevMute) => {
          const newMutes = [...prevMute];
          newMutes[track] = false;
          return newMutes;
        });
      } else {
        setMuteStates((prevMute) => {
          const newMutes = [...prevMute];
          newMutes[track] = prevMuteStatesRef.current[track];
          return newMutes;
        });
      }
      return next;
    });
  };

  // スケジューラ側は常に全トラックの音をスケジュール（UI表示はモバイルなら selectedTrack のみ表示）
  const getShouldPlay = (tIndex) => {
    const soloActive = soloStatesRef.current.some((x) => x);
    return soloActive ? soloStatesRef.current[tIndex] : !muteStatesRef.current[tIndex];
  };

  const playNote = useCallback((trackIndex, scheduledTime) => {
    const audioCtx = audioCtxRef.current;
    const { pitch, pitchDecay, decay, cutoff, resonance, fm, fmAmount, fmDecay, modP, volume, noiseMix } =
      params[trackIndex];
    const decayTime = 0.2 + decay * 0.5;
    const stopTime = scheduledTime + decayTime;
    const pitchEndTime = scheduledTime + 0.05 + pitchDecay * 0.5;

    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    const startFreq = 100 + pitch * 1600;
    osc.frequency.setValueAtTime(startFreq, scheduledTime);
    osc.frequency.exponentialRampToValueAtTime(100, pitchEndTime);

    if (fm) {
      const modOsc = audioCtx.createOscillator();
      const modGain = audioCtx.createGain();
      const modFreq = 100 + modP * 1000;
      modOsc.type = "sine";
      modOsc.frequency.setValueAtTime(modFreq, scheduledTime);
      modGain.gain.setValueAtTime(5000 * fmAmount, scheduledTime);
      modGain.gain.exponentialRampToValueAtTime(0.01, scheduledTime + 0.1 + fmDecay * 0.5);
      modOsc.connect(modGain).connect(osc.frequency);
      modOsc.start(scheduledTime);
      modOsc.stop(stopTime);
    }

    const bufferLength = audioCtx.sampleRate * (stopTime - scheduledTime);
    const noiseBuffer = audioCtx.createBuffer(1, bufferLength, audioCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferLength; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;

    const oscGain = audioCtx.createGain();
    oscGain.gain.setValueAtTime((1 - noiseMix) * volume, scheduledTime);
    oscGain.gain.exponentialRampToValueAtTime(0.001, stopTime);

    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(noiseMix * volume, scheduledTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, stopTime);

    osc.connect(oscGain);
    noise.connect(noiseGain);
    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(500 + cutoff * 5000, scheduledTime);
    filter.Q.value = resonance * 30;

    oscGain.connect(filter);
    noiseGain.connect(filter);
    
    const output = audioCtx.createGain();
    output.gain.setValueAtTime(1, scheduledTime);
    filter.connect(output);
    output.connect(globalOutputRef.current);

    osc.start(scheduledTime);
    noise.start(scheduledTime);
    osc.stop(stopTime);
    noise.stop(stopTime);
  }, [params]);

  useEffect(() => {
    playNoteRef.current = playNote;
  }, [playNote]);

  useEffect(() => {
    if (!isPlaying) return;
    const audioCtx = audioCtxRef.current;
    let nextNoteTime = audioCtx.currentTime;
    const scheduleAheadTime = 0.1;
    const scheduler = setInterval(() => {
      while (nextNoteTime < audioCtx.currentTime + scheduleAheadTime) {
        const period = (60 / bpmRef.current) / 4;
        const step = stepRef.current;
        setCurrentStep(step);
        const noteTime = nextNoteTime;
        // スケジュールは全トラックで行う
        stepsRef.current.forEach((track, tIndex) => {
          if (track[step] && getShouldPlay(tIndex)) {
            playNoteRef.current(tIndex, noteTime);
          }
        });
        stepRef.current = (step + 1) % NUM_STEPS;
        nextNoteTime += period;
      }
    }, 25);
    schedulerIntervalRef.current = scheduler;
    return () => clearInterval(scheduler);
  }, [isPlaying]);

  const startSequencer = () => {
    initAudioContext();
    setIsPlaying(true);
  };

  const stopSequencer = () => {
    if (schedulerIntervalRef.current) clearInterval(schedulerIntervalRef.current);
    setIsPlaying(false);
    setCurrentStep(0);
    stepRef.current = 0;
  };

  const renderMobileTrackTabs = () => (
    <div className="skew2-track-tabs">
      Track
      {Array.from({ length: NUM_TRACKS }, (_, i) => (
        <button
          key={i}
          className={`skew2-track-tab ${selectedTrack === i ? "active" : ""}`}
          onClick={() => setSelectedTrack(i)}
        >
          {i + 1}
        </button>
      ))}
    </div>
  );

  return (
    <div className="skew2-container">
      <h2 className="skew2-title">Skew2</h2>
      {isMobile && renderMobileTrackTabs()}
      {(!isMobile ? steps : [steps[selectedTrack]]).map((track, tIndex) => (
        <div key={tIndex} className="skew2-track">
          <div className="skew2-track-controls">
            <button
              onClick={
                !soloStates[isMobile ? selectedTrack : tIndex]
                  ? () => toggleMute(isMobile ? selectedTrack : tIndex)
                  : undefined
              }
              className={`skew2-mute-btn ${
                (isMobile ? soloStates[selectedTrack] : soloStates[tIndex])
                  ? "skew2-mute-disabled"
                  : (isMobile ? muteStates[selectedTrack] : muteStates[tIndex])
                  ? "skew2-mute-active"
                  : "skew2-mute-default"
              }`}
            >
              MUTE
            </button>
            <button
              onClick={() => toggleSolo(isMobile ? selectedTrack : tIndex)}
              className={`skew2-solo-btn ${
                (isMobile ? soloStates[selectedTrack] : soloStates[tIndex]) ? "skw2-solo-active" : ""
              }`}
            >
              SOLO
            </button>
          </div>
          <div className="skew2-steps">
            {track.map((on, sIndex) => {
              const stepClass = `skew2-step ${sIndex === currentStep ? "skew2-step-current" : ""} ${
                on ? "skew2-step-on" : "skew2-step-off"
              }`;
              return (
                <div
                  key={sIndex}
                  onClick={() => toggleStep(isMobile ? selectedTrack : tIndex, sIndex)}
                  className={stepClass}
                ></div>
              );
            })}
          </div>
        </div>
      ))}
      <h3 className="skew2-osc-title">OSC</h3>
      {(!isMobile ? params : [params[selectedTrack]]).map((trackParams, tIndex) => (
        <div key={tIndex} className="skew2-osc-row">
          {Object.entries(trackParams).map(([param, value]) => (
            param !== "fm" && (
              <div key={param} className="skew2-knob-group">
                <DialKnob
                  value={value}
                  onChange={(v) => updateParam(isMobile ? selectedTrack : tIndex, param, v)}
                />
                <span className="skew2-knob-label">{labelMap[param]}</span>
              </div>
            )
          ))}
          <div className="skew2-knob-group">
            <div
              onClick={() => toggleFM(isMobile ? selectedTrack : tIndex)}
              className="skew2-fm-btn"
            >
              {params[isMobile ? selectedTrack : tIndex].fm && (
                <div className="skew2-fm-indicator" />
              )}
            </div>
            <span className="skew2-knob-label">FM</span>
          </div>
        </div>
      ))}
      <div className="skew2-controls">
        <button onClick={isPlaying ? stopSequencer : startSequencer} className="skew2-play-btn">
          {isPlaying ? "Stop" : "Play"}
        </button>
        <input
          type="range"
          min={60}
          max={180}
          value={bpm}
          onChange={(e) => setBpm(parseInt(e.target.value))}
          className="skew2-bpm-slider"
        />
        <span className="skew2-bpm-display">{bpm} BPM</span>
      </div>
    </div>
  );
}
