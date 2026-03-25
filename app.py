import os
import json
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from google import genai
import base64
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Initialize FastAPI
app = FastAPI()
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(BASE_DIR, "public")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Gemini Client
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("❌ Error: GEMINI_API_KEY environment variable not set.")

client = genai.Client(api_key=api_key)

app.mount("/static", StaticFiles(directory=PUBLIC_DIR), name="static")

@app.get("/")
async def read_root():
    return FileResponse(os.path.join(PUBLIC_DIR, "index.html"))

@app.get("/health")
async def health():
    return {
        "status": "online",
        "message": "Acne AI Backend is Online 🚀",
        "model": "gemini-2.5-flash"
    }

@app.post("/api/analyze")
async def analyze(
    image: UploadFile = File(...),
    user_answers: str = Form(default="{}")
):
    """
    Analyze skin image for acne diagnosis.
    
    Expects:
    - image: Image file (JPEG/PNG)
    - user_answers: JSON string with user profile (gender, age, painful, pus, etc.)
    """
    try:
        # 1. Validation
        if not image:
            return JSONResponse(
                status_code=400,
                content={"error": "No image uploaded"}
            )

        # 2. Read and encode image
        image_bytes = await image.read()
        image_base64 = base64.standard_b64encode(image_bytes).decode("utf-8")

        # 3. Parse user answers
        answers = {}
        try:
            answers = json.loads(user_answers)
        except json.JSONDecodeError:
            print("Could not parse user_answers, using defaults.")

        # 4. Create prompt
        prompt = f"""
            Analyze this skin image for acne.
            Profile: {answers.get('gender', 'Unknown')}, Age {answers.get('age', 'Unknown')}.
            Symptoms: Painful? {answers.get('painful', 'N/A')}, Pus? {answers.get('pus', 'N/A')}.
            Return ONLY JSON: 
            {{"diagnosis": "...", "suitability": "...", "reasoning": "...", "clinical_note": "..."}}
        """

        # 5. Call Gemini API
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                prompt,
                {
                    "inline_data": {
                        "mime_type": image.content_type or "image/jpeg",
                        "data": image_base64
                    }
                }
            ]
        )

        # 6. Parse and return response
        response_text = response.text.replace("```json", "").replace("```", "").strip()
        result = json.loads(response_text)

        return result

    except json.JSONDecodeError as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to parse AI response: {str(e)}"}
        )
    except Exception as e:
        print(f"❌ API Error: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": "AI Analysis failed. Check server logs for details."}
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
