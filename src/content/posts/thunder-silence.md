---
title: My thunder labels mistook silence for calm
summary: A thunder model ranked hours well and still scored worse than guessing. Most of its training stations had stopped listening for thunder years before the data ended.
date: 2026-10-11
project: weatherpage
draft: true
---

The second full training run gave my thunderstorm model a held-out year in which thunder followed only 0.7% of hours. A run before had put it at 3.0%. The model ranked hours well, at an AUC of 0.87, and still scored a Brier skill of −0.15. It was worse than quoting the base rate.

The model wasn't the problem. The labels had gone quiet, because most of the stations behind them had stopped listening.

## Where thunder labels come from

My weather page shows a short outlook, and one of its lines is "Thunderstorm possible". The model behind it learns from the German weather service's station archive. Rain, cloud and visibility come from instruments. Thunder never did. It was reported by people, as a present-weather code in the hourly record.

Eleven codes mean thunder:

- 17: thunder heard, but no rain
- 29: thunder in the last hour
- 91 to 94: thunder in the last hour, with rain or snow now
- 95 to 99: a thunderstorm at the time of the observation

An observer on duty who saw nothing significant wrote −1, "nothing reported". Thunder is always significant. So while someone was on duty, −1 is a real observation, and it means there was no thunder that hour.

The instruments that replaced the observers report cloud and visibility, but not thunder. At the eight stations I measured first, 2014 to 2021 held 25 to 118 thunder reports a year each. From 2023 on there were none at all. So the trainer labels thunder only before 2022.

## What went wrong

Cutting everything at 2022 assumed every station kept its observers until then. Most didn't. Of the five stations the thunder model trained on, four filed their last thunder report in 2015, 2016, 2018 and 2019.

After that date each of those records still has a code for every hour. It reads −1, "nothing reported", whatever the sky did. My labels took that as calm. The held-out year was mostly silence, so its base rate fell from 3.0% to 0.7%.

The model had learned thunder from the years when people were listening. It kept predicting thunder at a realistic rate, and the labels kept saying it never happened. The ranking survived, because the hours it rated highest were still the most likely ones. The Brier score didn't, because it punishes every confident forecast the labels call a false alarm.

## The fix

The trainer now cuts each station's record at the end of the month of its own last thunder report, and never past the end of 2021. A station with no thunder report at all is not used for thunder, because nobody there was listening.

The model I ship now was scored on a held-out year from October 2020 to September 2021, 16,777 hours, with thunder following 2.2% of them:

| Forecast | Brier score | Brier skill | AUC |
| --- | ---: | ---: | ---: |
| Base rate | 0.0282 | 0.000 | – |
| Old rule: warm, humid summer afternoon | 0.0312 | −0.108 | 0.522 |
| Gradient-boosted trees | 0.0248 | 0.119 | 0.910 |

The old rule was barely better than a coin at ranking hours. The trees are the largest improvement on the page over what they replaced. Thunder is still rare, so even a good model has a small Brier skill.

## What it still can't do

- **Autumn is bad.** Split by season, the held-out year scores 0.091 in summer, 0.021 in spring and −0.327 in autumn. An autumn thunderstorm is rare enough that the model hasn't learned it.
- **It can't be checked on my balcony.** Nothing near it reports thunder any more, so unlike rain, cloud and fog, I can't score it against my own archive.
- **Its calibration is a guess at the level.** The model's mean over the balcony's recent readings was 6.4%. The stations had thunder in 3.6% of hours in the same months. So I shift its log-odds by −0.67 to match. A shift of 2 or more would mean the model doesn't understand my sensor's readings, and the trainer refuses to ship it.
- **The data ends in 2021.** Every new year of weather is a year this model can't learn from.

## What I'd tell someone using archive labels

Before training on a label, find out who produced it and when they stopped. A code that means "nothing happened" only means that while someone was there to see it. And when a model ranks hours well but scores below the base rate, look at the labels before the model.
