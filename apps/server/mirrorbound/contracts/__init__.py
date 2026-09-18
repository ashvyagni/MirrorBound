"""Wire contracts between the browser client and the server.

Pydantic models validate every inbound message. The snapshot the server emits
is documented in docs/contracts/snapshot.md and mirrored by hand in
src/web/src/game/contracts.ts; `scripts/export_contracts.py` dumps the JSON
schema of everything here so the two can be diffed.
"""

from mirrorbound.contracts.messages import (
    ClientMessage,
    CommandMessage,
    InputMessage,
    TwinIntentModel,
    parse_client_message,
)

__all__ = ["ClientMessage", "CommandMessage", "InputMessage", "TwinIntentModel", "parse_client_message"]
