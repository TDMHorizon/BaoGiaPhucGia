import { describe, it, expect } from 'vitest';
import { PermissionEngine } from './permissionEngine';

describe('PermissionEngine', () => {
  it('should parse single cells, 2D ranges, column and row ranges properly', () => {
    const parsed = PermissionEngine.parseRanges(['A1', 'B2:D4', 'E:F', '10:15']);
    expect(parsed.length).toBe(4);

    // A1
    expect(parsed[0].startRow).toBe(0);
    expect(parsed[0].startCol).toBe(0);

    // B2:D4
    expect(parsed[1].startRow).toBe(1);
    expect(parsed[1].endRow).toBe(3);
    expect(parsed[1].startCol).toBe(1);
    expect(parsed[1].endCol).toBe(3);

    // E:F
    expect(parsed[2].isFullCol).toBe(true);
    expect(parsed[2].startCol).toBe(4);
    expect(parsed[2].endCol).toBe(5);

    // 10:15
    expect(parsed[3].isFullRow).toBe(true);
    expect(parsed[3].startRow).toBe(9);
    expect(parsed[3].endRow).toBe(14);
  });

  it('should verify isCellInRange correctly with semicolon/comma delimiters', () => {
    const rangeList = 'A8:H10; K1:M5, 20:25';
    expect(PermissionEngine.isCellInRange('A8', rangeList)).toBe(true);
    expect(PermissionEngine.isCellInRange('H10', rangeList)).toBe(true);
    expect(PermissionEngine.isCellInRange('G9', rangeList)).toBe(true);
    expect(PermissionEngine.isCellInRange('L3', rangeList)).toBe(true);
    expect(PermissionEngine.isCellInRange('Z22', rangeList)).toBe(true); // row 22 is in 20:25
    expect(PermissionEngine.isCellInRange('A11', rangeList)).toBe(false);
    expect(PermissionEngine.isCellInRange('J2', rangeList)).toBe(false);
  });

  it('should enforce Edit implies Read principle in canReadCell', () => {
    const grants = {
      read: ['A1:D5'],
      edit: ['A8:H10'], // edit is outside explicit read
    };

    // Cell in edit range A8:H10 (row 7, col 6 -> G8) is automatically readable
    expect(PermissionEngine.canReadCell(7, 6, grants)).toBe(true);
    expect(PermissionEngine.canEditCell(7, 6, grants)).toBe(true);

    // Cell in read range A1:D5 (row 0, col 0 -> A1) is readable but NOT editable
    expect(PermissionEngine.canReadCell(0, 0, grants)).toBe(true);
    expect(PermissionEngine.canEditCell(0, 0, grants)).toBe(false);

    // Cell outside both (row 15, col 10) is neither readable nor editable
    expect(PermissionEngine.canReadCell(15, 10, grants)).toBe(false);
    expect(PermissionEngine.canEditCell(15, 10, grants)).toBe(false);
  });

  it('should check isRangeSubset for copy/paste validation', () => {
    const allowed = PermissionEngine.parseRanges(['A8:H15']);
    const targetValid = PermissionEngine.parseRanges(['B9:D12'])[0];
    const targetInvalid = PermissionEngine.parseRanges(['B9:I12'])[0]; // exceeds column H

    expect(PermissionEngine.isRangeSubset(targetValid, allowed)).toBe(true);
    expect(PermissionEngine.isRangeSubset(targetInvalid, allowed)).toBe(false);
  });
});
