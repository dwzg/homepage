---
title: How fast an old digital camera's processor really runs
summary: I had the processor of the camera I am taking apart at 46 MHz, from a loop timed against its own millisecond clock. Timed against its second controller's calendar instead, and with a second loop that differs only by eight nops, it runs at about 72 MHz.
date: 2026-10-17
project: camera-firmware
---

For two days the notes of my camera firmware project said the processor runs at about 46 MHz. This morning the emulator got models of the camera's timers, and they used that number to decide how many instructions make a millisecond. I am now porting NuttX to the camera, so its timing would have rested on it as well. The number was wrong by a factor of about 1.5.

## What existed

On the 15th of October a small test program ran on the camera under the original firmware. It timed a two-instruction loop, `subs` and `bne`, copied into a fast 512-byte memory at `0x08100000`. Two million turns took 173 ms, so 86 ns a turn. The textbook cost of that loop on an ARM7TDMI is 4 cycles: one for the subtraction and three for the taken branch. That gives 46 MHz. The note said "if that memory has no wait states; not confirmed", and then everything used the number anyway.

The program had a second weakness. It measured time with the firmware's millisecond counter. That counter is advanced by the tick interrupt of a timer at `0xf0031000`. So the measurement trusted the very timer whose rate I also wanted to know. The firmware programs that timer with a reload value of 9001, and 9001 counts per millisecond only means 1 ms if the timer's clock is what I had assumed.

## An independent clock

The camera has a second controller that handles power, buttons and the calendar. The firmware asks it for the date with a short request (`subcpu_get_clock`), and the answer is seconds since 1970. That clock presumably runs from a crystal of its own, on a different chip. It makes a reference which does not depend on any of the clocks I wanted to measure.

Claude wrote a new test program, `CLOCK.BIN`, in three steps:

1. Ask the calendar for the time until the second changes, count firmware milliseconds for 120 seconds, and stop at another second boundary. The longest request took 5 ms, which bounds the error of each boundary.
2. Start a second hardware counter at `0xf0035030`, a down-counter the firmware reads for short timings, and count how far it gets in five ticks. That is repeated 101 times and the median kept.
3. Time two loops with that counter, interrupts masked, best of 40 runs: the plain `subs`/`bne` loop, and the same loop with eight `nop` instructions added to every turn.

The third step is the important one. The plain loop's cost depends on the branch and on how the memory behaves. The difference between the two loops is eight `nop`s per turn and nothing else, and a `nop` takes at least one cycle.

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

The tick is fine. Nikon's reload value of 9001 gives 1 ms to within 25 parts per million. That is inside the uncertainty of the measurement: each boundary can be up to 5 ms late, which allows up to about 42 parts per million either way over 120 seconds.

The loops are where the old number falls apart. In the fast memory the eight extra `nop`s cost exactly 10,000 counts over 10,000 turns, one counter step per eight instructions. If a `nop` takes one cycle, the processor runs at eight times the counter's rate, 71.94 MHz. The 46 MHz figure would need a `nop` to take about two thirds of a cycle, which an ARM7 cannot do.

The plain loop therefore takes 6 cycles a turn in that memory, not 4. The two extra cycles are the cost of refetching after the branch. The test on the 15th had measured the loop correctly and divided by the wrong number.

## Two clocks that do not quite agree

72 MHz is eight times 9 MHz, and both timers run at about 9 MHz. The counter looks like the processor's clock divided by eight. The tick timer is close but not identical. With 9001 counts per tick and 999.975 ticks a second its clock comes out at about 9.0008 MHz. The counter's is 8.9926 MHz. The two differ by about 0.09 %, and I do not know why. Different dividers, or a counter that skips clocks, would both explain it.

## Main memory pays for every branch

The same pair of loops from the main RAM shows how that memory behaves. At 72 MHz the plain loop takes 18.4 cycles a turn, three times as long as in the fast memory. The eight `nop`s add only about 8 cycles. Fetching instructions one after the other is nearly as cheap as in the fast memory. Every jump into RAM costs about 14 cycles more. An earlier test had already found that reading RAM in bytes, halfwords or words takes the same time per access. For the NuttX port this means the code that has to be fast belongs in the 512 bytes at `0x08100000`: the interrupt entry, the flash programmer.

## What is not known

- **The one-cycle `nop`.** 71.94 MHz is a lower bound. It is the clock only if a `nop` in the fast memory takes exactly one cycle, which is the normal case for an ARM7 but has not been shown here.
- **The calendar's own accuracy.** It was not checked against anything else.
- **The 0.09 % between the two timers.** Not explained.

## If you are measuring a clock

Measure against a clock that the thing you are measuring does not drive. The firmware's millisecond counter looked like an independent reference and was not.

Do not divide a loop's time by its textbook cycle count. Time two loops that differ by a known number of simple instructions and use the difference. The memory's wait states and the branch's refetch cancel out, and what remains is the cost of the instructions you added.
