function assignWithoutOverride(defaultValue, overrideValue) {
    for (const ok of Object.keys(overrideValue)) {
        if (typeof overrideValue[ok] === 'object') {
            assignWithoutOverride(defaultValue[ok], overrideValue[ok]);
        }
    }
    return Object.assign(overrideValue, defaultValue, {...overrideValue});
}

async function read(url) {
    return await fetch(url)
        .then(res => res.json())
        .then(json => {
            for (const k of Object.keys(json)) {
                if ('prototype' in json[k]) {
                    assignWithoutOverride(json[json[k].prototype], json[k]);
                    delete json[k].prototype;
                }
            }
            return json;
        });
}

export default Object.assign(() => {
    console.log('Help message');
}, { read });
