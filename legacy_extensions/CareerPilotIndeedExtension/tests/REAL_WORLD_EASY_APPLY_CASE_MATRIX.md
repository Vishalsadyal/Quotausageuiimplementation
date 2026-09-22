# Real-World Easy Apply Case Matrix

This matrix is the practical coverage target for the extension so it behaves safely and predictably on real LinkedIn Easy Apply flows.

## 1) Job Discovery and Card/Detail Selection

| Case | Why It Matters | Expected Behavior | Covered in Hard Replica |
|---|---|---|---|
| Card has weak/empty title (`Job`) | LinkedIn virtualized cards sometimes render partial text | Do not crash; attempt open and classify outcome | Yes |
| No Apply button in detail pane | Common for expired or partial render detail | Skip with `NO_APPLY_BUTTON` and continue | Yes |
| External Apply only | Avoid dead-end in Easy Apply-only mode | Skip as `EXTERNAL_APPLY_ONLY` or open external if allowed | No |
| Already Applied card | Prevent duplicate effort | Skip with `ALREADY_APPLIED` | No |
| Duplicate cards in one run | Virtualization can repeat cards | Use seen-job key dedupe | Partial |
| Daily Easy Apply limit | Hard stop condition | Detect limit text and stop run | No |

## 2) Modal Navigation and Stability

| Case | Why It Matters | Expected Behavior | Covered in Hard Replica |
|---|---|---|---|
| Multi-step `Next -> Review -> Submit` | Core easy-apply flow | Reach submit reliably | Yes |
| Stagnant modal signature | LinkedIn can block without obvious field focus | Apply aggressive fallback retry before pausing | Yes |
| Empty or vague validation text | Real validation messages are inconsistent | Retry and infer unresolved required fields | Yes |
| Resume required block | Very common blocker | Pause with `RESUME_REQUIRED` guidance | No |
| Pause-before-submit mode | Safety in live mode | Pause on submit step, resume manually | No |

## 3) Field Type Coverage

| Case | Why It Matters | Expected Behavior | Covered in Hard Replica |
|---|---|---|---|
| Text input (city/name/etc.) | Most common | Use rule-based answer, else AI/fallback | Yes |
| Phone/email fields | Often validated | Fill and auto-fix format on validation | Yes |
| Select dropdown with placeholder | Very common | Match option or safe fallback | Yes |
| Radio group | Common eligibility questions | Match option or safe fallback | Yes |
| Combobox/listbox custom component | LinkedIn custom controls | Open listbox, select matched/fallback option | Yes |
| Unlabeled required select/radio/input | Frequent in custom components | Use unlabeled fallback filler | Yes |
| Date picker (`This is today`) | Date-required screening questions | Auto-select today if visible | Yes |
| Textarea (summary/cover letter) | Long-form screening | Fill from settings or AI | No |
| File input / resume upload | Critical in some flows | Prompt/pause for manual upload | No (browser constraints) |

## 4) Compliance/Consent and Checkboxes

| Case | Why It Matters | Expected Behavior | Covered in Hard Replica |
|---|---|---|---|
| Follow company checkbox | Must follow user preference | Toggle based on `followCompanies` | Yes |
| Required legal consent checkbox | Blocks submit if unchecked | Auto-check required legal/rights/privacy checkboxes | Yes |
| Non-required marketing opt-in checkbox | Avoid unsafe auto opt-in | Prefer conservative/no unless configured | Partial |

## 5) Answer Logic Parity (Python Bot -> Extension)

| Case | Why It Matters | Expected Behavior | Covered in Hard Replica |
|---|---|---|---|
| Visa / sponsorship | High-frequency screening | Fill from `requireVisa` | Indirect |
| Work authorization / citizenship | High-frequency screening | Fill from `usCitizenship` | Indirect |
| Veteran / disability / gender / ethnicity | Compliance forms | Fill from profile settings | Indirect |
| Salary in monthly/lakh formats | Numeric transformation edge case | Convert annual to requested unit | Partial |
| Notice period in days/weeks/months | Numeric transformation edge case | Convert from configured days | No |
| “How did you hear about this job?” | Frequent optional question | Use configured website/linkedin fallback | No |

## 6) Operational Guardrails

| Case | Why It Matters | Expected Behavior | Covered in Hard Replica |
|---|---|---|---|
| Dry-run close behavior | Prevent perceived “stuck at submit” | Close modal after dry-run submit reach | Yes |
| Max applications per run | Run safety and predictability | Stop at configured cap | Yes |
| Max skips per run | Avoid infinite skip loops | Stop at configured cap | Partial |
| Pending questions queue | Human-in-the-loop for unknown fields | Register + pause + auto-resume on answers | No |

## Why Use a Hard Replica Page

1. It gives deterministic reproduction for edge cases that occur randomly on LinkedIn.
2. It lets us test fallback behavior safely without risking your real profile.
3. It is faster to iterate selectors, retries, and field strategies before live runs.

## How We Keep It Hard

1. Include one intentionally broken card (`NO_APPLY_BUTTON`) before a valid Easy Apply card.
2. Use mixed controls in one modal: radio, select, combobox, unlabeled required fields, date picker, consent checkboxes.
3. Keep validation strict (`Please make a selection`) so fallback paths are exercised.
4. Assert run outcomes through extension storage (`cpState`, history, pending questions), not only UI.

## Next Replica Pages To Add

1. Resume-required replica (forces `RESUME_REQUIRED` flow).
2. External-apply-only replica.
3. Invalid phone/email validation replica.
4. Textarea-heavy screening replica.
5. Deep custom component replica with nested listbox controls.
