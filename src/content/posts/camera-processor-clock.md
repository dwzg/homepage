---
title: How fast an old digital camera's processor really runs
summary: Nothing documents the clock of the chip in the camera I am taking apart. A small program under the original firmware timed two loops against the calendar of the camera's second controller, and put the processor at about 72 MHz.
date: 2026-10-17
project: camera-firmware
---

The chip at the centre of the camera I am taking apart has no name on any document I know of, and no datasheet. I know it is an ARM7-class processor with no caches. I did not know how fast it runs. That started to matter this week. The emulator I use to compare my rebuilt firmware with the original needs to know how many instructions make a millisecond, and the port of NuttX to the camera needs its timers set up for the real clock.

## Why it is not easy to measure

The camera has timers, and the firmware's code shows how it programs them. Its system tick comes from a timer at `0xf0031000`, which the firmware loads with 9001 for every millisecond. That says the timer counts at about 9 MHz, if a tick really is a millisecond. Nothing in the code says that it is.

The obvious measurement is a loop: run a known number of turns and look at the clock. That has two problems.

1. **The clock to look at.** The firmware's own millisecond counter is advanced by that same tick. Timing the tick with it proves nothing.
2. **The cost of a turn.** A loop of `subs` and `bne` costs 4 cycles a turn on an ARM7 in the textbook, but only from memory without wait states. Every wait state makes the loop slower and the computed clock lower. Dividing by 4 gives a lower bound, not an answer.

## An independent clock

The camera has a second controller that handles power, buttons and the calendar. The firmware asks it for the date with a short request (`subcpu_get_clock`), and the answer is seconds since 1970. That clock presumably runs from a crystal of its own, on a different chip. It makes a reference which does not depend on any of the clocks I wanted to measure.

Claude wrote a small program, `CLOCK.BIN`, that runs on the camera under the original firmware and works in three steps:

1. Ask the calendar for the time until the second changes, count the firmware's ticks for 120 seconds, and stop at another second boundary. The longest request took 5 ms, which bounds the error of each boundary.
2. Start a second hardware counter at `0xf0035030`, a down-counter the firmware reads for short timings, and count how far it gets in five ticks. That is repeated 101 times and the median kept.
3. Time two loops with that counter, interrupts masked, best of 40 runs: the plain `subs`/`bne` loop, and the same loop with eight `nop` instructions added to every turn. Both run once from a fast 512-byte memory at `0x08100000` and once from the main RAM.

The third step deals with the cost of a turn. The plain loop's cost depends on the branch and on how the memory behaves. The difference between the two loops is eight `nop`s per turn and nothing else, and a `nop` takes at least one cycle.

## The numbers

I ran it on the camera. The screen only has room for eight lines, so the loop results came from the file it wrote to the memory card.

| Measurement | Count | Result |
| --- | ---: | ---: |
| ticks in 120 calendar seconds | 119,997 | 999.975 Hz |
| counter in 5 ticks (median) | 44,964 | 8,992,575 Hz |
| fast memory, 10,000 turns plain | 7,517 | 83.6 ns a turn |
| fast memory, 10,000 turns with 8 nops | 17,517 | 194.8 ns a turn |
| RAM, 2,000 turns plain | 4,602 | 255.9 ns a turn |
| RAM, 2,000 turns with 8 nops | 6,640 | 369.2 ns a turn |

The tick is a millisecond. The firmware's 9001 gives 999.975 ticks a second, within 25 parts per million of 1,000. That is inside the uncertainty of the measurement: each boundary can be up to 5 ms late, which allows up to about 42 parts per million either way over 120 seconds.

The processor's clock comes from the two loops in the fast memory. The eight extra `nop`s cost exactly 10,000 counts over 10,000 turns, one counter step per eight instructions. If a `nop` takes one cycle, the processor runs at eight times the counter's rate: 71.94 MHz.

The plain loop then takes 6 cycles a turn in that memory, not the textbook 4. The two extra cycles are the cost of refetching after the branch. Dividing the plain loop by 4 would have put the processor at about 48 MHz.

## Two clocks that do not quite agree

72 MHz is eight times 9 MHz, and both timers run at about 9 MHz. The counter looks like the processor's clock divided by eight. The tick timer is close but not identical. With 9001 counts per tick and 999.975 ticks a second its clock comes out at about 9.0008 MHz. The counter's is 8.9926 MHz. The two differ by about 0.09 %, and I do not know why. Different dividers, or a counter that skips clocks, would both explain it.

## Main memory pays for every branch

The same pair of loops from the main RAM shows how that memory behaves. At 72 MHz the plain loop takes 18.4 cycles a turn, three times as long as in the fast memory. The eight `nop`s add only about 8 cycles. Fetching instructions one after the other is nearly as cheap as in the fast memory. Every jump into RAM costs about 14 cycles more. An earlier test had already found that reading RAM in bytes, halfwords or words takes the same time per access. For the NuttX port this means code should not run from the main RAM.

## What is not known

- **The one-cycle `nop`.** 71.94 MHz is a lower bound. It is the clock only if a `nop` in the fast memory takes exactly one cycle, which is the normal case for an ARM7 but has not been shown here.
- **The calendar's own accuracy.** It was not checked against anything else.
- **The 0.09 % between the two timers.** Not explained.

## If you are measuring a clock

Measure against a clock that the thing you are measuring does not drive. On this camera the obvious reference, the firmware's millisecond counter, is driven by the timer I wanted to check.

Do not divide a loop's time by its textbook cycle count. Time two loops that differ by a known number of simple instructions and use the difference. The memory's wait states and the branch's refetch cancel out, and what remains is the cost of the instructions you added.
