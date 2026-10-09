# PRD: Virtual Glasses Try-On 3D

## Objective
Let a user preview multiple glasses styles on their face in real time using a webcam and a 3D overlay.

## User journey
1. Open app and select a frame.
2. Explicitly start camera and grant permission.
3. Detect face landmarks and align 3D glasses with face position and estimated pose.
4. Switch frames, save a screenshot, or stop camera.

## Functional requirements
- Responsive bright-minimal UI.
- Explicit camera start/stop and clear status/error states.
- Browser-side MediaPipe face tracking.
- Three.js 3D frame overlay reacting to position, scale, and pose.
- At least three selectable styles.
- Screenshot export.
- REST catalog API with PostgreSQL persistence when configured.
- Release camera and rendering resources on stop/unmount.

## Privacy
No camera frames or facial landmarks are uploaded or stored by the backend.

## Out of scope
Login, checkout, marketplace, face measurement, cloud video processing, and AI face-shape recommendations.

## Acceptance and evaluation
Test camera permission/denial, no-face state, frame switching, screenshot, and camera cleanup. Evaluate tracking at front/15/30/45-degree head turns, FPS, latency, and usability on target devices. Numeric goals remain targets until measured.
