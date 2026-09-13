import os
import sys
import uvicorn

if __name__ == "__main__":
    port_env = os.environ.get("PORT", "8000")
    try:
        port = int(port_env)
    except (ValueError, TypeError):
        port = 8000

    print(f"[PSI Backend] Booting FastAPI application on 0.0.0.0:{port}...")
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, log_level="info")
