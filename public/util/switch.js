const Switch = (value, caseValue, defaultValue, error) => {
    if (value in caseValue) return caseValue[value]();
    if (defaultValue !== null) return defaultValue;
    Throw(error);
};

const Throw = (arg1, arg2) => {
    if (typeof(arg1) === 'boolean') {
        if (!arg1) return;
        arg1 = arg2;
    }

    if (arg1 instanceof Array) {
        throw Error(arg1.join('\n'));
    }
    throw Error(arg1);
};
