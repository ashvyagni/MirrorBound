from mirrorbound.game.core.ids import IdAllocator


def test_ids_are_sequential_per_kind():
    ids = IdAllocator()
    assert ids.next("enemy") == "enemy_1"
    assert ids.next("enemy") == "enemy_2"
    assert ids.next("projectile") == "projectile_1"
    assert ids.next("enemy") == "enemy_3"
