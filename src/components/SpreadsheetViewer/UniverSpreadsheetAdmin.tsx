import React from "react";

export interface UniverSpreadsheetAdminProps {
  initialData?: any;
  activeSheet?: string;
  mode?: "admin" | "user";
  editableRange?: string;
  locked?: boolean;
  onReady?: (api: any) => void;
  onRangeSelect?: (sheetName: string, range: string) => void;
  onCellDoubleClick?: (sheetName: string, cellRef: string, value: string, r: number, c: number) => void;
}

export const UniverSpreadsheetAdmin: React.FC<UniverSpreadsheetAdminProps> = () => {
  return null;
};