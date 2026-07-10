document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements
    const exePathInput = document.getElementById("exe-path-input");
    const appDirInput = document.getElementById("app-dir-input");
    const startAuditBtn = document.getElementById("start-audit-btn");

    const uploadSection = document.getElementById("upload-section");
    const scanRunningSection = document.getElementById("scan-running-section");
    const currentScanFile = document.getElementById("current-scan-file");
    const terminalLog = document.getElementById("terminal-log");

    const resultsSection = document.getElementById("results-section");
    const metaFilename = document.getElementById("meta-filename");
    const metaPlatform = document.getElementById("meta-platform");
    const metaPackageId = document.getElementById("meta-package-id");
    const metaFilesize = document.getElementById("meta-filesize");
    const metaTimestamp = document.getElementById("meta-timestamp");

    const statCritical = document.getElementById("stat-critical");
    const statHigh = document.getElementById("stat-high");
    const statMedium = document.getElementById("stat-medium");
    const statLow = document.getElementById("stat-low");
    const statInfo = document.getElementById("stat-info");

    const downloadPdfBtn = document.getElementById("download-pdf-btn");
    const downloadExcelBtn = document.getElementById("download-excel-btn");
    const reScanBtn = document.getElementById("re-scan-btn");
    const findingsList = document.getElementById("findings-list");
    const filterButtons = document.querySelectorAll(".filter-btn");

    // History Panel Elements
    const historyToggleBtn = document.getElementById("history-toggle-btn");
    const historyPanel = document.getElementById("history-panel");
    const historyOverlay = document.getElementById("history-overlay");
    const historyCloseBtn = document.getElementById("history-close-btn");
    const historyList = document.getElementById("history-list");

    let currentFile = null;
    let activeScanId = null;
    let scanResults = null;

    // --- History Panel ---
    function openHistoryPanel() {
        historyPanel.classList.add("open");
        historyOverlay.style.display = "block";
        loadScanHistory();
    }

    function closeHistoryPanel() {
        historyPanel.classList.remove("open");
        historyOverlay.style.display = "none";
    }

    historyToggleBtn.addEventListener("click", openHistoryPanel);
    historyCloseBtn.addEventListener("click", closeHistoryPanel);
    historyOverlay.addEventListener("click", closeHistoryPanel);

    function loadScanHistory() {
        historyList.innerHTML = '<p class="history-empty">Loading scans...</p>';
        fetch("/api/scans")
            .then(r => r.json())
            .then(scans => {
                if (!scans || scans.length === 0) {
                    historyList.innerHTML = '<p class="history-empty">No scans found yet.<br>Upload and analyze a file first.</p>';
                    return;
                }
                historyList.innerHTML = "";
                scans.forEach(scan => {
                    let icon = "📦";
                    if (scan.platform === "pe") {
                        icon = "🪟";
                    } else if (scan.platform === "electron") {
                        icon = "⚛️";
                    }
                    const badgeClass = scan.findings_count === 0 ? "zero" : "";
                    const item = document.createElement("div");
                    item.className = "history-item";
                    item.innerHTML = `
                        <div class="history-item-top">
                            <span class="history-platform-icon">${icon}</span>
                            <div class="history-item-info">
                                <div class="history-filename">${scan.filename}</div>
                                <div class="history-package">${scan.package_id}</div>
                            </div>
                        </div>
                        <div class="history-item-bottom">
                            <span class="history-timestamp">🕓 ${scan.timestamp}</span>
                            <span class="history-findings-badge ${badgeClass}">${scan.findings_count} findings</span>
                        </div>
                        <div class="history-item-actions">
                            <button class="btn-load-scan" data-id="${scan.scan_id}">📂 Load Scan Results</button>
                            <button class="btn-delete-scan" data-id="${scan.scan_id}" title="Delete this scan">🗑</button>
                        </div>
                    `;

                    // Load scan button
                    item.querySelector(".btn-load-scan").addEventListener("click", (e) => {
                        e.stopPropagation();
                        loadHistoryScan(scan.scan_id);
                    });

                    // Delete scan button
                    item.querySelector(".btn-delete-scan").addEventListener("click", (e) => {
                        e.stopPropagation();
                        if (confirm(`Delete scan for "${scan.filename}"? This cannot be undone.`)) {
                            deleteScan(scan.scan_id, item);
                        }
                    });

                    historyList.appendChild(item);
                });
            })
            .catch(() => {
                historyList.innerHTML = '<p class="history-empty">Failed to load scan history.</p>';
            });
    }

    function loadHistoryScan(scanId) {
        historyList.innerHTML = '<p class="history-empty">Loading scan results...</p>';
        fetch(`/api/results/${scanId}`)
            .then(r => r.json())
            .then(data => {
                closeHistoryPanel();
                // Hide other sections and show results
                uploadSection.style.display = "none";
                scanRunningSection.style.display = "none";
                resultsSection.style.display = "block";
                // Reconstruct the result shape renderScanResults expects
                renderScanResults({
                    scan_id: scanId,
                    info: data.info,
                    findings: data.findings,
                    logs: data.logs,
                    app_details: data.app_details
                });
            })
            .catch(() => {
                alert("Failed to load scan results. Please try again.");
                closeHistoryPanel();
            });
    }

    function deleteScan(scanId, itemEl) {
        fetch(`/api/scans/delete/${scanId}`, { method: "DELETE" })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    itemEl.style.opacity = "0";
                    itemEl.style.transform = "translateX(20px)";
                    itemEl.style.transition = "all 0.3s ease";
                    setTimeout(() => {
                        itemEl.remove();
                        if (historyList.children.length === 0) {
                            historyList.innerHTML = '<p class="history-empty">No scans found yet.</p>';
                        }
                    }, 300);
                } else {
                    alert("Failed to delete scan.");
                }
            })
            .catch(() => alert("Failed to delete scan."));
    }

    // --- Direct Path Auditor Operations ---

    startAuditBtn.addEventListener("click", () => {
        const exePath = exePathInput.value.trim();
        const appDir = appDirInput.value.trim();

        if (!exePath || !appDir) {
            alert("Both Executable Path and Application Directory are mandatory.");
            return;
        }

        // Hide upload panel, show terminal logging
        uploadSection.style.display = "none";
        scanRunningSection.style.display = "block";
        currentScanFile.textContent = `Auditing ${exePath}...`;
        terminalLog.innerHTML = "";

        // Log starting CLI actions
        appendTerminalLine("[INFO] thickssa-analyzer direct path auditor initialized.", "info");
        appendTerminalLine(`[INFO] Executable path target: ${exePath}`, "info");
        appendTerminalLine(`[INFO] Installation directory target: ${appDir}`, "info");

        fetch("/api/scan", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                exe_path: exePath,
                app_dir: appDir
            })
        })
        .then(async response => {
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Application audit failed.");
            }
            return data;
        })
        .then(result => {
            // Stream the returned terminal logs sequentially for high aesthetics
            streamTerminalLogs(result.logs, () => {
                // Once streaming finishes, display findings and statistics dashboard
                setTimeout(() => {
                    scanRunningSection.style.display = "none";
                    resultsSection.style.display = "block";
                    renderScanResults(result);
                }, 800);
            });
        })
        .catch(err => {
            appendTerminalLine(`[CRITICAL ERROR] ${err.message}`, "err");
            appendTerminalLine("[FAIL] Security audit aborted.", "err");
            
            // Re-enable dashboard reset button on failure
            const btn = document.createElement("button");
            btn.className = "btn btn-secondary";
            btn.style.marginTop = "1rem";
            btn.textContent = "Back to Input";
            btn.onclick = () => {
                scanRunningSection.style.display = "none";
                uploadSection.style.display = "block";
            };
            terminalLog.appendChild(btn);
        });
    });

    // --- Dynamic Logging Console Output ---
    function appendTerminalLine(text, type = "info") {
        const line = document.createElement("div");
        line.className = `terminal-line ${type}`;
        line.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
        terminalLog.appendChild(line);
        terminalLog.scrollTop = terminalLog.scrollHeight;
    }

    function streamTerminalLogs(logs, onComplete) {
        let idx = 0;
        
        function printNext() {
            if (idx < logs.length) {
                const logItem = logs[idx];
                let type = "info";
                if (logItem.includes("[WARN]")) type = "warn";
                if (logItem.includes("[ERROR]")) type = "err";
                if (logItem.includes("[SUCCESS]")) type = "success";
                
                appendTerminalLine(logItem, type);
                idx++;
                
                // Keep delay short but visual (e.g. 60ms) to feel active
                setTimeout(printNext, 60);
            } else {
                onComplete();
            }
        }
        
        printNext();
    }

    // --- Render Dashboard and Findings List ---
    function renderScanResults(result) {
        scanResults = result;
        activeScanId = result.scan_id;

        // Set Metadata Panel
        metaFilename.textContent = result.info.filename;
        metaPlatform.textContent = result.info.platform.toUpperCase();
        metaPlatform.className = `info-value badge ${result.info.platform}`;
        metaPackageId.textContent = result.info.package_id;
        metaFilesize.textContent = result.info.filesize;
        metaTimestamp.textContent = result.info.timestamp;

        // Reset Reports buttons mapping
        function triggerDownload(url, filename) {
            const a = document.createElement("a");
            a.href = url;
            a.setAttribute("download", filename);
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
        
        downloadPdfBtn.onclick = () => triggerDownload(`/api/report/pdf/${activeScanId}.pdf`, `ThickSSA_Report_${result.info.filename}.pdf`);
        downloadExcelBtn.onclick = () => triggerDownload(`/api/report/excel/${activeScanId}.xlsx`, `ThickSSA_Report_${result.info.filename}.xlsx`);

        // Set counts
        const findings = result.findings;
        const counts = { critical: 0, high: 0, medium: 0, low: 0, informational: 0 };
        findings.forEach(f => {
            let sev = f.severity.toLowerCase();
            if (sev === "info") { sev = "informational"; f.severity = "Informational"; }
            if (counts[sev] !== undefined) counts[sev]++;
        });

        statCritical.textContent = counts.critical;
        statHigh.textContent = counts.high;
        statMedium.textContent = counts.medium;
        statLow.textContent = counts.low;
        statInfo.textContent = counts.informational;

        // Populate App Intelligence
        const intelCard = document.getElementById("app-intelligence-card");
        const intelContent = document.getElementById("intelligence-content");
        if(result.info) {
            let intelHtml = "";
            const keysToSkip = ["filename", "platform", "package_id", "filesize", "timestamp"];
            
            // Build groups
            let basicInfo = "<h4>Basic Metadata</h4><ul style='list-style-type:none; padding-left:0;'>";
            basicInfo += `<li><b>MD5:</b> ${result.app_details.md5 || "N/A"}</li>`;
            basicInfo += `<li><b>SHA-1:</b> ${result.app_details.sha1 || "N/A"}</li>`;
            basicInfo += `<li><b>SHA-256:</b> ${result.app_details.sha256 || "N/A"}</li>`;
            if(result.app_details.app_name) basicInfo += `<li><b>App Name:</b> ${result.app_details.app_name}</li>`;
            if(result.app_details.version_name && result.app_details.version_name !== "N/A") basicInfo += `<li><b>Version:</b> ${result.app_details.version_name}</li>`;
            if(result.app_details.framework) basicInfo += `<li><b>Framework:</b> ${result.app_details.framework}</li>`;
            basicInfo += "</ul>";
            
            let componentInfo = "";
            
            let listInfo = "";
            if (result.app_details.third_party_sdks && result.app_details.third_party_sdks.length > 0) {
                listInfo += `<h4>Third-Party SDKs (${result.app_details.third_party_sdks.length})</h4><p style="font-size:0.9em; word-wrap: break-word;">${result.app_details.third_party_sdks.join(", ")}</p>`;
            }
            if (result.app_details.urls && result.app_details.urls.length > 0) {
                listInfo += `<h4>Extracted URLs (${result.app_details.urls.length})</h4><div style="max-height: 100px; overflow-y: auto; font-size: 0.85em; background: rgba(0,0,0,0.2); padding: 5px; border-radius: 4px;">`;
                result.app_details.urls.forEach(u => listInfo += `<div>${escapeHTML(u)}</div>`);
                listInfo += "</div>";
            }
            if (result.app_details.emails && result.app_details.emails.length > 0) {
                listInfo += `<h4>Extracted Emails (${result.app_details.emails.length})</h4><p style="font-size:0.9em;">${result.app_details.emails.join(", ")}</p>`;
            }
            
            let certInfo = "";
            if (result.app_details.certificates && result.app_details.certificates.length > 0) {
                certInfo += `<h4>Certificates (${result.app_details.certificates.length})</h4>`;
                result.app_details.certificates.forEach(c => {
                    certInfo += `<div style="font-size: 0.85em; margin-bottom: 8px; background: rgba(0,0,0,0.2); padding: 5px; border-radius: 4px;">`;
                    certInfo += `<b>Subject:</b> ${escapeHTML(c.subject)}<br/>`;
                    certInfo += `<b>Issuer:</b> ${escapeHTML(c.issuer)}<br/>`;
                    certInfo += `<b>Valid:</b> ${c.valid_from} to ${c.valid_to}<br/>`;
                    certInfo += `<b>SHA-256:</b> ${c.sha256}</div>`;
                });
            }
            
            let soInfo = "";
            if (result.app_details.shared_libraries && result.app_details.shared_libraries.length > 0) {
                soInfo += `<h4>Shared Libraries (${result.app_details.shared_libraries.length})</h4><div style="max-height: 150px; overflow-y: auto;">`;
                result.app_details.shared_libraries.forEach(s => {
                    soInfo += `<div style="font-size: 0.85em; margin-bottom: 8px; background: rgba(0,0,0,0.2); padding: 5px; border-radius: 4px;">`;
                    soInfo += `<b>File:</b> ${escapeHTML(s.name)}<br/>`;
                    soInfo += `<b>NX:</b> ${s.nx} | <b>PIE:</b> ${s.pie} | <b>Canary:</b> ${s.stack_canary} | <b>RELRO:</b> ${s.relro} | <b>Stripped:</b> ${s.stripped}</div>`;
                });
                soInfo += "</div>";
            }
            
            let summaryHtml = "";
            if (result.app_details && result.app_details.app_summary) {
                summaryHtml = `
                    <div class="app-summary-box" style="background: rgba(59, 130, 246, 0.1); border-left: 4px solid #3b82f6; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
                        <h4 style="margin-top: 0; color: #3b82f6; display: flex; align-items: center; gap: 8px;">
                            📋 Business Logic & Application Summary
                        </h4>
                        <p style="font-size: 0.95em; line-height: 1.6; margin-bottom: 0; white-space: pre-wrap; color: #e2e8f0;">
                            ${result.app_details.app_summary}
                        </p>
                    </div>
                `;
            }

            intelHtml = summaryHtml + `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div>${basicInfo}${componentInfo}</div>
                <div>${listInfo}</div>
                <div style="grid-column: 1 / -1;">${certInfo}${soInfo}</div>
            </div>`;
            
            intelContent.innerHTML = intelHtml;
            intelCard.style.display = "block";
        }

        // Load Accordions
        renderFindingsGrid(findings);
    }

    function renderFindingsGrid(findings) {
        findingsList.innerHTML = "";
        
        if (findings.length === 0) {
            findingsList.innerHTML = `<div class="card" style="text-align:center;">No vulnerabilities identified. Good job!</div>`;
            return;
        }

        findings.forEach(f => {
            const item = document.createElement("div");
            item.className = `finding-item ${f.severity.toLowerCase()}`;
            item.setAttribute("data-severity", f.severity.toLowerCase());

            const hasCode = f.code_snippet && f.code_snippet !== "File Not Found";

            item.innerHTML = `
                <div class="finding-trigger">
                    <div class="finding-trigger-left">
                        <span class="finding-id">${f.id}</span>
                        <span class="finding-title">${f.name}</span>
                    </div>
                    <div class="finding-trigger-right">
                        <span class="sev-badge ${f.severity.toLowerCase()}">${f.severity}</span>
                        <span class="arrow-icon">▼</span>
                    </div>
                </div>
                <div class="finding-content">
                    <div class="finding-details-grid">
                        <div class="detail-block">
                            <h4>Checklist Category</h4>
                            <p>${f.category}</p>
                        </div>
                        <div class="detail-block">
                            <h4>Target File path</h4>
                            <p>${f.file}</p>
                        </div>
                        <div class="detail-block full-width-block">
                            <h4>Description</h4>
                            <p>${f.description}</p>
                        </div>
                        <div class="detail-block full-width-block">
                            <h4>Technical Impact</h4>
                            <p>${f.impact}</p>
                        </div>
                        <div class="detail-block full-width-block">
                            <h4>Remediation Recommendation</h4>
                            <p>${f.recommendation}</p>
                        </div>
                        ${hasCode ? `
                        <div class="detail-block full-width-block">
                            <h4>Code Evidence Reference</h4>
                            <pre class="evidence-code-block">${escapeHTML(f.code_snippet)}</pre>
                        </div>
                        ` : ''}
                    </div>
                    <div class="action-row">
                        <button class="btn btn-screenshot download-ss-btn" data-id="${f.id}">
                            📸 Download Evidence Screenshot
                        </button>
                    </div>
                </div>
            `;

            // Toggle Expand/Collapse details
            item.querySelector(".finding-trigger").addEventListener("click", () => {
                item.classList.toggle("open");
            });

            // Evidence screenshot button trigger
            item.querySelector(".download-ss-btn").addEventListener("click", (e) => {
                e.stopPropagation();
                generateEvidenceScreenshot(f);
            });

            findingsList.appendChild(item);
        });
    }

    // Filter Trigger Controls
    filterButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            filterButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            
            const sev = btn.getAttribute("data-severity");
            const items = findingsList.querySelectorAll(".finding-item");
            
            items.forEach(item => {
                if (sev === "all" || item.getAttribute("data-severity") === sev) {
                    item.style.display = "block";
                } else {
                    item.style.display = "none";
                }
            });
        });
    });

    reScanBtn.addEventListener("click", () => {
        resultsSection.style.display = "none";
        uploadSection.style.display = "block";
        exePathInput.value = "";
        appDirInput.value = "";
    });

    // Helper: Escape tags inside strings
    function escapeHTML(str) {
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    // --- HTML5 Canvas Screenshot Generator Engine (Premium Mock Terminal OS View) ---
    function generateEvidenceScreenshot(finding) {
        const canvas = document.getElementById("screenshot-canvas");
        const ctx = canvas.getContext("2d");

        // Set dimensions (1020 x 660 px)
        canvas.width = 1020;
        canvas.height = 660;

        // Colors
        const colorDarkBg = "#060913";
        const colorCardBg = "#0b101f";
        const colorTitleBar = "#0e1424";
        const colorBorder = "#1e293b";
        const colorTextPrimary = "#f8fafc";
        const colorTextSecondary = "#94a3b8";
        
        // Severity should NOT be highlighted in screenshots downloaded from the tool
        const sevColor = "#38bdf8"; // Neutral security theme color (cyan)

        // 1. Draw outer full desktop wallpaper canvas background
        const bgGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        bgGradient.addColorStop(0, "#0f172a");
        bgGradient.addColorStop(1, "#020617");
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Subtle glowing background circle inside wallpaper
        const radialGlow = ctx.createRadialGradient(510, 330, 50, 510, 330, 450);
        radialGlow.addColorStop(0, "rgba(99, 102, 241, 0.1)");
        radialGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = radialGlow;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 2. Draw mock window (Terminal/IDE shell) container with shadow
        const winX = 60, winY = 60, winW = 900, winH = 540, winRadius = 10;
        ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
        ctx.shadowBlur = 30;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 15;

        // Rounded path for window
        ctx.beginPath();
        ctx.moveTo(winX + winRadius, winY);
        ctx.lineTo(winX + winW - winRadius, winY);
        ctx.arcTo(winX + winW, winY, winX + winW, winY + winH, winRadius);
        ctx.lineTo(winX + winW, winY + winH - winRadius);
        ctx.arcTo(winX + winW, winY + winH, winX, winY + winH, winRadius);
        ctx.lineTo(winX + winRadius, winY + winH);
        ctx.arcTo(winX, winY + winH, winX, winY, winRadius);
        ctx.lineTo(winX, winY + winRadius);
        ctx.arcTo(winX, winY, winX + winW, winY, winRadius);
        ctx.closePath();
        
        ctx.fillStyle = colorDarkBg;
        ctx.fill();
        ctx.shadowColor = "transparent"; // Reset shadow for internal drawings

        // 3. Draw OS Window Header Bar
        ctx.fillStyle = colorTitleBar;
        ctx.beginPath();
        ctx.moveTo(winX, winY + 40);
        ctx.lineTo(winX, winY + winRadius);
        ctx.arcTo(winX, winY, winX + winW, winY, winRadius);
        ctx.lineTo(winX + winW, winY + winRadius);
        ctx.arcTo(winX + winW, winY, winX + winW, winY + 40, winRadius);
        ctx.lineTo(winX + winW, winY + 40);
        ctx.closePath();
        ctx.fill();

        // Border separating title bar
        ctx.strokeStyle = colorBorder;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(winX, winY + 40);
        ctx.lineTo(winX + winW, winY + 40);
        ctx.stroke();

        // 4. Draw Window Circles (macOS Style: Close, Minimize, Zoom)
        const btnY = winY + 20;
        ctx.fillStyle = "#ff5f56"; // Red
        ctx.beginPath(); ctx.arc(winX + 20, btnY, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#ffbd2e"; // Yellow
        ctx.beginPath(); ctx.arc(winX + 38, btnY, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#27c93f"; // Green
        ctx.beginPath(); ctx.arc(winX + 56, btnY, 6, 0, Math.PI * 2); ctx.fill();

        // Title text in header
        ctx.fillStyle = colorTextSecondary;
        ctx.font = "bold 11px 'Fira Code', monospace";
        ctx.textAlign = "center";
        ctx.fillText(`thickssa-console --evidence --rule=${finding.id}`, winX + winW / 2, winY + 24);

        // 5. Draw Terminal Content Area
        const textX = winX + 30;
        let textY = winY + 70;
        ctx.textAlign = "left";

        // Terminal prompt header
        ctx.fillStyle = "#38bdf8"; // cyan
        ctx.font = "bold 13px 'Fira Code', monospace";
        ctx.fillText(`[SYSTEM-AUDIT] Timestamp: ${scanResults.info.timestamp} | Shell: Bash`, textX, textY);
        
        textY += 30;
        // Mock command executed
        ctx.fillStyle = colorTextSecondary;
        ctx.fillText("$ ", textX, textY);
        ctx.fillStyle = "#a5b4fc";
        ctx.fillText(`thickssa --static-analysis -f ${scanResults.info.filename} --scan-rule=${finding.id}`, textX + 15, textY);

        textY += 30;
        // Target file line
        ctx.fillStyle = "#64748b";
        ctx.fillText("[*] Target File inspected: ", textX, textY);
        ctx.fillStyle = colorTextPrimary;
        // Measure offset dynamically to print adjacent
        let offset = ctx.measureText("[*] Target File inspected: ").width;
        ctx.fillText(finding.file, textX + offset, textY);

        textY += 30;
        // Severity Banner Alert Box (without showing severity level/color)
        ctx.fillStyle = colorCardBg;
        ctx.strokeStyle = sevColor;
        ctx.lineWidth = 1;
        ctx.fillRect(textX, textY - 15, winW - 60, 45);
        ctx.strokeRect(textX, textY - 15, winW - 60, 45);

        ctx.fillStyle = sevColor;
        ctx.font = "bold 13px 'Fira Code', monospace";
        ctx.fillText(`[!] SECURITY DETAIL IDENTIFIED:`, textX + 15, textY + 12);
        
        ctx.fillStyle = colorTextPrimary;
        let alertOffset = ctx.measureText(`[!] SECURITY DETAIL IDENTIFIED:  `).width;
        ctx.font = "13px 'Fira Code', monospace";
        ctx.fillText(finding.name, textX + 15 + alertOffset, textY + 12);

        textY += 60;
        
        // Output Block
        ctx.fillStyle = "#1e293b";
        ctx.font = "bold 11px 'Fira Code', monospace";
        ctx.fillText("--- EVIDENCE & CODE ANALYSIS OUTPUT ---", textX, textY);

        textY += 25;
        // 6. Draw Code / Evidence Box with syntax background
        const codeBoxY = textY - 15;
        const codeBoxH = 200;
        ctx.fillStyle = "#02040a";
        ctx.strokeStyle = colorBorder;
        ctx.lineWidth = 1;
        ctx.fillRect(textX, codeBoxY, winW - 60, codeBoxH);
        ctx.strokeRect(textX, codeBoxY, winW - 60, codeBoxH);

        // Code Content
        ctx.fillStyle = "#f8fafc";
        ctx.font = "12px 'Fira Code', monospace";
        
        const codeSnippet = finding.code_snippet || "No Code Snippet available";
        const codeLines = codeSnippet.split('\n');

        let codeY = codeBoxY + 30;
        codeLines.forEach((line) => {
            if (codeY < codeBoxY + codeBoxH - 15) {
                // Truncate long code lines
                let cleanLine = line.length > 80 ? line.substring(0, 80) + "..." : line;
                ctx.fillStyle = "#334155"; // line numbers/indents gray
                ctx.fillText("> ", textX + 15, codeY);
                
                ctx.fillStyle = "#cbd5e1"; // code white
                ctx.fillText(cleanLine, textX + 35, codeY);

                // If line contains finding.highlight_text (the vulnerability keywords likeallowBackup="true" or keys),
                // we draw a transparent highlighted red box overlaying this text
                if (finding.highlight_text && line.includes(finding.highlight_text)) {
                    // Let's compute approx placement
                    const textBefore = line.split(finding.highlight_text)[0];
                    const offsetBefore = ctx.measureText(textBefore).width;
                    const keywordWidth = ctx.measureText(finding.highlight_text).width;

                    ctx.fillStyle = "rgba(239, 68, 68, 0.25)"; // Translucent Red Highlight
                    ctx.strokeStyle = "rgba(239, 68, 68, 0.8)";
                    ctx.lineWidth = 1;
                    
                    const highlightX = textX + 35 + offsetBefore - 4;
                    const highlightY = codeY - 13;
                    const highlightW = keywordWidth + 8;
                    const highlightH = 18;
                    
                    ctx.fillRect(highlightX, highlightY, highlightW, highlightH);
                    ctx.strokeRect(highlightX, highlightY, highlightW, highlightH);
                    
                    // Draw red callout tag
                    ctx.fillStyle = "#ef4444";
                    ctx.beginPath();
                    ctx.moveTo(highlightX + highlightW / 2, highlightY + highlightH);
                    ctx.lineTo(highlightX + highlightW / 2 - 5, highlightY + highlightH + 8);
                    ctx.lineTo(highlightX + highlightW / 2 + 5, highlightY + highlightH + 8);
                    ctx.closePath();
                    ctx.fill();

                    // Text alert overlay tag
                    ctx.fillRect(highlightX + highlightW / 2 - 45, highlightY + highlightH + 8, 90, 16);
                    ctx.fillStyle = "#ffffff";
                    ctx.font = "bold 9px 'Fira Code', monospace";
                    ctx.textAlign = "center";
                    ctx.fillText("VULNERABLE LINE", highlightX + highlightW / 2, highlightY + highlightH + 19);

                    // Restore alignments
                    ctx.textAlign = "left";
                    ctx.font = "12px 'Fira Code', monospace";
                }

                codeY += 22;
            }
        });

        // 7. Footer Brand/Verification stamp
        ctx.fillStyle = "#475569";
        ctx.font = "bold 10px 'Outfit', sans-serif";
        ctx.fillText("THICKSSA - THICK CLIENT STATIC SECURITY ANALYZER V1.0.0", textX, winY + winH - 20);

        ctx.textAlign = "right";
        ctx.fillStyle = "#0284c7"; // blue-600
        ctx.fillText("SECURITY ASSESSMENT CERTIFICATE VERIFIED", winX + winW - 30, winY + winH - 20);

        // 8. Trigger download
        try {
            const dataURL = canvas.toDataURL("image/png");
            const downloadLink = document.createElement("a");
            downloadLink.href = dataURL;
            const safeId = finding.id.replace(/[^a-zA-Z0-9_]/g, '');
            downloadLink.setAttribute("download", `evidence_${safeId}.png`);
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
        } catch (e) {
            // Fallback to toBlob if toDataURL fails (e.g. tainted canvas, though not expected here)
            canvas.toBlob((blob) => {
                const downloadLink = document.createElement("a");
                downloadLink.href = URL.createObjectURL(blob);
                const safeId = finding.id.replace(/[^a-zA-Z0-9_]/g, '');
                downloadLink.setAttribute("download", `evidence_${safeId}.png`);
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
                URL.revokeObjectURL(downloadLink.href);
            }, "image/png");
        }
    }

    // --- Author Integrity Lock & Anti-Tamper Engine ---
    (function() {
        const expectedName = atob("UmFqIERvc2hpIChyYWpkb3NoaTAxKQ=="); // "Raj Doshi (rajdoshi01)"
        const footerId = "app-footer";
        const authorId = "author-credit";
        
        function enforceIntegrity() {
            let footer = document.getElementById(footerId);
            let author = document.getElementById(authorId);
            
            // If footer or author element was deleted, recreate the footer
            if (!footer || !author) {
                if (footer) footer.remove();
                
                const newFooter = document.createElement("footer");
                newFooter.id = footerId;
                newFooter.innerHTML = `<p id="app-footer-text">ThickSSA v1.0.0 &copy; 2026. Made with ❤️ by <b id="author-credit">${expectedName}</b> for thick client security penetration testing.</p>`;
                document.body.appendChild(newFooter);
                
                // Re-bind observer
                bindObserver();
                return;
            }
            
            // If text was modified, revert it
            if (author.textContent !== expectedName) {
                author.textContent = expectedName;
            }
            
            // Ensure visibility is not manipulated (display: none, visibility: hidden, opacity: 0)
            const style = window.getComputedStyle(footer);
            if (style.display === "none" || style.visibility === "hidden" || parseFloat(style.opacity) < 0.1 || footer.hidden) {
                footer.style.setProperty("display", "block", "important");
                footer.style.setProperty("visibility", "visible", "important");
                footer.style.setProperty("opacity", "1", "important");
                footer.hidden = false;
            }
        }
        
        let observer = null;
        function bindObserver() {
            if (observer) {
                observer.disconnect();
            }
            const footer = document.getElementById(footerId);
            if (!footer) return;
            
            observer = new MutationObserver((mutations) => {
                // Temporarily disconnect to avoid infinite loop when correcting text
                observer.disconnect();
                enforceIntegrity();
                observer.observe(footer, { childList: true, subtree: true, characterData: true, attributes: true });
            });
            observer.observe(footer, { childList: true, subtree: true, characterData: true, attributes: true });
        }
        
        // Initial enforcement & observer binding
        enforceIntegrity();
        bindObserver();
        
        // Interval backup check every 250ms (in case observer is disconnected/bypassed)
        setInterval(enforceIntegrity, 250);
    })();
});
