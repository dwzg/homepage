---
title: Two NuttX bugs that only show on an ARM7
summary: Porting NuttX to an old Nikon compact camera turned up two faults in NuttX's code for ARM7 cores. One breaks the return from every interrupt on this camera, the other builds cache instructions for a core that has no cache. Both are still in NuttX's main branch, and I plan to report them.
date: 2026-10-17
project: camera-firmware
---

I am porting NuttX to the camera I am taking apart. The camera's processor is an ARMv4T core of the ARM7TDMI kind, with no caches and no coprocessor 15. NuttX supports such cores. On the real camera, two parts of that support failed. Both are generic NuttX code, not part of my port, and both are still in NuttX's main branch as of today (commit `d2ce23c49e`).

## The return from an exception

NuttX's exception handlers for these cores are in `arch/arm/src/arm/arm_vectors.S`. Each one ends the same way. It restores the interrupted task's stack pointer and link register from the saved context. Then it loads the program counter and returns.

```asm
ldmia   r14, {r13, r14}^    /* Restore user mode r13/r14 */
add     r14, r14, #(4*2)    /* (IRQ) r14=address of r15 storage */
ldmia   r14, {r15}^         /* Return */
```

The `^` makes the first `ldmia` write the user-mode copies of `r13` and `r14`. The instruction right after it then uses `r14` again, but this time the handler's own copy of the register. ARM cores before ARMv6 do not allow that: an instruction that accesses a banked register must not follow an `ldm` of the user registers directly. The Linux kernel has the same sequence in its ARM entry code. It puts a `mov r0, r0` behind the `ldm`, with the comment "ARMv5T and earlier require a nop after ldm {}^".

On my camera the `add` saw the wrong `r14`, and the return jumped to the wrong address. NuttX started, took its first timer interrupt and never came back from it. The emulator I use for the camera does not model this, so the same image ran fine there.

The sequence occurs five times in `arm_vectors.S` (lines 228, 327, 427, 523 and 617): in the handlers for interrupts, system calls, data aborts, prefetch aborts and undefined instructions. The last one restores `r8` to `r14` instead of only `r13` and `r14`, and has the same problem.

My fix is a `nop` after each of the five `ldm` instructions. My port has its own copy of the vector code anyway, so the fix lives there. In NuttX itself it would be five added lines, costing one cycle per exception.

Not every ARM7 shows the fault. An issue from this summer (`apache/nuttx#19201`) reports NuttX running again on an LPC2378 board, with this sequence unchanged. What a core does when the rule is broken is not defined, so whether it goes wrong depends on the core. On this camera it did.

## Cache instructions for a core without a cache

The second fault is in the configuration. In `arch/arm/Kconfig`, the option for ARM7TDMI cores selects the data and instruction cache options:

```
config ARCH_ARM7TDMI
	bool
	default n
	select ARCH_DCACHE
	select ARCH_ICACHE
```

With these options set, the build includes `arch/arm/src/arm/arm_cache.S`, which is written for the ARM926. Its routines use coprocessor 15, for example `up_flush_dcache_all`:

```asm
up_flush_dcache_all:
	mrc		p15, 0, r15, c7, c14, 3
	bne		up_flush_dcache_all
	bx		lr
```

An ARM7TDMI has no coprocessor 15. On the camera, any `mrc p15` raises the undefined-instruction exception, which I had already measured earlier with a test program under the original firmware.

Few code paths call these routines, which is probably why this went unnoticed. Power-off is one of them. `boardctl(BOARDIOC_POWEROFF)` calls `up_flush_dcache_all()` right before `board_power_off()` (`boards/boardctl.c`, line 424), and the reset command does the same (line 449). So the camera's `poweroff` command stopped on the undefined instruction instead of switching the camera off.

Five chips in NuttX select `ARCH_ARM7TDMI`: c5471, lpc214x, lpc2378, moxart and str71x. On those that really have an ARM7TDMI core, the same calls would stop the same way.

In my port I filter `arm_cache.S` out of the build and provide the same routines as empty functions. In NuttX the simpler fix is probably to drop the two `select` lines from `ARCH_ARM7TDMI`. Without `ARCH_DCACHE`, NuttX's cache header turns all these calls into empty macros, and a chip with a cache could still select the options itself. I have not checked yet why the two lines were added in the first place, or whether one of the five chips depends on them.

## What happens next

I have not reported either fault yet. I plan to send an issue or a pull request for each, with the fix my port uses. Before that I want to look at the history of both places, so that the fix does not break a board that relies on the current behaviour.

## For anyone porting NuttX to an old ARM core

- Run it on the real hardware early. An emulator executes what the code says. The hardware executes what the architecture allows, and for unpredictable cases the two can differ.
- Check which options your core's Kconfig entry selects for you. "ARM7TDMI" in NuttX turned on cache support for a core that has none, and nothing complained until a rarely used path called it.
- Read Linux's version of the same low-level code. It has met the same problems on these cores, and its comments often say why an odd-looking instruction is there.
