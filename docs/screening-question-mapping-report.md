# Screening question mapping report

Generated 2026-10-16 from the live screening answers of all users (latest answer per user and question; counts only, no personal data).

## Summary

| | Count |
|---|---|
| Distinct question keys saved | 254 |
| Keys that fall into a shared-answer group | 170 (67%) |
| Shared-answer groups found | 26 |
| Keys left on their own | 84 (59 of them asked by only one user) |
| Keys that are the same wording saved twice | 66 keys in 33 pairs |

If each group shared one stored answer, 254 keys would shrink to about 110 (26 groups + 84 single questions), a 57% reduction.

## Groups where one answer can serve every question

| Group | Keys | Saved answers | Example keys |
|---|---|---|---|
| Current salary / CTC | 38 | 72 | what_is_your_current_ctc, please_enter_your_current_ctc_in_inr, can_you_share_your_current_take_home_salary |
| Expected salary / CTC | 27 | 180 | cp_pref_desired_salary, desired_salary, what_is_your_expected_ctc, please_enter_your_expected_ctc_in_inr |
| Notice period / joining time | 18 | 34 | notice_period_days, how_soon_can_you_join, when_will_you_be_able_to_join |
| Experience with one technology | 17 | 48 | what_is_your_experience_with_react / reactjs / django / golang |
| Preferred salary range (min / max) | 6 | 220 | cp_pref_salary_min / max, salary_range_min / max |
| Current city / location | 5 | 128 | current_city, location_city_, from_where_are_you_based |
| Preferred job titles | 5 | 252 | cp_pref_search_terms, preferred_job_titles, autoapply_cv_preference_search_terms |
| Preferred locations | 5 | 159 | cp_pref_search_locations, preferred_locations, careerpilot_preference_search_location |
| Work mode (remote / onsite / hybrid) | 4 | 292 | cp_pref_work_mode, remote_onsite_hybrid, comfortable_working_onsite |
| Confidence level | 4 | 216 | cp_pref_confidence_level, confidence_level, autoapply_cv_preference_confidence_level |
| Professional summary | 4 | 235 | description, summary, summary_of_experience |
| Exclude / blacklist keywords | 4 | 33 | bad_words, exclude_keywords, blacklist_exclude_keywords |
| Name (first / last / full) | 3 | 469 | first_name, last_name, full_name |
| Visa sponsorship | 3 | 314 | visa_sponsorship_required, cp_pref_require_visa, need_visa_sponsorship |
| Technical skills | 3 | 49 | core_skills, skills, technical_skills_competencies |
| 14 smaller pairs | 2 each | | Phone/email, job types, years of experience, preferred countries, 1-word and 2-word keywords, U.S. work authorization, postal/ZIP, resume upload, where you heard of us, industry worked in, reason for leaving |

## Findings

1. **The site itself creates duplicate keys.** The same setting is stored under up to four names: `cp_pref_*`, a plain name, `autoapply_cv_preference_*` and `careerpilot_preference_*`. Example: confidence level exists as 4 keys, and years of experience, job types, countries and visa sponsorship as 2 to 3 each. These always hold the same answer, so they can be merged with no risk.
2. **Salary questions are the biggest gap.** LinkedIn phrases current and expected CTC in about 65 ways (CTC, CCTC, ECTC, LPA, lakhs, INR, annual, in-hand, take-home). Each wording is saved as a new key, so the same answer is stored again for every new job.
3. **Same wording saved twice.** 33 questions exist twice, once with a trailing underscore or repeated text and once without. They are always the same question.
4. **59 questions were asked by only one user.** These are one-off, job-specific questions (for example "Are you comfortable travelling to China?"). They cannot be shared.

## Cautions before merging

- Keep **current** and **expected** salary in separate groups. They have different answers.
- Salary answers differ in format: LPA, full INR amount, monthly or hourly. A shared answer needs the unit stored with it.
- "How soon can you join" is sometimes answered as a number of days and sometimes as text ("Immediate").
- "Experience with a technology" shares a question type but not the answer: React and Django need different numbers.
- Groups were found by matching wording rules, so a few questions may be placed in the wrong group. Check the list before building anything on it.
