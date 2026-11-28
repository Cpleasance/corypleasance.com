---
title: "Six months of waiting on a model I couldn't change: Hull Tactical"
description: "My solo, top-13% finish in Kaggle's Hull Tactical Market Prediction: a small, heavily regularised XGBoost, a leveraged allocation rule, and a look at what I got right and what I'd do differently."
pubDatetime: 2026-11-27T12:00:00Z
draft: false
featured: false
tags:
  - machine-learning
  - finance
  - kaggle
repoUrl: "https://github.com/Cpleasance/hull-tactical-market-prediction"
readingTime: "9 min read"
---

Last winter I entered Kaggle's [Hull Tactical Market Prediction](https://www.kaggle.com/competitions/hull-tactical-market-prediction) competition. I went in solo and finished 479th of 3,677 teams, top 13%.

That's a decent result, but this competition was different from my others. You lock your model in December and then wait six months while it trades the real market. So this post is less "here's the trick" and more an honest look at what I did well, what I got lucky on, and what I'd change.

The full code, with both locked submissions, is [on GitHub](https://github.com/Cpleasance/hull-tactical-market-prediction).

## The setup

Each day you get a row of anonymised features (market, macro, sentiment, volatility and so on) and you output one number: how much of the S&P 500 to hold, from 0 to 2. Zero is all cash, 1 is fully invested, 2 is double leverage.

There's no stock picking involved. Everything is about the S&P 500 index as a whole: one number a day for one asset.

The score is a modified Sharpe ratio. Your strategy's daily return is

$$
r_t = a_t \cdot R_t + (1 - a_t) \cdot r^f_t
$$

where $a_t$ is your allocation, $R_t$ the market return and $r^f_t$ the risk-free rate. The Sharpe ratio of that series is then divided by two penalties: one if your volatility goes more than 20% above the market's, and one if you return less than just holding the index.

The important part is the timeline. Submissions closed in mid-December 2025. After that, Kaggle re-ran every locked notebook on new market data roughly once a month until June 2026. No changes allowed.

## What I built

The final model was deliberately small. Out of 94 raw features I built lags (1, 2 and 3 days) and 20-day rolling volatility, which got me to 274. An initial XGBoost picked the top 30% by importance, and a second XGBoost trained on those:

```python
"xgboost": {
    "n_estimators": 100,
    "max_depth": 3,          # shallow trees
    "min_child_weight": 10,
    "gamma": 0.5,
    "reg_alpha": 1.0,
    "reg_lambda": 10.0,      # heavy L2
    "subsample": 0.7,
    "colsample_bytree": 0.7,
}
```

Daily market returns are almost pure noise, so I wanted a model that couldn't memorise much. The model predicts the excess return, and a separate rule turns that into an allocation:

```python
def allocation(signal, alpha):
    z = signal / signal_std               # normalise the prediction
    alloc = 1.0 + kelly_fraction * alpha * z
    return np.clip(alloc, 0.0, 2.0)       # 0 = cash, 2 = 2x leverage
```

Start fully invested, lean in when the model is bullish, pull back when it's bearish.

Everything was validated with purged walk-forward cross-validation: five folds of 250 days, each trained only on the past, with a gap and a purge window between train and test so overlapping returns couldn't leak across. I also reimplemented the competition metric locally so the CV number meant the same thing as the leaderboard.

## Two submissions

I locked in two versions:

- **v32**: the model above.
- **v38**: the same, plus an autoencoder to compress the features first.

v38 had a bug. The autoencoder returned the _reconstructed_ features instead of the compressed ones, so it was really just adding a noisy copy of the input. Its CV was slightly worse (0.88 against 0.93), so I picked v32 as the one I trusted more.

Then I waited. Here's how both did at each monthly rerun:

<figure class="not-prose my-8"><svg viewBox="0 0 480 300" role="img" aria-label="Grouped bar chart: live score for v32 and v38 at each monthly rerun. Jan 3.545 and 3.575, Feb 2.000 and 1.924, Mar -0.280 and -0.615, Apr 0.857 and 0.246, May 1.413 and 1.610, final 1.588 and 1.065." style="width:100%;max-width:600px;height:auto;font-family:inherit;font-size:14px"><g aria-hidden="true"><text x="0" y="18" style="fill:var(--foreground);font-weight:600">Live score at each monthly rerun</text><rect x="0" y="32" width="12" height="12" rx="2" style="fill:var(--accent)"/><text x="18" y="42" style="fill:var(--foreground)">v32 (no autoencoder)</text><rect x="190" y="32" width="12" height="12" rx="2" style="fill:var(--accent);fill-opacity:.45"/><text x="208" y="42" style="fill:var(--foreground)">v38 (autoencoder)</text><line x1="36" x2="472" y1="270.0" y2="270.0" style="stroke:var(--muted-foreground);stroke-opacity:.25" stroke-width="1"/><text x="28" y="275.0" text-anchor="end" style="fill:var(--muted-foreground)">-1</text><line x1="36" x2="472" y1="230.0" y2="230.0" style="stroke:var(--muted-foreground);" stroke-width="1"/><text x="28" y="235.0" text-anchor="end" style="fill:var(--muted-foreground)">0</text><line x1="36" x2="472" y1="190.0" y2="190.0" style="stroke:var(--muted-foreground);stroke-opacity:.25" stroke-width="1"/><text x="28" y="195.0" text-anchor="end" style="fill:var(--muted-foreground)">1</text><line x1="36" x2="472" y1="150.0" y2="150.0" style="stroke:var(--muted-foreground);stroke-opacity:.25" stroke-width="1"/><text x="28" y="155.0" text-anchor="end" style="fill:var(--muted-foreground)">2</text><line x1="36" x2="472" y1="110.0" y2="110.0" style="stroke:var(--muted-foreground);stroke-opacity:.25" stroke-width="1"/><text x="28" y="115.0" text-anchor="end" style="fill:var(--muted-foreground)">3</text><line x1="36" x2="472" y1="70.0" y2="70.0" style="stroke:var(--muted-foreground);stroke-opacity:.25" stroke-width="1"/><text x="28" y="75.0" text-anchor="end" style="fill:var(--muted-foreground)">4</text><rect x="43.3" y="88.2" width="28" height="141.8" rx="3" style="fill:var(--accent);fill-opacity:1"><title>Jan, v32: 3.545</title></rect><rect x="73.3" y="87.0" width="28" height="143.0" rx="3" style="fill:var(--accent);fill-opacity:0.45"><title>Jan, v38: 3.575</title></rect><text x="72.3" y="292" text-anchor="middle" style="fill:var(--foreground)">Jan</text><rect x="116.0" y="150.0" width="28" height="80.0" rx="3" style="fill:var(--accent);fill-opacity:1"><title>Feb, v32: 2.000</title></rect><rect x="146.0" y="153.0" width="28" height="77.0" rx="3" style="fill:var(--accent);fill-opacity:0.45"><title>Feb, v38: 1.924</title></rect><text x="145.0" y="292" text-anchor="middle" style="fill:var(--foreground)">Feb</text><rect x="188.7" y="230.0" width="28" height="11.2" rx="3" style="fill:var(--accent);fill-opacity:1"><title>Mar, v32: -0.280</title></rect><rect x="218.7" y="230.0" width="28" height="24.6" rx="3" style="fill:var(--accent);fill-opacity:0.45"><title>Mar, v38: -0.615</title></rect><text x="217.7" y="292" text-anchor="middle" style="fill:var(--foreground)">Mar</text><rect x="261.3" y="195.7" width="28" height="34.3" rx="3" style="fill:var(--accent);fill-opacity:1"><title>Apr, v32: 0.857</title></rect><rect x="291.3" y="220.2" width="28" height="9.8" rx="3" style="fill:var(--accent);fill-opacity:0.45"><title>Apr, v38: 0.246</title></rect><text x="290.3" y="292" text-anchor="middle" style="fill:var(--foreground)">Apr</text><rect x="334.0" y="173.5" width="28" height="56.5" rx="3" style="fill:var(--accent);fill-opacity:1"><title>May, v32: 1.413</title></rect><rect x="364.0" y="165.6" width="28" height="64.4" rx="3" style="fill:var(--accent);fill-opacity:0.45"><title>May, v38: 1.610</title></rect><text x="363.0" y="292" text-anchor="middle" style="fill:var(--foreground)">May</text><rect x="406.7" y="166.5" width="28" height="63.5" rx="3" style="fill:var(--accent);fill-opacity:1"><title>Final, v32: 1.588</title></rect><rect x="436.7" y="187.4" width="28" height="42.6" rx="3" style="fill:var(--accent);fill-opacity:0.45"><title>Final, v38: 1.065</title></rect><text x="435.7" y="292" text-anchor="middle" style="fill:var(--foreground);font-weight:600">Final</text></g></svg></figure>

January looked brilliant. March was underwater. By the end v32 finished at **1.588** on the private leaderboard and v38 at 1.065, so the version I trusted did come out ahead, though not every month.

## What the market was doing

The six months weren't calm. Going by the [S&P 500 data on FRED](https://fred.stlouisfed.org/series/SP500):

- **January and February** were quiet. The index barely moved, and the VIX (the market's "fear gauge") sat around 16 to 19.
- **March** was the shock. US and Israeli strikes on Iran, and Iran's retaliation, sent Brent crude from about \$71 to \$113 a barrel. The VIX closed above 30 and the S&P fell 5.1% for the month ([S&P Global](https://www.spglobal.com/market-intelligence/en/news-insights/articles/2026/4/major-us-stock-indexes-fall-over-5-in-march-100297973)). That's my negative rerun.
- **April** was the opposite: up 10.4%, the index's best month since 2020, led by tech and strong earnings ([ThinkAdvisor](https://www.thinkadvisor.com/2026/04/30/sp-500-hits-record-set-for-best-month-since-2020/)).

So was my score just the market? To check, I worked out what simply holding the index (an allocation of 1 every day) would have scored on the same metric at each rerun date:

| Rerun | Hold the index |      v32 |
| :---- | -------------: | -------: |
| Jan   |           0.49 |     3.55 |
| Feb   |           0.01 |     2.00 |
| Mar   |          −1.40 |    −0.28 |
| Apr   |           0.63 |     0.86 |
| May   |           1.27 |     1.41 |
| Final |           0.80 | **1.59** |

The swings were mostly the market: when it fell, I fell. But v32 finished ahead of just holding at every rerun, and lost far less in March. That's the most encouraging number in this post, with the caveat that six months is a short sample.

These are my own approximations from public data (the S&P 500 price index, with the fed funds rate as the risk-free rate), not Kaggle's exact numbers, and I don't know exactly which day each rerun's data stopped at.

## What I did well

**I kept the model small.** With about 9,000 daily rows and a target that is mostly noise, a deep model would have fitted the past beautifully and the future badly. Three-level trees with heavy regularisation were the right call, and I'd do the same again.

**I validated on time, not at random.** Random K-fold on market data lets the model peek at the future. Purged walk-forward CV is slower to set up, but it's the only version of the number that means anything.

**I scored myself on the real metric.** The penalties in the competition metric change what a good model looks like. A model with a great raw Sharpe can still lose if its volatility is too high. Having that locally stopped me optimising the wrong thing.

**I picked the submission on evidence.** v38 led in January and May, and it would have been easy to second-guess. But I'd chosen v32 on CV and a known bug in v38, and that held up at the end.

## What I could have done better

**I hill-climbed a leaderboard that couldn't tell me anything.** During the build phase, the public leaderboard was, in the data page's own words, "a copy of the last 180 date IDs in the train set", and "the public leaderboard scores are not meaningful." I went through about 20 versions in December and watched the score creep from 0.40 to 0.65. My notebook header from that week literally says "Signal is strong, keep pushing." It wasn't a signal. It was the model being graded on data it had seen. The CV was the only honest number I had, and I should have ignored the leaderboard entirely.

**My CV was too noisy to choose between versions.** v32's competition metric across the five folds was 2.01, −0.57, 1.04, 1.82 and 0.35. That's a mean of 0.93 with a standard deviation of 0.95. Any tweak that moved the mean by 0.05 was well inside the noise, but I was treating changes that size as wins. More folds, or repeating CV over different start points, would have told me which changes were real.

**I tuned the allocation on in-sample predictions.** The allocation search picked `alpha` by scoring the model's predictions on its _own_ training fold, where R² was 0.68. On the validation folds R² was −0.08. Of course the in-sample predictions said "bet bigger": they were overfit. It picked 1.1, the top of the grid, and a search that lands on the edge of its grid is a red flag I should have caught. Tuning it on out-of-fold predictions would have been honest.

**My training and serving features didn't match.** The evaluation gateway hands `predict()` one day at a time. My lag and rolling-volatility features are computed with `shift()` and `rolling_std()` on whatever frame comes in, and on a single row those are all empty. The code quietly filled them with their training medians. So a good chunk of the features the model learned from were constants at inference. Keeping a rolling history of past rows inside the predict function would have fixed it, and a simple test of "do the features at inference match the features in training for the same date?" would have caught it.

**I wrote a story instead of running a test.** After locking in, I wrote a long analysis arguing my high-leverage strategy was a bet on volatility returning, with probability tables for every possible market shock. It was fun to write, and none of it could change the outcome. The volatility I'd written pages about did turn up, but from a war rather than the AI earnings I'd focused on, and my score still went negative that month. What actually helped was losing less than the market, which the story never mentioned. If I'd spent that time on the CV noise or the feature mismatch before the deadline, I'd have learnt more.

## What I took away

- **Know what your leaderboard is scoring.** If it overlaps your training data, it's measuring memory, not skill.
- **Measure your noise before you measure your improvements.** A fold spread as wide as your mean means most of your "wins" aren't real.
- **Tune every knob out of sample.** Including the ones that sit after the model, like position sizing.
- **Test that serving matches training.** It's one assertion, and it would have caught my biggest bug.
- **Small, regularised models are a good default on noisy data.** That part I'd keep.

Top 13% with a model that had a train/serve bug in it tells me the fundamentals were sound. Next time I want the result to come from the model working as designed, not in spite of it.
