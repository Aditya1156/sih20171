import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes.agent import router as agent_router
from .security.log_sanitiser import setup_logging

load_dotenv()
setup_logging(os.environ.get("LOG_LEVEL", "INFO"))

app = FastAPI(
    title="VeilAgent Backend",
    version="0.1.0",
    description="Reasoning backend for VeilAgent — receives only sanitised context, returns structured actions.",
)

allowed_origins = os.environ.get("ALLOWED_ORIGINS", "").split(",")
allowed_origins = [o.strip() for o in allowed_origins if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins or ["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "veilagent-backend"}


app.include_router(agent_router)
