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
