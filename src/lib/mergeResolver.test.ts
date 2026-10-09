import { describe, it, expect } from "vitest";
import { resolveMergeInfo, resolveMasterCellAddress, normalizeSelectionWithMerges } from "./mergeResolver";
import { logger } from "../../server/logger";

describe("Phase P1: Universal Merge Resolver & Formula Helper", () => {
  const sampleMerges = [
    { startRow: 1, endRow: 3, startColumn: 1, endColumn: 3 }, // B2:D4
    { startRow: 5, endRow: 5, startColumn: 0, endColumn: 4 }, // A6:E6
  ];

  it("should identify Master Cell correctly when clicking directly on master cell", () => {
    const info = resolveMergeInfo(1, 1, sampleMerges); // B2
    expect(info.isMerged).toBe(true);
    expect(info.isMaster).toBe(true);
    expect(info.masterCell.address).toBe("B2");
    expect(info.rangeRef).toBe("B2:D4");
  });

  it("should resolve covered slave cell C3 back to Master Cell B2", () => {
    const info = resolveMergeInfo(2, 2, sampleMerges); // C3
    expect(info.isMerged).toBe(true);
    expect(info.isMaster).toBe(false);
    expect(info.masterCell.address).toBe("B2");
    expect(info.masterCell.row).toBe(1);
    expect(info.masterCell.column).toBe(1);
    expect(info.rangeRef).toBe("B2:D4");

    const resolvedAddress = resolveMasterCellAddress("C3", sampleMerges);
    expect(resolvedAddress).toBe("B2");

    logger.testVerification("PHASE_P1", "Resolve Slave Cell C3 to Master Cell B2", true, {
      inputCell: "C3",
      resolvedMasterCell: resolvedAddress,
      mergeRange: "B2:D4",
    });
  });

  it("should resolve single cell outside merge range as itself", () => {
    const info = resolveMergeInfo(0, 0, sampleMerges); // A1
    expect(info.isMerged).toBe(false);
    expect(info.isMaster).toBe(true);
    expect(info.masterCell.address).toBe("A1");
    expect(info.rangeRef).toBe("A1");
  });

  it("should normalize single-click selection on merge range to full range ref", () => {
    const selection = { startRow: 2, endRow: 2, startColumn: 2, endColumn: 2 }; // clicked C3
    const result = normalizeSelectionWithMerges(selection, sampleMerges);
    expect(result.selectionStr).toBe("B2:D4");
    expect(result.masterCell.address).toBe("B2");
  });
});
