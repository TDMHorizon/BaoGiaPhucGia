import React, { useEffect, useRef, useState } from "react";
import { Univer, UniverInstanceType, LocaleType } from "@univerjs/core";
import { UniverRenderEnginePlugin } from "@univerjs/engine-render";
import { UniverFormulaEnginePlugin } from "@univerjs/engine-formula";
import { UniverUIPlugin } from "@univerjs/ui";
import { UniverDocsPlugin } from "@univerjs/docs";
import { UniverDocsUIPlugin } from "@univerjs/docs-ui";
import { UniverSheetsPlugin } from "@univerjs/sheets";
import { UniverSheetsUIPlugin } from "@univerjs/sheets-ui";
import { UniverSheetsNumfmtPlugin } from "@univerjs/sheets-numfmt";
import { UniverSheetsFormulaPlugin } from "@univerjs/sheets-formula";
import { FUniver } from "@univerjs/facade";
import { SetRangeValuesMutation } from "@univerjs/sheets";
import * as XLSX from "xlsx";
import { isCellInEditableRange } from "../../lib/utils-excel";

// Univer CSS
import "@univerjs/design/lib/index.css";
import "@univerjs/ui/lib/index.css";
import "@univerjs/docs-ui/lib/index.css";
import "@univerjs/sheets-ui/lib/index.css";

// Vietnamese Locales for Univer
import designVi from "@univerjs/design/locale/vi-VN";
import uiVi from "@univerjs/ui/locale/vi-VN";
import docsUIVi from "@univerjs/docs-ui/locale/vi-VN";
import sheetsVi from "@univerjs/sheets/locale/vi-VN";
import sheetsUIVi from "@univerjs/sheets-ui/locale/vi-VN";
import sheetsFormulaVi from "@univerjs/sheets-formula/locale/vi-VN";

export interface UniverSpreadsheetProps {
  initialData: any; // Univer IWorkbookData snapshot
  activeSheet?: string;
  locked?: boolean;
  mode?: "admin" | "user";
  editableRange?: string;
  onReady?: (api: FUniver) => void;
  onCellChange?: (sheetName: string, cellRef: string, newValue: string | number) => void;
  onSheetChange?: (sheetName: string) => void;
  onDataChange?: (data: any) => void;
  onRangeSelect?: (sheetName: string, rangeStr: string) => void;
  onCellDoubleClick?: (sheetName: string, cellRef: string, currentValue: string, r: number, c: number) => void;
  className?: string;
}

export const UniverSpreadsheet: React.FC<UniverSpreadsheetProps> = ({
  initialData,
  activeSheet,
  locked = false,
  mode = "admin",
  editableRange = "",
  onReady,
  onCellChange,
  onSheetChange,
  onDataChange,
  onRangeSelect,
  onCellDoubleClick,
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const univerRef = useRef<Univer | null>(null);
  const facadeRef = useRef<any>(null);
  const currentDataIdRef = useRef<string | null>(null);
  const lastSelectedRangeRef = useRef<{ sheetName: string; cellRef: string; r: number; c: number; value: string } | null>(null);

  const onReadyRef = useRef(onReady);
  const onCellChangeRef = useRef(onCellChange);
  const onSheetChangeRef = useRef(onSheetChange);
  const onDataChangeRef = useRef(onDataChange);
  const onRangeSelectRef = useRef(onRangeSelect);
  const onCellDoubleClickRef = useRef(onCellDoubleClick);

  // Keep callback refs updated to avoid re-initializing Univer on callback identity changes
  useEffect(() => {
    onReadyRef.current = onReady;
    onCellChangeRef.current = onCellChange;
    onSheetChangeRef.current = onSheetChange;
    onDataChangeRef.current = onDataChange;
    onRangeSelectRef.current = onRangeSelect;
    onCellDoubleClickRef.current = onCellDoubleClick;
  }, [onReady, onCellChange, onSheetChange, onDataChange, onRangeSelect, onCellDoubleClick]);

  // Helper to reliably activate a worksheet in Univer by name or id
  const activateWorksheet = (sheetNameOrId?: string) => {
    if (!facadeRef.current || !sheetNameOrId) return;
    try {
      const activeWb = facadeRef.current.getActiveWorkbook?.();
      if (!activeWb) return;
      const allSheets = activeWb.getSheets?.() || [];
      const targetSheet =
        activeWb.getSheetByName?.(sheetNameOrId) ||
        activeWb.getSheetBySheetId?.(sheetNameOrId) ||
        allSheets.find(
          (s: any) =>
            s.getSheetName?.() === sheetNameOrId ||
            s.getSheetId?.() === sheetNameOrId ||
            s.getSheetName?.()?.trim().toLowerCase() === sheetNameOrId.trim().toLowerCase()
        );
      if (targetSheet && activeWb.setActiveSheet) {
        activeWb.setActiveSheet(targetSheet);
      }
    } catch (err) {
      console.warn("Could not set active sheet in Univer:", err);
    }
  };

  // Synchronize active sheet when activeSheet prop changes
  useEffect(() => {
    if (activeSheet) {
      activateWorksheet(activeSheet);
    }
  }, [activeSheet]);

  // Handle double click on cell
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleDblClick = (event: MouseEvent) => {
      if (lastSelectedRangeRef.current) {
        const { sheetName, cellRef, value, r, c } = lastSelectedRangeRef.current;
        if (mode === "admin") {
          if (onCellDoubleClickRef.current) {
            onCellDoubleClickRef.current(sheetName, cellRef, value, r, c);
          }
        } else if (mode === "user") {
          if (locked || !isCellInEditableRange(cellRef, editableRange)) {
            event.preventDefault();
            event.stopPropagation();
          }
        }
      }
    };

    el.addEventListener("dblclick", handleDblClick, true);
    return () => {
      el.removeEventListener("dblclick", handleDblClick, true);
    };
  }, [mode, locked, editableRange, activeSheet]);

  useEffect(() => {
    if (!containerRef.current || !initialData) return;

    // Do NOT dispose and recreate Univer if it is already mounted for this workbook
    const dataKey = initialData.id || initialData.name || "default_unit";
    if (univerRef.current && currentDataIdRef.current === dataKey) {
      if (activeSheet) {
        activateWorksheet(activeSheet);
      }
      return;
    }
    currentDataIdRef.current = dataKey;

    // Dispose previous instance if existing
    if (univerRef.current) {
      try {
        univerRef.current.dispose();
      } catch (err) {
        console.warn("Error disposing Univer instance:", err);
      }
      univerRef.current = null;
    }

    // Merge Vietnamese locale bundle
    const viLocales = Object.assign(
      {},
      designVi,
      uiVi,
      docsUIVi,
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

    // 2. Register Core, Docs & UI Plugins (Enables rich cell editing & double click)
    univer.registerPlugin(UniverRenderEnginePlugin);
    univer.registerPlugin(UniverFormulaEnginePlugin);

    univer.registerPlugin(UniverUIPlugin, {
      container: containerRef.current,
      header: true, // Display Ribbon Toolbar
      footer: true, // Display Sheet Tabs & Status Bar
    });

    univer.registerPlugin(UniverDocsPlugin);
    univer.registerPlugin(UniverDocsUIPlugin);

    univer.registerPlugin(UniverSheetsPlugin);
    univer.registerPlugin(UniverSheetsUIPlugin);
    univer.registerPlugin(UniverSheetsNumfmtPlugin);
    univer.registerPlugin(UniverSheetsFormulaPlugin);

    // 3. Create Spreadsheet Unit from JSON Snapshot
    const workbook = univer.createUnit(UniverInstanceType.UNIVER_SHEET, initialData);

    // 4. Setup Event Listeners via Facade API
    try {
      const facade = FUniver.newAPI(univer as any);
      facadeRef.current = facade;
      
      // Expose facade API to parent
      if (onReady) {
        onReady(facade);
      }

      if (activeSheet) {
        setTimeout(() => {
          activateWorksheet(activeSheet);
        }, 30);
      }

      const activeWorkbook = facade.getActiveWorkbook();

      if (activeWorkbook) {
        // Debounce timer for emitting snapshot changes
        let debounceTimer: any = null;

        const emitSnapshot = () => {
          if (onDataChangeRef.current) {
            try {
              const snapshot = (workbook as any).save
                ? (workbook as any).save()
                : (workbook as any).getSnapshot
                ? (workbook as any).getSnapshot()
                : (activeWorkbook as any).getSnapshot?.();
              if (snapshot) {
                onDataChangeRef.current(snapshot);
              }
            } catch (err) {
              console.warn("Could not retrieve Univer snapshot:", err);
            }
          }
        };

        // Listen for direct selection change in Univer
        try {
          if ((activeWorkbook as any).onSelectionChange) {
            (activeWorkbook as any).onSelectionChange((selections: any[]) => {
              if (!selections || !Array.isArray(selections) || selections.length === 0) return;
              const primary = selections[0];
              const range = primary?.range || primary;
              if (!range || range.startRow === undefined || range.startColumn === undefined) return;

              const { startRow, endRow, startColumn, endColumn } = range;
              const start = XLSX.utils.encode_cell({ r: startRow, c: startColumn });
              const end = XLSX.utils.encode_cell({ r: endRow, c: endColumn });
              const rangePart = start === end ? start : `${start}:${end}`;

              const worksheet = activeWorkbook.getActiveSheet();
              const sheetName = worksheet?.getSheetName() || activeSheet || "Sheet1";

              try {
                const fRange = worksheet.getRange(
                  startRow,
                  startColumn,
                  endRow - startRow + 1,
                  endColumn - startColumn + 1
                );
                if (mode === "admin" && fRange?.setBackgroundColor) {
                  fRange.setBackgroundColor("#e6f9ed");
                }
                const cellVal = fRange?.getValue?.() ?? "";
                lastSelectedRangeRef.current = {
                  sheetName,
                  cellRef: start,
                  r: startRow,
                  c: startColumn,
                  value: String(cellVal !== undefined && cellVal !== null ? cellVal : ""),
                };
              } catch (err) {
                console.warn("Could not process selection range:", err);
              }

              if (onRangeSelectRef.current) {
                onRangeSelectRef.current(sheetName, rangePart);
              }
            });
          }
        } catch (err) {
          console.warn("Could not attach onSelectionChange listener:", err);
        }

        // Listen for all user actions, cell modifications, styling, row/col operations, and selections
        facade.onCommandExecuted((command: any) => {
          if (!command) return;

          // Check if active worksheet changed in Univer
          if (
            command.id === "sheet.operation.set-worksheet-active" ||
            command.id === "sheet.mutation.set-worksheet-active" ||
            command.id === "sheet.command.set-worksheet-active" ||
            command.id === "sheet.command.set-tab-active" ||
            command.id === "sheet.operation.set-tab-active"
          ) {
            const params = command.params;
            const subUnitId = params?.subUnitId || params?.unitId;
            if (subUnitId) {
              const worksheet =
                activeWorkbook.getSheetBySheetId(subUnitId) ||
                activeWorkbook.getSheetByName(subUnitId) ||
                activeWorkbook.getActiveSheet();
              const sheetName = worksheet?.getSheetName();
              if (sheetName && onSheetChangeRef.current) {
                onSheetChangeRef.current(sheetName);
              }
            }
          }

          // Check if selection changed (fallback)
          if (
            command.id === "sheet.operation.set-selections" ||
            command.id === "sheet.mutation.set-selections" ||
            command.id === "sheet.command.set-selections"
          ) {
            const params = command.params;
            const selections = params?.selections;
            if (selections && Array.isArray(selections) && selections.length > 0) {
              const subUnitId = params.subUnitId;
              const worksheet = subUnitId
                ? activeWorkbook.getSheetBySheetId(subUnitId) || activeWorkbook.getActiveSheet()
                : activeWorkbook.getActiveSheet();
              const sheetName = worksheet?.getSheetName() || "Sheet1";

              const primary = selections[0];
              const range = primary.range || primary;
              if (range && range.startRow !== undefined) {
                const { startRow, endRow, startColumn, endColumn } = range;
                const start = XLSX.utils.encode_cell({ r: startRow, c: startColumn });
                const end = XLSX.utils.encode_cell({ r: endRow, c: endColumn });
                const rangePart = start === end ? start : `${start}:${end}`;

                try {
                  const fRange = worksheet.getRange(
                    startRow,
                    startColumn,
                    endRow - startRow + 1,
                    endColumn - startColumn + 1
                  );
                  if (mode === "admin" && fRange?.setBackgroundColor) {
                    fRange.setBackgroundColor("#e6f9ed");
                  }
                  const cellVal = fRange?.getValue?.() ?? "";
                  lastSelectedRangeRef.current = {
                    sheetName,
                    cellRef: start,
                    r: startRow,
                    c: startColumn,
                    value: String(cellVal !== undefined && cellVal !== null ? cellVal : ""),
                  };
                } catch {}

                if (onRangeSelectRef.current) {
                  onRangeSelectRef.current(sheetName, rangePart);
                }
              }
            }
          }

          // Check if cell value mutation occurred for granular onCellChange
          if (
            command.id === SetRangeValuesMutation.id ||
            command.id === "sheet.mutation.set-range-values" ||
            command.id === "sheet.command.set-range-values"
          ) {
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
            }
          }

          // Debounce snapshot emit to avoid lag on fast typing / multi-cell drag operations
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            emitSnapshot();
          }, 150);
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