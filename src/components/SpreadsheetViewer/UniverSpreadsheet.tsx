import React from "react";

export interface UniverSpreadsheetProps {
  initialData?: any;
  activeSheet?: string;
  locked?: boolean;
  mode?: "admin" | "user";
  editableRange?: string;
  onReady?: (api: any) => void;
  onCellChange?: (sheetName: string, cellRef: string, newValue: string | number) => void;
  onSheetChange?: (sheetName: string) => void;
  onDataChange?: (data: any) => void;
  onRangeSelect?: (sheetName: string, rangeStr: string) => void;
  onCellDoubleClick?: (sheetName: string, cellRef: string, currentValue: string, r: number, c: number) => void;
  className?: string;
}

export const UniverSpreadsheet: React.FC<UniverSpreadsheetProps> = () => {
  return null;
};