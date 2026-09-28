import * as THREE from './vendor/three/three.module.min.js';
import { GLTFLoader } from './vendor/three/loaders/GLTFLoader.js';

const COLORS = { teal: 0x208e94, cream: 0xe6ddd0, navy: 0x223b50, gold: 0xf7bc5b };
const clamp = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(1, Number(value))) : fallback;

export class CampusScene {
  constructor(container) {
    this.container = container;
    this.stage = 'sound';
    this.mode = '3d';
    this.state = { lamp: false, level: 0, doorOpen: false, personX: 0, signal: 'red', moving: false, text: '' };
    this.display = { lamp: 0, door: 0 };
    this.groups = {};
    this.frame = 0;
    this.destroyed = false;
    this.onInteract = null;
    this.clickHandler = event => this.handleClick(event);
    container.addEventListener('click', this.clickHandler);
    this.reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    container.style.position = 'relative';
    this.canvas2d = document.createElement('canvas');
    this.canvas2d.setAttribute('role', 'img');
    this.canvas2d.style.cssText = 'width:100%;height:100%;display:block;position:absolute;inset:0;border-radius:inherit';
    container.append(this.canvas2d);
    this.notice = document.createElement('div');
    this.notice.style.cssText = 'position:absolute;left:14px;right:14px;bottom:12px;padding:7px 10px;border-radius:8px;background:rgba(255,255,255,.92);color:#334b57;font-size:12px;pointer-events:none;z-index:2;display:none';
    this.notice.setAttribute('role', 'status');
    container.append(this.notice);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
  }

  async init() {
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
      this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.05;
      this.renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;border-radius:inherit';
      this.renderer.domElement.setAttribute('role', 'img');
      this.renderer.domElement.addEventListener('webglcontextlost', this.contextLost = event => {
        event.preventDefault();
        this.webglLost = true;
        this.mode = '2d';
        this.notice.textContent = '三维显示暂时不可用，已切换二维场景，实验仍可继续。';
        this.notice.style.display = 'block';
        this.showMode();
        this.invalidate();
      });
      this.container.prepend(this.renderer.domElement);
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0xe8efef);
      this.camera = new THREE.OrthographicCamera(-5, 5, 3.3, -3.3, 0.1, 80);
      this.camera.position.set(7.6, 5.8, 9.5);
      this.camera.lookAt(0, 1, 0);
      this.worldAmbient = new THREE.HemisphereLight(0xffffff, 0x7b858c, 2.2);
      this.scene.add(this.worldAmbient);
      const sun = this.worldSun = new THREE.DirectionalLight(0xffffff, 2.7);
      sun.position.set(3, 7, 5);
      this.scene.add(sun);
      this.buildSound();
      this.buildRoad();
      this.buildDoor();
      this.buildText();
      this.resize();
      this.setStage(this.stage);
      this.loadRobot();
    } catch (error) {
      this.renderer?.dispose();
      this.renderer?.domElement.remove();
      this.renderer = null;
      this.mode = '2d';
      this.notice.textContent = '这台设备已使用二维场景，灯、门和输入输出实验均可操作。';
      this.notice.style.display = 'block';
      this.resize();
    }
    this.showMode();
    this.invalidate();
    return this;
  }

  material(color, options = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...options }); }
  box(group, width, height, depth, color, x, y, z, options = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), this.material(color, options));
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  }
  sphere(group, radius, color, x, y, z) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 10), this.material(color));
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  }
  group(name) {
    const group = new THREE.Group();
    this.groups[name] = group;
    this.scene.add(group);
    return group;
  }
  plant(group, x, z) {
    this.box(group, .55, .55, .55, COLORS.cream, x, .28, z);
    this.sphere(group, .45, 0x3e8e68, x, .94, z);
    this.sphere(group, .32, 0x6faa76, x + .22, 1.2, z - .05);
  }
  floor(group, color = COLORS.cream) {
    const floor = this.box(group, 8, .2, 5, color, 0, -.13, 0);
    floor.name = 'ground';
  }
  person(group, color = COLORS.teal) {
    const person = new THREE.Group();
    this.sphere(person, .21, 0xe8b68e, 0, 1.36, 0);
    this.box(person, .4, .58, .28, color, 0, .93, 0);
    this.box(person, .14, .48, .18, COLORS.navy, -.13, .39, 0);
    this.box(person, .14, .48, .18, COLORS.navy, .13, .39, 0);
    this.box(person, .11, .49, .15, color, -.3, .9, 0);
    this.box(person, .11, .49, .15, color, .3, .9, 0);
    group.add(person);
    return person;
  }

  buildSound() {
    const g = this.group('sound');
    this.floor(g, 0xc6bcae);
    this.wall = this.box(g, 8, 3.7, .15, 0xd9cebc, 0, 1.75, -2.15);
    this.box(g, .15, 3.7, 4.3, 0xd0c5b3, -4, 1.75, -.08);
    this.box(g, 1.2, 2.55, .09, 0x6f838b, 2.5, 1.2, -2.02);
    this.box(g, .14, .14, .12, 0xe3c677, 2.9, 1.2, -1.92);
    this.box(g, 1.65, .32, .15, 0x208e94, -.55, 2.55, -2.02);
    this.lampFixture = this.box(g, 1.3, .1, .8, 0xb6bac1, .35, 3.3, -.5, { emissive: 0xffd68c, emissiveIntensity: 0 });
    this.lampMesh = this.box(g, 1.15, .08, .66, 0xf7efd5, .35, 3.22, -.5, { emissive: 0xffd68c, emissiveIntensity: 0 });
    this.lampLight = new THREE.PointLight(0xffd48b, 0, 9, 1.6);
    this.lampLight.position.set(.35, 2.95, -.5);
    g.add(this.lampLight);
    this.soundSensor = this.sphere(g, .15, 0x208e94, 1.2, 3.22, -.5);
    this.soundSensor.name = this.lampFixture.name = this.lampMesh.name = 'sound-input';
    this.plant(g, 3.1, .5);
    for (let x = -3; x <= 3; x++) this.box(g, .018, .01, 4.8, 0xb9ae9d, x, -.015, 0);
    this.soundBaseLight = new THREE.HemisphereLight(0xffefdb, 0x43464f, .7);
    g.add(this.soundBaseLight);
  }

  buildRoad() {
    const g = this.group('road');
    this.floor(g, 0x66777c);
    this.box(g, 8, .07, 1.1, 0xd4c7b3, 0, .005, -1.92);
    this.box(g, 8, .07, 1.1, 0xd4c7b3, 0, .005, 1.95);
    for (let z = -1.3; z <= 1.4; z += .45) this.box(g, 1.6, .012, .23, 0xf0eee4, -.3, .001, z);
    this.box(g, .13, 2.8, .13, 0x465663, 1.2, 1.4, -1.7);
    this.box(g, .55, 1.05, .35, COLORS.navy, 1.2, 2.7, -1.7);
    this.redLight = this.sphere(g, .15, 0x523c3e, 1.2, 2.96, -1.49);
    this.greenLight = this.sphere(g, .15, 0x2c594b, 1.2, 2.5, -1.49);
    this.redLight.name = this.greenLight.name = 'signal';
    this.roadPerson = this.person(g);
    this.roadPerson.position.set(-.5, .05, 1.8);
    this.plant(g, 2.8, -1.9);
  }

  buildDoor() {
    const g = this.group('door');
    this.floor(g);
    this.box(g, 2.15, 3.6, .22, 0xd4e2df, -2.925, 1.7, -1.8);
    this.box(g, 2.15, 3.6, .22, 0xd4e2df, 2.925, 1.7, -1.8);
    this.box(g, 3.7, .72, .22, 0xd4e2df, 0, 3.14, -1.8);
    this.box(g, .18, 2.8, .3, COLORS.navy, -1.78, 1.38, -1.62);
    this.box(g, .18, 2.8, .3, COLORS.navy, 1.78, 1.38, -1.62);
    this.box(g, 3.75, .2, .3, COLORS.navy, 0, 2.8, -1.62);
    this.box(g, 3.35, 2.65, .12, 0x75949b, 0, 1.3, -3.7).name = 'doorway';
    this.box(g, 3.35, .12, 2, 0xbdc4bf, 0, -.015, -2.65);
    this.box(g, 1.2, .5, .03, 0xe7b86f, -.45, 1.6, -3.6);
    this.doorLeft = new THREE.Group();
    this.doorRight = new THREE.Group();
    for (const part of [this.doorLeft, this.doorRight]) {
      this.box(part, 1.55, 2.6, .09, 0xbedddd, 0, 1.28, 0, { transparent: true, opacity: .68, metalness: .12 }).name = 'door-panel';
      this.box(part, .04, 2.6, .11, COLORS.navy, -.77, 1.28, 0);
      this.box(part, .04, 2.6, .11, COLORS.navy, .77, 1.28, 0);
      this.box(part, 1.55, .045, .11, COLORS.navy, 0, 2.57, 0);
      this.box(part, .05, .6, .16, 0x668e96, .55, 1.2, .04);
      part.position.z = -1.13;
      g.add(part);
    }
    this.doorLeft.position.x = -.8;
    this.doorRight.position.x = .8;
    this.box(g, .38, .15, .19, COLORS.teal, 0, 2.85, -1.38);
    const zone = this.box(g, 2.25, .011, 1.7, COLORS.teal, 0, .002, .1, { transparent: true, opacity: .18 });
    zone.name = '教学探测区';
    this.doorPerson = this.person(g, 0xe8a34f);
    this.doorPerson.position.set(-3.3, 0, .1);
    this.plant(g, 3.1, -.2);
  }

  buildText() {
    const g = this.group('text');
    this.floor(g, 0xddd3c3);
    this.box(g, 7.9, 3.6, .15, 0xcbdedb, 0, 1.7, -2.15);
    this.box(g, 4.9, .18, 2.4, 0xb78960, .1, 1, -.15);
    for (const x of [-2, 2]) this.box(g, .2, .95, .25, COLORS.navy, x, .45, -.4);
    this.box(g, 2.3, 1.55, .2, COLORS.navy, .1, 2.04, -.55);
    this.box(g, .24, .5, .25, COLORS.navy, .1, 1.3, -.55);
    this.box(g, .9, .08, .5, COLORS.navy, .1, 1.12, -.55);
    this.screenCanvas = document.createElement('canvas');
    this.screenCanvas.width = 768;
    this.screenCanvas.height = 480;
    this.screenTexture = new THREE.CanvasTexture(this.screenCanvas);
    this.screenTexture.colorSpace = THREE.SRGBColorSpace;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.35), new THREE.MeshBasicMaterial({ map: this.screenTexture }));
    screen.position.set(.1, 2.04, -.439);
    screen.name = 'screen';
    g.add(screen);
    this.box(g, 1.8, .065, .55, 0xe9e5db, .1, 1.125, .46);
    for (let x = -.6; x < .9; x += .16) for (let z = .28; z < .7; z += .13) this.box(g, .11, .017, .08, 0x718189, x, 1.17, z);
    this.plant(g, 3, .1);
    this.drawScreen();
  }

  async loadRobot() {
    try {
      const model = await new GLTFLoader().loadAsync(new URL('./assets/campus-robot.glb', import.meta.url).href);
      if (this.destroyed) { this.disposeObject(model.scene); return; }
      const bounds = new THREE.Box3().setFromObject(model.scene);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const scale = 1.5 / Math.max(size.y, .01);
      model.scene.scale.setScalar(scale);
      model.scene.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
      this.robot = new THREE.Group();
      this.robot.add(model.scene);
      this.robot.position.set(-2.85, 0, 1.1);
      this.robot.rotation.y = .3;
      this.scene.add(this.robot);
      this.robotLoaded = true;
      this.invalidate();
    } catch (error) {
      if (this.destroyed) return;
      this.notice.textContent = '小递模型暂未加载，场景中的实验仍可继续。';
      this.notice.style.display = 'block';
      this.invalidate();
    }
  }

  drawScreen() {
    if (!this.screenCanvas) return;
    const ctx = this.screenCanvas.getContext('2d');
    ctx.fillStyle = '#f8faf6'; ctx.fillRect(0, 0, 768, 480);
    ctx.fillStyle = '#d9ebe7'; ctx.fillRect(0, 0, 768, 68);
    ctx.font = '28px sans-serif'; ctx.fillStyle = '#35666a'; ctx.fillText('校园留言板', 32, 46);
    ctx.font = '22px sans-serif'; ctx.fillStyle = '#779398'; ctx.fillText('屏幕显示结果', 32, 120);
    ctx.font = '54px sans-serif'; ctx.fillStyle = '#1d424b';
    const chars = Array.from(this.state.text || '等待输入…');
    for (let line = 0; line < 3; line++) ctx.fillText(chars.slice(line * 11, (line + 1) * 11).join(''), 36, 205 + line * 76);
    this.screenTexture.needsUpdate = true;
  }

  setStage(stage) {
    if (!['road', 'sound', 'text', 'door'].includes(stage)) return;
    this.stage = stage;
    Object.entries(this.groups).forEach(([name, group]) => group.visible = name === stage);
    if (this.scene) this.scene.background.set(stage === 'sound' ? 0xd7d9d5 : 0xe8efef);
    if (this.worldAmbient) this.worldAmbient.intensity = stage === 'sound' ? .65 : 2.2;
    if (this.worldSun) this.worldSun.intensity = stage === 'sound' ? .5 : 2.7;
    this.invalidate();
  }

  handleClick(event) {
    if (typeof this.onInteract !== 'function' || this.destroyed) return;
    const bounds = this.container.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    let action;
    if (this.mode === '3d' && this.camera && this.groups[this.stage]) {
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(x * 2 - 1, 1 - y * 2), this.camera);
      const hit = ray.intersectObject(this.groups[this.stage], true)[0];
      if (!hit) return;
      const target = hit.object.name;
      if (this.stage === 'door') {
        if (target === 'ground') action = { type: 'position', personX: clamp((hit.point.x + 3.3) / 3.3) };
        else if (target === 'door-panel' || target === 'doorway') action = { type: 'position', personX: 1 };
      } else if (target === 'signal') action = { type: 'toggleSignal' };
      else if (target === 'sound-input') action = { type: 'requestSound' };
      else if (target === 'screen') action = { type: 'focusText' };
    } else {
      const px = x * 800, py = y * 480;
      if (this.stage === 'door') {
        if (py >= 345) action = { type: 'position', personX: clamp((px - 160) / 265) };
        else if (px >= 285 && px <= 565 && py >= 80 && py <= 345) action = { type: 'position', personX: 1 };
      } else if (this.stage === 'road' && px >= 528 && px <= 596 && py >= 45 && py <= 178) action = { type: 'toggleSignal' };
      else if (this.stage === 'sound' && px >= 310 && px <= 540 && py >= 70 && py <= 127) action = { type: 'requestSound' };
      else if (this.stage === 'text' && px >= 260 && px <= 590 && py >= 76 && py <= 309) action = { type: 'focusText' };
    }
    if (action) this.onInteract(action);
  }

  setState(patch = {}) {
    const previousText = this.state.text;
    this.state = { ...this.state, ...patch };
    this.state.level = clamp(this.state.level);
    this.state.personX = clamp(this.state.personX);
    this.state.text = String(this.state.text || '').slice(0, 100);
    if (previousText !== this.state.text) this.drawScreen();
    this.invalidate();
  }

  setMode(mode) {
    if (!['2d', '3d'].includes(mode)) return;
    this.mode = mode === '3d' && this.renderer && !this.webglLost ? '3d' : '2d';
    this.showMode();
    this.invalidate();
    return this.mode;
  }

  showMode() {
    this.canvas2d.style.display = this.mode === '2d' ? 'block' : 'none';
    if (this.renderer) this.renderer.domElement.style.display = this.mode === '3d' ? 'block' : 'none';
  }

  resize() {
    if (this.destroyed) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight || 400);
    this.width = width;
    this.height = height;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    this.canvas2d.width = Math.round(width * dpr);
    this.canvas2d.height = Math.round(height * dpr);
    if (this.renderer && this.camera) {
      this.renderer.setSize(width, height, false);
      const halfHeight = Math.max(3.05, 5.3 / (width / height));
      this.camera.top = halfHeight;
      this.camera.bottom = -halfHeight;
      this.camera.left = -halfHeight * width / height;
      this.camera.right = halfHeight * width / height;
      this.camera.updateProjectionMatrix();
    }
    this.invalidate();
  }

  invalidate() {
    if (this.frame || this.destroyed) return;
    this.frame = requestAnimationFrame(time => this.render(time));
  }

  render(time) {
    this.frame = 0;
    if (this.destroyed) return;
    const delta = Math.min((time - (this.lastTime || time)) / 1000, .1);
    this.lastTime = time;
    const alpha = this.reduceMotion ? 1 : 1 - Math.exp(-delta * 12);
    this.display.lamp += ((this.state.lamp ? 1 : 0) - this.display.lamp) * alpha;
    this.display.door += ((this.state.doorOpen ? 1 : 0) - this.display.door) * alpha;
    if (Math.abs(this.display.lamp - (this.state.lamp ? 1 : 0)) < .003) this.display.lamp = this.state.lamp ? 1 : 0;
    if (Math.abs(this.display.door - (this.state.doorOpen ? 1 : 0)) < .003) this.display.door = this.state.doorOpen ? 1 : 0;
    const description = { sound: `声控灯：${this.state.lamp ? '亮' : '灭'}，相对响度 ${Math.round(this.state.level * 100)}`, door: `自动门：${this.state.doorOpen ? '开启' : '关闭'}，人物位置 ${Math.round(this.state.personX * 100)}`, road: `路口：${this.state.signal === 'green' ? '绿' : '红'}灯`, text: `计算机屏幕：${this.state.text || '等待输入'}` }[this.stage];
    this.canvas2d.setAttribute('aria-label', description);
    if (this.mode === '3d' && this.renderer) {
      this.renderer.domElement.setAttribute('aria-label', description);
      this.lampLight.intensity = this.display.lamp * 42;
      this.lampMesh.material.emissiveIntensity = this.display.lamp * 2.5;
      this.lampFixture.material.emissiveIntensity = this.display.lamp * 1.2;
      this.soundSensor.material.emissive.setHex(COLORS.teal);
      this.soundSensor.material.emissiveIntensity = this.state.level * 1.5;
      this.doorLeft.position.x = -.8 - this.display.door * 1.52;
      this.doorRight.position.x = .8 + this.display.door * 1.52;
      this.doorPerson.position.x = -3.3 + this.state.personX * 3.3;
      this.redLight.material.emissive.setHex(0xf64d4d);
      this.redLight.material.emissiveIntensity = this.state.signal === 'red' ? 2 : 0;
      this.greenLight.material.emissive.setHex(0x39cf8e);
      this.greenLight.material.emissiveIntensity = this.state.signal === 'green' ? 2 : 0;
      this.roadPerson.position.z = this.state.moving && this.state.signal === 'green' ? -.7 : 1.8;
      if (this.robot) this.robot.rotation.y = .3 + (this.state.level > .3 && this.stage === 'sound' ? Math.sin(time / 190) * .09 : 0);
      this.renderer.render(this.scene, this.camera);
    } else this.draw2d();
    const animating = this.display.lamp !== (this.state.lamp ? 1 : 0) || this.display.door !== (this.state.doorOpen ? 1 : 0);
    if (animating) this.invalidate();
  }

  draw2d() {
    if (!this.width) return;
    const ctx = this.canvas2d.getContext('2d');
    const width = this.canvas2d.width, height = this.canvas2d.height;
    ctx.setTransform(width / 800, 0, 0, height / 480, 0, 0);
    ctx.fillStyle = '#e9efed'; ctx.fillRect(0, 0, 800, 480);
    const label = (text, x, y, size = 17, color = '#315460') => { ctx.font = `${size}px sans-serif`; ctx.fillStyle = color; ctx.fillText(text, x, y); };
    ctx.fillStyle = '#d9cbb5'; ctx.fillRect(0, 345, 800, 135);
    if (this.stage === 'sound') {
      ctx.fillStyle = '#c9c2b5'; ctx.fillRect(35, 45, 730, 300);
      ctx.fillStyle = '#6c8289'; ctx.fillRect(610, 120, 100, 225);
      ctx.fillStyle = '#f1d181'; ctx.fillRect(690, 234, 7, 7);
      if (this.display.lamp > .01) {
        const glow = ctx.createRadialGradient(405, 135, 20, 405, 255, 290);
        glow.addColorStop(0, `rgba(255,224,140,${this.display.lamp * .9})`); glow.addColorStop(1, 'rgba(255,224,140,0)');
        ctx.fillStyle = glow; ctx.fillRect(70, 105, 670, 340);
      }
      ctx.fillStyle = '#858f95'; ctx.fillRect(318, 80, 170, 18);
      ctx.fillStyle = this.state.lamp ? '#fff1ba' : '#e5e3d9'; ctx.fillRect(328, 98, 150, 16);
      ctx.fillStyle = '#208e94'; ctx.beginPath(); ctx.arc(510, 97, 11 + this.state.level * 3, 0, Math.PI * 2); ctx.fill();
      label('声音采集装置', 480, 63, 15);
      label(this.state.lamp ? '灯亮了' : '灯未亮', 348, 153, 23);
      label('校园楼道', 70, 91, 20);
    } else if (this.stage === 'door') {
      ctx.fillStyle = '#cbddda'; ctx.fillRect(35, 50, 730, 295);
      ctx.fillStyle = '#253d51'; ctx.fillRect(286, 83, 278, 262);
      ctx.fillStyle = '#edf3ef'; ctx.fillRect(300, 97, 250, 248);
      const gap = this.display.door * 114;
      ctx.fillStyle = 'rgba(120,184,190,.65)'; ctx.fillRect(300 - gap, 97, 123, 248); ctx.fillRect(426 + gap, 97, 123, 248);
      ctx.strokeStyle = '#4e777f'; ctx.lineWidth = 3; ctx.strokeRect(300 - gap, 97, 123, 248); ctx.strokeRect(426 + gap, 97, 123, 248);
      ctx.fillStyle = '#208e94'; ctx.fillRect(410, 72, 30, 13);
      ctx.fillStyle = 'rgba(32,142,148,.15)'; ctx.fillRect(365, 346, 174, 92);
      label('教学探测区', 388, 458, 15);
      this.drawPerson2d(ctx, 160 + this.state.personX * 265, 402, '#e8a34f');
      label(this.state.doorOpen ? '门已开启' : '门已关闭', 590, 240, 23);
    } else if (this.stage === 'road') {
      ctx.fillStyle = '#65777d'; ctx.fillRect(0, 140, 800, 230);
      ctx.fillStyle = '#f3f0df'; for (let y = 153; y < 360; y += 37) ctx.fillRect(333, y, 125, 20);
      ctx.fillStyle = '#445563'; ctx.fillRect(556, 135, 12, 210); ctx.fillStyle = '#243c50'; ctx.fillRect(534, 55, 55, 117);
      ctx.fillStyle = this.state.signal === 'red' ? '#ff6964' : '#56383d'; ctx.beginPath(); ctx.arc(561, 85, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = this.state.signal === 'green' ? '#53e09c' : '#325546'; ctx.beginPath(); ctx.arc(561, 139, 16, 0, Math.PI * 2); ctx.fill();
      this.drawPerson2d(ctx, 390, this.state.moving && this.state.signal === 'green' ? 225 : 440, '#208e94');
      label('校园路口', 64, 88, 23);
    } else {
      ctx.fillStyle = '#cbdedb'; ctx.fillRect(0, 0, 800, 345);
      ctx.fillStyle = '#b78960'; ctx.fillRect(206, 314, 432, 22);
      ctx.fillStyle = '#243c50'; ctx.fillRect(266, 82, 316, 219); ctx.fillRect(410, 301, 28, 14);
      ctx.fillStyle = '#f8faf6'; ctx.fillRect(282, 98, 284, 187);
      label('校园留言板', 300, 132, 20);
      const chars = Array.from(this.state.text || '等待输入…');
      for (let line = 0; line < 3; line++) label(chars.slice(line * 8, (line + 1) * 8).join(''), 300, 185 + line * 32, 24);
      ctx.fillStyle = '#e6e1d5'; ctx.fillRect(310, 338, 220, 34);
      label('输入设备：键盘', 340, 401, 17);
    }
    // A simple drawn robot is the 2D counterpart, not a claimed 3D render.
    this.drawRobot2d(ctx, 87, 373);
    label('小递', 66, 464, 14);
  }

  drawPerson2d(ctx, x, y, color) {
    ctx.fillStyle = '#e8b68e'; ctx.beginPath(); ctx.arc(x, y - 91, 15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color; ctx.fillRect(x - 19, y - 72, 38, 42);
    ctx.fillStyle = '#243c50'; ctx.fillRect(x - 16, y - 30, 12, 30); ctx.fillRect(x + 4, y - 30, 12, 30);
  }

  drawRobot2d(ctx, x, y) {
    ctx.fillStyle = '#f3eee3'; ctx.fillRect(x - 31, y - 35, 62, 48);
    ctx.fillStyle = '#263f51'; ctx.fillRect(x - 24, y - 28, 48, 27);
    ctx.fillStyle = '#6fd9d0'; ctx.fillRect(x - 17, y - 18, 8, 5); ctx.fillRect(x + 9, y - 18, 8, 5);
    ctx.fillStyle = '#208e94'; ctx.fillRect(x - 27, y + 15, 54, 46);
    ctx.fillStyle = '#edb352'; ctx.fillRect(x - 16, y + 28, 32, 17);
    ctx.fillStyle = '#243c50'; ctx.beginPath(); ctx.arc(x - 22, y + 63, 10, 0, Math.PI * 2); ctx.arc(x + 22, y + 63, 10, 0, Math.PI * 2); ctx.fill();
  }

  disposeObject(object) {
    object.traverse(child => {
      child.geometry?.dispose();
      const materials = child.material ? (Array.isArray(child.material) ? child.material : [child.material]) : [];
      materials.forEach(material => {
        for (const value of Object.values(material)) if (value?.isTexture) value.dispose();
        material.dispose();
      });
    });
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.container.removeEventListener('click', this.clickHandler);
    if (this.scene) this.disposeObject(this.scene);
    if (this.renderer) {
      this.renderer.domElement.removeEventListener('webglcontextlost', this.contextLost);
      this.renderer.dispose();
      this.renderer.domElement.remove();
    }
    this.canvas2d.remove();
    this.notice.remove();
  }
}
