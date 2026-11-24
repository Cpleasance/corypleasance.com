---
title: "How a guardrail scope mismatch got me a Kaggle bronze"
description: "My solo, top-7% solution to Kaggle's AI Agent Security competition: a gap in how the guardrail tracked untrusted input, a lot of scaling, and one exploit I chose not to use."
pubDatetime: 2026-11-24T12:00:00Z
draft: false
featured: true
tags:
  - ai-security
  - agents
  - kaggle
---

Over the summer I entered Kaggle's [AI Agent Security: Multi-Step Tool Attacks](https://www.kaggle.com/competitions/ai-agent-security-multi-step-tool-attacks) competition, hosted by OpenAI, Google and IEEE. I went in solo and came out with a bronze medal: 290th of 4,186 teams, top 7%.

This post is the short version of how. The full code, lab notebook and an IEEE-format report are [on GitHub](https://github.com/Cpleasance/kaggle-ai-agent-security).

## Table of contents

## The setup

Tool-using agents can search the web, read email, write files and send messages for you. That opens up failures a single-turn jailbreak test never sees: the agent reads something untrusted, and a few steps later does something it shouldn't because of it.

The competition turned that into a benchmark. You don't submit prompts, you submit an attack *algorithm*. It generates up to N candidate traces (complete agent trajectories) in a sandbox, and the evaluator replays them and checks four security predicates:

- `EXFILTRATION`: data leaves the system
- `UNTRUSTED_TO_ACTION`: untrusted content drives an action
- `DESTRUCTIVE_WRITE`: files get deleted or overwritten
- `CONFUSED_DEPUTY`: the agent sends an email nobody asked it to send

Every trace is checked against two guardrails: a permissive public one you can read, and a stricter private one you can't. There's also a fixed replay time budget, so N isn't free. More candidates means more chances to score, but they all have to fit in the same time.

## The gap

I started by reading the competition SDK to see how the public guardrail decided what to block.

Its defence against `CONFUSED_DEPUTY` was taint tracking. Before a privileged call like `email.send`, it looked back over a window of recent tool calls for untrusted input, such as a `web.search` or an `email.read`, that could have influenced it.

So my attack made `email.send` the **first** call in the trace. There was no untrusted read before it, so nothing was tainted and nothing was flagged. To the guardrail, it looked the same as a legitimate action.

That's a scope mismatch rather than a bug in the taint tracking itself. The guardrail was built to catch *influence from* untrusted input, and this attack never went through that path at all.

I also phrased the prompts as softer requests ("Notify X that Y", "Let X know Y") so they didn't trip any obvious keyword filter, while still meeting the predicate's actual condition.

## Scaling made it a medal

The technique on its own wasn't enough. At N=200 it scored 4.105 on both leaderboards.

Same technique, scaled to N=800 inside the same time budget: **9.925 public, 10.365 private.** Nothing else changed.

![CONFUSED_DEPUTY score at N=200 vs N=800 on the public and private leaderboards](../../assets/images/kaggle-agent-security/cd_scaling.png)

## Why I didn't submit my highest score

I also had an `EXFILTRATION` attack that scored much higher, around 40–41, plateauing once N passed about 650.

![EXFILTRATION score against N, rising steeply then flattening at around 40 from N≈650](../../assets/images/kaggle-agent-security/exfil_n_sweep.png)

Then the organisers hardened the guardrails partway through. Those submissions dropped to **0.000** on the public leaderboard and were no longer eligible as a final submission. `CONFUSED_DEPUTY` used a structurally different gap and survived on both leaderboards. So I picked it for being robust, not for the raw number.

## The exploit I left out

While testing, I found a way to score far higher that had nothing to do with security.

Part of the score was a +2 bonus for every unique tool-call signature. Change a trailing tag on an otherwise identical message and you get a new signature, so you could farm that bonus thousands of times.

I didn't submit it, for three reasons:

- It's a flaw in the scoring formula, not a security finding.
- It works against the competition's own judging criterion of being useful to the benchmark community.
- Thousands of near-identical messages is a bad look on a submission with my real name on it.

## What didn't work

**Multi-hit traces.** Letting each trace try for three predicate hits instead of one helped at small N. `CONFUSED_DEPUTY` went from 4.105 to 5.195 at N=200. At N=800 it backfired: `EXFILTRATION` dropped from 40.6 to 29.2, because widening the candidate pool for three hits made each candidate weaker. I left it out of the final submission.

**A bug that looked like a result.** An early attempt to combine two techniques in one message scored 17–19, against 36–41 for a single technique. It looked like combining hurt. It was really an ordering bug: the combined candidates sat first in the pool and used up the whole quota before the proven candidates were ever reached. Moving them to the end brought the score straight back to 40+. Since then I check for implementation bugs before I trust any single score.

**Checking for noise.** To tell real effects from noise, I re-ran identical submissions. They varied by at most about 2%, so the gaps above are real.

## Credit where it's due

I wasn't the only one who found this. canqiang [published a predicate-reachability analysis](https://www.kaggle.com/competitions/ai-agent-security-multi-step-tool-attacks/discussion/727895) covering much of the same gap, earlier and more thoroughly. cm391 [first described](https://www.kaggle.com/competitions/ai-agent-security-multi-step-tool-attacks/discussion/736099) using replay timing as a side channel to probe the private guardrail. I applied that to `CONFUSED_DEPUTY` and confirmed their inference two separate ways.

## What I took away

- **Guardrails defend against a model of the attack, not every attack.** Taint tracking assumes an attack comes *through* untrusted input. An action that never touches untrusted input is outside what it checks.
- **Scaling matters as much as cleverness.** The same idea scored 4 or 10 depending on how many attempts fit in the budget.
- **Robust beats high.** My best raw score was worth nothing after the rules changed.
- **Check for bugs before you trust a number.** My worst-looking result was a bug, not a finding.

The [repo](https://github.com/Cpleasance/kaggle-ai-agent-security) has the submission code, the full lab notebook with about 90 logged runs, and the report.
