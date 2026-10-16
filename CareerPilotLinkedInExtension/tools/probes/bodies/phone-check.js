// Phone field check for the open Easy Apply form. Read-only unless CONFIG.fill is true. Never clicks Next/Submit.
(() => {
  const CONFIG = {
    phone: "+91 98055 59015", // what you saved in the extension (any format)
    fill: false, // true = also type the cleaned number into the phone field, to prove it is accepted
  };

  // Same rules as src/linkedin/jobs/08-answers.js normalizePhoneForInput and 25-form-fill.js shouldUseNumericFallbackForTextInput.
  const normalizePhoneForInput = (value) => {
    const digits = String(value || "").replace(/[^\d]/g, "");
    if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
    if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
    return digits;
  };
  const norm = (t) => String(t || "").toLowerCase().replace(/\s+/g, " ").trim();
  const wouldUseNumericFallback = (label, input) => {
    const type = norm(input.getAttribute("type") || "");
    const l = norm(label);
    if (/\b(phone|mobile|tel|telephone|contact number|zip|postal|pin ?code)\b/.test(l)) return false;
    if (type === "tel") return false;
    if (type === "number") return true;
    return l.includes("year") || l.includes("how many") || l.includes("number of") || l.includes("gpa") || l.includes("score");
  };

  const roots = [document, document.getElementById("interop-outlet")?.shadowRoot].filter(Boolean);
  const modal = roots.map((r) => r.querySelector("dialog[open], [role='dialog']")).find(Boolean);
  if (!modal) return console.log("FAIL  No open dialog found. Open an Easy Apply form first (do not submit).");

  const labelOf = (el) => {
    const byFor = el.id ? modal.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null;
    const wrapper = el.closest("label, fieldset, [componentkey], [data-test-form-element], div");
    return (byFor?.textContent || el.getAttribute("aria-label") || wrapper?.querySelector("label, legend")?.textContent || "").trim();
  };

  const inputs = Array.from(modal.querySelectorAll("input, textarea, select"));
  const phoneInputs = inputs.filter((el) => {
    const l = norm(labelOf(el));
    return el.type === "tel" || /phone|mobile/.test(l) || /phone/i.test(el.name || el.id || "");
  });
  const rows = phoneInputs.map((el) => {
    const label = labelOf(el);
    return {
      label: label.slice(0, 40),
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute("type") || "",
      value: el.value,
      required: el.required || el.getAttribute("aria-required") === "true",
      numericFallbackWouldFire: wouldUseNumericFallback(label, el),
    };
  });
  console.table(rows);

  const cleaned = normalizePhoneForInput(CONFIG.phone);
  const tests = [
    ["+91 98055 59015", "9805559015"],
    ["919805559015", "9805559015"],
    ["09805559015", "9805559015"],
    ["9805559015", "9805559015"],
  ].map(([input, want]) => [`normalize "${input}"`, normalizePhoneForInput(input) === want, `-> ${normalizePhoneForInput(input)}`]);

  const mobileField = phoneInputs.find((el) => el.tagName === "INPUT" && !/country/i.test(labelOf(el)));
  const checks = [
    ["phone field found", Boolean(mobileField), `${phoneInputs.length} phone-related control(s)`],
    ["saved number cleans to 10 digits", /^\d{10}$/.test(cleaned), `"${CONFIG.phone}" -> "${cleaned}"`],
    ["field is not filled with a stray value", !mobileField || mobileField.value === "" || mobileField.value === cleaned, `current value "${mobileField?.value ?? ""}"`],
    ["numeric (years) fallback cannot fire on it", !mobileField || !wouldUseNumericFallback(labelOf(mobileField), mobileField), `type="${mobileField?.getAttribute("type") || ""}"`],
    ...tests,
  ];

  if (CONFIG.fill && mobileField) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    mobileField.focus();
    setter.call(mobileField, cleaned);
    mobileField.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    mobileField.dispatchEvent(new Event("change", { bubbles: true }));
    checks.push(["field accepted the typed number", mobileField.value === cleaned, `value now "${mobileField.value}"`]);
  }

  for (const [name, ok, detail] of checks) console.log(`${ok ? "PASS" : "FAIL"}  ${name} - ${detail}`);
  window.__cpPhone = { rows, checks };
  console.log("Result kept in window.__cpPhone");
})();
