import { mediaRequirements, preflightScript } from "./media-preflight";
import { springSamples } from "./spring";
import type {
  PairedScene,
  PairedTimeline,
  PairedVideoSpec,
} from "./videospec-contract";

/**
 * HyperFrames realisation of a paired VideoSpec. Geometry, palettes, fonts,
 * springs and easing follow remotion-templates src/Video.tsx at the pinned
 * commit, so the two frameworks render the same document alike.
 */
// Stays on 0.8.143. HyperFrames 0.9.19 was tried on 10 November 2026 and
// not adopted: its capture-to-video colour filter lowers the 1:1 video window
// score below the parity floor and no render flag restores it. Evidence:
// reports/experiments/template-aesthetics-20261110/README.md.
export const HYPERFRAMES_RUNTIME = { hyperframes: "0.8.143", gsap: "3.14.2" };
// The exact files @remotion/google-fonts 4.0.502 loads for the weights used.
const LATIN_RANGE =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
export const PAIRED_FONTS = [
  {
    family: "Fraunces",
    file: "Fraunces.woff2",
    url: "https://fonts.gstatic.com/s/fraunces/v38/6NUu8FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk_WBq8U_9v0c2Wa0K7iN7hzFUPJH58nib14c7qv8.woff2",
    sha256: "7f9d191d999336d3b9790afa72e1358e50a13b06d4f289341e92a311967a80f9",
  },
  {
    family: "Inter",
    file: "Inter.woff2",
    url: "https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2",
    sha256: "3100e775e8616cd2611beecfa23a4263d7037586789b43f035236a2e6fbd4c62",
  },
] as const;

/**
 * Look factors under test (10 November 2026). Each is one switch with one
 * owner in this file, so its effect can be rendered alone, with the others,
 * and with it alone removed. With every switch off the output is byte for
 * byte what it was before the switches existed. Record:
 * reports/experiments/template-aesthetics-20261110/README.md.
 */
export type PairedLook = {
  /** Reading text sized for a phone: supporting roles grow, display stays. */
  scale: boolean;
  /** One composition scale per aspect, so taller frames are used, not left empty. */
  fill: boolean;
  /** Type on the canvas with rules and numerals instead of web-style cards. */
  surface: boolean;
  /** Tonal wash, grain and a soft shape that moves from scene to scene. */
  background: boolean;
  /** A different entrance for each role instead of one rise for everything. */
  motion: boolean;
  /** Content leaves before the cut. */
  transition: boolean;
};
export const NO_LOOK: PairedLook = {
  scale: false,
  fill: false,
  surface: false,
  background: false,
  motion: false,
  transition: false,
};
// Under the fill scale a headline's fit width is the full width divided by
// the scale raised to this exponent. 1 keeps today's size, 0 wrapped one word
// to a line at 9:16; 0.5 was the smallest value with no single-word line
// (decided 10 November 2026, round 2 of the look experiment).
const FIT_EXPONENT = 0.5;
/**
 * The look both engines draw (decided 10 November 2026): scale, fill and
 * surface. remotion-templates carries the same values from the pinned commit
 * on. The other switches stay off and exist only in this engine.
 */
export const DEFAULT_LOOK: PairedLook = {
  ...NO_LOOK,
  scale: true,
  fill: true,
  surface: true,
};
/**
 * Composition scale that keeps the layout area about equal across aspects.
 * Chosen so the layout box has whole-pixel sides (4/3 at 9:16 gives 810 by
 * 1440; 9/8 at 4:5 gives 960 by 1200): a fractional box put the two engines
 * a pixel apart in the first paired render (10 November 2026).
 */
export const fillScale = (width: number, height: number) =>
  height * 9 === width * 16 ? 4 / 3 : height * 4 === width * 5 ? 9 / 8 : 1;

type Palette = {
  background: string;
  surface: string;
  ink: string;
  muted: string;
  accent: string;
  accentSoft: string;
  signal: string;
};
const palettes: Record<
  "editorial-light" | "editorial-dark" | "clinical",
  Palette
> = {
  "editorial-light": {
    background: "#f4efe5",
    surface: "#fffaf0",
    ink: "#18241f",
    muted: "#667169",
    accent: "#2f6d5a",
    accentSoft: "#cfe0d5",
    signal: "#c96f58",
  },
  "editorial-dark": {
    background: "#171c1a",
    surface: "#222a27",
    ink: "#f5efe3",
    muted: "#abb7ae",
    accent: "#a8cfb8",
    accentSoft: "#30483e",
    signal: "#ec967d",
  },
  clinical: {
    background: "#f2f1e9",
    surface: "#fbfaf5",
    ink: "#14283a",
    muted: "#60727c",
    accent: "#3d796d",
    accentSoft: "#d6e5df",
    signal: "#d2705d",
  },
};

export function paletteFor(spec: PairedVideoSpec): Palette {
  if (spec.style.theme !== "default") return palettes[spec.style.theme];
  return spec.templateFamily === "announcement-brief"
    ? palettes["editorial-light"]
    : palettes["editorial-dark"];
}

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[character]!)
  );
const str = (value: unknown) => (typeof value === "string" ? value : "");
const div = (className: string, value: string, attributes = "") =>
  `<div class="${className}"${attributes}>${escapeHtml(value)}</div>`;

function sceneCss(
  palette: Palette,
  look: PairedLook,
  k: number,
  width: number,
  height: number
): string {
  const p = palette;
  const fonts = PAIRED_FONTS.map(
    (font) =>
      `@font-face{font-family:${font.family};src:url(${font.file}) format('woff2');font-weight:100 900;font-style:normal;unicode-range:${LATIN_RANGE}}`
  ).join("");
  return `${fonts}
*{box-sizing:border-box}
.fill{position:absolute;top:0;left:0;right:0;bottom:0;width:100%;height:100%;display:flex;flex-direction:column}
.background{background:${p.background}}
.orb{position:absolute;width:760px;height:760px;border-radius:50%;background:${
    p.accentSoft
  };opacity:.42;right:-280px;top:-300px}
.ring{position:absolute;width:420px;height:420px;border-radius:50%;border:2px solid ${
    p.accent
  };opacity:.16;left:-220px;bottom:80px}
.layout{justify-content:center;padding:11% 9%}
.layout.hero{justify-content:space-between}
.layout.mechanism,.layout.points,.layout.equation{padding:10% 8.5%}
.layout.video-window{padding:8%}
.title{color:${p.ink};font-family:Fraunces;font-weight:600}
.subtitle{color:${p.muted};font-family:Inter}
.label{color:${
    p.muted
  };font-family:Inter;font-size:26px;font-weight:600;letter-spacing:.2px;margin-bottom:32px}
.accent-bar{width:116px;height:12px;border-radius:12px;background:${
    p.accent
  };transform-origin:left}
.hero-title{line-height:.98;letter-spacing:-2.6px;max-width:94%}
.hero-sub{font-size:38px;line-height:1.35;margin-top:44px;max-width:82%}
.footer{color:${p.accent};font-family:Inter;font-size:25px;font-weight:600}
.statement-card{width:88%;padding:70px 64px;border-radius:44px;background:${
    p.surface
  };box-shadow:0 32px 90px rgba(20,40,58,.10)}
.statement-title{font-size:88px;line-height:1.02}
.statement-sub{font-size:34px;line-height:1.4;margin-top:34px}
.mechanism-title{font-size:88px;line-height:1;letter-spacing:-1.5px}
.mechanism-sub{font-size:32px;line-height:1.35;margin-top:24px}
.states{display:grid;grid-template-columns:1fr 112px 1fr;align-items:center;gap:20px;margin-top:84px}
.state-card{height:520px;border-radius:220px;background:${
    p.surface
  };box-shadow:0 28px 70px rgba(20,40,58,.10);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:28px}
.capsule{width:180px;height:290px;border-radius:90px;border:18px solid ${
    p.accent
  };opacity:.9}
.capsule.before{border-color:${p.signal}}
.state-label{color:${
    p.ink
  };font-family:Inter;font-size:29px;font-weight:600;margin-top:34px;text-align:center}
.arrow{color:${p.accent};font-family:Inter;font-size:64px;text-align:center}
.points-head{max-width:860px}
.points-title{line-height:1.02;letter-spacing:-1.7px}
.points-sub{font-size:32px;line-height:1.4;margin-top:24px}
.point-list{display:grid;gap:22px;margin-top:70px}
.point{display:grid;grid-template-columns:70px 1fr;align-items:center;gap:28px;background:${
    p.surface
  };border-radius:28px;padding:30px 34px;box-shadow:0 18px 52px rgba(20,40,58,.07)}
.number{width:58px;height:58px;border-radius:50%;background:${
    p.accentSoft
  };color:${
    p.accent
  };display:flex;align-items:center;justify-content:center;font-family:Inter;font-size:27px;font-weight:700}
.point-text{color:${
    p.ink
  };font-family:Inter;font-size:35px;font-weight:500;line-height:1.25}
.check{width:124px;height:124px;border-radius:50%;background:${
    p.accent
  };color:${
    p.background
  };font-family:Inter;font-size:58px;display:flex;align-items:center;justify-content:center;margin-bottom:58px}
.cta-title{font-size:104px;line-height:.98;letter-spacing:-2px}
.cta-sub{font-size:34px;line-height:1.4;margin-top:38px}
.equation-title{font-size:84px;line-height:1.02}
.equations{display:grid;gap:24px;margin-top:58px}
.equation-block{color:${p.ink};background:${
    p.surface
  };font-size:40px;padding:30px;border-radius:24px}
.window-title{font-size:72px;line-height:1.04;margin-bottom:42px}
.window{position:relative;height:66%;overflow:hidden;border-radius:36px;background:${
    p.surface
  };box-shadow:0 28px 80px rgba(20,40,58,.14)}
.window video{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover}
.scene-label{position:absolute;left:54px;bottom:40px;color:${
    p.muted
  };font-family:Inter;font-size:18px}${lookCss(p, look, k, width, height)}`;
}

// Overrides only. Each block changes the properties its factor owns:
// scale -> supporting font sizes; fill -> the layout box transform;
// surface -> card, rule and numeral treatment; background -> the backdrop.
function lookCss(
  p: Palette,
  look: PairedLook,
  k: number,
  width: number,
  height: number
): string {
  let css = "";
  if (look.scale)
    css += `
.hero-sub{font-size:46px}
.statement-sub,.cta-sub{font-size:42px}
.mechanism-sub,.points-sub{font-size:40px}
.point-text{font-size:42px}
.label,.footer{font-size:32px}
.state-label{font-size:36px}`;
  if (look.fill && k !== 1)
    css += `
.fill-box{position:absolute;top:0;left:0;width:${width / k}px;height:${
      height / k
    }px;transform:scale(${k});transform-origin:0 0}`;
  if (look.surface)
    css += `
.statement-card{width:100%;padding:8px 0 8px 52px;border-radius:0;background:none;box-shadow:none;border-left:12px solid ${p.accent}}
.statement-title{font-size:108px;line-height:1;letter-spacing:-2px}
.point-list{gap:0;margin-top:58px;border-bottom:2px solid ${p.muted}55}
.point{background:none;box-shadow:none;border-radius:0;padding:30px 0;border-top:2px solid ${p.muted}55;grid-template-columns:84px 1fr;gap:20px;align-items:baseline}
.number{width:auto;height:auto;border-radius:0;background:none;justify-content:flex-start;font-family:Fraunces;font-size:64px;font-weight:600;line-height:1}`;
  if (look.background)
    css += `
.background{background:linear-gradient(158deg,color-mix(in srgb,${p.background} 90%,${p.accentSoft}) 0%,${p.background} 46%,color-mix(in srgb,${p.background} 93%,${p.ink}) 100%)}
.orb{width:1100px;height:1100px;opacity:.5;background:radial-gradient(closest-side,${p.accentSoft} 0%,${p.accentSoft}00 100%);right:-420px;top:-420px}
.ring{display:none}
.bg-v1 .orb{right:auto;left:-460px;top:auto;bottom:-380px}
.bg-v2 .orb{right:-520px;top:30%}
.bg-v3 .orb{right:auto;left:-420px;top:-360px}
.grain{position:absolute;inset:0;opacity:.07;mix-blend-mode:overlay;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' seed='7'/><feColorMatrix values='0 0 0 0 .5 0 0 0 0 .5 0 0 0 0 .5 0 0 0 1.4 -.2'/></filter><rect width='240' height='240' filter='url(%23n)'/></svg>")}`;
  return css;
}

function title(content: Record<string, unknown>, className: string, fit = "") {
  return div(
    `title ${className}`,
    str(content.title) || str(content.line1),
    fit
  );
}
function subtitle(content: Record<string, unknown>, className: string) {
  const value = str(content.subtitle) || str(content.line2);
  return value ? div(`subtitle ${className}`, value) : "";
}
function pointsSubtitle(content: Record<string, unknown>) {
  const value = str(content.subtitle);
  return value ? div("subtitle points-sub", value) : "";
}
function label(content: Record<string, unknown>) {
  const value = str(content.label);
  return value ? div("label", value) : "";
}

function sceneBody(
  scene: PairedScene,
  id: string,
  seconds: number,
  look: PairedLook,
  k: number
): string {
  // Headline fitting assumes the full-width layout. Under the fill scale the
  // layout box is narrower by k, so the fit width shrinks with it; otherwise
  // a headline wraps one word to a line (first render, 10 November 2026).
  const fit = (width: number, cap: number) =>
    ` data-fit="${
      k === 1 ? width : Math.round((width / k ** FIT_EXPONENT) * 10) / 10
    },${cap}"`;
  const c = scene.content;
  switch (scene.kind) {
    case "hero":
      if (look.motion)
        return `<div class="accent-bar" data-motion="bar"></div><div><div data-motion="rise" data-rise="42">${title(
          c,
          "hero-title",
          fit(885.6, 126)
        )}</div><div data-motion="rise" data-rise="18" data-delay="5">${subtitle(
          c,
          "hero-sub"
        )}</div></div><div data-motion="fade" data-delay="10">${div(
          "footer",
          str(c.footer)
        )}</div>`;
      return `<div class="accent-bar" data-motion="bar"></div><div data-motion="rise" data-rise="42">${title(
        c,
        "hero-title",
        fit(885.6, 126)
      )}${subtitle(c, "hero-sub")}</div>${div("footer", str(c.footer))}`;
    case "statement":
    case "custom":
      return `<div class="statement-card" data-motion="rise" data-rise="36">${label(
        c
      )}${title(c, "statement-title")}${subtitle(c, "statement-sub")}</div>`;
    case "mechanism": {
      const state = (value: string, side: string) =>
        `<div class="state-card"><div class="capsule ${side}" data-motion="${side}"></div>${div(
          "state-label",
          value
        )}</div>`;
      return `<div data-motion="fade">${label(c)}${title(
        c,
        "mechanism-title"
      )}${
        str(c.subtitle) ? div("subtitle mechanism-sub", str(c.subtitle)) : ""
      }</div><div class="states">${state(
        str(c.before),
        "before"
      )}<div class="arrow" data-motion="arrow">→</div>${state(
        str(c.after),
        "after"
      )}</div>`;
    }
    case "points": {
      const points = (c.points as string[] | undefined) ?? [];
      return `<div class="points-head">${label(c)}${title(
        c,
        "points-title",
        fit(850, 98)
      )}${pointsSubtitle(c)}</div><div class="point-list">${points
        .map((point, index) =>
          look.motion
            ? `<div class="point" data-motion="fade" data-delay="${
                index * 6
              }"><div data-motion="pop" data-delay="${index * 6}">${div(
                "number",
                String(index + 1)
              )}</div><div data-motion="slide" data-delay="${
                index * 6 + 2
              }">${div("point-text", point)}</div></div>`
            : `<div class="point" data-motion="rise" data-rise="28" data-delay="${
                index * 6
              }">${div("number", String(index + 1))}${div(
                "point-text",
                point
              )}</div>`
        )
        .join("")}</div>`;
    }
    case "equation":
      return `${div(
        "title equation-title",
        str(c.title)
      )}<div class="equations">${(c.latexBlocks as string[])
        .map(
          (block) => `<code class="equation-block">${escapeHtml(block)}</code>`
        )
        .join("")}</div>`;
    case "video-window":
      return `${div(
        "title window-title",
        str(c.title)
      )}<div class="window"><video id="${id}-video" class="clip" src="${escapeHtml(
        str(c.src)
      )}" data-start="0" data-duration="${seconds}" data-track-index="1" muted playsinline></video></div>`;
    case "cta":
      return `<div class="check" data-motion="pop">✓</div>${title(
        c,
        "cta-title"
      )}${subtitle(c, "cta-sub")}`;
  }
}

// Content classes must not reuse a scene kind name: the layout div carries
// the kind as a class, so a bare kind selector would style the whole scene.

// Scene-local timeline. Integer frames read the pinned Remotion spring
// exactly; mechanism easing is GSAP power1.inOut, which equals Easing.inOut(quad).
function sceneScript(
  id: string,
  seconds: number,
  fps: number,
  look: PairedLook,
  exit: boolean
): string {
  const samples = springSamples(fps);
  const span = samples.length - 1;
  return `(async()=>{
const root=document.getElementById(${JSON.stringify(id)});
await Promise.all(['600 100px Fraunces','400 38px Inter','500 35px Inter','600 29px Inter','700 27px Inter'].map(f=>document.fonts.load(f)));
root.querySelectorAll('[data-fit]').forEach(e=>{const [width,cap]=e.dataset.fit.split(',').map(Number);const span=document.createElement('span');Object.assign(span.style,{fontFamily:'Fraunces',fontWeight:'600',fontSize:'100px',display:'inline-block',position:'absolute',top:'-10000px',whiteSpace:'pre',textRendering:'auto'});span.innerText=e.textContent;document.body.append(span);const size=Math.max(58,Math.min(cap,width/span.getBoundingClientRect().width*100*2.25));span.remove();e.style.fontSize=size+'px';});
const samples=${JSON.stringify(samples)};
const enter=f=>{if(f<=0)return samples[0];if(f>=${span})return 1;const i=Math.floor(f);return samples[i]+(samples[i+1]-samples[i])*(f-i);};
const tl=gsap.timeline({paused:true});
tl.to({},{duration:${seconds}},0);
const spring={duration:${span / fps},ease:t=>enter(t*${span}),force3D:false};
root.querySelectorAll('[data-motion="rise"]').forEach(e=>tl.fromTo(e,{opacity:0,y:Number(e.dataset.rise)},{opacity:1,y:0,...spring},Number(e.dataset.delay||0)/${fps}));
root.querySelectorAll('[data-motion="fade"]').forEach(e=>tl.fromTo(e,{opacity:0},{opacity:1,...spring},${
    look.motion ? "Number(e.dataset.delay||0)/" + fps : "0"
  }));
root.querySelectorAll('[data-motion="bar"]').forEach(e=>tl.fromTo(e,{scaleX:0},{scaleX:1,...spring},0));
root.querySelectorAll('[data-motion="pop"]').forEach(e=>tl.fromTo(e,{scale:0},{scale:1,...spring},${
    look.motion ? "Number(e.dataset.delay||0)/" + fps : "0"
  }));
const calm={duration:1.95,ease:'power1.inOut',force3D:false};
root.querySelectorAll('[data-motion="before"]').forEach(e=>tl.fromTo(e,{scaleX:1},{scaleX:0.66,...calm},0.45));
root.querySelectorAll('[data-motion="after"]').forEach(e=>tl.fromTo(e,{scaleX:0.45},{scaleX:0.25,...calm},0.45));
root.querySelectorAll('[data-motion="arrow"]').forEach(e=>tl.fromTo(e,{x:-14},{x:14,...calm},0.45));
${
  look.motion
    ? `const at=e=>Number(e.dataset.delay||0)/${fps};
root.querySelectorAll('[data-motion="slide"]').forEach(e=>tl.fromTo(e,{opacity:0,x:36},{opacity:1,x:0,...spring},at(e)));
root.querySelectorAll('.orb').forEach(e=>tl.fromTo(e,{x:0,y:0},{x:-40,y:28,duration:${seconds},ease:'none',force3D:false},0));`
    : ""
}${
    exit
      ? `tl.fromTo(root.querySelector('.layout'),{opacity:1},{opacity:0,duration:${
          6 / fps
        },ease:'power2.in',immediateRender:false},${seconds - 6 / fps});`
      : ""
  }window.__timelines=window.__timelines||{};window.__timelines[${JSON.stringify(
    id
  )}]=tl;window.__hfForceTimelineRebind?.();
})();`;
}

export function hyperframesVideoSpecFiles(
  spec: PairedVideoSpec,
  timeline: PairedTimeline,
  look: PairedLook = DEFAULT_LOOK
): Record<string, string> {
  const palette = paletteFor(spec);
  const { fps, width, height } = timeline;
  const k = look.fill ? fillScale(width, height) : 1;
  const css = sceneCss(palette, look, k, width, height);
  const visible = timeline.scenes.filter((entry) => entry.visibleFrames > 0);
  const total = timeline.durationInFrames / fps;
  const files: Record<string, string> = {};
  const hosts: string[] = [];
  for (const entry of timeline.scenes) {
    if (entry.visibleFrames === 0) continue;
    const scene = spec.scenes[entry.index];
    const id = `scene-${entry.index + 1}`;
    const seconds = entry.visibleFrames / fps;
    // Under the fill scale the padded layout sits inside a scaled box, so
    // percent padding resolves against the box.
    const boxed = look.fill && k !== 1;
    const body = `<div class="fill background${
      look.background ? ` bg-v${entry.index % 4}` : ""
    }"><div class="orb" data-layout-allow-overflow></div><div class="ring" data-layout-allow-overflow></div>${
      look.background ? '<div class="grain"></div>' : ""
    }</div>${boxed ? '<div class="fill-box">' : ""}<div class="fill layout ${
      scene.kind
    }">${sceneBody(scene, id, seconds, look, k)}</div>${boxed ? "</div>" : ""}${
      spec.style.showSceneLabels ? div("scene-label", scene.kind) : ""
    }`;
    files[`compositions/${id}.html`] = `<template><style>${css}
#${id}{position:absolute;inset:0;width:100%;height:100%;overflow:hidden}
#${id},#${id} *{text-rendering:auto}</style><div id="${id}" data-composition-id="${id}" data-scene-id="${escapeHtml(
      scene.id
    )}" data-start="0" data-duration="${seconds}" data-width="${width}" data-height="${height}">${body}</div><script>${sceneScript(
      id,
      seconds,
      fps,
      look,
      look.transition && entry !== visible[visible.length - 1]
    )}</script></template>
`;
    hosts.push(
      `<div id="${id}" class="clip" data-composition-id="${id}" data-composition-src="compositions/${id}.html" data-start="${
        entry.startFrame / fps
      }" data-duration="${seconds}" data-track-index="0"></div>`
    );
  }
  const audio = spec.audio;
  // Remotion plays both tracks from frame 0 at a constant gain; ducking is a
  // fixed 0.32 music multiplier while narration exists, not an envelope.
  if (audio.musicSrc)
    hosts.push(
      `<audio id="music" src="${escapeHtml(
        audio.musicSrc
      )}" data-start="0" data-duration="${total}" data-track-index="10" data-volume="${
        audio.ducking && audio.narrationSrc
          ? audio.musicVolume * 0.32
          : audio.musicVolume
      }"></audio>`
    );
  if (audio.narrationSrc)
    hosts.push(
      `<audio id="narration" src="${escapeHtml(
        audio.narrationSrc
      )}" data-start="0" data-duration="${total}" data-track-index="11" data-volume="${
        audio.narrationVolume
      }"></audio>`
    );
  files["index.html"] = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(
    spec.meta.title
  )}</title><style>html,body{margin:0;width:100%;height:100%;background:${
    palette.background
  }}#video{position:absolute;inset:0;overflow:hidden;background:${
    palette.background
  }}.clip{position:absolute;inset:0}</style><script src="gsap.min.js"></script></head><body>
<div id="video" data-composition-id="video" data-start="0" data-width="${width}" data-height="${height}" data-duration="${total}">
${hosts.join("\n")}
</div>
<script>const tl=gsap.timeline({paused:true});tl.to({},{duration:${total}});window.__timelines=window.__timelines||{};window.__timelines.video=tl;window.__hfForceTimelineRebind?.();</script>
</body></html>
`;
  files["video.json"] = JSON.stringify(spec, null, 2) + "\n";
  files["hyperframes.json"] =
    // A usage-attribution label only. HyperFrames 0.9.19 lists "general-video"
    // as retired in favour of "hyperframes"; change it with the version.
    JSON.stringify({ authoringSkill: "general-video" }, null, 2) + "\n";
  files["package.json"] =
    JSON.stringify(
      {
        private: true,
        type: "module",
        scripts: {
          setup: "node setup.mjs",
          check: "hyperframes check",
          preview: "hyperframes preview",
          // Extract source video frames as PNG. The default JPEG extraction
          // re-subsamples chroma and leaves 1:1 windows of saturated footage
          // just under the similarity floor; since HyperFrames 0.8.143 PNG
          // extraction no longer darkens BT.709 footage.
          render: `hyperframes render --fps ${fps} --video-frame-format png --output video.mp4`,
        },
        dependencies: HYPERFRAMES_RUNTIME,
      },
      null,
      2
    ) + "\n";
  files["preflight.mjs"] = preflightScript(
    mediaRequirements(spec, timeline),
    fps
  );
  files[
    "setup.mjs"
  ] = `// Fetch the pinned fonts, copy the local GSAP runtime, then check media.
import { createHash } from "node:crypto";
import { copyFile, writeFile } from "node:fs/promises";

const fonts = ${JSON.stringify(
    PAIRED_FONTS.map(({ file, url, sha256 }) => ({ file, url, sha256 })),
    null,
    2
  )};
for (const font of fonts) {
  const response = await fetch(font.url);
  if (!response.ok) throw new Error("Font download failed: " + font.url);
  const bytes = Buffer.from(await response.arrayBuffer());
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== font.sha256)
    throw new Error("Font " + font.file + " changed upstream; expected sha-256 " + font.sha256);
  await writeFile(font.file, bytes);
}
await copyFile("node_modules/gsap/dist/gsap.min.js", "gsap.min.js");
await import("./preflight.mjs");
`;
  return files;
}
