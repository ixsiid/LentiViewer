function Renderer(context, shader) {
    const renderCallback = [];
    let vertexCount = -1;

    this.transform = null;

    this.update = function () { }

    this.render = function (camera, lights = [], prerenderFunc = () => {}) {
        context.useProgram(shader.program);
        context.uniformMatrix4fv(
            shader.uniformLocations.uProjectionMatrix,
            false,
            camera);
        context.uniformMatrix4fv(
            shader.uniformLocations.uModelViewMatrix,
            false,
            this.transform);

        for(const cb of renderCallback) cb(camera, lights);

        prerenderFunc(context, shader);

        context.drawElements(context.TRIANGLES, vertexCount, context.UNSIGNED_SHORT, 0);

        Renderer.clearBuffer(context, shader);
    };

    this.addRenderCallback = callback => renderCallback.push(callback);
    this.setVertexCount = count => vertexCount = count;

    return this;
}

Object.defineProperty(Renderer, 'clearBuffer', {
    value: (context, shader) => {
        Object.values(shader.attribLocations).map(x => context.disableVertexAttribArray(x));
        [context.ELEMENT_ARRAY_BUFFER, context.ARRAY_BUFFER].map(x => context.bindBuffer(x, null));
        context.bindTexture(context.TEXTURE_2D, null);
    }
});

export default Renderer;
