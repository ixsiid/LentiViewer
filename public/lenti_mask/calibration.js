import { quat, mat4, vec3 } from '../util/gl-matrix/src/index.js';
import PlaneFactory from './renderer/plane.js';

import * as THREE from '../three.js/build/three.module.js';

const VERTEX_SHADER = `
attribute vec4 aVertexPosition;

void main(void) {
  gl_Position = aVertexPosition;
}
`;

const STENCIL_FRAGMENT_SHADER = `
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


const RENDER_FRAGMENT_SHADER = `
#define PI 3.1415926535897932384626433832795
uniform highp vec2 uResolution;
uniform highp float uCount;
uniform highp float uIndex;

void main(void) {
    highp vec2 center = uResolution / 2.0;
    highp vec2 p = center - gl_FragCoord.xy;
    highp float r = sqrt(p.x * p.x + p.y * p.y);
    highp float h = min(uResolution.x, uResolution.y) / 2.0;
    highp float r_min = h * 0.7;
    highp float r_max = h * 0.9;

    highp float v = step(r_min, r) - step(r_max, r);

    //
    highp vec2 q = vec2(cos(uIndex * 2.0 * PI), sin(uIndex * 2.0 * PI)) * r;
    highp vec2 dpq = p - q;
    highp float d = sqrt(dpq.x * dpq.x + dpq.y * dpq.y);

    highp float c = 1.0 - step(PI * 0.7 / uCount * h, d);

    highp vec3 color = vec3(c, c, c);


    gl_FragColor = vec4(color * v, 1.0);
}
`;

const COMPLEMENTARY_FRAGMENT_SHADER = `
#define PI 3.1415926535897932384626433832795
uniform highp vec2 uResolution;
uniform highp float uCount;
uniform highp float uIndex;

void main(void) {
    highp float a = step(0.0, uIndex);
    gl_FragColor = vec4(a, 1.0 - a, a, 1.0);
}
`;


function Calibration(gl) {
    gl.enable(gl.STENCIL_TEST);
    gl.clearStencil(255);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);

    const createShadersInfo = shaderSource => Object.keys(shaderSource).map(type => {
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

    const shaders = [
        createShadersInfo({ VERTEX_SHADER, FRAGMENT_SHADER: STENCIL_FRAGMENT_SHADER }),
        createShadersInfo({ VERTEX_SHADER, FRAGMENT_SHADER: RENDER_FRAGMENT_SHADER }),
        createShadersInfo({ VERTEX_SHADER, FRAGMENT_SHADER: COMPLEMENTARY_FRAGMENT_SHADER }),
    ].map((shadersInfo, i) => {

        const program = gl.createProgram();

        shadersInfo.map(shaderInfo => gl.attachShader(program, shaderInfo.shader));
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            Throw([
                `${i + 1}番目のシェーダープログラムを初期化できません。`,
                gl.getProgramInfoLog(program),
                ...shadersInfo.map(x => gl.getShaderInfoLog(x.shader)),
            ]);
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

        return { program, attribLocations, uniformLocations, };
    });

    const stencilShader = shaders[0];
    let renderShader = shaders[1];

    const lenti = {};

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
        }
    });

    Object.defineProperty(this, 'switch', {
        writable: false,
        configurable: false,
        enumerable: false,
        value: () => {
            renderShader = renderShader == shaders[1] ? shaders[0] : shaders[1];
            this.render();
        }
    });



    const camera = mat4.ortho([], -1, 1, -1, 1, -1, 1);

    // ステンシルバッファー作り
    Object.defineProperty(this, 'refresh_stencil_buffer', {
        writable: false,
        configurable: false,
        enumerable: false,
        value: () => {
            const mask = PlaneFactory(gl, stencilShader)
                .size(2.0, 2.0)
                .transform({ offset: [0.0, 0.0, 0.0], rotation: [0.0, 0.0, 0.0, 1.0], scale: [1.0, 1.0, 1.0] })
                .create();

            gl.depthMask(false);
            gl.colorMask(false, false, false, false);

            gl.useProgram(stencilShader.program);

            for (let i = 0; i < lenti.count; i++) {
                const index = i - 0.5 * (lenti.count - 1);

                gl.stencilFunc(gl.ALWAYS, i, ~0);
                gl.stencilOp(gl.KEEP, gl.REPLACE, gl.REPLACE);
                mask.render(camera, [], (context, shader) => {
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
        }
    });

    Object.defineProperty(this, 'render', {
        writable: false,
        configurable: false,
        enumerable: false,
        value: () => {
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

            gl.enable(gl.STENCIL_TEST);

            gl.useProgram(renderShader.program);
            const plane = PlaneFactory(gl, renderShader)
                .size(2.0, 2.0)
                .transform({ offset: [0.0, 0.0, 0.0], rotation: [0.0, 0.0, 0.0, 1.0], scale: [1.0, 1.0, 1.0] })
                .create();

            for (let i = 0; i < lenti.count; i++) {
                gl.stencilFunc(gl.EQUAL, i, ~0);

                // ここをキャリブレーションシェーダー用にかきかえる
                const index = ((i + 0.5) / lenti.count) - 0.5;

                plane.render(camera, [], (context, shader) => {
                    context.uniform2fv(shader.uniformLocations.uResolution,
                        [gl.drawingBufferWidth, gl.drawingBufferHeight]);
                    context.uniform1f(shader.uniformLocations.uCount, lenti.count);
                    context.uniform1f(shader.uniformLocations.uIndex, index);
                });
            }

            gl.stencilFunc(gl.ALWAYS, 0, ~0);
        }
    });

    return this;
};

export default Calibration;
