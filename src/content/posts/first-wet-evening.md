---
title: The model said 11% on the first wet evening
summary: A rain nowcast fitted to one summer of balcony readings, the October night it failed, and why it is now trained on fourteen years of weather-service stations instead.
date: 2026-10-04
project: weatherpage
---

My weather page shows a rain chance: the probability of at least 0.2 mm of rain here in the next six hours. Until this month that number came from a logistic regression fitted to the balcony's own archive. That was about 1,600 labelled hours, and every one of them came from a single summer.

On paper it was fine. It scored a Brier skill of 0.296 against simply predicting the base rate.

Then the first wet October evening arrived. The sensor read 100% humidity and the temperature had dropped 4.4 °C in three hours. The model said 11%.

## What it had actually learned

A summer teaches a model that cool air is dry air. The temperature coefficient came out at +1.22 per standard deviation, against a training mean of 22.7 °C, so warmer meant wetter. It had also learned that a high barometer means no rain. A cold, saturated autumn evening looked to it like the least rainy hour it had ever seen.

The 0.296 was a summer-only number. Measured properly, on weather-service data, a model of that kind fitted to one summer scores a Brier skill of 0.08–0.11 over the following year, and below zero in winter.

## Training on someone else's weather

The fix was not a better model of the balcony. It was to stop learning from the balcony at all.

The retraining job now downloads ten-minute data from the five nearest weather-service stations that measure temperature, humidity *and* pressure, going back to 2014. It labels every hour with whether that station's rain gauge saw at least 0.2 mm in the next six hours. It fits gradient-boosted trees to that, and scores the result on the two years it held back.

| Model                                | Gauge labels | ERA5 labels |
| ------------------------------------ | -----------: | ----------: |
| Logistic, old features, one summer   |    0.08–0.11 |   0.02–0.08 |
| Logistic, old features, 14 years     |         0.15 |        0.19 |
| Logistic, + rain-signature features  |         0.20 |        0.24 |
| Gradient-boosted trees, same features |     **0.25** |    **0.29** |

More data did most of the work. Trees did the rest, because a tree can learn that a pressure change means different things in different situations, where a weighted sum cannot.

The part I care most about is that the trainer and the app compute features with the same function. The app calls it on the balcony's readings, the trainer on the stations':

```python
for hour in station_hours:
    x = features.compute(series, now=hour, cycle=cycle)
    y = gauge.rain_within(hour, hours=6) >= 0.2
```

One implementation, two callers. If they ever computed a feature differently, the model would be answering a question nobody asked.

## Does it transfer to a balcony?

A model trained on seven stations scores the eighth about as well as one trained on that station's own years (0.22–0.27). That is the argument for training on neighbours and serving the balcony.

The balcony still turned out to be different. Scored against the nearest rain gauge over its 1,697 archived hours, the trees ranked hours well (AUC 0.807, against 0.73 for the old hand-made rules) and still scored a Brier skill of −0.116. That combination means the model is miscalibrated, not blind. A sun-baked sensor that sits at exactly 100% whenever it is wet is not a ventilated weather screen.

So the last step fits two numbers on the balcony's most recent 120 days: a slope and an intercept on the log-odds. A positive slope cannot reorder hours, so the ranking stays exactly what the stations taught it, and only the scale is adjusted to this sensor. Two numbers is about all one summer and roughly 150 wet hours can honestly support.

## What I took from it

- A score measured on one season says nothing about the next one.
- If a model ranks well and still scores badly, check its calibration before you blame its signal.
- The balcony's own archive is now only used for what it is good at: checking the model and correcting its scale.
