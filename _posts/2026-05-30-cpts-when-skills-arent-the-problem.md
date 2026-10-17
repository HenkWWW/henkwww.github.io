---
title: "Passing the CPTS when your skills aren't the problem"
date: 2026-05-30
tags: [cpts, htb, mindset, exam-prep, panic, anxiety, passed, hacking]
summary: How I passed the CPTS despite anxiety
lang: "en"
alt_url: "/nl/blog/cpts-when-skills-arent-the-problem/"
---

I'm 53 years old, 27 of them as a sysadmin, and I've been on Hack The Box
regularly since 2024. To keep from getting stuck in the daily grind at
work, I started on the CPTS path in 2025. I finished it in 2026, certificate
and all. It took me two attempts. On the second attempt I had all 14
flags, while 12 would have been enough.

![Stack of self-help books on a shelf](/assets/img/blog/cpts-when-skills-arent-the-problem/self-help-books.jpg)
*Plenty of wisdom here — the question is where you put your attention.*

I've had an anxiety disorder all my life. It fades sometimes, and
sometimes I get panic symptoms. That's bad news in stressful situations:
it dampens your ability to think straight and to put things in
perspective. Stressful situations like exams and certifications you end
up walking away from instead of taking them on.

I wrote this blog for hackers with mental challenges like mine, to avoid
a few pitfalls.

You can do what I did: buy a stack of self-help books, put them on the
shelf, and keep going over and over what could go wrong. Reading those
books doesn't really help if you don't do it interactively. Or if you
don't have the right mindset. As Johan Cruyff said: "You only see it
when you get it." Sometimes it just doesn't work, because of stress or
other circumstances around you.

What certainly doesn't help is keeping your focus on the problem itself.
Put your attention on the things you actually enjoy instead. For me, and
probably for you, that's hacking. :)

There are plenty of blogs about how to prepare for CPTS and how to write
the report. Most are by people who are built differently than I am. I'm
not a hip young confident vlogger, and my information needs are different.

Online you read a lot about how hard the CPTS is and how many people
fail on the report. If you have a tendency to doubt yourself, or you get
stage fright, that can be the trigger never to start.

So here's my story and my pitfalls. I hope it's of some use to you.

## How it went for me

I was nervous as hell when I started the exam and went at it like a
maniac. I began enumerating frantically and jumped from one thing to the
next. I gave myself few moments to put things in perspective.

The first night I slept poorly. The moment I got out of bed I carried
on. The pace was fine, though. The second night I slept even worse. And
on day 3 I had tunnel vision and dug myself deep into a rabbit hole.

Instead of taking a step back, I pushed harder. When time started
running out, the panic kicked in. The result: you can no longer put
anything in perspective. Staying calm is key.

Because you're so bent on the flags, it sometimes comes at the expense
of the documentation. You do have to keep track of your chain, because
you'll have to redo it at some point.

In the end I found that for me it wasn't a skill issue at all; it was my
behaviour that did me in. Enumerating from panic, no structure, refusing
to sleep, not recovering from a bad first lead. Beyond that I think 10
days is quite short; writing a report takes real time too.

If you recognise that pattern, I have a few tips.

## Mindset

A few things to internalise before you click *start*:

1. **You have a second attempt.** Effectively that's 20 days, not 10.
   The clock isn't as tight as it feels.
2. **Submit a report on your first attempt no matter what.** Even if you
   don't have all the flags. Otherwise you don't get a retake.
3. **Writing the report takes real time.** A few days, not a few hours.
   Build that into your schedule, not as an afterthought.
4. **Stay close to the course material.** Exotic chains outside what HTB
   Academy covers are unlikely. Trust the syllabus.
5. **Keep breathing.** Calmly. Out loud if you need to. Panic mode is
   not where you do good analysis.
6. **Go for a run or a walk.**

Do the things that give you rest. In panic you can't do good analysis.
Sleep deprivation does the same. Don't start the exam like a maniac.
Read what's actually being asked first.

## What helped me

**Practise the report before the exam.** Before you start on CPTS, write
a couple of mock reports in SysReptor based on retired HTB boxes. You'll
get the structure into your muscle memory and discover how long it takes
when there's no pressure on the clock. Read other CPTS students' blog
posts, especially the ones about what the report needs to contain. That
knowledge is portable: during the engagement you use it to pre-fill
sections as you go.

**Document the chain as you build it.** At every step, not just the
successful ones: write down what you tried, what worked, what didn't,
and the relevant CVE or CWE. Take screenshots of the moments that
matter. Don't tell yourself you'll remember; under stress, you won't. It
costs you a few minutes during the work and saves you hours on the
report.

**After the flags, walk it again as a layperson.** Once you have all the
flags, go back through your chain step by step as if you were explaining
it to someone who wasn't there. There should be no gaps. For each step,
ask: what CWE underlies this?

## If you're a sysadmin, use it

Don't be shy about bringing your operational background into the
report. If you've spent years running the infrastructure you're now
breaking into, you have a perspective most pentesters don't: you know
how the defenders will respond to your recommendations, what's realistic
to implement, and what would actually have caught the chain in
production. That makes your remediation advice more grounded than a
textbook recommendation. Put it in the report.

## Closing

You don't have to be a hip young hacker to do this. The exam asks for
technical skills and a coherent report. Beyond that, it takes time.

You miss every shot you don't take.

![CPTS certificate](/assets/img/blog/cpts-when-skills-arent-the-problem/certificate.jpg)
*Second attempt — 14 of 14.*
