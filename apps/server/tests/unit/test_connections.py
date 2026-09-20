from unittest.mock import AsyncMock

import pytest

from mirrorbound.api.websocket import ConnectionManager, ConnectionSender


@pytest.mark.asyncio
async def test_replacement_closes_old_socket_and_cannot_receive_its_simulation():
    manager = ConnectionManager()
    old, new = AsyncMock(), AsyncMock()
    await manager.connect(old, 'save')
    old_sender = ConnectionSender(manager, old)
    await manager.connect(new, 'save')
    old.close.assert_awaited_once_with(code=4409, reason='Session opened in another tab')
    await old_sender.send_message('save', {'tick': 999})
    new.send_text.assert_not_awaited()
    manager.disconnect('save', old)
    await ConnectionSender(manager, new).send_message('save', {'tick': 1})
    new.send_text.assert_awaited_once_with('{"tick":1}')
    manager.disconnect('save', new)
    assert not manager.active_connections
