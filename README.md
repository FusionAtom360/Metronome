# Practice Metronome

A simple metronome with customizable subdivisions and a structured practice mode for gradually increasing tempo.

## Overview

This app is designed to provide a reliable, minimal metronome experience with a focus on intentional and incremental practice. It keeps the interface straightforward while adding tools that support progressive improvement.

This project includes precise timing, user-driven practice workflows, and browser-based audio control. While intentionally minimal in scope, the app focuses on accuracy, clarity, and extensibility rather than feature bloat.

It is built using vanilla JavaScript (PWA) with explicit timing and scheduling logic, and integrates the Web Audio API.

## Features

- Mobile and desktop interface

- Adjustable tempo (BPM)

- Customizable beat subdivisions

## Practice Mode

A guided practice workflow for gradually increasing tempo.

### Configure:

- Initial tempo

- Target tempo

- Number of successful repetitions required to advance

- BPM increment per step

- BPM penalty for mistakes

### Practice flow:

- The metronome sets the current tempo

- You indicate success or failure

- On success, progress is tracked toward the next tempo

- On failure, a tempo penalty is applied

- The process continues until the target tempo is reached

This mode is intended for focused, deliberate tempo building rather than continuous free play.

### Future Improvements

- Add tuning drones

- Modularize codebase

- Add an instrument tuner

- Revamp and refine the UI
