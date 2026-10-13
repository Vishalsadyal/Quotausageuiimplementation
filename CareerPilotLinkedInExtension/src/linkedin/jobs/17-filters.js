/*
 * LinkedIn Jobs auto-apply - part 17: filters
 *
 * Easy Apply filter and the 'All filters' modal: switches, options, autocomplete values (companies,
 * locations).
 *
 * Plain content script: every part shares one scope and loads in numeric order (see manifest.json).
 * Functions here may call functions from any part; only 29-init.js runs code at load time.
 * Map of all parts and functions: docs/CODE_MAP.md
 */

async function applyEasyApplyFilterIfNeeded(settings) {
  if (!settings.easyApplyOnly) return;
  let urlHasEasyApplyParam = false;
  try {
    const url = new URL(window.location.href);
    urlHasEasyApplyParam = url.searchParams.get("f_AL") === "true";
  } catch {
    urlHasEasyApplyParam = window.location.href.includes("f_AL=true");
  }
  let easyBtn = getBySelectorList([
    "button[aria-label*='Easy Apply filter']",
    "button[aria-label*='Easy Apply']",
    "button.jobs-search-box__filter-pill-button"
  ]);
  if (!easyBtn) {
    const candidates = Array.from(document.querySelectorAll("button, label, span"));
    easyBtn = candidates.find((el) => visibleText(el).includes("easy apply")) || null;
  }
  if (!easyBtn) {
    // Fallback: use "All filters" modal and toggle Easy Apply there.
    const allFiltersBtn = getBySelectorList([
      "button[aria-label*='All filters']",
      "button[aria-label='All filters']",
      "button.search-reusables__all-filters-pill-button"
    ]);
    if (!allFiltersBtn) {
      if (urlHasEasyApplyParam) {
        await debugLog(settings, "Easy Apply button not visible, but URL already has f_AL=true", { url: window.location.href });
      } else {
        await logLine("Easy Apply filter button not found", "warn");
        await debugLog(settings, "Easy Apply filter selectors failed", { url: window.location.href });
      }
      return;
    }
    await resilientClick(allFiltersBtn, "All filters");
    await sleep(700);
    const switchInput = getBySelectorList([
      "input[role='switch'][aria-label*='Easy Apply']",
      "input[role='switch'][id*='easy-apply']"
    ]);
    if (switchInput) {
      const checked = switchInput.getAttribute("aria-checked") === "true" || switchInput.checked;
      if (!checked) {
        await resilientClick(switchInput, "Easy Apply switch");
        await logLine("Easy Apply filter enabled (all filters)");
        await botChat("Easy Apply filter activated. Focusing on quick applications...");
      }
      const showResults = getBySelectorList([
        "button[aria-label*='Apply current filters']",
        "button[aria-label*='Show']",
        "button[data-control-name*='all_filters_apply']"
      ]);
      if (showResults) {
        await resilientClick(showResults, "Show results");
      } else {
        const dismiss = getBySelectorList(["button[aria-label='Dismiss']", "button[aria-label*='Close']"]);
        if (dismiss) await resilientClick(dismiss, "Close filters");
      }
      await sleep(700);
      return;
    }
    if (urlHasEasyApplyParam) {
      await debugLog(settings, "Easy Apply switch not found in filters modal, but URL already has f_AL=true", { url: window.location.href });
    } else {
      await logLine("Easy Apply filter button not found", "warn");
      await debugLog(settings, "Easy Apply filter selectors failed", { url: window.location.href });
    }
    return;
  }
  const active = easyBtn.getAttribute("aria-pressed") === "true" || /active|selected/i.test(easyBtn.className);
  if (active) {
    await logLine("Easy Apply filter already active");
    return;
  }
  await resilientClick(easyBtn, "Easy Apply filter");
  await logLine("Easy Apply filter enabled");
  await sleep(900);
}

function hasAdvancedFiltersConfigured(settings) {
  return (
    Boolean(String(settings.salary || "").trim()) ||
    parseListSetting(settings.experienceLevel).length > 0 ||
    parseListSetting(settings.jobType).length > 0 ||
    parseListSetting(settings.companies).length > 0 ||
    parseListSetting(settings.filterLocations).length > 0 ||
    parseListSetting(settings.industry).length > 0 ||
    parseListSetting(settings.jobFunction).length > 0 ||
    parseListSetting(settings.jobTitles).length > 0 ||
    parseListSetting(settings.benefits).length > 0 ||
    parseListSetting(settings.commitments).length > 0 ||
    Boolean(settings.under10Applicants) ||
    Boolean(settings.inYourNetwork) ||
    Boolean(settings.fairChanceEmployer)
  );
}

function getAdvancedFilterSignature(settings) {
  return JSON.stringify({
    salary: String(settings?.salary || "").trim(),
    experienceLevel: parseListSetting(settings?.experienceLevel),
    jobType: parseListSetting(settings?.jobType),
    companies: parseListSetting(settings?.companies),
    filterLocations: parseListSetting(settings?.filterLocations),
    industry: parseListSetting(settings?.industry),
    jobFunction: parseListSetting(settings?.jobFunction),
    jobTitles: parseListSetting(settings?.jobTitles),
    benefits: parseListSetting(settings?.benefits),
    commitments: parseListSetting(settings?.commitments),
    under10Applicants: Boolean(settings?.under10Applicants),
    inYourNetwork: Boolean(settings?.inYourNetwork),
    fairChanceEmployer: Boolean(settings?.fairChanceEmployer),
  });
}

function hasAppliedAdvancedFiltersForCurrentRun(settings) {
  try {
    const raw = String(sessionStorage.getItem(ADVANCED_FILTERS_APPLIED_KEY) || "").trim();
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return (
      parsed &&
      parsed.runId &&
      parsed.runId === String(lastRunStartedAt || "") &&
      parsed.signature === getAdvancedFilterSignature(settings)
    );
  } catch {
    return false;
  }
}

function markAdvancedFiltersAppliedForCurrentRun(settings) {
  try {
    sessionStorage.setItem(
      ADVANCED_FILTERS_APPLIED_KEY,
      JSON.stringify({
        runId: String(lastRunStartedAt || ""),
        signature: getAdvancedFilterSignature(settings)
      })
    );
  } catch {
    // ignore storage failures
  }
}

function optionTextMatches(candidate, target) {
  const c = normalizeLabel(candidate);
  const t = normalizeLabel(target);
  if (!c || !t) return false;
  if (c === t) return true;
  if (c.startsWith(`${t} `)) return true;
  if (c.endsWith(` ${t}`)) return true;
  if (c.includes(` ${t} `)) return true;
  return false;
}

function isVisibleElement(el) {
  if (!(el instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function findVisibleControlByText(root, text) {
  const labels = Array.from(root.querySelectorAll("label"));
  for (const label of labels) {
    if (!isVisibleElement(label)) continue;
    if (optionTextMatches(label.textContent || "", text)) return label;
  }

  const controls = Array.from(root.querySelectorAll("button, [role='button'], span"));
  for (const control of controls) {
    if (!isVisibleElement(control)) continue;
    if (optionTextMatches(control.textContent || "", text)) return control;
  }
  return null;
}

function findFiltersModal() {
  return getBySelectorList([
    ".artdeco-modal[role='dialog']",
    ".search-reusables__all-filters-modal",
    ".jobs-search-box__all-filters"
  ]);
}

async function waitForFiltersModalOpen(timeoutMs = 3500) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const modal = findFiltersModal();
    if (modal) return modal;
    await sleep(120);
  }
  return null;
}

function findFilterApplyButton(modal) {
  return getBySelectorList([
    "button[aria-label*='Apply current filters']",
    "button[aria-label*='Show']",
    "button[data-control-name*='all_filters_apply']"
  ], modal);
}

async function setSwitchFilterByLabel(modal, labelText, enabled, settings) {
  const label = findVisibleControlByText(modal, labelText);
  if (!label) {
    await debugLog(settings, "Boolean filter label not found", { labelText });
    return false;
  }
  const container = label.closest("fieldset, section, li, div") || modal;
  const input = container.querySelector("input[role='switch'], input[type='checkbox']");
  if (!input) {
    await debugLog(settings, "Boolean filter switch not found", { labelText });
    return false;
  }
  const checked = input.getAttribute("aria-checked") === "true" || input.checked;
  if (checked === Boolean(enabled)) return true;
  const control = input.closest("label") || label;
  await resilientClick(control, `${labelText} filter switch`);
  await sleep(120);
  return true;
}

function findAutocompleteInputByHint(modal, hint) {
  const targetHint = normalizeLabel(hint);
  const inputs = Array.from(modal.querySelectorAll("input[placeholder], input[aria-label]"));
  return (
    inputs.find((input) => {
      const label = `${input.getAttribute("placeholder") || ""} ${input.getAttribute("aria-label") || ""}`;
      return normalizeLabel(label).includes(targetHint);
    }) || null
  );
}

async function addAutocompleteFilterValues(modal, hint, values, settings) {
  const cleaned = parseListSetting(values);
  if (!cleaned.length) return;
  for (const value of cleaned) {
    const input = findAutocompleteInputByHint(modal, hint);
    if (!input) {
      await debugLog(settings, "Autocomplete filter input not found", { hint, value });
      return;
    }
    input.focus();
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await sleep(180);
  }
}

async function applyAdvancedFiltersIfNeeded(settings) {
  if (!hasAdvancedFiltersConfigured(settings)) return;
  if (hasAppliedAdvancedFiltersForCurrentRun(settings)) {
    await debugLog(settings, "Advanced filters already applied for this run/settings signature", {
      runId: String(lastRunStartedAt || ""),
    });
    return;
  }
  const allFiltersBtn = getBySelectorList([
    "button[aria-label*='All filters']",
    "button[aria-label='All filters']",
    "button.search-reusables__all-filters-pill-button"
  ]);
  if (!allFiltersBtn) {
    await logLine("All filters button not found (advanced filters skipped)", "warn");
    await debugLog(settings, "All filters button missing", { url: window.location.href });
    return;
  }

  await resilientClick(allFiltersBtn, "All filters");
  const modal = await waitForFiltersModalOpen();
  if (!modal) {
    await logLine("Advanced filters modal did not open", "warn");
    return;
  }

  const optionTextValues = [
    ...parseListSetting(settings.experienceLevel),
    ...parseListSetting(settings.jobType),
    ...parseListSetting(settings.industry),
    ...parseListSetting(settings.jobFunction),
    ...parseListSetting(settings.jobTitles),
    ...parseListSetting(settings.benefits),
    ...parseListSetting(settings.commitments)
  ];
  const salary = String(settings.salary || "").trim();
  if (salary) optionTextValues.push(salary);

  for (const value of optionTextValues) {
    const control = findVisibleControlByText(modal, value);
    if (control) {
      await resilientClick(control, `filter option "${value}"`);
      await sleep(100);
    } else {
      await debugLog(settings, "Advanced filter option not found", { value });
    }
  }

  await addAutocompleteFilterValues(modal, "company", settings.companies, settings);
  await addAutocompleteFilterValues(modal, "location", settings.filterLocations, settings);

  await setSwitchFilterByLabel(modal, "Under 10 applicants", settings.under10Applicants, settings);
  await setSwitchFilterByLabel(modal, "In your network", settings.inYourNetwork, settings);
  await setSwitchFilterByLabel(modal, "Fair Chance Employer", settings.fairChanceEmployer, settings);

  const showResults = findFilterApplyButton(modal);
  if (showResults) {
    await resilientClick(showResults, "Apply current filters");
    await sleep(800);
    markAdvancedFiltersAppliedForCurrentRun(settings);
    return;
  }

  const dismiss = getBySelectorList(["button[aria-label='Dismiss']", "button[aria-label*='Close']"], modal);
  if (dismiss) {
    await resilientClick(dismiss, "Close filters");
  }
  markAdvancedFiltersAppliedForCurrentRun(settings);
}
