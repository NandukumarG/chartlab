import math
from typing import List, Dict, Any, Optional

def calculate_wilson_ci(wins: int, total_decisive: int, confidence: float = 0.95) -> Dict[str, float]:
    """
    Calculate the Wilson Score Interval for a binomial proportion.
    Labeled as an approximation that assumes independent trials; may be optimistic
    when market observations exhibit temporal autocorrelation.
    """
    if total_decisive <= 0:
        return {"lower": 0.0, "upper": 0.0, "center": 0.0}
    
    # 95% two-sided normal quantile: ~1.95996
    z = 1.959963984540054
    p_hat = wins / total_decisive
    n = total_decisive
    
    denominator = 1.0 + (z ** 2) / n
    center = (p_hat + (z ** 2) / (2 * n)) / denominator
    margin = (z / denominator) * math.sqrt((p_hat * (1 - p_hat) / n) + ((z ** 2) / (4 * (n ** 2))))
    
    lower = max(0.0, center - margin)
    upper = min(1.0, center + margin)
    
    return {
        "lower": round(lower * 100, 2),
        "upper": round(upper * 100, 2),
        "center": round(center * 100, 2)
    }

def calculate_drawdown_and_streaks(scored_trades: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Compute cumulative PnL cashflows, peak-to-trough maximum drawdown,
    and the longest consecutive losing streak.
    """
    if not scored_trades:
        return {
            "max_drawdown": 0.0,
            "longest_losing_streak": 0,
            "current_streak": 0,
            "equity_curve": []
        }
    
    # Sort chronologically by entry_time or created_at
    sorted_trades = sorted(scored_trades, key=lambda t: t.get("entry_time") or t.get("created_at") or "")
    
    cum_pnl = 0.0
    peak = 0.0
    max_dd = 0.0
    longest_losses = 0
    current_losses = 0
    equity_curve = [0.0]
    
    for t in sorted_trades:
        outcome = t.get("outcome", "").upper()
        pnl = float(t.get("pnl", 0.0))
        
        cum_pnl += pnl
        equity_curve.append(round(cum_pnl, 2))
        
        if cum_pnl > peak:
            peak = cum_pnl
        dd = peak - cum_pnl
        if dd > max_dd:
            max_dd = dd
            
        if outcome == "LOSS":
            current_losses += 1
            if current_losses > longest_losses:
                longest_losses = current_losses
        elif outcome == "WIN":
            current_losses = 0
        # DRAWS do not count as losses in streak
            
    return {
        "max_drawdown": round(max_dd, 2),
        "longest_losing_streak": longest_losses,
        "current_losing_streak": current_losses,
        "equity_curve": equity_curve
    }

def calculate_performance_report(
    trades: List[Dict[str, Any]],
    assessments: List[Dict[str, Any]],
    include_mock: bool = False
) -> Dict[str, Any]:
    """
    Generate comprehensive performance evaluation.
    Excludes WAIT, SKIPPED, MOCK, STALE, and UNRESOLVED records from the
    decisive win rate, while keeping their exact counts visible.
    """
    # Filter assessments
    filtered_assessments = [
        a for a in assessments
        if (include_mock or not a.get("is_mock"))
    ]
    
    total_assessments = len(filtered_assessments)
    wait_assessments = sum(1 for a in filtered_assessments if a.get("direction") == "WAIT")
    stale_assessments = sum(1 for a in filtered_assessments if a.get("is_stale"))
    actionable_assessments = total_assessments - wait_assessments
    
    # Filter trades
    filtered_trades = [
        t for t in trades
        if (include_mock or not t.get("is_mock"))
    ]
    
    # Categorize trades
    wins = 0
    losses = 0
    draws = 0
    skipped = 0
    unresolved = 0
    total_net_pnl = 0.0
    
    decisive_trades: List[Dict[str, Any]] = []
    
    for t in filtered_trades:
        outcome = (t.get("outcome") or "UNRESOLVED").upper()
        was_entered = t.get("was_entered", True)
        
        if not was_entered or outcome == "SKIPPED":
            skipped += 1
            continue
            
        if outcome == "WIN":
            wins += 1
            total_net_pnl += float(t.get("pnl", 0.0))
            decisive_trades.append(t)
        elif outcome == "LOSS":
            losses += 1
            total_net_pnl += float(t.get("pnl", 0.0))
            decisive_trades.append(t)
        elif outcome == "DRAW":
            draws += 1
            total_net_pnl += float(t.get("pnl", 0.0))
        else:
            unresolved += 1
            
    total_completed_scored = wins + losses + draws
    total_decisive = wins + losses  # Decisive denominator
    
    win_rate = round((wins / total_decisive) * 100, 2) if total_decisive > 0 else 0.0
    draw_rate = round((draws / total_completed_scored) * 100, 2) if total_completed_scored > 0 else 0.0
    
    wilson_ci = calculate_wilson_ci(wins, total_decisive)
    dd_stats = calculate_drawdown_and_streaks(decisive_trades)

    # Map assessment id -> pattern names, so real logged trade outcomes can be
    # attributed to the chart pattern that was actually identified for them.
    # This is the only legitimate source of "backtest" data in this app: a
    # single screenshot has no history behind it, but a trade linked to a past
    # assessment does.
    assessment_patterns: Dict[str, List[str]] = {}
    for a in filtered_assessments:
        assessment_id = a.get("id")
        pattern_names = [p.get("name") for p in (a.get("patterns") or []) if p.get("name")]
        if assessment_id and pattern_names:
            assessment_patterns[assessment_id] = pattern_names

    # Breakdowns by Asset, Observation/Expiry Duration, Strategy Version, and
    # real per-pattern historical performance from logged trade outcomes.
    breakdowns = {
        "by_asset": {},
        "by_expiry": {},
        "by_strategy_version": {},
        "by_pattern": {}
    }

    for t in decisive_trades:
        asset = t.get("asset", "Unknown")
        expiry = t.get("observation_duration", "Unknown")
        version = t.get("strategy_version") or "v1.0.0"
        outcome = t.get("outcome", "").upper()
        pnl = float(t.get("pnl", 0.0))

        # Trades not linked to an assessment (or whose assessment had no
        # recognized pattern) are excluded from by_pattern - there is nothing
        # real to attribute them to.
        pattern_names = assessment_patterns.get(t.get("assessment_id"), [])

        groupings = [
            ("by_asset", asset),
            ("by_expiry", expiry),
            ("by_strategy_version", version)
        ] + [("by_pattern", name) for name in pattern_names]

        for category, key in groupings:
            if key not in breakdowns[category]:
                breakdowns[category][key] = {"wins": 0, "losses": 0, "pnl": 0.0}
            if outcome == "WIN":
                breakdowns[category][key]["wins"] += 1
            elif outcome == "LOSS":
                breakdowns[category][key]["losses"] += 1
            breakdowns[category][key]["pnl"] = round(breakdowns[category][key]["pnl"] + pnl, 2)

    # Calculate group win rates plus a real Wilson CI per group, so a thin
    # pattern sample is flagged as unreliable exactly like the aggregate stats.
    for cat in breakdowns:
        for k, v in breakdowns[cat].items():
            tot = v["wins"] + v["losses"]
            v["win_rate"] = round((v["wins"] / tot) * 100, 2) if tot > 0 else 0.0
            v["total"] = tot
            group_ci = calculate_wilson_ci(v["wins"], tot)
            v["wilson_95_ci"] = {"lower_percent": group_ci["lower"], "upper_percent": group_ci["upper"]}
            v["insufficient_evidence"] = tot < 30

    # Insufficient evidence flag for small samples
    insufficient_evidence = total_decisive < 30
    evidence_message = (
        "Insufficient sample size (n < 30 decisive trades). "
        "Observed rates lack statistical significance and cannot confirm a repeatable edge."
        if insufficient_evidence else
        "Sample size meets minimal sample threshold (n >= 30), but forward-testing validation remains required."
    )
    
    validation_disclaimer = (
        "CAUTION: A strategy cannot be declared validated merely because a trade-count threshold "
        "or an 80% observed win rate has been reached. Quotex broker payout haircuts (~80-85% vs 100% loss) "
        "and OTC price quotation structures require sustained statistical edge after accounting for slippage."
    )
    
    return {
        "total_assessments_issued": total_assessments,
        "actionable_assessments": actionable_assessments,
        "wait_assessments_excluded": wait_assessments,
        "stale_assessments_excluded": stale_assessments,
        "total_completed_scored_trades": total_completed_scored,
        "decisive_trades_count": total_decisive,
        "wins": wins,
        "losses": losses,
        "draws": draws,
        "skipped": skipped,
        "unresolved": unresolved,
        "win_rate_percent": win_rate,
        "win_rate_denominator_description": f"Wins ({wins}) / Decisive Trades ({total_decisive}) [Excludes Draws, Skipped, WAIT, Unresolved]",
        "draw_rate_percent": draw_rate,
        "wilson_95_ci": {
            "lower_percent": wilson_ci["lower"],
            "upper_percent": wilson_ci["upper"],
            "description": "Approximate 95% Wilson Score Interval (assumes independent trials; may be optimistic under autocorrelation)"
        },
        "net_demo_pnl": round(total_net_pnl, 2),
        "max_drawdown": dd_stats["max_drawdown"],
        "longest_losing_streak": dd_stats["longest_losing_streak"],
        "insufficient_evidence": insufficient_evidence,
        "evidence_message": evidence_message,
        "validation_disclaimer": validation_disclaimer,
        "breakdowns": breakdowns,
        "is_mock_data": include_mock
    }

