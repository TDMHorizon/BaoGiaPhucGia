import React from "react";
import { AppShell } from "../../layout/AppShell";
import { TemplateLibrary } from "../TemplateLibrary";
import { useNavigate } from "react-router-dom";

export const TemplatesPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <AppShell
      title="Thư Viện Biểu Mẫu Báo Giá"
      subtitle="Quản lý và nhân bản các mẫu báo giá trắc địa chuẩn của công ty"
    >
      <div className="max-w-4xl">
        <TemplateLibrary
          onCloned={() => {
            navigate("/quotes");
          }}
        />
      </div>
    </AppShell>
  );
};
