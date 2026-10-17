---
title: Where an old digital camera's firmware keeps its menu pictures
summary: An old digital camera's firmware can load a file called NANDDAT.BIN that the manufacturer's update package does not contain. It is an image of reserved sectors in the internal memory, where the camera keeps the pictures of its scene menus. Two functions of 40 and 192 bytes showed it.
date: 2026-10-12
project: camera-firmware
---

The firmware of the camera I am taking apart has a hidden item in its set-up menu. It reads a file named `NANDDAT.BIN` from the memory card and asks whether to install it. The update package from the manufacturer has no such file. A web search for the name found nothing.

On the 10th of October the project's notes got the line "What the file holds is not known; the name suggests an image of a NAND memory." It stayed that way for two days.

## What existed

The project rebuilds the firmware in C, function by function. Claude does most of the work in long sessions, and every rewritten function is run in an emulator against the original. Names and descriptions of functions are kept in the repository, with "not confirmed" written wherever something was inferred and not read.

The function that loads the file was known. It is 292 bytes long and builds the file name on the stack one character at a time, so the name is not among the firmware's strings. The dialog behind the hidden item was known too. Its description said that on "Yes" the camera writes the file by formatting the internal memory. The format routine had not been read, so the question looked like it needed that.

## Pictures in reserved sectors

This evening Claude worked through the functions with the most callers that still had no name. One of them, with 45 call sites, takes a short text like "15" and two screen coordinates. Following it down led to a reader for raw sectors of the camera's internal memory. It accepts sector numbers from 0x10 to 0x828 and nothing else, and it does not go through the file system.

Three of those sectors are directories: 0x10, 0x11 and 0x12. Each holds pairs of a size and a sector number. The function with the 45 call sites loads an entry of the second directory and draws it.

I asked what these 50 numbered things were. The firmware has a table of 50 pointers for them, and Claude had assumed 50 symbols behind it. The table turned out to be the same address 50 times: the buffer the entry was just loaded into. An entry is a picture. Its first byte is the height, the second the width, and then come rows of 4-bit pixels. Each pixel is looked up in a table of 16 colours that the caller passes, and a looked-up colour of 0 leaves the screen as it is.

Who draws which number says what the pictures are for.

| Entries | Drawn by |
| :---: | --- |
| 2, 4, 6 - 13, 15 - 20 | the scene menu, one per scene, always at the same position |
| 21 - 48 | 24 small functions that belong to the scene assist screens |
| 1, 3, 5, 14, 49, 50 | no call site with a fixed number |

So the pictures of the scene menus are not in the firmware file at all. They sit in about 1 MiB of the internal memory that the file system never touches.

## How NANDDAT.BIN is written

Reading that, I remembered the file. I asked whether there had not been some `nanddat.bin` that could come with an update and was missing from ours.

Claude looked for every use of the buffer the file is loaded into. Besides the loader there was one function, 40 bytes long, that nobody had read. It takes the length of the loaded file, divides it by 512, and calls a second function with sector 0x10 as the start. That one is 192 bytes long and is the reader's twin. It checks the same range, 0x10 to 0x828, and calls the routine that writes sectors where the reader calls the one that reads them.

`NANDDAT.BIN` is the image of that area. Its first three sectors are the three directories, and the rest is what they point to. It can be at most 0x819 sectors, which is 1,061,376 bytes. The manufacturer's update does not carry it because the pictures were put in at the factory and this update leaves them alone.

The dialog's old description was wrong in one detail, and the detail mattered. The dialog does format the internal memory, but the file is written by a separate call. The note had put the write on the format routine, a function nobody had read. That made the open question look like a larger job than two functions of 40 and 192 bytes.

## Update, 17 October: the pictures from the camera

Two days after this post the camera itself answered part of it. A small read-only routine, added to the firmware and installed through the camera's normal update, copied the camera's NOR flash and the internal memory's sectors 0x10 to 0x828 to the memory card. I ran it twice and got the same 1,061,376 bytes both times. Claude decoded the copy against what the code had said.

The three directories are a count, a zero word, and then pairs of a size and a sector, as the reader had suggested.

| Directory | Entries | What they are |
| :---: | :---: | --- |
| 0x10 | 43 | JPEG pictures, 40 of them with a 320 x 240 header (the other three use a header the count did not look for) |
| 0x11 | 48 | pictures in the 4-bit format described above |
| 0x12 | 15 | JPEG pictures of 320 x 240 |

The second directory is the one the drawing function with the 45 call sites loads, and it matches the code to the byte. For every one of its 48 entries the size is 2 plus the height times half the width, rounded up: 20 pictures of 192 x 81 pixels, 25 of 168 x 162, and three of 108 pixels high. The firmware's table has 50 slots, the camera 48 pictures. Entries 49 and 50 had no call site with a fixed number, so this fits, but why the table is longer is not known.

The JPEG pictures show what the screens around them suggested: 23 maps of the world with a time zone marked, for the date setting; the start-up screens, including the animation that spells COOLPIX; the star-field backgrounds of the menus; the framing guides of the scene assist screens; the 3 x 3 grid; and one ordinary photograph, most likely one that was chosen as the welcome picture at some point. None of them is shown here. The 48 small pictures have not been drawn yet, because their colours come from tables the callers pass.

## What is not known

- **What the 48 small pictures show.** Their bytes are known since the dump; drawing them needs the colour tables of their callers.
- **Which picture is which.** For entries 21 to 48 I know the screens they belong to, and not which entry is which choice.
- **The other two directories.** Nothing beyond their loader has been read.
- **Who makes the hidden item appear.** It shows when one byte in memory is not 0. What sets that byte is not known.
- **`NANDDAT.BIN` has not been written to a camera.** The area was read on the camera; the install path is read from the firmware and checked in an emulator only.

## What I would tell someone starting the same thing

Write the next step next to an open question, and not only the question. The note from the 10th of October already had the address of the buffer the file is loaded into. A search for other uses of that address finds the 40-byte function at once. Nobody ran it, because the note recorded what was unknown and stopped there.

Check the sentence around an "unknown" as carefully as the unknown itself. The note said which routine wrote the file, stated it as a fact, and was wrong. A description that is nearly right sends the next reader to the wrong function.

Keep the list of open questions where you will see it while other work goes on. The connection came from having read the file name two days earlier and seeing a range of sectors that needed a source. The tools had both facts and no reason to put them side by side.
