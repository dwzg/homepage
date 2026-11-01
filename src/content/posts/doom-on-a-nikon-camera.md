---
title: Running DOOM on an old Nikon compact camera
summary: DOOM runs on a Nikon COOLPIX 3200, started from the playback menu through four changed bytes in Nikon's own firmware update. Photos of a status line found why the first build ignored the keys, and a hang turned out to be the camera's second controller not answering about once in some thousand requests.
date: 2026-11-01
project: camera-firmware
---

The camera I am taking apart is a Nikon COOLPIX 3200 (its firmware calls it E3200). Its processor is an ARM7-class core with no caches, and it has 16 MiB of RAM. On the 15th of October I took a detour from the reconstruction and asked Claude to "make DOOM run on the camera, loaded from SD card into RAM with a slightly modified original firmware image, like we did with the dumper." By the early hours of the next morning it ran on the camera with keys, sound effects and music, at about four to five frames a second. Claude wrote the port. I put each build on the card and photographed the screen.

## What existed

The project rebuilds the camera's firmware in C, function by function, and checks every function against the original in an emulator. Two things from that work made DOOM possible in a day.

- **A way onto the camera.** A day earlier, a modified firmware image had copied the camera's flash memory to the card. It is Nikon's own v1.2 update file with one branch changed. The item "Auto transfer" in the playback menu then jumps to our code in the free flash behind the image. The camera installs it like any firmware update.
- **Names.** The reconstruction had already read the firmware's file calls and its display set-up. It had also read the events of the second controller, a small chip that handles the keys, the power switch and the calendar clock. DOOM could use the firmware as a library instead of driving the hardware itself.

The DOOM image changes 4 bytes of Nikon's file and adds 524. The added code reads `DOOM.BIN` and `DOOM.WAD` from the card's root into RAM, the way the firmware reads its own sub-firmware file. Then it calls DOOM in the firmware's main task. DOOM never returns: to leave it, you switch the camera off. Without the two files, Auto transfer opens as it always did.

`DOOM.BIN` is doomgeneric with one change (a screen buffer at one byte a pixel), a small C library and a layer for the camera. The WAD is the shareware episode, 4,196,020 bytes. Both go into RAM the firmware uses for playback pictures and capture buffers, which sit idle while DOOM holds the main task. That nothing else needs this RAM while DOOM runs is not confirmed.

## The first build on the camera

In the emulator, DOOM played its demo and, with the camera's keys, a new game of E1M1. On the camera, the first build squeezed the picture into the top half with noise below, left a black band on the right and showed red as blue. It drew about one frame a second, ignored the keys and made no sound.

The emulator's display model had been an assumption, and the photo corrected three parts of it. In playback, the display reads 480 lines from the first field and shows every second one. The panel shows all 768 columns, not 656. And the camera takes a pixel pair as Y0 Cr Y1 Cb, with the two colour components the other way round. The second build filled the screen with the right colours.

A photo of the game says nothing about keys or sound. So the third build wrote a status line into DOOM's message line. It showed how keys were polled, how many key events and sound interrupts had come, and the milliseconds spent drawing and copying to the display. The photo read `P0 E0` and `S18801 R330 B409`. No key events had come through the firmware's key task, and 18,801 sound interrupts had fed a speaker that was switched off.

Both had a cause in the firmware. Its sound player sends three bytes over a serial port 30 ms after a sound starts, and those switch the speaker on. DOOM did not. And the task that normally collects key events was dormant in the state the camera was in, so DOOM now asks the second controller for events itself. The same build halved the memory accesses of the copy to the display. Keys and sound worked, and the copy fell from 409 to 157 ms.

## Making it faster

The processor has no caches, and DOOM runs from RAM, so its speed is the speed of that RAM. A test program measured what the camera offers. It has 512 bytes of fast memory at `0x08100000`, where code runs 3.5 times as fast as from the main RAM. Thumb code was no faster than ARM code, and a RAM access costs the same whatever its width.

Claude moved the inner loops that draw low-detail columns and spans into those 512 bytes, together with the copy to the display. A profiler in the sound interrupt then recorded 48 seconds of the demo on the camera:

| Where the time went | Share |
| --- | ---: |
| the loops in fast memory | 34.2 % |
| memcpy | 10.5 % |
| the firmware | 9.3 % |
| `V_DrawPatch` | 7.7 % |
| the monsters' sight checks | 6.8 % |

memcpy went into the fast memory next and changed nothing. The copies wait for the RAM, not for instructions. What helped was fewer RAM accesses. The column and span loops now store a low-detail pixel's two bytes with one halfword store. And the display's scaler stretches the picture in hardware, so DOOM writes 200 lines of 320 pixels instead of filling the whole field.

| Build | Drawing (ms) | Copy (ms) | Frames a second |
| --- | ---: | ---: | ---: |
| status line | 330 | 409 | about 1 |
| speaker on, own key polling, cheaper copy | 255 | 157 | 2.4 |
| loops in fast memory | 180-243 | 80-90 | 3.4 |
| halfword stores, hardware stretch | 144-189 | 52-53 | 4-5 |

After a few smaller changes, the last profile shows DOOM's own game and render logic and no item above 6 %.

## A controller that does not answer

After some minutes of the demo, the picture froze. The next build added a hang report: when no frame has come for two seconds, the sound interrupt shows the addresses it interrupted. I read one of them right that Claude had read wrong, because the tiny font draws a B almost like an 8. The addresses pointed into the firmware's routine that waits for the second controller's reply. It waits by polling a semaphore, with no limit.

A later report recorded the state at the stall. The request had gone out, and not one byte of an answer had come back. The controller did not answer, about once in some thousand requests. Why is not known, because its own firmware has not been read. Nikon's firmware has no limit either. It keeps a timeout counter that is written and never read. It just asks far less often than a game polling for keys every 20 ms.

So the fix is the missing timeout. The sound interrupt watches for it. After 500 interrupts without a frame, with DOOM in one of those polls, it sets the semaphore or event flag as the reply would have. DOOM also asks every 50 ms now, instead of 20. The first version recovered once per stall. A fifth hang report showed a stall that outlasted one recovery, so it now repeats every 250 interrupts while the stall lasts. There has been no hang since.

The same night, the camera switched itself off in the middle of the demo. The second controller has its own power-off timer, which the firmware's menus set. DOOM now sets it to 255 × 30 s on its first frame.

## Music

DOOM's music is MUS scores written for an OPL2 FM chip, and emulating that next to the game is too much for this processor. Instead, a six-voice synthesizer in the sound interrupt plays the scores. It uses band-limited square-like wavetables, an 8 ms attack, and drums made of a falling tone and noise. The melodies are right and the timbre is not.

A render of E1M1 opens in E, each note within a fraction of a semitone. Other songs needed DOOM's instrument table: its GENMIDI lump shifts some instruments by octaves, and without it E1M5 to E1M9 played an octave too high. Moving every note below C3 an octave up, for the small speaker, was tried and taken out again: E1M1 sounded weird with it. What the music costs in frame rate on the camera has not been measured.

## What is not known

- Why the second controller loses a request now and then.
- Which direction of the zoom lever is which event, so "use" and "Escape" may be the other way round.
- That nothing else in the firmware needs the RAM DOOM uses.

Nothing is saved either: no saved games and no settings.

## What I would tell someone trying the same

- When the screen is the only output, put the numbers on it. One status line in a photo told three faults apart that looked the same from outside.
- Treat the emulator's device models as guesses until the hardware has answered. The emulator played DOOM fine with three facts about the display wrong.
- Measure before you move code. memcpy in fast memory looked like a sure win and changed nothing.
- Expect to find the original firmware's rare faults. A program that asks the hardware more often than the vendor did will meet them sooner, and may have to add the timeout the vendor left out.
