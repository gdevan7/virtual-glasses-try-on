import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Download, RotateCcw } from "lucide-react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import GlassesScene from "./GlassesScene.jsx";

const MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.20/wasm";
const DEFAULT_AR = "16/10";

export default function CameraStage({ glasses }) {
  const video = useRef(null);
  const stream = useRef(null);
  const tracker = useRef(null);
  const raf = useRef(0);
  const last = useRef(-1);
  // Landmark + matriks pose disimpan di ref agar tidak memicu render React tiap frame.
  const track = useRef({ lm: null, matrix: null });
  const hasFace = useRef(false);

  const [on, setOn] = useState(false);
  const [face, setFace] = useState(false);
  const [ar, setAr] = useState(DEFAULT_AR);
  const [status, setStatus] = useState("Camera is off");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const clearTrack = useCallback(() => {
    track.current = { lm: null, matrix: null };
    hasFace.current = false;
    setFace(false);
  }, []);

  const stop = useCallback(() => {
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    clearTrack();
    setOn(false);
    setAr(DEFAULT_AR);
    setStatus("Camera is off");
  }, [clearTrack]);

  const tick = useCallback(() => {
    const v = video.current;
    if (v && tracker.current && v.readyState >= 2 && v.currentTime !== last.current) {
      last.current = v.currentTime;
      try {
        const r = tracker.current.detectForVideo(v, performance.now());
        if (r.faceLandmarks?.length) {
          track.current = {
            lm: r.faceLandmarks[0],
            matrix: r.facialTransformationMatrixes?.[0]?.data ?? null,
          };
          if (!hasFace.current) {
            hasFace.current = true;
            setFace(true);
            setStatus("Face detected · tracking active");
          }
        } else {
          track.current = { lm: null, matrix: null };
          if (hasFace.current) {
            hasFace.current = false;
            setFace(false);
            setStatus("Move into camera view");
          }
        }
      } catch {
        setStatus("Tracking frame skipped");
      }
    }
    raf.current = requestAnimationFrame(tick);
  }, []);

  async function start() {
    setError("");
    setBusy(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw Error("Camera needs a modern browser on localhost or HTTPS.");
      }
      setStatus("Requesting camera permission…");
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (!tracker.current) {
        setStatus("Loading face tracking model…");
        const v = await FilesetResolver.forVisionTasks(WASM);
        const make = (delegate) =>
          FaceLandmarker.createFromOptions(v, {
            baseOptions: { modelAssetPath: MODEL, delegate },
            runningMode: "VIDEO",
            numFaces: 1,
            outputFacialTransformationMatrixes: true,
          });
        try {
          tracker.current = await make("GPU");
        } catch {
          tracker.current = await make("CPU");
        }
      }
      video.current.srcObject = stream.current;
      await video.current.play();
      // Samakan rasio stage dengan video asli: tidak perlu hitungan crop object-fit.
      const { videoWidth: vw, videoHeight: vh } = video.current;
      if (vw && vh) setAr(`${vw}/${vh}`);
      setOn(true);
      setStatus("Camera active · looking for face");
      last.current = -1;
      raf.current = requestAnimationFrame(tick);
    } catch (e) {
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
      setOn(false);
      setError(
        e?.name === "NotAllowedError"
          ? "Camera permission denied. Allow access in browser settings."
          : e.message || "Could not start camera."
      );
      setStatus("Camera could not start");
    } finally {
      setBusy(false);
    }
  }

  function screenshot() {
    const v = video.current;
    if (!v || v.readyState < 2) {
      setError("Start the camera before saving a screenshot.");
      return;
    }
    const c = document.createElement("canvas");
    c.width = v.videoWidth || 1280;
    c.height = v.videoHeight || 720;
    const ctx = c.getContext("2d");
    // Video dan overlay sama-sama dicerminkan di preview, jadi cerminkan keduanya.
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, 0, 0, c.width, c.height);
    const gl = document.querySelector(".glasses-scene canvas");
    if (gl) ctx.drawImage(gl, 0, 0, c.width, c.height);
    const a = document.createElement("a");
    a.download = `frame-studio-${Date.now()}.png`;
    a.href = c.toDataURL();
    a.click();
  }

  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
      stream.current?.getTracks().forEach((t) => t.stop());
      tracker.current?.close();
    },
    []
  );

  return (
    <section className="tryon-card">
      <div className="stage-toolbar">
        <div>
          <span className={`live-dot ${on ? "active" : ""}`} />
          {status}
        </div>
        <button className="icon-button" onClick={screenshot} aria-label="Save screenshot" title="Save screenshot">
          <Download size={17} />
        </button>
      </div>
      <div className="camera-stage" style={{ aspectRatio: ar }}>
        <video
          ref={video}
          className="camera-video"
          autoPlay
          playsInline
          muted
          style={{ display: on ? "block" : "none" }}
        />
        <div className={`camera-placeholder ${on ? "hidden" : ""}`}>
          <div className="placeholder-icon">
            <Camera size={28} />
          </div>
          <h3>Your virtual fitting room</h3>
          <p>Start your camera to preview a 3D frame on your face.</p>
          <span className="privacy-note">Your camera stays on this device.</span>
        </div>
        <div className="overlay-mirror">
          <GlassesScene glasses={glasses} trackRef={track} enabled={on} />
        </div>
        {on && !face && <div className="tracking-hint">Center your face in the frame</div>}
      </div>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      <div className="stage-actions">
        {!on ? (
          <button className="primary-button" disabled={busy} onClick={start}>
            <Camera size={17} />
            {busy ? "Starting…" : "Start camera"}
          </button>
        ) : (
          <button className="secondary-button" onClick={stop}>
            <CameraOff size={17} />
            Stop camera
          </button>
        )}
        <button
          className="text-button"
          onClick={() => {
            setError("");
            clearTrack();
            setStatus(on ? "Looking for face…" : "Camera is off");
          }}
        >
          <RotateCcw size={15} />
          Reset fit
        </button>
      </div>
    </section>
  );
}
