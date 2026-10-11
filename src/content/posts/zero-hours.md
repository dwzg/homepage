---
title: The training job that found zero hours and stayed green
summary: For months the weekly retraining run printed "too few samples" and exited successfully. The data it read had been averaged before it ever arrived.
date: 2026-09-22
project: weatherpage
---

My weather page retrains its rain model every Monday in GitHub Actions. For months that job went green every week, and for months it trained nothing.

## The symptom

Every run found **zero** labelled hours, printed "too few samples" and exited with status 0. Exiting cleanly was the right call when there genuinely isn't enough data, so nothing looked wrong. The badge was green, and the badge was the only thing I looked at.

## The cause

The trainer fetched the archive from `/api/weather/history`. That endpoint feeds the charts, and a chart doesn't need 26,000 points. Above a target point count it averages readings into buckets. For a chart that is exactly right.

For the trainer it was ruinous. On a 92-day archive it turned about 26,500 five-minute readings into 734 three-hour averages. Every feature the model needs, such as the change over the last half hour or the time spent saturated, needs readings closer together than three hours. None could be computed, so no hour qualified.

## The fix

The trainer now reads `/api/weather/export`, which never downsamples. It sits behind the API key and pages through the archive with a `(timestamp, utc_offset)` cursor. A timestamp alone is not unique, because the autumn clock change repeats an hour.

Two guards stop it coming back:

- A test fails if a `/history` URL ever reappears in the trainer.
- The nightly off-host backup reads `/export` too, under the same kind of test. A "backup" made of bucket averages would look fine right up until the day I needed it.

## What I took from it

A job that can legitimately do nothing needs to say so loudly. "Too few samples, exit 0" is the right decision once. Week after week it is a silent failure. The question to ask of any scheduled job is not "did it pass?" but "did it do anything?"
