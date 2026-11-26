---
title: "Why unplugging my ThinkPad locked it to 400 MHz, and how I fixed it in Rust"
description: "Diagnosing aggressive EPP CPU throttling, Wi-Fi latency jitter, and sleep resume failures on Linux, and building a lightweight suite of user-space daemons to fix them."
pubDatetime: 2026-11-26T03:00:00Z
draft: false
featured: true
tags:
  - rust
  - linux
  - systems
  - thinkpad
---

When I unplugged my laptop—a 5th-generation ThinkPad X1 Carbon running Fedora and GNOME—the entire desktop immediately turned into a slideshow. Moving windows stuttered, typing lagged behind my keystrokes, and scrolling in the terminal felt like 10 FPS.

Plugging the AC adapter back in instantly cured it. Unplug it, and the lag returned.

This post is the short breakdown of what was actually happening at the hardware and kernel level, why the default Linux battery profile broke desktop compositing, and how I built a set of unprivileged Rust daemons to handle battery scaling, suspend recovery, and power budgets properly.

The full code and Makefile are [on GitHub](https://github.com/Cpleasance/laptop-tools).

## The setup

The baseline machine is a ThinkPad X1 Carbon Gen 5 from 2017, but I've physically upgraded several of its core components:

| Component         | Factory Stock (2017)                     | Modded / Upgraded                                    | Real-World Impact                                                               |
| :---------------- | :--------------------------------------- | :--------------------------------------------------- | :------------------------------------------------------------------------------ |
| **Display Panel** | 14.0" FHD (1920×1080, ~2.07M px)         | **14.0" WQHD (2560×1440, ~3.68M px)**                | **+78% pixel count**; sharply increases GPU redraw workload on integrated RAM   |
| **Wireless**      | Intel Wireless-AC 8265 (Wi-Fi 5, BT 4.2) | **Intel Wi-Fi 6 AX200 (Wi-Fi 6 / 802.11ax, BT 5.2)** | 160 MHz channels & gigabit throughput; sensitive to aggressive power-save sleep |
| **Storage**       | OEM 256GB / 512GB SATA/NVMe              | **Samsung 970 EVO NVMe SSD**                         | High-performance PCIe 3.0 x4 read/write speeds                                  |
| **CPU / GPU**     | Intel Core i7-7600U · Intel HD 620       | Intel Core i7-7600U (2C/4T, 2.8–3.9 GHz)             | Dual-core Kaby Lake sharing a 15W sustained battery power envelope (`PL1`)      |
| **Memory**        | 16 GB LPDDR3-1866 dual-channel           | 16 GB LPDDR3-1866 dual-channel                       | Unified memory shared between CPU execution and Wayland compositor buffers      |

That screen mod turns a 2017 ThinkPad into a sharp, fantastic writing and coding machine, but it also increases the framebuffer pixel count by **78%**. On integrated graphics, the GPU shares LPDDR3 memory bandwidth and power budgets directly with the CPU cores. When driving 1440p on Wayland, the compositor (Mutter) has to render and blit almost 4 million pixels at 60 Hz without dedicated VRAM.

Dual-core CPUs from that era are still very capable, but they have zero headroom for wasted cycles. At 1080p, you might barely notice a sluggish power profile during light tasks. At 1440p on integrated graphics, it becomes immediate and unmissable.

Out of the box, modern Linux distributions delegate power management to `power-profiles-daemon`, which hooks into UPower and the kernel's CPU frequency scaling drivers.

When UPower signals that the laptop has transitioned to battery power, `power-profiles-daemon` automatically switches the system profile to `power-saver`.

## The investigation: why 400 MHz happens

I checked `scaling_cur_freq` and `energy_performance_preference` (EPP) across both CPU cores while on battery:

```text
CPU0: 599 MHz (governor: powersave, EPP: power)
CPU1: 599 MHz (governor: powersave, EPP: power)
```

The hardware minimum clock on the i7-7600U is 400 MHz. Setting EPP to `power` tells the Intel P-state hardware autonomous frequency selection (HWP) to minimize energy at all costs. The governor refused to ramp clocks up when GNOME Shell needed to render frame redraws, effectively locking the CPU between 400 and 800 MHz.

At 600 MHz, a dual-core CPU cannot service background daemons, browser Javascript, and a 1440p Wayland compositor at the same time. The compositor gets starved of cycles, frames drop, and the UI stutters.

<figure class="not-prose my-8"><svg viewBox="0 0 560 320" role="img" aria-label="Bar chart: CPU Clock frequency under power-saver vs balanced profiles." style="width:100%;max-width:600px;height:auto;font-family:inherit;font-size:14px"><text x="0" y="22" style="fill:var(--foreground);font-size:16px;font-weight:600">CPU Clocks under Desktop Load (MHz)</text><rect x="0" y="44" width="14" height="14" rx="3" style="fill:var(--accent);fill-opacity:.4"/><text x="20" y="56" style="fill:var(--foreground);font-size:13px">Stock (power-saver)</text><rect x="180" y="44" width="14" height="14" rx="3" style="fill:var(--accent);fill-opacity:1"/><text x="200" y="56" style="fill:var(--foreground);font-size:13px">Tuned (balanced)</text><line x1="340" x2="366" y1="51" y2="51" style="stroke:var(--muted-foreground);stroke-opacity:.8" stroke-dasharray="4 4" stroke-width="1.5"/><text x="374" y="56" style="fill:var(--muted-foreground);font-size:13px">1440p threshold (1,500 MHz)</text><line x1="55" x2="515" y1="250.0" y2="250.0" style="stroke:var(--muted-foreground);stroke-opacity:.25" stroke-width="1"/><text x="45" y="255.0" text-anchor="end" style="fill:var(--muted-foreground);font-size:12px">0</text><line x1="55" x2="515" y1="195.0" y2="195.0" style="stroke:var(--muted-foreground);stroke-opacity:.25" stroke-width="1"/><text x="45" y="200.0" text-anchor="end" style="fill:var(--muted-foreground);font-size:12px">1000</text><line x1="55" x2="515" y1="140.0" y2="140.0" style="stroke:var(--muted-foreground);stroke-opacity:.25" stroke-width="1"/><text x="45" y="145.0" text-anchor="end" style="fill:var(--muted-foreground);font-size:12px">2000</text><line x1="55" x2="515" y1="85.0" y2="85.0" style="stroke:var(--muted-foreground);stroke-opacity:.25" stroke-width="1"/><text x="45" y="90.0" text-anchor="end" style="fill:var(--muted-foreground);font-size:12px">3000</text><line x1="55" x2="515" y1="167.5" y2="167.5" style="stroke:var(--muted-foreground);stroke-opacity:.5" stroke-dasharray="4 4" stroke-width="1.5"/><path d="M125,250 V215 Q125,211 129,211 H211 Q215,211 215,215 V250 Z" style="fill:var(--accent);fill-opacity:.4"><title>power-saver profile: 699 MHz</title></path><text x="170" y="201" text-anchor="middle" style="fill:var(--foreground);font-weight:600;font-size:14px">699 MHz</text><path d="M355,250 V100 Q355,96 359,96 H441 Q445,96 445,100 V250 Z" style="fill:var(--accent);fill-opacity:1"><title>balanced profile: 2,800 MHz</title></path><text x="400" y="86" text-anchor="middle" style="fill:var(--foreground);font-weight:600;font-size:14px">2,800 MHz</text><line x1="55" x2="515" y1="250" y2="250" style="stroke:var(--muted-foreground)" stroke-width="1"/><text x="170" y="274" text-anchor="middle" style="fill:var(--foreground);font-size:14px;font-weight:600">power-saver</text><text x="170" y="294" text-anchor="middle" style="fill:var(--muted-foreground);font-size:12px">capped · stuttering</text><text x="400" y="274" text-anchor="middle" style="fill:var(--foreground);font-size:14px;font-weight:600">balanced</text><text x="400" y="294" text-anchor="middle" style="fill:var(--muted-foreground);font-size:12px">responsive · 60 FPS</text></svg></figure>

Worse, NetworkManager was also defaulting to Wi-Fi powersave (`wifi.powersave = 3`). On the upgraded Intel Wi-Fi 6 AX200, powersave sleep puts the radio to sleep between beacon intervals, causing ping spikes of 80–250 ms and dropped packets while browsing.

The fix wasn't to stay on AC power forever. The fix was to replace the naive profile switching with a daemon that balances power intelligently.

## Building the fix in Rust: `powerwatch`

Rather than writing brittle shell scripts tied to cron, I built `powerwatch` as a lightweight user-space daemon in Rust using `tokio` and `zbus`.

It runs unprivileged under `systemctl --user`, subscribes to the system D-Bus, and listens for UPower's `OnBattery` property changes.

When the laptop is unplugged:

1. It requests the `balanced` profile instead of `power-saver`. This sets EPP to `balance_power` or `balance_performance`, allowing the CPU to burst cleanly to 2.8–3.5 GHz when drawing windows, then drop immediately back to idle.
2. It sets Wi-Fi powersave to `false` over NetworkManager D-Bus to eliminate latency jitter.
3. It pauses heavy Docker containers or compile jobs so background processes don't burn battery.
4. It enforces an adaptive **power draw budget**: if total discharge exceeds a threshold (e.g. 15W), it selectively sheds heavy workloads without ever crippling the interactive desktop.

Here is the debounced event loop from the [real code](https://github.com/Cpleasance/laptop-tools/blob/main/powerwatch/src/main.rs):

```rust
tokio::select! {
    ch = stream.next() => {
        if let Some(c) = ch
            && let Ok(v) = c.get().await
            && v != cur
        {
            cur = v;
            info!("OnBattery changed -> {v}; debouncing {}s", DEBOUNCE.as_secs());
            deadline = Some(tokio::time::Instant::now() + DEBOUNCE);
            if flap_detector.observe(Instant::now()) {
                warn!("power source is flapping; throttling notifications");
                ctx.notify("Unstable charging connection", &notes).await;
            }
        }
    }
    _ = poll.tick() => {
        // Fallback poll in case of missed D-Bus signals
        if let Ok(v) = poll_proxy.on_battery().await && v != cur {
            cur = v;
            deadline = Some(tokio::time::Instant::now() + DEBOUNCE);
        }
    }
}
```

The debouncing and flap detection prevent rapid cycling when using a loose cable or a USB-C power bank that briefly renegotiates power Delivery contracts.

## Sleep resume and delay inhibitors: `resumecheck`

Fixing power on battery revealed the second issue: what happens when the laptop wakes up from suspend.

On Linux laptops, resuming from sleep often triggers race conditions:

- Network interfaces report "up" before the local DNS resolver is reachable.
- The Synaptics fingerprint reader (`open-fprintd` / `python3-validity`) occasionally fails to wake up from D3hot sleep, leaving the PAM stack hanging for 10 seconds on login.
- Bluetooth radios resume in a blocked rfkill state.

To fix this reliably, I wrote `resumecheck`. Instead of waiting for systemd post-resume scripts to run asynchronously after the screen turns on, `resumecheck` acquires a systemd logind **sleep delay inhibitor lock** over D-Bus:

```rust
let reply = proxy.call_method(
    "Inhibit",
    &(
        "sleep",
        "resumecheck",
        "Pre-suspend and post-resume state sync",
        "delay",
    ),
).await;
```

When logind prepares for sleep, it notifies `resumecheck` and pauses the suspend transition until the inhibitor file descriptor is released.

On resume, `resumecheck` runs a post-resume diagnostic sequence. If stubborn units like `open-fprintd-resume.service` failed to reinitialize the USB sensor, it automatically resets the unit through the systemd manager API before you even finish opening the lid.

## Hardware limits: RAPL and battery thresholds

Modern Intel CPUs have two primary hardware power limits governed by Running Average Power Limit (RAPL):

- **PL1 (Power Limit 1):** The sustained power cap (15W on battery, 25W on AC).
- **PL2 (Power Limit 2):** The short-duration burst cap (25W).

By inspecting `/sys/class/powercap/intel-rapl:0`, `powerwatch` monitors whether the system is hitting hardware power boundaries or thermal boundaries.

<figure class="not-prose my-8"><svg viewBox="0 0 560 310" role="img" aria-label="Line chart: Real-time battery power draw over time showing steady 8.2W consumption with smooth 2.8GHz clocks." style="width:100%;max-width:600px;height:auto;font-family:inherit;font-size:14px"><text x="0" y="22" style="fill:var(--foreground);font-size:16px;font-weight:600">Discharge Power Draw on Battery (Watts)</text><line x1="55" x2="515" y1="230.0" y2="230.0" style="stroke:var(--muted-foreground);stroke-opacity:.25" stroke-width="1"/><text x="45" y="235.0" text-anchor="end" style="fill:var(--muted-foreground);font-size:12px">0</text><line x1="55" x2="515" y1="175.0" y2="175.0" style="stroke:var(--muted-foreground);stroke-opacity:.25" stroke-width="1"/><text x="45" y="180.0" text-anchor="end" style="fill:var(--muted-foreground);font-size:12px">5</text><line x1="55" x2="515" y1="120.0" y2="120.0" style="stroke:var(--muted-foreground);stroke-opacity:.25" stroke-width="1"/><text x="45" y="125.0" text-anchor="end" style="fill:var(--muted-foreground);font-size:12px">10</text><line x1="55" x2="515" y1="65.0" y2="65.0" style="stroke:var(--muted-foreground);stroke-opacity:.25" stroke-width="1"/><text x="45" y="70.0" text-anchor="end" style="fill:var(--muted-foreground);font-size:12px">15</text><line x1="55" x2="515" y1="65" y2="65" style="stroke:var(--muted-foreground);stroke-opacity:.6" stroke-dasharray="4 4" stroke-width="1.5"/><text x="515" y="54" text-anchor="end" style="fill:var(--muted-foreground);font-size:12px;font-weight:500">PL1 hardware cap (15W)</text><g transform="translate(285, 78)"><rect x="0" y="0" width="230" height="28" rx="6" style="fill:var(--background);stroke:var(--accent);stroke-width:1.5"/><circle cx="16" cy="14" r="4" style="fill:var(--accent)"/><text x="28" y="19" style="fill:var(--foreground);font-weight:600;font-size:13px">8.22 W avg (~5.5h runtime)</text></g><path d="M 90 141 Q 140 135, 190 138 T 290 140 T 390 139 T 490 140" fill="none" style="stroke:var(--accent)" stroke-width="3"/><circle cx="90" cy="141" r="5" style="fill:var(--accent);stroke:var(--background)" stroke-width="2"><title>0m: 8.15 W</title></circle><circle cx="190" cy="138" r="5" style="fill:var(--accent);stroke:var(--background)" stroke-width="2"><title>15m: 8.35 W</title></circle><circle cx="290" cy="140" r="5" style="fill:var(--accent);stroke:var(--background)" stroke-width="2"><title>30m: 8.22 W</title></circle><circle cx="390" cy="139" r="5" style="fill:var(--accent);stroke:var(--background)" stroke-width="2"><title>45m: 8.28 W</title></circle><circle cx="490" cy="140" r="5" style="fill:var(--accent);stroke:var(--background)" stroke-width="2"><title>60m: 8.20 W</title></circle><line x1="55" x2="515" y1="230" y2="230" style="stroke:var(--muted-foreground)" stroke-width="1"/><text x="90" y="252" text-anchor="middle" style="fill:var(--muted-foreground);font-size:12px">0m</text><text x="190" y="252" text-anchor="middle" style="fill:var(--muted-foreground);font-size:12px">15m</text><text x="290" y="252" text-anchor="middle" style="fill:var(--muted-foreground);font-size:12px">30m</text><text x="390" y="252" text-anchor="middle" style="fill:var(--muted-foreground);font-size:12px">45m</text><text x="490" y="252" text-anchor="middle" style="fill:var(--muted-foreground);font-size:12px">60m</text><text x="290" y="285" text-anchor="middle" style="fill:var(--foreground);font-size:13px;font-weight:500">Continuous battery operation (minutes)</text></svg></figure>

To extend the physical lifespan of the battery cells, I paired this with `thresholdctl`, a tool that talks to the ThinkPad Embedded Controller via `/sys/class/power_supply/BAT0/`:

- **Desk Mode (75% start / 80% stop):** When docked, charging cuts off at 80%, avoiding the chemical degradation of keeping Li-ion cells saturated at 4.2V.
- **Travel Mode (95% start / 100% stop):** With one command (`thresholdctl travel`), it unlocks full capacity for long travel days.

## What didn't work

**Blindly trusting `power-saver`.** Capping CPU frequencies down to 600 MHz doesn't actually save that much power compared to "race-to-sleep". Modern CPUs are most efficient when they complete a burst of computation at high clock speeds and immediately return to deep C-states (`C7/C8`). Running at 600 MHz keeps the CPU active for four times as long, burning display and DRAM power while offering a terrible user experience.

**Aggressive audio power savings.** The Linux kernel module `snd_hda_intel` defaults to `power_save=1`. This puts the audio codec into `D3hot` sleep after just one second of silence. Waking the analog DAC causes a noticeable capacitor discharge "pop" or "click" in wired headphones. I built `audiopop-fix` to disable the aggressive codec timeout while keeping the rest of the chipset power-optimized.

**Ignoring GNOME's Caffeine extension.** If you use Caffeine or watch a video, GNOME's `SessionManager` holds an idle inhibitor lock (flag 8). An early version of my scripts tried to dim the screen and force sleep after idle periods on battery, fighting the user's explicit preference. Adding D-Bus idle-inhibition detection solved that: if Caffeine or an active video player holds the screen awake, the daemon backs off.

## Sources & prior art

A lot of the architecture here relies on documented Linux kernel sysfs contracts and systemd specifications rather than undocumented hacks:

- **Intel RAPL & EPP Scaling:** Intel's 64 and IA-32 Architectures Software Developer's Manual (Volume 3B, Chapter 14: _Power and Thermal Management_) details how Hardware-Controlled Performance States (HWP / EPP MSR `0x777`) calculate autonomous frequency stepping, and how Package Power Limits (`PL1/PL2`) enforce hardware energy clamping.
- **Race-to-Sleep vs. Energy-Delay Product:** The reason locking clocks at 600 MHz burns more total battery is well-established in systems research: dynamic baseline power from the display backlight and LPDDR3 RAM dominates idle draw. Running fast to return quickly to low-leakage C-states (`C7/C8`) minimizes the Energy-Delay Product (EDP).
- **systemd-logind Sleep Inhibitors:** The [systemd Inhibitor Locks API](https://systemd.io/INHIBITOR_LOCKS/) on `org.freedesktop.login1.Manager` documents the `Inhibit("sleep", ...)` delay lock contract used by `resumecheck` to synchronize suspend and resume hooks before screen lock.
- **Linux Kernel ThinkPad ACPI:** The [kernel thinkpad-acpi driver](https://docs.kernel.org/admin-guide/laptops/thinkpad-acpi.html) documents dual charge threshold attributes (`charge_control_start_threshold`, `charge_control_end_threshold`) and fan control sysfs paths.
- **Intel HDA Codec Power-Saving:** The [Linux kernel HD-Audio documentation](https://docs.kernel.org/sound/hd-audio/notes.html) covers codec D3hot low-power sleep and capacitor pop mitigation (`power_save=0`).

## What I took away

- **Hardware mods change software equations.** A custom 1440p panel mod is great for text sharpness, but pushing 78% more pixels on shared integrated GPU memory makes stock conservative power profiles fall off a cliff.
- **Slowdowns on battery are often software policy, not hardware limits.** The CPU wasn't thermally throttling or dying; `power-profiles-daemon` was blindly requesting an EPP profile that starved the desktop compositor.
- **Race-to-sleep beats low clock locking.** Running at 2.8 GHz for 10 milliseconds uses less total battery energy than dragging out the task at 600 MHz for 100 milliseconds while the display backlight drains power.
- **Inhibitors are cleaner than reactive polling.** Using systemd logind delay inhibitors eliminates resume race conditions before the user sees them.
- **Build tools that stay out of the way.** Both services run with zero CPU overhead, output structured JSON for status bars, and require zero manual toggling during daily use.

The [laptop-tools repository](https://github.com/Cpleasance/laptop-tools) contains the complete Rust workspace, Makefile, unit tests, and systemd service units.
