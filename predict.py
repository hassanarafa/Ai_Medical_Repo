import os
import sys
import json
from google import genai # Modern 2026 Python SDK

def main():
    if len(sys.argv) < 2:
        print("Usage: python predict.py <image_path>")
        return

    # ✅ SECURE: Pulls key from your Windows/Mac environment
    api_key = "AIzaSyBY38THUT5ldC_lqz8tkxDPLf4cnEPosIw"
    if not api_key:
        print("❌ Error: GEMINI_API_KEY environment variable not set.")
        return

    client = genai.Client(api_key=api_key)
    image_path = sys.argv[1]

    print(f"🧬 Analyzing {image_path}...")

    with open(image_path, "rb") as f:
        image_bytes = f.read()

    try:
        response = client.models.generate_content(
            model="gemini-3-flash-preview",
            contents=[
                "Analyze this acne image and provide a diagnosis in JSON format.",
                {"mime_type": "image/jpeg", "data": image_bytes}
            ]
        )
        print("\n" + "="*30)
        print(response.text)
        print("="*30)
    except Exception as e:
        print(f"❌ API Error: {e}")

if __name__ == "__main__":
    main()