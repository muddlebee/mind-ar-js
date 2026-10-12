import { Scene, WebGLRenderer, PerspectiveCamera, sRGBEncoding, Mesh, MeshStandardMaterial, Group } from "three";
//import { CSS3DRenderer } from '../libs/CSS3DRenderer.js';
import {CSS3DRenderer} from 'three/addons/renderers/CSS3DRenderer.js'
import { Controller } from "./controller.js";
import { UI } from "../ui/ui.js";
import {BufferGeometry,BufferAttribute} from "three";
const THREE={BufferGeometry,BufferAttribute};

export class MindARThree {
  constructor({container, uiLoading="yes", uiScanning="yes", uiError="yes", filterMinCF=null, filterBeta=null,
    userDeviceId = null, environmentDeviceId = null, disableFaceMirror = false,
    maxPixelRatio = Infinity, onCameraReady = null, onFaceUpdate = null,
  }) {
    this.container = container;
    this.ui = new UI({ uiLoading, uiScanning, uiError });

    this.controller = new Controller({
      filterMinCF: filterMinCF,
      filterBeta: filterBeta,
    });
    this.disableFaceMirror = disableFaceMirror;
    this.onCameraReady = onCameraReady;
    this.onFaceUpdate = onFaceUpdate;
    this.startToken = 0;
    this.scene = new Scene();
    this.cssScene = new Scene();
    try {
      this.renderer = new WebGLRenderer({ antialias: true, alpha: true });
    } catch (error) {
      this.ui.dispose();
      throw new DOMException('WebGL renderer could not initialize', 'NotSupportedError');
    }
    this.cssRenderer = new CSS3DRenderer({ antialias: true });
    this.renderer.outputEncoding = sRGBEncoding;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
    this.camera = new PerspectiveCamera();
    this.userDeviceId = userDeviceId;
    this.environmentDeviceId = environmentDeviceId;

    this.anchors = [];
    this.faceMeshes = [];

    this.latestEstimate = null;

    this.container.appendChild(this.renderer.domElement);
    this.container.appendChild(this.cssRenderer.domElement);

    this.shouldFaceUser = true;

    this.resizeHandler = this._resize.bind(this);
    window.addEventListener('resize', this.resizeHandler);
  }

  start() {
    if (this.disposed) return Promise.reject(new Error('MindARThree has been disposed'));
    if (this.startPromise) return this.startPromise;
    if (this.running) return Promise.resolve();
    const token = ++this.startToken;
    this.ui.showLoading();
    this.startPromise = (async () => {
      try {
        await this._startVideo(token);
        this._assertStart(token);
        this.onCameraReady?.();
        await this._startAR(token);
        this._assertStart(token);
        this.running = true;
      } catch (error) {
        if (token === this.startToken) this.stop();
        throw error;
      } finally {
        this.startPromise = null;
        this.ui.hideLoading();
      }
    })();
    return this.startPromise;
  }

  _assertStart(token) {
    if (token !== this.startToken || this.disposed) {
      throw new DOMException('Camera start was cancelled', 'AbortError');
    }
  }

  stop() {
    ++this.startToken;
    this.running = false;
    this.cancelVideoWait?.();
    this.controller.stopProcessVideo();
    this.renderer.setAnimationLoop(null);
    if (this.video) {
      this.video.srcObject?.getTracks().forEach((track) => track.stop());
      this.video.pause();
      this.video.srcObject = null;
      this.video.removeEventListener('resize', this.resizeHandler);
      this.video.remove();
      this.video = null;
    }
    this.latestEstimate = null;
    this.anchors.forEach(({group}) => { group.visible = false; });
    this.faceMeshes.forEach((mesh) => { mesh.visible = false; });
    this.ui.hideLoading();
  }

  async dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    window.removeEventListener('resize', this.resizeHandler);
    await this.controller.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.cssRenderer.domElement.remove();
    this.ui.dispose();
  }

  async switchCamera() {
    this.shouldFaceUser = !this.shouldFaceUser;
    this.stop();
    await this.startPromise?.catch(() => {});
    return this.start();
  }

  addFaceMesh() {
    const faceGeometry = this.controller.createThreeFaceGeometry(THREE);
    const faceMesh = new Mesh(faceGeometry, new MeshStandardMaterial({ color: 0xffffff }));
    faceMesh.visible = false;
    faceMesh.frustumCulled = false;
    faceMesh.matrixAutoUpdate = false;
    this.faceMeshes.push(faceMesh);
    return faceMesh;
  }

  addAnchor(landmarkIndex) {
    const group = new Group();
    group.matrixAutoUpdate = false;
    const anchor = { group, landmarkIndex, css: false };
    this.anchors.push(anchor);
    this.scene.add(group);
    return anchor;
  }

  addCSSAnchor(landmarkIndex) {
    const group = new Group();
    group.matrixAutoUpdate = false;
    const anchor = { group, landmarkIndex, css: true };
    this.anchors.push(anchor);
    this.cssScene.add(group);
    return anchor;
  }

  getLatestEstimate() {
    return this.latestEstimate;
  }

  async _startVideo(token) {
    const video = document.createElement('video');
    this.video = video;
    video.setAttribute('autoplay', '');
    video.setAttribute('muted', '');
    video.muted = true;
    video.setAttribute('playsinline', '');
    video.style.position = 'absolute';
    video.style.top = '0px';
    video.style.left = '0px';
    video.style.zIndex = '-2';
    this.container.appendChild(video);

    if (!navigator.mediaDevices?.getUserMedia) {
      this.ui.showCompatibility();
      throw new DOMException('Camera API is unavailable', 'NotSupportedError');
    }

    const constraints = {
      audio: false,
      video: {}
    };
    if (this.shouldFaceUser) {
      if (this.userDeviceId) {
        constraints.video.deviceId = { exact: this.userDeviceId };
      } else {
        constraints.video.facingMode = 'user';
      }
    } else {
      if (this.environmentDeviceId) {
        constraints.video.deviceId = { exact: this.environmentDeviceId };
      } else {
        constraints.video.facingMode = 'environment';
      }
    }

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    if (token !== this.startToken || this.disposed) {
      stream.getTracks().forEach((track) => track.stop());
      this._assertStart(token);
    }
    video.srcObject = stream;
    await new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timeout);
        video.removeEventListener('loadedmetadata', ready);
        video.removeEventListener('error', failed);
        this.cancelVideoWait = null;
      };
      const ready = () => { cleanup(); resolve(); };
      const failed = () => { cleanup(); reject(new DOMException('Camera video could not load', 'NotReadableError')); };
      const timeout = setTimeout(failed, 30000);
      this.cancelVideoWait = () => { cleanup(); reject(new DOMException('Camera start was cancelled', 'AbortError')); };
      video.addEventListener('loadedmetadata', ready);
      video.addEventListener('error', failed);
      if (video.readyState >= 1) ready();
    });
    this._assertStart(token);
    await video.play();
    video.setAttribute('width', video.videoWidth);
    video.setAttribute('height', video.videoHeight);
    video.addEventListener('resize', this.resizeHandler);
  }

  async _startAR(token) {
    const video = this.video;
    const container = this.container;

    this.controller.onUpdate = ({ hasFace, estimateResult }) => {
      for (let i = 0; i < this.anchors.length; i++) {
        if (this.anchors[i].css) {
          this.anchors[i].group.children.forEach((obj) => {
            obj.element.style.visibility = hasFace ? "visible" : "hidden";
          });
        } else {
          this.anchors[i].group.visible = hasFace;
        }
      }
      for (let i = 0; i < this.faceMeshes.length; i++) {
        this.faceMeshes[i].visible = hasFace;
      }

      if (hasFace) {
        const { metricLandmarks, faceMatrix, faceScale, blendshapes} = estimateResult;
        this.latestEstimate = estimateResult;

        for (let i = 0; i < this.anchors.length; i++) {
          const landmarkIndex = this.anchors[i].landmarkIndex;
          const landmarkMatrix = this.controller.getLandmarkMatrix(landmarkIndex);

          if (this.anchors[i].css) {
            const cssScale = 0.001;

            const scaledElements = [
              cssScale * landmarkMatrix[0], cssScale * landmarkMatrix[1], landmarkMatrix[2], landmarkMatrix[3],
              cssScale * landmarkMatrix[4], cssScale * landmarkMatrix[5], landmarkMatrix[6], landmarkMatrix[7],
              cssScale * landmarkMatrix[8], cssScale * landmarkMatrix[9], landmarkMatrix[10], landmarkMatrix[11],
              cssScale * landmarkMatrix[12], cssScale * landmarkMatrix[13], landmarkMatrix[14], landmarkMatrix[15]
            ]
            this.anchors[i].group.matrix.set(...scaledElements);
          } else {
            this.anchors[i].group.matrix.set(...landmarkMatrix);
          }
        }
        for (let i = 0; i < this.faceMeshes.length; i++) {
          this.faceMeshes[i].matrix.set(...faceMatrix);
        }
      } else {
        this.latestEstimate = null;
      }
      this.onFaceUpdate?.({hasFace, estimateResult});
    }
    this._resize();

    const flipFace = this.shouldFaceUser && !this.disableFaceMirror;

    await this.controller.setup(flipFace);
    this._assertStart(token);
    await this.controller.dummyRun(video);
    this._assertStart(token);

    this._resize();
    this.controller.processVideo(video);
  }

  _resize() {
    const { renderer, cssRenderer, camera, container, video } = this;
    if (!video?.videoWidth || !video?.videoHeight || !container.clientWidth || !container.clientHeight) return;

    if (true) { // only needed if video dimension updated (e.g. when mobile orientation changes)
      this.video.setAttribute('width', this.video.videoWidth);
      this.video.setAttribute('height', this.video.videoHeight);
      this.controller.onInputResized(video);

      const { fov, aspect, near, far } = this.controller.getCameraParams();
      this.camera.fov = fov;
      this.camera.aspect = aspect;
      this.camera.near = near;
      this.camera.far = far;
      this.camera.updateProjectionMatrix();

      this.renderer.setSize(this.video.videoWidth, this.video.videoHeight);
      this.cssRenderer.setSize(this.video.videoWidth, this.video.videoHeight);
    }

    let vw, vh; // display css width, height
    const videoRatio = video.videoWidth / video.videoHeight;
    const containerRatio = container.clientWidth / container.clientHeight;
    if (videoRatio > containerRatio) {
      vh = container.clientHeight;
      vw = vh * videoRatio;
    } else {
      vw = container.clientWidth;
      vh = vw / videoRatio;
    }

    video.style.top = (-(vh - container.clientHeight) / 2) + "px";
    video.style.left = (-(vw - container.clientWidth) / 2) + "px";
    video.style.width = vw + "px";
    video.style.height = vh + "px";

    if (this.shouldFaceUser && !this.disableFaceMirror) {
      video.style.transform = 'scaleX(-1)';
    } else {
      video.style.transform = 'scaleX(1)';
    }

    const canvas = renderer.domElement;
    const cssCanvas = cssRenderer.domElement;

    canvas.style.position = 'absolute';
    canvas.style.top = video.style.top;
    canvas.style.left = video.style.left;
    canvas.style.width = video.style.width;
    canvas.style.height = video.style.height;

    cssCanvas.style.position = 'absolute';
    cssCanvas.style.top = video.style.top;
    cssCanvas.style.left = video.style.left;
    // cannot set style width for cssCanvas, because that is also used as renderer size
    //cssCanvas.style.width = video.style.width;
    //cssCanvas.style.height = video.style.height;
    cssCanvas.style.transformOrigin = "top left";
    cssCanvas.style.transform = 'scale(' + (vw / parseFloat(cssCanvas.style.width)) + ',' + (vh / parseFloat(cssCanvas.style.height)) + ')';
  }
}

if (!window.MINDAR) {
  window.MINDAR = {};
}
if (!window.MINDAR.FACE) {
  window.MINDAR.FACE = {};
}

window.MINDAR.FACE.MindARThree = MindARThree;
//window.MINDAR.FACE.THREE = THREE;
