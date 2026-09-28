// Only measures relative microphone amplitude. LessonRules decides the lamp state.
export class Microphone {
  constructor({ onSample = () => {}, onStatus = () => {} } = {}) {
    this.onSample = onSample;
    this.onStatus = onStatus;
    this.session = 0;
    this.frame = 0;
    this.noiseFloor = 0;
    this.lastSample = 0;
    this.visibilityHandler = () => {
      if (document.hidden && this.context) {
        this.stop();
        this.onStatus({ state: 'stopped', message: '页面已切到后台，麦克风已暂停。回来后可重新开启。' });
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  async start() {
    if (this.context || this.starting) return;
    const session = ++this.session;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      this.onStatus({ state: 'error', message: `当前局域网IP地址不能直接采声。教师电脑本机打开 http://localhost:${window.location?.port || '8794'}/teacher 或 /demo，无需 HTTPS；学生电脑可选择“观察教师现场实测”或“模拟声音”。若每台学生电脑都要独立采声，需使用可信 HTTPS。` });
      return;
    }
    this.starting = true;
    try {
      this.onStatus({ state: 'calibrating', message: '请允许使用麦克风。开启后先安静片刻，测量教室背景声音。' });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
      if (session !== this.session) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      this.stream = stream;
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) throw new Error('unsupported_audio');
      this.context = new AudioContext();
      await this.context.resume();
      if (session !== this.session) return;
      this.source = this.context.createMediaStreamSource(stream);
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 1024;
      this.samples = new Float32Array(this.analyser.fftSize);
      this.source.connect(this.analyser);
      // Deliberately never connect to destination: no replay, recording or upload.
      this.calibrate();
      this.read(session);
    } catch (error) {
      if (session !== this.session) return;
      this.release();
      const messages = {
        NotAllowedError: '麦克风权限未开启。可在浏览器地址旁允许麦克风后重试，或使用模拟声音。',
        NotFoundError: '这台电脑没有可用麦克风。请使用教师机实测，或选择模拟声音。',
        NotReadableError: '麦克风暂时无法使用，可能被其他程序占用。关闭占用程序后重试，或选择模拟声音。',
        SecurityError: '浏览器限制了麦克风访问。请检查本机入口或 HTTPS 设置。'
      };
      this.onStatus({ state: 'error', message: messages[error.name] || '麦克风未能开启。请检查设备和浏览器权限，或选择模拟声音。' });
    } finally {
      if (session === this.session) this.starting = false;
    }
  }

  calibrate() {
    if (!this.context) return;
    this.calibration = [];
    this.calibrationEnd = performance.now() + 1500;
    this.smoothedLevel = 0;
    this.onStatus({ state: 'calibrating', message: '正在测量背景声音（约 1.5 秒），请暂时保持安静。' });
  }

  read(session) {
    if (session !== this.session || !this.analyser) return;
    const now = performance.now();
    if (now - this.lastSample >= 32) {
      this.lastSample = now;
      this.analyser.getFloatTimeDomainData(this.samples);
      let mean = 0;
      for (const value of this.samples) mean += value;
      mean /= this.samples.length;
      let sum = 0;
      for (const value of this.samples) sum += (value - mean) ** 2;
      const raw = Math.sqrt(sum / this.samples.length);
      let level = 0;
      if (this.calibration) {
        this.calibration.push(raw);
        if (now >= this.calibrationEnd) {
          this.calibration.sort((a, b) => a - b);
          this.noiseFloor = this.calibration[Math.floor(this.calibration.length * 0.7)] || 0;
          this.calibration = null;
          this.onStatus({ state: 'listening', message: '正在采集真实声音。请正常说话或轻拍手，观察响度和灯的变化。此数值是相对响度，不是分贝。' });
        }
      } else {
        const aboveNoise = Math.max(0, raw - this.noiseFloor * 1.3 - 0.001);
        const target = Math.min(1, aboveNoise / Math.max(0.018, this.noiseFloor * 4));
        // Fast attack retains brief claps; gradual release avoids flickering levels.
        this.smoothedLevel += (target - this.smoothedLevel) * (target > this.smoothedLevel ? 0.7 : 0.32);
        level = Math.max(0, Math.min(1, this.smoothedLevel));
      }
      this.onSample({ level, raw, source: 'microphone' });
    }
    this.frame = requestAnimationFrame(() => this.read(session));
  }

  release() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.source?.disconnect();
    this.analyser?.disconnect();
    this.stream?.getTracks().forEach(track => track.stop());
    if (this.context && this.context.state !== 'closed') this.context.close().catch(() => {});
    this.context = null;
    this.stream = null;
    this.source = null;
    this.analyser = null;
    this.calibration = null;
  }

  stop() {
    this.session++;
    this.starting = false;
    this.release();
    this.onSample({ level: 0, raw: 0, source: 'microphone' });
    this.onStatus({ state: 'stopped', message: '麦克风已关闭，声音采集已停止。' });
  }

  destroy() {
    this.stop();
    document.removeEventListener('visibilitychange', this.visibilityHandler);
  }
}
