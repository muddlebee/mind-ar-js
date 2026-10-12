export function cameraError(error, phase) {
  const messages = {
    SecurityError: 'Open this page over HTTPS (or localhost), then try again.',
    NotAllowedError: 'Camera permission was denied. Allow camera access in your browser site settings, then try again.',
    NotFoundError: 'No camera was found. Connect or enable a camera, then try again.',
    NotReadableError: 'The camera is unavailable. Close other apps using it, then try again.',
    OverconstrainedError: 'A front camera could not be opened. Check your camera device, then try again.',
    NotSupportedError: 'This browser needs camera access and WebGL. Try a current Chrome browser over HTTPS.',
  };
  if (messages[error?.name]) return messages[error.name];
  if (phase === 'loading') return 'Face tracking could not load. Check your internet connection to the model/WASM downloads, then try again.';
  return 'The camera preview could not start. Check camera access and WebGL support, then try again.';
}

export class CameraSession {
  constructor({create, onChange, check = () => {
    if (!globalThis.isSecureContext) throw new DOMException('HTTPS required', 'SecurityError');
    if (!navigator.mediaDevices?.getUserMedia) throw new DOMException('Camera API required', 'NotSupportedError');
  }}) {
    this.create = create;
    this.onChange = onChange;
    this.check = check;
    this.generation = 0;
    this.state = {phase: 'idle'};
  }
  setState(phase, message) {
    this.state = {phase, message};
    if (!this.disposed) this.onChange(this.state);
  }
  start() {
    if (this.disposed || this.startTask || ['searching', 'tracking'].includes(this.state.phase)) return this.startTask;
    const generation = ++this.generation;
    this.startTask = Promise.resolve().then(async () => {
      try {
        if (generation !== this.generation || this.disposed) return;
        this.check();
        this.setState('loading', 'Preparing your preview…');
        if (!this.engine) this.engine = await this.create({
          onCameraReady: () => {
            if (!this.disposed && this.state.phase === 'permission') this.setState('loading', 'Camera ready. Loading face tracking…');
          },
          onFaceUpdate: ({hasFace}) => {
            if (!this.disposed && ['searching', 'tracking'].includes(this.state.phase)) {
              const phase = hasFace ? 'tracking' : 'searching';
              if (phase !== this.state.phase) this.setState(phase);
            }
          },
          onError: () => {
            if (this.disposed) return;
            this.engine?.stop();
            this.setState('error', 'Face tracking stopped. Restart the camera to try again.');
          },
        });
        if (generation !== this.generation || this.disposed) return;
        this.setState('permission', 'Allow camera access when your browser asks.');
        await this.engine.start();
        if (generation !== this.generation || this.disposed) return;
        this.engine.render();
        this.setState('searching');
      } catch (error) {
        if (generation !== this.generation || this.disposed) return;
        this.engine?.stop();
        this.setState('error', cameraError(error, this.state.phase));
      } finally {
        this.startTask = null;
        if (!this.disposed && this.state.phase === 'stopping') this.setState('idle');
      }
    });
    return this.startTask;
  }
  stop() {
    ++this.generation;
    this.engine?.stop();
    this.setState(this.startTask ? 'stopping' : 'idle');
  }
  async dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    // Creation can complete after navigation. Its owner still tears it down.
    await this.startTask;
    await this.engine?.dispose();
    this.engine = null;
  }
}
