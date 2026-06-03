# Project Checklist

## Done

- [x] Fixed inverted forward/backward movement so `W` moves forward and `S` moves backward.
- [x] Added automated movement tests with `npm test`.
- [x] Added an objective compass that points toward unresolved incidents.
- [x] Added an end-of-shift score report when all tickets are resolved or site health reaches zero.
- [x] Added tests for compass targeting and score calculation.
- [x] Added a restart-shift action from the score screen.
- [x] Tracked per-ticket response time and included it in the score report.
- [x] Added incident escalation stages with stronger visual and metric consequences.
- [x] Added a settings panel for mouse sensitivity, invert Y, and movement speed.
- [x] Added an in-browser smoke test for starting a shift and opening a task.

## Next Steps

- [x] Add a restart flow that resets state without reloading the page.
- [ ] Add a task journal that records which action was completed at each minute.
- [ ] Add difficulty presets that change incident escalation thresholds.
- [ ] Add audio cues for critical escalation and task completion.
- [ ] Split the Three.js bundle with manual chunks to address the Vite chunk-size warning.
