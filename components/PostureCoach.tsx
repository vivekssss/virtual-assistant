/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { evaluatePosture } from '../services/geminiService';
import { POSTURES } from '../postures';
import { PostureDef, JointAngleState, PoseFeedback, DebugInfo } from '../types';
import { 
  Loader2, Flower2, Target, Activity, Dumbbell, Play, RotateCcw, 
  Sparkles, CheckCircle2, ChevronRight, Terminal, Clock, 
  AlertTriangle, ShieldCheck, Lightbulb, Camera, Award, ChevronDown 
} from 'lucide-react';

const PostureCoach: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageContainerRef = useRef<HTMLDivElement>(null);

  // States
  const [loading, setLoading] = useState<boolean>(true);
  const [activeCategory, setActiveCategory] = useState<'Yoga' | 'Cricket' | 'Athletics' | 'Golf'>('Yoga');
  const [activePosture, setActivePosture] = useState<PostureDef>(POSTURES[0]);
  const [liveAngles, setLiveAngles] = useState<JointAngleState[]>([]);
  const [aiFeedback, setAiFeedback] = useState<PoseFeedback | null>(null);
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);

  // Countdown State
  const [countdown, setCountdown] = useState<number | null>(null);
  const [captureFlash, setCaptureFlash] = useState<boolean>(false);

  // Trigger snapshot flag
  const triggerCaptureRef = useRef<boolean>(false);
  const liveAnglesRef = useRef<JointAngleState[]>([]);

  // Auto-Detect States and References
  const [autoDetectEnabled, setAutoDetectEnabled] = useState<boolean>(true);
  const [stabilityProgress, setStabilityProgress] = useState<number>(0);

  const stablePoseStartTimeRef = useRef<number | null>(null);
  const lastAnglesRef = useRef<number[]>([]);
  const isCooldownRef = useRef<boolean>(false);
  const lastStabilityProgressStateRef = useRef<number>(0);
  const autoDetectEnabledRef = useRef<boolean>(true);
  const isAiThinkingRef = useRef<boolean>(false);
  const loadingRef = useRef<boolean>(true);
  const countdownRef = useRef<number | null>(null);

  // Keep refs synchronized in background to avoid MediaPipe closure binding lags
  useEffect(() => {
    autoDetectEnabledRef.current = autoDetectEnabled;
  }, [autoDetectEnabled]);

  useEffect(() => {
    isAiThinkingRef.current = isAiThinking;
  }, [isAiThinking]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    countdownRef.current = countdown;
  }, [countdown]);

  // Sound Synthesizer Node
  const playSynthesizedBeep = (freq: number, duration: number, wave: 'sine' | 'triangle' | 'sawtooth' = 'sine') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = wave;
      oscillator.frequency.value = freq;

      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + duration);
    } catch (e) {
      console.warn("Audio Context blocked by browser policy:", e);
    }
  };

  // Sync active posture reset
  const handleSelectPosture = (posture: PostureDef) => {
    setActivePosture(posture);
    setAiFeedback(null);
    setDebugInfo(null);
    isCooldownRef.current = false;
    stablePoseStartTimeRef.current = null;
    setStabilityProgress(0);
  };

  // Safe trigonometric joint angle calculations
  const calculateJointAngle = (
    lm: any[],
    jointsSeq: [number, number, number]
  ): number => {
    const [p1Idx, p2Idx, p3Idx] = jointsSeq;
    const pt1 = lm[p1Idx];
    const pt2 = lm[p2Idx]; // Vertex joint
    const pt3 = lm[p3Idx];

    if (!pt1 || !pt2 || !pt3 || pt1.visibility < 0.45 || pt2.visibility < 0.45 || pt3.visibility < 0.45) {
      return 180; // Default when joint is occluded from view
    }

    // Vector vectors
    const rad = Math.atan2(pt3.y - pt2.y, pt3.x - pt2.x) - Math.atan2(pt1.y - pt2.y, pt1.x - pt2.x);
    let deg = Math.abs((rad * 180) / Math.PI);
    if (deg > 180) {
      deg = 360 - deg;
    }
    return Math.round(deg);
  };

  // Start Capture Sequence
  const handleStartCaptureSequence = () => {
    if (countdown !== null || isAiThinking) return;
    setCountdown(4); // Start from 4 including hold frame
  };

  // Staggered timer loop
  useEffect(() => {
    if (countdown === null) return;

    if (countdown > 1) {
      playSynthesizedBeep(480, 0.12, 'sine');
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 1) {
      playSynthesizedBeep(880, 0.45, 'triangle');
      setCaptureFlash(true);
      triggerCaptureRef.current = true; // Flag frame capture in results loop
      
      const flashTimer = setTimeout(() => {
        setCaptureFlash(false);
        setCountdown(null);
      }, 450);
      return () => {
        clearTimeout(flashTimer);
      };
    }
  }, [countdown]);

  // Execute Gemini Posture verification handler
  const performPosturalCheck = async (screenshot: string, angles: JointAngleState[]) => {
    setIsAiThinking(true);
    try {
      const response = await evaluatePosture(screenshot, activePosture, angles);
      setAiFeedback(response.feedback);
      setDebugInfo(response.debug);
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsAiThinking(false);
    }
  };

  // Main Camera and MediaPipe Setup Loop
  useEffect(() => {
    if (!videoRef.current || !canvasRef.current || !stageContainerRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const container = stageContainerRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    let camera: any = null;
    let poseInstance: any = null;

    const onResults = (results: any) => {
      setLoading(false);

      // Handle auto-resize fluidly
      if (canvas.width !== container.clientWidth || canvas.height !== container.clientHeight) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
      }

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Draw Raw Webcam Feed
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

      // 2. High-contrast athletic dark mask
      ctx.fillStyle = 'rgba(12, 13, 18, 0.7)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 3. Process Joint Angles if Skeleton is visible
      const lm = results.poseLandmarks;
      const angleStates: JointAngleState[] = [];

      if (lm && lm.length > 0) {
        // Calculate each target joint's metrics
        activePosture.idealAngles.forEach(ideal => {
          const angle = calculateJointAngle(lm, ideal.landmarks);
          const isOptimal = angle >= ideal.min && angle <= ideal.max;
          angleStates.push({
            joint: ideal.joint,
            angle,
            status: isOptimal ? 'optimal' : 'out-of-bound',
            label: ideal.label
          });
        });

        liveAnglesRef.current = angleStates;
        setLiveAngles(angleStates);

        // -- AUTO DETECT STABILITY CORE --
        if (autoDetectEnabledRef.current && !isAiThinkingRef.current && !loadingRef.current && countdownRef.current === null) {
          if (isCooldownRef.current) {
            // Check if user has stepped away / broken the stance to automatically unlock analysis
            const curAngles = angleStates.map(a => a.angle);
            const prevAngles = lastAnglesRef.current;
            if (prevAngles.length === curAngles.length && curAngles.length > 0) {
              const maxFluctuation = Math.max(...curAngles.map((val, idx) => Math.abs(val - prevAngles[idx])));
              if (maxFluctuation > 18.0) { // stance broken (moved >18 degrees)
                isCooldownRef.current = false;
              }
            }
            lastAnglesRef.current = curAngles;
          } else {
            // Check real-time limb hold stability levels
            const curAngles = angleStates.map(a => a.angle);
            const prevAngles = lastAnglesRef.current;
            let isStableFrame = false;

            if (prevAngles.length === curAngles.length && curAngles.length > 0) {
              const maxFluctuation = Math.max(...curAngles.map((val, idx) => Math.abs(val - prevAngles[idx])));
              if (maxFluctuation < 3.5) { // Stance is perfectly held still (within 3.5 degrees bounds)
                isStableFrame = true;
              }
            }
            lastAnglesRef.current = curAngles;

            if (isStableFrame) {
              if (stablePoseStartTimeRef.current === null) {
                stablePoseStartTimeRef.current = performance.now();
              }
              const elapsed = performance.now() - stablePoseStartTimeRef.current;
              const nextProgress = Math.min(100, Math.round((elapsed / 2000) * 100)); // Must hold still for 2.0 seconds

              if (Math.abs(nextProgress - lastStabilityProgressStateRef.current) >= 5 || nextProgress === 0 || nextProgress === 100) {
                lastStabilityProgressStateRef.current = nextProgress;
                setStabilityProgress(nextProgress);
              }

              if (nextProgress >= 100) {
                isCooldownRef.current = true;
                stablePoseStartTimeRef.current = null;
                lastStabilityProgressStateRef.current = 0;
                setStabilityProgress(0);

                // Toggle frame take capture flag
                triggerCaptureRef.current = true;

                // Sound beeps & camera shutter flash animation trigger
                playSynthesizedBeep(880, 0.45, 'triangle');
                setCaptureFlash(true);
                setTimeout(() => {
                  setCaptureFlash(false);
                }, 450);
              }
            } else {
              stablePoseStartTimeRef.current = null;
              if (lastStabilityProgressStateRef.current !== 0) {
                lastStabilityProgressStateRef.current = 0;
                setStabilityProgress(0);
              }
            }
          }
        } else {
          stablePoseStartTimeRef.current = null;
          if (lastStabilityProgressStateRef.current !== 0) {
            lastStabilityProgressStateRef.current = 0;
            setStabilityProgress(0);
          }
        }

        // 4. Draw Skeleton overlay using MediaPipe drawing helpers
        if (window.drawConnectors && window.drawLandmarks) {
          window.drawConnectors(ctx, lm, window.POSE_CONNECTIONS, { color: 'rgba(168, 199, 250, 0.45)', lineWidth: 1.5 });
          window.drawLandmarks(ctx, lm, { color: '#ffffff', fillColor: '#a8c7fa', lineWidth: 1, radius: 2 });
        }

        // 5. Draw customized Joint Angle Bubbles directly at vector points!
        activePosture.idealAngles.forEach(idealDef => {
          const targetNode = lm[idealDef.landmarks[1]]; // Elbow/Knee joint vertex coordinate
          if (targetNode && targetNode.visibility > 0.45) {
            const cx = targetNode.x * canvas.width;
            const cy = targetNode.y * canvas.height;

            const jointState = angleStates.find(a => a.joint === idealDef.joint);
            const isOptimal = jointState?.status === 'optimal';
            const displayAngle = jointState?.angle || 180;

            // Safe unmirrored canvas text drawing
            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(-1, 1); // Flip text horizontal transformation

            // Neon background sphere
            ctx.beginPath();
            ctx.arc(0, 0, 16, 0, Math.PI * 2);
            ctx.fillStyle = isOptimal ? 'rgba(16, 185, 129, 0.93)' : 'rgba(239, 68, 68, 0.93)'; // Emerald vs Rose
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            // Specular shiny curve reflection
            ctx.beginPath();
            ctx.arc(-4, -4, 4, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
            ctx.fill();

            // Numeric Degrees Label
            ctx.font = 'bold 10px monospace';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${displayAngle}°`, 0, 1);

            ctx.restore();
          }
        });
      }

      ctx.restore();

      // 6. Handle camera snap if timer triggered
      if (triggerCaptureRef.current) {
        triggerCaptureRef.current = false;

        // Vector Crop: Compress frame to JPEG for fast multi-modal processing
        const offscreen = document.createElement('canvas');
        const targetWidth = 640;
        const scale = Math.min(1, targetWidth / canvas.width);
        offscreen.width = canvas.width * scale;
        offscreen.height = canvas.height * scale;

        const oCtx = offscreen.getContext('2d');
        if (oCtx) {
          oCtx.drawImage(canvas, 0, 0, offscreen.width, offscreen.height);
          const screenshotData = offscreen.toDataURL("image/jpeg", 0.7);
          
          // Trigger remote posture evaluation
          performPosturalCheck(screenshotData, [...angleStates]);
        }
      }
    };

    if (window.Pose) {
      poseInstance = new window.Pose({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
      });
      poseInstance.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      poseInstance.onResults(onResults);

      if (window.Camera) {
        camera = new window.Camera(video, {
          onFrame: async () => {
            if (videoRef.current && poseInstance) {
              await poseInstance.send({ image: videoRef.current });
            }
          },
          width: 640,
          height: 480,
        });
        camera.start();
      }
    }

    return () => {
      if (camera) camera.stop();
      if (poseInstance) poseInstance.close();
    };
  }, [activePosture]);

  // Filtering configurations
  const filteredPostures = POSTURES.filter(p => p.category === activeCategory);

  return (
    <div className="flex w-full h-screen bg-[#08090d] text-[#f1f5f9] font-sans antialiased overflow-hidden">
      
      {/* LEFT COLUMN: Activity Selector and Live Video Feed */}
      <div className="flex-1 flex flex-col h-full overflow-hidden p-6 gap-6 relative">
        <video ref={videoRef} className="absolute hidden" playsInline />
        
        {/* BRAND HEADER */}
        <div className="flex items-center justify-between bg-[#11131e] p-4 rounded-2xl border border-[#1e2238] shadow-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-[#4f46e5]/15 p-2 rounded-xl border border-[#4f46e5]/40 text-[#6366f1]">
              <Dumbbell className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white font-space">PoseAlign Stance Assessment</h1>
              <p className="text-xs text-[#94a3b8]">Live MediaPipe vector tracking & Gemini grounded correction</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] animate-ping" />
            <span className="text-xs font-mono text-[#10b981] font-bold">LIVE METRIC HUD ACTIVE</span>
          </div>
        </div>

        {/* POSTURE SELECTOR PANEL */}
        <div className="flex flex-col gap-3 bg-[#11131e] p-4 rounded-3xl border border-[#1e2238] shrink-0">
          {/* Sports Categories Tabs */}
          <div className="grid grid-cols-4 gap-2 border-b border-[#1f233b] pb-3">
            {(['Yoga', 'Cricket', 'Athletics', 'Golf'] as const).map(cat => {
              const active = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => {
                    setActiveCategory(cat);
                    const defaultPose = POSTURES.find(p => p.category === cat);
                    if (defaultPose) handleSelectPosture(defaultPose);
                  }}
                  className={`py-2 px-3 rounded-xl font-space text-xs font-bold tracking-wider flex items-center justify-center gap-2 transition-all duration-300
                    ${active 
                      ? 'bg-gradient-to-r from-[#4f46e5] to-[#6366f1] text-white shadow-lg' 
                      : 'bg-[#181a29] text-[#94a3b8] hover:bg-[#1e223c] border border-[#1e223a]'}`}
                >
                  {cat === 'Yoga' && <Flower2 className="w-3.5 h-3.5" />}
                  {cat === 'Cricket' && <Target className="w-3.5 h-3.5" />}
                  {cat === 'Athletics' && <Activity className="w-3.5 h-3.5" />}
                  {cat === 'Golf' && <Dumbbell className="w-3.5 h-3.5" />}
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Posures items scroll */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {filteredPostures.map(pos => {
              const selected = activePosture.id === pos.id;
              return (
                <button
                  key={pos.id}
                  onClick={() => handleSelectPosture(pos)}
                  className={`py-1.5 px-3 rounded-lg text-xs font-medium transition-all duration-300 shrink-0 border
                    ${selected 
                      ? 'bg-[#6366f1]/20 border-[#6366f1] text-[#a5b4fc] font-bold' 
                      : 'bg-[#181a29]/60 border-[#1f233a] text-[#64748b] hover:text-[#f8fafc]'}`}
                >
                  {pos.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* WORKCAM CAMERA AREA */}
        <div ref={stageContainerRef} className="flex-1 rounded-3xl relative overflow-hidden border border-[#1f233b] shadow-2xl bg-black">
          <canvas ref={canvasRef} className="w-full h-full object-cover" />

          {/* LOADING SCREEN OVERLAY */}
          {loading && (
            <div className="absolute inset-0 bg-[#08090d]/95 flex flex-col items-center justify-center gap-4 z-50">
              <Loader2 className="w-10 h-10 text-[#6366f1] animate-spin" />
              <div className="text-center font-space">
                <p className="text-white text-base font-bold">Activating Vector Camera</p>
                <p className="text-xs text-[#64748b] mt-1">Please allow camera accessibility if prompted</p>
              </div>
            </div>
          )}

          {/* DETECTED SKELETON CALIBRATION OUTLINE (Aesthetic guide) */}
          {!loading && !aiFeedback && liveAngles.length === 0 && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-20">
              <div className="border border-dashed border-[#6366f1]/30 p-12 rounded-[40px] max-w-sm text-center animate-pulse bg-[#6366f1]/5">
                <Camera className="w-8 h-8 text-[#6366f1] mx-auto mb-3" />
                <p className="text-white text-sm font-bold font-space uppercase tracking-widest">Alignment Guide</p>
                <p className="text-xs text-[#94a3b8] mt-2">Adjust your position until your body's skeleton turns green on screen.</p>
              </div>
            </div>
          )}

          {/* CAPTURE COUNTDOWN INTERFACE */}
          {countdown !== null && (
            <div className="absolute inset-0 bg-black/40 z-30 flex flex-col items-center justify-center font-space">
              <div className="bg-[#11131e]/95 border-2 border-[#6366f1] p-10 rounded-[32px] text-center shadow-2xl max-w-xs animate-bounce">
                <Clock className="w-8 h-8 text-[#6366f1] mx-auto mb-2 animate-spin" />
                <p className="text-xs text-[#a5b4fc] font-bold uppercase tracking-widest mt-1">Stance Capture</p>
                <h2 className="text-7xl font-extrabold text-white my-3">
                  {countdown > 1 ? countdown - 1 : "HOLD!"}
                </h2>
                <p className="text-[10px] text-gray-400 italic">Striking the target stance now!</p>
              </div>
            </div>
          )}

          {/* BRIGHT SHUTTER CAMERA FLASH */}
          {captureFlash && (
            <div className="absolute inset-0 bg-white z-40 animate-fade-out" style={{ transition: 'opacity 0.4s ease' }} />
          )}

          {/* POSTURE CONTROLLER BUTTON OVERLAY */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3">
            <button
              onClick={handleStartCaptureSequence}
              disabled={countdown !== null || isAiThinking || loading}
              className={`py-3 px-6 rounded-2xl flex items-center gap-3 font-space font-bold text-xs tracking-wider uppercase transition-all duration-300 shadow-xl
                ${countdown !== null || isAiThinking
                  ? 'bg-gray-600/50 text-gray-400 border border-gray-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-[#4f46e5] to-[#6366f1] hover:from-[#6366f1] hover:to-[#4f46e5] text-white hover:scale-105 border border-[#6366f1]/50'}`}
            >
              <Camera className="w-4 h-4" />
              Analyze Posture Stance
            </button>
            
            {aiFeedback && (
              <button
                onClick={() => {
                  setAiFeedback(null);
                  setDebugInfo(null);
                  isCooldownRef.current = false;
                  stablePoseStartTimeRef.current = null;
                  setStabilityProgress(0);
                }}
                className="bg-[#1e1e2d] hover:bg-[#2b2b3f] text-[#f1f5f9] border border-[#30304c] py-3 px-4 rounded-2xl flex items-center gap-2 font-space font-bold text-xs transition-all duration-300 shadow-xl"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
            )}
          </div>

          {/* LIVE STATUS CHIP */}
          <div className="absolute top-6 left-6 z-20 flex gap-2">
            <div className="bg-black/75 px-4 py-2.5 rounded-2xl border border-white/10 backdrop-blur-md flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] animate-pulse" />
              <div className="text-left font-space text-[10px]">
                <p className="text-[#94a3b8] uppercase font-bold tracking-widest leading-none">Category</p>
                <p className="text-white font-bold leading-none mt-1">{activePosture.category}</p>
              </div>
            </div>

            <div className="bg-black/75 px-4 py-2.5 rounded-2xl border border-white/10 backdrop-blur-md flex items-center gap-2">
              <div className="text-left font-space text-[10px]">
                <p className="text-[#94a3b8] uppercase font-bold tracking-widest leading-none">Difficulty</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`w-1.5 h-1.5 rounded-full 
                    ${activePosture.difficulty === 'Beginner' ? 'bg-[#10b981]' : 
                      activePosture.difficulty === 'Intermediate' ? 'bg-[#f59e0b]' : 'bg-[#ef4444]'}`} 
                  />
                  <p className="text-white font-bold leading-none">{activePosture.difficulty}</p>
                </div>
              </div>
            </div>
          </div>

          {/* HANDS-FREE AUTO-DETECT HUD */}
          <div className="absolute top-6 right-6 z-20 flex flex-col gap-2 bg-black/80 px-4 py-3 rounded-2xl border border-white/10 backdrop-blur-md font-space text-left w-64 shadow-lg">
            <div className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <Sparkles className={`w-3.5 h-3.5 ${autoDetectEnabled ? 'text-[#818cf8]' : 'text-gray-500'}`} />
                <span className="text-white text-xs font-bold font-space">Auto-Detect</span>
              </div>
              <button
                onClick={() => {
                  setAutoDetectEnabled(!autoDetectEnabled);
                  isCooldownRef.current = false;
                  stablePoseStartTimeRef.current = null;
                  setStabilityProgress(0);
                }}
                className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 outline-none relative shrink-0
                  ${autoDetectEnabled ? 'bg-[#4f46e5]' : 'bg-gray-700'}`}
              >
                <div 
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200
                    ${autoDetectEnabled ? 'translate-x-4' : 'translate-x-0'}`} 
                />
              </button>
            </div>

            {autoDetectEnabled && (
              <div className="mt-2 border-t border-white/5 pt-2 flex flex-col gap-1 w-full">
                {liveAngles.length === 0 ? (
                  <p className="text-[10px] text-gray-400 font-sans">Align skeleton on screen to begin...</p>
                ) : isCooldownRef.current ? (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[10px] text-[#10b981] font-bold">
                      <span className="flex items-center gap-1">✓ POSE COMPILED</span>
                    </div>
                    <p className="text-[9px] text-[#94a3b8] leading-tight">Move significantly or tap 'Reset' to assess again.</p>
                  </div>
                ) : stabilityProgress > 0 ? (
                  <div className="flex flex-col gap-1.5 w-full">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-[#34d399] font-bold animate-pulse">HOLD STILL!</span>
                      <span className="text-white font-mono font-bold">{stabilityProgress}%</span>
                    </div>
                    <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-[#10b981] to-[#34d399] h-full rounded-full transition-all duration-300" 
                        style={{ width: `${stabilityProgress}%` }}
                      />
                    </div>
                    <p className="text-[9px] text-[#94a3b8] leading-none">Stance locked. Assessing soon...</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-[10px] text-blue-400 font-bold">
                      <span className="flex items-center gap-1">
                        <Activity className="w-2.5 h-2.5 animate-spin" /> SCANNING STABILITY
                      </span>
                    </div>
                    <p className="text-[9px] text-[#94a3b8] leading-none">Freeze inside target posture to auto-evaluate.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: AI Biomechanical Evaluation Hub */}
      <div className="w-[410px] bg-[#11131e] border-l border-[#1e2238] flex flex-col h-full overflow-hidden shadow-2xl shrink-0 font-space text-[#f8fafc]">
        
        {/* POSTURE DETAILS HEADER */}
        <div className="p-5 border-b border-[#1f233c] bg-[#151726]/40 flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-xs text-[#a5b4fc] font-bold tracking-widest uppercase">
            <Activity className="w-3.5 h-3.5" /> Postural Target
          </div>
          <h2 className="text-xl font-extrabold text-white tracking-tight">{activePosture.name}</h2>
          <p className="text-xs text-[#64748b] leading-tight">Pro Reference Standard: <span className="text-[#a5b4fc] font-bold">{activePosture.proModelName}</span></p>
        </div>

        {/* DETAILS SCROLL CONTAINER */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin">
          
          {/* Posture Focus Guidelines (Always visible) */}
          <div className="bg-[#181a29] p-4 rounded-2xl border border-[#222641]">
            <h3 className="text-xs font-bold text-[#f8fafc] uppercase tracking-wider mb-2.5 flex items-center gap-2">
              <Lightbulb className="w-3.5 h-3.5 text-[#e5e7eb]" /> Stance Instructions
            </h3>
            <ul className="space-y-2">
              {activePosture.instructions.map((inst, idx) => (
                <li key={idx} className="flex gap-2 text-xs text-[#94a3b8] leading-relaxed">
                  <span className="text-[#6366f1] font-bold shrink-0">{idx + 1}.</span>
                  <span>{inst}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* REALTIME SKELETAL RADIAL CONSTRAINTS */}
          <div>
            <h3 className="text-xs font-bold text-[#c4c7c5] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-[#3b82f6]" /> Live Vector Metrics
            </h3>

            {liveAngles.length === 0 ? (
              <div className="bg-[#1e1e2c]/30 border border-[#222641] rounded-2xl p-4 text-center">
                <AlertTriangle className="w-5 h-5 text-[#f59e0b] mx-auto mb-2 animate-bounce" />
                <p className="text-xs text-[#94a3b8] font-medium leading-relaxed">
                  Pose not recognized. Ensure full body fits inside camera view frame to lock skeleton metrics.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {liveAngles.map((a, i) => {
                  const limit = activePosture.idealAngles.find(ideal => ideal.joint === a.joint);
                  const isOk = a.status === 'optimal';
                  const pctAngle = Math.min(100, Math.max(0, (a.angle / 180) * 100));

                  return (
                    <div key={i} className="bg-[#181a29]/80 px-3 py-2.5 rounded-xl border border-[#242745] flex flex-col gap-1.5 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold font-sans text-[#cbd5e1]">{a.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-white">{a.angle}°</span>
                          <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md leading-none
                            ${isOk ? 'bg-[#10b981]/15 text-[#10b981]' : 'bg-[#ef4444]/15 text-[#ef4444]'}`}
                          >
                            {isOk ? '✓ Ideal' : '❌ Adjust'}
                          </span>
                        </div>
                      </div>

                      {/* Diagnostic range guide bar */}
                      <div className="relative h-2 bg-[#252a4a] rounded-full overflow-hidden w-full">
                        <div 
                          className={`absolute h-full rounded-full transition-all duration-500
                            ${isOk ? 'bg-gradient-to-r from-[#10b981] to-[#34d399]' : 'bg-gradient-to-r from-[#ef4444] to-[#f87171]'}`}
                          style={{ width: `${pctAngle}%` }}
                        />
                        {/* ideal boundaries visual markers */}
                        {limit && (
                          <div 
                            className="absolute h-full border-x border-[#f8fafc]/30"
                            style={{ 
                              left: `${(limit.min/180)*100}%`, 
                              right: `${100 - (limit.max/180)*100}%`,
                              backgroundColor: 'rgba(99, 102, 241, 0.15)'
                            }}
                          />
                        )}
                      </div>

                      {limit && (
                        <div className="flex justify-between items-center text-[9px] text-[#64748b]">
                          <span>0°</span>
                          <span className="text-center">Biomechanical Ideal: {limit.min}° - {limit.max}°</span>
                          <span>180°</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* AI ASSESSMENT AND SEARCH GROUNDING RESULTS */}
          <div>
            <h3 className="text-xs font-bold text-[#cbd5e1] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#818cf8]" /> Coach's Analysis
            </h3>

            {isAiThinking ? (
              <div className="bg-[#1a1b2d] border border-[#6366f1]/20 p-8 rounded-2xl flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-[#6366f1] animate-spin" />
                <div className="text-center shrink-0">
                  <p className="text-white text-xs font-bold uppercase tracking-widest animate-pulse">Consulting Web Mechanics...</p>
                  <p className="text-[10px] text-[#64748b] mt-1 italic">Grounding details on {activePosture.proModelName}...</p>
                </div>
              </div>
            ) : aiFeedback ? (
              <div className="space-y-4">
                
                {/* Score Dial & Status Pill */}
                <div className="bg-[#181a29] p-4 rounded-2xl border border-[#222641] flex items-center gap-4">
                  <div className="relative w-16 h-16 shrink-0 flex items-center justify-center bg-black/40 rounded-full border-2 border-[#1f2334] shadow-inner">
                    <span className="text-lg font-bold font-mono text-white leading-none">{aiFeedback.overallScore}</span>
                    <span className="text-[8px] text-[#64748b] leading-none absolute bottom-2">/100</span>
                  </div>

                  <div className="space-y-1">
                    <span className={`text-[9px] uppercase font-extrabold tracking-widest px-2 py-0.5 rounded-full inline-block leading-none
                      ${aiFeedback.status === 'excellent' ? 'bg-[#10b981]/10 text-[#34d399] border border-[#10b981]/40' :
                        aiFeedback.status === 'good' ? 'bg-[#3b82f6]/10 text-[#60a5fa] border border-[#3b82f6]/40' :
                        aiFeedback.status === 'correction-needed' ? 'bg-[#f59e0b]/10 text-[#fbbf24] border border-[#f59e0b]/40' :
                        'bg-[#ef4444]/15 text-[#f87171] border border-[#ef4444]/40'}`}
                    >
                      {aiFeedback.status.replace('-', ' ')}
                    </span>
                    <p className="text-xs text-[#94a3b8] leading-tight font-sans mt-0.5">{aiFeedback.primaryAssessment}</p>
                  </div>
                </div>

                {/* Grounding Insights */}
                {aiFeedback.proInsights && (
                  <div className="bg-[#6366f1]/5 p-4 rounded-2xl border border-[#6366f1]/20 space-y-2">
                    <h4 className="text-xs font-bold text-[#a5b4fc] tracking-wider uppercase flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 shrink-0" /> Web Grounded Insights
                    </h4>
                    <p className="text-xs text-[#cbd5e1] leading-relaxed font-sans font-medium whitespace-pre-wrap">
                      {aiFeedback.proInsights}
                    </p>
                  </div>
                )}

                {/* Action Items List Checklist */}
                {aiFeedback.actionItems && aiFeedback.actionItems.length > 0 && (
                  <div className="bg-[#181a29] p-4 rounded-2xl border border-[#222641]">
                    <h4 className="text-xs font-bold text-white tracking-wider uppercase mb-2.5 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981]" /> Alignment Action Items
                    </h4>
                    <ul className="space-y-2">
                      {aiFeedback.actionItems.map((item, index) => (
                        <li key={index} className="flex items-start gap-2 text-xs text-[#94a3b8] leading-tight">
                          <ChevronRight className="w-3.5 h-3.5 text-[#6366f1] shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Joints Specific Feedback list */}
                {aiFeedback.jointAnalyses && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-[#64748b] uppercase tracking-wider">Limb Specifics</h4>
                    {aiFeedback.jointAnalyses.map((j, idx) => (
                      <div key={idx} className="bg-[#181a29]/50 p-3 rounded-xl border border-[#1f2334] flex gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${j.issueDetected ? 'bg-[#ef4444]' : 'bg-[#10b981]'}`} />
                        <div className="space-y-1 text-left">
                          <p className={`text-xs font-bold ${j.issueDetected ? 'text-[#f87171]' : 'text-slate-300'}`}>
                            {j.jointName}
                          </p>
                          <p className="text-[11px] text-[#64748b] leading-tight italic">{j.correctionTip}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            ) : (
              <div className="bg-[#181a29]/30 rounded-2xl p-6 text-center border border-dashed border-[#222641]">
                <Camera className="w-6 h-6 text-[#64748b] mx-auto mb-2.5" />
                <p className="text-xs text-[#94a3b8] font-medium leading-relaxed max-w-[240px] mx-auto">
                  Stance coach ready. Align yourself inside the viewport and click <span className="text-[#a5b4fc] font-bold">Analyze Posture</span> to initiate a structural biomechanical checkover.
                </p>
              </div>
            )}
          </div>

          {/* AI CORE TELEMETRY PANEL (Toggleable debugging specs) */}
          {debugInfo && (
            <div className="bg-black/40 border border-[#1f233b] rounded-2xl overflow-hidden shadow-inner">
              <summary className="p-3 bg-[#151726]/40 flex items-center justify-between text-xs font-bold tracking-wider text-[#64748b] uppercase cursor-pointer select-none">
                <div className="flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5" /> Telemetry Specs
                </div>
                <ChevronDown className="w-3 h-3 text-[#64748b]" />
              </summary>
              <div className="p-3 text-left space-y-3 font-mono text-[9px] text-gray-400">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#121212] p-2 rounded">
                    <p className="text-gray-500 mb-0.5">Model Latency</p>
                    <p className="text-[#a5b4fc] font-bold">{debugInfo.latency}ms</p>
                  </div>
                  <div className="bg-[#121212] p-2 rounded">
                    <p className="text-gray-500 mb-0.5">Engine Model</p>
                    <p className="text-white font-bold">gemini-3.5-flash</p>
                  </div>
                </div>

                <div>
                  <p className="text-gray-500 mb-1">Cropped Multimodal Frame</p>
                  {debugInfo.screenshotBase64 && (
                    <img 
                      src={debugInfo.screenshotBase64} 
                      alt="Segment Cropped Vector" 
                      className="w-full h-auto rounded border border-white/5 opacity-70"
                    />
                  )}
                </div>

                <div>
                  <p className="text-gray-500 mb-1">Raw API Prompt Context</p>
                  <pre className="bg-[#121212] p-2 rounded text-slate-400 overflow-x-auto whitespace-pre leading-tight text-[8px] max-h-36 overflow-y-auto">
                    {debugInfo.promptContext}
                  </pre>
                </div>

                <div>
                  <p className="text-gray-500 mb-1">Raw Model Text Out</p>
                  <pre className="bg-[#121212] p-2 rounded text-[#34d399] overflow-x-auto whitespace-pre leading-tight text-[8px] max-h-36 overflow-y-auto">
                    {debugInfo.rawResponse}
                  </pre>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* FOOTER */}
        <div className="p-3 bg-[#11131e] border-t border-[#1f233c] text-center font-space">
          <p className="text-[10px] text-[#64748b]">Powered by MediaPipe Pose & Google Gemini 3.5 Flash</p>
        </div>
      </div>

    </div>
  );
};

export default PostureCoach;
