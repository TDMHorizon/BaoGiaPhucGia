import { useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { api } from "../lib/api";
import { fileToBase64, parseExcel } from "../lib/excel";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { toast } from "sonner";

type Props = {
  onCloned?: () => void;
};

export function TemplateLibrary({ onCloned }: Props) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [name, setName] = useState("");

  const load = async () => {
    try {
      setTemplates(await api.getTemplates());
    } catch {
      setTemplates([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    try {
      const base64 = await fileToBase64(file);
      const workbook = await parseExcel(base64);
      const templateName = name.trim() || file.name;
      await api.createTemplate({
        name: templateName,
        fileBase64: base64,
        sheets: workbook.SheetNames,
      });
      setName("");
      toast.success("Đã thêm template");
      load();
    } catch (e: any) {
      toast.error(e.message || "Upload template thất bại");
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] },
  } as any);

  const handleClone = async (t: any) => {
    const newName = prompt("Tên báo giá mới:", `Báo giá từ ${t.name}`);
    if (!newName?.trim()) return;
    try {
      await api.cloneTemplate(t.id, { name: newName.trim() });
      toast.success("Đã tạo báo giá từ template");
      onCloned?.();
    } catch (e: any) {
      toast.error(e.message || "Clone thất bại");
    }
  };

  const handleDelete = async (t: any) => {
    if (!confirm(`Xóa template "${t.name}"?`)) return;
    try {
      await api.deleteTemplate(t.id);
      toast.success("Đã xóa template");
      load();
    } catch (e: any) {
      toast.error(e.message || "Xóa thất bại");
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3 border-b bg-slate-50/50">
        <CardTitle className="text-sm font-bold">Thư viện template</CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        <Input
          placeholder="Tên template (tuỳ chọn)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-8 text-xs"
        />
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer text-xs ${
            isDragActive ? "border-indigo-500 bg-indigo-50" : "border-slate-200"
          }`}
        >
          <input {...getInputProps()} />
          Kéo thả file Excel mẫu hoặc click để chọn
        </div>
        <ul className="space-y-2">
          {templates.map((t) => (
            <li key={t.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
              <div>
                <p className="text-xs font-bold">{t.name}</p>
                <p className="text-[10px] text-slate-400">{t.sheets?.length || 0} sheet</p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" className="h-7 text-[10px]" onClick={() => handleClone(t)}>Tạo BG</Button>
                <Button size="sm" variant="outline" className="h-7 text-[10px] text-red-600" onClick={() => handleDelete(t)}>Xóa</Button>
              </div>
            </li>
          ))}
          {templates.length === 0 && <p className="text-xs text-slate-400">Chưa có template.</p>}
        </ul>
      </CardContent>
    </Card>
  );
}
