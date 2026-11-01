---
title: Running DOOM on an old Nikon compact camera
summary: DOOM runs on a Nikon COOLPIX 3200, started from the playback menu through four changed bytes in Nikon's own firmware update. Photos of a status line found why the first build ignored the keys, and a hang turned out to be the camera's second controller not answering about once in some thousand requests.
date: 2026-11-01
project: camera-firmware
---

The Nikon COOLPIX 3200 is a compact digital camera (its firmware calls it E3200). Inside is an ARM7-class processor with no caches and 16 MiB of RAM. It runs Nikon's firmware on a small real-time kernel, with the work split into tasks. It now also runs DOOM, played with the camera's buttons, with sound effects and music, at about five and a half frames a second.

<figure>
  <img src="/images/doom-on-a-nikon-camera/on-the-camera.jpg" width="1400" height="939"
    alt="The back of the camera, its screen showing DOOM: a monster in a corridor, the status bar at the bottom and two lines of white numbers at the top.">
  <figcaption>DOOM on the camera's screen, with the loops in fast memory. In the status line at the top, <code>R212</code> and <code>B80</code> are the milliseconds spent drawing and copying to the display.</figcaption>
</figure>

## What was already there

I am reverse engineering the camera's firmware. Many of its functions have names and descriptions, and an emulator runs the original firmware against models of the camera's hardware. That gave DOOM two things it needed.

- **A way onto the camera.** The camera installs firmware updates from the memory card. A modified update file is Nikon's own v1.2 file with one branch changed. The item "Auto transfer" in the playback menu then jumps to new code in unused flash behind the image. The same route had already copied the camera's flash memory to the card, so it was known to work.
- **The firmware as a library.** Its functions for files and the display were known. So were the events of the second controller, a small chip that handles the keys, the power switch and the calendar clock. DOOM could call the firmware instead of driving the hardware itself.

The DOOM image changes 4 bytes of Nikon's file and adds 524. The added code reads two files from the card into RAM: `DOOM.BIN`, the game, and `DOOM.WAD`, its levels, pictures and sounds. It reads them the way the firmware reads the update file for the second controller. Then it calls DOOM from the firmware's main task. DOOM never returns: to leave it, you switch the camera off. Without the two files, Auto transfer opens as it always did.

A later version of the same image keeps even less in the flash. Auto transfer starts a small menu from the card, which lists DOOM next to a few diagnostic programs. That is the version in the videos below.

<figure>
  <video controls playsinline preload="none" width="640" height="480"
    poster="/images/doom-on-a-nikon-camera/starting-doom.jpg">
    <source src="/images/doom-on-a-nikon-camera/starting-doom.mp4" type="video/mp4">
  </video>
  <figcaption>Starting DOOM: the playback menu, Auto transfer, the menu of programs on the card, DOOM's title screen and a new game. Sound effects only, from the camera's speaker.</figcaption>
</figure>

`DOOM.BIN` is doomgeneric, a version of DOOM's source code made for porting, with one change (a screen buffer at one byte a pixel). Around it are a small C library and a layer for the camera. The WAD is the shareware episode, 4,196,020 bytes. Both go into RAM the firmware uses for playback pictures and capture buffers, which sit idle while DOOM holds the main task. That nothing else needs this RAM while DOOM runs is not confirmed.

## The first build on the camera

In the emulator, DOOM played its demo and, with the camera's keys, a new game of the first level, E1M1. On the camera, the first build squeezed the picture into the top half with noise below, left a black band on the right and showed red as blue. It drew about one frame a second, ignored the keys and made no sound.

<figure>
  <img src="/images/doom-on-a-nikon-camera/emulator-e1m1.png" width="1312" height="960" loading="lazy" decoding="async"
    alt="A screenshot of DOOM's first level from the emulator: a pillar, dark floor and walls, the pistol and the status bar.">
  <figcaption>The first level, E1M1, in the emulator, in a new game started with the camera's keys.</figcaption>
</figure>

The emulator's model of the display had been a guess, and a photo of the screen corrected three parts of it. In playback, the display reads 480 lines from one buffer and shows every second line. The model had expected two interleaved half-pictures. The panel shows all 768 columns, not 656. And the camera takes a pixel pair as Y0 Cr Y1 Cb, with the two colour components the other way round. The second build filled the screen with the right colours.

A photo of the game says nothing about keys or sound. So the third build wrote a status line into DOOM's message line. It showed how keys were polled, how many key events and sound interrupts had come, and the milliseconds spent drawing and copying to the display. The photo read `P0 E0` and `S18801 R330 B409`. No key events had come through the firmware's key task, and 18,801 sound interrupts had fed a speaker that was switched off.

Both had a cause in the firmware. Its sound player sends three bytes over a serial port 30 ms after a sound starts, and those switch the speaker on. DOOM did not. And the task that normally collects key events was dormant in the state the camera was in, so DOOM now asks the second controller for events itself. The same build halved the memory accesses of the copy to the display. Keys and sound worked, and the copy fell from 409 to 157 ms.

## Making it faster

The processor has no caches, and DOOM runs from RAM, so its speed is the speed of that RAM. A test program measured what the camera offers. It has 512 bytes of fast memory at `0x08100000`, where code runs 3.5 times as fast as from the main RAM. Thumb code was no faster than ARM code, and a RAM access costs the same whatever its width.

DOOM was running in its low-detail mode, which draws every pixel two wide. That mode's inner loops for walls and floors went into those 512 bytes, together with the copy to the display. A profiler in the sound interrupt then recorded 48 seconds of the demo on the camera:

| Where the time went | Share |
| --- | ---: |
| the loops in fast memory | 34.2 % |
| memcpy | 10.5 % |
| the firmware | 9.3 % |
| `V_DrawPatch` | 7.7 % |
| the monsters' sight checks | 6.8 % |

memcpy went into the fast memory next and changed nothing. The copies wait for the RAM, not for instructions. What helped was fewer RAM accesses. The wall and floor loops now store a double-width pixel's two bytes with one halfword store. And the display hardware can stretch a picture, so DOOM writes 200 lines of 320 pixels and lets it scale them to the panel.

| Build | Drawing (ms) | Copy (ms) | Frames a second |
| --- | ---: | ---: | ---: |
| status line | 330 | 409 | about 1 |
| speaker on, own key polling, cheaper copy | 255 | 157 | 2.4 |
| loops in fast memory | 180-243 | 80-90 | 3.4 |
| halfword stores, hardware stretch | 144-189 | 52-53 | 4-5 |
| as kept, debug lines off (videos) | | | 5.3-5.7 |

The first four rows come from the status line, which shows one frame at a time. The last row is counted in two videos of the build as kept, with a few more small speed-ups and the debug lines switched off. In a 30 fps video the copy sweeps down the screen in about two video frames, and each part of the screen changes once per game frame, so the changes can be counted. Over about half a minute of play each, the videos average 5.7 frames a second without music and 5.3 with it. Most frames are 133 to 200 ms apart, the shortest 100 ms.

The last profile shows DOOM's own game and render logic and no item above 6 %.

## A controller that does not answer

After some minutes of the demo, the picture froze. The next build added a hang report: when no frame has come for two seconds, the sound interrupt shows the addresses it interrupted. The addresses pointed into the firmware's routine that waits for the second controller's reply. It waits by polling a semaphore, with no limit.

<figure>
  <img src="/images/doom-on-a-nikon-camera/hang-report.jpg" width="1400" height="1046" loading="lazy" decoding="async"
    alt="The camera's screen showing DOOM stopped, with a line of hexadecimal addresses at the top.">
  <figcaption>A hang report. <code>E0</code> marks a hang, and the three numbers are addresses the sound interrupt found DOOM at. The tiny font draws a B almost like an 8: the second and third read <code>00015B00</code>.</figcaption>
</figure>

A later report recorded the state at the stall. The request had gone out, and not one byte of an answer had come back. The controller did not answer, about once in some thousand requests. Why is not known, because its own firmware has not been read. Nikon's firmware has no limit either. It keeps a timeout counter that is written and never read. It just asks far less often than a game polling for keys every 20 ms.

So the fix is the missing timeout. The sound interrupt watches for it. After 500 interrupts without a frame, with DOOM in one of those polls, it sets the semaphore or event flag as the reply would have. DOOM also asks every 50 ms now, instead of 20. The first version recovered once per stall. A fifth hang report showed a stall that outlasted one recovery, so it now repeats every 250 interrupts while the stall lasts. There has been no hang since.

The camera also switched itself off in the middle of the demo. The second controller has its own power-off timer, which the firmware's menus set. DOOM now sets it to 255 × 30 s on its first frame.

## Music

DOOM's music is stored as MUS scores, written for the OPL2 FM synthesizer chip of PC sound cards. Emulating that chip next to the game is too much for this processor. Instead, a six-voice synthesizer in the sound interrupt plays the scores. It uses band-limited square-like wavetables, an 8 ms attack, and drums made of a falling tone and noise. The melodies are right and the timbre is not.

A render of E1M1 opens in E, each note within a fraction of a semitone. Other songs needed the instrument table in the WAD (the GENMIDI lump). It shifts some instruments by octaves, and without it the music of E1M5 to E1M9 played an octave too high. Moving every note below C3 an octave up, for the small speaker, was tried and taken out again: E1M1 sounded weird with it. With music, the videos average 5.3 frames a second against 5.7 without. They show different scenes, though, so the music's own cost cannot be told apart from theirs.

<figure>
  <video controls playsinline preload="none" width="640" height="480"
    poster="/images/doom-on-a-nikon-camera/playing-with-music.jpg">
    <source src="/images/doom-on-a-nikon-camera/playing-with-music.mp4" type="video/mp4">
  </video>
  <figcaption>E1M1 with its music, up to the first fight, from the camera's speaker.</figcaption>
</figure>

## What is not known

- Why the second controller loses a request now and then.
- Which direction of the zoom lever is which event, so "use" and "Escape" may be the other way round.
- That nothing else in the firmware needs the RAM DOOM uses.

Nothing is saved either: no saved games and no settings.
