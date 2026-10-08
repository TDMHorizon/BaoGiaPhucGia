import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Shield, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export function AuditLogsModal() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getAuditLogs(200);
      setLogs(data);
    } catch (err: any) {
      toast.error(err.message || "Không thể tải nhật ký bảo mật");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = logs.filter((l) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (l.username || "").toLowerCase().includes(q) ||
      (l.action || "").toLowerCase().includes(q) ||
      (l.resource || "").toLowerCase().includes(q) ||
      (l.detail || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Input
            placeholder="Tìm theo tài khoản, hành động, tài nguyên..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-xs max-w-sm"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={loadLogs}
            disabled={loading}
            className="h-8 text-xs flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Làm mới
          </Button>
        </div>
        <span className="text-xs text-slate-500 font-medium">
          Tổng cộng: {filteredLogs.length} bản ghi
        </span>
      </div>

      <div className="border rounded-lg overflow-hidden max-h-[60vh] overflow-y-auto">
        <Table>
          <TableHeader className="bg-slate-50 sticky top-0 z-10">
            <TableRow>
              <TableHead className="text-xs w-36">Thời gian</TableHead>
              <TableHead className="text-xs w-28">Tài khoản</TableHead>
              <TableHead className="text-xs w-36">Hành động</TableHead>
              <TableHead className="text-xs w-24">Tài nguyên</TableHead>
              <TableHead className="text-xs">Chi tiết</TableHead>
              <TableHead className="text-xs w-28 text-right">IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs.map((log) => {
              let detailObj: any = {};
              try {
                detailObj = JSON.parse(log.detail || "{}");
              } catch {
                detailObj = log.detail;
              }
              return (
                <TableRow key={log.id} className="text-xs">
                  <TableCell className="font-mono text-[11px] text-slate-500">
                    {new Date(log.created_at).toLocaleString("vi-VN")}
                  </TableCell>
                  <TableCell className="font-semibold text-slate-800">
                    {log.username || "(hệ thống)"}
                  </TableCell>
                  <TableCell>
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {log.action}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium text-slate-600">
                    {log.resource}
                  </TableCell>
                  <TableCell className="text-slate-600 font-mono text-[11px] truncate max-w-xs" title={JSON.stringify(detailObj)}>
                    {typeof detailObj === "object" ? JSON.stringify(detailObj) : String(detailObj)}
                  </TableCell>
                  <TableCell className="text-right text-[11px] text-slate-400 font-mono">
                    {log.ip_address || "—"}
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredLogs.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-400 italic">
                  Chưa có dữ liệu nhật ký bảo mật nào.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
