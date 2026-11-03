<script lang="ts">
    // WebGL2 picture filters for one mixer source: chroma key, colour correction, 3D LUT.
    // Reads the first <video>/<img>/<canvas> inside `container` every frame and draws the filtered
    // picture on its own canvas (the original element is hidden by the parent while this runs).
    import { onDestroy, onMount } from "svelte"
    import type { MixerFx } from "../../../../types/Mixer"
    import { DEFAULT_FX, hasChroma, hasLut, hexToRgb, loadLut } from "../mixerFx"

    export let container: HTMLElement | null = null
    export let fx: MixerFx
    export let fit: "contain" | "cover" = "contain"
    /** WebGL2 not available: the parent falls back to CSS filters */
    export let failed = false

    let canvas: HTMLCanvasElement
    let gl: WebGL2RenderingContext | null = null
    let program: WebGLProgram | null = null
    let videoTexture: WebGLTexture | null = null
    let lutTexture: WebGLTexture | null = null
    let lutSize = 0
    let loadedLutPath = ""
    let frame = 0
    const uniforms: Record<string, WebGLUniformLocation | null> = {}

    const VERTEX = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
    v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
    gl_Position = vec4(a_pos, 0.0, 1.0);
}`

    const FRAGMENT = `#version 300 es
precision highp float;
precision highp sampler3D;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;
uniform sampler3D u_lut;
uniform bool u_chroma;
uniform vec3 u_key;
uniform float u_sim, u_smooth, u_spill;
uniform float u_bright, u_contrast, u_sat, u_gamma, u_hue, u_temp;
uniform bool u_useLut;
uniform float u_lutSize, u_lutAmt;

vec2 cbcr(vec3 c) { return vec2(-0.168736 * c.r - 0.331264 * c.g + 0.5 * c.b, 0.5 * c.r - 0.418688 * c.g - 0.081312 * c.b); }
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

void main() {
    vec4 src = texture(u_tex, v_uv);
    vec3 col = src.rgb;
    float a = src.a;

    if (u_chroma) {
        float d = distance(cbcr(col), cbcr(u_key));
        a *= smoothstep(u_sim, u_sim + u_smooth, d);
        // spill: pixels close to the key colour (edges, reflections) lose its colour cast
        float spillMask = 1.0 - smoothstep(u_sim, u_sim + u_smooth + 0.25, d);
        col = mix(col, vec3(luma(col)), clamp(spillMask * u_spill * 2.0, 0.0, 1.0));
    }

    col = (col + u_bright - 0.5) * u_contrast + 0.5;
    col = pow(max(col, 0.0), vec3(1.0 / u_gamma));
    col = mix(vec3(luma(col)), col, u_sat);

    if (u_hue != 0.0) {
        float h = radians(u_hue);
        float c = cos(h);
        float s = sin(h);
        col = vec3(
            dot(col, vec3(0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928)),
            dot(col, vec3(0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283)),
            dot(col, vec3(0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072))
        );
    }

    col.r += u_temp * 0.08;
    col.b -= u_temp * 0.08;
    col = clamp(col, 0.0, 1.0);

    if (u_useLut) {
        vec3 uvw = col * ((u_lutSize - 1.0) / u_lutSize) + 0.5 / u_lutSize;
        col = mix(col, texture(u_lut, uvw).rgb, u_lutAmt);
    }

    outColor = vec4(col * a, a); // premultiplied
}`

    function compile(type: number, source: string) {
        const shader = gl!.createShader(type)!
        gl!.shaderSource(shader, source)
        gl!.compileShader(shader)
        if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) throw new Error(gl!.getShaderInfoLog(shader) || "shader error")
        return shader
    }

    function setup() {
        gl = canvas.getContext("webgl2", { premultipliedAlpha: true, alpha: true, antialias: false })
        if (!gl) throw new Error("WebGL2 not available")

        program = gl.createProgram()!
        gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX))
        gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT))
        gl.linkProgram(program)
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || "link error")
        gl.useProgram(program)

        const buffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
        const loc = gl.getAttribLocation(program, "a_pos")
        gl.enableVertexAttribArray(loc)
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

        for (const name of ["u_tex", "u_lut", "u_chroma", "u_key", "u_sim", "u_smooth", "u_spill", "u_bright", "u_contrast", "u_sat", "u_gamma", "u_hue", "u_temp", "u_useLut", "u_lutSize", "u_lutAmt"]) {
            uniforms[name] = gl.getUniformLocation(program, name)
        }

        videoTexture = gl.createTexture()
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, videoTexture)
        for (const [k, v] of [
            [gl.TEXTURE_MIN_FILTER, gl.LINEAR],
            [gl.TEXTURE_MAG_FILTER, gl.LINEAR],
            [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE],
            [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]
        ])
            gl.texParameteri(gl.TEXTURE_2D, k, v)
        gl.uniform1i(uniforms.u_tex, 0)
        gl.uniform1i(uniforms.u_lut, 1)
    }

    async function updateLut(path: string) {
        if (!gl || path === loadedLutPath) return
        loadedLutPath = path
        lutSize = 0
        if (!path) return
        const lut = await loadLut(path)
        if (!lut || !gl || loadedLutPath !== path) return
        if (!lutTexture) lutTexture = gl.createTexture()
        gl.activeTexture(gl.TEXTURE1)
        gl.bindTexture(gl.TEXTURE_3D, lutTexture)
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
        gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, lut.size, lut.size, lut.size, 0, gl.RGBA, gl.UNSIGNED_BYTE, lut.data)
        for (const k of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_3D, k, gl.LINEAR)
        for (const k of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_3D, k, gl.CLAMP_TO_EDGE)
        gl.activeTexture(gl.TEXTURE0)
        lutSize = lut.size
    }
    $: if (gl) updateLut(hasLut(fx) ? fx.lut!.path : "")

    function findMedia(): HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | null {
        if (!container) return null
        const el = container.querySelector<HTMLVideoElement | HTMLImageElement | HTMLCanvasElement>("video, img, canvas:not(.mixerFx)")
        return el || null
    }

    function draw() {
        frame = requestAnimationFrame(draw)
        if (!gl || !program) return
        const media = findMedia()
        if (!media) return

        let w = 0
        let h = 0
        if (media instanceof HTMLVideoElement) {
            if (media.readyState < 2) return
            w = media.videoWidth
            h = media.videoHeight
        } else if (media instanceof HTMLImageElement) {
            if (!media.complete) return
            w = media.naturalWidth
            h = media.naturalHeight
        } else {
            w = media.width
            h = media.height
        }
        if (!w || !h) return
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w
            canvas.height = h
        }

        gl.viewport(0, 0, w, h)
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, videoTexture)
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
        try {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, media)
        } catch {
            return // tainted / not ready
        }

        const chroma = hasChroma(fx) ? fx.chroma! : null
        gl.uniform1i(uniforms.u_chroma, chroma ? 1 : 0)
        if (chroma) {
            gl.uniform3fv(uniforms.u_key, hexToRgb(chroma.color))
            gl.uniform1f(uniforms.u_sim, chroma.similarity * 0.5)
            gl.uniform1f(uniforms.u_smooth, Math.max(0.001, chroma.smoothness * 0.5))
            gl.uniform1f(uniforms.u_spill, chroma.spill)
        }
        gl.uniform1f(uniforms.u_bright, fx.brightness ?? DEFAULT_FX.brightness)
        gl.uniform1f(uniforms.u_contrast, fx.contrast ?? DEFAULT_FX.contrast)
        gl.uniform1f(uniforms.u_sat, fx.saturation ?? DEFAULT_FX.saturation)
        gl.uniform1f(uniforms.u_gamma, Math.max(0.1, fx.gamma ?? DEFAULT_FX.gamma))
        gl.uniform1f(uniforms.u_hue, fx.hue ?? DEFAULT_FX.hue)
        gl.uniform1f(uniforms.u_temp, fx.temperature ?? DEFAULT_FX.temperature)
        const useLut = lutSize > 0 && hasLut(fx)
        gl.uniform1i(uniforms.u_useLut, useLut ? 1 : 0)
        if (useLut) {
            gl.uniform1f(uniforms.u_lutSize, lutSize)
            gl.uniform1f(uniforms.u_lutAmt, fx.lut!.intensity ?? 1)
        }

        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }

    onMount(() => {
        try {
            setup()
            frame = requestAnimationFrame(draw)
        } catch (err) {
            console.warn("[Mixer] FX disabled:", err)
            failed = true
        }
    })

    onDestroy(() => {
        cancelAnimationFrame(frame)
        gl?.getExtension("WEBGL_lose_context")?.loseContext()
        gl = null
    })
</script>

<canvas class="mixerFx" class:cover={fit === "cover"} bind:this={canvas} />

<style>
    .mixerFx {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: contain;
        pointer-events: none;
        z-index: 1;
    }
    .mixerFx.cover {
        object-fit: cover;
    }
</style>
