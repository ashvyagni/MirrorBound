from mirrorbound.contracts.messages import CommandMessage, InputMessage, parse_client_message


def test_valid_input_parses():
    msg = parse_client_message({"type": "INPUT", "moveX": 1, "moveY": -1, "attack": True, "run": False, "ability": 2})
    assert isinstance(msg, InputMessage) and msg.ability == 2


def test_out_of_range_or_unknown_messages_are_rejected():
    assert parse_client_message({"type": "INPUT", "moveX": 5}) is None
    assert parse_client_message({"type": "INPUT", "ability": 9}) is None
    assert parse_client_message({"type": "NOPE"}) is None
    assert parse_client_message({}) is None


def test_commands_parse():
    msg = parse_client_message({"type": "COMMAND", "action": "EQUIP_WEAPON", "weaponId": "hunter_bow"})
    assert isinstance(msg, CommandMessage) and msg.weaponId == "hunter_bow"
    assert parse_client_message({"type": "COMMAND", "action": "DANCE"}) is None
