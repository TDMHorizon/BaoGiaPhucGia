"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export interface Step {
  id: number;
  label: string;
  description?: string;
}

export interface StepperProps {
  /** Array of steps */
  steps: Step[];
  /** Current active step (1-indexed) */
  currentStep: number;
  /** Click handler for step navigation */
  onStepClick?: (step: number) => void;
  /** Orientation layout */
  orientation?: "horizontal" | "vertical";
  /** Show step numbers */
  showNumbers?: boolean;
  /** Additional classes */
  className?: string;
}

/**
 * Stepper - Step indicator for multi-step flows
 *
 * Supports horizontal and vertical orientations
 * States: completed, active, inactive
 */
export function Stepper({
  steps,
  currentStep,
  onStepClick,
  orientation = "horizontal",
  showNumbers = true,
  className,
}: StepperProps) {
  const isHorizontal = orientation === "horizontal";

  return (
    <div
      className={cn(
        "flex",
        isHorizontal ? "items-center" : "flex-col",
        className
      )}
    >
      {steps.map((step, index) => {
        const isCompleted = step.id < currentStep;
        const isActive = step.id === currentStep;
        const isClickable = onStepClick && !isCompleted;

        return (
          <React.Fragment key={step.id}>
            {/* Step node */}
            <div
              className={cn(
                "flex flex-col items-center gap-2",
                !isHorizontal && "flex-row"
              )}
            >
              {/* Step circle */}
              <button
                type="button"
                onClick={() => isClickable && onStepClick(step.id)}
                disabled={!isClickable}
                className={cn(
                  "flex items-center justify-center",
                  "w-8 h-8 rounded-full font-semibold text-sm",
                  "transition-all duration-200",
                  "border-2",
                  isCompleted && [
                    "bg-primary text-primary-foreground border-primary",
                    "hover:bg-primary/90",
                  ],
                  isActive && [
                    "bg-primary text-primary-foreground border-primary",
                    "shadow-lg shadow-primary/25",
                  ],
                  !isCompleted && !isActive && [
                    "bg-surface-variant text-on-surface-variant border-outline",
                    isClickable && "cursor-pointer hover:border-primary/50",
                  ],
                  !isClickable && "cursor-default"
                )}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4" strokeWidth={3} />
                ) : showNumbers ? (
                  step.id
                ) : (
                  <span className="w-2 h-2 rounded-full bg-current" />
                )}
              </button>

              {/* Step label */}
              <div
                className={cn(
                  "flex flex-col",
                  !isHorizontal && "items-start",
                  isHorizontal && "text-center min-w-[80px]"
                )}
              >
                <span
                  className={cn(
                    "text-sm font-medium whitespace-nowrap",
                    isActive && "text-primary",
                    !isActive && "text-on-surface-variant"
                  )}
                >
                  {step.label}
                </span>
                {step.description && (
                  <span className="text-xs text-on-surface-variant opacity-75">
                    {step.description}
                  </span>
                )}
              </div>
            </div>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "bg-border transition-colors duration-200",
                  isHorizontal
                    ? "flex-1 h-0.5 mx-3 min-w-[24px]"
                    : "w-0.5 h-8 ml-4",
                  steps[index + 1].id <= currentStep && "bg-primary"
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// Compact variant for tight spaces
export interface StepperCompactProps {
  steps: Step[];
  currentStep: number;
  className?: string;
}

export function StepperCompact({
  steps,
  currentStep,
  className,
}: StepperCompactProps) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {steps.map((step, index) => (
        <React.Fragment key={step.id}>
          <div
            className={cn(
              "w-2.5 h-2.5 rounded-full transition-colors duration-200",
              step.id < currentStep && "bg-primary",
              step.id === currentStep && "bg-primary ring-4 ring-primary/20",
              step.id > currentStep && "bg-border"
            )}
            title={step.label}
          />
          {index < steps.length - 1 && (
            <div
              className={cn(
                "w-6 h-0.5",
                steps[index + 1].id <= currentStep ? "bg-primary" : "bg-border"
              )}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
