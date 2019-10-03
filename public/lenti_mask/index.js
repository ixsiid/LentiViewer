import { quat, mat4, vec3 } from '../util/gl-matrix/src/index.js';
import PlaneFactory from './renderer/plane.js';

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

function Lenti(threeRenderer, { SlantAngleDegrees, ViewCount, DPL }, { Distance, AngleOfViewDegrees, Aspect, ViewingAngleDegrees }) {
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

	// キャリブレーション
	Object.defineProperty(this, 'calibration', {
		writable: false,
		configurable: false,
		enumerable: false,
		value: ({ SlantAngleDegrees, ViewCount, DPL }) => {
			lenti.count = ViewCount;
			lenti.frequency = 2 * Math.PI / DPL;
			lenti.deltaPhase = 2 * Math.PI / ViewCount;
			lenti.deltaY = lenti.frequency / Math.tan(SlantAngleDegrees / 180 * Math.PI);

			lenti.threshold = (x => {
				const cos = Math.cos(x);
				const sin = Math.sin(x);
				return sin / Math.sqrt(2 * (1 - cos));
			})(2 * Math.PI / (ViewCount - 1));

			this.refresh_stencil_buffer();
			this.camera(camera.parameter);
		}
	});

	// カメラ準備
	Object.defineProperty(this, 'camera', {
		writable: false,
		configurable: false,
		enumerable: false,
		value: ({ Distance, AngleOfViewDegrees, Aspect, ViewingAngleDegrees }) => {
			camera.parameter.Distance = Distance;
			camera.parameter.AngleOfViewDegrees = AngleOfViewDegrees;
			camera.parameter.Aspect = Aspect;
			camera.parameter.ViewingAngleDegrees = ViewingAngleDegrees;

			const viewAngleRadians = ViewingAngleDegrees / 180 * Math.PI;
			const dViewAngleRadians = viewAngleRadians / lenti.count;

			const k = -5;
			const y = 4;
			for (let i = 0; i < lenti.count; i++) {
				const rotate = viewAngleRadians / 2 - i * dViewAngleRadians;

//				const cm = new THREE.PerspectiveCamera(AngleOfViewDegrees, Aspect);
				const cm = new THREE.OrthographicCamera(-k, k, -k / Aspect + y, k / Aspect + y);
				cm.position.set(Distance * Math.sin(rotate), 0, Distance * Math.cos(rotate));
				cm.lookAt(new THREE.Vector3(0, 0, 0));

				camera.push(cm);
			}
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

			for (let i = 0; i < lenti.count; i++) {
				const index = i - 0.5 * (lenti.count - 1);

				gl.stencilFunc(gl.ALWAYS, i, ~0);
				gl.stencilOp(gl.KEEP, gl.REPLACE, gl.REPLACE);
				mask.render(mask_camera, [], (context, shader) => {
					context.uniform1f(shader.uniformLocations.uFrequency, lenti.frequency);
					context.uniform1f(shader.uniformLocations.uThreshold, lenti.threshold);
					context.uniform1f(shader.uniformLocations.uOffsetX, lenti.deltaPhase * index + Math.PI * lenti.frequency);
					context.uniform1f(shader.uniformLocations.uPhaseDeltaY, lenti.deltaY);
				});
			}

			gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
			gl.depthMask(true);
			gl.colorMask(true, true, true, true);
		}
	});

	// 初期化
	const camera = [];
	Object.defineProperty(camera, 'parameter', {
		writable: false,
		configurable: false,
		enumerable: false,
		value: { Distance, AngleOfViewDegrees, Aspect, ViewingAngleDegrees }
	});
	this.calibration({ SlantAngleDegrees, ViewCount, DPL });

	Object.defineProperty(this, 'render', {
		writable: false,
		configurable: false,
		enumerable: false,
		value: (scene) => {
			gl.enable(gl.STENCIL_TEST);
			for (let i = 0; i < lenti.count; i++) {
				gl.stencilFunc(gl.EQUAL, i, ~0);
				threeRenderer.render(scene, camera[i]);
			}

			gl.stencilFunc(gl.ALWAYS, 0, ~0);
		}
	});

	return this;
};

export default Lenti;
