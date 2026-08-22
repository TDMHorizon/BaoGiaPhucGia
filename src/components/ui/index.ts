// UI Components Library - Phase 6
// Stitch Design System compliant components

// Status
export { StatusBadge, SuccessBadge, WarningBadge, ErrorBadge, InfoBadge } from "./status-badge";
export type { StatusBadgeProps, StatusVariant } from "./status-badge";

// Stats
export { StatsCard } from "./stats-card";
export type { StatsCardProps } from "./stats-card";

// Stepper
export { Stepper, StepperCompact } from "./stepper";
export type { StepperProps, StepperCompactProps, Step } from "./stepper";

// Search
export { SearchInput } from "./search-input";
export type { SearchInputProps } from "./search-input";

// Filter
export { FilterSelect, MultiFilterSelect } from "./filter-select";
export type { FilterSelectProps, FilterOption, MultiFilterSelectProps } from "./filter-select";

// Table
export { DataTable, ExpandableDataTable } from "./data-table";
export type { DataTableProps, Column, ExpandableDataTableProps } from "./data-table";

// Pagination
export { Pagination, PageSizeSelector } from "./pagination";
export type { PaginationProps, PageSizeSelectorProps } from "./pagination";

// Form
export { FormInput, FormTextarea } from "./form-input";
export type { FormInputProps, FormTextareaProps } from "./form-input";

// Navigation
export { TopNav, MobileTopNav } from "./top-nav";
export type { TopNavProps, NavItem, MobileTopNavProps } from "./top-nav";

// Base components (from existing)
export { Button, buttonVariants } from "./button";
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
} from "./card";
export type { CardPadding } from "./card";
export { Input } from "./input";
export { Label } from "./label";
export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./select";
export { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
export { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "./dialog";
