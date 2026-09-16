import os
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from google import genai
from google.genai import types
from pydantic import BaseModel

app = FastAPI(title="Driia IA API")

# Permite conexões do app móvel ou navegador
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
APP_SECRET_TOKEN = os.getenv("APP_SECRET_TOKEN", "driia-token-seguro")

if GEMINI_API_KEY:
    client = genai.Client(api_key=GEMINI_API_KEY)
else:
    client = None

class VoicePayload(BaseModel):
    command: str

@app.get("/")
def home():
    return {"status": "Driia IA online", "version": "1.0.0"}

@app.post("/api/driia-stream")
async def driia_stream(
    payload: VoicePayload,
    authorization: str = Header(None)
):
    # Trava de segurança simples por Token
    if authorization != f"Bearer {APP_SECRET_TOKEN}":
        raise HTTPException(status_code=401, detail="Não autorizado")
    
    if not client:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY não configurada")

    system_instruction = (
        "Você é a Driia IA, uma assistente virtual de voz interativa e inteligente. "
        "Responda sempre em Português do Brasil de forma direta, clara e concisa. "
        "NÃO use formatações Markdown, asteriscos, hashtags ou símbolos visuais, "
        "pois suas respostas serão lidas por um sintetizador de voz (Text-to-Speech)."
    )

    config = types.GenerateContentConfig(
        system_instruction=system_instruction,
        temperature=0.3,
        max_output_tokens=300
    )

    def generate_chunks():
        try:
            response_stream = client.models.generate_content_stream(
                model="gemini-2.5-flash",
                contents=payload.command,
                config=config
            )
            for chunk in response_stream:
                if chunk.text:
                    yield chunk.text
        except Exception as e:
            yield f"Erro ao processar comando: {str(e)}"

    return StreamingResponse(generate_chunks(), media_type="text/plain")
