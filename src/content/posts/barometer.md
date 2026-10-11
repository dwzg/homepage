---
title: A falling barometer does not mean rain on my balcony
summary: I scored the textbook rule against ninety days of observed rainfall. As a threshold, a falling barometer did worse than saying nothing at all.
date: 2026-09-23
project: weatherpage
---

Every weather-station manual says it: falling pressure means rain is coming. My page's first forecast leaned on exactly that, and I never checked it. When I finally did, it was wrong.

## How I measured it

I joined the station's own readings to observed hourly precipitation for the same location over 90 days, from the ERA5 reanalysis with a 2 km forecast series as an independent check. Then I scored each rule by how often rain actually followed within six hours.

For a yes/no rule, the useful score is the Kuipers skill score (KSS): the hit rate minus the false-alarm rate. Zero means the rule is no better than chance. Below zero means doing the opposite would be better.

## What came out

A six-hour pressure fall of more than 1 hPa scored **KSS −0.09**. Within the wettest conditions it was even worse: rising pressure was followed by rain more often than falling pressure was.

The rules it was part of scored −0.074 overall, which is worse than never forecasting rain at all.

A fixed pressure *level* did not transfer between months either. The same hPa threshold scored a critical success index of 0.05 in one month and 0.44 in another.

## What replaced it

Two signals survived:

- **Where today's pressure ranks** against the station's own last 30 days, as a percentile rather than a fixed number of hPa.
- **Humidity.**

That rank plus humidity is the whole rule ladder now. Its tiers line up with what actually happened: from 69% of hours followed by rain at the top tier down to 4% at the bottom, against a base rate of 21%. As a single yes/no "rain" call it scores KSS +0.27.

## It's not the tendency, it's the lone rule

The learned nowcast I trained later does use the pressure tendency, and it is the most valuable group of signals that model has. Removing all four pressure-change features cost 0.027 Brier skill, more than any other group.

That is not a contradiction. A falling barometer fails as a rule on its own. Inside a tree model, the same change gets read in context: a sharp rise behind a cold front means something very different from a slow rise under a high, and the trees learn which is which.

So the codebase now carries a note to my future self: don't reintroduce "falling barometer means rain" as a rule. It was measured, and it is wrong here.
