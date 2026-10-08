import React, { useEffect, useRef } from "react";
import { Univer, UniverInstanceType, LocaleType } from "@univerjs/core";
import { UniverRenderEnginePlugin } from "@univerjs/engine-render";
import { UniverFormulaEnginePlugin } from "@univerjs/engine-formula";
import { UniverUIPlugin } from "@univerjs/ui";
import { UniverSheetsPlugin } from "@univerjs/sheets";
import { UniverSheetsUIPlugin } from "@univerjs/sheets-ui";
import { UniverSheetsNumfmtPlugin } from "@univerjs/sheets-numfmt";
import { UniverSheetsFormulaPlugin } from "@univerjs/sheets-formula";
import { FUniver } from "@univerjs/facade";
import { SetRangeValuesMutation } from "@univerjs/sheets";
import * as XLSX from "xlsx";

// Univer CSS
import "@univerjs/design/lib/index.css";
import "@univerjs/ui/lib/index.css";
import "@univerjs/sheets-ui/lib/index.css";

// Vietnamese Locales for Univer
import designVi from "@univerjs/design/locale/vi-VN";
import uiVi from "@univerjs/ui/locale/vi-VN";
import sheetsVi from "@univerjs/sheets/locale/vi-VN";
import sheetsUIVi from "@univerjs/sheets-ui/locale/vi-VN";
import sheetsFormulaVi from "@univerjs/sheets-formula/locale/vi-VN";

export interface UniverSpreadsheetProps {
  initialData: any; // Univer IWorkbookData snapshot
  locked?: boolean;
  onReady?: (api: FUniver) => void;
  onCellChange?: (sheetName: string, cellRef: string, newValue: string | number) => void;
  onDataChange?: (data: any) => void;
  className?: string;
}

export const UniverSpreadsheet: React.FC<UniverSpreadsheetProps> = ({
  initialData,
  locked = false,
  onCellChange,
  onDataChange,
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const univerRef = useRef<Univer | null>(null);
  const onCellChangeRef = useRef(onCellChange);
  const onDataChangeRef = useRef(onDataChange);

  // Keep callback refs updated to avoid re-initializing Univer on callback identity changes
  useEffect(() => {
    onCellChangeRef.current = onCellChange;
    onDataChangeRef.current = onDataChange;
  }, [onCellChange, onDataChange]);

  useEffect(() => {
    if (!containerRef.current || !initialData) return;

    // Dispose previous instance if existing
    if (univerRef.current) {
      try {
        univerRef.current.dispose();
      } catch (err) {
        console.warn("Error disposing Univer instance:", err);
      }
      univerRef.current = null;
    }
//     useEffect(() => {
//     if (!containerRef.current) return;

//     const univer = new Univer({ /* cấu hình theme, locale... */ });
//     univerRef.current = univer;

//     // ... (Đăng ký các plugins như ở bước trước) ...

//     univer.createUnit(UniverInstanceType.UNIVER_SHEET, initialData);

//     // Tạo univerAPI từ instance univer
//     const facadeAPI = FUniver.newAPI(univer);
    
//     // Bắn API ra ngoài cho component cha sử dụng
//     if (onReady) {
//       onReady(facadeAPI);
//     }

//     return () => {
//       univer.dispose();
//       univerRef.current = null;
//     };
//   }, [initialData, onReady]);

//   return <div ref={containerRef} className="w-full h-full min-h-[600px]" />;
// };

    // Merge Vietnamese locale bundle
    const viLocales = Object.assign(
      {},
      designVi,
      uiVi,
      sheetsVi,
      sheetsUIVi,
      sheetsFormulaVi
    );

    // 1. Initialize Univer Instance
    const univer = new Univer({
      locale: LocaleType.VI_VN,
      locales: {
        [LocaleType.VI_VN]: viLocales,
      },
    });
    univerRef.current = univer;

    // 2. Register Core & UI Plugins
    univer.registerPlugin(UniverRenderEnginePlugin);
    univer.registerPlugin(UniverFormulaEnginePlugin);

    univer.registerPlugin(UniverUIPlugin, {
      container: containerRef.current,
      header: true, // Display Ribbon Toolbar
      footer: true, // Display Sheet Tabs & Status Bar
    });

    univer.registerPlugin(UniverSheetsPlugin);
    univer.registerPlugin(UniverSheetsUIPlugin);
    univer.registerPlugin(UniverSheetsNumfmtPlugin);
    univer.registerPlugin(UniverSheetsFormulaPlugin);

    // 3. Create Spreadsheet Unit from JSON Snapshot
    const workbook = univer.createUnit(UniverInstanceType.UNIVER_SHEET, initialData);

    // 4. Setup Event Listeners via Facade API
    try {
      const facade = FUniver.newAPI(univer as any);
      const activeWorkbook = facade.getActiveWorkbook();

      if (activeWorkbook) {
        // Listen for user cell modifications in real-time
        facade.onCommandExecuted((command: any) => {
          if (!command) return;

          // Check if cell value mutation occurred
          if (command.id === SetRangeValuesMutation.id || command.id === "sheet.mutation.set-range-values") {
            const params = command.params;
            if (params && params.cellValue) {
              const subUnitId = params.subUnitId;
              const worksheet = activeWorkbook.getSheetBySheetId(subUnitId);
              const sheetName = worksheet?.getSheetName() || "Sheet1";

              const cellValueMap = params.cellValue;
              Object.keys(cellValueMap).forEach((rStr) => {
                const r = Number(rStr);
                const colMap = cellValueMap[r];
                if (colMap) {
                  Object.keys(colMap).forEach((cStr) => {
                    const c = Number(cStr);
                    const cellObj = colMap[c];
                    const cellRef = XLSX.utils.encode_cell({ r, c });
                    const val = cellObj?.v !== undefined && cellObj?.v !== null ? cellObj.v : "";

                    if (onCellChangeRef.current) {
                      onCellChangeRef.current(sheetName, cellRef, val);
                    }
                  });
                }
              });

              if (onDataChangeRef.current && workbook) {
                const snapshot = (workbook as any).save ? (workbook as any).save() : (workbook as any).getSnapshot?.();
                onDataChangeRef.current(snapshot);
              }
            }
          }
        });
      }
    } catch (err) {
      console.warn("Could not attach Univer Facade event listeners:", err);
    }

    // 5. Cleanup on unmount or project change
    return () => {
      if (univerRef.current) {
        try {
          univerRef.current.dispose();
        } catch (err) {
          console.warn("Error cleaning up Univer instance:", err);
        }
        univerRef.current = null;
      }
    };
  }, [initialData]);

  return (
    <div
      className={`relative w-full h-full flex flex-col min-h-[580px] overflow-hidden bg-white ${className}`}
    >
      <div
        ref={containerRef}
        className="w-full h-full flex-1 overflow-hidden"
        style={{ minHeight: "580px" }}
      />
    </div>
  );
};