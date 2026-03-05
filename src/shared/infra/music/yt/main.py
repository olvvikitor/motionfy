# ── SSL fix Windows (dev only) ─────────────────────────────────────────────
import urllib3
import requests
from requests.adapters import HTTPAdapter
from urllib3.poolmanager import PoolManager

class NoSSLAdapter(HTTPAdapter):
    def init_poolmanager(self, *args, **kwargs):
        kwargs['ssl_context'] = urllib3.util.ssl_.create_urllib3_context()
        kwargs['ssl_context'].check_hostname = False
        kwargs['ssl_context'].verify_mode = __import__('ssl').CERT_NONE
        return super().init_poolmanager(*args, **kwargs)

# Monkey-patch global — afeta TODAS as sessions do requests incluindo ytmusicapi
_original_session = requests.Session

class PatchedSession(_original_session):
    def __init__(self):
        super().__init__()
        self.verify = False
        self.mount('https://', NoSSLAdapter())

requests.Session = PatchedSession
# ── fim SSL fix ────────────────────────────────────────────────────────────

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ytmusicapi import YTMusic, OAuthCredentials  # ← depois do patch
import json
import time
    
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class HistoryRequest(BaseModel):
    access_token: str
    refresh_token: str      # ← adicione

    client_id: str
    client_secret: str
    limit: int = 50

class Track(BaseModel):
    id: str
    title: str
    artist: str
    img_url: str

@app.post("/history", response_model=list[Track])
async def get_history(body: HistoryRequest):
    try:
        credentials = OAuthCredentials(
            client_id=body.client_id,
            client_secret=body.client_secret,
        )

        # Shape correto para ytmusicapi 1.x
        auth_data = {
            "access_token": body.access_token,
            "refresh_token": body.refresh_token,
            "token_type": "Bearer",
            "expires_in": 3600,
            "expires_at": int(time.time()) + 3600,
            "scope": "https://www.googleapis.com/auth/youtube",
        }

        yt = YTMusic(
            auth=json.dumps(auth_data),
            oauth_credentials=credentials,
        )

        raw_history = yt.get_history()

        print(raw_history)

        tracks: list[Track] = []
        for item in raw_history[:body.limit]:
            thumbnails = item.get("thumbnails", [])
            img_url = thumbnails[-1]["url"] if thumbnails else ""
            
            artists = item.get("artists", [])
            artist = ", ".join(a["name"] for a in artists) if artists else "Desconhecido"
            
            video_id = item.get("videoId", "")
            title = item.get("title", "")

            if not video_id or not title:
                continue

            tracks.append(Track(
                id=video_id,
                title=title,
                artist=artist,
                img_url=img_url,
            ))

        return tracks

    except Exception as e:
        import traceback
        print(traceback.format_exc())  # stack trace completo
        print(f"--- ERRO NO PYTHON ---")
        print(f"Tipo do erro: {type(e).__name__}")
        print(f"Mensagem: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/health")
async def health():
    return {"status": "ok"}