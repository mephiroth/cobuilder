"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import PipelinePanel from "@/components/PipelinePanel";
import StatusTag from "@/components/StatusTag";

interface Idea {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: string;
  votes: number;
  author_name: string;
  author_contact?: string;
  clarification_doc?: string;
  version?: string;
  screenshots: string;
  source: string;
  visible: number;
  moderation_status: string;
  created_at: string;
  updated_at: string;
}

interface Comment {
  id: string;
  idea_id: string;
  author_name: string;
  content: string;
  is_admin: number;
  created_at: string;
}

const STATUS_OPTIONS = [
  { value: "submitted", label: "待启动" },
  { value: "analyzing", label: "分析中" },
  { value: "pending_prd", label: "待审 PRD" },
  { value: "designing", label: "设计中" },
  { value: "pending_design", label: "待审设计" },
  { value: "dev_pending", label: "开发中" },
  { value: "testing", label: "测试中" },
  { value: "pending_merge", label: "待合入" },
  { value: "done", label: "已完成" },
  { value: "rejected", label: "已驳回" },
  { value: "deferred", label: "已搁置" },
];

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("cobuilder_admin_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "Z");
  return d.toLocaleDateString("zh-CN", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AdminIdeaEditorPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const ideaId = params.id;

  const [idea, setIdea] = useState<Idea | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [description, setDescription] = useState("");
  const [clarificationDoc, setClarificationDoc] = useState("");
  const [status, setStatus] = useState("");
  const [version, setVersion] = useState("");
  const [visible, setVisible] = useState(false);

  const [prd, setPrd] = useState<Record<string, unknown> | null>(null);
  const [uiBrief, setUiBrief] = useState<Record<string, unknown> | null>(null);
  const [devPlan, setDevPlan] = useState<Record<string, unknown> | null>(null);
  const [testDoc, setTestDoc] = useState<Record<string, unknown> | null>(null);
  const [lowConfidenceWarning, setLowConfidenceWarning] = useState(false);
  const [testDocFailed, setTestDocFailed] = useState(false);

  const fetchIdea = useCallback(async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`/api/admin/ideas/${ideaId}`, { headers });
      if (!res.ok) throw new Error("加载失败");
      const data = await res.json();
      setIdea(data);
      setDescription(data.description || "");
      setClarificationDoc(data.clarification_doc || "");
      setStatus(data.status || "submitted");
      setPrd(data.prd ?? null);
      setUiBrief(data.uiBrief ?? null);
      setDevPlan(data.devPlan ?? null);
      setTestDoc(data.testDoc ?? null);
      setLowConfidenceWarning(!!data.lowConfidenceWarning);
      setTestDocFailed(!!data.testDocGenerationFailed);
      setVersion(data.version || "");
      setVisible(data.visible === 1);

      const commentsRes = await fetch(`/api/ideas/${ideaId}/comments`, { headers });
      if (commentsRes.ok) setComments(await commentsRes.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [ideaId]);

  useEffect(() => { fetchIdea(); }, [fetchIdea]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch(`/api/admin/ideas/${ideaId}`, {
        method: "PATCH",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          clarification_doc: clarificationDoc || undefined,
          status,
          version: version || undefined,
          visible: visible ? 1 : 0,
        }),
      });
      if (!res.ok) throw new Error("保存失败");
      setSaveMessage({ type: "success", text: "已保存" });
      setTimeout(() => setSaveMessage(null), 2500);
    } catch (e) {
      setSaveMessage({ type: "error", text: e instanceof Error ? e.message : "保存失败" });
    } finally {
      setSaving(false);
    }
  };


  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("确定要删除这条评论吗？")) return;
    try {
      const res = await fetch(`/api/admin/comments/${commentId}`, { method: "DELETE", headers: getAuthHeaders() });
      if (res.ok) setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch { /* ignore */ }
  };

  const handleDelete = async () => {
    if (!confirm("确定要删除这个需求吗？此操作不可撤销。")) return;
    try {
      const res = await fetch(`/api/admin/ideas/${ideaId}`, { method: "DELETE", headers: getAuthHeaders() });
      if (res.ok) window.location.href = "/admin";
    } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="skeleton h-7 w-1/2 rounded-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="card p-5 h-40 skeleton" />
            <div className="card p-5 h-60 skeleton" />
          </div>
          <div className="space-y-4">
            <div className="card p-5 h-40 skeleton" />
          </div>
        </div>
      </div>
    );
  }

  if (!idea) {
    return (
      <div className="empty-state">
        <p className="text-base font-medium text-ink mb-2">需求不存在</p>
        <Link href="/admin" className="btn btn-secondary text-sm px-4 py-2">返回列表</Link>
      </div>
    );
  }

  const screenshots: string[] = (() => {
    try { return JSON.parse(idea.screenshots || "[]"); }
    catch { return []; }
  })();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-start gap-3">
        <Link
          href="/admin"
          className="flex items-center gap-1.5 text-sm text-muted hover:text-ink transition-colors mt-1 flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          返回
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3">
            <h2 className="font-serif text-xl font-bold text-ink leading-tight flex-1 min-w-0">
              {idea.title}
            </h2>
            <StatusTag status={idea.status} />
          </div>
          <p className="text-xs text-muted mt-1">
            by {idea.author_name} · {formatDate(idea.created_at)} · {idea.votes} 票
          </p>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Main Content */}
        <div className="lg:col-span-2 space-y-5">
          <PipelinePanel
            ideaId={ideaId}
            status={idea.status}
            prd={prd}
            uiBrief={uiBrief}
            devPlan={devPlan}
            testDoc={testDoc}
            lowConfidenceWarning={lowConfidenceWarning}
            testDocGenerationFailed={testDocFailed}
            onRefresh={fetchIdea}
            getAuthHeaders={getAuthHeaders}
          />

          {/* Description */}
          <div className="card p-5">
            <label className="block text-sm font-semibold text-ink mb-3">原始描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={10}
              className="input-base font-mono leading-relaxed resize-none"
            />
            {screenshots.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-2">
                {screenshots.map((url: string, i: number) => (
                  <div key={i} className="aspect-video rounded-xl overflow-hidden bg-surface border border-border">
                    <img src={url} alt={`截图 ${i + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Clarification Doc */}
          <div className="card p-5">
            <label className="block text-sm font-semibold text-ink mb-3">澄清文档（遗留字段）</label>
            <textarea
              value={clarificationDoc}
              onChange={(e) => setClarificationDoc(e.target.value)}
              placeholder="AI 澄清后的文档将显示在这里，也可以手动编辑..."
              rows={8}
              className="input-base font-mono leading-relaxed resize-none"
            />
          </div>

          {/* Comments */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-ink mb-4">
              评论
              <span className="ml-1.5 text-xs font-normal text-muted">({comments.length})</span>
            </h3>
            {comments.length === 0 ? (
              <p className="text-sm text-muted-light py-4 text-center">暂无评论</p>
            ) : (
              <div className="space-y-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3 p-3 rounded-xl bg-surface">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                      comment.is_admin
                        ? "bg-gold-subtle text-gold border border-gold-border"
                        : "bg-surface-hover text-muted border border-border"
                    }`}>
                      {comment.is_admin ? "管" : comment.author_name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-ink">{comment.author_name}</span>
                        {comment.is_admin ? (
                          <span className="badge badge-clarified text-[10px] px-1.5 py-0.5">管理员</span>
                        ) : null}
                        <span className="text-[11px] text-muted-light">{formatDate(comment.created_at)}</span>
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="ml-auto text-[11px] text-muted hover:text-error transition-colors"
                        >
                          删除
                        </button>
                      </div>
                      <p className="text-xs text-ink-secondary leading-relaxed">{comment.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Controls */}
        <div className="space-y-4">
          {/* Status & Visibility */}
          <div className="card p-5 space-y-4">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">状态管理</h3>

            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">状态</label>
              <div className="relative">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="input-base appearance-none pr-8"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                  <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">版本号</label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="v1.0"
                className="input-base"
              />
            </div>

            <div>
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={visible}
                    onChange={(e) => setVisible(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-9 h-5 rounded-full transition-colors ${visible ? "bg-gold" : "bg-border"}`}>
                    <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform mt-0.5 ${visible ? "translate-x-4.5 ml-0.5" : "translate-x-0.5"}`} />
                  </div>
                </div>
                <div>
                  <span className="text-sm font-medium text-ink">对外可见</span>
                  <p className="text-xs text-muted mt-0.5">
                    {visible ? "用户可在前台看到" : "仅管理员可见"}
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="card p-5 space-y-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary w-full py-2.5 text-sm font-semibold"
            >
              {saving ? <div className="spinner spinner-sm spinner-white" /> : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {saving ? "保存中..." : "保存更改"}
            </button>

            {saveMessage && (
              <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
                saveMessage.type === "success"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-error border border-red-200"
              }`}>
                {saveMessage.type === "success" ? (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                {saveMessage.text}
              </div>
            )}

            <div className="divider" />

            <button
              onClick={handleDelete}
              className="btn btn-danger w-full py-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              删除需求
            </button>
          </div>

          {/* Meta Info */}
          <div className="card p-5">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">详细信息</h3>
            <dl className="space-y-2.5">
              {[
                { label: "来源", value: idea.source },
                { label: "审核状态", value: idea.moderation_status },
                { label: "更新时间", value: formatDate(idea.updated_at) },
                ...(idea.author_contact ? [{ label: "联系方式", value: idea.author_contact }] : []),
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-start gap-2">
                  <dt className="text-xs text-muted flex-shrink-0">{label}</dt>
                  <dd className="text-xs font-medium text-ink text-right">{value}</dd>
                </div>
              ))}
              <div className="flex justify-between items-start gap-2 pt-1 border-t border-border">
                <dt className="text-xs text-muted flex-shrink-0">ID</dt>
                <dd className="text-[10px] font-mono text-muted truncate max-w-[140px]">{idea.id}</dd>
              </div>
            </dl>
          </div>

          {/* Quick Link */}
          <Link
            href={`/ideas/${ideaId}`}
            target="_blank"
            className="btn btn-ghost w-full py-2 text-xs text-muted justify-center"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            在前台查看
          </Link>
        </div>
      </div>
    </div>
  );
}
