import {
  type ChangeEvent,
  type FormEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { Navigate } from "react-router";

import { useAuth } from "../auth/AuthProvider";

type TabKey = "chat" | "preview" | "history";

type NavItem = {
  key: TabKey;
  label: string;
  description: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: ChatAttachment[];
  variant?: "accent" | "subtle";
  timestamp: string;
};

type PreviewFile = {
  name: string;
  kind: "HTML" | "CSS" | "React" | "Asset";
  status: string;
};

type HistoryEntry = {
  id: string;
  title: string;
  summary: string;
  timestamp: string;
  tags: string[];
};

type StatusMessage = {
  kind: "success" | "error";
  text: string;
  detail?: string;
};

type AttachmentType = "image" | "file";

type ChatAttachment = {
  id: string;
  name: string;
  type: AttachmentType;
  previewUrl?: string;
  size?: number;
};

type AgentChatMessagePayload = {
  id: string;
  role: "assistant";
  variant: "accent" | "subtle";
  content: string;
};

type AgentRunResponse = {
  messages?: AgentChatMessagePayload[];
  status?: {
    kind: "success" | "error";
    text: string;
    detail?: string;
  };
  usedFallback?: boolean;
};

const VLM_AGENT_ENDPOINT = "/api/vlm";

const formatTimestamp = (date: Date) =>
  date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

const createMessageId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const navItems: NavItem[] = [
  { key: "chat", label: "Chat", description: "Live" },
  { key: "preview", label: "Preview", description: "Generated UI" },
  { key: "history", label: "History", description: "Previous runs" },
];

const messages: Message[] = [
  {
    id: "1",
    role: "user",
    content:
      "Generate a simple restaurant website with navigation tabs and cards for menu sections.",
    timestamp: "9:30 AM",
  },
  {
    id: "2",
    role: "assistant",
    variant: "accent",
    content: "Sure! Here's your code:",
    attachments: [
      { id: "att-1", name: "index.html", type: "file" },
      { id: "att-2", name: "styles.css", type: "file" },
    ],
    timestamp: "9:31 AM",
  },
  {
    id: "3",
    role: "assistant",
    variant: "subtle",
    content:
      "Pro tip: ask for different color palettes or suggest layout tweaks to iterate quickly.",
    timestamp: "9:32 AM",
  },
];

const previewFiles: PreviewFile[] = [
  { name: "index.html", kind: "HTML", status: "Updated 2 mins ago" },
  { name: "styles.css", kind: "CSS", status: "Updated 2 mins ago" },
  { name: "menu-grid.jsx", kind: "React", status: "New file" },
];

const historyEntries: HistoryEntry[] = [
  {
    id: "HX1",
    title: "Restaurant landing page",
    summary: "Two column hero layout with dish gallery and reservations CTA.",
    timestamp: "Today · 9:20 AM",
    tags: ["HTML", "CSS"],
  },
  {
    id: "HX2",
    title: "Fitness app dashboard",
    summary: "Card grid with progress rings and weekly workout breakdown.",
    timestamp: "Yesterday · 6:12 PM",
    tags: ["React", "Tailwind"],
  },
  {
    id: "HX3",
    title: "Travel inspiration board",
    summary: "Pinterest-style masonry feed for featured destinations.",
    timestamp: "Apr 2 · 11:47 AM",
    tags: ["React", "CSS Modules"],
  },
];

export function Welcome() {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="text-center">
          <div className="mb-3 animate-spin rounded-full border-4 border-[#2F6BFF] border-t-transparent p-6" />
          <p className="text-sm text-slate-400">Loading your workspace…</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const [activeTab, setActiveTab] = useState<TabKey>("chat");
  const [chatMessages, setChatMessages] = useState<Message[]>(messages);
  const [promptValue, setPromptValue] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [historyItems, setHistoryItems] = useState<HistoryEntry[]>(historyEntries);
  const [selectedPreviewFile, setSelectedPreviewFile] = useState<PreviewFile | null>(
    previewFiles[0] ?? null,
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const generatedObjectUrlsRef = useRef<string[]>([]);
  const displayName = user.displayName ?? user.email ?? "Anonymous";

  const registerObjectUrls = (urls: string[]) => {
    if (urls.length === 0) {
      return;
    }
    generatedObjectUrlsRef.current.push(...urls);
  };

  const releaseGeneratedObjectUrls = () => {
    generatedObjectUrlsRef.current.forEach((url) => {
      URL.revokeObjectURL(url);
    });
    generatedObjectUrlsRef.current = [];
  };

  useEffect(() => {
    return () => {
      releaseGeneratedObjectUrls();
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const textContent = promptValue.trim();

    if (!textContent) {
      setStatus({
        kind: "error",
        text: "Add a prompt describing what you want generated.",
      });
      return;
    }

    if (selectedFiles.length === 0) {
      setStatus({
        kind: "error",
        text: "Attach at least one wireframe image before sending.",
      });
      return;
    }

    const createdUrls: string[] = [];
    const attachments: ChatAttachment[] = selectedFiles.map((file) => {
      const isImage = file.type.startsWith("image/");
      let previewUrl: string | undefined;

      if (isImage) {
        previewUrl = URL.createObjectURL(file);
        createdUrls.push(previewUrl);
      }

      return {
        id: createMessageId(),
        name: file.name,
        type: isImage ? "image" : "file",
        previewUrl,
        size: file.size,
      };
    });

    if (createdUrls.length > 0) {
      registerObjectUrls(createdUrls);
    }

    const messageContent =
      textContent || (attachments.length > 0 ? "Shared design attachments" : "");

    const userMessage: Message = {
      id: createMessageId(),
      role: "user",
      content: messageContent,
      attachments: attachments.length > 0 ? attachments : undefined,
      timestamp: formatTimestamp(new Date()),
    };

    setChatMessages((previous) => [...previous, userMessage]);
    setIsSending(true);
    setStatus(null);

    const requestPayload = new FormData();
    requestPayload.append("prompt", textContent);
    selectedFiles.forEach((file) => {
      requestPayload.append("images", file);
    });

    try {
      const response = await fetch(VLM_AGENT_ENDPOINT, {
        method: "POST",
        body: requestPayload,
      });

      let agentResponse: AgentRunResponse | null = null;
      try {
        agentResponse = (await response.json()) as AgentRunResponse;
      } catch (parseError) {
        console.warn("Unable to parse agent response JSON", parseError);
      }

      if (!response.ok) {
        const message =
          agentResponse?.status?.text ?? `Agent request failed with status ${response.status}.`;
        throw new Error(message);
      }

      const timestamp = formatTimestamp(new Date());
      const assistantMessages: Message[] =
        agentResponse?.messages?.map((message) => ({
          id: createMessageId(),
          role: "assistant",
          variant: message.variant,
          content: message.content,
          timestamp,
        })) ?? [];

      if (assistantMessages.length > 0) {
        setChatMessages((previous) => [...previous, ...assistantMessages]);
      }

      if (agentResponse?.status) {
        const detail =
          agentResponse.status.detail ??
          (agentResponse.usedFallback
            ? "Python agent unavailable. Served fallback response."
            : undefined);
        setStatus({
          kind: agentResponse.status.kind,
          text: agentResponse.status.text,
          detail,
        });
      } else {
        setStatus({
          kind: "success",
          text: "Agent responded successfully.",
        });
      }
    } catch (error) {
      console.error("Failed to send message to VLM agent", error);
      const detail = error instanceof Error ? error.message : "Unknown error contacting agent.";

      setStatus({
        kind: "error",
        text: "We had trouble reaching the agent. Please try again shortly.",
        detail,
      });

      const errorMessage: Message = {
        id: createMessageId(),
        role: "assistant",
        variant: "subtle",
        content:
          "We couldn't reach the agent service. None of your context was lost—try again once the connection is back.",
        timestamp: formatTimestamp(new Date()),
      };
      setChatMessages((previous) => [...previous, errorMessage]);
    } finally {
      setPromptValue("");
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setIsSending(false);
    }
  };

  const handleAddImageClick = () => {
    if (isSending) {
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    setSelectedFiles(files);

    if (files.length > 0) {
      setStatus({
        kind: "success",
        text: `${files.length} attachment${files.length > 1 ? "s" : ""} ready to send.`,
      });
    }
  };

  const handleRemoveAttachment = (fileToRemove: File) => {
    setSelectedFiles((previous) => {
      const updated = previous.filter((file) => file !== fileToRemove);

      if (fileInputRef.current) {
        if (typeof DataTransfer !== "undefined") {
          const dataTransfer = new DataTransfer();
          updated.forEach((file) => dataTransfer.items.add(file));
          fileInputRef.current.files = dataTransfer.files;
        } else {
          fileInputRef.current.value = "";
        }
      }

      if (updated.length === 0) {
        setStatus(null);
      }

      return updated;
    });
  };

  const handleOpenInEditor = () => {
    const targetFile = selectedPreviewFile ?? previewFiles[0];

    if (!targetFile) {
      setStatus({
        kind: "error",
        text: "No generated file is available to open.",
      });
      return;
    }

    const placeholderContent = [
      "// Image2Code editor preview",
      `// File: ${targetFile.name}`,
      "// This temporary file helps us confirm that the button is wired up.",
      "",
      `// Once the agentic workflow is integrated we'll load the real source for ${targetFile.name}.`,
    ].join("\n");

    const blob = new Blob([placeholderContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    setStatus({
      kind: "success",
      text: `Opened a placeholder editor for ${targetFile.name}.`,
    });
  };

  const handleExportCode = () => {
    if (previewFiles.length === 0) {
      setStatus({
        kind: "error",
        text: "There are no generated files to export yet.",
      });
      return;
    }

    const exportSummary = [
      "Image2Code export (placeholder)",
      `Generated on ${new Date().toLocaleString()}`,
      "",
      ...previewFiles.map((file) => `${file.name} (${file.kind}) - ${file.status}`),
    ].join("\n");

    const blob = new Blob([exportSummary], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "image2code-export.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setStatus({
      kind: "success",
      text: "Download started for the generated code summary.",
    });
  };

  const handleClearHistory = () => {
    if (historyItems.length === 0) {
      setStatus({
        kind: "error",
        text: "History is already cleared.",
      });
      return;
    }

    setHistoryItems([]);
    setStatus({
      kind: "success",
      text: "Cleared previous runs from history.",
    });
  };

  const buildHistoryConversation = (entry: HistoryEntry): Message[] => [
    {
      id: createMessageId(),
      role: "user",
      content: `Can we revisit "${entry.title}"?`,
      timestamp: entry.timestamp,
    },
    {
      id: createMessageId(),
      role: "assistant",
      variant: "accent",
      content: `Absolutely. Here's the summary we have on file: ${entry.summary}`,
      timestamp: formatTimestamp(new Date()),
      attachments: [
        {
          id: createMessageId(),
          name: "index.html",
          type: "file",
        },
        {
          id: createMessageId(),
          name: "styles.css",
          type: "file",
        },
      ],
    },
  ];

  const handleViewConversation = (entry: HistoryEntry) => {
    releaseGeneratedObjectUrls();
    setChatMessages(buildHistoryConversation(entry));
    setActiveTab("chat");
    setStatus({
      kind: "success",
      text: `Loaded the "${entry.title}" conversation into chat.`,
    });
  };

  const renderContent = () => {
    switch (activeTab) {
      case "preview":
        return (
          <PreviewPanel
            files={previewFiles}
            selectedFile={selectedPreviewFile}
            onSelectFile={setSelectedPreviewFile}
            onOpenInEditor={handleOpenInEditor}
            onExportCode={handleExportCode}
          />
        );
      case "history":
        return (
          <HistoryPanel
            entries={historyItems}
            onClearHistory={handleClearHistory}
            onViewConversation={handleViewConversation}
          />
        );
      case "chat":
      default:
        return (
          <ChatPanel
            messages={chatMessages}
            onSubmit={handleSubmit}
            onAddImageClick={handleAddImageClick}
            fileInputRef={fileInputRef}
            promptValue={promptValue}
            onPromptChange={setPromptValue}
            isSending={isSending}
            onFileChange={handleFileChange}
            selectedFiles={selectedFiles}
            onRemoveAttachment={handleRemoveAttachment}
          />
        );
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-4 py-6 sm:px-8 lg:px-12">
        <header className="flex flex-col gap-6 border-b border-slate-800/80 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-lg font-semibold sm:text-xl text-[#6FA3FF]">Image2Code</p>
            <p className="text-sm text-slate-400">
              Bring wireframes to life with an agentic workflow.
            </p>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            <nav className="grid grid-cols-3 gap-2 sm:max-w-sm">
              {navItems.map((item) => {
                const isActive = item.key === activeTab;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActiveTab(item.key)}
                    aria-pressed={isActive}
                    className={`rounded-2xl border px-3 py-2 text-left text-sm font-medium transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F6BFF] ${
                      isActive
                        ? "border-[#2F6BFF] bg-slate-900/70 text-[#D6E2FF]"
                        : "border-slate-800/70 bg-slate-900/50 text-slate-500 hover:border-[#2F6BFF]/40 hover:text-slate-200"
                    }`}
                  >
                    <span className="block text-sm font-semibold">{item.label}</span>
                    <span className="text-xs font-normal text-slate-500">
                      {item.description}
                    </span>
                  </button>
                );
              })}
            </nav>
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800/70 bg-slate-900/60 px-4 py-2 text-sm text-slate-300 sm:w-auto">
              <span className="truncate">{displayName}</span>
              <button
                type="button"
                onClick={() => void signOut()}
                className="rounded-lg border border-slate-700 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-rose-500 hover:text-rose-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        {status && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              status.kind === "success"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                : "border-rose-500/40 bg-rose-500/10 text-rose-100"
            }`}
          >
            <p className="font-medium">{status.text}</p>
            {status.detail && <p className="mt-1 text-xs opacity-80">{status.detail}</p>}
          </div>
        )}

        {renderContent()}
      </div>
    </main>
  );
}

type ChatPanelProps = {
  messages: Message[];
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onAddImageClick: () => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  promptValue: string;
  onPromptChange: (value: string) => void;
  isSending: boolean;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  selectedFiles: File[];
  onRemoveAttachment: (file: File) => void;
};

function ChatPanel({
  messages,
  onSubmit,
  onAddImageClick,
  fileInputRef,
  promptValue,
  onPromptChange,
  isSending,
  onFileChange,
  selectedFiles,
  onRemoveAttachment,
}: ChatPanelProps) {
  return (
    <section className="grid gap-6 lg:grid-cols-[0.6fr_minmax(0,_1fr)]">
      <aside className="hidden flex-col gap-4 rounded-3xl border border-slate-800/70 bg-slate-900/80 p-6 shadow-[0_18px_60px_-40px_rgba(15,23,42,1)] lg:flex">
        <h2 className="text-sm font-semibold text-slate-300">Inspiration</h2>
        <div className="aspect-video w-full overflow-hidden rounded-2xl border border-slate-800/70 bg-slate-900">
          <div className="flex h-full w-full items-center justify-center text-sm font-medium text-slate-500">
            Upload wireframes to preview here
          </div>
        </div>
        <p className="text-sm leading-relaxed text-slate-400">
          Drop a mobile or desktop mockup. We'll analyze its layout, pick colors, and produce
          production-ready code snippets for you to tweak or export.
        </p>
      </aside>

      <div className="flex min-h-[480px] flex-col rounded-3xl border border-slate-800/70 bg-slate-900/85 shadow-[0_30px_80px_-45px_rgba(15,23,42,1)]">
        <div className="flex items-center justify-between border-b border-slate-800/70 px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-300">Chat Canvas</h2>
            <p className="text-xs text-slate-500">
              Prototype conversations with your build assistant.
            </p>
          </div>
          <span className="rounded-full border border-emerald-500/30 bg-emerald-900/40 px-3 py-1 text-xs font-medium text-emerald-300">
            Connected
          </span>
        </div>

        <ul className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-6">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </ul>

        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-3 border-t border-slate-800/70 bg-slate-900/80 px-4 py-4 sm:flex-row sm:items-center"
        >
          <div className="flex-1 space-y-2">
            <label className="flex flex-col">
              <span className="sr-only">Prompt the assistant</span>
              <textarea
                className="h-16 w-full resize-none rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm leading-relaxed text-slate-100 shadow-inner outline-none transition focus:border-[#2F6BFF]/60 focus:ring-2 focus:ring-[#2F6BFF]/30 placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-70"
                placeholder="Describe the UI you want, or paste feedback to iterate."
                value={promptValue}
                onChange={(event) => onPromptChange(event.target.value)}
                disabled={isSending}
              />
            </label>
            {selectedFiles.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {selectedFiles.map((file) => (
                  <li
                    key={`${file.name}-${file.lastModified}`}
                    className="flex items-center gap-2 rounded-2xl border border-slate-800/70 bg-slate-950/70 px-3 py-1.5 text-xs text-slate-200"
                  >
                    <span className="max-w-[160px] truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => onRemoveAttachment(file)}
                      className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 transition hover:border-rose-500/40 hover:text-rose-200"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={onFileChange}
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onAddImageClick}
              aria-label="Add images"
              disabled={isSending}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 text-slate-200 transition hover:border-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path d="M10 4a1 1 0 011 1v4h4a1 1 0 110 2h-4v4a1 1 0 11-2 0v-4H5a1 1 0 110-2h4V5a1 1 0 011-1z" />
              </svg>
            </button>
            <button
              type="submit"
              disabled={isSending || (promptValue.trim().length === 0 && selectedFiles.length === 0)}
              className="flex items-center gap-2 rounded-xl bg-[#2F6BFF] px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_32px_-18px_rgba(47,107,255,0.9)] transition hover:bg-[#2A5FE6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F6BFF] disabled:cursor-not-allowed disabled:bg-[#2F6BFF]/60"
            >
              {isSending ? "Sending..." : "Send"}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M2.94 2.94a.75.75 0 01.78-.18l13 5a.75.75 0 010 1.38l-13 5A.75.75 0 012 13.5v-3.318a.75.75 0 01.553-.725L9.5 8.001l-6.947-1.456A.75.75 0 012 5.82V2.5a.75.75 0 01.22-.53z" />
                <path d="M18 10a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h7.5A.75.75 0 0018 10z" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

type PreviewPanelProps = {
  files: PreviewFile[];
  selectedFile: PreviewFile | null;
  onSelectFile: (file: PreviewFile) => void;
  onOpenInEditor: () => void;
  onExportCode: () => void;
};

function PreviewPanel({
  files,
  selectedFile,
  onSelectFile,
  onOpenInEditor,
  onExportCode,
}: PreviewPanelProps) {
  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,_1.1fr)_minmax(0,_0.9fr)]">
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-800/70 bg-slate-900/80 p-6 shadow-[0_24px_70px_-50px_rgba(15,23,42,1)]">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-300">Live preview</h2>
            <p className="text-xs text-slate-500">Render of the generated UI layout.</p>
          </div>
          <span className="rounded-full border border-[#2F6BFF]/40 bg-slate-900 px-3 py-1 text-xs font-medium text-[#9BBEFF]">
            synced
          </span>
        </header>
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-5">
          <div className="h-9 w-full rounded-xl border border-slate-800/80 bg-slate-900/90" />
          <div className="flex flex-col gap-3 rounded-xl border border-slate-800/80 bg-slate-900/80 p-4">
            <div className="flex items-center justify-between">
              <div className="h-3 w-32 rounded-full bg-[#2F6BFF]/60" />
              <div className="flex gap-2">
                <div className="h-2 w-12 rounded-full bg-slate-700" />
                <div className="h-2 w-12 rounded-full bg-slate-700" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="h-28 rounded-xl border border-slate-800/80 bg-slate-900" />
              <div className="h-28 rounded-xl border border-slate-800/80 bg-slate-900" />
            </div>
            <div className="h-10 rounded-xl border border-slate-800/80 bg-slate-900" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="h-24 rounded-xl border border-slate-800/80 bg-slate-900" />
            <div className="h-24 rounded-xl border border-slate-800/80 bg-slate-900" />
            <div className="h-24 rounded-xl border border-slate-800/80 bg-slate-900" />
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Update the prompt and re-run the assistant to refresh the layout preview.
        </p>
      </div>

      <aside className="flex flex-col gap-4 rounded-3xl border border-slate-800/70 bg-slate-900/70 p-6">
        <h2 className="text-sm font-semibold text-slate-300">Generated files</h2>
        <ul className="space-y-3">
          {files.map((file) => {
            const isSelected = selectedFile?.name === file.name;
            return (
              <li key={file.name}>
                <button
                  type="button"
                  onClick={() => onSelectFile(file)}
                  aria-pressed={isSelected}
                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                    isSelected
                      ? "border-[#2F6BFF] bg-slate-900 text-slate-100"
                      : "border-slate-800 bg-slate-900 text-slate-300 hover:border-[#2F6BFF]/40 hover:text-white"
                  }`}
                >
                  <div>
                    <p className="text-sm font-semibold">{file.name}</p>
                    <p className="text-xs text-slate-500">{file.status}</p>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      isSelected
                        ? "border-[#2F6BFF]/60 text-[#9BBEFF]"
                        : "border-slate-800/70 text-slate-400"
                    }`}
                  >
                    {file.kind}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-auto flex flex-col gap-3">
          <button
            type="button"
            onClick={onOpenInEditor}
            disabled={!selectedFile}
            className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-[#2F6BFF]/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Open in editor
          </button>
          <button
            type="button"
            onClick={onExportCode}
            disabled={files.length === 0}
            className="rounded-2xl bg-[#2F6BFF] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#2A5FE6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F6BFF] disabled:cursor-not-allowed disabled:bg-[#2F6BFF]/60"
          >
            Export code
          </button>
        </div>
      </aside>
    </section>
  );
}

type HistoryPanelProps = {
  entries: HistoryEntry[];
  onClearHistory: () => void;
  onViewConversation: (entry: HistoryEntry) => void;
};

function HistoryPanel({ entries, onClearHistory, onViewConversation }: HistoryPanelProps) {
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2 rounded-3xl border border-slate-800/70 bg-slate-900/80 px-6 py-5 shadow-[0_24px_70px_-50px_rgba(15,23,42,1)] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-300">Run history</h2>
          <p className="text-xs text-slate-500">
            Revisit previous generations and restore code with a single click.
          </p>
        </div>
        <button
          type="button"
          onClick={onClearHistory}
          disabled={entries.length === 0}
          className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-[#2F6BFF]/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          Clear history
        </button>
      </header>

      {entries.length === 0 ? (
        <div className="rounded-3xl border border-slate-800/70 bg-slate-900/70 px-5 py-6 text-sm text-slate-400">
          No previous runs yet. Send a prompt to populate your history.
        </div>
      ) : (
        <ul className="space-y-4">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-col gap-3 rounded-3xl border border-slate-800/70 bg-slate-900/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-200">{entry.title}</p>
                <p className="text-xs text-slate-500">{entry.summary}</p>
                <p className="text-xs text-slate-600">{entry.timestamp}</p>
              </div>
              <div className="flex items-center gap-2">
                {entry.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-slate-800/70 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-slate-400"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={() => onViewConversation(entry)}
                className="ml-auto rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-[#2F6BFF]/40 hover:text-white"
              >
                View conversation
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type MessageBubbleProps = {
  message: Message;
};

function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const bubbleBase =
    "max-w-[min(520px,100%)] rounded-3xl px-5 py-4 text-sm leading-relaxed shadow-sm sm:text-base";

  const bubbleTone = isUser
    ? "bg-slate-800 text-slate-100 border border-slate-700"
    : message.variant === "subtle"
    ? "bg-slate-800/70 text-slate-300 border border-slate-800"
    : "bg-[#2F6BFF] text-white shadow-[0_20px_40px_-24px_rgba(47,107,255,1)]";

  const avatarTone = isUser
    ? "bg-slate-800 text-[#7DA6FF]"
    : message.variant === "accent"
    ? "bg-[#2F6BFF] text-white"
    : "bg-slate-800 text-slate-200";

  const containerDirection = isUser ? "flex-row-reverse" : "flex-row";
  const alignment = isUser ? "items-end" : "items-start";
  const nameLabel = isUser ? "You" : "Image2Code";

  return (
    <li className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`flex ${containerDirection} ${alignment} gap-3`}>
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold ${avatarTone}`}
        >
          {isUser ? "UX" : "I2C"}
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {nameLabel} · {message.timestamp}
          </span>
          <div className={`${bubbleBase} ${bubbleTone}`}>
            <p className="whitespace-pre-wrap">{message.content}</p>
            {message.attachments && message.attachments.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-3 text-sm font-medium">
                {message.attachments.map((attachment) => (
                  <li key={attachment.id}>
                    {attachment.type === "image" && attachment.previewUrl ? (
                      <figure className="group relative flex h-28 w-32 overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/60">
                        <img
                          src={attachment.previewUrl}
                          alt={attachment.name}
                          className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                        />
                        <figcaption className="absolute bottom-0 w-full bg-slate-950/80 px-2 py-1 text-[11px] font-medium text-slate-200 backdrop-blur">
                          {attachment.name}
                        </figcaption>
                      </figure>
                    ) : (
                      <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-[13px] text-slate-200">
                        <FileGlyph />
                        <span className="max-w-[140px] truncate" title={attachment.name}>
                          {attachment.name}
                        </span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function FileGlyph() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-slate-300">
      <path d="M5 2a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7.414a2 2 0 00-.586-1.414l-3.414-3.414A2 2 0 0011.586 2H5zm4 6V3h2v5h4v2h-5a1 1 0 01-1-1z" />
    </svg>
  );
}
