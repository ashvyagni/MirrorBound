"""Mirrorbound game server entry point."""

from __future__ import annotations

import uvicorn

from mirrorbound.api.app import create_app


def main():
    """Run the game server."""
    app = create_app()
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info",
    )


if __name__ == "__main__":
    main()
