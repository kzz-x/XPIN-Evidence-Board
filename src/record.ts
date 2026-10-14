import type { Studio } from "./studio";
import { ratio } from "./model";
import { download } from "./store";
import {
  Input,
  BlobSource,
  WEBM,
  Output,
  BufferTarget,
  WebMOutputFormat,
  Conversion,
} from "mediabunny";
/** Live capture is intentionally wall-clock driven. Frame-accurate delivery uses encode.ts. */
export class LiveRecorder {
  recorder?: MediaRecorder;
  canvas = document.createElement("canvas");
  chunks: Blob[] = [];
  started = 0;
  last = 0;
  fps = 30;
  frames = 0;
  audio?: HTMLAudioElement;
  context?: AudioContext;
  stream?: MediaStream;
  previousRenderSettings: Studio["view"]["renderSettings"] = {};
  constructor(public app: Studio) {}
  async start() {
    if (this.recorder || this.app.busy) return;
    const a = this.app,
      long = Number(a.el<HTMLSelectElement>("#export-size").value),
      r = ratio(a.p.settings.aspect);
    this.canvas.width = Math.round(r < 1 ? long * r : long);
    this.canvas.height = Math.round(this.canvas.width / r);
    this.fps = Number(a.el<HTMLSelectElement>("#export-fps").value);
    const quality = a.el<HTMLSelectElement>("#export-quality").value;
    const mime = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ].find((m) => MediaRecorder.isTypeSupported(m));
    if (!mime) {
      a.toast("当前浏览器不能录制 WebM");
      return;
    }
    try {
      this.canvas
        .getContext("2d")!
        .drawImage(
          a.view.renderer.domElement,
          0,
          0,
          this.canvas.width,
          this.canvas.height,
        );
      this.stream = this.canvas.captureStream(0);
      if (a.p.audio) {
        this.context = new AudioContext();
        this.audio = new Audio(a.p.audio);
        await this.audio.play();
        this.audio.pause();
        const source = this.context.createMediaElementSource(this.audio),
          dest = this.context.createMediaStreamDestination();
        source.connect(dest);
        // Keep the destination clock advancing while story audio is paused.
        const silence = this.context.createOscillator(),
          gain = this.context.createGain();
        gain.gain.value = 0;
        silence.connect(gain).connect(dest);
        silence.start();
        await this.context.resume();
        for (const t of dest.stream.getAudioTracks()) this.stream.addTrack(t);
      }
      this.recorder = new MediaRecorder(this.stream, {
        mimeType: mime,
        videoBitsPerSecond:
          (quality === "preview" ? 8 : quality === "master" ? 48 : 24) * 1e6,
        audioBitsPerSecond: 192000,
      });
      this.chunks = [];
      this.recorder.ondataavailable = (e) => {
        if (e.data.size) this.chunks.push(e.data);
      };
      this.started = performance.now();
      this.last = 0;
      this.frames = 0;
      a.liveRecording = true;
      a.root.dataset.recording = "true";
      a.layoutViewport();
      this.previousRenderSettings = { ...a.view.renderSettings };
      a.view.renderSettings = {
        quality:
          quality === "preview"
            ? "draft"
            : quality === "master"
              ? "ultra"
              : "studio",
        renderScale: quality === "master" ? 2 : quality === "studio" ? 1.5 : 1,
      };
      this.recorder.start(1000);
      a.el<HTMLDialogElement>("#output-dialog").close();
      a.el("#record-status").textContent = "正在录制";
      a.el('[data-action="record-stop"]').removeAttribute("disabled");
      a.toast("录制已开始；可手动运镜或播放故事。顶部停止按钮保存。");
    } catch (e) {
      a.toast("录制失败：" + e);
      await this.cleanup();
    }
  }
  capture(now: number) {
    if (!this.recorder || now - this.last < 1000 / this.fps) return;
    this.last = now;
    const g = this.canvas.getContext("2d")!;
    g.imageSmoothingQuality = "high";
    g.drawImage(
      this.app.view.renderer.domElement,
      0,
      0,
      this.canvas.width,
      this.canvas.height,
    );
    this.frames++;
    (
      this.stream?.getVideoTracks()[0] as
        | CanvasCaptureMediaStreamTrack
        | undefined
    )?.requestFrame();
    if (this.audio) {
      if (Math.abs(this.audio.currentTime - this.app.time) > 0.15)
        this.audio.currentTime = this.app.time;
      if (this.app.playing && this.audio.paused)
        void this.audio.play().catch(() => {});
      else if (!this.app.playing) this.audio.pause();
    }
    this.app.el("#record-status").textContent =
      `录制 ${((now - this.started) / 1000).toFixed(1)}s`;
  }
  async stop() {
    const recorder = this.recorder;
    if (!recorder) return;
    const elapsed = (performance.now() - this.started) / 1000;
    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });
    let blob = new Blob(this.chunks, { type: recorder.mimeType });
    if (!blob.size) {
      this.app.toast("录制未产生有效画面，请稍后重新录制。");
      await this.cleanup();
      return;
    }
    // MediaRecorder writes streaming WebM without duration/cues. Remux encoded packets to make seeking portable.
    const input = new Input({ source: new BlobSource(blob), formats: [WEBM] });
    try {
      const target = new BufferTarget(),
        output = new Output({ format: new WebMOutputFormat(), target });
      const conversion = await Conversion.init({
        input,
        output,
        copy: { mode: "forced" },
      });
      if (!conversion.isValid) throw Error("录制数据无法封装");
      await conversion.execute();
      if (target.buffer)
        blob = new Blob([target.buffer], { type: "video/webm" });
    } catch (e) {
      this.app.toast("已保留原始录制，索引整理未完成：" + e);
    } finally {
      input.dispose();
    }
    if (blob.size) download(blob, `XPIN-recording-${this.fps}fps.webm`);
    this.app.el("#record-status").textContent =
      `已保存 ${elapsed.toFixed(1)} 秒 · 实际画面更新约 ${(this.frames / elapsed).toFixed(1)} fps`;
    this.app.toast(`现场录制已保存 ${(blob.size / 1048576).toFixed(1)} MB`);
    await this.cleanup();
  }
  async cleanup() {
    this.app.liveRecording = false;
    this.app.root.dataset.recording = "false";
    this.app.view.renderSettings = this.previousRenderSettings;
    this.recorder = undefined;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.audio?.pause();
    await this.context?.close();
    this.context = undefined;
    this.audio = undefined;
    this.app.layoutViewport();
  }
}
