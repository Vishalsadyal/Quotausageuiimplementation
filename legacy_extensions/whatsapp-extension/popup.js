// Popup UI logic for WhatsApp Campaign Extension

(function () {
  // ─── DOM References ───────────────────────────────────────────

  const statusValue = document.getElementById("statusValue");
  const progressFill = document.getElementById("progressFill");
  const progressText = document.getElementById("progressText");
  const logList = document.getElementById("logList");
  const historyList = document.getElementById("historyList");
  const cancelBtn = document.getElementById("cancelBtn");

  // ─── Tab Switching ────────────────────────────────────────────

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      const tabName = tab.dataset.tab;
      document.getElementById("tabLogs").classList.toggle("hidden", tabName !== "logs");
      document.getElementById("tabHistory").classList.toggle("hidden", tabName !== "history");

      if (tabName === "history") loadHistory();
    });
  });

  // ─── Cancel Button ────────────────────────────────────────────

  cancelBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "cancel_campaign" }, (response) => {
      if (response?.success) {
        statusValue.textContent = "Cancelled";
        statusValue.className = "status-value idle";
        progressFill.style.width = "0%";
        progressText.textContent = "";
      }
    });
  });

  // ─── Load Status ──────────────────────────────────────────────

  function loadStatus() {
    chrome.runtime.sendMessage({ type: "get_status" }, (response) => {
      if (!response) return;
      const { state, queueLength } = response;

      if (state) {
        statusValue.textContent = state.status.charAt(0).toUpperCase() + state.status.slice(1);
        statusValue.className = "status-value " + state.status;

        if (state.progress) {
          const pct = Math.round((state.progress.current / state.progress.total) * 100);
          progressFill.style.width = pct + "%";
          progressText.textContent = `${state.progress.current} / ${state.progress.total} — ${state.progress.contact || ""}`;
        } else if (queueLength > 0) {
          progressText.textContent = `${queueLength} campaign(s) in queue`;
        } else {
          progressFill.style.width = "0%";
          progressText.textContent = "";
        }
      }
    });
  }

  // ─── Load Logs ────────────────────────────────────────────────

  function loadLogs() {
    chrome.runtime.sendMessage({ type: "get_logs" }, (logs) => {
      if (!logs || logs.length === 0) {
        logList.innerHTML =
          '<div style="color: #94a3b8; text-align: center; padding: 20px">No logs yet</div>';
        return;
      }

      logList.innerHTML = logs
        .slice()
        .reverse()
        .slice(0, 50)
        .map(
          (log) => `
        <div class="log-item">
          <span class="log-dot ${log.type}"></span>
          <span class="log-contact">${log.contact}</span>
          <span>${log.detail}</span>
          <span class="log-time">${new Date(log.timestamp).toLocaleTimeString()}</span>
        </div>
      `
        )
        .join("");
    });
  }

  // ─── Load History ─────────────────────────────────────────────

  function loadHistory() {
    chrome.runtime.sendMessage({ type: "get_history" }, (history) => {
      if (!history || history.length === 0) {
        historyList.innerHTML =
          '<div style="color: #94a3b8; text-align: center; padding: 20px">No campaign history yet</div>';
        return;
      }

      historyList.innerHTML = history
        .slice()
        .reverse()
        .slice(0, 20)
        .map(
          (h) => `
        <div class="status-card" style="padding: 12px">
          <div style="font-weight: 700; font-size: 14px">${h.campaignName || "Campaign"}</div>
          <div style="font-size: 12px; color: #64748b; margin-top: 4px">
            ${h.successCount}/${h.totalContacts} sent
            ${h.failCount > 0 ? `<span style="color: #dc2626">(${h.failCount} failed)</span>` : ""}
            — ${new Date(h.completedAt).toLocaleString()}
          </div>
          ${h.failCount > 0
            ? `<details style="margin-top: 6px; font-size: 11px">
                <summary style="color: #dc2626; cursor: pointer">Show failures</summary>
                ${h.results
                  .filter((r) => !r?.success)
                  .map((r) => `<div style="padding: 2px 0">${r?.contact}: ${r?.error || "unknown"}</div>`)
                  .join("")}
              </details>`
            : ""}
        </div>
      `
        )
        .join("");
    });
  }

  // ─── Refresh Loop ─────────────────────────────────────────────

  function refresh() {
    loadStatus();
    const activeTab = document.querySelector(".tab.active");
    if (activeTab?.dataset.tab === "logs") loadLogs();
  }

  // Refresh every 2 seconds
  refresh();
  setInterval(refresh, 2000);
})();
