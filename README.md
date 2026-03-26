# AcneLens

FastAPI-based acne image analysis app using Google Gemini.

This project includes:

- A Python backend (`FastAPI`) for image + form processing.
- A static frontend (Tailwind + vanilla JS).
- Utility scripts for direct model testing.

---

## 1) Features

- Upload skin image and submit patient context.
- Analyze image with Gemini (`gemini-2.5-flash`).
- Return structured JSON:

- `diagnosis`
- `suitability`
- `reasoning`
- `clinical_note`
- Modern interactive UI at root endpoint (`/`).
- Health endpoint for status checks (`/health`).

---

## 2) Tech Stack

- Backend: FastAPI, Uvicorn
- AI SDK: `google-genai`
- Env loading: `python-dotenv`
- Frontend: HTML + Tailwind CDN + vanilla JS

---

## 3) Project Structure

```text
AcneLens/
├── app.py                 # Main FastAPI server
├── inference.py           # Reusable analyzer class for local/script usage
├── predict.py             # CLI-style single-image test script
├── public/
│   ├── index.html         # UI page
│   ├── api.js             # API submission + result binding
│   └── interactivity.js   # UI interactions (preview + button selection)
├── .env                   # Local secrets (ignored)
├── .env.examble           # Env template (typo in filename, kept as-is)
├── .gitignore
└── README.md
```

---

## 4) Requirements

Python 3.10+ recommended.

Install dependencies:

```bash
pip install fastapi uvicorn google-genai python-dotenv python-multipart pillow
```

---

## 5) Environment Variables

Create `.env` in the project root:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

The server loads this automatically using `load_dotenv()`.

> Security: never commit real API keys. If a key was exposed, rotate it.

---

## 6) Run the Server

From the project root:

```bash
python3 app.py
```

Server starts on:

```text
http://0.0.0.0:8000
```

---

## 7) Endpoints

### `GET /`

Serves the frontend UI (`public/index.html`).

### `GET /health`

Returns server status and model info.

Example response:

```json
{
  "status": "online",
  "message": "Acne AI Backend is Online 🚀",
  "model": "gemini-2.5-flash"
}
```

### `POST /api/analyze`

Accepts multipart form data:

- `image`: uploaded image file
- `user_answers`: JSON string

Example `user_answers`:

```json
{"gender":"female","age":"25","painful":"yes","pus":"no"}
```

---

## 8) Testing with curl

Health check:

```bash
curl http://localhost:8000/health
```

Analyze request:

```bash
curl -X POST "http://localhost:8000/api/analyze" \
   -F "image=@./your-image.jpg" \
   -F "user_answers={\"gender\":\"female\",\"age\":\"25\",\"painful\":\"yes\",\"pus\":\"no\"}"
```

---

## 9) Frontend Behavior

- Tailwind-based modern UI.
- Gender is selected via button choices (`♀ Female`, `♂ Male`) and saved in hidden input.
- `Painful` and `Pus` are button-only controls (hidden inputs store values).
- Live image preview before submission.
- `api.js` only updates existing elements (no HTML templating in JS).

---

## 10) Backend Flow (`app.py`)

1. Load env values.
2. Initialize FastAPI app and CORS middleware.
3. Serve static files from `/static`.
4. Receive upload + form values in `/api/analyze`.
5. Convert image to base64.
6. Build model prompt from context.
7. Call Gemini API.
8. Parse model JSON response and return it.

Error handling:

- Missing upload -> `400`
- Invalid model JSON / runtime failures -> `500`

---

## 11) Utility Scripts

### `inference.py`

Contains `AcneGeminiAnalyzer` class for non-server workflows.

### `predict.py`

Simple command-line script:

```bash
python predict.py <image_path>
```

---

## 12) Notes / Known Items

- File `.env.examble` has a spelling typo in the name (`examble` vs `example`).
- `google-genai` SDK method signatures may evolve; keep model call usage aligned with installed SDK version.
- UI is intentionally plain logic in JS with structure controlled in HTML.

---

## 13) Suggested Next Improvements

- Add `requirements.txt` for reproducible installs.
- Add request validation schema and stricter MIME checks.
- Add logging + request IDs.
- Add automated tests for `/health` and `/api/analyze`.
- Add Dockerfile for easy deployment.
