"use client";

import { useState, useEffect, useCallback } from "react";
import DataTable, { Column } from "@/components/DataTable";
import StatsCard from "@/components/StatsCard";
import {
  getAdminEducations,
  createEducation,
  updateEducation,
  deleteEducation,
  EducationCourse,
  EducationSummary,
} from "@/lib/api";

interface CourseForm {
  title: string;
  description: string;
  videoUrl: string;
  duration: string;
  order: string;
}

const emptyForm: CourseForm = {
  title: "",
  description: "",
  videoUrl: "",
  duration: "",
  order: "0",
};

export default function EducationPage() {
  const [courses, setCourses] = useState<EducationCourse[]>([]);
  const [summary, setSummary] = useState<EducationSummary>({
    totalCourses: 0,
    totalCompleted: 0,
    averageCompletionRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<EducationCourse | null>(null);
  const [form, setForm] = useState<CourseForm>(emptyForm);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getAdminEducations();
      const data = res as any;
      setCourses(data?.courses || []);
      setSummary(data?.summary || { totalCourses: 0, totalCompleted: 0, averageCompletionRate: 0 });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "교육 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateOpen = () => {
    setForm(emptyForm);
    setShowCreateModal(true);
  };

  const handleEditOpen = (course: EducationCourse) => {
    setEditingCourse(course);
    setForm({
      title: course.title,
      description: course.description || "",
      videoUrl: course.videoUrl || "",
      duration: String(course.duration),
      order: String(course.order),
    });
    setShowEditModal(true);
  };

  const handleCreateSubmit = async () => {
    if (!form.title.trim()) {
      alert("제목을 입력해주세요.");
      return;
    }
    if (!form.duration || parseInt(form.duration) < 1) {
      alert("소요시간을 1분 이상으로 입력해주세요.");
      return;
    }
    setActionLoading(true);
    try {
      await createEducation({
        title: form.title,
        description: form.description || undefined,
        videoUrl: form.videoUrl || undefined,
        duration: parseInt(form.duration),
        order: form.order ? parseInt(form.order) : 0,
      });
      alert("교육 과정이 생성되었습니다.");
      setShowCreateModal(false);
      setForm(emptyForm);
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "생성 실패");
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditSubmit = async () => {
    if (!editingCourse) return;
    if (!form.title.trim()) {
      alert("제목을 입력해주세요.");
      return;
    }
    if (!form.duration || parseInt(form.duration) < 1) {
      alert("소요시간을 1분 이상으로 입력해주세요.");
      return;
    }
    setActionLoading(true);
    try {
      await updateEducation(editingCourse.id, {
        title: form.title,
        description: form.description || undefined,
        videoUrl: form.videoUrl || undefined,
        duration: parseInt(form.duration),
        order: form.order ? parseInt(form.order) : 0,
      });
      alert("교육 과정이 수정되었습니다.");
      setShowEditModal(false);
      setEditingCourse(null);
      setForm(emptyForm);
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "수정 실패");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (course: EducationCourse) => {
    if (!confirm(`"${course.title}" 과정을 삭제하시겠습니까? 관련 수강 기록도 모두 삭제됩니다.`)) return;
    setActionLoading(true);
    try {
      await deleteEducation(course.id);
      alert("교육 과정이 삭제되었습니다.");
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "삭제 실패");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleActive = async (course: EducationCourse) => {
    const newStatus = !course.isActive;
    if (!confirm(`"${course.title}" 과정을 ${newStatus ? "활성화" : "비활성화"} 하시겠습니까?`)) return;
    try {
      await updateEducation(course.id, { isActive: newStatus });
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "상태 변경 실패");
    }
  };

  const columns: Column<EducationCourse>[] = [
    {
      key: "order",
      label: "순서",
      align: "center",
      width: "60px",
      render: (v) => <span className="font-mono text-sm text-gray-500">{v as number}</span>,
    },
    {
      key: "title",
      label: "제목",
      render: (_v, row) => (
        <div>
          <p className="font-medium text-gray-900">{row.title}</p>
          {row.description && (
            <p className="mt-0.5 text-xs text-gray-500 truncate max-w-[300px]">{row.description}</p>
          )}
        </div>
      ),
    },
    {
      key: "duration",
      label: "소요시간",
      align: "center",
      render: (v) => <span className="text-sm">{v as number}분</span>,
    },
    {
      key: "enrolledCount",
      label: "수강인원",
      align: "center",
      render: (v) => <span className="font-medium">{(v as number).toLocaleString()}명</span>,
    },
    {
      key: "completedCount",
      label: "수료인원",
      align: "center",
      render: (v) => <span className="font-medium text-emerald-600">{(v as number).toLocaleString()}명</span>,
    },
    {
      key: "completionRate",
      label: "수료율",
      align: "center",
      render: (v) => {
        const rate = v as number;
        return (
          <div className="flex items-center justify-center gap-2">
            <div className="h-2 w-16 rounded-full bg-gray-200">
              <div
                className="h-2 rounded-full bg-primary-500"
                style={{ width: `${Math.min(rate, 100)}%` }}
              />
            </div>
            <span className="text-sm font-medium">{rate}%</span>
          </div>
        );
      },
    },
    {
      key: "isActive",
      label: "상태",
      align: "center",
      render: (v, row) => (
        <button
          onClick={(e) => { e.stopPropagation(); handleToggleActive(row); }}
          className={v ? "badge-green cursor-pointer" : "badge-gray cursor-pointer"}
        >
          {v ? "활성" : "비활성"}
        </button>
      ),
    },
    {
      key: "actions",
      label: "액션",
      align: "center",
      render: (_v, row) => (
        <div className="flex items-center justify-center gap-1">
          <button
            className="btn-secondary btn-sm"
            onClick={(e) => { e.stopPropagation(); handleEditOpen(row); }}
          >
            수정
          </button>
          <button
            className="btn-danger btn-sm"
            onClick={(e) => { e.stopPropagation(); handleDelete(row); }}
          >
            삭제
          </button>
        </div>
      ),
    },
  ];

  const renderFormModal = (
    title: string,
    isOpen: boolean,
    onClose: () => void,
    onSubmit: () => void,
    submitLabel: string,
  ) => {
    if (!isOpen) return null;
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
            <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">제목 *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="input-field"
                placeholder="교육 과정 제목"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">설명</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="input-field min-h-[80px] resize-y"
                placeholder="교육 과정 설명"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">영상 URL</label>
              <input
                type="url"
                value={form.videoUrl}
                onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
                className="input-field"
                placeholder="https://..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">소요시간 (분) *</label>
                <input
                  type="number"
                  min="1"
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: e.target.value })}
                  className="input-field"
                  placeholder="30"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">순서</label>
                <input
                  type="number"
                  min="0"
                  value={form.order}
                  onChange={(e) => setForm({ ...form, order: e.target.value })}
                  className="input-field"
                  placeholder="0"
                />
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button className="btn-secondary" onClick={onClose}>취소</button>
            <button
              className="btn-primary"
              disabled={actionLoading}
              onClick={onSubmit}
            >
              {actionLoading ? "처리 중..." : submitLabel}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">교육 관리</h1>
          <p className="mt-1 text-sm text-gray-500">간병인 교육 과정을 관리하고 수강 현황을 확인합니다.</p>
        </div>
        <button className="btn-primary self-start" onClick={handleCreateOpen}>
          + 과정 추가
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard title="총 과정 수" value={`${summary.totalCourses}개`} color="blue" />
        <StatsCard title="수강 완료 수" value={`${summary.totalCompleted.toLocaleString()}건`} color="green" />
        <StatsCard title="평균 수료율" value={`${summary.averageCompletionRate}%`} color="purple" />
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {error}
          <button onClick={fetchData} className="ml-4 underline">다시 시도</button>
        </div>
      )}

      {/* Table */}
      <DataTable
        columns={columns}
        data={courses}
        loading={loading}
        emptyMessage="등록된 교육 과정이 없습니다."
      />

      {/* Create Modal */}
      {renderFormModal(
        "과정 추가",
        showCreateModal,
        () => setShowCreateModal(false),
        handleCreateSubmit,
        "추가",
      )}

      {/* Edit Modal */}
      {renderFormModal(
        "과정 수정",
        showEditModal,
        () => { setShowEditModal(false); setEditingCourse(null); },
        handleEditSubmit,
        "저장",
      )}
    </div>
  );
}
