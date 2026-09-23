from mirrorbound.agent.spatial.heatmap import GridHeatmap


def test_cell_of_buckets_positions_by_cell_size():
    heatmap = GridHeatmap(cell_size=2.0)
    assert heatmap.cell_of(0.0, 0.0) == (0, 0)
    assert heatmap.cell_of(1.9, 1.9) == (0, 0)
    assert heatmap.cell_of(2.0, 2.0) == (1, 1)
    assert heatmap.cell_of(-0.1, -0.1) == (-1, -1)


def test_record_accumulates_weight_in_the_same_cell():
    heatmap = GridHeatmap(cell_size=2.0, half_life_ticks=float("inf"))
    heatmap.record(1.0, 1.0, tick=1)
    heatmap.record(1.5, 1.9, tick=2)  # same cell as above
    assert heatmap.weight_at(1.0, 1.0, tick=2) == 2.0


def test_far_apart_positions_land_in_different_cells():
    heatmap = GridHeatmap(cell_size=2.0, half_life_ticks=float("inf"))
    heatmap.record(0.0, 0.0, tick=1)
    heatmap.record(100.0, 100.0, tick=1)
    assert heatmap.weight_at(0.0, 0.0, tick=1) == 1.0
    assert heatmap.weight_at(100.0, 100.0, tick=1) == 1.0


def test_weight_decays_without_new_observations():
    heatmap = GridHeatmap(cell_size=2.0, half_life_ticks=10.0)
    heatmap.record(0.0, 0.0, tick=1)
    now = heatmap.weight_at(0.0, 0.0, tick=1)
    later = heatmap.weight_at(0.0, 0.0, tick=25)
    assert later < now


def test_top_cells_ranks_by_decayed_weight():
    heatmap = GridHeatmap(cell_size=2.0, half_life_ticks=float("inf"))
    heatmap.record(0.0, 0.0, tick=1, amount=5.0)
    heatmap.record(10.0, 10.0, tick=1, amount=1.0)
    top = heatmap.top_cells(tick=1, n=2)
    assert top[0][0] == heatmap.cell_of(0.0, 0.0)
    assert top[0][1] == 5.0
    assert top[1][0] == heatmap.cell_of(10.0, 10.0)


def test_prune_removes_fully_decayed_cells_from_storage():
    heatmap = GridHeatmap(cell_size=2.0, half_life_ticks=10.0)
    heatmap.record(0.0, 0.0, tick=1)
    assert len(heatmap) == 1

    removed = heatmap.prune(tick=1000)

    assert removed == 1
    assert len(heatmap) == 0
