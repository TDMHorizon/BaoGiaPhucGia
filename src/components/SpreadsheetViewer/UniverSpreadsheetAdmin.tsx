import React, { useEffect, useRef } from 'react';
import { Univer, UniverInstanceType, ICommandService } from '@univerjs/core';
import { defaultTheme } from '@univerjs/design';
import { UniverRenderEnginePlugin } from '@univerjs/engine-render';
import { UniverFormulaEnginePlugin } from '@univerjs/engine-formula';
import { UniverUIPlugin } from '@univerjs/ui';
import { UniverSheetsPlugin } from '@univerjs/sheets';
import { UniverSheetsUIPlugin, SetCellEditVisibleOperation } from '@univerjs/sheets-ui';
import { UniverSheetsNumfmtPlugin } from '@univerjs/sheets-numfmt';
import { UniverSheetsFormulaPlugin } from '@univerjs/sheets-formula';
import { FUniver } from '@univerjs/facade';
import * as XLSX from 'xlsx';

import '@univerjs/design/lib/index.css';
import '@univerjs/ui/lib/index.css';
import '@univerjs/sheets-ui/lib/index.css';
import '@univerjs/sheets-numfmt/lib/index.css';
import '@univerjs/sheets-formula/lib/index.css';

interface UniverSpreadsheetProps {
    initialData?: any;
    activeSheet?: string;
    mode?: 'admin' | 'user';
    editableRange?: string;
    locked?: boolean;
    onReady?: (api: FUniver) => void;
    onRangeSelect?: (sheetName: string, range: string) => void;
    onCellDoubleClick?: (sheetName: string, cellRef: string, value: string, r: number, c: number) => void;
}

export const UniverSpreadsheet: React.FC<UniverSpreadsheetProps> = ({
                                                                        initialData = {},
                                                                        mode = 'user',
                                                                        onReady,
                                                                        onRangeSelect,
                                                                        onCellDoubleClick
                                                                    }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const univerRef = useRef<Univer | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const univer = new Univer({ theme: defaultTheme, locale: 'vi-VN' });
        univerRef.current = univer;

        // Khởi tạo các Plugins
        univer.registerPlugin(UniverRenderEnginePlugin);
        univer.registerPlugin(UniverFormulaEnginePlugin);
        univer.registerPlugin(UniverUIPlugin, {
            container: containerRef.current,
            header: true, // Thanh công cụ hiện đại
            footer: true, // Tabs ở dưới
        });
        univer.registerPlugin(UniverSheetsPlugin);
        univer.registerPlugin(UniverSheetsUIPlugin);
        univer.registerPlugin(UniverSheetsNumfmtPlugin);
        univer.registerPlugin(UniverSheetsFormulaPlugin);

        // Gắn dữ liệu
        univer.createUnit(UniverInstanceType.UNIVER_SHEET, initialData);
        const facadeAPI = FUniver.newAPI(univer);

        if (onReady) onReady(facadeAPI);

        const commandService = univer.__getInjector().get(ICommandService);

        // 1. BẮT SỰ KIỆN DOUBLE-CLICK (Sửa dữ liệu)
        commandService.beforeCommandExecuted((commandInfo) => {
            // SetCellEditVisibleOperation là command bắn ra khi user double-click vào 1 ô
            if (commandInfo.id === SetCellEditVisibleOperation.id && mode === 'admin') {
                const activeSheet = facadeAPI.getActiveWorkbook()?.getActiveSheet();
                const selection = activeSheet?.getSelection().getActiveRange();

                if (selection && onCellDoubleClick) {
                    const r = selection.getRow();
                    const c = selection.getColumn();
                    const cellRef = XLSX.utils.encode_cell({ r, c });
                    const value = String(activeSheet.getRange(r, c).getValue() ?? "");

                    // Bắn sự kiện ra ngoài mở Dialog sửa dữ liệu
                    onCellDoubleClick(activeSheet.getSheetName(), cellRef, value, r, c);

                    // Throws Error để hủy hành động chỉnh sửa inline mặc định của Univer
                    throw new Error("Intercepted by Admin System");
                }
            }
        });

        // 2. BẮT SỰ KIỆN SINGLE-CLICK (Cấp quyền & Tô xanh lá)
        facadeAPI.onCommandExecuted((commandInfo) => {
            if (commandInfo.id === 'sheet.operation.set-selections' && mode === 'admin') {
                const activeSheet = facadeAPI.getActiveWorkbook()?.getActiveSheet();
                if (!activeSheet) return;

                const selection = activeSheet.getSelection().getActiveRange();
                if (!selection) return;

                // Tính toán chuỗi tọa độ (Ví dụ: A1 hoặc A1:B5)
                const startRow = selection.getRow();
                const startCol = selection.getColumn();
                const endRow = startRow + selection.getHeight() - 1;
                const endCol = startCol + selection.getWidth() - 1;

                const startRef = XLSX.utils.encode_cell({ r: startRow, c: startCol });
                const endRef = XLSX.utils.encode_cell({ r: endRow, c: endCol });
                const rangeStr = startRef === endRef ? startRef : `${startRef}:${endRef}`;

                // Tô màu xanh lá mạ trực tiếp trên Univer (Chỉ hiển thị tạm thời)
                // Lưu ý: Tùy logic bạn muốn tô màu thật hay chỉ báo hiệu.
                // selection.setBackgroundColor('#dcfce7');

                if (onRangeSelect) {
                    onRangeSelect(activeSheet.getSheetName(), rangeStr);
                }
            }
        });

        return () => {
            univer.dispose();
            univerRef.current = null;
        };
    }, [initialData, mode]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="flex flex-col w-full h-full bg-slate-50 overflow-hidden">
            <div
                ref={containerRef}
                className="w-full h-full flex-grow bg-white overflow-hidden"
            />
        </div>
    );
};