---
title: A local model I never have to believe
summary: I gave a 27B model on my graphics card real work in a reverse-engineering project. It only became useful once every answer went through a checker, and most of what went wrong was in the tools around it.
date: 2026-10-11
project: agent-config
---

The first test for the local model was to describe ten functions whose behaviour was already known. Eight descriptions were right. The other two called a signed comparison unsigned. In C that is a bug that only shows for values with the top bit set, and nothing in the text gave it away.

The model runs on a graphics card with 24 GB of memory. I wanted it to take bulk work off a project. A reader that is right eight times in ten is no help there, if everything has to be read again to find the other two.

## What existed

The project is a reconstruction of an old camera's firmware in C. Claude does most of the work in long sessions. Every rewritten function is linked over the original image and run in an emulator against the original, on test cases that execute every instruction. A second tool changes each rewrite in small ways and reports the changes no test notices.

So the project already had a judge for one kind of answer. It had none for prose.

The model is qwen3.8-27b with 4-bit weights behind llama-server. It answers one request at a time and takes between half a minute and a few minutes for a function of up to 200 bytes. A wrapper lets Claude Code call it from the shell.

## Sort the work by who can check it

The split that made the model useful is about the checker, and the model's ability hardly comes into it.

| The answer is | Who decides | Result |
| --- | --- | --- |
| a function rewritten in C | the emulator, on the function's test cases | 12 of 12 small functions accepted, 10 at the first try |
| an input that reaches a given instruction | the emulator: the instruction ran or it did not | 1 of 8 reached |
| a claim that an instruction can never run | a reader | 2 of 2 correct |
| a description | nobody | 8 of 10 right |

A tool sends one function per request and compiles the answer. On a failure it sends the checker's output back, for up to three tries in all. The model worked through a queue in the background while Claude did other things on the CPU.

A second batch of 20 larger functions, 252 to 500 bytes each, took 109 minutes. The tests accepted 17.

## What the checker does not say

Passing the tests means the C agrees with the original on those inputs. It does not mean anyone has read it.

I decided that such a function may replace the mechanical translation only if no small change to it goes unnoticed by its tests. Of 37 functions the tests accepted, 11 met that. They are counted in the progress report as their own category, apart from the hand-written ones.

The rest stay out of the build. They are kept in the repository as reading material, with a header that says nobody has checked them. Before that they sat in an untracked build directory for hours, and they were hours of work for the card.

Later a review agent read 32 of the accepted functions against the original listings. In 26 it found no difference. Four loaded or stored a memory location a different number of times than the original, which the tests did not compare. They do now.

One function could not be right at all. The original copies a 12-character file name and its terminating zero into a 12-byte buffer on the stack. The thirteenth byte clears the low byte of a register saved for the caller. No test had seen it, and the mechanical translation of that function had been in the build without it. A scan for the same shape found three more functions.

The reaching task shows the limit from the other side. For four of eight functions the model reasoned until it ran out of tokens and wrote no answer. One input it proposed was wrong, and the emulator said so. The two claims it made were both right, and each named the addresses that proved it, so reading them took a minute.

## Most failures were in the tools

The sign errors went away when the listing tool wrote what each branch tests behind it, such as `; signed >`. Before that the model had to work it out from the mnemonic. The annotation helps a human reader as much as the model.

The model also found a bug on our side. It reported that a branch went to an address that was not in the listing. The listing tool dropped a line that happened to be a branch target.

Asked directly over HTTP with a limit of 12,000 tokens, five of the first ten requests came back empty. The model had spent the limit reasoning. The tool then gave the placeholder text to the compiler and sent the compiler's complaint back to the model, which could do nothing with it.

The test runs slowed the model down, although it computes on the graphics card. They used all 32 threads of the processor, and the one thread that drives the card had to share.

| Test run | Model, tokens/s |
| --- | ---: |
| paused | 82 |
| all cores, lowest priority | 55 |
| two cores left free | 76 |

Priority alone did not help. Keeping the bulk jobs off two physical cores did. The first measurements sampled a counter every 12 seconds, which gave nonsense whenever a sample fell between two requests. The tool now logs the server's own figure for each answer. Over 20 answers that came to 70 tokens a second.

## What I would do again

Build the checker before the prompt. Hand over only work whose answer a program can test, and treat everything else the model says as a lead to read.

Put into the input what a tool already knows. Every fact the model had to infer was a place where it could be wrong without anyone noticing.

Test the checker by hand with a right answer, a wrong one and a malformed one. Read the rejected answers before blaming the model.

Decide beforehand what a passing answer must meet to be used, and count it separately from reviewed work. Otherwise the progress numbers start to mean less than they say.

Then have someone read a sample anyway. The checker defines what right means, and reading is how we found out what it had left out.

The loop, the wrapper for the cores and the rules are in my [agent-config](https://github.com/dwzg/agent-config) repository as the plugin `local-model-tandem`.
