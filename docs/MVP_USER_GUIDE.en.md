# Launch Loop MVP — Step-by-step user guide and acceptance log

Edition: 24 September 2026 · Branch: `codex/mvp-integration` · Local, uncommitted MVP build.

[中文操作记录](MVP从零到一操作记录.md) · [LinkedIn setup in English](LINKEDIN_SETUP.en.md)

Use this guide to create, review, edit, and save a LinkedIn post, then prepare for publishing. Each step includes the action, expected result, and information to record. Blank log fields are for the operator to complete; they are not evidence that a step has already passed.

## What is ready

| Capability | Current acceptance status |
|---|---|
| Chinese and English writing | One real bilingual run and a selected-text revision passed. |
| Editing, proposals, saved versions, and publishing safeguards | Implemented; covered by local automated and browser checks. Formal-save and publishing browser tests used clearly identified synthetic data. |
| Background images | Startup and manual capability recheck passed. The old PNG failed visual inspection; a corrected-image attempt timed out after 420 seconds without an image. Visual quality and bilingual binding remain unverified. |
| LinkedIn OAuth and posting | Implemented locally; real authorization, image upload, and posting remain unverified because the operator has not prepared an app and HTTPS callback. |
| Regression checks | The resumed work passed the build and a final 211-test run. Ten candidate-rule checks passed in the preceding run. See the validation record for the earlier temporary-file cleanup failure and unchanged rerun. |

The current acceptance session can finish at step 9. Steps 10–11 describe later account setup and actual publication. Feedback is reserved for future work.

## 0. Open the correct workspace

**Do:** Open [the real MVP workspace](http://127.0.0.1:4348/) and select **English** in the top-right language control.

**Expect:** Navigation shows **Creation**, **Publishing**, and **Feedback**. The creation page contains **Writing brief**, **Local writing jobs**, **Review and edit**, and **Content library**.

Interface language is stored in this browser. It is independent of the draft languages selected in the form. Existing titles, source material, draft text, review findings, and execution evidence retain their original language.

Port **4348** contains the real drafts for this acceptance session. Port **4349** is a synthetic test instance. The original `main` checkout and its default port **4318** do not contain this uncommitted MVP integration.

If the page is unavailable, open PowerShell in the project root containing this guide and run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\server\Start-MvpAcceptance.ps1 -Mode Real
```

Do not restart a healthy instance during generation. This command restarts only the acceptance instance and preserves its data. The current computer already has the required runtime. On another computer, arrange Node.js 22.13 or newer and the operator's own working Codex login before attempting generation; credentials are not part of the project handoff.

**Record:** Time, URL, and whether the creation page opened.

## 1. Choose a quick review or a new run

- **Quick acceptance:** Under **Local writing jobs**, open the completed **Generation and review** job and choose its English draft. The existing content title is `MVP 真实待审 · system1-agents · 源语言修复复测` (the real system1-agents draft from the source-language correction test). Keep that exact title when locating it. Continue at step 5.
- **Create from scratch:** Complete steps 2–4. This uses the current Codex account's allowance and takes as long as the actual stages require.

Historical cancelled, timed-out, and failed image jobs are retained. Use the completed text job above to review the existing draft; a retry button starts work rather than opening the result.

**Record:** Existing-draft review or new generation.

## 2. Complete the three required fields

| Field | What to enter | Example or check |
|---|---|---|
| **Product materials / existing content** | Paste verified material, or use **Upload materials (.txt / .md)** to select a UTF-8 text file. | Include what the product does, who it serves, supported features, and limitations. Clearly distinguish verified facts from planned features. |
| **Writing goal** | Explain what the reader should understand or be able to do. | “Explain the problem this tool addresses, how it works, and when to use it. Do not imply that we have independently tested its performance.” |
| **Target readers** | Describe the audience, its background, and the decision it needs to make. | “Developers building AI agents who understand tool calling and want to assess whether this tool fits their workflow.” |

Optionally set **Content title** to something recognizable, such as “Product name — feature introduction — acceptance date.” Use **Reference article / previous draft** for an example structure or voice.

The app does not currently read a URL for you or parse PDF/DOCX uploads. Paste the relevant text or upload TXT/MD; a URL alone is insufficient source material.

**Expect:** All three required inputs are present. Uploaded materials show their actual filenames.

**Record:** Content title, source filename/version, writing goal, and target readers.

## 3. Check the output settings

Open **Optional settings**. Choose **LinkedIn**, **Chinese** and **English**, and **Feed post** for the bilingual acceptance flow. Choose author perspective, style, and length only where they help your brief.

**Expect:** “Only platform × language creates separate drafts: 2 selected.” Other platforms, Pulse articles, and threads are not yet supported.

For a new English-only post, leave **English** checked and uncheck **Chinese** under **Content language**. This changes the new output selection, not existing drafts or a global default.

Images may be left unselected for this text acceptance run. The system will request automatic images according to the available capability. An unavailable or failed image stage retains the text and reports its own status.

**Record:** Platform, selected draft languages, format, and any optional settings.

## 4. Generate and wait for the actual result

Click **Generate, review, and revise** once. Watch **Local writing jobs**.

The workflow creates a shared draft, adapts it to LinkedIn, reuses the same-language version or localizes another language, freezes the drafts, reviews each once, and revises after the reviews are complete. Skill selection is automatic; there is no separate research or review task to configure.

**Expect:** The actual stage, start time, and maximum duration appear. When the text workflow finishes, the selected language drafts become available. **Workflow finished** does not mean saved, approved by LinkedIn, or published. Check image status separately.

Use **Cancel** if you want to stop the job. If execution fails, record the stage and message. Conditional recovery is available only when the interface offers **Reuse the completed mother draft and resume once** or **Keep the bilingual drafts and resume the unfinished review once**. These are limited, explicit recovery actions. Avoid repeatedly regenerating unchanged inputs.

**Record:** Start/end time, completed stages, any error, and whether you cancelled or resumed.

## 5. Read and check the drafts

Click **LinkedIn · English** and, for a bilingual run, **LinkedIn · Chinese**. Check facts, numbers, intended use, limitations, and whether the two versions preserve the same meaning.

Read **LinkedIn text length**. Expand **View the automatic review** if needed. **Notes retained from the text review** and **View the publishing notes recorded during generation** preserve historical notes; assess them alongside the current text and image state.

**Expect:** Complete, editable text with **Temporarily saved · Awaiting confirmation**. You can inspect it before deciding to save a formal version.

**Record:** Content issues, agreement between languages, and compliance with the displayed length limit.

## 6. Edit directly or request a selected-text revision

**Direct editing:** Change the title or a paragraph in the editor. Wait for **Temporarily saved · Awaiting confirmation** before leaving the page. If temporary saving fails, retain your text and resolve the displayed error.

**Revision proposal:**

1. Select a sentence or passage inside one paragraph.
2. Enter **Revision instructions**, for example: “Make this more direct. Preserve the facts and numbers, and add no new claims.”
3. Click **Generate a revision proposal**. Avoid changing the same source draft while waiting.
4. Compare **Original selection**, **Proposed selection**, and the proposal's full text. Check that the unselected text is unchanged.
5. Choose **Accept proposal** or **Reject proposal and keep the original**. Accepting a proposal still leaves the content in temporary storage.

If the source changed while the proposal was running, the app may refuse to accept that proposal. Select the current text and submit a new request. To undo an accepted edit, use **Preview undo of the accepted edit**, inspect the reverse proposal, and accept it if appropriate.

If an edit changes shared facts, the other language receives a notice. Open that draft, select the affected passage, and choose **Propose shared-fact changes for this selection**. Review and accept or reject the independent proposal; it does not silently overwrite the other language.

**Record:** Selection, instructions, whether changes stayed within the selection, acceptance/rejection, and any cross-language follow-up.

## 7. Handle images — optional for this acceptance session

Use **Recheck image support** if the capability check fails or times out. It checks availability without generating an image; the button stays disabled while checking and there are no automatic retries. Image generation and quality remain unverified. You may continue with a text-only draft and save a text-only version.

When image support is available, **Generate an image for the current text** starts generation for the current draft. Inspect the resulting image and its visual-check status. An image that failed inspection remains in temporary diagnostics and must not be treated as approved.

You may use **Choose another image** for your own PNG/JPEG, up to 4 MiB. This LinkedIn stage supports one image. When image checking is available, a selected image is checked; upload alone does not prove generation or visual-check success. If editing makes an image outdated, replace or deselect it before saving.

**Record:** No image / selected image / generated image, its check status, and fit with the text. For the latest background-image acceptance, record “Capability recheck passed; generation timed out without an image; quality and bilingual binding pending.”

## 8. Confirm and save a formal version

When you approve the current draft and any selected image, click **Confirm and save this version**. This creates a local saved version; it does not publish.

**Expect:** The item appears under **Saved content** with its language and version number. Chinese and English are separate drafts; decide whether to save each one individually.

Open the saved item to check it. For later edits, use **Start a new revision**. Changes go into temporary storage first; confirming creates a new version and preserves the older one.

**Record:** Content title, language, version, confirmation time, and whether another language was also saved.

## 9. Inspect the publishing page — the current stopping point

Open **Publishing**, select **LinkedIn**, and choose the saved item and version under **Choose saved content and version**.

**Expect now:** You can inspect the saved version's text. The account area reports that publishing is unavailable or configuration is missing. **Prepare publishing preview** requires a real connected account.

Check that the page uses your selected saved version. Temporary drafts are not publishable. Record the missing configuration; setting up an app or posting publicly is not required to finish this text acceptance session.

**Record:** Selected item/version, text accuracy, and connection status.

## 10. Later: configure LinkedIn and authorize the account

This step has not yet been completed. Follow the [English LinkedIn setup guide](LINKEDIN_SETUP.en.md):

1. Prepare a developer app with the required login and member-posting access.
2. Prepare an HTTPS callback that exposes only the callback route.
3. Enter the app ID, secret, and callback URL locally; restart the correct instance and run the preflight checks.
4. In **Publishing**, click **Refresh connection and records**, then **Connect LinkedIn account**. Complete authorization on LinkedIn yourself.
5. Check the returned account name/ID, scopes, and expiry.

The setup guide uses this acceptance instance's `tmp/mvp-real/` directory and port **4348**, so the existing drafts remain in the same library. Tokens are held only in service memory; a restart requires authorization again.

**Record:** Preflight outcome, account ID, scopes, and expiry. Do not record secrets, tokens, or authorization codes.

## 11. Later: preview and publish

This step sends a real post and has not been executed in this acceptance session. Continue only when you decide to publish a specific saved version.

1. Choose the saved item/version and click **Prepare publishing preview**.
2. Check the account, version, language, complete text, image, and warnings. Chinese and English are separate publishing decisions.
3. Select **I have checked the text, images, language, and account above, and confirm publishing this saved version to LinkedIn.**
4. Click **Confirm publication to LinkedIn**. This is an actual submission, not a dry run.
5. Inspect **Publishing records**. After success, use **View the published post** to check the content and visibility on LinkedIn.

If the result is unknown, inspect LinkedIn manually and retain the original record. Do not repeatedly submit the same version. Posting permission does not imply permission to read the platform result, and a local timeout does not prove that no post was created.

**Record:** Account, version, language, selected image, submission time, status, and actual post URL.

## 12. Back up and finish

Click **Back up data** to download JSON containing saved versions and publishing records. It does **not** contain temporary drafts.

To preserve unconfirmed drafts, stop the service and back up the entire `tmp/mvp-real/data/` directory. Do not copy only the live SQLite file. Temporary content is not automatically cleaned up.

From the project root, stop this acceptance instance with:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tmp\mvp-real\Stop-Workbench.ps1
```

Closing the browser does not stop the service. Use step 0 to start it again with its data intact.

**Record:** Backup filename, whether the full data directory was copied, and stop time.

## Operator acceptance log

Fill this table from your own actions. Write “Not run” for unexecuted steps; do not substitute the developer's test results for your own observations.

| Step | Time | Action and observed result | Issue / follow-up |
|---|---|---|---|
| 0–1 Open workspace and choose the route | | | |
| 2–3 Materials and settings | | | |
| 4 Generation | | | |
| 5 Read the drafts | | | |
| 6 Edit / accept / reject / undo | | | |
| 7 Images | | | Deferred; optional for this session |
| 8 Save a version | | | |
| 9 Inspect the saved version in Publishing | | | |
| 10 Configure and authorize LinkedIn | | | App and callback not yet prepared |
| 11 Real publication | | | Not run in this session |
| 12 Back up and stop | | | |

Decision: ☐ Text workflow accepted · ☐ Changes required (describe above) · ☐ Images deferred · ☐ OAuth/publication deferred until setup is complete.
