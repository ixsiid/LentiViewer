import Renderer from './renderer.js';
import { vec2, vec3, mat4, quat } from '../../util/gl-matrix/src/index.js';

const PolygonFactory = function (context, shader) {
    const factory = Object.defineProperties({}, {
        _vertex: { writable: true, value: false },
        _surface: { writable: true, value: false },
        object: { value: new Renderer(context, shader) },
        parameter: { value: {} },
    });

    context.useProgram(shader.program);
    Object.defineProperty(factory, 'vertex', {
        configurable: true,
        value: function (vertices, indices) {
            console.assert(factory._vertex === false, '頂点情報は定義済みです');
            const self = factory.object;
            // vertex
            const vertex = new Float32Array(vertices.reduce((a, b) => a.concat(b), []));

            const vertexBuffer = context.createBuffer();
            context.bindBuffer(context.ARRAY_BUFFER, vertexBuffer);
            context.vertexAttribPointer(
                shader.attribLocations.aVertexPosition,
                3, context.FLOAT, false, 0, 0);
            context.enableVertexAttribArray(
                shader.attribLocations.aVertexPosition);
            context.bufferData(context.ARRAY_BUFFER, vertex, context.STATIC_DRAW);

            factory.object.addRenderCallback(() => {
                context.bindBuffer(context.ARRAY_BUFFER, vertexBuffer);
                context.vertexAttribPointer(shader.attribLocations.aVertexPosition,
                    3, context.FLOAT, false, 0, 0);
                context.enableVertexAttribArray(shader.attribLocations.aVertexPosition);
            });


            // index
            const index = new Uint16Array(indices.reduce((a, b) => a.concat(b), []));
            const indexBuffer = context.createBuffer();
            context.bindBuffer(context.ELEMENT_ARRAY_BUFFER, indexBuffer);
            context.bufferData(context.ELEMENT_ARRAY_BUFFER, index, context.STATIC_DRAW);

            factory.object.addRenderCallback(() => context.bindBuffer(context.ELEMENT_ARRAY_BUFFER, indexBuffer));
            factory.object.setVertexCount(index.length);
            factory._vertex = true;
            return factory;
        }
    });

    Object.defineProperty(factory, 'color', {
        value: function (colors) {
            console.assert(factory._surface === false, '面情報は定義済みです');

            const color = colors.reduce((a, b) => a.concat(b), []);

            const colorBuffer = context.createBuffer();
            context.bindBuffer(context.ARRAY_BUFFER, colorBuffer);
            context.bufferData(context.ARRAY_BUFFER, new Float32Array(color), context.STATIC_DRAW);

            factory.object.addRenderCallback(() => {
                context.bindBuffer(context.ARRAY_BUFFER, colorBuffer);
                context.vertexAttribPointer(shader.attribLocations.aVertexColor,
                    4, context.FLOAT, false, 0, 0);
                context.enableVertexAttribArray(shader.attribLocations.aVertexColor);
            });

            factory._surface = true;
            return factory;
        }
    });

    Object.defineProperty(factory, 'transform', {
        value: function (transform) {
            factory.object.transform = mat4.fromRotationTranslationScale(
                mat4.create(),
                transform.rotation,
                transform.offset,
                transform.scale);
            return factory;
        }
    });

    Object.defineProperty(factory, 'create', {
        value: function () {
            console.assert(factory._vertex === true, '頂点情報が定義されていません');
            console.assert(factory._surface === true, '面情報が定義されていません');

            Renderer.clearBuffer(context, shader);

            factory.object.transform = factory.object.transform || mat4.fromRotationTranslationScale(
                mat4.create(),
                [0.0, 0.0, 0.0, 1.0],
                [0.0, 0.0, 0.0],
                [1.0, 1.0, 1.0]);

            delete factory.object.setVertexCount;

            return factory.object;
        }
    });

    return factory;
};


export default PolygonFactory;
