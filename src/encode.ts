import {
  Output,
  BufferTarget,
  CanvasSource,
  AudioBufferSource,
  WebMOutputFormat,
  Mp4OutputFormat,
  Quality,
  canEncodeVideo,
  canEncodeAudio,
} from "mediabunny";
import type { Studio } from "./studio";
import { ratio } from "./model";
import { duration } from "./story";
import { download } from "./store";
/** Frame timestamps are authored time, independent of render and encoder speed. */
export async function recordVideo(app: Studio) {
  if (app.busy) return;
  const total = duration(app.p);
  if (!total) {
    app.toast("先添加故事镜头");
    return;
  }
  app.stop();
  app.busy = true;
  const progress = app.el<HTMLProgressElement>("#export-progress"),
    note = app.el("#export-note");
  progress.hidden = false;
  note.textContent = "逐帧渲染与编码中。时间戳固定，渲染速度不会改变故事时长。";
  const long = Number(app.el<HTMLSelectElement>("#export-size").value),
    aspect = ratio(app.p.settings.aspect),
    width = 2 * Math.round((aspect < 1 ? long * aspect : long) / 2),
    height = 2 * Math.round(width / aspect / 2),
    fps = Number(app.el<HTMLSelectElement>("#export-fps").value),
    format = app.el<HTMLSelectElement>("#export-format").value,
    v = app.view,
    pixel = v.renderer.getPixelRatio(),
    w = v.width,
    h = v.height;
  const preset = app.el<HTMLSelectElement>("#export-quality").value;
  const supersample = preset === "master" ? 2 : 1;
  const previousSettings = { ...app.p.settings };
  app.p.settings.quality =
    preset === "preview" ? "draft" : preset === "master" ? "ultra" : "studio";
  const encodedCanvas = document.createElement("canvas");
  encodedCanvas.width = width;
  encodedCanvas.height = height;
  const encodedContext = encodedCanvas.getContext("2d")!;
  encodedContext.imageSmoothingQuality = "high";
  let output: Output | undefined, context: AudioContext | undefined;
  try {
    const codec = format === "mp4" ? "avc" : "vp9",
      audioCodec = format === "mp4" ? "aac" : "opus";
    if (!(await canEncodeVideo(codec, { width, height, frameRate: fps })))
      throw Error(
        "当前浏览器不能编码该格式，请选择其他格式或使用新版 Edge / Chrome。",
      );
    v.renderer.setPixelRatio(1);
    v.composer.setPixelRatio(1);
    v.renderer.setSize(width * supersample, height * supersample, false);
    v.composer.setSize(width * supersample, height * supersample);
    const target = new BufferTarget();
    output = new Output({
      format:
        format === "mp4"
          ? new Mp4OutputFormat({ fastStart: "in-memory" })
          : new WebMOutputFormat(),
      target,
    });
    const source = new CanvasSource(encodedCanvas, {
      codec,
      quality: new Quality(
        preset === "preview"
          ? "medium"
          : preset === "master"
            ? "very-high"
            : "high",
      ),
      keyFrameInterval: 2,
    });
    output.addVideoTrack(source, { frameRate: fps });
    let audio: AudioBufferSource | undefined, trimmed: AudioBuffer | undefined;
    if (app.p.audio) {
      context = new AudioContext();
      const buffer = await context.decodeAudioData(
        await (await fetch(app.p.audio)).arrayBuffer(),
      );
      if (
        !(await canEncodeAudio(audioCodec, {
          numberOfChannels: buffer.numberOfChannels,
          sampleRate: buffer.sampleRate,
        }))
      )
        throw Error("此格式的声音编码不可用，请选择 WebM。");
      trimmed = context.createBuffer(
        buffer.numberOfChannels,
        Math.ceil(total * buffer.sampleRate),
        buffer.sampleRate,
      );
      for (let ch = 0; ch < buffer.numberOfChannels; ch++)
        trimmed.copyToChannel(
          buffer.getChannelData(ch).subarray(0, trimmed.length),
          ch,
        );
      audio = new AudioBufferSource({
        codec: audioCodec,
        quality: new Quality("high"),
      });
      output.addAudioTrack(audio);
    }
    await output.start();
    const count = Math.ceil(total * fps);
    for (let n = 0; n < count; n++) {
      const t = n / fps;
      v.renderAt(app.p, t, "play", undefined, true);
      encodedContext.drawImage(v.renderer.domElement, 0, 0, width, height);
      await source.add(t, Math.min(1 / fps, total - t));
      progress.value = (n + 1) / count;
      if (n % 8 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    source.close();
    if (audio && trimmed) {
      await audio.add(trimmed);
      audio.close();
    }
    await output.finalize();
    if (!target.buffer || target.buffer.byteLength < 1000)
      throw Error("编码结果为空");
    const blob = new Blob([target.buffer], {
      type: format === "mp4" ? "video/mp4" : "video/webm",
    });
    download(blob, `XPIN-story-${fps}fps.${format}`);
    note.textContent = `已输出 ${(blob.size / 1024 / 1024).toFixed(1)} MB / ${total.toFixed(2)} 秒 / ${fps} fps。`;
  } catch (e) {
    await output?.cancel().catch(() => {});
    note.textContent = String(e);
    app.toast("输出失败：" + String(e));
  } finally {
    Object.assign(app.p.settings, previousSettings);
    await context?.close();
    v.renderer.setPixelRatio(pixel);
    v.composer.setPixelRatio(pixel);
    v.renderer.setSize(w, h);
    v.composer.setSize(w, h);
    app.busy = false;
    progress.hidden = true;
    v.renderAt(app.p, app.time, app.mode);
  }
}
