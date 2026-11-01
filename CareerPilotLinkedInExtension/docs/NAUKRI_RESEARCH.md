# Naukri.com auto-apply: research notes (2026-10-30)

Starting point for the Naukri module. Collected from recent open-source Naukri bots, read at source level.
Confirm everything on the live site with `tools/probes/out/naukri-probe.js` before relying on it.

## Reference repos and licenses

| Repo | Updated | License | Approach | Use |
|---|---|---|---|---|
| github.com/GuptaSoujanya/Morrow (`naukri_bot/apply.py`, `chatbot.py`, `sources.py`) | 2026-10 | MIT | Selenium DOM + fetch/XHR hook on the apply API | Best reference |
| github.com/abhitej1216/-naukri-automation (`autoapply.py`) | 2026-10 | MIT | Selenium, recommended-jobs multi-apply | Good |
| github.com/Hemanth-kumar-N-arya/naukri-job-apply-ai (`naukri_apply.py`) | 2026-08 | MIT | Playwright DOM, JS clicks | Good |
| github.com/maruhtikishore/naukri-morning-bot (`src/bot.ts`) | 2026-10 | none | Playwright DOM | Read only, don't copy |
| github.com/pncodes10/Naukri-Automation (`api.js`) | 2026-04 | none | Pure internal API | Read only, don't copy. Contains a leaked real session token: never reuse |
| github.com/rahulswargam/jobsprint, github.com/Aman-Dayal/jobautobot | 2025–26 | GPL-3.0 | Playwright DOM | Don't copy (GPL) |

Only MIT code may be adapted (keep their copyright notice). Everything else: learn the facts, write our own code.

## URLs
- Search: `naukri.com/{kw}-jobs`, `-jobs-{page}`, `-jobs-in-{loc}`, `-jobs-in-{loc}-{page}`
- Job page: `naukri.com/job-listings-{slug}-{jobId}` (also resolves as `job-listings-{jobId}`)
- Recommended: `naukri.com/mnjuser/recommendedjobs`. Expired session redirects to `/nlogin`.

## Selectors (corroborated by 2–4 recent repos)
- Search cards `.srp-jobtuple-wrapper` → `a.title`. Recommended cards `article.jobTuple[data-job-id]`, checkbox `.tuple-check-box`, `.multi-apply-button`.
- Apply on Naukri `#apply-button`; external `#company-site-button` (text "Apply on company site"); already applied `#already-applied`. Check external first.
- **Save trap**: Save and Apply are siblings in `[class*='apply-button-container']`, Save first. Never click the container generically.
- Chatbot drawer `[id*='ChatbotContainer'], .chatbot_Drawer`; messages `.chatbot_MessageContainer`.
- Current question: last of `.chatbot_ListItem.botItem .msg, .chatbot_ListItem .botMsg .msg` (poll: drawer paints before the text).
- Text answer: `.textArea[contenteditable='true']` (not an input). Fill with `execCommand('insertText')` + `input`/`change` events; strip newlines (Enter submits).
- Radio `.ssrc__radio` + `.ssrc__label`; multi-select `.multiselectcheckboxes, .multicheckboxes-container` → click `.mcc__label`; chips `.chatbot_Chip`; select `.chatbot_MessageContainer select`; date of birth `.dob__container input[name=day|month|year]` (older).
- Save/Send: wait until `[id^='sendMsg__']` loses `disabled`, then JS-click `.sendMsg` (`.chatbot_Overlay` intercepts real clicks; clicking while disabled is a silent no-op).
- Done: drawer closes / bot says "thank you for your responses" / "successfully applied" / button turns "Applied".

## Apply API (let the page call it; only read the response)
- `POST /cloudgateway-workflow/workflow-services/apply-workflow/v1/apply`, body `{strJobsarr:[ids], applyData:{<jobId>:{answers:{<questionId>:value}}}, chatBotSDK:true, ...}`.
- Response: `jobs[].status` (200 = applied), `quotaDetails.dailyApplied`, and when questions are needed `jobs[].questionnaire[]` with `questionId`, `questionName`, `questionType` ("Text Box" | "Radio Button" | "Check Box" | "List Menu"), `answerOption`. This gives the questions as structured data, ideal for the answer bank.
- Quota exhausted: HTTP 403 `{"message":"Daily quota of jobs exceeded","customErrorCode":403009}` while the page only shows a generic error.
- Headers seen: `appid: 121`, `systemid`, `clientid: d3skt0p`, `nkparam` (generation unknown), `authorization: Bearer <nauk_at cookie>`. Calling the API directly would depend on these, so don't: drive the UI and read its responses.

## Limits and risks
- ~50 applications per day (Naukri quota). Company-site applications don't use it.
- Stop on: "daily quota", "quota has been expired", "too many requests", "unusual activity", "verify you are human", "captcha", "temporarily blocked", "access denied", reCAPTCHA iframes.
- Captcha / OTP on first login from a new device. Akamai bot-manager cookies are present.
- Naukri's terms restrict automation, as LinkedIn's do: keep pacing, daily limits and pause-for-human like the LinkedIn module.

## Confirmed on the live site (2026-10-30, naukri-apply-probe recording)
- Search API (`/jobapi/v3/search`) `jobDetails[]`: `companyApplyJob` true = "Apply on company site" (with `applyRedirectUrl`), false = apply on Naukri; `questionnaireIdPresent` true = recruiter chatbot will ask questions. Cards themselves carry no marker.
- Job page: `<div class="…apply-button-container…"><button class="…save-job-button…">Save</button><button id="apply-button">Apply</button></div>`, plus a "Follow <company> as you apply" checkbox ticked by default (Apply also POSTs `/cloudgateway-mynaukri/jobseeker-follow-services/…/followers/self`).
- Apply is TWO calls to `apply-workflow/v1/apply`:
  1. on the Apply click: HTTP 200 but `jobs[0].status` null with `questionnaire[]` (4 questions) + `chatbotResponse` → the chatbot opens. NOT applied yet.
  2. ~2.5 s after the bot's "Thank you for your responses.": `jobs[0].status` 200, `applyStatus`, `quotaDetails {dailyApplied, dailyQuota: 50, monthlyQuota: 2000}` → applied.
  Then Naukri loads `/myapply/saveApply?strJobsarr=[<id>]&…&multiApplyResp={"<id>":200}` ("Applied to "<title>"").
- Each chatbot answer: Save → POST `/cloudgateway-chatbot/chatbot-services/botapi/v5/respond`. Answer kinds seen: text box (`.textArea[contenteditable]`, Save enables after typing), radio (`.ssrc__radio` + `label.ssrc__label`), chips (`.chatbot_Chip`, Save hidden via `.sendMsgbtn_container.visibility-hidden`, "Load more" = `._link`). The drawer is re-drawn between questions (briefly absent).
- Daily quota: 50 (from `quotaDetails`).
