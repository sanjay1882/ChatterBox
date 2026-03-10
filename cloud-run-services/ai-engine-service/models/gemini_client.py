import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

async def stream_gemini_response(prompt: str, model_name: str = "gemini-2.5-flash"):
    model = genai.GenerativeModel(model_name)
    response = await model.generate_content_async(prompt, stream=True)
    async for chunk in response:
        yield chunk.text
