declare module '@univerjs/presets' {
  export const LocaleType: {
    VI_VN: string;
    EN_US: string;
    ZH_CN: string;
  };
  export function createUniver(config: any): {
    univer: any;
    univerAPI: any;
  };
  export function mergeLocales(...locales: any[]): any;
}

declare module '@univerjs/preset-sheets-core' {
  export function UniverSheetsCorePreset(options?: any): any;
}

declare module '@univerjs/preset-sheets-core/locales/vi-VN' {
  const ViVN: any;
  export default ViVN;
}

declare module '@univerjs/core' {
  export interface IWorkbookData {
    [key: string]: any;
  }
  export interface IWorksheetData {
    [key: string]: any;
  }
  export interface ICellData {
    v?: any;
    f?: string;
    s?: any;
    [key: string]: any;
  }
  export interface IStyleData {
    bl?: number;
    it?: number;
    fs?: number;
    ff?: string;
    cl?: { rgb?: string };
    bg?: { rgb?: string };
    ht?: number;
    vt?: number;
    tb?: number;
    bd?: any;
    n?: any;
    [key: string]: any;
  }
  export interface IRange {
    startRow: number;
    endRow: number;
    startColumn: number;
    endColumn: number;
  }
  export interface IBorderData {
    [key: string]: any;
  }
  export enum WrapStrategy {
    UNSPECIFIED = 0,
    OVERFLOW = 1,
    CLIP = 2,
    WRAP = 3,
  }
}

declare module 'vitest' {
  export interface TestFunction {
    (name: string, fn: () => void | Promise<void>): void;
    each: (cases: any[]) => (name: string, fn: (...args: any[]) => void | Promise<void>) => void;
  }
  export const it: TestFunction;
  export const test: TestFunction;
  export const describe: {
    (name: string, fn: () => void): void;
    each: (cases: any[]) => (name: string, fn: (...args: any[]) => void | Promise<void>) => void;
  };
  export function expect(actual: any): any;
  export function beforeEach(fn: () => void | Promise<void>): void;
  export function afterEach(fn: () => void | Promise<void>): void;
}

declare module 'vitest/config' {
  export function defineConfig(config: any): any;
}
