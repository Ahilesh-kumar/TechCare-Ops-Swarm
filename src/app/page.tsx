"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Flame,
  Server,
  Cpu,
  Play,
  CheckCircle2,
  Download,
  Copy,
  Activity,
  Settings,
  ShieldAlert,
  Terminal,
  Radio,
  FileText,
  UserCheck,
  Zap,
  Droplets,
  Wrench,
  Database,
  History,
  FileCode,
  Plus,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Shield,
  Search,
  Brain,
  Loader2,
  Sun,
  Moon,
  LayoutGrid,
} from "lucide-react";

interface SafeGuardLog {
  agent: string;
  text: string;
}

interface SafeGuardReportSections {
  safety: string;
  execution: string;
  detective: string;
  knowledge: string;
}

const parseSafeGuardReport = (reportText: string): SafeGuardReportSections => {
  const sections: SafeGuardReportSections = {
    safety: "",
    execution: "",
    detective: "",
    knowledge: ""
  };

  if (!reportText) return sections;

  // Split sections by ---
  const parts = reportText.split(/\n\s*---\s*\n/);
  
  parts.forEach((part) => {
    const trimmed = part.trim();
    if (!trimmed) return;

    // Get first meaningful line (strip leading # chars for header matching)
    const rawFirstLine = trimmed.split("\n")[0];
    const firstLine = rawFirstLine.toLowerCase().replace(/^#+\s*/, "").trim();

    if (
      firstLine.includes("incident summary") ||
      firstLine.includes("mitigation report") ||
      firstLine.includes("executive summary") ||
      firstLine.includes("final report") ||
      firstLine.includes("final incident summary") ||
      firstLine.includes("safety report") ||
      firstLine.includes("safeguard report")
    ) {
      sections.safety = trimmed;
    } else if (
      firstLine.includes("execution log") ||
      firstLine.includes("containment status") ||
      firstLine.includes("actuator_execution_log") ||
      firstLine.includes("actuator execution") ||
      firstLine.includes("containment log") ||
      firstLine.includes("actuator log")
    ) {
      let content = trimmed;
      // Strip markdown header if present
      if (content.startsWith("#") || content.startsWith("##")) {
        content = content.split("\n").slice(1).join("\n").trim();
      }
      if (content.startsWith("```")) {
        content = content.replace(/^```[a-z]*\n/i, "");
      }
      if (content.endsWith("```")) {
        content = content.slice(0, -3).trim();
      }
      sections.execution = content;
    } else if (
      firstLine.includes("root cause") ||
      firstLine.includes("forensic report") ||
      firstLine.includes("forensic analysis") ||
      firstLine.includes("detective report") ||
      firstLine.includes("rca") ||
      firstLine.includes("forensic") ||
      firstLine.includes("incident timeline") ||
      firstLine.includes("incident analysis")
    ) {
      let content = trimmed;
      // Strip markdown header if present
      if (content.startsWith("#") || content.startsWith("##")) {
        content = content.split("\n").slice(1).join("\n").trim();
      }
      sections.detective = content;
    } else if (
      firstLine.includes("knowledge curator") ||
      firstLine.includes("learning outcome") ||
      firstLine.includes("self-learning") ||
      firstLine.includes("updated specification") ||
      firstLine.includes("knowledge curator self-learning update") ||
      firstLine.includes("knowledge update") ||
      firstLine.includes("curator report")
    ) {
      let content = trimmed;
      // Strip markdown header if present
      if (content.startsWith("#") || content.startsWith("##")) {
        content = content.split("\n").slice(1).join("\n").trim();
      }
      sections.knowledge = content;
    } else {
      // Fallback matching logic based on headers in body
      if (
        trimmed.includes("INCIDENT TIMELINE") ||
        trimmed.includes("ROOT CAUSE ANALYSIS") ||
        trimmed.includes("FORENSIC SIGN-OFF") ||
        trimmed.includes("FORENSIC ANALYSIS") ||
        (trimmed.includes("Detective") && trimmed.includes("forensic"))
      ) {
        sections.detective = trimmed;
      } else if (trimmed.includes("ACTUATOR_EXECUTION_LOG") || trimmed.includes("TELEMETRY_STATUS") || trimmed.includes("Containment Actions")) {
        sections.execution = trimmed;
      } else if (trimmed.includes("LEARNING OUTCOME") || trimmed.includes("Updated Specification") || trimmed.includes("Knowledge Curator")) {
        sections.knowledge = trimmed;
      } else if (!sections.safety) {
        sections.safety = trimmed;
      }
    }
  });

  return sections;
};
interface ParsedBlueprint {
  target: string;
  threshold: string;
  actions: string[];
  hasLoto: boolean;
  hasPpe: boolean;
}

const parseBlueprintSpec = (specText: string): ParsedBlueprint => {
  if (!specText) return { target: "Unknown", threshold: "Not specified", actions: [], hasLoto: false, hasPpe: false };
  const lines = specText.split("\n");
  let target = "Unknown";
  let threshold = "Not specified";
  const actions: string[] = [];
  let hasLoto = false;
  let hasPpe = false;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    const lowerLine = trimmedLine.toLowerCase();
    
    if (lowerLine.startsWith("target:") || lowerLine.startsWith("target equipment:")) {
      target = trimmedLine.substring(trimmedLine.indexOf(":") + 1).trim();
    } else if (lowerLine.startsWith("critical threshold:") || lowerLine.startsWith("threshold:") || lowerLine.startsWith("critical:")) {
      threshold = trimmedLine.substring(trimmedLine.indexOf(":") + 1).trim();
    } else if (lowerLine.startsWith("action") || lowerLine.startsWith("step") || lowerLine.startsWith("protocol:")) {
      const match = trimmedLine.match(/(?:action|step|protocol)\s*\d*:\s*(.*)/i);
      if (match && match[1]) {
        actions.push(match[1].trim());
      } else {
        const colonIdx = trimmedLine.indexOf(":");
        if (colonIdx !== -1) {
          actions.push(trimmedLine.substring(colonIdx + 1).trim());
        } else {
          actions.push(trimmedLine);
        }
      }
    } else if (trimmedLine.startsWith("- ") || trimmedLine.startsWith("* ") || /^\d+\.\s+/.test(trimmedLine)) {
      const cleaned = trimmedLine.replace(/^[-*\d.]+\s+/, "").trim();
      if (cleaned) {
        actions.push(cleaned);
      }
    }
    
    if (lowerLine.includes("loto") || lowerLine.includes("lockout") || lowerLine.includes("tagout") || lowerLine.includes("isolate")) {
      hasLoto = true;
    }
    if (lowerLine.includes("ppe") || lowerLine.includes("gloves") || lowerLine.includes("glasses") || lowerLine.includes("shield") || lowerLine.includes("boots") || lowerLine.includes("suit")) {
      hasPpe = true;
    }
  }

  const uniqueActions = Array.from(new Set(actions)).filter(act => act.length > 5);

  return { target, threshold, actions: uniqueActions, hasLoto, hasPpe };
};

interface PromptValidationResult {
  passed: boolean;
  warnings: string[];
}

const validatePromptIntegrity = (agentKey: string, text: string): PromptValidationResult => {
  const warnings: string[] = [];
  if (!text) return { passed: true, warnings: [] };
  const lowerText = text.toLowerCase();

  switch (agentKey) {
    case "coordinator":
      if (!text.includes("INCIDENT_ALERT:")) {
        warnings.push("Missing exact output prefix 'INCIDENT_ALERT:'.");
      }
      if (!lowerText.includes("json")) {
        warnings.push("Prompt should instruct coordinator to output JSON payload.");
      }
      break;
    case "analyst":
      if (!text.includes("TECHNICAL_RESOLUTION:")) {
        warnings.push("Missing exact output prefix 'TECHNICAL_RESOLUTION:'.");
      }
      if (!text.includes("<diagnostics>") || !text.includes("<containment_plan>")) {
        warnings.push("Missing required tags '<diagnostics>' or '<containment_plan>'.");
      }
      break;
    case "auditor":
      if (!text.includes("SAFETY_AUDIT_REJECT")) {
        warnings.push("Prompt does not mention 'SAFETY_AUDIT_REJECT' command for unsafe audits.");
      }
      if (!text.includes("INCIDENT_REPORT")) {
        warnings.push("Prompt does not mention 'INCIDENT_REPORT' prefix for finalized audits.");
      }
      break;
    case "execution":
      if (!text.includes("EXECUTION_STATUS:")) {
        warnings.push("Missing exact output prefix 'EXECUTION_STATUS:'.");
      }
      if (!text.includes("[ACTUATOR_EXECUTION_LOG]")) {
        warnings.push("Missing expected prefix '[ACTUATOR_EXECUTION_LOG]' for execution logs.");
      }
      break;
    case "forensic":
      if (!text.includes("FORENSIC_REPORT:")) {
        warnings.push("Missing exact output prefix 'FORENSIC_REPORT:'.");
      }
      if (!lowerText.includes("root cause")) {
        warnings.push("Forensic instructions must specify Root Cause Analysis.");
      }
      break;
    case "curator":
      if (!text.includes("KNOWLEDGE_UPDATE:")) {
        warnings.push("Missing exact output prefix 'KNOWLEDGE_UPDATE:'.");
      }
      break;
  }

  return {
    passed: warnings.length === 0,
    warnings
  };
};

export default function Home() {
  const [showBootScreen, setShowBootScreen] = useState(true);
  const [bootLogs, setBootLogs] = useState<string[]>([]);
  const [bootProgress, setBootProgress] = useState(0);
  const [activeTab, setActiveTab] = useState("control");
  const [mounted, setMounted] = useState(false);
  
  // Settings & Theme states — lazy initializer reads dark_mode from localStorage on first client mount
  const [settings, setSettings] = useState<any>(() => {
    const dm = typeof window !== "undefined" && localStorage.getItem("tc_dark_mode") === "true";
    return {
      company_name: "TechCare SafeGuard",
      facility_name: "Containment Facility Sector 4",
      safety_officer_email: "safety@techcare.internal",
      dark_mode: dm,
      strict_airgap: false,
      enable_hitl: true,
    enable_deterministic_fallback: true,
    fallback_timeout: 90,
    models: {
      coordinator: "llama-3.1-8b-instant",
      analyst: "llama-3.1-8b-instant",
      auditor: "llama-3.1-8b-instant",
      execution: "llama-3.1-8b-instant",
      forensic: "llama-3.1-8b-instant",
      curator: "llama-3.1-8b-instant",
    },
    temperatures: {
      coordinator: 0.0,
      analyst: 0.0,
      auditor: 0.0,
      execution: 0.0,
      forensic: 0.0,
      curator: 0.2,
    },
    max_tokens: {
      coordinator: 80,
      analyst: 450,
      auditor: 450,
      execution: 450,
      forensic: 450,
      curator: 450,
    },
    cost_tracker: {
      total_tokens: 0,
      total_cost: 0.0,
    }
    }
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [hitlData, setHitlData] = useState<any>(null);
  
  // OPC-UA / MQTT Simulation registers
  const [telemetryTags, setTelemetryTags] = useState<any>({
    "ns=2;s=Device.SectorA.Vat4.Pressure": 85.0,
    "ns=2;s=Device.SectorB.BoilerB50.Temperature": 65.0,
    "ns=2;s=Device.SectorC.PneumaticPress7.Vibration": 2.4,
    "ns=2;s=Device.SectorD.RoboticArm9.Current": 18.0,
  });
  const [promptBackups, setPromptBackups] = useState<any[]>([]);
  const [selectedBackup, setSelectedBackup] = useState("");

  const handleHitlAction = async (approved: boolean) => {
    if (!hitlData) return;
    try {
      const resp = await fetch(approved ? "/api/hitl/approve" : "/api/hitl/decline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incident_id: hitlData.incidentId }),
      });
      if (!resp.ok) {
        console.error("Failed to send HITL action response");
      }
    } catch (e) {
      console.error("Error sending HITL action", e);
    } finally {
      setHitlData(null);
    }
  };

  const saveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const resp = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (resp.ok) {
        alert("Global System settings saved successfully.");
        fetchAllData();
      } else {
        alert("Failed to save settings.");
      }
    } catch (err) {
      alert("Error saving settings.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const toggleDarkMode = async (checked: boolean) => {
    const updatedSettings = { ...settings, dark_mode: checked };
    setSettings(updatedSettings);
    localStorage.setItem("tc_dark_mode", String(checked));
    if (checked) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedSettings),
      });
    } catch (err) {
      console.error("Failed to save dark mode setting:", err);
    }
  };

  const validateHeaders = () => {
    const combined = `# SafeGuard Agent Definitions & Rules\n\n` +
      `## 1. Coordinator Agent\n${prompts.coordinator}\n\n` +
      `## 2. Systems Analyst Agent\n${prompts.analyst}\n\n` +
      `## 3. Safety Auditor Agent\n${prompts.auditor}\n\n` +
      `## 4. Execution Agent\n${prompts.execution}\n\n` +
      `## 5. Forensic Investigator Agent\n${prompts.forensic}\n\n` +
      `## 6. Knowledge Curator Agent\n${prompts.curator}\n`;
    
    const required = [
      "## 1. Coordinator Agent",
      "## 2. Systems Analyst Agent",
      "## 3. Safety Auditor Agent",
      "## 4. Execution Agent",
      "## 5. Forensic Investigator Agent",
      "## 6. Knowledge Curator Agent"
    ];
    const missing = required.filter(h => !combined.includes(h));
    return {
      valid: missing.length === 0,
      missing
    };
  };

  const rollbackPrompts = async () => {
    if (!selectedBackup) return;
    try {
      const resp = await fetch("/api/prompts/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: selectedBackup }),
      });
      if (resp.ok) {
        alert("Agent prompts successfully rolled back to history version.");
        fetchAllData();
      } else {
        const errorData = await resp.json();
        alert(`Failed to rollback: ${errorData.detail || "Unknown error"}`);
      }
    } catch (err) {
      alert("Error during rollback.");
    }
  };
  const [reportFontSize, setReportFontSize] = useState<"sm" | "base" | "lg">("base");
  const [activeReportSubTab, setActiveReportSubTab] = useState<"combined" | "safety" | "execution" | "forensic" | "knowledge">("combined");
  const [activeHistoryReportSubTab, setActiveHistoryReportSubTab] = useState<"safety" | "execution" | "detective" | "knowledge">("safety");
  const [alertInput, setAlertInput] = useState("");
  const [safeGuardLogs, setSafeGuardLogs] = useState<SafeGuardLog[]>([]);
  const [finalReport, setFinalReport] = useState("");
  const [safetyReport, setSafetyReport] = useState("");
  const [executionReport, setExecutionReport] = useState("");
  const [detectiveReport, setDetectiveReport] = useState("");
  const [knowledgeReport, setKnowledgeReport] = useState("");
  const [activeEquipment, setActiveEquipment] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [resultsView, setResultsView] = useState<"console" | "report">("console");
  const [leftCardView, setLeftCardView] = useState<"graph" | "map">("graph");
  const [lastSecuredEquipment, setLastSecuredEquipment] = useState("");
  
  // Calibration panel configurations
  const [autoTrigger, setAutoTrigger] = useState(true);
  const [stepDelay, setStepDelay] = useState(0.5);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Dynamic sandbox states
  const [blueprints, setBlueprints] = useState<Record<string, string>>({});
  const [selectedBlueprint, setSelectedBlueprint] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("");
  const [blueprintSpec, setBlueprintSpec] = useState("");
  const [showAddBlueprint, setShowAddBlueprint] = useState(false);
  const [newBlueprintName, setNewBlueprintName] = useState("");
  const [newBlueprintSpec, setNewBlueprintSpec] = useState("");

  const [prompts, setPrompts] = useState({
    coordinator: "",
    analyst: "",
    auditor: "",
    execution: "",
    forensic: "",
    curator: "",
  });
  const [isSavingPrompts, setIsSavingPrompts] = useState(false);

  const [history, setHistory] = useState<any[]>([]);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<any | null>(null);

  const [metrics, setMetrics] = useState({
    total_runs: 0,
    success_rate: 0,
    avg_latency: 0,
    alarms_by_equipment: {} as Record<string, number>,
  });

  const [equipmentStatus, setEquipmentStatus] = useState<any[]>([]);

  // Active Network Scanner states
  const [isScanningNetwork, setIsScanningNetwork] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanLogs, setScanLogs] = useState<SafeGuardLog[]>([]);
  const [scanResults, setScanResults] = useState<any[]>([]);

  const parsedReport = useMemo(() => {
    if (isRunning) {
      return {
        safety: safetyReport,
        execution: executionReport,
        detective: detectiveReport,
        knowledge: knowledgeReport,
      };
    }
    return parseSafeGuardReport(finalReport);
  }, [isRunning, finalReport, safetyReport, executionReport, detectiveReport, knowledgeReport]);

  const parsedHistoryReport = useMemo(() => {
    return selectedHistoryItem ? parseSafeGuardReport(selectedHistoryItem.report) : null;
  }, [selectedHistoryItem]);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const consolePanelRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const bootLogsEndRef = useRef<HTMLDivElement>(null);
  const hasLoadedRef = useRef(false);

  // Helper to parse markdown inline styles: **bold** and *italic*
  const renderMarkdownText = (text: string): React.ReactNode => {
    if (!text) return null;
    // Split on ** first, then handle * for italic
    const boldParts = text.split(/\*\*/);
    return boldParts.map((boldPart, bi) => {
      if (bi % 2 === 1) {
        // Inside ** ... ** — render as bold, strip any stray * chars
        return (
          <strong key={`b${bi}`} className="font-bold text-slate-900 dark:text-zinc-100">
            {boldPart.replace(/\*/g, "")}
          </strong>
        );
      }
      // Outside bold: split on single * for italic
      const italicParts = boldPart.split(/\*/);
      return italicParts.map((part, ii) => (
        ii % 2 === 1
          ? <em key={`i${bi}-${ii}`} className="italic text-slate-600">{part}</em>
          : <span key={`t${bi}-${ii}`}>{part}</span>
      ));
    });
  };

  // Normalize raw report text: handles double-escaped \n and Python-dict-like strings
  const normalizeReportText = (text: string): string => {
    if (!text) return text;
    // Fix double-escaped newlines from JSON serialization
    let normalized = text.replace(/\\n/g, "\n").replace(/\\t/g, "  ");
    // Detect Python-dict-like format: {'KEY': 'value', ...}
    const stripped = normalized.trim();
    if (stripped.startsWith("{") && stripped.endsWith("}") && /['"][A-Z][A-Z &\-:]+['"]/.test(stripped)) {
      const pairs: [string, string][] = [];
      const pairRegex = /['"]([A-Z][A-Z &\-:/]+)['"]\s*:\s*['"]([^'"]*)['"]/g;
      let m: RegExpExecArray | null;
      while ((m = pairRegex.exec(stripped)) !== null) {
        pairs.push([m[1].trim(), m[2].replace(/\\n/g, "\n").trim()]);
      }
      if (pairs.length > 0) {
        return pairs.map(([k, v]) => `**${k.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}:**\n${v}`).join("\n\n");
      }
    }
    return normalized;
  };

  const formatHeading = (heading: string): string => {
    const clean = heading.replace(/:/g, "").trim().toUpperCase();
    if (clean === "EXECUTIVE SUMMARY") return "Executive Summary";
    if (clean === "IMPORTANT STEPS HIGHLIGHTED" || clean === "KEY INTERVENTION STEPS") return "Key Intervention Steps";
    if (clean === "STEP-BY-STEP ACTION REQUIRED" || clean === "STEP-BY-STEP ACTION") return "Step-by-step Action Required";
    if (clean === "SAFETY PRECAUTIONS") return "Safety Precautions";
    if (clean === "CONCLUSION" || clean === "CONCLUSION & COMPLIANCE") return "Conclusion & Compliance";
    if (clean === "COMPLIANCE SIGN-OFF") return "Compliance Sign-off";
    return clean.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  };

  // Gemini-style document renderer for the Safety Incident Report
  const renderReportDocument = (reportText: string, equipmentName?: string) => {
    if (!reportText) return null;
    const text = normalizeReportText(reportText);

    const sizeMap = {
      sm:   { title: "text-base font-bold text-slate-900 dark:text-zinc-100", heading: "text-sm font-bold text-slate-850 dark:text-zinc-200 mt-5 mb-1.5", para: "text-[11px] text-slate-700 dark:text-zinc-300 leading-relaxed mb-3", bullet: "text-[11px] text-slate-700 dark:text-zinc-300 leading-relaxed", divider: "my-3" },
      base: { title: "text-lg font-bold text-slate-900 dark:text-zinc-100", heading: "text-sm font-bold text-slate-850 dark:text-zinc-200 mt-6 mb-2",   para: "text-xs text-slate-700 dark:text-zinc-300 leading-relaxed mb-3",    bullet: "text-xs text-slate-700 dark:text-zinc-300 leading-relaxed",    divider: "my-4" },
      lg:   { title: "text-xl font-bold text-slate-900 dark:text-zinc-100", heading: "text-base font-bold text-slate-850 dark:text-zinc-200 mt-7 mb-3", para: "text-sm text-slate-700 dark:text-zinc-300 leading-relaxed mb-4",    bullet: "text-sm text-slate-700 dark:text-zinc-300 leading-relaxed",    divider: "my-5" },
    };
    const sz = sizeMap[reportFontSize] || sizeMap.base;

    const reportTitle = equipmentName
      ? `Incident Report: ${equipmentName} Mitigation`
      : selectedBlueprint
      ? `Incident Report: ${selectedBlueprint} Mitigation`
      : "Incident Report: SafeGuard Safety Mitigation";

    const lines = text.split("\n");
    const elements: React.ReactNode[] = [];
    let listBuf: { prefix: string; content: string; num: boolean }[] = [];
    let inCodeBlock = false;
    let codeLines: string[] = [];

    const flushList = (key: string) => {
      if (!listBuf.length) return;
      elements.push(
        <ul key={`ul-${key}`} className="space-y-2 my-2 pl-1">
          {listBuf.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className={`shrink-0 mt-0.5 ${item.num ? "text-[10px] w-4 text-right font-semibold text-slate-400" : "text-slate-350 text-xs leading-none"}`}>
                {item.num ? item.prefix : "○"}
              </span>
              <span className={sz.bullet}>{renderMarkdownText(item.content)}</span>
            </li>
          ))}
        </ul>
      );
      listBuf = [];
    };

    const flushCode = (key: string) => {
      if (!codeLines.length) return;
      elements.push(
        <pre key={`code-${key}`} className="bg-slate-900 dark:bg-slate-950 text-slate-100 dark:text-emerald-400 font-mono text-xs p-4 rounded-lg border border-slate-200 dark:border-slate-800 leading-relaxed overflow-x-auto my-3 whitespace-pre-wrap">
          {codeLines.join("\n")}
        </pre>
      );
      codeLines = [];
      inCodeBlock = false;
    };

    lines.forEach((rawLine, idx) => {
      const line = rawLine;
      const trimmed = line.trim();

      if (trimmed.startsWith("```")) {
        if (inCodeBlock) {
          flushCode(`c${idx}`);
        } else {
          flushList(`bc${idx}`);
          inCodeBlock = true;
        }
        return;
      }

      if (inCodeBlock) {
        codeLines.push(line);
        return;
      }

      if (!trimmed) { flushList(`e${idx}`); return; }

      if (/^---+$/.test(trimmed)) { flushList(`d${idx}`); elements.push(<hr key={`hr${idx}`} className={`border-slate-200 ${sz.divider}`} />); return; }
      if (/^#{1,6}\s/.test(trimmed) && trimmed.replace(/^#+\s*/, "").length < 3) return;

      // Skip main level-1 titles since we already display reportTitle at the top
      if (/^#\s/.test(trimmed)) {
        return;
      }

      // If the line starts and ends with double asterisks, treat it as a bold paragraph (not a header split)
      if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
        flushList(`p-bold-${idx}`);
        elements.push(<p key={`p${idx}`} className={sz.para}>{renderMarkdownText(trimmed)}</p>);
        return;
      }

      // Check for **BOLD HEADER:** pattern on the raw line first (before stripping)
      const boldHeaderMatch = trimmed.match(/^\*\*([^*]+?):\*\*\s*(.*)$/);
      if (boldHeaderMatch) {
        flushList(`s${idx}`);
        const label = boldHeaderMatch[1].trim();
        const rest  = (boldHeaderMatch[2] || "").trim();
        elements.push(
          <div key={`sec${idx}`}>
            <h3 className={sz.heading}>{formatHeading(label)}</h3>
            {rest && <p className={sz.para}>{renderMarkdownText(rest)}</p>}
          </div>
        );
        return;
      }

      const headingLine = trimmed.replace(/^[-*•○◦■\s]+/, "");
      const sectionMatch = headingLine.match(/^([A-Z][A-Z ,&'\-/]{2,}):\s*(.*)$/);
      if (sectionMatch) {
        flushList(`s${idx}`);
        const label = sectionMatch[1].trim();
        const rest  = (sectionMatch[2] || "").trim();
        const isSection = /^[A-Z0-9 &'\-/:]+$/.test(label);
        if (isSection) {
          elements.push(
            <div key={`sec${idx}`}>
              <h3 className={sz.heading}>{formatHeading(label)}</h3>
              {rest && <p className={sz.para}>{renderMarkdownText(rest)}</p>}
            </div>
          );
          return;
        }
      }

      if (/^#{2,3}\s/.test(trimmed)) {
        flushList(`h${idx}`);
        const label = trimmed.replace(/^#+\s*/, "").replace(/:$/, "").trim();
        elements.push(<h3 key={`mh${idx}`} className={sz.heading}>{formatHeading(label)}</h3>);
        return;
      }

      const bulletMatch = trimmed.match(/^[-*•○◦■]\s+(.+)/);
      const numMatch    = trimmed.match(/^(\d+)\.\s+(.+)/);
      if (bulletMatch) { listBuf.push({ prefix: "○", content: bulletMatch[1], num: false }); return; }
      if (numMatch)    { listBuf.push({ prefix: numMatch[1] + ".", content: numMatch[2], num: true }); return; }

      flushList(`p${idx}`);
      elements.push(<p key={`p${idx}`} className={sz.para}>{renderMarkdownText(trimmed)}</p>);
    });
    flushList("end");
    flushCode("end");

    return (
      <div className="text-left font-sans">
        <h2 className={`${sz.title} mb-4 pb-4 border-b border-slate-200`}>{reportTitle}</h2>
        <div className="space-y-0.5">{elements}</div>
      </div>
    );
  };

  // Rich text renderer for Forensic, Knowledge, Execution panels
  const renderRichPanel = (text: string) => {
    if (!text) return null;
    const normalized = normalizeReportText(text);
    const lines = normalized.split("\n");
    const elements: React.ReactNode[] = [];
    let listBuf: { prefix: string; content: string; num: boolean }[] = [];
    let inCodeBlock = false;
    let codeLines: string[] = [];

    const flushList = (key: string) => {
      if (!listBuf.length) return;
      elements.push(
        <ul key={`ul-${key}`} className="space-y-1.5 my-2 pl-1">
          {listBuf.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className={`shrink-0 mt-0.5 ${item.num ? "text-[9px] w-4 text-right font-semibold text-slate-400" : "text-slate-350 text-xs leading-none"}`}>
                {item.num ? item.prefix : "◦"}
              </span>
              <span className="text-[11px] text-slate-700 leading-relaxed">{renderMarkdownText(item.content)}</span>
            </li>
          ))}
        </ul>
      );
      listBuf = [];
    };

    const flushCode = (key: string) => {
      if (!codeLines.length) return;
      elements.push(
        <pre key={`code-${key}`} className="bg-slate-900 text-emerald-400 font-mono text-[10px] p-3 rounded-lg border border-slate-800 leading-relaxed overflow-x-auto my-2 whitespace-pre-wrap">
          {codeLines.join("\n")}
        </pre>
      );
      codeLines = [];
      inCodeBlock = false;
    };

    lines.forEach((rawLine, idx) => {
      const line = rawLine;
      const trimmed = line.trim();

      if (trimmed.startsWith("```")) {
        if (inCodeBlock) { flushCode(`c${idx}`); } else { flushList(`bc${idx}`); inCodeBlock = true; }
        return;
      }
      if (inCodeBlock) { codeLines.push(line); return; }

      if (!trimmed) { flushList(`e${idx}`); return; }
      if (/^---+$/.test(trimmed)) { flushList(`d${idx}`); elements.push(<hr key={`hr${idx}`} className="border-slate-100 my-2" />); return; }

      // Check bold header on raw trimmed line before stripping asterisks
      const boldRichMatch = trimmed.match(/^\*\*([^*]+?):\*\*\s*(.*)$/);
      const h3Match  = /^#{1,3}\s/.test(trimmed);
      if (boldRichMatch) {
        flushList(`s${idx}`);
        const label = boldRichMatch[1].trim();
        const rest  = (boldRichMatch[2] || "").trim();
        elements.push(
          <div key={`sec${idx}`} className="mt-3 mb-1">
            <h4 className="text-[11px] font-bold text-slate-900 font-sans tracking-tight">
              {formatHeading(label)}
            </h4>
            {rest && <p className="text-[11px] text-slate-650 leading-relaxed mt-0.5">{renderMarkdownText(rest)}</p>}
          </div>
        );
        return;
      }
      // Also check uppercase ALLCAPS: headers
      const headingLine = trimmed.replace(/^[-*•○◦■\s]+/, "");
      const secMatch = headingLine.match(/^([A-Z][A-Z ,&'\-/]{2,}):\s*(.*)$/);
      if (secMatch && /^[A-Z0-9 &'\-/:]+$/.test(secMatch[1].trim())) {
        flushList(`s${idx}`);
        const label = secMatch[1].trim();
        const rest  = (secMatch[2] || "").trim();
        elements.push(
          <div key={`sec${idx}`} className="mt-3 mb-1">
            <h4 className="text-[11px] font-bold text-slate-900 font-sans tracking-tight">
              {formatHeading(label)}
            </h4>
            {rest && <p className="text-[11px] text-slate-650 leading-relaxed mt-0.5">{renderMarkdownText(rest)}</p>}
          </div>
        );
        return;
      }
      if (h3Match) {
        flushList(`h${idx}`);
        const label = trimmed.replace(/^#+\s*/, "").replace(/:$/, "").trim();
        elements.push(<h4 key={`h${idx}`} className="text-[11px] font-bold text-slate-900 font-sans tracking-tight mt-3 mb-1">{formatHeading(label)}</h4>);
        return;
      }

      if (/^\*\*\[.*\]\*\*|^Step \d+:|^\[ACTUATOR/.test(trimmed)) {
        flushList(`al${idx}`);
        elements.push(<p key={`al${idx}`} className="text-[11px] font-mono text-emerald-400 bg-slate-900 px-2 py-0.5 rounded my-0.5">{trimmed.replace(/\*\*/g, "")}</p>);
        return;
      }

      const bulletMatch = trimmed.match(/^[-*•○◦■]\s+(.+)/);
      const numMatch    = trimmed.match(/^(\d+)\.\s+(.+)/);
      if (bulletMatch) { listBuf.push({ prefix: "◦", content: bulletMatch[1], num: false }); return; }
      if (numMatch)    { listBuf.push({ prefix: numMatch[1] + ".", content: numMatch[2], num: true }); return; }

      flushList(`p${idx}`);
      elements.push(<p key={`p${idx}`} className="text-[11px] text-slate-600 leading-relaxed mb-1">{renderMarkdownText(trimmed)}</p>);
    });
    flushList("end");
    flushCode("end");

    return <div className="space-y-0 font-sans">{elements}</div>;
  };

  const renderExecutionLogs = (executionText: string) => {
    if (!executionText) return null;
    return (
      <div className="space-y-1">
        {executionText.split("\n").filter(Boolean).map((line, i) => {
          const isStep = /^\*\*\[|^\[ACTUATOR|^Step \d+:|^--/.test(line.trim());
          const isSuc  = /SUCCESS|CONFIRMED|COMPLETE/.test(line);
          const isFail = /FAIL|ERROR|REJECT/.test(line);
          return (
            <div key={i} className={`font-mono text-[10px] leading-relaxed px-3 py-0.5 rounded break-all whitespace-pre-wrap ${
              isSuc  ? "text-emerald-400 bg-slate-900" :
              isFail ? "text-red-400 bg-slate-900" :
              isStep ? "text-cyan-300 bg-slate-900 font-bold" :
              "text-slate-300 bg-slate-900"
            }`}>
              {line.replace(/\*\*/g, "")}
            </div>
          );
        })}
      </div>
    );
  };

  // On mount: sync dark_mode from the DOM class (applied by layout.tsx blocking script from localStorage)
  // This triggers a re-render of the boot screen with the correct theme if dark_mode was set in localStorage.
  useEffect(() => {
    window.scrollTo(0, 0);
    setMounted(true);
    const domIsDark = document.documentElement.classList.contains("dark");
    if (domIsDark && !settings.dark_mode) {
      setSettings((prev: any) => ({ ...prev, dark_mode: true }));
    } else if (!domIsDark && settings.dark_mode) {
      setSettings((prev: any) => ({ ...prev, dark_mode: false }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // Scroll to bottom of logs when they update or when resultsView switches back to console
  useEffect(() => {
    if (resultsView === "console" && safeGuardLogs.length > 0) {
      const timer = setTimeout(() => {
        const container = logsEndRef.current?.closest('.overflow-y-auto');
        if (container) {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: "smooth"
          });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [safeGuardLogs, resultsView]);

  // Handle timer for SafeGuard execution duration
  useEffect(() => {
    if (isRunning) {
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setElapsedTime(Number(((Date.now() - startTime) / 1000).toFixed(2)));
      }, 50);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  // Fetch all databases & configurations from the API
  // useCallback with empty deps [] — stable reference, never recreated.
  const fetchAllData = useCallback(async () => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    
    setBootProgress(0);
    setBootLogs(["SYSTEM [0.00s] Commencing real-time system initialization..."]);
    
    const addLog = (msg: string, progress: number) => {
      setBootLogs(prev => [...prev, msg]);
      setBootProgress(progress);
    };

    try {
      // 0. Fetch Settings immediately to set dark/light theme
      try {
        const setRes = await fetch("/api/settings");
        if (setRes.ok) {
          const setData = await setRes.json();
          const hasLocalPref = localStorage.getItem("tc_dark_mode") !== null;
          const localDark = localStorage.getItem("tc_dark_mode") === "true";
          const isDark = hasLocalPref ? localDark : !!setData.dark_mode;
          
          const mergedData = {
            ...setData,
            dark_mode: isDark
          };
          
          setSettings(mergedData);
          localStorage.setItem("tc_dark_mode", String(isDark));
          if (isDark) {
            document.documentElement.classList.add("dark");
          } else {
            document.documentElement.classList.remove("dark");
          }
          
          if (setData.dark_mode !== isDark) {
            fetch("/api/settings", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(mergedData),
            }).catch(err => console.error("Failed to sync dark mode with server:", err));
          }
        }
      } catch (err) {
        console.error("Initial theme check failed", err);
      }

      // 1. Fetch Blueprints
      await new Promise(r => setTimeout(r, 200));
      addLog("SYSTEM [0.10s] Fetching equipment blueprints from registry...", 10);
      const bpRes = await fetch("/api/blueprints");
      let bpCount = 0;
      if (bpRes.ok) {
        const bpData: Record<string, string> = await bpRes.json();
        const keys = Object.keys(bpData);
        bpCount = keys.length;
        setBlueprints(bpData);
        if (keys.length > 0) {
          const firstKey = keys[0];
          setSelectedBlueprint(firstKey);
          setBlueprintSpec(bpData[firstKey]);
        }
        addLog(`   -> Found ${bpCount} registered equipment blueprints.`, 15);
      } else {
        addLog("   -> Warning: Failed to retrieve blueprints.", 15);
      }

      // 2. Fetch Prompts
      await new Promise(r => setTimeout(r, 200));
      addLog("SWARM  [0.40s] Loading system instructions for 6 active swarm agents...", 25);
      const prRes = await fetch("/api/prompts");
      if (prRes.ok) {
        const prData = await prRes.json();
        setPrompts(prData);
        addLog("   -> Swarm agent prompts parsed and validated successfully.", 30);
      } else {
        addLog("   -> Warning: Swarm prompts failed validation.", 30);
      }

      // 3. Fetch History
      await new Promise(r => setTimeout(r, 200));
      addLog("AUDIT  [0.80s] Loading historical incident logs and containment trails...", 40);
      const hiRes = await fetch("/api/history");
      let hiCount = 0;
      if (hiRes.ok) {
        const hiData = await hiRes.json();
        hiCount = hiData.length;
        setHistory(hiData);
        addLog(`   -> Retrieved ${hiCount} archived incident logs.`, 45);
      } else {
        addLog("   -> Warning: Failed to fetch incident archives.", 45);
      }

      // 4. Fetch Metrics
      await new Promise(r => setTimeout(r, 200));
      addLog("MEMORY [1.20s] Checking API token usage and cost metrics database...", 55);
      const mtRes = await fetch("/api/metrics");
      if (mtRes.ok) {
        const mtData = await mtRes.json();
        setMetrics(mtData);
        addLog("   -> Cost telemetry metrics verified.", 60);
      } else {
        addLog("   -> Warning: Failed to sync token telemetry.", 60);
      }

      // 5. Live OT Connection
      await new Promise(r => setTimeout(r, 200));
      addLog("OT_BUS [1.60s] Querying live OPC-UA telemetry node registers...", 70);
      const eqRes = await fetch("/api/equipment");
      if (eqRes.ok) {
        const eqData = await eqRes.json();
        setEquipmentStatus(eqData);
        const eqCount = Object.keys(eqData).length;
        addLog(`   -> ${eqCount} OPC-UA registers connected to live telemetry.`, 75);
      } else {
        addLog("   -> Warning: OPC-UA registers offline.", 75);
      }

      // 6. Global Settings
      await new Promise(r => setTimeout(r, 200));
      addLog("CONFIG [2.00s] Loading facility parameters and model configuration...", 85);
      // Settings already loaded and calibrated in Step 0
      addLog("   -> Dark mode state and model failover routes calibrated.", 90);

      // 7. Prompt Backup History
      await new Promise(r => setTimeout(r, 200));
      addLog("BACKUP [2.30s] Scanning system rollback checkpoints...", 95);
      const histRes = await fetch("/api/prompts/history");
      if (histRes.ok) {
        const histData = await histRes.json();
        setPromptBackups(histData);
        if (histData.length > 0) {
          setSelectedBackup(prev => prev || histData[0].filename);
        }
        addLog(`   -> Found ${histData.length} backup rollback checkpoints.`, 100);
      } else {
        addLog("   -> Warning: rollbacks scan failed.", 100);
      }

      await new Promise(r => setTimeout(r, 200));
      addLog("SYSTEM [2.60s] Operational desk ready. SafeGuard initialized.", 100);

      // Brief delay to allow viewing success state before fade
      setTimeout(() => {
        setShowBootScreen(false);
      }, 700);

    } catch (err) {
      console.error("Failed to sync backend sandbox state", err);
      addLog("ERROR: Connection failed. Swarm console unavailable.", 100);
      setTimeout(() => {
        setShowBootScreen(false);
      }, 1500);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  useEffect(() => {
    if (showBootScreen) {
      const container = bootLogsEndRef.current?.parentElement;
      if (container) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: "smooth"
        });
      }
    }
  }, [bootLogs, showBootScreen]);
  // Telemetry presets text mapper
  const getPresetText = (name: string) => {
    // EV Battery / Vat
    if (name === "EV Battery Vat 4") {
      return "OPC-UA TELEMETRY ALERT [NodeID ns=2;s=Device.SectorA.Vat4]: EV Battery Vat 4 internal cell temperature spiked to 187°C (critical threshold: 140°C). Coolant loop pressure dropped to 12 PSI (minimum safe: 25 PSI). Secondary overheat sensor confirmed. Thermal runaway risk imminent — immediate containment required.";
    }
    if (name === "Server Rack B") {
      return "OPC-UA ALERT [NodeID ns=2;s=Device.DataCentre.RackB]: Server Rack B CPU core temperature at 91°C (trip limit: 85°C). CRAC unit airflow sensor reads 180 CFM (normal: 450 CFM). Inlet delta-T exceeded 26°C. UPS battery backup at 61% and draining. Risk of unplanned server shutdown in approximately 6 minutes.";
    }
    if (name === "Robotic Arm 9") {
      return "MQTT ALERT [sector_c/robotics/arm9]: Conveyor Robotic Arm 9 joint torque current spiked to 142% rated load (limit: 110%). Motor encoder reporting position drift of 4.7° over last 3 cycles. Safety light curtain interrupted twice in 60 seconds. Servo drive temperature: 94°C (limit: 80°C). Human safety hazard — arm movement erratic.";
    }
    if (name === "Cooling Tower 2") {
      return "OPC-UA ALERT [NodeID ns=2;s=Device.Utilities.CoolingTower2]: Cooling Tower 2 water flow rate dropped to 8 L/s (normal: 45 L/s). Return water temperature at 58°C (limit: 40°C). Basin level sensor shows -22% from setpoint. Fan motor drawing 18A (rated: 12A). Chiller compressor discharge pressure at 385 PSI (trip limit: 350 PSI).";
    }
    if (name === "Cooling Tower 1") {
      return "MQTT ALERT [sector_b/cooling/tower1]: Cooling Tower 1 drift eliminator fouling detected — pressure differential across fill media at 4.2 in. W.G. (limit: 2.5). Fan vibration at 7.8 mm/s RMS (alarm: 7.1). Inlet water conductivity 3800 µS/cm (limit: 3000). Risk of Legionella growth and structural fan failure.";
    }
    if (name === "Main Generator Block A") {
      return "OPC-UA ALERT [NodeID ns=2;s=Device.Power.GenA]: Main Generator Block A output frequency fluctuating between 49.1 Hz and 51.6 Hz (grid tolerance: ±0.5 Hz). AVR excitation current at 148% rated. Lube oil temperature 118°C (limit: 95°C). Vibration sensor on bearing #3 reads 9.2 mm/s (alarm: 7.0). Grid islanding protection has activated.";
    }
    if (name === "Pneumatic Press 7") {
      return "OPC-UA ALERT [NodeID ns=2;s=Device.SectorC.Press7]: Pneumatic Press 7 hydraulic servo pressure dropped from 210 bar to 48 bar in 4.2 seconds. Cylinder position encoder reporting ±12 mm erratic deviation. Safety light curtain interrupted. Last maintenance log shows interlock bypass for test — not re-enabled. Uncontrolled ram descent risk.";
    }
    if (name === "Emergency Flare Stack EFS-3") {
      return "MQTT ALERT [sector_d/flare/efs3]: Emergency Flare Stack EFS-3 pilot flame extinguished — thermocouple reading ambient (26°C, expected >800°C). Gas header pressure rising to 6.8 barg (relief setpoint: 7.5 barg). Knockout drum level at 87% (high-high alarm: 90%). Unburned hydrocarbon release risk. Immediate manual re-ignition or gas diversion required.";
    }
    if (name === "Nitrogen Purge Unit NPU-12") {
      return "OPC-UA ALERT [NodeID ns=2;s=Device.SectorA.NPU12]: Nitrogen Purge Unit NPU-12 outlet oxygen concentration reading 3.2% (inerting limit: <1.0%). Supply cylinder bank pressure at 48 bar (low-low alarm: 50 bar). Purge flow rate dropped from 120 SLPM to 31 SLPM. Risk of explosive atmosphere formation in connected vessel V-204.";
    }
    if (name === "Conveyor Belt 12") {
      return "MQTT ALERT [sector_b/conveyors/belt12]: Conveyor Belt 12 belt speed deviation — commanded 1.4 m/s, actual 0.6 m/s. Motor current draw at 185% FLA. Belt tension sensor reading 12 kN (limit: 18 kN) — possible belt slip or jam. Thermal camera shows hotspot at roller #7 (124°C). Emergency pull-wire activated at station B-12-04.";
    }
    if (name === "Chemical Reactor R-202") {
      return "OPC-UA ALERT [NodeID ns=2;s=Device.SectorB.ReactorR202]: Chemical Reactor R-202 exothermic runaway detected — jacket cooling water outlet temperature 78°C (setpoint: 25°C). Reactor internal temp rising at 4.2°C/min (limit: 0.8°C/min). Agitator speed dropped to 0 RPM. Relief valve RV-202A lifted at 14.8 barg. Manual quench injection required immediately.";
    }
    if (name === "Hydraulic Lift HL-3") {
      return "MQTT ALERT [sector_c/lifts/hl3]: Hydraulic Lift HL-3 load cell reading 4,850 kg (rated capacity: 4,000 kg — overloaded by 21%). Hydraulic cylinder seal leak detected — system pressure dropping 12 bar/min. Platform position encoder shows 2.1 mm drift from floor level. Anti-fall safety latch has not engaged. Personnel on platform — immediate evacuation required.";
    }
    if (name === "Boiler B-50") {
      return "MQTT ALERT [sector_b/boiler_b50]: Steam Boiler B-50 winding temperature exceeded 320°C (trip limit: 280°C). Motor current draw spiked to 148% rated load. Abnormal combustion vibration at 94 Hz on bearing housing. Drum water level at -180mm NWL (low-low: -150mm). Steam pressure 17.8 barg (MAWP: 18 barg). Emergency shutdown sequence required.";
    }
    if (name === "Gas Flare System GF-8") {
      return "OPC-UA ALERT [NodeID ns=2;s=Device.SectorD.FlareGF8]: Gas Flare System GF-8 smokeless combustion lost — steam-to-gas ratio dropped to 0.18 (minimum: 0.35). Flare tip thermocouple #2 failed open. Radiation heat monitor at 4.8 kW/m² (limit: 4.5). Wind speed 22 m/s — flame blow-off risk. Ground-level HC detector at fence line reading 18% LEL.";
    }
    if (name === "Transformer T-1") {
      return "OPC-UA ALERT [NodeID ns=2;s=Device.Power.TransformerT1]: Power Transformer T-1 Buchholz relay gas accumulation alarm active. Top-oil temperature 112°C (limit: 105°C). Dissolved gas analysis shows hydrogen at 480 ppm (limit: 300 ppm) and acetylene at 12 ppm (limit: 1 ppm) — indicates active arcing. Winding temperature indicator at 138°C. De-energize and isolate immediately.";
    }
    if (name === "Centrifugal Compressor C-401") {
      return "MQTT ALERT [sector_a/compressors/c401]: Centrifugal Compressor C-401 surge event detected — suction pressure oscillating ±1.8 bar at 3 Hz. Discharge temperature 198°C (limit: 175°C). Axial displacement on thrust bearing: 0.48 mm (trip: 0.50 mm). Anti-surge valve failed to open (actuator fault). Catastrophic bearing failure risk within minutes.";
    }
    if (name === "Storage Tank ST-300") {
      return "OPC-UA ALERT [NodeID ns=2;s=Device.SectorC.TankST300]: Storage Tank ST-300 level at 96.4% (overflow setpoint: 95%). High-high level switch LSH-300A confirmed. Roof drain valve stuck closed — rainwater accumulation adding load. Tank shell temperature gradient: 38°C side-to-side (wind cooling asymmetry). Inlet valve FV-301 not responding to close command.";
    }
    if (name === "Centrifugal Pump P-101") {
      return "MQTT ALERT [sector_b/pumps/p101]: Centrifugal Pump P-101 cavitation detected — suction pressure at 0.3 barg (minimum: 1.2 barg NPSH required). Flow rate dropped from 340 m³/hr to 89 m³/hr. Vibration at impeller frequency: 18.4 mm/s RMS (limit: 7.1). Seal flush temperature 95°C (limit: 70°C). Mechanical seal failure imminent — bearing housing temperature 88°C.";
    }
    if (name === "Steam Turbine ST-5") {
      return "OPC-UA ALERT [NodeID ns=2;s=Device.Power.TurbineST5]: Steam Turbine ST-5 overspeed protection triggered at 3,312 RPM (trip setpoint: 3,300 RPM). Governor valve failed closed abruptly — steam chest pressure spike to 68 barg. Thrust bearing metal temperature: 142°C (alarm: 120°C). Last oil sample: ISO particle count 23/21/18 — severe contamination. Trip and lock out required.";
    }
    if (name === "Unknown Equipment") {
      return "OPC-UA TELEMETRY ALERT [NodeID ns=2;s=Device.SectorX.UnknownAsset]: Unregistered asset detected on plant network reporting critical fault state. Temperature sensor: 210°C (no baseline available). Vibration: 12.1 mm/s RMS. No P&ID reference found. Asset may be newly commissioned or mislabeled. Immediate physical inspection and equipment identification required.";
    }
    // Final fallback — should never reach here with known blueprints
    return `OPC-UA TELEMETRY ALERT [NodeID ns=2;s=Device.Plant.${name.replace(/\s+/g, "")}]: ${name} reporting critical sensor threshold breach. Primary process variable exceeded safe operating limit by 35%. Secondary protective device has not actuated. Manual inspection and immediate containment required per site emergency procedures.`;
  };

  const getPresetIcon = (name: string) => {
    // Single monochrome icon — category hinted by shape only, no color
    if (name.includes("Vat") || name.includes("Boiler") || name.includes("Flare") || name.includes("Purge")) 
      return <Flame className="h-3.5 w-3.5 shrink-0" style={{color:'var(--text-muted)'}} />;
    if (name.includes("Rack") || name.includes("Server")) 
      return <Server className="h-3.5 w-3.5 shrink-0" style={{color:'var(--text-muted)'}} />;
    if (name.includes("Arm") || name.includes("Robotic") || name.includes("Press") || name.includes("Conveyor")) 
      return <Cpu className="h-3.5 w-3.5 shrink-0" style={{color:'var(--text-muted)'}} />;
    if (name.includes("Tower") || name.includes("Cooling") || name.includes("Pump") || name.includes("Compressor") || name.includes("Tank")) 
      return <Droplets className="h-3.5 w-3.5 shrink-0" style={{color:'var(--text-muted)'}} />;
    if (name.includes("Generator") || name.includes("EV Battery") || name.includes("Transformer") || name.includes("Gas")) 
      return <Zap className="h-3.5 w-3.5 shrink-0" style={{color:'var(--text-muted)'}} />;
    return <ShieldAlert className="h-3.5 w-3.5 shrink-0" style={{color:'var(--text-muted)'}} />;
  };

  const selectPreset = (name: string) => {
    setErrorMsg("");
    const text = getPresetText(name);
    setAlertInput(text);
    setSelectedPreset(name);
    setSafeGuardLogs([]);
    setFinalReport("");
    setSafetyReport("");
    setExecutionReport("");
    setDetectiveReport("");
    setKnowledgeReport("");
    setActiveEquipment("");
    setResultsView("console");
    // No scroll — user stays exactly where they are
  };

  // Trigger SafeGuard Flow via Server-Sent Events (SSE)
  const triggerSafeGuard = async (customText?: string) => {
    const textToProcess = customText !== undefined ? customText : alertInput;
    if (!textToProcess.trim() || isRunning) return;

    setIsRunning(true);
    setSafeGuardLogs([]);
    setFinalReport("");
    setSafetyReport("");
    setExecutionReport("");
    setDetectiveReport("");
    setKnowledgeReport("");
    setActiveEquipment("");
    setLastSecuredEquipment("");
    setErrorMsg("");
    setElapsedTime(0);
    setResultsView("console");

    try {
      const response = await fetch("/api/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alert_text: textToProcess,
          delay: stepDelay,
          live_mode: true,
          mock_mode: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      if (!response.body) {
        throw new Error("Response body is not readable");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const eventData = JSON.parse(line.slice(6));
                
                if (eventData.type === "log") {
                  setSafeGuardLogs((prev) => [
                    ...prev,
                    { agent: eventData.agent, text: eventData.text },
                  ]);
                  if (eventData.text.includes("Identified equipment: **")) {
                    try {
                      const equip = eventData.text.split("Identified equipment: **")[1].split("**")[0];
                      setActiveEquipment(equip);
                    } catch (e) {}
                  }
                } else if (eventData.type === "hitl_awaiting") {
                  setHitlData({
                    incidentId: eventData.incident_id,
                    equipmentName: eventData.equipment_name,
                    proposedChecklist: eventData.proposed_checklist,
                  });
                } else if (eventData.type === "report_part") {
                  if (eventData.part === "safety") {
                    setSafetyReport(eventData.content);
                    // Switch to report tab as soon as first report part arrives
                    setResultsView("report");
                    setTimeout(() => {
                      const container = consolePanelRef.current?.closest('.overflow-y-auto');
                      if (container) {
                        const topPos = consolePanelRef.current ? consolePanelRef.current.offsetTop - 20 : 0;
                        container.scrollTo({
                          top: topPos,
                          behavior: "smooth"
                        });
                      }
                    }, 120);
                  } else if (eventData.part === "execution") {
                    setExecutionReport(eventData.content);
                  } else if (eventData.part === "detective") {
                    setDetectiveReport(eventData.content);
                  } else if (eventData.part === "knowledge") {
                    setKnowledgeReport(eventData.content);
                  }
                } else if (eventData.type === "report") {
                  setFinalReport(eventData.report);
                  const parsed = parseSafeGuardReport(eventData.report);
                  setSafetyReport(parsed.safety);
                  setExecutionReport(parsed.execution);
                  setDetectiveReport(parsed.detective);
                  setKnowledgeReport(parsed.knowledge);
                  setLastSecuredEquipment(activeEquipment || selectedPreset);
                  // Auto-switch to Incident Report tab and scroll to it
                  setResultsView("report");
                  setTimeout(() => {
                    const container = consolePanelRef.current?.closest('.overflow-y-auto');
                    if (container) {
                      const topPos = consolePanelRef.current ? consolePanelRef.current.offsetTop - 20 : 0;
                      container.scrollTo({
                        top: topPos,
                        behavior: "smooth"
                      });
                    }
                  }, 120);
                } else if (eventData.type === "error") {
                  setErrorMsg(eventData.message);
                }
              } catch (jsonErr) {
                console.error("Failed to parse SSE payload", jsonErr);
              }
            }
          }
        }
        if (done) break;
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected network error occurred.");
    } finally {
      setIsRunning(false);
      fetchAllData(); // Reload metrics & history logs
    }
  };

  // Save changes to the selected Blueprint specification
  const saveBlueprintSpec = async () => {
    if (!selectedBlueprint) return;
    try {
      const resp = await fetch("/api/blueprints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: selectedBlueprint, spec: blueprintSpec }),
      });
      if (resp.ok) {
        alert(`Blueprint details for "${selectedBlueprint}" updated successfully.`);
        fetchAllData();
      }
    } catch (err) {
      alert("Error saving blueprint spec.");
    }
  };

  // Delete the selected Blueprint specification
  const deleteBlueprintSpec = async () => {
    if (!selectedBlueprint) return;
    if (!confirm(`Are you sure you want to delete blueprint: ${selectedBlueprint}?`)) return;
    try {
      const resp = await fetch(`/api/blueprints/${encodeURIComponent(selectedBlueprint)}`, {
        method: "DELETE",
      });
      if (resp.ok) {
        alert(`Blueprint "${selectedBlueprint}" deleted.`);
        setSelectedBlueprint("");
        fetchAllData();
      }
    } catch (err) {
      alert("Error deleting blueprint.");
    }
  };

  // Active Network Scanner Flow (SSE Streaming)
  const startNetworkScan = async () => {
    setIsScanningNetwork(true);
    setShowScanModal(true);
    setScanLogs([]);
    setScanResults([]);

    try {
      const response = await fetch("/api/scan-network", {
        method: "POST"
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const eventData = JSON.parse(line.slice(6));
              if (eventData.type === "log") {
                setScanLogs((prev) => [...prev, { agent: eventData.agent, text: eventData.text }]);
              } else if (eventData.type === "results") {
                setScanResults(eventData.results);
              } else if (eventData.type === "error") {
                alert("Scan Error: " + eventData.message);
              }
            } catch (e) {
              console.error("Error parsing SSE line:", e);
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to run scan:", err);
      alert("Failed to connect to network scan service.");
    } finally {
      setIsScanningNetwork(false);
      fetchAllData();
    }
  };

  // Add a brand new Blueprint specification
  const addBlueprintSpec = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlueprintName.trim() || !newBlueprintSpec.trim()) return;
    try {
      const resp = await fetch("/api/blueprints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newBlueprintName, spec: newBlueprintSpec }),
      });
      if (resp.ok) {
        alert(`New blueprint "${newBlueprintName}" created successfully!`);
        setNewBlueprintName("");
        setNewBlueprintSpec("");
        setShowAddBlueprint(false);
        fetchAllData();
      }
    } catch (err) {
      alert("Error creating blueprint.");
    }
  };

  // Save updated System Prompts rules
  const saveAgentPrompts = async () => {
    setIsSavingPrompts(true);
    try {
      const resp = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prompts),
      });
      if (resp.ok) {
        alert("SafeGuard agent prompt rules updated on disk. Background daemons loaded prompts successfully!");
      } else {
        alert("Failed to save prompts.");
      }
    } catch (err) {
      alert("Error saving prompts.");
    } finally {
      setIsSavingPrompts(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(finalReport);
    alert("Safety Incident Report copied to clipboard!");
  };

  // Shared PDF generator — auto-downloads without print dialog
  const generatePDF = async (reportText: string, equipment: string, timestamp?: string) => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentW = pageW - margin * 2;
    let y = 0;

    // ── Colours ──────────────────────────────────────────────
    const BLUE    = [11,  87, 208] as const;
    const DARK    = [15,  23,  42] as const;
    const BODY    = [51,  65,  85] as const;
    const MUTED   = [100, 116, 139] as const;
    const LIGHT   = [241, 245, 249] as const;
    const WHITE   = [255, 255, 255] as const;
    const DIVIDER = [226, 232, 240] as const;

    const setFill = ([r,g,b]: readonly number[]) => doc.setFillColor(r,g,b);
    const setDraw = ([r,g,b]: readonly number[]) => doc.setDrawColor(r,g,b);
    const setTxt  = ([r,g,b]: readonly number[]) => doc.setTextColor(r,g,b);

    const addPage = () => { doc.addPage(); y = margin + 6; };
    const checkY  = (h: number) => { if (y + h > pageH - 18) addPage(); };

    interface Segment {
      text: string;
      isBold: boolean;
    }

    const parseTokens = (txt: string) => {
      const parts = txt.split(/\*\*([^*]+?)\*\*/g);
      return parts.map((part, index) => ({
        text: part,
        isBold: index % 2 === 1
      })).filter(t => t.text !== "");
    };

    const writeWrappedInlineText = (
      text: string,
      startX: number,
      width: number,
      lineHeight: number,
      prefixInfo?: { type: "bullet" | "number"; numStr?: string }
    ) => {
      const tokens = parseTokens(text);
      const segments: Segment[] = [];
      tokens.forEach(tok => {
        const chunks = tok.text.split(/(\s+)/).filter(Boolean);
        chunks.forEach(chunk => {
          segments.push({ text: chunk, isBold: tok.isBold });
        });
      });

      let currentLine: Segment[] = [];
      let currentW = 0;
      let isFirstLine = true;

      const flushCurrentLine = () => {
        if (currentLine.length === 0) return;
        checkY(lineHeight);

        if (isFirstLine && prefixInfo) {
          if (prefixInfo.type === "bullet") {
            setFill(MUTED);
            doc.circle(margin + 3.5, y - 1.2, 0.7, "F");
          } else if (prefixInfo.type === "number" && prefixInfo.numStr) {
            doc.setFont("helvetica", "bold");
            setTxt(MUTED);
            doc.text(prefixInfo.numStr, margin + 3, y);
            doc.setFont("helvetica", "normal");
          }
          isFirstLine = false;
        }

        let runX = startX;
        currentLine.forEach(seg => {
          doc.setFont("helvetica", seg.isBold ? "bold" : "normal");
          doc.setFontSize(9);
          setTxt(BODY);
          doc.text(seg.text, runX, y);
          runX += doc.getTextWidth(seg.text);
        });
        y += lineHeight;
        currentLine = [];
        currentW = 0;
      };

      segments.forEach(seg => {
        doc.setFont("helvetica", seg.isBold ? "bold" : "normal");
        doc.setFontSize(9);
        const segW = doc.getTextWidth(seg.text);
        const isSpace = /^\s+$/.test(seg.text);

        if (isSpace) {
          if (currentLine.length > 0) {
            if (currentW + segW <= width) {
              currentLine.push(seg);
              currentW += segW;
            } else {
              flushCurrentLine();
            }
          }
        } else {
          if (currentW + segW <= width) {
            currentLine.push(seg);
            currentW += segW;
          } else {
            if (currentLine.length === 0) {
              currentLine.push(seg);
              currentW += segW;
              flushCurrentLine();
            } else {
              flushCurrentLine();
              currentLine.push(seg);
              currentW = segW;
            }
          }
        }
      });

      flushCurrentLine();
    };

    // ── COVER HEADER ─────────────────────────────────────────
    setFill(DARK); doc.rect(0, 0, pageW, 36, "F");
    setFill(BLUE); doc.rect(0, 36, pageW, 3, "F");
    // Logo dot
    setFill(BLUE);  doc.circle(margin, 13, 3.5, "F");
    setFill(WHITE); doc.circle(margin, 13, 1.6, "F");
    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    setTxt(WHITE);
    doc.text("TechCare SafeGuard", margin + 7, 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    setTxt([180, 200, 240]);
    doc.text("AI-Powered Industrial Incident Containment", margin + 7, 18.5);
    // Right-side timestamp
    doc.setFontSize(7.5);
    setTxt([148, 163, 184]);
    const ts = timestamp || new Date().toLocaleString();
    doc.text(ts, pageW - margin, 12, { align: "right" });
    doc.text("Confidential - Internal Use Only", pageW - margin, 18.5, { align: "right" });

    y = 46;

    // ── EQUIPMENT SUMMARY STRIP ───────────────────────────────
    setFill(LIGHT);
    doc.roundedRect(margin, y, contentW, 14, 2, 2, "F");
    setFill(BLUE);
    doc.roundedRect(margin, y, 4, 14, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    setTxt(DARK);
    doc.text(`Incident Report: ${equipment} Mitigation`, margin + 8, y + 6.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setTxt(MUTED);
    doc.text("Generated by TechCare SafeGuard Autonomous Agent Cluster", margin + 8, y + 11.5);
    y += 22;

    // ── REPORT BODY ───────────────────────────────────────────
    const lines = reportText.replace(/\\n/g, "\n").split("\n");
    let inSection = false;
    let hasComplianceSignOff = false;
    let inCodeBlock = false;
    let codeBlockLines: string[] = [];
    let prevLineWasBlank = false;
    let prevLineWasHeading = false;
    let prevLineWasList = false;

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      const line = rawLine.trim();

      // Check code block
      if (line.startsWith("```")) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeBlockLines = [];
        } else {
          inCodeBlock = false;
          if (codeBlockLines.length > 0) {
            doc.setFont("courier", "normal");
            doc.setFontSize(8);
            const codeLineHeight = 4.2;
            const padding = 3;
            let totalLinesNeeded = 0;
            const wrappedLinesList: string[][] = [];

            codeBlockLines.forEach(cl => {
              const wrapped = doc.splitTextToSize(cl, contentW - 8);
              wrappedLinesList.push(wrapped);
              totalLinesNeeded += wrapped.length;
            });

            const blockH = totalLinesNeeded * codeLineHeight + padding * 2;
            checkY(blockH);

            // Draw box
            setFill([248, 250, 252]);
            setDraw([226, 232, 240]);
            doc.setLineWidth(0.25);
            doc.roundedRect(margin, y, contentW, blockH, 1, 1, "FD");

            y += padding;

            // Render courier text
            setTxt([51, 65, 85]);
            wrappedLinesList.forEach(wrapped => {
              wrapped.forEach(wl => {
                doc.text(wl, margin + 4, y + 2.8);
                y += codeLineHeight;
              });
            });

            y += padding + 1; // Margin below block
          }
        }
        prevLineWasBlank = false;
        prevLineWasHeading = false;
        prevLineWasList = false;
        continue;
      }

      if (inCodeBlock) {
        codeBlockLines.push(rawLine); // Keep indentation
        continue;
      }

      if (!line) {
        // Look ahead to check the type of the next non-empty line
        let nextNonEmptyLine = "";
        for (let j = i + 1; j < lines.length; j++) {
          const trimmed = lines[j].trim();
          if (trimmed) {
            nextNonEmptyLine = trimmed;
            break;
          }
        }

        const nextIsList = nextNonEmptyLine.match(/^[-*•○◦■]\s+/) || nextNonEmptyLine.match(/^\d+\.\s+/);

        if (prevLineWasBlank || prevLineWasHeading) {
          continue;
        }

        if (prevLineWasList) {
          if (nextIsList) {
            // Skip spacing between consecutive list items
            continue;
          } else {
            y += 1.5; // Small extra gap after the list before text/heading
          }
        } else {
          y += inSection ? 2 : 2.5;
        }

        prevLineWasBlank = true;
        prevLineWasHeading = false;
        prevLineWasList = false;
        continue;
      }

      // Horizontal rule
      if (/^---+$/.test(line)) {
        checkY(6);
        setDraw(DIVIDER);
        doc.setLineWidth(0.35);
        doc.line(margin, y + 2, pageW - margin, y + 2);
        y += 6;
        prevLineWasBlank = false;
        prevLineWasHeading = false;
        prevLineWasList = false;
        continue;
      }

      // Heading detection
      const isH1 = line.startsWith("# ");
      const isH2 = line.startsWith("## ");
      const isH3 = line.startsWith("### ");
      
      const secM  = line.match(/^\*\*([^*]+?)\*\*:?\s*(.*)$/) || line.match(/^([A-Z][A-Z ,&'\-/]{2,}):\s*(.*)$/);
      const isSec = secM && /^[A-Z0-9 &'\-/:]+$/.test((secM[1] || "").trim());

      if (isH1) {
        checkY(16);
        const rawLabel = line.replace(/^#\s+/, "").replace(/:$/, "").trim();
        const label = formatHeading(rawLabel);
        
        if (label === "Compliance Sign-off") {
          hasComplianceSignOff = true;
        }

        // Main H1 Section card background + left bar
        setFill(LIGHT);
        doc.roundedRect(margin, y - 1, contentW, 10, 1.5, 1.5, "F");
        setFill(BLUE);
        doc.roundedRect(margin, y - 1, 3.5, 10, 1, 1, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        setTxt(BLUE);
        doc.text(label, margin + 6, y + 5.8);
        inSection = true;
        y += 13.0; // Perfect vertical separation (banner bottom margin)
        prevLineWasBlank = false;
        prevLineWasHeading = true;
        prevLineWasList = false;
        continue;
      }

      if (isH2 || isH3 || isSec) {
        checkY(11);
        const rawLabel = isH2 ? line.replace(/^##\s+/, "") : (isH3 ? line.replace(/^###\s+/, "") : secM![1]);
        const label = formatHeading(rawLabel.replace(/:$/, "").trim());
        
        if (label === "Compliance Sign-off") {
          hasComplianceSignOff = true;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        setTxt(DARK);
        doc.text(label, margin + 4, y + 3);
        y += 8.0; // Perfect baseline-to-baseline spacing of 5.0mm (from y + 3 to y + 8)

        const rest = isSec ? (secM![2] || "").trim() : "";
        if (rest) {
          writeWrappedInlineText(rest, margin + 4, contentW - 4, 5);
          y += 1.5;
          prevLineWasHeading = false;
          prevLineWasList = false;
        } else {
          prevLineWasHeading = true;
          prevLineWasList = false;
        }
        prevLineWasBlank = false;
        continue;
      }

      // Bullet items — draw circle manually to avoid Unicode encoding bugs
      const bulletMatch = line.match(/^[-*•○◦■]\s+(.+)/);
      const numMatch    = line.match(/^(\d+)\.\s+(.+)/);
      if (bulletMatch || numMatch) {
        const content = bulletMatch ? bulletMatch[1] : numMatch![2];
        if (numMatch) {
          writeWrappedInlineText(content, margin + 8, contentW - 10, 5, { type: "number", numStr: `${numMatch[1]}.` });
        } else {
          writeWrappedInlineText(content, margin + 8, contentW - 10, 5, { type: "bullet" });
        }
        y += 1.5; // Small bottom margin after bullet text
        prevLineWasBlank = false;
        prevLineWasHeading = false;
        prevLineWasList = true;
        continue;
      }

      // Plain paragraph
      writeWrappedInlineText(line, margin + 4, contentW - 4, 5);
      y += 2.0;
      prevLineWasBlank = false;
      prevLineWasHeading = false;
      prevLineWasList = false;
    }

    if (hasComplianceSignOff) {
      checkY(35);
      y += 10;
      
      setDraw(MUTED);
      doc.setLineWidth(0.3);
      doc.setLineDashPattern([1, 2], 0);
      
      const col1X = margin + 5;
      const colWidth = (contentW - 20) / 2;
      doc.line(col1X, y + 15, col1X + colWidth, y + 15);
      
      const col2X = pageW - margin - 5 - colWidth;
      doc.line(col2X, y + 15, col2X + colWidth, y + 15);
      
      doc.setLineDashPattern([], 0);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      setTxt(DARK);
      doc.text("Operations Coordinator Signature", col1X, y + 19.5);
      doc.text("Safety Officer Signature", col2X, y + 19.5);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      setTxt(MUTED);
      doc.text("Date: ________________________", col1X, y + 24);
      doc.text("Date: ________________________", col2X, y + 24);
      
      y += 30;
    }

    // ── FOOTER BAR on every page ──────────────────────────────
    const totalPages = (doc as any).getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      setFill(DARK);
      doc.rect(0, pageH - 12, pageW, 12, "F");
      setFill(BLUE);
      doc.rect(0, pageH - 12, pageW, 1, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      setTxt([148, 163, 184]);
      doc.text("TechCare SafeGuard  |  Powered by Groq Llama & Band SDK", margin, pageH - 6);
      doc.text(`Page ${p} of ${totalPages}`, pageW - margin, pageH - 6, { align: "right" });
    }

    const filename = `TechCare_${equipment.replace(/\s+/g, "_")}_Incident_Report.pdf`;
    doc.save(filename);
  };

  const downloadReport = () => {
    const equipment = activeEquipment || selectedBlueprint || "Equipment";
    generatePDF(finalReport, equipment);
  };

  const resetSandbox = async () => {
    if (!confirm("Are you sure you want to reset the sandbox? This will purge all history, restore all default equipment blueprints, and reset agent rules to factory defaults.")) return;
    try {
      const resp = await fetch("/api/reset", { method: "POST" });
      if (resp.ok) {
        alert("Sandbox database and agent rules reset to factory defaults successfully!");
        fetchAllData();
      } else {
        alert("Failed to reset sandbox.");
      }
    } catch (err) {
      alert("Error resetting sandbox.");
    }
  };

  if (showBootScreen) {
    const isDark = mounted && settings.dark_mode === true;
    const bgColor = isDark ? "#000000" : "#ffffff";
    const textPrimary = isDark ? "#f5f5f7" : "#0d1117";
    const textMuted = isDark ? "#71717a" : "#6b7280";
    const textAccent = isDark ? "#60a5fa" : "#3b82f6";
    const gridLine = isDark ? "rgba(255,255,255,0.025)" : "rgba(15,23,42,0.05)";
    const ringTrack = isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.08)";
    const consoleBg = isDark ? "#0a0a0a" : "#f8fafc";
    const consoleBorder = isDark ? "#1f1f23" : "#dde2e9";
    const statusPillBg = isDark ? "rgba(59,130,246,0.08)" : "rgba(59,130,246,0.06)";
    const statusPillBorder = isDark ? "rgba(59,130,246,0.2)" : "rgba(59,130,246,0.15)";
    const logTextOk = isDark ? "#a1f0c0" : "#15803d";
    const logTextNormal = isDark ? "#71717a" : "#6b7280";
    const circumference = 2 * Math.PI * 52;
    return (
      <div style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        background: bgColor,
        color: textPrimary,
        userSelect: "none", overflow: "hidden",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'SF Pro Text', sans-serif",
        transition: "background 0.3s",
      }}>
        {/* Grid overlay */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: `linear-gradient(${gridLine} 1px, transparent 1px), linear-gradient(90deg, ${gridLine} 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }} />
        {/* Radial glow */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: isDark
            ? "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(59,130,246,0.07) 0%, transparent 70%)"
            : "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(59,130,246,0.05) 0%, transparent 70%)",
        }} />
        {/* Secondary glow accent */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: isDark
            ? "radial-gradient(ellipse 40% 40% at 30% 20%, rgba(16,185,129,0.04) 0%, transparent 60%)"
            : "radial-gradient(ellipse 40% 40% at 70% 80%, rgba(16,185,129,0.03) 0%, transparent 60%)",
        }} />

        {/* Main content card */}
        <div style={{
          position: "relative", display: "flex", flexDirection: "column",
          alignItems: "center", gap: "28px", width: "360px",
        }}>

          {/* ── Progress Ring ── */}
          <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {/* Outer slow-spin dashed orbit */}
            <div style={{
              position: "absolute", width: "148px", height: "148px",
              borderRadius: "50%",
              border: `1px dashed ${isDark ? "rgba(59,130,246,0.15)" : "rgba(59,130,246,0.2)"}`,
              animation: "spin 18s linear infinite",
            }} />
            {/* Middle counter-spin orbit */}
            <div style={{
              position: "absolute", width: "128px", height: "128px",
              borderRadius: "50%",
              border: `1px solid ${isDark ? "rgba(16,185,129,0.1)" : "rgba(16,185,129,0.12)"}`,
              animation: "spin 10s linear infinite reverse",
            }} />
            {/* SVG progress arc */}
            <svg width="120" height="120" style={{ transform: "rotate(-90deg)" }}>
              <defs>
                <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="50%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
                <filter id="arcGlow">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              {/* Track */}
              <circle cx="60" cy="60" r="52" fill="none" stroke={ringTrack} strokeWidth="3" />
              {/* Progress arc */}
              <circle
                cx="60" cy="60" r="52"
                fill="none"
                stroke="url(#arcGrad)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference - (circumference * bootProgress) / 100}
                filter="url(#arcGlow)"
                style={{ transition: "stroke-dashoffset 0.4s ease-out" }}
              />
            </svg>
            {/* Center percentage */}
            <div style={{
              position: "absolute",
              display: "flex", flexDirection: "column", alignItems: "center", gap: "2px",
            }}>
              <span style={{
                fontFamily: "'SF Mono', 'Menlo', monospace",
                fontSize: "22px", fontWeight: 800,
                letterSpacing: "-0.04em",
                background: "linear-gradient(135deg, #3b82f6, #10b981)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>{bootProgress}</span>
              <span style={{
                fontFamily: "'SF Mono', 'Menlo', monospace",
                fontSize: "8px", fontWeight: 700, letterSpacing: "0.12em",
                color: textMuted, textTransform: "uppercase",
              }}>%</span>
            </div>
          </div>

          {/* ── Brand & Status ── */}
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
            {/* Status pill */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: "7px",
              padding: "5px 14px", borderRadius: "999px",
              background: statusPillBg,
              border: `1px solid ${statusPillBorder}`,
              fontSize: "9px", fontWeight: 700,
              color: textAccent, letterSpacing: "0.1em", textTransform: "uppercase",
            }}>
              <span style={{
                width: "6px", height: "6px", borderRadius: "50%",
                background: textAccent,
                boxShadow: `0 0 6px ${textAccent}`,
                animation: "pulse 1.5s ease-in-out infinite",
              }} />
              System Initialization
            </div>
            {/* Wordmark */}
            <div style={{
              fontSize: "22px", fontWeight: 900,
              letterSpacing: "0.18em", textTransform: "uppercase",
              color: textPrimary,
            }}>
              TECHCARE <span style={{
                background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #10b981 100%)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>SAFEGUARD</span>
            </div>
            <div style={{
              fontFamily: "'SF Mono', monospace",
              fontSize: "9px", fontWeight: 600,
              letterSpacing: "0.16em", textTransform: "uppercase",
              color: textMuted,
            }}>
              Enclave Containment Swarm v2.4
            </div>
          </div>

          {/* ── Terminal Console ── */}
          <div style={{
            width: "100%", background: consoleBg,
            border: `1px solid ${consoleBorder}`,
            borderRadius: "12px", padding: "16px 18px",
            height: "176px", overflowY: "auto",
            fontFamily: "'SF Mono', 'Menlo', 'Fira Code', 'Consolas', monospace",
            display: "flex", flexDirection: "column", gap: "8px",
            boxShadow: isDark ? "0 0 0 1px rgba(255,255,255,0.03), 0 4px 32px rgba(0,0,0,0.6)" : "0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
          }}>
            {/* Terminal header bar */}
            <div style={{
              display: "flex", alignItems: "center", gap: "6px",
              paddingBottom: "10px",
              borderBottom: `1px solid ${consoleBorder}`,
              marginBottom: "4px",
            }}>
              <span style={{
                fontFamily: "'SF Mono', monospace",
                fontSize: "8px", fontWeight: 600,
                letterSpacing: "0.1em", textTransform: "uppercase",
                color: textMuted,
              }}>boot.log</span>
            </div>
            {/* Log entries */}
            {bootLogs.map((log, idx) => {
              const isOk = log.includes("[ONLINE]") || log.includes("ready") || log.includes("successfully") || log.includes("SUCCESS") || log.includes("Found") || log.includes("Retrieved") || log.includes("verified") || log.includes("calibrated");
              const isWarn = log.includes("Warning");
              const prefix = isOk ? "✓" : isWarn ? "!" : "›";
              const prefixColor = isOk ? "#10b981" : isWarn ? "#f59e0b" : textAccent;
              const textColor = isOk ? logTextOk : logTextNormal;
              return (
                <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "10px", lineHeight: "1.6" }}>
                  <span style={{ color: prefixColor, fontWeight: 700, flexShrink: 0, minWidth: "10px" }}>{prefix}</span>
                  <span style={{ color: textColor }}>
                    {log.replace(/^(SYSTEM|SWARM|AUDIT|MEMORY|OT_BUS|CONFIG|BACKUP)\s*\[\d+\.\d+s\]\s*/, "")}
                  </span>
                </div>
              );
            })}
            <div ref={bootLogsEndRef} />
          </div>
        </div>
      </div>
    );
  }

  const SwarmGraph = () => {
    const activeAgentLog = safeGuardLogs.length > 0 ? safeGuardLogs[safeGuardLogs.length - 1].agent : "";
    
    const nodes = [
      { id: "coordinator", label: "Coordinator", name: "Coordinator Agent", x: 200, y: 55, color: "#3b82f6", short: "CO" },
      { id: "analyst", label: "Systems Analyst", name: "Systems Analyst Agent", x: 320, y: 125, color: "#f59e0b", short: "SA" },
      { id: "auditor", label: "Safety Auditor", name: "Safety Auditor Agent", x: 320, y: 245, color: "#10b981", short: "AU" },
      { id: "execution", label: "Execution Agent", name: "Execution Agent", x: 200, y: 315, color: "#8b5cf6", short: "EX" },
      { id: "forensic", label: "Forensic Investigator", name: "Forensic Investigator Agent", x: 80, y: 245, color: "#f43f5e", short: "FI" },
      { id: "curator", label: "Knowledge Curator", name: "Knowledge Curator Agent", x: 80, y: 125, color: "#06b6d4", short: "KC" },
    ];

    const links = [
      { source: "coordinator", target: "analyst", path: "M 200 55 L 320 125" },
      { source: "analyst", target: "auditor", path: "M 320 125 L 320 245" },
      { source: "auditor", target: "execution", path: "M 320 245 L 200 315" },
      { source: "execution", target: "forensic", path: "M 200 315 L 80 245" },
      { source: "forensic", target: "curator", path: "M 80 245 L 80 125" },
      { source: "curator", target: "analyst", path: "M 80 125 Q 200 125 320 125" },
      { source: "auditor", target: "analyst", path: "M 320 245 Q 360 185 320 125" },
    ];

    const isLinkActive = (source: string, target: string): boolean => {
      if (!isRunning) return false;
      if (activeAgentLog.includes("Coordinator") && source === "coordinator" && target === "analyst") return false;
      if (activeAgentLog.includes("Analyst") && source === "coordinator" && target === "analyst") return true;
      if (activeAgentLog.includes("Auditor") && source === "analyst" && target === "auditor") return true;
      if (activeAgentLog.includes("Execution") && source === "auditor" && target === "execution") return true;
      if (activeAgentLog.includes("Forensic") && source === "execution" && target === "forensic") return true;
      if (activeAgentLog.includes("Curator") && source === "forensic" && target === "curator") return true;
      if (activeAgentLog.includes("Analyst") && safeGuardLogs.some(l => l.text.includes("violat") || l.text.includes("REJECTED")) && source === "auditor" && target === "analyst") return true;
      if (activeAgentLog.includes("Analyst") && source === "curator" && target === "analyst") return true;
      return false;
    };

    const getHexagonPoints = (cx: number, cy: number, r: number): string => {
      const points = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 180) * (60 * i - 30);
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        points.push(`${x},${y}`);
      }
      return points.join(" ");
    };

    return (
      <svg viewBox="0 0 400 360" className="w-full h-full">
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        
        {/* Connections (Links) */}
        {links.map((link, idx) => {
          const active = isLinkActive(link.source, link.target);
          return (
            <g key={idx}>
              <path
                d={link.path}
                fill="none"
                stroke={active ? (link.source === "auditor" && link.target === "analyst" ? "#f59e0b" : "#3b82f6") : "#e2e8f0"}
                strokeWidth={active ? 2.5 : 1.5}
                className={`transition-colors duration-300 dark:stroke-slate-700`}
                strokeDasharray={link.source === "auditor" && link.target === "analyst" ? "4,4" : "none"}
              />
              {active && (
                <circle r="4.5" fill={link.source === "auditor" && link.target === "analyst" ? "#f59e0b" : "#60a5fa"} filter="url(#glow)">
                  <animateMotion dur="1.2s" repeatCount="indefinite" path={link.path} />
                </circle>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const active = isRunning && activeAgentLog.includes(node.label.replace(" Agent", ""));
          return (
            <g key={node.id} className="cursor-pointer group">
              {active && (
                <polygon
                  points={getHexagonPoints(node.x, node.y, 29)}
                  fill="none"
                  stroke={node.color}
                  strokeWidth="1.5"
                  opacity="0.8"
                  filter="url(#glow)"
                >
                  <animate attributeName="transform" type="scale" values="1; 1.08; 1" keyTimes="0; 0.5; 1" dur="1.5s" repeatCount="indefinite" transform-origin={`${node.x} ${node.y}`} />
                </polygon>
              )}
              
              <polygon
                points={getHexagonPoints(node.x, node.y, 23)}
                className={`transition-all duration-300 ${
                  active 
                    ? "fill-slate-100 dark:fill-slate-800" 
                    : "fill-white dark:fill-slate-900 hover:fill-slate-50 dark:hover:fill-slate-800"
                }`}
                stroke={active ? node.color : "#94a3b8"}
                strokeWidth={active ? 3 : 1.5}
                filter={active ? "url(#glow)" : "none"}
              />
              
              <text
                x={node.x}
                y={node.y + 4}
                textAnchor="middle"
                className={`text-[10px] font-mono font-black ${
                  active ? "fill-slate-900 dark:fill-white" : "fill-slate-600 dark:fill-slate-400"
                }`}
              >
                {node.short}
              </text>

              <text
                x={node.x}
                y={node.y + 36}
                textAnchor="middle"
                className={`text-[8px] font-bold tracking-tight transition-colors duration-300 ${
                  active 
                    ? "fill-blue-600 dark:fill-blue-400 font-extrabold" 
                    : "fill-slate-500 dark:fill-slate-400"
                }`}
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  const PlantLayoutMap = () => {
    const sectors = [
      {
        id: "sector-a",
        name: "Sector A: Chemical Process",
        color: "border-blue-200 dark:border-blue-900 bg-blue-50/10",
        items: ["EV Battery Vat 4", "Chemical Reactor R-202", "Cooling Tower 2"]
      },
      {
        id: "sector-b",
        name: "Sector B: Power & Utility",
        color: "border-amber-200 dark:border-amber-900 bg-amber-50/10",
        items: ["Main Generator Block A", "Boiler B-50", "Gas Flare System GF-8", "Transformer T-1"]
      },
      {
        id: "sector-c",
        name: "Sector C: Assembly & Press",
        color: "border-emerald-200 dark:border-emerald-900 bg-emerald-50/10",
        items: ["Robotic Arm 9", "Conveyor Belt 12", "Pneumatic Press 7", "Hydraulic Lift HL-3"]
      },
      {
        id: "sector-d",
        name: "Sector D: Auxiliary System",
        color: "border-cyan-200 dark:border-cyan-900 bg-cyan-50/10",
        items: ["Centrifugal Pump P-101", "Cooling Tower 1"]
      }
    ];

    const getEquipmentStatus = (name: string): "normal" | "incident" | "containing" | "secured" => {
      const equipLower = name.toLowerCase();
      const activeLower = activeEquipment ? activeEquipment.toLowerCase() : "";
      const presetLower = selectedPreset ? selectedPreset.toLowerCase() : "";
      
      const isActive = isRunning && (
        (activeLower && equipLower === activeLower) ||
        (!activeLower && equipLower === presetLower)
      );
      
      if (isActive) {
        const isContaining = executionReport || safeGuardLogs.some(
          l => l.agent.includes("Execution") || l.agent.includes("Forensic") || l.agent.includes("Curator")
        );
        return isContaining ? "containing" : "incident";
      }
      
      const isSecured = !isRunning && lastSecuredEquipment && equipLower === lastSecuredEquipment.toLowerCase();
      
      return isSecured ? "secured" : "normal";
    };

    return (
      <div className="w-full h-full grid grid-cols-2 gap-3 p-1 overflow-y-auto">
        {sectors.map((sector) => (
          <div key={sector.id} className={`border rounded-lg p-3 flex flex-col justify-between ${sector.color}`}>
            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
              {sector.name}
            </div>
            <div className="grid grid-cols-2 gap-2 flex-1">
              {sector.items.map((name) => {
                const status = getEquipmentStatus(name);
                let statusColor = "bg-slate-100 border-slate-200 dark:bg-slate-900/50 dark:border-slate-800 text-slate-500 dark:text-slate-400";
                let statusBadge = null;
                
                if (status === "incident") {
                  statusColor = "bg-red-500/10 border-red-500/40 text-red-500 dark:bg-red-950/20 dark:border-red-900/80 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.2)]";
                  statusBadge = <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping" />;
                } else if (status === "containing") {
                  statusColor = "bg-amber-500/10 border-amber-500/40 text-amber-500 dark:bg-amber-950/20 dark:border-amber-900/80 shadow-[0_0_8px_rgba(245,158,11,0.2)]";
                  statusBadge = <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />;
                } else if (status === "secured") {
                  statusColor = "bg-cyan-500/10 border-cyan-500/40 text-cyan-600 dark:text-cyan-400 dark:bg-cyan-950/20 dark:border-cyan-900/80 shadow-[0_0_8px_rgba(6,182,212,0.2)]";
                  statusBadge = <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />;
                }
                
                return (
                  <div key={name} className={`border rounded p-2 flex flex-col justify-between text-[10px] font-bold ${statusColor}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="truncate pr-1">{name}</span>
                      {statusBadge}
                    </div>
                    <div className="flex items-center justify-between mt-auto">
                      {getPresetIcon(name)}
                      <span className="text-[8px] font-extrabold uppercase opacity-85">
                        {status === "normal" && "Idle"}
                        {status === "incident" && "Alert Spike"}
                        {status === "containing" && "Isolating"}
                        {status === "secured" && "Secured"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="premium-root flex h-full w-full overflow-hidden" style={{fontFamily:"-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif",letterSpacing:'-0.01em'}}>
      {/* ---------------- SIDEBAR (SafeGuard Control Panel) ---------------- */}
      <aside className="premium-sidebar w-64 flex flex-col justify-between py-5 px-4 shrink-0 z-10">
        <div className="space-y-6 flex-1 flex flex-col overflow-hidden">
          {/* Dashboard Header */}
          <div className="flex items-center gap-2.5 px-2 mb-1">
            <div className="p-2 rounded-lg shrink-0" style={{background:'linear-gradient(135deg,#2563eb,#1d4ed8)',boxShadow:'0 2px 8px rgba(37,99,235,0.3)'}}>
              <Activity className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-[13px] truncate" style={{color:'var(--text-primary)',letterSpacing:'-0.03em'}}>
                {settings.company_name}
              </h2>
              <p className="text-[9px] font-bold uppercase tracking-[0.08em]" style={{color:'var(--text-muted)'}}>
                {settings.facility_name}
              </p>
            </div>
          </div>

          <hr className="premium-divider my-2" />

          {/* Navigation Menu */}
          <nav className="space-y-1">
            <button onClick={() => setActiveTab("control")} className={`nav-btn ${activeTab === "control" ? "active" : ""}`}>
              <Terminal className="h-3.5 w-3.5 shrink-0" />
              <span>Control Center</span>
            </button>

            <button onClick={() => setActiveTab("blueprints")} className={`nav-btn ${activeTab === "blueprints" ? "active" : ""}`}>
              <Database className="h-3.5 w-3.5 shrink-0" />
              <span>Blueprints Manager</span>
            </button>

            <button onClick={() => setActiveTab("prompts")} className={`nav-btn ${activeTab === "prompts" ? "active" : ""}`}>
              <FileCode className="h-3.5 w-3.5 shrink-0" />
              <span>Agent Prompts</span>
            </button>

            <button onClick={() => setActiveTab("history")} className={`nav-btn ${activeTab === "history" ? "active" : ""}`}>
              <History className="h-3.5 w-3.5 shrink-0" />
              <span>Incident History</span>
            </button>

            <button onClick={() => setActiveTab("settings")} className={`nav-btn ${activeTab === "settings" ? "active" : ""}`}>
              <Settings className="h-3.5 w-3.5 shrink-0" />
              <span>System Settings</span>
            </button>
          </nav>

          <hr className="premium-divider mt-3" />
        </div>
      </aside>

      {/* ---------------- MAIN CONTENT AREA ---------------- */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Workspace Toolbar & System Metrics */}
        <header className="premium-header h-16 flex items-center justify-between px-7 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <span className="font-bold text-[13px]" style={{color:'var(--text-primary)',letterSpacing:'-0.03em'}}>Operations Dashboard</span>
            {isRunning ? (
              <span className="premium-badge status-active animate-pulse">
                <Zap className="h-2.5 w-2.5" /> SafeGuard Active
              </span>
            ) : (
              <span className="premium-badge status-online">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-status" />
                Standby Ready
              </span>
            )}
          </div>

          {/* Metrics strip */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-6 divide-x divide-slate-200 dark:divide-slate-800">
              <div className="text-right">
                <div className="metric-label">Total Runs</div>
                <div className="metric-value">{metrics.total_runs}</div>
              </div>
              <div className="text-right pl-6">
                <div className="metric-label">Success Rate</div>
                <div className="metric-value">{metrics.success_rate}%</div>
              </div>
              <div className="text-right pl-6">
                <div className="metric-label">Avg Latency</div>
                <div className="metric-value">{metrics.avg_latency}s</div>
              </div>
            </div>

            {isRunning && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-bold" style={{background:'var(--bg-secondary)',border:'1px solid var(--color-border)',color:'var(--accent-blue)'}}>
                <Clock className="h-3.5 w-3.5 animate-spin" />
                <span>{elapsedTime}s</span>
              </div>
            )}
          </div>
        </header>

        {/* Dynamic Screen Tab Contents */}
        <div className="flex-1 overflow-y-auto p-7" style={{background:'var(--bg-root)'}}>
          <div className="space-y-5 pb-20">
          
          {/* TAB 1: CONTROL CENTER */}
          {activeTab === "control" && (
            <div className="space-y-6 max-w-6xl mx-auto">
              {/* Telemetry Presets Section */}
              <section className="premium-card rounded-xl2 p-6 space-y-4">
                <div>
                  <h3 className="text-[13px] font-semibold flex items-center gap-2" style={{color:'var(--text-primary)',letterSpacing:'-0.02em'}}>
                    <span className="section-header-num">1</span>
                    <span>Telemetry Alert Scenario Presets</span>
                  </h3>
                  <p className="text-[11px] mt-1 ml-7" style={{color:'var(--text-muted)'}}>
                    Click a blueprint preset to load its telemetry alert — then press <strong>Enter</strong> or the trigger button to run:
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.keys(blueprints).length === 0 ? (
                    <div className="col-span-3 text-xs text-slate-400 font-semibold text-center py-2">
                      No blueprints loaded. Add custom blueprints in the Blueprints Manager.
                    </div>
                  ) : (
                    Object.keys(blueprints).map((name) => (
                      <button
                        key={name}
                        onClick={() => selectPreset(name)}
                        disabled={isRunning}
                        className={`preset-btn ${selectedPreset === name ? "selected" : ""}`}
                      >
                        {getPresetIcon(name)}
                        <span>{name}</span>
                      </button>
                    ))
                  )}
                </div>

                {/* Textarea fields for alert text */}
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[9px] font-bold uppercase tracking-[0.08em]" style={{color:'var(--text-muted)'}}>
                      Active Telemetry Log Text:
                    </label>
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold" style={{color:'var(--text-muted)'}}>
                      <kbd className="px-1.5 py-0.5 rounded text-[9px] font-mono border" style={{background:'var(--bg-secondary)',borderColor:'var(--color-border)'}}>Enter</kbd>
                      or click button to trigger
                    </span>
                  </div>
                  <textarea
                    value={alertInput}
                    onChange={(e) => {
                      setAlertInput(e.target.value);
                      setSelectedPreset("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !isRunning && alertInput.trim()) {
                        e.preventDefault();
                        triggerSafeGuard();
                      }
                    }}
                    placeholder="Click a preset above or type your custom incident log... (Press Enter to trigger)"
                    disabled={isRunning}
                    className="w-full text-[11px] rounded-xl p-3 h-24 font-mono disabled:opacity-50 resize-none"
                    style={{background:'var(--bg-secondary)',border:'1px solid var(--color-border)',color:'var(--text-primary)'}}
                  />
                </div>

                <div className="flex justify-between items-center pt-2">
                  {/* Calibration parameters */}
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col gap-1 w-48">
                      <div className="flex justify-between text-[9px] font-bold uppercase tracking-[0.08em]" style={{color:'var(--text-muted)'}}>
                        <span>Step Delay</span>
                        <span style={{color:'var(--text-secondary)',fontWeight:800}}>{stepDelay}s</span>
                      </div>
                      <input
                        type="range"
                        min="0.0"
                        max="2.0"
                        step="0.1"
                        value={stepDelay}
                        onChange={(e) => setStepDelay(parseFloat(e.target.value))}
                        disabled={isRunning}
                        className="premium-slider"
                        style={{
                          ['--slider-fill' as any]: `${(stepDelay / 2.0) * 100}%`
                        }}
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => triggerSafeGuard()}
                    disabled={isRunning || !alertInput.trim()}
                    className="btn-primary"
                  >
                    <Play className="h-3.5 w-3.5 fill-white text-white" />
                    <span>Trigger Containment SafeGuard</span>
                  </button>
                </div>
              </section>

              {/* Industrial Telemetry Stream Simulator (OPC-UA / MQTT) */}
              <section className="premium-card rounded-xl2 p-6 space-y-4">
                <div>
                  <h3 className="text-[13px] font-semibold flex items-center gap-2" style={{color:'var(--text-primary)',letterSpacing:'-0.02em'}}>
                    <span className="section-header-num">2</span>
                    <span>Industrial Telemetry Stream Simulator (OPC-UA / MQTT)</span>
                  </h3>
                  <p className="text-[11px] mt-1 ml-7" style={{color:'var(--text-muted)'}}>
                    Adjust real-time sensor register values. Exceeding thresholds triggers a simulated alert injection.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    {
                      tag: "ns=2;s=Device.SectorA.Vat4.Pressure",
                      topic: "telemetry/sector_a/vat4/pressure",
                      name: "EV Battery Vat 4 Pressure",
                      min: 0,
                      max: 200,
                      threshold: 100,
                      unit: "PSI"
                    },
                    {
                      tag: "ns=2;s=Device.SectorB.BoilerB50.Temperature",
                      topic: "telemetry/sector_b/boiler_b50/temp",
                      name: "Steam Boiler B-50 Winding Temp",
                      min: 0,
                      max: 150,
                      threshold: 85,
                      unit: "°C"
                    },
                    {
                      tag: "ns=2;s=Device.SectorC.PneumaticPress7.Vibration",
                      topic: "telemetry/sector_c/press7/vibration",
                      name: "Pneumatic Press 7 Vibration",
                      min: 0,
                      max: 10,
                      threshold: 4.0,
                      unit: "mm/s"
                    },
                    {
                      tag: "ns=2;s=Device.SectorD.RoboticArm9.Current",
                      topic: "telemetry/sector_d/robotic_arm9/current",
                      name: "Robotic Arm 9 Torque Current",
                      min: 0,
                      max: 50,
                      threshold: 30,
                      unit: "A"
                    }
                  ].map((sensor) => {
                    const value = telemetryTags[sensor.tag] ?? sensor.min;
                    const isCritical = value > sensor.threshold;
                    return (
                      <div
                        key={sensor.tag}
                        className="premium-card p-4 transition-all"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="text-[11px] font-bold" style={{color:'var(--text-primary)'}}>{sensor.name}</h4>
                            <div className="text-[8.5px] font-mono mt-0.5" style={{color:'var(--text-muted)'}}>NodeID: <span style={{color:'var(--text-secondary)',fontWeight:700}}>{sensor.tag}</span></div>
                            <div className="text-[8px] font-mono" style={{color:'var(--text-muted)'}}>Topic: <span style={{color:'var(--text-muted)'}}>{sensor.topic}</span></div>
                          </div>
                          
                          <span className={`premium-badge ${isCritical ? "status-active" + (isCritical ? " animate-pulse" : "") : "status-online"}`}>
                            {isCritical ? "⚠ CRITICAL" : "● NORMAL"}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 mt-3">
                          <input
                            type="range"
                            min={sensor.min}
                            max={sensor.max}
                            step={sensor.min === 0 && sensor.max === 10 ? 0.1 : 1}
                            value={value}
                            disabled={isRunning}
                            onChange={(e) => {
                              const newTags = { ...telemetryTags, [sensor.tag]: parseFloat(e.target.value) };
                              setTelemetryTags(newTags);
                            }}
                            className={`premium-slider flex-1 ${isCritical ? "critical" : ""}`}
                            style={{
                              ['--slider-fill' as any]: `${((value - sensor.min) / (sensor.max - sensor.min)) * 100}%`
                            }}
                          />
                          <span className="text-[11px] font-bold min-w-[52px] text-right font-mono" style={{color:'var(--text-primary)'}}>
                            {value} {sensor.unit}
                          </span>
                        </div>

                        {isCritical && (
                          <button
                            onClick={() => {
                              const alertStr = `OPC-UA TELEMETRY ALERT: NodeID ${sensor.tag} spike detected. Current: ${value} ${sensor.unit} (Critical Threshold: ${sensor.threshold} ${sensor.unit}).`;
                              setAlertInput(alertStr);
                              setSelectedPreset(sensor.name.includes("Vat 4") ? "EV Battery Vat 4" : sensor.name.includes("Boiler") ? "Boiler B-50" : sensor.name.includes("Press 7") ? "Pneumatic Press 7" : "Robotic Arm 9");
                              setTimeout(() => { triggerSafeGuard(alertStr); }, 100);
                            }}
                            className="btn-inject-alert"
                          >
                            <ShieldAlert className="h-3 w-3" />
                            <span>Inject & Auto-Trigger SafeGuard</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* SafeGuard logs & report display */}
              <div ref={consolePanelRef} className="space-y-4">
                {/* Layout Mode Toggles */}
                <div className="flex items-center justify-between border-b border-slate-300 pb-3 mb-1 shrink-0">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setResultsView("console")}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                        resultsView === "console"
                          ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/50 shadow-sm"
                          : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 border border-transparent"
                      }`}
                    >
                      <Terminal className="h-3.5 w-3.5" />
                      <span>SafeGuard Live Console</span>
                    </button>
                    <button
                      onClick={() => setResultsView("report")}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                        resultsView === "report"
                          ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-900/50 shadow-sm"
                          : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 border border-transparent"
                      }`}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>Incident Report</span>
                    </button>
                  </div>
                  {resultsView === "report" && finalReport && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={copyToClipboard}
                        className="p-1.5 text-slate-400 hover:text-[#0b57d0] hover:bg-slate-100 rounded transition"
                        title="Copy Report text"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        onClick={downloadReport}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 rounded transition"
                        title="Download Report as PDF"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* View Rendering */}
                {resultsView === "console" ? (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[560px]">
                    {/* SVG Swarm Graph / Plant Map */}
                    <div className="lg:col-span-5 bg-white dark:bg-[#0a0e1a] border border-slate-300 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col h-full overflow-hidden">
                      <div className="flex justify-between items-center mb-3 shrink-0">
                        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 p-0.5 rounded-lg border border-slate-300 dark:border-slate-800">
                          <button
                            onClick={() => setLeftCardView("graph")}
                            className={`px-2.5 py-1 text-[9px] font-bold rounded ${
                              leftCardView === "graph"
                                ? "bg-white dark:bg-[#0f172a] text-slate-800 dark:text-slate-200 shadow-sm"
                                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-350"
                            }`}
                          >
                            Swarm Graph
                          </button>
                          <button
                            onClick={() => setLeftCardView("map")}
                            className={`px-2.5 py-1 text-[9px] font-bold rounded ${
                              leftCardView === "map"
                                ? "bg-white dark:bg-[#0f172a] text-slate-800 dark:text-slate-200 shadow-sm"
                                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-350"
                            }`}
                          >
                            Plant Layout Map
                          </button>
                        </div>
                        {isRunning && (
                          <span className="flex items-center gap-1 text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full animate-pulse dark:bg-blue-950/20 dark:border-blue-900/50">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-600"></span>
                            Active
                          </span>
                        )}
                      </div>
                      <div className="flex-1 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-900/20 flex items-center justify-center overflow-hidden p-2">
                        {leftCardView === "graph" ? <SwarmGraph /> : <PlantLayoutMap />}
                      </div>
                    </div>

                    {/* SafeGuard Console Logs */}
                    <div className="lg:col-span-7 bg-white dark:bg-[#0a0e1a] border border-slate-300 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col h-full overflow-hidden">
                      <div className="flex justify-between items-center mb-3 shrink-0">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                          SafeGuard Real-Time Audit Console
                        </h3>
                        <div className="flex items-center gap-1.5 bg-slate-100 p-0.5 rounded-lg border border-slate-300">
                          <button
                            onClick={() => setReportFontSize("sm")}
                            className={`px-2 py-0.5 text-[10px] font-bold rounded ${reportFontSize === "sm" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                            title="Small Text"
                          >
                            A-
                          </button>
                          <button
                            onClick={() => setReportFontSize("base")}
                            className={`px-2 py-0.5 text-[10px] font-bold rounded ${reportFontSize === "base" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                            title="Normal Text"
                          >
                            A
                          </button>
                          <button
                            onClick={() => setReportFontSize("lg")}
                            className={`px-2 py-0.5 text-[10px] font-bold rounded ${reportFontSize === "lg" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                            title="Large Text"
                          >
                            A+
                          </button>
                        </div>
                      </div>
                      <div className="flex-1 bg-slate-50 dark:bg-slate-900/30 border border-slate-300 dark:border-slate-800 rounded-lg p-5 overflow-y-auto space-y-3.5 font-mono">
                        {safeGuardLogs.length === 0 ? (
                          isRunning ? (
                            <div className="h-full flex flex-col items-center justify-center text-[#0b57d0] space-y-2">
                              <Loader2 className="h-8 w-8 animate-spin opacity-80" />
                              <p className="text-xs font-semibold animate-pulse">SafeGuard is active. Awaiting real-time telemetry log feed...</p>
                            </div>
                          ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                              <Terminal className="h-8 w-8 opacity-20" />
                              <p className="text-xs">SafeGuard is idle. Telemetry log stream will load here.</p>
                            </div>
                          )
                        ) : (
                          safeGuardLogs.map((log, index) => {
                            let borderClass = "border-l-2 border-l-blue-500";
                            let badgeClass = "bg-blue-50 text-blue-700 border border-blue-200/50";
                            if (log.agent.includes("Analyst")) {
                              borderClass = "border-l-2 border-l-amber-500";
                              badgeClass = "bg-amber-50 text-amber-700 border border-amber-200/50";
                            } else if (log.agent.includes("Auditor")) {
                              borderClass = "border-l-2 border-l-emerald-500";
                              badgeClass = "bg-emerald-50 text-emerald-700 border border-emerald-200/50";
                            } else if (log.agent.includes("Execution")) {
                              borderClass = "border-l-2 border-l-purple-500";
                              badgeClass = "bg-purple-50 text-purple-700 border border-purple-200/50";
                            } else if (log.agent.includes("Forensic")) {
                              borderClass = "border-l-2 border-l-rose-500";
                              badgeClass = "bg-rose-50 text-rose-700 border border-rose-200/50";
                            } else if (log.agent.includes("Curator") || log.agent.includes("Learning")) {
                              borderClass = "border-l-2 border-l-cyan-500";
                              badgeClass = "bg-cyan-50 text-cyan-700 border border-cyan-200/50";
                            }

                            return (
                              <div
                                key={index}
                                className={`bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-850 p-3 rounded-lg flex flex-col gap-1.5 shadow-sm animate-fade-in ${borderClass}`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">{log.agent}</span>
                                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${badgeClass}`}>
                                    {log.agent.includes("Coordinator") ? "Coordinator" :
                                     log.agent.includes("Analyst") ? "Analyst" :
                                     log.agent.includes("Auditor") ? "Auditor" :
                                     log.agent.includes("Execution") ? "Execution" :
                                     log.agent.includes("Forensic") ? "Forensic" : "Curator"}
                                  </span>
                                </div>
                                <p className={`text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed font-sans ${
                                  reportFontSize === "sm" ? "text-[10px]" : reportFontSize === "lg" ? "text-sm" : "text-xs"
                                }`}>
                                  {renderMarkdownText(log.text)}
                                </p>
                              </div>
                            );
                          })
                        )}
                        <div ref={logsEndRef} />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Safety Report Document - Full Width Styled like Gemini */
                  <div className="bg-white dark:bg-[#0a0e1a] border border-slate-300 dark:border-slate-800 rounded-xl p-8 shadow-sm flex flex-col min-h-[520px]">
                    <div className="flex justify-between items-center border-b border-slate-150 pb-3 mb-5 shrink-0">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Approved Mitigation Report
                      </h3>
                      <div className="flex items-center gap-1.5 bg-slate-100 p-0.5 rounded-lg border border-slate-300">
                        <button
                          onClick={() => setReportFontSize("sm")}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded ${reportFontSize === "sm" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                          title="Small Text"
                        >
                          A-
                        </button>
                        <button
                          onClick={() => setReportFontSize("base")}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded ${reportFontSize === "base" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                          title="Normal Text"
                        >
                          A
                        </button>
                        <button
                          onClick={() => setReportFontSize("lg")}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded ${reportFontSize === "lg" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                          title="Large Text"
                        >
                          A+
                        </button>
                      </div>
                    </div>
                    <div className="max-w-7xl mx-auto w-full flex-1">
                      {/* Sub-tab Navigation */}
                      {(parsedReport.safety || safetyReport || finalReport) && (
                        <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-3 mb-5 shrink-0 overflow-x-auto">
                          <button
                            onClick={() => setActiveReportSubTab("combined")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                              activeReportSubTab === "combined"
                                ? "bg-slate-150 text-slate-900 dark:bg-slate-800 dark:text-white"
                                : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900"
                            }`}
                          >
                            <LayoutGrid className="h-3.5 w-3.5" />
                            <span>Combined View</span>
                          </button>
                          <button
                            onClick={() => setActiveReportSubTab("safety")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                              activeReportSubTab === "safety"
                                ? "bg-slate-150 text-slate-900 dark:bg-slate-800 dark:text-white"
                                : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900"
                            }`}
                          >
                            <Shield className="h-3.5 w-3.5 text-[#0b57d0]" />
                            <span>Safety Plan</span>
                          </button>
                          <button
                            onClick={() => setActiveReportSubTab("execution")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                              activeReportSubTab === "execution"
                                ? "bg-slate-150 text-slate-900 dark:bg-slate-800 dark:text-white"
                                : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900"
                            }`}
                          >
                            <Activity className="h-3.5 w-3.5 text-purple-600" />
                            <span>Actuator Logs</span>
                          </button>
                          <button
                            onClick={() => setActiveReportSubTab("forensic")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                              activeReportSubTab === "forensic"
                                ? "bg-slate-150 text-slate-900 dark:bg-slate-800 dark:text-white"
                                : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900"
                            }`}
                          >
                            <Search className="h-3.5 w-3.5 text-rose-600" />
                            <span>Forensic RCA</span>
                          </button>
                          <button
                            onClick={() => setActiveReportSubTab("knowledge")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                              activeReportSubTab === "knowledge"
                                ? "bg-slate-150 text-slate-900 dark:bg-slate-800 dark:text-white"
                                : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900"
                            }`}
                          >
                            <Brain className="h-3.5 w-3.5 text-amber-600" />
                            <span>Knowledge Curator</span>
                          </button>
                        </div>
                      )}

                      {!parsedReport.safety && !safetyReport ? (
                        <div className="h-[400px] flex flex-col items-center justify-center text-slate-400 space-y-2 bg-white dark:bg-[#0a0e1a] border border-slate-300 dark:border-slate-800 rounded-xl shadow-sm">
                          <FileText className="h-8 w-8 opacity-20" />
                          <p className="text-xs">Waiting for SafeGuard Safety Auditor compliance approval...</p>
                        </div>
                      ) : (
                        <div className="text-slate-700 dark:text-slate-200 h-full">
                          {(!finalReport.includes("---") && !isRunning) ? (
                            <div className="bg-white dark:bg-[#0a0e1a] border border-slate-300 dark:border-slate-800 p-6 rounded-xl shadow-sm max-w-3xl mx-auto">
                              <div className="flex items-center gap-2 pb-3 border-b border-slate-300 dark:border-slate-800 mb-4">
                                <Shield className="h-4.5 w-4.5 text-[#0b57d0]" />
                                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">Safety Incident Report</h3>
                              </div>
                              {renderReportDocument(finalReport, activeEquipment || undefined)}
                            </div>

                          ) : (
                            <div>
                              {activeReportSubTab === "combined" && (
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                                  {/* Left Column: Safety Incident Report (Span 7) */}
                                  <div className="lg:col-span-7 bg-white dark:bg-[#0a0e1a] border border-slate-300 dark:border-slate-800 p-6 rounded-xl shadow-sm flex flex-col h-full min-h-[500px]">
                                    <div className="flex items-center justify-between pb-3 border-b border-slate-300 mb-4">
                                      <div className="flex items-center gap-2">
                                        <Shield className="h-4.5 w-4.5 text-[#0b57d0]" />
                                        <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">Safety Incident Report</h3>
                                      </div>
                                      <span className="text-[10px] bg-blue-50 text-[#0b57d0] px-2 py-0.5 rounded-full font-bold">Approved Plan</span>
                                    </div>
                                    <div className="flex-1 overflow-y-auto">
                                      {renderReportDocument(parsedReport.safety || finalReport, activeEquipment || undefined)}
                                    </div>
                                  </div>

                                  {/* Right Column: Automated SafeGuard Containment & RCA Results (Span 5) */}
                                  <div className="lg:col-span-5 flex flex-col gap-4">
                                    {/* Execution Logs Block */}
                                    <div className="bg-white dark:bg-[#0a0e1a] border border-slate-300 dark:border-slate-800 p-6 rounded-xl shadow-sm flex flex-col min-h-[160px]">
                                      <div className="flex items-center justify-between pb-2 border-b border-slate-300 mb-3">
                                        <div className="flex items-center gap-2">
                                          <Activity className="h-4.5 w-4.5 text-purple-600" />
                                          <h3 className="font-bold text-xs text-slate-800 dark:text-slate-100">SafeGuard Actuator Execution Logs</h3>
                                        </div>
                                        {parsedReport.execution ? (
                                          <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-bold">SUCCESS</span>
                                        ) : isRunning ? (
                                          <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold animate-pulse">RUNNING</span>
                                        ) : (
                                          <span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full font-bold">WAITING</span>
                                        )}
                                      </div>
                                      <div className="flex-1 overflow-y-auto max-h-[220px]">
                                        {parsedReport.execution ? (
                                          renderExecutionLogs(parsedReport.execution)
                                        ) : (
                                          <div className="flex flex-col items-center justify-center h-full text-slate-400 py-6">
                                            <Activity className="h-6 w-6 animate-pulse opacity-45 mb-2" />
                                            <p className="text-[10px]">Simulating actuator containment steps...</p>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Detective Report Block */}
                                    <div className="bg-white dark:bg-[#0a0e1a] border border-slate-300 dark:border-slate-800 p-6 rounded-xl shadow-sm flex flex-col min-h-[160px]">
                                      <div className="flex items-center justify-between pb-2 border-b border-slate-300 mb-3">
                                        <div className="flex items-center gap-2">
                                          <Search className="h-4.5 w-4.5 text-rose-600" />
                                          <h3 className="font-bold text-xs text-slate-800 dark:text-slate-100">Forensic Investigation & RCA</h3>
                                        </div>
                                        {parsedReport.detective ? (
                                          <span className="text-[10px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full font-bold">COMPLETE</span>
                                        ) : isRunning ? (
                                          <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold animate-pulse">WAITING</span>
                                        ) : (
                                          <span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full font-bold">WAITING</span>
                                        )}
                                      </div>
                                      <div className="flex-1 overflow-y-auto max-h-[220px]">
                                        {parsedReport.detective ? (
                                          renderRichPanel(parsedReport.detective)
                                        ) : (
                                          <div className="flex flex-col items-center justify-center h-full text-slate-400 py-6">
                                            <Search className="h-6 w-6 opacity-30 mb-2" />
                                            <p className="text-[10px]">Awaiting containment completion to start timeline analysis...</p>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Knowledge Curator Block */}
                                    <div className="bg-white dark:bg-[#0a0e1a] border border-slate-300 dark:border-slate-800 p-6 rounded-xl shadow-sm flex flex-col min-h-[160px]">
                                      <div className="flex items-center justify-between pb-2 border-b border-slate-300 mb-3">
                                        <div className="flex items-center gap-2">
                                          <Brain className="h-4.5 w-4.5 text-amber-600" />
                                          <h3 className="font-bold text-xs text-slate-800 dark:text-slate-100">Self-Learning Knowledge Curator</h3>
                                        </div>
                                        {parsedReport.knowledge ? (
                                          <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-bold">DB UPDATED</span>
                                        ) : isRunning ? (
                                          <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold animate-pulse">WAITING</span>
                                        ) : (
                                          <span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full font-bold">WAITING</span>
                                        )}
                                      </div>
                                      <div className="flex-1 overflow-y-auto max-h-[220px]">
                                        {parsedReport.knowledge ? (
                                          renderRichPanel(parsedReport.knowledge)
                                        ) : (
                                          <div className="flex flex-col items-center justify-center h-full text-slate-400 py-6">
                                            <Brain className="h-6 w-6 opacity-30 mb-2" />
                                            <p className="text-[10px]">Awaiting forensic RCA to optimize database specifications...</p>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {activeReportSubTab === "safety" && (
                                <div className="bg-white dark:bg-[#0a0e1a] border border-slate-300 dark:border-slate-800 p-8 rounded-xl shadow-sm w-full flex flex-col min-h-[500px]">
                                  <div className="flex items-center justify-between pb-3 border-b border-slate-300 mb-4">
                                    <div className="flex items-center gap-2">
                                      <Shield className="h-4.5 w-4.5 text-[#0b57d0]" />
                                      <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">Safety Incident Report</h3>
                                    </div>
                                    <span className="text-[10px] bg-blue-50 text-[#0b57d0] px-2 py-0.5 rounded-full font-bold">Approved Plan</span>
                                  </div>
                                  <div className="flex-1 overflow-y-auto">
                                    {renderReportDocument(parsedReport.safety || safetyReport || finalReport, activeEquipment || undefined)}
                                  </div>
                                </div>
                              )}

                              {activeReportSubTab === "execution" && (
                                <div className="bg-white dark:bg-[#0a0e1a] border border-slate-300 dark:border-slate-800 p-8 rounded-xl shadow-sm w-full flex flex-col min-h-[500px]">
                                  <div className="flex items-center justify-between pb-3 border-b border-slate-300 mb-4">
                                    <div className="flex items-center gap-2">
                                      <Activity className="h-4.5 w-4.5 text-purple-600" />
                                      <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">SafeGuard Actuator Execution Logs</h3>
                                    </div>
                                    {parsedReport.execution ? (
                                      <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-bold">SUCCESS</span>
                                    ) : (
                                      <span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full font-bold">WAITING</span>
                                    )}
                                  </div>
                                  <div className="flex-1 overflow-y-auto font-mono">
                                    {parsedReport.execution || executionReport ? (
                                      renderExecutionLogs(parsedReport.execution || executionReport)
                                    ) : (
                                      <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
                                        <Activity className="h-10 w-10 animate-pulse opacity-45 mb-2" />
                                        <p className="text-xs">No execution logs available yet.</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {activeReportSubTab === "forensic" && (
                                <div className="bg-white dark:bg-[#0a0e1a] border border-slate-300 dark:border-slate-800 p-8 rounded-xl shadow-sm w-full flex flex-col min-h-[500px]">
                                  <div className="flex items-center justify-between pb-3 border-b border-slate-300 mb-4">
                                    <div className="flex items-center gap-2">
                                      <Search className="h-4.5 w-4.5 text-rose-600" />
                                      <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">Forensic Investigation & RCA</h3>
                                    </div>
                                    {parsedReport.detective ? (
                                      <span className="text-[10px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full font-bold">COMPLETE</span>
                                    ) : (
                                      <span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full font-bold">WAITING</span>
                                    )}
                                  </div>
                                  <div className="flex-1 overflow-y-auto">
                                    {parsedReport.detective || detectiveReport ? (
                                      renderRichPanel(parsedReport.detective || detectiveReport)
                                    ) : (
                                      <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
                                        <Search className="h-10 w-10 opacity-30 mb-2" />
                                        <p className="text-xs">No forensic RCA report available yet.</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {activeReportSubTab === "knowledge" && (
                                <div className="bg-white dark:bg-[#0a0e1a] border border-slate-300 dark:border-slate-800 p-8 rounded-xl shadow-sm w-full flex flex-col min-h-[500px]">
                                  <div className="flex items-center justify-between pb-3 border-b border-slate-300 mb-4">
                                    <div className="flex items-center gap-2">
                                      <Brain className="h-4.5 w-4.5 text-amber-600" />
                                      <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">Self-Learning Knowledge Curator</h3>
                                    </div>
                                    {parsedReport.knowledge ? (
                                      <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-bold">DB UPDATED</span>
                                    ) : (
                                      <span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full font-bold">WAITING</span>
                                    )}
                                  </div>
                                  <div className="flex-1 overflow-y-auto">
                                    {parsedReport.knowledge || knowledgeReport ? (
                                      renderRichPanel(parsedReport.knowledge || knowledgeReport)
                                    ) : (
                                      <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
                                        <Brain className="h-10 w-10 opacity-30 mb-2" />
                                        <p className="text-xs">No knowledge curator updates available yet.</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Error notifications */}
              {errorMsg && (
                <div className="flex gap-3 bg-red-950/20 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs">
                  <ShieldAlert className="h-5 w-5 text-red-500 shrink-0" />
                  <div>
                    <span className="font-bold uppercase tracking-wider">Error Details:</span> {errorMsg}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: BLUEPRINTS MANAGER (KNOWLEDGE BASE EDITOR) */}
          {activeTab === "blueprints" && (
            <div className="max-w-5xl mx-auto bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
              <div className="flex justify-between items-start border-b border-slate-300 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <span>Equipment Blueprint Registry</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Define hardware thresholds, OPC-UA node IDs, and safety procedures for each asset. The <strong>Systems Analyst Agent</strong> reads these specs during every incident run.
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={startNetworkScan}
                    className="flex items-center gap-1.5 text-xs font-bold bg-purple-50 dark:bg-purple-950/20 border border-purple-300 dark:border-purple-900/40 text-purple-700 dark:text-purple-300 py-2 px-4 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition shadow-sm"
                  >
                    <Radio className="h-4 w-4" />
                    <span>Scan Factory Network</span>
                  </button>
                  <button
                    onClick={() => setShowAddBlueprint(!showAddBlueprint)}
                    className="flex items-center gap-1.5 text-xs font-bold bg-[#1a73e8] dark:bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-[#1557b0] dark:hover:bg-blue-700 transition shadow-sm"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Blueprint</span>
                  </button>
                </div>
              </div>

              {/* Add blueprint form */}
              {showAddBlueprint && (
                <form onSubmit={addBlueprintSpec} className="bg-blue-50 dark:bg-blue-950/10 border border-blue-200 dark:border-blue-900/30 p-5 rounded-xl space-y-4 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider">Register New Equipment Blueprint</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-1 space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">Equipment Name *</label>
                        <input
                          type="text"
                          value={newBlueprintName}
                          onChange={(e) => setNewBlueprintName(e.target.value)}
                          placeholder="e.g. Mixing Vat 5"
                          required
                          className="w-full text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg p-3 space-y-1">
                        <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Spec Format Guide</p>
                        <p className="text-[10px] text-slate-600 dark:text-slate-450 font-mono leading-relaxed">
                          TARGET: Vat 5<br/>
                          OPC-UA: ns=2;s=Device.Vat5<br/>
                          CRITICAL: temp &gt; 180°C<br/>
                          ACTIONS: Reduce speed 50%<br/>
                          HAZARDS: Thermal runaway<br/>
                          PPE: Heat gloves, face shield
                        </p>
                      </div>
                    </div>
                    <div className="md:col-span-2 space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">Threshold Specifications & Safety Procedures *</label>
                      <textarea
                        value={newBlueprintSpec}
                        onChange={(e) => setNewBlueprintSpec(e.target.value)}
                        placeholder={`TARGET: Mixing Vat 5\nOPC-UA NodeID: ns=2;s=Device.SectorA.Vat5\nCRITICAL THRESHOLD: Temperature > 180°C\nWARNING THRESHOLD: Temperature > 140°C\nCONTAINMENT ACTIONS:\n- Reduce mixing speed by 50%\n- Activate coolant bypass valve CV-05\n- Isolate power supply (LOTO procedure)\nHAZARDS: Thermal runaway, electrical shock\nPPE REQUIRED: Heat-resistant gloves, face shield, insulated boots`}
                        required
                        className="w-full text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-lg py-2 px-3 h-40 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono leading-relaxed"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowAddBlueprint(false)}
                      className="text-xs font-semibold text-slate-600 dark:text-slate-350 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 py-1.5 px-4 rounded-lg transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="text-xs font-bold bg-[#1a73e8] dark:bg-blue-600 hover:bg-[#1557b0] dark:hover:bg-blue-700 text-white py-1.5 px-5 rounded-lg transition shadow-sm"
                    >
                      Register Blueprint
                    </button>
                  </div>
                </form>
              )}

              {/* Main Directory Layout */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Left side: list of equipment */}
                <div className="md:col-span-3 space-y-2 border-r border-slate-300 dark:border-slate-800 pr-6 max-h-96 overflow-y-auto">
                  {Object.keys(blueprints).map((name) => (
                    <button
                      key={name}
                      onClick={() => {
                        setSelectedBlueprint(name);
                        setBlueprintSpec(blueprints[name]);
                      }}
                      className={`w-full flex items-center justify-between p-3 rounded-lg text-xs font-semibold border transition text-left ${
                        selectedBlueprint === name
                          ? "bg-blue-50/80 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/50 text-blue-700 dark:text-blue-300 shadow-sm"
                          : "bg-slate-50/50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800/80 text-slate-700 dark:text-slate-350 hover:bg-slate-100/80 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {getPresetIcon(name)}
                        <span>{name}</span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Right side: details, edit and inspector */}
                {selectedBlueprint ? (
                  <>
                    <div className="md:col-span-6 flex flex-col gap-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Configure Specification Profile: <span className="text-blue-600 dark:text-blue-400 font-extrabold">{selectedBlueprint}</span>
                        </span>
                        <button
                          onClick={deleteBlueprintSpec}
                          className="flex items-center gap-1 text-[10px] font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 hover:border-red-200 dark:hover:border-red-900/40 border border-transparent py-1 px-2 rounded-lg transition"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>Delete</span>
                        </button>
                      </div>

                      <textarea
                        value={blueprintSpec}
                        onChange={(e) => setBlueprintSpec(e.target.value)}
                        className="w-full text-xs font-mono border border-slate-300 dark:border-slate-850 bg-slate-50 dark:bg-slate-950 rounded-lg p-4 h-64 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-200 leading-relaxed"
                      />

                      <div className="flex justify-end pt-2">
                        <button
                          onClick={saveBlueprintSpec}
                          className="text-xs font-bold bg-[#1a73e8] dark:bg-blue-600 hover:bg-[#1557b0] dark:hover:bg-blue-700 text-white py-2 px-6 rounded-lg transition shadow-sm"
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>

                    {/* Right column: Safety Profile Inspector */}
                    <div className="md:col-span-3 flex flex-col gap-3">
                      <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-250 dark:border-slate-800 space-y-4">
                        <h4 className="text-[10px] font-bold text-slate-650 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 pb-2">
                          Safety Profile Inspector
                        </h4>
                        
                        {(() => {
                          const parsed = parseBlueprintSpec(blueprintSpec);
                          return (
                            <div className="space-y-3.5 text-[11px]">
                              <div>
                                <span className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Parsed Target</span>
                                <span className="font-semibold text-slate-855 dark:text-slate-200">{parsed.target}</span>
                              </div>
                              
                              <div>
                                <span className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Critical Threshold</span>
                                <span className="font-mono text-slate-855 dark:text-slate-200">{parsed.threshold}</span>
                              </div>

                              <div>
                                <span className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Lockout/Tagout (LOTO)</span>
                                {parsed.hasLoto ? (
                                  <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                                    ✅ Defined
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] text-amber-600 dark:text-amber-500 font-bold">
                                    ⚠️ Not Explicit
                                  </span>
                                )}
                              </div>

                              <div>
                                <span className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">PPE Requirements</span>
                                {parsed.hasPpe ? (
                                  <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                                    ✅ Defined
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] text-amber-600 dark:text-amber-500 font-bold">
                                    ⚠️ Not Explicit
                                  </span>
                                )}
                              </div>

                              <div>
                                <span className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Containment Steps ({parsed.actions.length})</span>
                                {parsed.actions.length > 0 ? (
                                  <ol className="list-decimal list-inside space-y-1 mt-1 text-slate-650 dark:text-slate-400 font-sans leading-relaxed">
                                    {parsed.actions.slice(0, 3).map((act, idx) => (
                                      <li key={idx} className="truncate" title={act}>{act}</li>
                                    ))}
                                    {parsed.actions.length > 3 && (
                                      <li className="text-[9px] text-slate-400 italic">+{parsed.actions.length - 3} more steps</li>
                                    )}
                                  </ol>
                                ) : (
                                  <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] text-red-655 dark:text-red-500 font-bold font-sans">
                                    ❌ No steps parsed
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="md:col-span-9 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 py-16">
                    <Database className="h-10 w-10 text-slate-300 dark:text-slate-700 mb-2" />
                    <p className="text-xs">Select a blueprint from the list to view or edit specs.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: AGENT PROMPTS EDITOR */}
          {activeTab === "prompts" && (
            <div className="max-w-5xl mx-auto bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
              <div className="flex justify-between items-start border-b border-slate-300 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <FileCode className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <span>Agent System Prompt Editor</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Edit the system instructions loaded by each agent before every Groq LLM call. Changes take effect on the next trigger run.
                  </p>
                </div>
                {/* Validation Status */}
                <div className="flex items-center gap-2 shrink-0">
                  {(() => {
                    const validation = validateHeaders();
                    if (validation.valid) {
                      return (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 border border-[#a7f3d0] dark:border-emerald-900/40 px-3 py-1 rounded-full">
                          <CheckCircle className="h-3.5 w-3.5" />
                          <span>All 6 Agents Valid</span>
                        </span>
                      );
                    } else {
                      return (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 px-3 py-1 rounded-full" title={`Missing: ${validation.missing.join(', ')}`}>
                          <XCircle className="h-3.5 w-3.5" />
                          <span>Missing {validation.missing.length} Sections</span>
                        </span>
                      );
                    }
                  })()}
                </div>
              </div>

              {/* Backup History Row */}
              <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800/80 rounded-xl px-4 py-3">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase whitespace-nowrap">Rollback to backup:</span>
                <select
                  value={selectedBackup}
                  onChange={(e) => setSelectedBackup(e.target.value)}
                  className="text-xs p-1.5 border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-250 rounded-lg flex-1 max-w-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {promptBackups.length === 0 ? (
                    <option value="">No backups yet — save once to create one</option>
                  ) : (
                    promptBackups.map((b) => (
                      <option key={b.filename} value={b.filename}>
                        {b.timestamp}
                      </option>
                    ))
                  )}
                </select>
                <button
                  onClick={rollbackPrompts}
                  disabled={!selectedBackup || promptBackups.length === 0}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/30 py-1.5 px-4 rounded-lg transition disabled:opacity-50 bg-white dark:bg-slate-950"
                >
                  Rollback
                </button>
              </div>

              {/* Agent Prompt Cards */}
              <div className="space-y-4">
                {([
                  { key: "coordinator", label: "1 · Coordinator", color: "blue", desc: "Routes the alert, identifies the equipment, and orchestrates the agent pipeline." },
                  { key: "analyst",     label: "2 · Systems Analyst", color: "yellow", desc: "Reads the blueprint spec, diagnoses the fault, and drafts the containment plan." },
                  { key: "auditor",     label: "3 · Safety Auditor", color: "emerald", desc: "Reviews the plan for compliance, generates the structured incident report with all sections." },
                  { key: "execution",   label: "4 · Execution Agent", color: "purple", desc: "Simulates actuator commands (OPC-UA writes, MQTT publishes) and logs results." },
                  { key: "forensic",    label: "5 · Forensic Investigator", color: "rose", desc: "Performs root cause analysis, builds incident timeline, and classifies failure mode." },
                  { key: "curator",     label: "6 · Knowledge Curator", color: "cyan", desc: "Extracts learnings and updates the self-learning knowledge base for future incidents." },
                ] as const).map(({ key, label, color, desc }) => {
                  const agentBadgeColors = {
                    coordinator: "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900/50",
                    analyst: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-350 border-amber-200 dark:border-amber-900/50",
                    auditor: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50",
                    execution: "bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-900/50",
                    forensic: "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/50",
                    curator: "bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-900/50"
                  };
                  const agentCardStyles = {
                    coordinator: "border-blue-200/80 dark:border-blue-900/35 bg-gradient-to-br from-blue-50/10 via-transparent to-transparent dark:from-blue-950/5 dark:via-transparent dark:to-transparent hover:border-blue-300/80 dark:hover:border-blue-800/40",
                    analyst: "border-amber-200/80 dark:border-amber-900/35 bg-gradient-to-br from-amber-50/10 via-transparent to-transparent dark:from-amber-950/5 dark:via-transparent dark:to-transparent hover:border-amber-300/80 dark:hover:border-amber-800/40",
                    auditor: "border-emerald-200/80 dark:border-emerald-900/35 bg-gradient-to-br from-emerald-50/10 via-transparent to-transparent dark:from-emerald-950/5 dark:via-transparent dark:to-transparent hover:border-emerald-300/80 dark:hover:border-emerald-800/40",
                    execution: "border-purple-200/80 dark:border-purple-900/35 bg-gradient-to-br from-purple-50/10 via-transparent to-transparent dark:from-purple-950/5 dark:via-transparent dark:to-transparent hover:border-purple-300/80 dark:hover:border-purple-800/40",
                    forensic: "border-rose-200/80 dark:border-rose-900/35 bg-gradient-to-br from-rose-50/10 via-transparent to-transparent dark:from-rose-950/5 dark:via-transparent dark:to-transparent hover:border-rose-300/80 dark:hover:border-rose-800/40",
                    curator: "border-cyan-200/80 dark:border-cyan-900/35 bg-gradient-to-br from-cyan-50/10 via-transparent to-transparent dark:from-cyan-950/5 dark:via-transparent dark:to-transparent hover:border-cyan-300/80 dark:hover:border-cyan-800/40"
                  };
                  const agentTextareaFocus = {
                    coordinator: "focus:ring-blue-500/50 focus:border-blue-500",
                    analyst: "focus:ring-amber-500/50 focus:border-amber-500",
                    auditor: "focus:ring-emerald-500/50 focus:border-emerald-500",
                    execution: "focus:ring-purple-500/50 focus:border-purple-500",
                    forensic: "focus:ring-rose-500/50 focus:border-rose-500",
                    curator: "focus:ring-cyan-500/50 focus:border-cyan-500"
                  };
                  return (
                    <div key={key} className={`space-y-2 border rounded-xl p-4 transition duration-200 shadow-sm ${agentCardStyles[key]}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className={`inline-block text-[10px] font-bold px-3 py-1 border rounded-full mb-1 ${agentBadgeColors[key]}`}>
                            {label}
                          </span>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 ml-1">{desc}</p>
                        </div>
                      </div>
                      <textarea
                        value={prompts[key]}
                        onChange={(e) => setPrompts({ ...prompts, [key]: e.target.value })}
                        className={`w-full text-xs font-mono border border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 rounded-lg p-3.5 h-32 focus:outline-none focus:ring-2 ${agentTextareaFocus[key]} text-slate-800 dark:text-slate-200 leading-relaxed transition`}
                      />
                      {(() => {
                        const validation = validatePromptIntegrity(key, prompts[key]);
                        return (
                          <div className={`mt-2 flex items-center justify-between text-[10px] font-bold px-3 py-1.5 rounded-lg border ${
                            validation.passed
                              ? "text-emerald-700 dark:text-emerald-350 bg-emerald-50 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-900/30"
                              : "text-amber-700 dark:text-amber-350 bg-amber-50 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900/30"
                          }`}>
                            <div className="flex items-center gap-1.5">
                              {validation.passed ? (
                                <>
                                  <CheckCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                  <span>Swarm Routing Integrity Check: PASS</span>
                                </>
                              ) : (
                                <>
                                  <ShieldAlert className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                                  <span>Swarm Routing Integrity Check: WARNING</span>
                                </>
                              )}
                            </div>
                            {!validation.passed && (
                              <span className="font-medium text-slate-500 dark:text-slate-400">
                                {validation.warnings[0]}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end border-t border-slate-300 dark:border-slate-800 pt-4">
                <button
                  onClick={saveAgentPrompts}
                  disabled={isSavingPrompts}
                  className="text-xs font-bold bg-[#1a73e8] dark:bg-blue-600 hover:bg-[#1557b0] dark:hover:bg-blue-700 text-white py-2.5 px-8 rounded-lg transition shadow-sm disabled:opacity-50"
                >
                  {isSavingPrompts ? "Saving..." : "Save All Agent Instructions"}
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: INCIDENT HISTORY LOGS */}
          {activeTab === "history" && (
            <div className="max-w-5xl mx-auto bg-white dark:bg-[#0a0e1a] border border-slate-300 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 border-b border-slate-300 pb-4">
                  <History className="h-5 w-5 text-blue-600" />
                  <span>Audit Trail & Historical Telemetry Logs</span>
                </h3>
                <p className="text-xs text-slate-500 mt-2">
                  Browse and audit past SafeGuard emergency executions saved securely in the backend logs:
                </p>
              </div>

              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-slate-400 py-20">
                  <History className="h-12 w-12 text-slate-300 mb-2" />
                  <p className="text-xs">No historical records logged yet. Trigger some telemetry runs.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Table list of history */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-300 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                          <th className="pb-3 pr-4">Room/Run ID</th>
                          <th className="pb-3 pr-4">Timestamp</th>
                          <th className="pb-3 pr-4">Target System</th>
                          <th className="pb-3 pr-4">Status</th>
                          <th className="pb-3 pr-4">Latency</th>
                          <th className="pb-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {history.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50 transition">
                            <td className="py-3.5 pr-4 font-mono font-bold text-slate-600">{item.id}</td>
                            <td className="py-3.5 pr-4 text-slate-600">
                              {new Date(item.timestamp).toLocaleString()}
                            </td>
                            <td className="py-3.5 pr-4 font-semibold text-slate-800">{item.equipment}</td>
                            <td className="py-3.5 pr-4">
                              {item.status === "success" ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold">
                                  SUCCESS
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 text-[9px] font-bold">
                                  FAILED
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 pr-4 font-bold text-slate-700">{item.latency}s</td>
                            <td className="py-3.5 text-right">
                              <button
                                onClick={() => {
                                  setSelectedHistoryItem(item);
                                  setActiveHistoryReportSubTab("safety");
                                }}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:bg-blue-50 py-1.5 px-3 rounded-lg border border-blue-200 transition"
                              >
                                <Eye className="h-3 w-3" />
                                <span>Inspect Audit</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* History details Modal / Overlay */}
              {selectedHistoryItem && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-white dark:bg-[#0a0e1a] border border-slate-300 dark:border-slate-800 rounded-xl w-full max-w-6xl max-h-[85vh] overflow-hidden flex flex-col shadow-xl animate-fade-in">
                    {/* Modal header */}
                    <div className="flex justify-between items-center p-5 border-b border-slate-300 bg-slate-50">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-sm text-slate-800 font-mono">Run ID: {selectedHistoryItem.id}</span>
                        <span className="text-xs text-slate-500">
                          {new Date(selectedHistoryItem.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const equipment = selectedHistoryItem.equipment || "Equipment";
                            const ts = new Date(selectedHistoryItem.timestamp).toLocaleString();
                            generatePDF(selectedHistoryItem.report || "", equipment, ts);
                          }}
                          className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-700 hover:bg-emerald-50 py-1 px-3 rounded-lg border border-emerald-200 transition"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>Export PDF</span>
                        </button>
                        <button
                          onClick={() => setSelectedHistoryItem(null)}
                          className="text-xs font-semibold text-slate-500 hover:text-slate-800 py-1 px-3 rounded-lg hover:bg-slate-100 transition"
                        >
                          Close
                        </button>
                      </div>
                    </div>

                    {/* Modal body */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-slate-50 border border-slate-300 p-4 rounded-lg text-xs space-y-1">
                          <div className="font-bold text-slate-400 uppercase text-[9px]">Target Machine</div>
                          <div className="font-bold text-slate-800 text-sm">{selectedHistoryItem.equipment}</div>
                        </div>
                        <div className="bg-slate-50 border border-slate-300 p-4 rounded-lg text-xs space-y-1">
                          <div className="font-bold text-slate-400 uppercase text-[9px]">SafeGuard Latency</div>
                          <div className="font-bold text-slate-800 text-sm">{selectedHistoryItem.latency}s</div>
                        </div>
                        <div className="bg-slate-50 border border-slate-300 p-4 rounded-lg text-xs space-y-1">
                          <div className="font-bold text-slate-400 uppercase text-[9px]">Execution Status</div>
                          <div>
                            {selectedHistoryItem.status === "success" ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">SUCCESS</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold">FAILED</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Raw input details */}
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Alert Input Warning Log:</div>
                        <div className="bg-slate-50 border border-slate-300 p-4 rounded-lg text-xs font-mono text-slate-700">
                          {selectedHistoryItem.alert_text}
                        </div>
                      </div>

                      {/* Event steps */}
                      <div className="space-y-2">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SafeGuard Conversation Logs:</div>
                        <div className="space-y-2 bg-slate-50 p-4 rounded-lg border border-slate-300 max-h-48 overflow-y-auto font-mono text-xs">
                          {selectedHistoryItem.logs.map((log: any, idx: number) => (
                            <div key={idx} className="border-b border-slate-100 pb-2 last:border-b-0 text-slate-700">
                              <span className="font-bold text-blue-600">[{log.agent}]: </span>
                              <span>{renderMarkdownText(log.text)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Audit report details */}
                      <div className="space-y-2">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SafeGuard Reports & Containment Results:</div>
                        {!selectedHistoryItem.report ? (
                          <div className="bg-slate-50 border border-slate-350 p-5 rounded-lg text-xs text-slate-400 text-center py-8">
                            No report available.
                          </div>
                        ) : !selectedHistoryItem.report.includes("---") ? (
                          <div className="bg-slate-50 border border-slate-300 p-6 rounded-lg text-xs font-sans leading-relaxed text-slate-700 whitespace-pre-wrap max-h-96 overflow-y-auto">
                            {renderReportDocument(selectedHistoryItem.report, selectedHistoryItem.equipment)}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                            {/* Left Column: Safety Incident Report (Span 7) */}
                            <div className="lg:col-span-7 bg-slate-50 border border-slate-300 p-6 rounded-lg flex flex-col min-h-[300px] max-h-[500px] overflow-y-auto shadow-sm">
                              <div className="flex items-center justify-between pb-2 border-b border-slate-300 mb-4">
                                <div className="flex items-center gap-2">
                                  <Shield className="h-4.5 w-4.5 text-[#0b57d0]" />
                                  <h4 className="font-bold text-xs text-slate-800">Safety Incident Report</h4>
                                </div>
                                <span className="text-[10px] bg-blue-50 text-[#0b57d0] px-2 py-0.5 rounded-full font-bold">Approved</span>
                              </div>
                              <div className="flex-1">
                                {renderReportDocument(parsedHistoryReport?.safety || selectedHistoryItem.report, selectedHistoryItem.equipment)}
                              </div>
                            </div>

                            {/* Right Column: stacked logs and reports (Span 5) */}
                            <div className="lg:col-span-5 flex flex-col gap-4">
                              {/* Execution Logs */}
                              {parsedHistoryReport?.execution && (
                                <div className="bg-slate-50 border border-slate-300 p-6 rounded-lg flex flex-col shadow-sm">
                                  <div className="flex items-center gap-2 pb-2 border-b border-slate-300 mb-3">
                                    <Activity className="h-4.5 w-4.5 text-purple-600" />
                                    <h4 className="font-bold text-xs text-slate-800 font-sans">Execution Logs</h4>
                                  </div>
                                  <div className="max-h-40 overflow-y-auto bg-slate-900 p-3 rounded-lg border border-slate-850 shadow-inner">
                                    {renderExecutionLogs(parsedHistoryReport.execution)}
                                  </div>
                                </div>
                              )}

                              {/* Detective Report */}
                              {parsedHistoryReport?.detective && (
                                <div className="bg-slate-50 border border-slate-300 p-6 rounded-lg flex flex-col max-h-[250px] overflow-y-auto shadow-sm">
                                  <div className="flex items-center gap-2 pb-2 border-b border-slate-300 mb-3">
                                    <Search className="h-4.5 w-4.5 text-rose-600" />
                                    <h4 className="font-bold text-xs text-slate-800 font-sans">Root Cause Analysis (RCA)</h4>
                                  </div>
                                  <div>
                                    {renderRichPanel(parsedHistoryReport.detective)}
                                  </div>
                                </div>
                              )}

                              {/* Knowledge Update */}
                              {parsedHistoryReport?.knowledge && (
                                <div className="bg-slate-50 border border-slate-300 p-6 rounded-lg flex flex-col max-h-[250px] overflow-y-auto shadow-sm">
                                  <div className="flex items-center gap-2 pb-2 border-b border-slate-300 mb-3">
                                    <Brain className="h-4.5 w-4.5 text-amber-600" />
                                    <h4 className="font-bold text-xs text-slate-800 font-sans">Knowledge Curator updates</h4>
                                  </div>
                                  <div>
                                    {renderRichPanel(parsedHistoryReport.knowledge)}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Network Scanner Modal / Overlay */}
              {showScanModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-white dark:bg-[#0a0e1a] border border-slate-300 dark:border-slate-800 rounded-xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-xl animate-fade-in">
                    {/* Modal header */}
                    <div className="flex justify-between items-center p-5 border-b border-slate-300 bg-slate-50">
                      <div className="flex items-center gap-3">
                        <Radio className="h-5 w-5 text-purple-600 animate-pulse" />
                        <span className="font-bold text-sm text-slate-850">Active Network Scanner & Auto-Ingestion</span>
                      </div>
                      <div>
                        <button
                          onClick={() => {
                            if (!isScanningNetwork) setShowScanModal(false);
                          }}
                          disabled={isScanningNetwork}
                          className="text-xs font-semibold text-slate-500 hover:text-slate-800 py-1 px-3 rounded-lg hover:bg-slate-100 transition disabled:opacity-50"
                        >
                          Close
                        </button>
                      </div>
                    </div>

                    {/* Modal body */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      {/* Scanner Progress / Animation */}
                      <div className="flex flex-col items-center justify-center py-6 bg-slate-50 rounded-lg border border-slate-300 space-y-4">
                        {isScanningNetwork ? (
                          <>
                            <div className="relative">
                              <div className="h-16 w-16 rounded-full border-2 border-purple-200 border-t-purple-600 animate-spin"></div>
                              <Radio className="absolute inset-0 m-auto h-6 w-6 text-purple-600 animate-ping" />
                            </div>
                            <div className="text-center space-y-1">
                              <div className="text-sm font-bold text-slate-800">Scanning Factory Network...</div>
                              <div className="text-xs text-purple-700 animate-pulse">Querying SNMP, Modbus, and OPC UA agents</div>
                            </div>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-16 w-16 text-emerald-600" />
                            <div className="text-center space-y-1">
                              <div className="text-sm font-bold text-slate-800">Network Scan Completed!</div>
                              <div className="text-xs text-emerald-700 font-semibold">Successfully scanned and updated equipment directory.</div>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Live scanning logs */}
                      <div className="space-y-2">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Scan Event Logs:</div>
                        <div className="bg-slate-50 border border-slate-300 p-4 rounded-lg text-xs font-mono text-slate-700 max-h-48 overflow-y-auto space-y-1.5">
                          {scanLogs.length === 0 ? (
                            <div className="text-slate-400 italic">Initializing scanner...</div>
                          ) : (
                            scanLogs.map((log, idx) => (
                              <div key={idx} className="flex gap-2">
                                <span className="text-purple-700 font-bold font-sans">[{log.agent}]:</span>
                                <span>{renderMarkdownText(log.text)}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Discovered devices results table */}
                      {scanResults.length > 0 && (
                        <div className="space-y-2 animate-fade-in">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Discovered Network Assets ({scanResults.length}):</div>
                          <div className="overflow-hidden border border-slate-300 rounded-lg bg-slate-50">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="border-b border-slate-300 bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                                  <th className="py-2.5 px-4">IP Address</th>
                                  <th className="py-2.5 px-4">Equipment / Model</th>
                                  <th className="py-2.5 px-4">Status</th>
                                  <th className="py-2.5 px-4">Ingestion Source / Details</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 text-slate-700 font-mono">
                                {scanResults.map((res, idx) => (
                                  <tr key={idx} className="hover:bg-slate-100/50 transition">
                                    <td className="py-2.5 px-4 text-purple-700 font-bold">{res.ip}</td>
                                    <td className="py-2.5 px-4 font-sans font-bold text-slate-800">{res.name}</td>
                                    <td className="py-2.5 px-4">
                                      {res.status === "Ingested" && (
                                        <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold">INGESTED</span>
                                      )}
                                      {res.status === "Already Active" && (
                                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">ACTIVE</span>
                                      )}
                                      {res.status === "Failed" && (
                                        <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold">FAILED</span>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-4 font-sans text-xs text-slate-500">{res.details}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: SYSTEM SETTINGS */}
          {activeTab === "settings" && (
            <div className="max-w-5xl mx-auto bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-8">
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-300 dark:border-slate-800 pb-4">
                  <Settings className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <span>Global System Settings & Enclave Calibration</span>
                </h3>
                <p className="text-xs text-slate-500 mt-2">
                  Configure safety company profiles, toggle dark mode, select model routings, adjust temperatures, and monitor swarm API cost metrics:
                </p>
              </div>

              {/* Theme & Profile Split */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Section A: Profile & Theme */}
                <div className="space-y-6">
                  <div className="bg-slate-50 dark:bg-slate-950 p-5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 pb-2">
                      Company Profile
                    </h4>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Company Name</label>
                        <input
                          type="text"
                          value={settings.company_name}
                          onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                          className="w-full text-xs p-2.5 bg-white dark:bg-slate-900 border border-slate-350 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-150 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Containment Facility Site</label>
                        <input
                          type="text"
                          value={settings.facility_name}
                          onChange={(e) => setSettings({ ...settings, facility_name: e.target.value })}
                          className="w-full text-xs p-2.5 bg-white dark:bg-slate-900 border border-slate-350 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-150 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Safety Officer Email</label>
                        <input
                          type="email"
                          value={settings.safety_officer_email}
                          onChange={(e) => setSettings({ ...settings, safety_officer_email: e.target.value })}
                          className="w-full text-xs p-2.5 bg-white dark:bg-slate-900 border border-slate-350 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-150 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <button
                      onClick={saveSettings}
                      disabled={isSavingSettings}
                      className="w-full text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition disabled:opacity-50"
                    >
                      {isSavingSettings ? "Saving Settings..." : "Save Profile Details"}
                    </button>
                  </div>

                  {/* Theme Switcher Card */}
                  <div className="bg-slate-50 dark:bg-slate-950 p-5 rounded-xl border border-slate-200 dark:border-slate-800 flex justify-between items-center">
                    <div>
                      <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">Interface Theme Settings</h4>
                      <p className="text-[10px] text-slate-500">Toggle dark visual mode persisted in settings database.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={settings.dark_mode}
                        onChange={(e) => toggleDarkMode(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {/* Hackathon Features Configuration */}
                  <div className="bg-slate-50 dark:bg-slate-950 p-5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 pb-2">
                      Hackathon Safety & Air-Gap Config
                    </h4>
                    
                    <div className="space-y-4">
                      {/* Strict Airgap */}
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Strict Air-Gapped Mode</span>
                          <p className="text-[9px] text-slate-500">Bypass Groq failover if local Ollama fails, forcing local response.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={settings.strict_airgap ?? false}
                            onChange={(e) => setSettings({ ...settings, strict_airgap: e.target.checked })}
                            className="rounded border-slate-350 text-blue-600 focus:ring-blue-500 h-4 w-4 bg-white dark:bg-slate-900"
                          />
                        </label>
                      </div>

                      {/* HITL */}
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Human-in-the-Loop Gate</span>
                          <p className="text-[9px] text-slate-500">Wait for manual approval before executing containment actuators.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={settings.enable_hitl ?? true}
                            onChange={(e) => setSettings({ ...settings, enable_hitl: e.target.checked })}
                            className="rounded border-slate-350 text-blue-600 focus:ring-blue-500 h-4 w-4 bg-white dark:bg-slate-900"
                          />
                        </label>
                      </div>

                      {/* Fallback */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Deterministic Safety Fallback</span>
                            <p className="text-[9px] text-slate-500">Trigger hardcoded database safety procedures if agents time out.</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={settings.enable_deterministic_fallback ?? true}
                              onChange={(e) => setSettings({ ...settings, enable_deterministic_fallback: e.target.checked })}
                              className="rounded border-slate-350 text-blue-600 focus:ring-blue-500 h-4 w-4 bg-white dark:bg-slate-900"
                            />
                          </label>
                        </div>

                        {(settings.enable_deterministic_fallback ?? true) && (
                          <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1">
                            <div className="flex justify-between text-[9px] font-bold text-slate-500 uppercase">
                              <span>Safety Timeout Threshold</span>
                              <span className="text-blue-600 font-extrabold">{settings.fallback_timeout ?? 90}s</span>
                            </div>
                            <input
                              type="range"
                              min="3"
                              max="120"
                              step="1"
                              value={settings.fallback_timeout ?? 90}
                              onChange={(e) => setSettings({ ...settings, fallback_timeout: parseInt(e.target.value) })}
                              className="w-full h-1 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={saveSettings}
                      disabled={isSavingSettings}
                      className="w-full text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition disabled:opacity-50"
                    >
                      {isSavingSettings ? "Saving Settings..." : "Save Safety Config"}
                    </button>
                  </div>
                </div>

                {/* Section B: Cost metrics card */}
                <div className="space-y-6">
                  <div className="bg-slate-50 dark:bg-slate-950 p-5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4 h-full flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 pb-2 mb-4">
                        Swarm Cost & API Statistics
                      </h4>
                      <p className="text-[10px] text-slate-500 mb-6">
                        Calculated dynamically from live token usages on Groq API completions across all active swarm agents.
                      </p>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-lg text-center shadow-sm">
                          <span className="block text-[9px] font-bold text-slate-500 uppercase">Cumulative Tokens</span>
                          <span className="text-lg font-black text-slate-800 dark:text-slate-100 font-mono">
                            {settings.cost_tracker?.total_tokens?.toLocaleString() || 0}
                          </span>
                        </div>

                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-lg text-center shadow-sm">
                          <span className="block text-[9px] font-bold text-slate-500 uppercase">Estimated API Cost</span>
                          <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
                            ${settings.cost_tracker?.total_cost?.toFixed(5) || "0.00000"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-50 dark:bg-slate-900/50 border border-blue-200 dark:border-blue-900 p-3.5 rounded-lg text-[10px] text-blue-800 dark:text-blue-300 leading-normal">
                      <strong>Pricing Guideline:</strong> Cost estimations are based on current Groq token schedules: $0.05/$0.08 per 1M tokens for 8B models, and $0.59/$0.79 per 1M tokens for 70B models. Failover models are estimated at standard utility model rates.
                    </div>
                  </div>
                </div>
              </div>

              {/* Advanced Swarm Enclave (Model routing & temperatures) */}
              <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-xl border border-slate-200 dark:border-slate-800 space-y-6">
                <div>
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 pb-2">
                    Advanced Swarm Enclave Configuration
                  </h4>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Fine-tune LLM routing channels, temperature boundaries, and token limits per agent. Settings apply immediately to background execution.
                  </p>
                </div>

                <div className="space-y-6 divide-y divide-slate-200 dark:divide-slate-800">
                  {Object.keys(settings.models || {}).map((agentKey) => (
                    <div key={agentKey} className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-5 first:pt-0 border-none">
                      {/* Column 1: Agent Header */}
                      <div>
                        <h5 className="text-xs font-bold text-slate-800 dark:text-slate-100 capitalize">
                          {agentKey === "coordinator" ? "1. Coordinator Agent" :
                           agentKey === "analyst" ? "2. Systems Analyst" :
                           agentKey === "auditor" ? "3. Safety Auditor" :
                           agentKey === "execution" ? "4. Execution Agent" :
                           agentKey === "forensic" ? "5. Forensic Investigator" : "6. Knowledge Curator"}
                        </h5>
                        <p className="text-[10px] text-slate-500 capitalize">Swarm role: {agentKey} operator</p>
                      </div>

                      {/* Column 2: Model Select */}
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Model Routing</label>
                        <select
                          value={settings.models[agentKey]}
                          onChange={(e) => {
                            const updatedModels = { ...settings.models, [agentKey]: e.target.value };
                            setSettings({ ...settings, models: updatedModels });
                          }}
                          className="w-full text-xs p-2 bg-white dark:bg-slate-900 border border-slate-350 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-250 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        >
                          <option value="llama-3.1-8b-instant">Llama 3.1 8B Instant</option>
                          <option value="llama-3.3-70b-versatile">Llama 3.3 70B Versatile</option>
                          <option value="meta-llama/llama-4-scout-17b-16e-instruct">Llama 4 Scout 17B Instruct</option>
                          <option value="qwen/qwen3.6-27b">Qwen 3.6 27B Instruct</option>
                          <option value="qwen/qwen3-32b">Qwen 3 32B Instruct</option>
                          <option value="ollama">Ollama (Local Llama-3)</option>
                        </select>
                      </div>

                      {/* Column 3: Temperature and Max Tokens */}
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between text-[9px] font-bold text-slate-500 uppercase mb-1">
                            <span>Temperature</span>
                            <span className="text-blue-600 font-extrabold">{settings.temperatures?.[agentKey]}</span>
                          </div>
                          <input
                            type="range"
                            min="0.0"
                            max="1.0"
                            step="0.1"
                            value={settings.temperatures?.[agentKey] ?? 0}
                            onChange={(e) => {
                              const updatedTemps = { ...settings.temperatures, [agentKey]: parseFloat(e.target.value) };
                              setSettings({ ...settings, temperatures: updatedTemps });
                            }}
                            className="w-full h-1 bg-slate-350 rounded-lg appearance-none cursor-pointer accent-blue-600"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between text-[9px] font-bold text-slate-500 uppercase mb-1">
                            <span>Max Tokens Limit</span>
                            <span className="text-slate-800 dark:text-slate-200 font-mono font-bold">{settings.max_tokens?.[agentKey] ?? 450}</span>
                          </div>
                          <input
                            type="number"
                            min="10"
                            max="2000"
                            value={settings.max_tokens?.[agentKey] ?? 450}
                            onChange={(e) => {
                              const updatedTokens = { ...settings.max_tokens, [agentKey]: parseInt(e.target.value) || 10 };
                              setSettings({ ...settings, max_tokens: updatedTokens });
                            }}
                            className="w-full text-xs p-1.5 bg-white dark:bg-slate-900 border border-slate-350 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-250 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end border-t border-slate-200 dark:border-slate-800 pt-5">
                  <button
                    onClick={saveSettings}
                    disabled={isSavingSettings}
                    className="text-xs font-bold bg-[#0b57d0] hover:bg-[#0842a0] text-white py-2.5 px-8 rounded-lg transition disabled:opacity-50 shadow-sm"
                  >
                    {isSavingSettings ? "Saving Settings..." : "Save Calibration Settings"}
                  </button>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="bg-red-50 dark:bg-red-950/10 p-6 rounded-xl border border-red-200 dark:border-red-900/30 space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">
                    Danger Zone
                  </h4>
                  <p className="text-[10px] text-red-650 dark:text-red-300 mt-1">
                    Destructive operations that reset the containment facility control environment.
                  </p>
                </div>
                <div className="flex items-center justify-between bg-white dark:bg-slate-900/50 p-4 rounded-xl border border-red-200/50 dark:border-red-900/20">
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Reset System Database</span>
                    <p className="text-[9px] text-slate-500 mt-0.5">Purges all telemetry history logs, restores default blueprints, and resets agent system rules to factory defaults.</p>
                  </div>
                  <button
                    onClick={resetSandbox}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold text-[10px] uppercase tracking-wider text-white bg-red-600 hover:bg-red-700 transition"
                  >
                    <Wrench className="h-3.5 w-3.5" />
                    <span>Reset Database</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          </div>

          {/* HUMAN-IN-THE-LOOP AUTHORIZATION OVERLAY MODAL */}
          {hitlData && (
            <div className="premium-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="premium-modal-panel max-w-lg w-full p-7 space-y-5" style={{animation:'slideUp 0.25s cubic-bezier(0.4,0,0.2,1) forwards'}}>
                <div className="flex items-center gap-3 pb-4" style={{borderBottom:'1px solid var(--color-border)'}}>
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center animate-pulse" style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.2)'}}>
                    <ShieldAlert className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-bold uppercase tracking-wide" style={{color:'var(--text-primary)',letterSpacing:'0.04em'}}>
                      Operator Authorization Required
                    </h3>
                    <p className="text-[9px] font-mono mt-0.5" style={{color:'var(--text-muted)'}}>Incident ID: {hitlData.incidentId}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[11px]" style={{color:'var(--text-secondary)'}}>
                    SafeGuard has paused the containment Swarm. The Safety Auditor has generated the following isolation checklist for <strong style={{color:'var(--text-primary)'}}>{hitlData.equipmentName}</strong>. Review and authorize:
                  </p>
                  <div className="rounded-xl p-4 text-[11px] font-mono max-h-56 overflow-y-auto whitespace-pre-wrap leading-relaxed" style={{background:'#000000',border:'1px solid var(--color-border)',color:'#a1a1aa'}}>
                    {hitlData.proposedChecklist}
                  </div>
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => handleHitlAction(false)}
                    className="flex-1 text-[11px] font-bold py-2.5 px-4 rounded-xl transition"
                    style={{background:'var(--bg-secondary)',border:'1px solid var(--color-border)',color:'var(--text-secondary)'}}
                    onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.color='var(--text-primary)';}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.color='var(--text-secondary)';}}
                  >
                    Decline &amp; Abort Swarm
                  </button>
                  <button
                    onClick={() => handleHitlAction(true)}
                    className="btn-primary flex-1 justify-center py-2.5 rounded-xl"
                    style={{background:'#dc2626'}}
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    <span>Authorize Lockdown</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
