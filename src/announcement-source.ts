import type { AnnouncementProject } from "./paired-announcement";
const htmlEscape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        c
      ]!)
  );
/** Portable source derived from the locally rendered September announcement card. */
export function announcementFiles(
  project: AnnouncementProject
): Record<string, string> {
  const copy = project.copy;
  const files: Record<string, string> = {};
  const addFile = (name: string, contents: string) => {
    files[name] = contents;
  };
  const css = `@font-face{font-family:AnnouncementDisplay;src:url(__ANNOUNCEMENT_DISPLAY_FONT__);font-weight:100 900;}
@font-face{font-family:AnnouncementBody;src:url(__ANNOUNCEMENT_BODY_FONT__);font-weight:400;}
*{box-sizing:border-box}body{margin:0;background:#f4f0e7;color:#202d29}
#announcement-root{position:relative;width:1280px;height:720px;overflow:hidden;background:#f4f0e7;color:#202d29}
.clip{position:absolute;inset:0}
h1,p{margin:0;overflow-wrap:anywhere}h1{position:absolute;left:88px;top:110px;width:1040px;font-family:AnnouncementDisplay;font-size:${
    copy.title.length > 45 ? 48 : copy.title.length > 24 ? 64 : 92
  }px;font-weight:650;line-height:1.08;letter-spacing:-3px}
#body{position:absolute;left:92px;top:370px;width:1050px;font-family:AnnouncementBody;font-size:${
    copy.body.length > 60 ? 28 : 34
  }px;font-weight:400;line-height:1.4}
#cta{position:absolute;left:92px;top:535px;width:1050px;font-family:AnnouncementBody;font-size:${
    copy.cta.length > 30 ? 26 : 30
  }px;font-weight:400;line-height:1.4;color:#345a45}
#rule{position:absolute;left:92px;top:620px;width:1096px;height:4px;background:#345a45;transform-origin:left center}
html,body,*{text-rendering:auto}
`;
  addFile("style.css", css);
  const manifest = {
    framework: project.framework,
    copy,
    width: 1280,
    height: 720,
    fps: 30,
    durationSeconds: 10,
  };
  addFile("manifest.json", JSON.stringify(manifest, null, 2) + "\n");
  if (project.framework === "hyperframes") {
    addFile(
      "hyperframes.json",
      JSON.stringify({ authoringSkill: "general-video" })
    );
    addFile(
      "index.html",
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Instavar announcement card</title><link rel="stylesheet" href="style.css"><script src="gsap.min.js"></script></head><body>
<div id="announcement-root" data-composition-id="announcement" data-start="0" data-width="1280" data-height="720" data-duration="10">
<section id="announcement-scene" class="clip" data-start="0" data-duration="10" data-track-index="0">
<h1 id="title">${htmlEscape(copy.title)}</h1><p id="body">${htmlEscape(
        copy.body
      )}</p><p id="cta">${htmlEscape(
        copy.cta
      )}</p><div id="rule"></div></section></div>
<script>
// Adapted from HyperFrames registry staggered-fade-up: three whole text blocks.
const tl=gsap.timeline({paused:true});
tl.fromTo('#title',{opacity:0,y:22},{opacity:1,y:0,duration:0.6,ease:'power3.out'},0.25);
tl.fromTo('#body',{opacity:0,y:22},{opacity:1,y:0,duration:0.6,ease:'power3.out'},2);
tl.fromTo('#cta',{opacity:0,y:22},{opacity:1,y:0,duration:0.6,ease:'power3.out'},5);
tl.fromTo('#rule',{scaleX:0},{scaleX:1,duration:9.5,ease:'none'},0.25);
window.__timelines['announcement']=tl;
</script></body></html>`
    );
    addFile(
      "index.motion.json",
      JSON.stringify(
        {
          duration: 10,
          assertions: [
            { kind: "appearsBy", selector: "#title", bySec: 1 },
            { kind: "before", a: "#title", b: "#body" },
            { kind: "before", a: "#body", b: "#cta" },
            { kind: "staysInFrame", selector: "#title" },
            { kind: "staysInFrame", selector: "#body" },
            { kind: "staysInFrame", selector: "#cta" },
          ],
        },
        null,
        2
      )
    );
  } else {
    addFile(
      "index.jsx",
      `import React from 'react';
import {Composition,registerRoot,useCurrentFrame,useVideoConfig} from 'remotion';
const css=${JSON.stringify(css)};
const copy=${JSON.stringify(copy)};
const ease=t=>1-Math.pow(1-t,4);
const reveal=(t,start)=>{const p=ease(Math.max(0,Math.min(1,(t-start)/0.6)));return {opacity:p,transform:'translateY('+(22*(1-p))+'px)'}};
function Announcement(){const frame=useCurrentFrame();const {fps}=useVideoConfig();const t=frame/fps;return <div id="announcement-root"><style>{css}</style><section className="clip"><h1 id="title" style={reveal(t,0.25)}>{copy.title}</h1><p id="body" style={reveal(t,2)}>{copy.body}</p><p id="cta" style={reveal(t,5)}>{copy.cta}</p><div id="rule" style={{transform:'scaleX('+Math.max(0,Math.min(1,(t-0.25)/9.5))+')'}}/></section></div>}
registerRoot(()=> <Composition id="Announcement" component={Announcement} width={1280} height={720} fps={30} durationInFrames={300}/>);
`
    );
  }
  const dependencies =
    project.framework === "hyperframes"
      ? { hyperframes: "0.8.38", gsap: "3.14.2" }
      : {
          remotion: "4.0.496",
          "@remotion/cli": "4.0.496",
          react: "19.1.0",
          "react-dom": "19.1.0",
        };
  addFile(
    "package.json",
    JSON.stringify(
      {
        private: true,
        type: "module",
        scripts: {
          setup: "node setup.mjs",
          preview:
            project.framework === "hyperframes"
              ? "hyperframes preview"
              : "remotion studio index.jsx",
          render:
            project.framework === "hyperframes"
              ? "hyperframes render --fps 30 --output video.mp4"
              : "remotion render index.jsx Announcement video.mp4",
        },
        dependencies,
      },
      null,
      2
    )
  );
  addFile(
    "setup.mjs",
    `import {readFile,writeFile,copyFile} from 'node:fs/promises';
const fonts = [['__ANNOUNCEMENT_DISPLAY_FONT__','Fraunces-Variable.ttf'],['__ANNOUNCEMENT_BODY_FONT__','Inter-Regular.ttf']];
for (const [marker,name] of fonts) {
  const response = await fetch('https://instavar.com/fonts/'+name);
  if (!response.ok) throw new Error('Font download failed: '+name);
  const uri = 'data:font/ttf;base64,'+Buffer.from(await response.arrayBuffer()).toString('base64');
  for (const file of ${JSON.stringify(
    project.framework === "hyperframes"
      ? ["style.css"]
      : ["style.css", "index.jsx"]
  )}) {
    const source = await readFile(file,'utf8');
    await writeFile(file,source.replaceAll(marker,uri));
  }
}
${
  project.framework === "hyperframes"
    ? "await copyFile('node_modules/gsap/dist/gsap.min.js','gsap.min.js');"
    : ""
}
`
  );
  return files;
}
