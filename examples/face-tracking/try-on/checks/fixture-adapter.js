// Test mode only: actual video/WebGL/adapter/controller/estimator, simulated
// MediaPipe output. Never import this from the production application.
import {MindARThree as RealMindARThree} from '../../../../src/face-target/three.js';
import {FaceMeshHelper} from '../../../../src/face-target/face-mesh-helper.js';
import {positions} from '../../../../src/face-target/face-geometry/face-data.js';
import {opencv} from '../../../../src/libs/opencv-helper.js';

const fixture = window.__fixture = {face: true, cameraRequests: 0, modelLoads: 0, modelsClosed: 0, frames: 0, streams: [], failEffect: false, failModel: false, yaw: 0};
Object.assign(fixture, window.__fixtureConfig);
fixture.opencv = opencv;
const realGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
fixture.getUserMedia = realGetUserMedia;
navigator.mediaDevices.getUserMedia = async (constraints) => {
  fixture.cameraRequests++;
  fixture.constraints = constraints;
  const stream = await realGetUserMedia(constraints);
  fixture.streams.push(stream);
  if (fixture.cameraGate) await new Promise((resolve) => { fixture.releaseCamera = resolve; });
  return stream;
};
const getContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function (type, options) {
  if (fixture.failEffect && type === '2d' && [256, 1024].includes(this.width)) return null;
  return getContext.call(this, type, options);
};
FaceMeshHelper.prototype.init = async function () {
  fixture.modelLoads++;
  if (fixture.modelGate) await new Promise((resolve) => { fixture.releaseModel = resolve; });
  if (fixture.failModel) throw new Error('simulated model download failure');
  this.faceLandmarker = {close: () => { fixture.modelsClosed++; }};
};
FaceMeshHelper.prototype.detect = async function (input) {
  fixture.frames++;
  const hasFace = fixture.face;
  if (fixture.pauseNextDetect) {
    fixture.pauseNextDetect = false;
    await new Promise((resolve) => { fixture.releaseDetection = resolve; });
  }
  if (fixture.failInference) throw new Error('simulated inference failure');
  if (!hasFace) return {faceLandmarks: []};
  const width = input.width, height = input.height;
  const c = Math.cos(fixture.yaw), s = Math.sin(fixture.yaw);
  const landmarks = positions.map(([px, py, pz]) => {
    const x = px * c + pz * s, z = -px * s + pz * c;
    return {x: 0.5 + x / (50 - z), y: 0.5 - py * width / height / (50 - z), z: -z / 50};
  });
  return {faceLandmarks: [landmarks], faceBlendshapes: [{categories: []}]};
};
export class MindARThree extends RealMindARThree {
  constructor(options) { super(options); fixture.adapter = this; }
}
