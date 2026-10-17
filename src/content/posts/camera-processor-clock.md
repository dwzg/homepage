---
title: How fast an old digital camera's processor and memories are
summary: Nothing documents the chip in the camera I am taking apart. Four small programs under the original firmware measured it against the calendar of the camera's second controller. The processor runs at about 72 MHz, code is fastest straight from the flash through an 8 KB cache, and every jump into the main RAM costs about 14 cycles.
date: 2026-10-17
project: camera-firmware
---

The chip at the centre of the camera I am taking apart has no name on any document I know of, and no datasheet. I know it is an ARM7-class processor with no caches of its own. I did not know how fast it runs, or what its memories cost. That started to matter this week. The emulator I use to compare my rebuilt firmware with the original needs to know how many instructions make a millisecond. The port of NuttX to the camera needs its timers set up for the real clock, and its code and data placed in the right memory.

A program on the camera can run from three memories: 2 MiB of NOR flash, where the firmware lives, 16 MiB of main RAM, and a small fast memory of 512 bytes.

## Why it is not easy to measure

The camera has timers, and the firmware's code shows how it programs them. Its system tick comes from a timer at `0xf0031000`, which the firmware loads with 9001 for every millisecond. That says the timer counts at about 9 MHz, if a tick really is a millisecond. Nothing in the code says that it is.

The obvious measurement is a loop: run a known number of turns and look at the clock. That has two problems.

1. **The clock to look at.** The firmware's own millisecond counter is advanced by that same tick. Timing the tick with it proves nothing.
2. **The cost of a turn.** A loop of `subs` and `bne` costs 4 cycles a turn on an ARM7 in the textbook, but only from memory without wait states. Every wait state makes the loop slower and the computed clock lower. Dividing by 4 gives a lower bound, not an answer.

## An independent clock

The camera has a second controller that handles power, buttons and the calendar. The firmware asks it for the date with a short request (`subcpu_get_clock`), and the answer is seconds since 1970. That clock presumably runs from a crystal of its own, on a different chip. It makes a reference which does not depend on any of the clocks I wanted to measure.

Claude wrote four small programs that run on the camera under the original firmware. The first, `CLOCK.BIN`, works in three steps:

1. Ask the calendar for the time until the second changes, count the firmware's ticks for 120 seconds, and stop at another second boundary. The longest request took 5 ms, which bounds the error of each boundary.
2. Start a second hardware counter at `0xf0035030`, a down-counter the firmware reads for short timings, and count how far it gets in five ticks. That is repeated 101 times and the median kept.
3. Time two loops with that counter, interrupts masked, best of 40 runs: the plain `subs`/`bne` loop, and the same loop with eight `nop` instructions added to every turn.

The third step deals with the cost of a turn. The plain loop's cost depends on the branch and on the memory. The difference between the two loops is eight `nop`s per turn and nothing else, and a `nop` takes at least one cycle.

## The clock

| Measurement | Count | Result |
| --- | ---: | ---: |
| ticks in 120 calendar seconds | 119,997 | 999.975 Hz |
| counter in 5 ticks (median) | 44,964 | 8,992,575 Hz |
| fast memory, 10,000 turns plain | 7,517 | 6.0 cycles a turn |
| fast memory, 10,000 turns with 8 nops | 17,517 | 14.0 cycles a turn |

The tick is a millisecond. The firmware's 9001 gives 999.975 ticks a second, within 25 parts per million of 1,000. Each boundary can be up to 5 ms late, which allows up to about 42 parts per million either way over 120 seconds.

The eight extra `nop`s cost exactly 10,000 counts over 10,000 turns, one counter step per eight instructions. If a `nop` takes one cycle, the processor runs at eight times the counter's rate: 71.94 MHz. The plain loop then takes 6 cycles a turn in the fast memory, not the textbook 4. Dividing it by 4 would have put the processor at about 48 MHz.

72 MHz is eight times 9 MHz, and both timers run at about 9 MHz. The counter looks like the processor's clock divided by eight. The tick timer is close but not identical: with 9001 counts per tick and 999.975 ticks a second its clock comes out at about 9.0008 MHz, against the counter's 8.9926 MHz. I do not know why the two differ by about 0.09 %.

## Three memories

The second program, `MEMMAP.BIN`, ran the same loops from each memory. The firmware keeps a copy of its own delay loop in the flash, the same `subs`/`bne` loop, so the flash could be timed without writing to it. Figures are cycles at 72 MHz.

| | flash | fast memory | main RAM |
| --- | ---: | ---: | ---: |
| `subs`/`bne`, a turn | 4.07 | 6.01 | 18.42 |
| 8 more `nop`s | not measured | +8.00 | +8.15 |
| `ldr`, a word | 41.8 | 21.9 | 33.7 |
| `ldm` of 8 words, a word | 26.8 | 7.9 | 8.2 |
| `ldr` at random | 133 | not measured | 49 |

The read loops themselves ran from RAM, so the lower rows compare memories rather than give absolute costs. Thumb code cost the same as ARM code everywhere.

I did not expect the first row. The flash ran the loop at the textbook 4 cycles, faster than the fast memory, while reading data from the same flash cost up to 133 cycles a word.

## Faster than the fast memory

The third program, `FLASHBUF.BIN`, asked how far that goes. It called routines of the firmware's own runtime library where they lie in the flash, and the same bytes copied into RAM and into the fast memory.

| Routine, cycles a call | flash | fast memory | main RAM |
| --- | ---: | ---: | ---: |
| `memset`, 1 KB | 2,788 | 3,302 | 8,400 |
| `memcpy`, 1 KB | 2,248 | too large | 4,781 |
| `memcpy`, 1 KB, source one byte off | 2,888 | too large | 6,009 |
| division with a 108-byte loop | 191.6 | 209.1 | 379.0 |

Each routine was called from a loop in RAM, whose cost is in every figure. The flash won every time. It ran up to a 108-byte loop and a 576-byte `memcpy` 7 to 16 % faster than the fast memory, and about twice as fast as the RAM.

Loads of constants from the flash cost nothing extra either. A function that loads a constant stored 2 KB away took 1.6 cycles more per call than the same function with `mov`, which is just the load instruction's own time.

## The size of the cache

Fast code and repeated constants, slow one-time reads: that is a cache. The fourth program, `CACHESZ.BIN`, measured it in three ways, still without writing to the flash.

| Block of flash read again and again | cycles a word |
| --- | ---: |
| 256 bytes | 3.6 |
| 4 KB | 2.3 |
| 8 KB | 3.9 |
| 16 KB | 22.6 |
| 32 KB | 25.8 |

Data read from the flash goes through the cache too, and the cache holds about 8 KB.

| Cold reads, one every | cycles a read |
| --- | ---: |
| 4 bytes | 35.6 |
| 8 bytes | 60.2 |
| 16 bytes | 109.4 |
| 64 bytes | 110.6 |

From 16 bytes on, every read misses. A line is 16 bytes and takes about 110 cycles to fill, 1.5 microseconds.

The third sweep used the firmware's own tiny functions, 255 of them spread over the whole image, each 12 or 16 bytes. Calling the first K of them in turn cost about 98 to 108 cycles a call up to 128 functions. From 160 it rose, to about 145 cycles at 224 and 255. Scattered code starts to collide well before the 8 KB is full, so the cache is not fully associative. How many ways it has, I cannot tell from this curve.

## What this says about the hardware

None of the parts has a name I can look up, so this section is inference from the numbers.

- **The flash sits behind an 8 KB cache with 16-byte lines.** Code and data that are in the cache come without wait states. A miss costs about 110 cycles for 16 bytes. The firmware sends the flash its commands 16 bits wide. If it is read 16 bits at a time as well, a line is eight reads of about 14 cycles each, 190 ns a read, which is why the flash is slow without the cache. The processor has no cache of its own, so this one sits in the chip's memory controller.
- **The main RAM is expensive to start and cheap to stream.** Sequential instructions cost about one cycle each, but every jump into RAM costs about 14 cycles more. Eight-word bursts read a word four times as cheaply as single loads. Random reads cost the same 49 cycles whether they are 32, 256 or 4096 bytes apart. That is how SDRAM behaves when every random access opens its row from scratch.
- **The fast memory is a small SRAM on the chip.** The 512 bytes repeat through their whole window. Sequential code runs without wait states, and a jump costs about 2 cycles. The firmware keeps only its delay loop there. That fits a place to run code while the flash is busy being erased or written, when it cannot be read.

## What it means for the NuttX port

- Code stays in the flash and runs through the cache. The paths that run all the time, such as the interrupt entry, the scheduler and the drivers' inner loops, should stay well inside 8 KB and close together.
- Nothing runs from the main RAM. Code that must run while the flash is busy goes to the fast memory.
- Copies use `ldm` and `stm`.

## What is not known

- **The one-cycle `nop`.** 71.94 MHz is a lower bound. It is the clock only if a `nop` in the fast memory takes exactly one cycle, which is the normal case for an ARM7 but has not been shown here.
- **The calendar's own accuracy.** It was not checked against anything else.
- **The 0.09 % between the two timers.** Not explained.
- **The cache's ways.** About 8 KB and 16-byte lines are measured; how many ways it has is not.
- **Three slow alignments.** The RAM loop cost the same at 13 of 16 places in a 64-byte block and 7 to 16 % more at three. I do not know why.

## If you are measuring a chip nobody documented

Measure against a clock that the thing you are measuring does not drive. On this camera the obvious reference, the firmware's millisecond counter, is driven by the timer I wanted to check.

Do not divide a loop's time by its textbook cycle count. Time two loops that differ by a known number of simple instructions and use the difference.

Run the same bytes from every memory before deciding where code goes. Here the slowest data path, the flash, turned out to be the fastest place to run code. And a cache can be sized from the outside: read blocks of growing size, then read with growing gaps, and watch where the cost jumps.
