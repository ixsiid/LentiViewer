import { quat, mat4, vec3 } from '../util/gl-matrix/src/index.js';
import PlaneFactory from './renderer/plane.js';

import * as THREE from '../three.js/build/three.module.js';

const VERTEX_SHADER = `
attribute vec4 aVertexPosition;

void main(void) {
  gl_Position = aVertexPosition;
}
`;

const FRAGMENT_SHADER = `
uniform highp float uFrequency;
uniform highp float uOffsetX;
uniform highp float uPhaseDeltaY;
uniform highp float uThreshold;

void main(void) {
    highp float a = step(uThreshold,
        cos(gl_FragCoord.x * uFrequency + uOffsetX + gl_FragCoord.y * uPhaseDeltaY));
    if (a < 0.5) discard;
    gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
}
`;

function Lenti(THREE, threeRenderer,
	{ SlantAngleDegrees, ViewCount, DPL, Offset, AngleOfViewDegrees },
	{ Width, Aspect, ViewingAngleDegrees },
	{ Point, Distance, Elevation, Around }, Vertical = 0) {
	const gl = threeRenderer.getContext();
	gl.enable(gl.STENCIL_TEST);
	gl.clearStencil(255);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);

	const shaderSource = { VERTEX_SHADER, FRAGMENT_SHADER };

	const shadersInfo = Object.keys(shaderSource).map(type => {
		const source = shaderSource[type];
		const shader = gl.createShader(gl[type]);
		gl.shaderSource(shader, source);
		gl.compileShader(shader);

		const attributes = source.split('\n')
			.filter(x => x.indexOf('attribute ') == 0)
			.map(x => x.split(' ').pop().split(';')[0]);

		const uniforms = source.split('\n')
			.filter(x => x.indexOf('uniform ') == 0)
			.map(x => x.split(' ').pop().split(';')[0]);

		return { shader, attributes, uniforms };
	});

	const program = gl.createProgram();

	shadersInfo.map(shaderInfo => gl.attachShader(program, shaderInfo.shader));
	gl.linkProgram(program);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		Throw(`レンチマスクシェーダープログラムを初期化できません。`);
	}

	gl.useProgram(program);
	const attribLocations = {};
	const uniformLocations = {};
	shadersInfo.map(shaderInfo => {
		shaderInfo.attributes.map(x => {
			const attribute = gl.getAttribLocation(program, x);
			attribLocations[x] = attribute;
		});
		shaderInfo.uniforms.map(x => {
			const uniform = gl.getUniformLocation(program, x);
			uniformLocations[x] = uniform;
		});
	});

	const shader = { program, attribLocations, uniformLocations, };

	const lenti = {};

	// コールバック関数
	// バッファクリア前に呼ばれる関数
	// このコールバックでレンダリング処理をしてはならない
	Object.defineProperty(this, 'preMessage', {
		writable: false,
		configurable: false,
		enumerable: false,
		value: []
	});

	// レンダリング解放処理後に呼ばれる関数
	// このコールバックでレンダリング処理をしてはならない
	Object.defineProperty(this, 'postMessage', {
		writable: false,
		configurable: false,
		enumerable: false,
		value: []
	});

	// キャリブレーション
	Object.defineProperty(this, 'calibration', {
		writable: false,
		configurable: false,
		enumerable: false,
		value: ({ SlantAngleDegrees, ViewCount, DPL, Offset }) => {
			lenti.count = ViewCount;
			lenti.frequency = 2 * Math.PI / DPL;
			lenti.deltaPhase = 2 * Math.PI / ViewCount;
			lenti.deltaY = lenti.frequency / Math.tan(SlantAngleDegrees / 180 * Math.PI);
			lenti.offset = 2 * Math.PI * Offset;

			lenti.threshold = (x => {
				const cos = Math.cos(x);
				const sin = Math.sin(x);
				return sin / Math.sqrt(2 * (1 - cos));
			})(2 * Math.PI / (ViewCount - 1));

			this.refresh_stencil_buffer();
			if (cameraArray.length == 0) this.camera(view, camera);
		}
	});

	// カメラ準備
	Object.defineProperty(this, 'camera', {
		writable: false,
		configurable: false,
		enumerable: false,
		value: ({ Width, Aspect, ViewingAngleDegrees }, { Point, Distance, Elevation, Around }) => {
			view.Width = Width;
			view.Aspect = Aspect;
			view.ViewingAngleDegrees = ViewingAngleDegrees;

			camera.Point = Point;
			camera.Distance = Distance;
			camera.Elevation = Elevation;
			camera.Around = Around;

			const rot = new THREE.Matrix4().makeRotationZ(Vertical * -Math.PI / 2);

			for (let i = 0; i < lenti.count; i++) {
				cameraArray.push(new THREE.PerspectiveCamera(AngleOfViewDegrees, Aspect));
				// cameraArray.push(new THREE.OrthographicCamera(-k, k, k / Aspect, -k / Aspect));

				cameraArray[i].projectionMatrix.multiply(rot);
			}

			this._camera_position(ViewingAngleDegrees, Point, Elevation, Around);
		}
	});


	// ステンシルバッファー作り
	Object.defineProperty(this, 'refresh_stencil_buffer', {
		writable: false,
		configurable: false,
		enumerable: false,
		value: () => {
			const mask = PlaneFactory(gl, shader)
				.size(2.0, 2.0)
				.transform({ offset: [0.0, 0.0, 0.0], rotation: [0.0, 0.0, 0.0, 1.0], scale: [1.0, 1.0, 1.0] })
				.create();

			const mask_camera = mat4.ortho([], -1, 1, -1, 1, -1, 1);

			gl.depthMask(false);
			gl.colorMask(false, false, false, false);

			gl.useProgram(shader.program);

			for (let i = 0; i < lenti.count; i++) {
				const index = i - 0.5 * (lenti.count - 1);

				gl.stencilFunc(gl.ALWAYS, i, ~0);
				gl.stencilOp(gl.KEEP, gl.REPLACE, gl.REPLACE);
				mask.render(mask_camera, [], (context, shader) => {
					context.uniform1f(shader.uniformLocations.uFrequency, lenti.frequency);
					context.uniform1f(shader.uniformLocations.uThreshold, lenti.threshold);
					context.uniform1f(shader.uniformLocations.uOffsetX,
						lenti.deltaPhase * index +
						lenti.offset);
					context.uniform1f(shader.uniformLocations.uPhaseDeltaY, lenti.deltaY);
				});
			}

			gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
			gl.depthMask(true);
			gl.colorMask(true, true, true, true);

			gl.useProgram(latestShader);
		}
	});

	// 初期化
	const view = { Width, Aspect, ViewingAngleDegrees };
	const camera = { Point, Distance, Elevation, Around };
	const cameraArray = [];

	Object.defineProperty(this, 'render', {
		writable: false,
		configurable: false,
		enumerable: false,
		value: (scene, clear, mask) => {
			this.preMessage.map(x => x());

			if (clear instanceof Array) threeRenderer.clear(...clear);

			gl.enable(gl.STENCIL_TEST);
			for (let i = 0; i < lenti.count; i++) {
				if (mask instanceof Array) if (mask.indexOf(i) < 0) continue;
				if (typeof mask === 'function') if (!mask(i, lenti.count)) continue;
				gl.stencilFunc(gl.EQUAL, i, ~0);
				threeRenderer.render(scene, cameraArray[i]);
			}

			gl.stencilFunc(gl.ALWAYS, 0, ~0);

			this.postMessage.map(x => x());
		}
	});

	Object.defineProperty(this, '_camera_position', {
		writable: false,
		configurable: false,
		enumerable: false,
		value: (ViewingAngleDegrees, Point, Elevation, Around) => {
			const viewAngleRadians = ViewingAngleDegrees / 180 * Math.PI;
			const dViewAngleRadians = viewAngleRadians / cameraArray.length;

			const k = view.Width / 2;
			const distance = k / Math.tan(AngleOfViewDegrees / 180 * Math.PI / 2);
			const distance_xy = distance * Math.cos(Elevation / 180 * Math.PI);

			const polar = {
				cos: Math.cos(Elevation / 180 * Math.PI),
				sin: Math.sin(Elevation / 180 * Math.PI),
			};

			const around = {
				cos: Math.cos(Around / 180 * Math.PI),
				sin: Math.sin(Around / 180 * Math.PI),
			};

			const up = [
				Point.x,
				Point.y + distance * polar.cos,
				Point.z - distance * polar.sin
			];

			for (let i = 0; i < cameraArray.length; i++) {
				const rotate = viewAngleRadians / 2 - i * dViewAngleRadians;
				//const k = Vertical % 2 == 1 ? -1 : 1;
				const k = SlantAngleDegrees < 0 ? -1 : 1;

				const rot = {
					cos: Math.cos(k * rotate),
					sin: Math.sin(k * rotate)
				};


				//cameraArray[i].position.set(
				//	distance_xy * Math.sin(rotate + Around / 180 * Math.PI) + Point.x,
				//	distance * Math.sin(Elevation / 180 * Math.PI) + Point.y,
				//	distance_xy * Math.cos(rotate + Around / 180 * Math.PI) + Point.z);

				// https://ja.wikipedia.org/wiki/%E5%9B%9E%E8%BB%A2%E8%A1%8C%E5%88%97
				// Ry(rotate) * Rx * Ry(center)

				/*
				const pos = [
					Point.x - distance * (rot.sin * around.cos + rot.cos * polar.cos * around.sin),
					Point.y + distance * rot.cos * polar.sin,
					Point.z - distance * (rot.sin * around.sin - rot.cos * polar.cos * around.cos)
				];
				/**/

				const pos = [
					Point.x - distance * (around.sin * rot.cos + around.cos * polar.cos * rot.sin),
					Point.y + distance * around.cos * polar.sin,
					Point.z - distance * (around.sin * rot.sin - around.cos * polar.cos * rot.cos)
				];

				cameraArray[i].position.set(...pos);
				cameraArray[i].up.set(...up);

				/*
				const cm = new THREE.OrthographicCamera(-k, k, k / Aspect, -k / Aspect);
				cm.position.set(
					Distance * Math.sin(rotate) + Point.x,
					Distance * Math.sin(Elevation / 180 * Math.PI) + Point.y,
					Distance * Math.cos(rotate) + Point.z);
					*/
				cameraArray[i].lookAt(Point);
			}
		}
	});

	Object.defineProperty(this, 'addAround', {
		writable: false,
		configurable: false,
		enumerable: false,
		value: (deltaDegrees) => {
			camera.Around = (camera.Around + deltaDegrees) % 360;
			if (camera.Around > 180) camera.Around -= 360;
			else if (camera.Around < -180) camera.Around += 360;
			this._camera_position(view.ViewingAngleDegrees, camera.Point, camera.Elevation, camera.Around);
		}
	});

	Object.defineProperty(this, 'addElevation', {
		writable: false,
		configurable: false,
		enumerable: false,
		value: (deltaDegrees) => {
			camera.Elevation += deltaDegrees;
			if (camera.Elevation > 90) camera.Elevation = 90;
			else if (camera.Elevation < -90) camera.Elevation = -90;

			this._camera_position(view.ViewingAngleDegrees, camera.Point, camera.Elevation, camera.Around);
		}
	});

	Object.defineProperty(this, 'around', {
		writable: false,
		configurable: false,
		enumerable: false,
		value: (degrees) => {
			camera.Around = degrees % 360;
			if (camera.Around > 180) camera.Around -= 360;
			else if (camera.Around < -180) camera.Around += 360;
			this._camera_position(view.ViewingAngleDegrees, camera.Point, camera.Elevation, camera.Around);
		}
	});

	Object.defineProperty(this, 'elevation', {
		writable: false,
		configurable: false,
		enumerable: false,
		value: (degrees) => {
			camera.Elevation = degrees;
			if (camera.Elevation > 90) camera.Elevation = 90;
			else if (camera.Elevation < -90) camera.Elevation = -90;
			this._camera_position(view.ViewingAngleDegrees, camera.Point, camera.Elevation, camera.Around);
		}
	});

	let latestShader = undefined;
	const useProgram = gl.useProgram;
	gl.useProgram = program => {
		if (shader.program !== program) latestShader = program;
		useProgram.call(gl, program);
	};

	this.calibration({ SlantAngleDegrees, ViewCount, DPL, Offset });

	return this;
};



export default Lenti;
export { default as Calibration } from './calibration.js';
