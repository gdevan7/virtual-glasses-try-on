# Virtual Glasses Try-On 3D

Capstone Design MVP: webcam-based virtual eyewear try-on with React, Three.js, MediaPipe Face Landmarker, Express, and PostgreSQL.

## Features
- Bright white UI with cobalt blue accents.
- Camera permission requested only after clicking Start camera.
- Client-side face tracking; webcam frames and landmarks are not sent to the backend.
- Three selectable frame styles rendered with procedural Three.js geometry.
- Express REST API for catalog CRUD.
- PostgreSQL schema and Docker Compose.
- Screenshot download and camera stop control.

> Starter project: the 3D frame geometry is procedural placeholder geometry, not a photorealistic licensed GLB model. Face pose mapping and alignment require real-device calibration. Performance targets are not measured results.

## Run locally
Requirements: Node.js 20+, Docker (recommended), modern browser.

1. Start database: `docker compose up -d db`
2. API: `cd backend && cp .env.example .env && npm install && npm run dev`
3. Frontend in another terminal: `cd frontend && npm install && npm run dev`
4. Open the Vite URL. Camera access requires localhost or HTTPS.

If DATABASE_URL is unset, the API uses a temporary in-memory catalog. PostgreSQL is needed for persistence.

## API
- GET /api/health
- GET /api/glasses
- GET /api/glasses/:id
- POST /api/glasses
- PATCH /api/glasses/:id
- DELETE /api/glasses/:id

Before exposing catalog write endpoints publicly, add authentication and rate limits. Never commit secrets.
