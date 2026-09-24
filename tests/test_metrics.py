import pytest
from backend.metrics import (
    calculate_wilson_ci,
    calculate_drawdown_and_streaks,
    calculate_performance_report
)

def test_payout_and_pnl_calculation():
    """Verify that payouts and PnL correctly handle wins, losses, and draws."""
    # Simulated trade records with known payouts
    trades = [
        {"outcome": "WIN", "stake": 10.0, "settlement_amount": 18.5, "pnl": 8.5, "is_mock": False, "was_entered": True},
        {"outcome": "LOSS", "stake": 10.0, "settlement_amount": 0.0, "pnl": -10.0, "is_mock": False, "was_entered": True},
        {"outcome": "DRAW", "stake": 10.0, "settlement_amount": 10.0, "pnl": 0.0, "is_mock": False, "was_entered": True},
    ]
    assessments = []
    
    report = calculate_performance_report(trades=trades, assessments=assessments, include_mock=False)
    
    # Net PnL = +8.5 - 10.0 + 0.0 = -1.50
    assert report["net_demo_pnl"] == -1.50
    assert report["wins"] == 1
    assert report["losses"] == 1
    assert report["draws"] == 1

def test_win_rate_and_exclusions():
    """
    Verify that WAIT, SKIPPED, UNRESOLVED, and DRAWS are excluded from the
    decisive win rate denominator, but their counts remain fully visible.
    """
    trades = [
        {"outcome": "WIN", "pnl": 8.5, "is_mock": False, "was_entered": True},
        {"outcome": "WIN", "pnl": 8.5, "is_mock": False, "was_entered": True},
        {"outcome": "WIN", "pnl": 8.5, "is_mock": False, "was_entered": True},
        {"outcome": "LOSS", "pnl": -10.0, "is_mock": False, "was_entered": True},
        {"outcome": "DRAW", "pnl": 0.0, "is_mock": False, "was_entered": True},
        {"outcome": "SKIPPED", "pnl": 0.0, "is_mock": False, "was_entered": False},
        {"outcome": "UNRESOLVED", "pnl": 0.0, "is_mock": False, "was_entered": True},
    ]
    assessments = [
        {"direction": "UP", "is_mock": False, "is_stale": False},
        {"direction": "DOWN", "is_mock": False, "is_stale": False},
        {"direction": "WAIT", "is_mock": False, "is_stale": False},
        {"direction": "WAIT", "is_mock": False, "is_stale": False},
        {"direction": "UP", "is_mock": False, "is_stale": True},
    ]
    
    report = calculate_performance_report(trades=trades, assessments=assessments, include_mock=False)
    
    # 3 Wins, 1 Loss => 4 Decisive Trades
    assert report["decisive_trades_count"] == 4
    # Win rate = 3 / 4 = 75.0%
    assert report["win_rate_percent"] == 75.0
    
    # Verify exclusions and reporting
    assert report["wins"] == 3
    assert report["losses"] == 1
    assert report["draws"] == 1
    assert report["skipped"] == 1
    assert report["unresolved"] == 1
    assert report["wait_assessments_excluded"] == 2
    assert report["stale_assessments_excluded"] == 1

def test_wilson_confidence_interval():
    """Test Wilson score formula for bounds, center, and zero-edge handling."""
    # Zero count edge case
    ci_empty = calculate_wilson_ci(0, 0)
    assert ci_empty["lower"] == 0.0
    assert ci_empty["upper"] == 0.0
    
    # 50 wins out of 100 trials: center should be 50%, lower ~ 40.38%, upper ~ 59.62%
    ci_50_100 = calculate_wilson_ci(50, 100)
    assert 40.0 <= ci_50_100["lower"] <= 41.0
    assert 59.0 <= ci_50_100["upper"] <= 60.5
    assert ci_50_100["center"] == 50.0
    
    # 10 wins out of 10 trials: upper bound capped at <= 100%
    ci_perfect = calculate_wilson_ci(10, 10)
    assert ci_perfect["upper"] <= 100.0
    assert ci_perfect["lower"] > 65.0

def test_max_drawdown_calculation():
    """Verify peak-to-trough maximum drawdown calculation across sequence of PnL."""
    trades = [
        {"outcome": "WIN", "pnl": 10.0, "entry_time": "2026-09-24T10:00:00Z"},  # Cum: 10, Peak: 10, DD: 0
        {"outcome": "LOSS", "pnl": -15.0, "entry_time": "2026-09-24T10:01:00Z"}, # Cum: -5, Peak: 10, DD: 15
        {"outcome": "LOSS", "pnl": -5.0, "entry_time": "2026-09-24T10:02:00Z"},  # Cum: -10, Peak: 10, DD: 20
        {"outcome": "WIN", "pnl": 25.0, "entry_time": "2026-09-24T10:03:00Z"},  # Cum: 15, Peak: 15, DD: 0
        {"outcome": "LOSS", "pnl": -8.0, "entry_time": "2026-09-24T10:04:00Z"},  # Cum: 7, Peak: 15, DD: 8
    ]
    
    dd_stats = calculate_drawdown_and_streaks(trades)
    assert dd_stats["max_drawdown"] == 20.0

def test_longest_losing_streak():
    """Verify calculation of longest consecutive losing streak."""
    trades = [
        {"outcome": "WIN", "pnl": 8.0, "entry_time": "2026-09-24T10:00:00Z"},
        {"outcome": "LOSS", "pnl": -10.0, "entry_time": "2026-09-24T10:01:00Z"},
        {"outcome": "LOSS", "pnl": -10.0, "entry_time": "2026-09-24T10:02:00Z"},
        {"outcome": "LOSS", "pnl": -10.0, "entry_time": "2026-09-24T10:03:00Z"}, # 3 in a row
        {"outcome": "WIN", "pnl": 8.0, "entry_time": "2026-09-24T10:04:00Z"},
        {"outcome": "LOSS", "pnl": -10.0, "entry_time": "2026-09-24T10:05:00Z"},
        {"outcome": "LOSS", "pnl": -10.0, "entry_time": "2026-09-24T10:06:00Z"},
        {"outcome": "WIN", "pnl": 8.0, "entry_time": "2026-09-24T10:07:00Z"},
    ]
    
    stats = calculate_drawdown_and_streaks(trades)
    assert stats["longest_losing_streak"] == 3

def test_insufficient_evidence_threshold():
    """Verify that samples with fewer than 30 decisive trades trigger insufficient evidence flag."""
    small_sample = [
        {"outcome": "WIN", "pnl": 8.0, "is_mock": False, "was_entered": True}
        for _ in range(15)
    ]
    rep_small = calculate_performance_report(trades=small_sample, assessments=[], include_mock=False)
    assert rep_small["insufficient_evidence"] is True
    assert "Insufficient sample size" in rep_small["evidence_message"]

    adequate_sample = [
        {"outcome": "WIN", "pnl": 8.0, "is_mock": False, "was_entered": True}
        for _ in range(35)
    ]
    rep_adequate = calculate_performance_report(trades=adequate_sample, assessments=[], include_mock=False)
    assert rep_adequate["insufficient_evidence"] is False

def test_separation_of_mock_and_real_data():
    """Verify that mock simulation data is strictly isolated from live evaluation metrics."""
    trades = [
        {"outcome": "WIN", "pnl": 8.5, "is_mock": False, "was_entered": True},
        {"outcome": "LOSS", "pnl": -10.0, "is_mock": False, "was_entered": True},
        {"outcome": "WIN", "pnl": 8.5, "is_mock": True, "was_entered": True},
        {"outcome": "WIN", "pnl": 8.5, "is_mock": True, "was_entered": True},
    ]
    
    # With include_mock=False, should see only 1 Win, 1 Loss
    real_rep = calculate_performance_report(trades=trades, assessments=[], include_mock=False)
    assert real_rep["wins"] == 1
    assert real_rep["losses"] == 1
    assert real_rep["decisive_trades_count"] == 2
    assert real_rep["win_rate_percent"] == 50.0
    
    # With include_mock=True, should see 3 Wins, 1 Loss
    mock_rep = calculate_performance_report(trades=trades, assessments=[], include_mock=True)
    assert mock_rep["wins"] == 3
    assert mock_rep["losses"] == 1
    assert mock_rep["decisive_trades_count"] == 4
    assert mock_rep["win_rate_percent"] == 75.0

