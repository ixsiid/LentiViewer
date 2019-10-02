import PolygonFactory from './polygon.js';

function PlaneFactory(context, shader) {
    const factory = PolygonFactory(context, shader);

    Object.defineProperty(factory, 'size', {
        value: (x, y) => {
            const cx = x / 2;
            const cy = y / 2;
            factory.vertex([[cx, -cy, 0], [cx, cy, 0], [-cx, cy, 0], [-cx, -cy, 0]], [[0, 1, 2], [0, 2, 3]]);
            factory._surface = true;
            return factory;
        }
    });

    return factory;
}

export default PlaneFactory;
