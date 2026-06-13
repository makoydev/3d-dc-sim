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
- [x] Added ordered task procedures with wrong-step health and pressure penalties.
- [x] Removed visible task step numbers so procedure order must be inferred.
- [x] Shuffled task action choices so display order does not reveal procedure order.
- [x] Added randomized incident variants with plausible distractor actions.
- [x] Added diagnostic telemetry clues before response actions unlock.
- [x] Added operational consequence feedback for procedure mistakes.
- [x] Added a shift grading breakdown with mistake, response-time, and difficulty adjustments.
- [x] Added post-incident debriefs with correct sequence and mistake consequences.

## Next Steps

- [x] Add a restart flow that resets state without reloading the page.
- [x] Add a task journal that records which action was completed at each minute.
- [x] Add difficulty presets that change incident escalation thresholds.
- [x] Add audio cues for critical escalation and task completion.
- [x] Split the Three.js bundle with manual chunks to address the Vite chunk-size warning.
- [x] Add escalation countdowns to active work orders.
- [x] Add a floor map with player and incident positions.
- [x] Add priority ranking and recommended-next badges to work orders.
- [x] Add a pause menu with resume and restart actions.
