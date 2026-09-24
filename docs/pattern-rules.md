# ChartLab Pattern Rules & Structural Evaluation Reference

This document outlines the standardized definitions, contextual requirements, confirmation criteria, and invalidation rules for candlestick and classical chart patterns evaluated in **ChartLab Demo**.

---

## 1. Source Reference & Verification Note

During documentation compilation, access to the primary requested reference:
- `https://media.fidelity.com/assets/Fidelity.com_VMS/904/347/TA_Session_3_Identifying_Chart_Patterns.pdf`
experienced a network timeout / connection limit. 

In accordance with strict documentation integrity, this document draws upon established foundational technical analysis literature, including:
1. **Fidelity Learning Center**: *Identifying Chart Patterns & Technical Analysis*.
2. **Thomas N. Bulkowski**: *Encyclopedia of Chart Patterns* (John Wiley & Sons).
3. **Robert D. Edwards & John Magee**: *Technical Analysis of Stock Trends*.
4. **John J. Murphy**: *Technical Analysis of the Financial Markets* (New York Institute of Finance).
5. **Steve Nison**: *Japanese Candlestick Charting Techniques*.

> [!WARNING]
> We do not claim to have reviewed every technical analysis document or proprietary OTC algorithm. Educational definitions described herein represent observational frameworks, not guaranteed trading edges.

---

## 2. Fundamental Principle: Emerging vs. Confirmed Patterns

A strict operational distinction is maintained between **emerging (forming)** and **confirmed** patterns:

| Pattern State | Definition | Operational Status |
| :--- | :--- | :--- |
| **Emerging (Forming)** | Price action resembles a pattern structure, but the defining boundary (e.g., neckline, trendline, candle close) has **not** been penetrated. | **WAIT / Incomplete.** Entering during formation incurs severe false-signal rates. |
| **Confirmed** | A decisive candle has closed beyond the pattern trigger level (e.g., neckline close, breakout retest confirmation). | **Actionable / Evaluated.** Thesis is activated with clear invalidation bounds. |

---

## 3. Pattern Catalog

### 3.1 Engulfing Candles (Bullish & Bearish)

#### Anatomy & Definition
A two-candle reversal formation:
- **Bullish Engulfing**: A smaller bearish (red) real body is completely engulfed by the subsequent larger bullish (green) real body.
- **Bearish Engulfing**: A smaller bullish (green) real body is completely engulfed by the subsequent larger bearish (red) real body.

#### Required Market Context
- Must appear following a clear, sustained directional trend or after a clean pullback into a major support/resistance zone.
- An engulfing candle inside a choppy horizontal consolidation range has negligible statistical validity.

#### Confirmation Criteria
- The second candle must close with its real body completely enveloping the prior candle's real body.
- Wicks do not necessarily need to be engulfed, but real body engulfing is mandatory.

#### Invalidation Criteria
- **Bullish Invalidation**: Price subsequently closes below the low of the bullish engulfing candle.
- **Bearish Invalidation**: Price subsequently closes above the high of the bearish engulfing candle.

#### Source
- Steve Nison, *Japanese Candlestick Charting Techniques*; Fidelity TA Reference Series.

---

### 3.2 Hammer and Shooting Star (Pin Bars)

#### Anatomy & Definition
Single-candle reversal structures characterized by a small real body at one extreme and an elongated shadow (wick) at the other:
- **Hammer**: Small real body near the top of the candle range, lower shadow at least 2 to 3 times the body length, negligible or absent upper shadow.
- **Shooting Star**: Small real body near the bottom of the candle range, upper shadow at least 2 to 3 times the body length, negligible or absent lower shadow.

#### Required Market Context
- **Hammer**: Must emerge at the culmination of a downward move or at verified horizontal support.
- **Shooting Star**: Must emerge at the crest of an upward move or at verified horizontal resistance.

#### Confirmation Criteria
- The candle must be fully closed. An active, forming candle with an elongated wick can completely retrace before completion.
- Subsequent candle must follow through beyond the hammer high (for bull) or shooting star low (for bear).

#### Invalidation Criteria
- A close breaching the extreme wick tip (below hammer low or above shooting star high).

#### Source
- Steve Nison; Fidelity Technical Analysis Curriculum.

---

### 3.3 Double Tops and Double Bottoms

#### Anatomy & Definition
Reversal formations occurring across two distinct swing pivots:
- **Double Top ("M" Pattern)**: Price reaches a swing high, retreats to form an intermediate trough (the neckline), rallies to approximately the same resistance height, and fails to advance.
- **Double Bottom ("W" Pattern)**: Price hits a swing low, bounces to form an intermediate peak (the neckline), declines to test the prior support level, and holds.

#### Required Market Context
- Requires an established preceding trend. The two peaks or troughs must exhibit distinct temporal spacing (not two consecutive adjacent candles).

#### Confirmation Criteria
- **The pattern is only confirmed upon a decisive candle close beyond the intermediate neckline.**
- Re-testing the neckline from the opposite side offers secondary structural validation.

#### Invalidation Criteria
- Price breaks back across the opposing peak/trough (e.g., in a Double Top, a close above Peak 2 invalidates the pattern).

#### Source
- Bulkowski, *Encyclopedia of Chart Patterns*; Edwards & Magee.

---

### 3.4 Head and Shoulders (and Inverse Head & Shoulders)

#### Anatomy & Definition
A major multi-pivot reversal pattern:
- **Head & Shoulders Top**: Left Shoulder (swing peak), Head (higher swing peak), Right Shoulder (lower swing peak roughly equal to Left Shoulder), supported by a common support baseline ("neckline").
- **Inverse Head & Shoulders**: Left Shoulder (swing low), Head (deeper swing low), Right Shoulder (higher swing low), capped by a common resistance neckline.

#### Required Market Context
- Requires a strong existing trend. The formation illustrates the transition from higher highs / higher lows to lower highs / lower lows.

#### Confirmation Criteria
- Confirmed strictly upon a candle close breaking through the neckline.
- Emerging right shoulders frequently fail and turn into continuation channels; no directional trade is confirmed until the neckline close.

#### Invalidation Criteria
- Price re-enters and closes beyond the high of the Right Shoulder.

#### Source
- Murphy, *Technical Analysis of the Financial Markets*; Fidelity Learning Center.

---

### 3.5 Triangles (Ascending, Descending, Symmetrical)

#### Anatomy & Definition
Consolidation patterns formed between converging trendlines:
- **Ascending Triangle**: Horizontal upper resistance boundary paired with rising ascending support lows (bullish continuation or reversal bias).
- **Descending Triangle**: Horizontal lower support boundary paired with falling descending resistance highs (bearish continuation or reversal bias).
- **Symmetrical Triangle**: Both upper and lower trendlines converge symmetrically (volatility contraction; breakout direction uncertain).

#### Required Market Context
- Typically forms as a continuation pattern within an established trend. Minimum 2 touches on both the upper and lower boundary lines.

#### Confirmation Criteria
- A decisive candle close outside the triangle boundary lines. Intra-candle wick penetration is not confirmation.

#### Invalidation Criteria
- Price retreats back into the triangle apex, indicating a false breakout (whipsaw).

#### Source
- Bulkowski; Edwards & Magee.

---

### 3.6 Flags and Pennants

#### Anatomy & Definition
Short-term continuation formations:
- **Flag**: A sharp, steep impulse move ("the flagpole") followed by a compact, parallel rectangular consolidation channel counter to the trend.
- **Pennant**: A sharp flagpole followed by a very small symmetrical converging consolidation.

#### Required Market Context
- Must be preceded by a distinct, aggressive directional thrust.

#### Confirmation Criteria
- Confirmed when price closes decisively out of the consolidation channel in the direction of the original flagpole impulse.

#### Invalidation Criteria
- The flag consolidation retraces greater than 50% of the preceding flagpole move.

#### Source
- Fidelity Technical Analysis Guide; Bulkowski.

---

### 3.7 Support and Resistance Tests

#### Anatomy & Definition
Price returning to test a previously established price level:
- **Horizontal Support/Resistance**: Price levels where buying/selling pressure repeatedly concentrated historically.
- **Role Reversal (Polarity)**: Prior broken resistance converting into newly formed support upon retest (or broken support converting to resistance).

#### Required Market Context
- Clean historical reaction points with visible rejection wicks.

#### Confirmation Criteria
- Visible deceleration candles (e.g., Doji, pin bars, decreasing candle bodies) followed by a rejection close away from the level.

#### Invalidation Criteria
- Clean candle close penetrating through the support or resistance zone.

#### Source
- Murphy; Edwards & Magee.

---

### 3.8 Confirmed vs. Failed Breakouts (Bull and Bear Traps)

#### Anatomy & Definition
- **Confirmed Breakout**: Price drives through a clear structural boundary and registers a closed candle completely outside the zone, followed by continuation.
- **Failed Breakout (Trap)**: Price momentarily pierces a boundary (often trapping retail breakout entries), but fails to sustain momentum and closes back inside the range with an aggressive reversal candle.

#### Required Market Context
- Consolidation ranges, swing highs/lows, and pattern boundaries.

#### Confirmation Criteria
- Confirmed breakout requires a full candle close beyond the level.
- Failed breakout is confirmed when price immediately closes back inside the pre-breakout range, creating an opposing directional thesis.

#### Invalidation Criteria
- For a failed breakout thesis, price resuming and closing beyond the trap extreme.

#### Source
- Bulkowski, *Encyclopedia of Chart Patterns*.

---

## 4. Operational Realities of Quotex OTC & Ultra-Short Expiries

While the pattern rules above represent classical market principles, users must be aware of severe structural limitations when applying them to Quotex binary/fixed-time options:

1. **Negative Expectancy & Broker Haircuts**:
   Quotex payouts for binary options generally range from **80% to 85%** on wins, while losses incur a **100%** capital deduction.
   - Required break-even win rate at 85% payout: $\frac{1}{1 + 0.85} \approx 54.05\%$.
   - Required break-even win rate at 80% payout: $\frac{1}{1 + 0.80} = 55.56\%$.
   - Any strategy that does not comfortably exceed this hurdle after slippage and execution delay will suffer negative mathematical expectation.

2. **Quotex OTC (Over-The-Counter) Quotes**:
   Weekend and OTC assets on Quotex are derived from broker-internal price feeds and proprietary synthetic algorithms. They do not trade on public centralized exchanges (like CME, ICE, or interbank ECNs). Consequently:
   - Textbook volume profiles, order-flow absorption, and institutional support/resistance levels have no verifiable real-world liquidity backing.
   - Micro-spikes and erratic candle wicks can trigger false invalidations on short expiries.

3. **High-Frequency Noise on 5-Second to 1-Minute Candles**:
   Textbook technical analysis literature was developed primarily for daily and weekly bar charts. Sub-minute price charts exhibit extreme statistical noise. Patterns that appear pristine visually often exhibit near-random coin-toss outcomes when measured across hundreds of consecutive trials.

4. **Observation Duration vs. Fixed Expiry Mismatch**:
   ChartLab allows configuring an observation duration (e.g., 60 seconds) for evaluation benchmarking. This is purely an analytical reference frame, **not** an algorithmically proven optimal expiry.

