import { useEffect, useRef, useState } from 'react';
import { Icon } from './icons';

interface CameraSetupPageProps {
  onContinue?: () => void;
}

export function CameraSetupPage({ onContinue }: CameraSetupPageProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const [lighting, setLighting] = useState<'great' | 'low'>('great');
  const [handAligned, setHandAligned] = useState(false);
  const [readiness, setReadiness] = useState<
    'not_connected' | 'connected' | 'poor_lighting' | 'hand_not_detected' | 'adjust_position' | 'ready'
  >('not_connected');

  const startCamera = async () => {
    setConnecting(true);
    setError('');
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setConnected(true);
      setConnecting(false);
      setReadiness('connected');

      // Simulate lighting analysis and initial guidance
      setTimeout(() => {
        setLighting('great');
        setReadiness('hand_not_detected');
      }, 1000);
    } catch (err) {
      setConnecting(false);
      setConnected(false);
      setError('Camera access needed. Please allow camera permissions in your settings.');
      setReadiness('not_connected');
    }
  };

  useEffect(() => {
    // Component mounts; start camera automatically if user clicks or allow manual trigger
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleSimulateAlignment = () => {
    if (!connected) return;
    const nextState = !handAligned;
    setHandAligned(nextState);
    setReadiness(nextState ? 'ready' : 'hand_not_detected');
  };

  return (
    <div className="camera-setup-page">
      {/* A. Page Header */}
      <header className="camera-setup-header">
        <h1 className="camera-setup-title">Let’s check your camera</h1>
        <div className="camera-privacy-badge">
          <Icon name="lock" />
          <span>Your camera stays on your device. We do not save or share your video.</span>
        </div>
      </header>

      {/* Main Grid: Preview on Left, Tips on Right */}
      <div className="camera-setup-grid">
        {/* B. Camera Preview Panel (Left) */}
        <section className="camera-preview-panel paper">
          <div className="camera-viewport-wrapper">
            {/* Live Video Feed */}
            <video
              ref={videoRef}
              className={`camera-video-feed ${connected ? 'active' : ''}`}
              playsInline
              muted
            />

            {!connected && (
              <div className="camera-off-overlay">
                <div className="camera-off-icon-circle">
                  <Icon name="camera" />
                </div>
                <h3>{connecting ? 'Connecting to camera…' : 'Camera is ready to start'}</h3>
                <p>Click the button below to turn on your live video check.</p>
                <button
                  type="button"
                  className="button primary start-cam-btn"
                  onClick={startCamera}
                  disabled={connecting}
                >
                  <Icon name="camera" />
                  <span>{connecting ? 'Connecting…' : 'Turn On Camera'}</span>
                </button>
              </div>
            )}

            {/* Top Bar Indicators Overlay */}
            {connected && (
              <div className="camera-top-indicators">
                <span className="cam-status-pill connected">
                  <span className="status-dot green" />
                  <span>Camera Connected</span>
                </span>
                <span className={`cam-status-pill lighting ${lighting}`}>
                  <Icon name="sun" />
                  <span>{lighting === 'great' ? 'Great Lighting' : 'Low Lighting'}</span>
                </span>
              </div>
            )}

            {/* Center Hand-Positioning Guide Overlay */}
            <div
              className={`hand-guide-box ${handAligned ? 'aligned' : ''}`}
              onClick={handleSimulateAlignment}
              role="button"
              tabIndex={0}
              title="Click to test hand alignment feedback"
            >
              <div className="hand-silhouette-icon">
                <Icon name="hand" />
              </div>
              <span className="hand-guide-label">Hold Hand Here</span>
              {handAligned && <span className="hand-aligned-pill">✓ Right Sign!</span>}
            </div>

            {/* Bottom Instruction Inside Viewport */}
            <div className="camera-viewport-bottom-caption">
              <span>When we hold your hand inside the green box.</span>
            </div>
          </div>

          {/* D. Camera Readiness Feedback Banner */}
          <div className={`readiness-feedback-banner ${readiness}`}>
            <div className="feedback-content">
              {readiness === 'not_connected' && (
                <>
                  <span className="feedback-icon">🚫</span>
                  <span>{error || 'Camera not connected. Click Turn On Camera to start.'}</span>
                </>
              )}
              {readiness === 'connected' && (
                <>
                  <span className="feedback-icon">📷</span>
                  <span>Camera connected! Looking for your hand…</span>
                </>
              )}
              {readiness === 'poor_lighting' && (
                <>
                  <span className="feedback-icon">💡</span>
                  <span>Lighting is a bit dark. Try facing a window or lamp.</span>
                </>
              )}
              {readiness === 'hand_not_detected' && (
                <>
                  <span className="feedback-icon">✋</span>
                  <span>No hand detected yet. Hold your hand up inside the dashed box.</span>
                </>
              )}
              {readiness === 'adjust_position' && (
                <>
                  <span className="feedback-icon">↔️</span>
                  <span>Move your hand a little closer inside the green dashed box.</span>
                </>
              )}
              {readiness === 'ready' && (
                <>
                  <span className="feedback-icon">🎉</span>
                  <span>Awesome! Perfect lighting and hand position. You are ready to sign!</span>
                </>
              )}
            </div>
          </div>

          {/* E. Actions Toolbar */}
          <div className="camera-setup-actions">
            <a href="#home" className="button secondary back-dash-btn">
              <Icon name="back" />
              <span>Back to Dashboard</span>
            </a>

            {connected ? (
              <button
                type="button"
                className="button secondary retry-btn"
                onClick={startCamera}
              >
                <Icon name="retry" />
                <span>Retry Camera</span>
              </button>
            ) : null}

            <a
              href="#camera"
              className={`button primary continue-practice-btn ${readiness === 'ready' ? 'pulsing' : ''}`}
              onClick={(e) => {
                if (onContinue) {
                  e.preventDefault();
                  onContinue();
                }
              }}
            >
              <span>Continue to Practice</span>
              <Icon name="arrow" />
            </a>
          </div>
        </section>

        {/* C. Easy Tips Section (Right) */}
        <aside className="camera-tips-panel paper">
          <div className="tips-panel-header">
            <div className="tips-icon-wrap">
              <Icon name="spark" />
            </div>
            <h2>3 Easy Tips for Best Results</h2>
          </div>

          <div className="tips-cards-stack">
            {/* Tip 1 */}
            <div className="tip-card paper yellow">
              <div className="tip-card-icon-circle yellow">
                <Icon name="sun" />
              </div>
              <div className="tip-card-body">
                <h3>Tip 1 – Face the Light</h3>
                <p>Sit facing a lamp or window so your hands are bright and easy to see.</p>
              </div>
            </div>

            {/* Tip 2 */}
            <div className="tip-card paper mint">
              <div className="tip-card-icon-circle mint">
                <Icon name="hand" />
              </div>
              <div className="tip-card-body">
                <h3>Tip 2 – Keep Hands in Front</h3>
                <p>Hold your hand at chest level, about an arm’s distance from the screen.</p>
              </div>
            </div>

            {/* Tip 3 */}
            <div className="tip-card paper sky">
              <div className="tip-card-icon-circle sky">
                <Icon name="check" />
              </div>
              <div className="tip-card-body">
                <h3>Tip 3 – You Are Ready!</h3>
                <p>When the box glows green, you can start signing right away!</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
