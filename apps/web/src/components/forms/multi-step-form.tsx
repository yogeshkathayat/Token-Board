'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import * as React from 'react';
import { FieldValues, FormProvider, useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ============================================
// Types & Interfaces
// ============================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ZodObjectSchema = z.ZodObject<any>;

// Generic form interface that works with any form shape
interface StepFormMethods {
  trigger: () => Promise<boolean>;
  getValues: () => FieldValues;
  setValue: (name: string, value: unknown) => void;
}

interface StepConfig {
  name: string;
  title: string;
  description?: string;
  schema?: ZodObjectSchema;
}

interface MultiStepFormContextValue {
  currentStep: number;
  totalSteps: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  goToStep: (step: number) => void;
  nextStep: () => Promise<boolean>;
  prevStep: () => void;
  formData: Record<string, unknown>;
  isSubmitting: boolean;
  steps: StepConfig[];
  registerStep: (step: StepConfig) => void;
  setStepData: (stepName: string, data: Record<string, unknown>) => void;
  getCurrentStepForm: () => StepFormMethods | null;
  setCurrentStepForm: (form: StepFormMethods | null) => void;
}

interface MultiStepFormProps {
  children: React.ReactNode;
  onComplete: (data: Record<string, unknown>) => void | Promise<void>;
  className?: string;
}

interface MultiStepFormStepProps {
  name: string;
  title: string;
  description?: string;
  schema?: ZodObjectSchema;
  children: React.ReactNode;
}

interface MultiStepFormProgressProps {
  variant?: 'dots' | 'steps' | 'progress-bar';
  showLabels?: boolean;
  className?: string;
}

interface MultiStepFormNavigationProps {
  nextLabel?: string;
  prevLabel?: string;
  submitLabel?: string;
  showPrevOnFirst?: boolean;
  className?: string;
}

interface UseMultiStepFormReturn {
  currentStep: number;
  totalSteps: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  goToStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  formData: Record<string, unknown>;
  isSubmitting: boolean;
}

// ============================================
// Context
// ============================================

const MultiStepFormContext = React.createContext<MultiStepFormContextValue | null>(null);

// ============================================
// Hook: useMultiStepForm
// ============================================

function useMultiStepForm(): UseMultiStepFormReturn {
  const context = React.useContext(MultiStepFormContext);

  if (!context) {
    throw new Error('useMultiStepForm must be used within a MultiStepFormProvider');
  }

  return {
    currentStep: context.currentStep,
    totalSteps: context.totalSteps,
    isFirstStep: context.isFirstStep,
    isLastStep: context.isLastStep,
    goToStep: context.goToStep,
    nextStep: () => {
      context.nextStep();
    },
    prevStep: context.prevStep,
    formData: context.formData,
    isSubmitting: context.isSubmitting,
  };
}

// Internal hook for accessing full context
function useMultiStepFormContext(): MultiStepFormContextValue {
  const context = React.useContext(MultiStepFormContext);

  if (!context) {
    throw new Error('useMultiStepFormContext must be used within a MultiStepFormProvider');
  }

  return context;
}

// ============================================
// Provider Component
// ============================================

interface MultiStepFormProviderProps {
  children: React.ReactNode;
  onComplete: (data: Record<string, unknown>) => void | Promise<void>;
}

function MultiStepFormProvider({ children, onComplete }: MultiStepFormProviderProps) {
  const [currentStep, setCurrentStep] = React.useState(0);
  const [steps, setSteps] = React.useState<StepConfig[]>([]);
  const [formData, setFormData] = React.useState<Record<string, unknown>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const currentStepFormRef = React.useRef<StepFormMethods | null>(null);

  const totalSteps = steps.length;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  const registerStep = React.useCallback((step: StepConfig) => {
    setSteps((prev) => {
      // Check if step already exists
      const existingIndex = prev.findIndex((s) => s.name === step.name);
      if (existingIndex >= 0) {
        // Update existing step
        const newSteps = [...prev];
        newSteps[existingIndex] = step;
        return newSteps;
      }
      // Add new step
      return [...prev, step];
    });
  }, []);

  const setStepData = React.useCallback((stepName: string, data: Record<string, unknown>) => {
    setFormData((prev) => ({
      ...prev,
      [stepName]: data,
    }));
  }, []);

  const getCurrentStepForm = React.useCallback(() => {
    return currentStepFormRef.current;
  }, []);

  const setCurrentStepForm = React.useCallback((form: StepFormMethods | null) => {
    currentStepFormRef.current = form;
  }, []);

  const validateCurrentStep = React.useCallback(async (): Promise<boolean> => {
    const currentForm = currentStepFormRef.current;
    if (!currentForm) return true;

    const isValid = await currentForm.trigger();
    return isValid;
  }, []);

  const nextStep = React.useCallback(async (): Promise<boolean> => {
    // Validate current step
    const isValid = await validateCurrentStep();
    if (!isValid) return false;

    // Get current form data and store it
    const currentForm = currentStepFormRef.current;
    if (currentForm && steps[currentStep]) {
      const values = currentForm.getValues();
      setStepData(steps[currentStep].name, values);
    }

    if (isLastStep) {
      // Submit the form
      setIsSubmitting(true);
      try {
        // Merge all step data
        const finalData = { ...formData };
        if (currentForm && steps[currentStep]) {
          finalData[steps[currentStep].name] = currentForm.getValues();
        }
        await onComplete(finalData);
      } finally {
        setIsSubmitting(false);
      }
      return true;
    }

    setCurrentStep((prev) => Math.min(prev + 1, totalSteps - 1));
    return true;
  }, [currentStep, formData, isLastStep, onComplete, setStepData, steps, totalSteps, validateCurrentStep]);

  const prevStep = React.useCallback(() => {
    // Save current form data before going back
    const currentForm = currentStepFormRef.current;
    if (currentForm && steps[currentStep]) {
      const values = currentForm.getValues();
      setStepData(steps[currentStep].name, values);
    }

    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, [currentStep, setStepData, steps]);

  const goToStep = React.useCallback(
    async (step: number) => {
      if (step < 0 || step >= totalSteps) return;

      // If going forward, validate current step first
      if (step > currentStep) {
        const isValid = await validateCurrentStep();
        if (!isValid) return;

        // Save current form data
        const currentForm = currentStepFormRef.current;
        if (currentForm && steps[currentStep]) {
          const values = currentForm.getValues();
          setStepData(steps[currentStep].name, values);
        }
      } else {
        // Going backward - save current data without validation
        const currentForm = currentStepFormRef.current;
        if (currentForm && steps[currentStep]) {
          const values = currentForm.getValues();
          setStepData(steps[currentStep].name, values);
        }
      }

      setCurrentStep(step);
    },
    [currentStep, setStepData, steps, totalSteps, validateCurrentStep],
  );

  const value: MultiStepFormContextValue = {
    currentStep,
    totalSteps,
    isFirstStep,
    isLastStep,
    goToStep,
    nextStep,
    prevStep,
    formData,
    isSubmitting,
    steps,
    registerStep,
    setStepData,
    getCurrentStepForm,
    setCurrentStepForm,
  };

  return <MultiStepFormContext.Provider value={value}>{children}</MultiStepFormContext.Provider>;
}

// ============================================
// MultiStepForm Component
// ============================================

function MultiStepForm({ children, onComplete, className }: MultiStepFormProps) {
  return (
    <MultiStepFormProvider onComplete={onComplete}>
      <div className={cn('space-y-6', className)}>{children}</div>
    </MultiStepFormProvider>
  );
}

// ============================================
// MultiStepFormStep Component
// ============================================

function MultiStepFormStep({ name, title, description, schema, children }: MultiStepFormStepProps) {
  const context = useMultiStepFormContext();
  const { currentStep, steps, registerStep, formData, setCurrentStepForm } = context;

  // Register this step on mount
  React.useEffect(() => {
    registerStep({ name, title, description, schema });
  }, [name, title, description, schema, registerStep]);

  // Find this step's index
  const stepIndex = steps.findIndex((s) => s.name === name);
  const isActive = stepIndex === currentStep;

  // Get initial values for this step from stored data
  const initialValues = (formData[name] as Record<string, unknown>) || {};

  // Create form for this step
  const form = useForm({
    resolver: schema ? zodResolver(schema) : undefined,
    defaultValues: initialValues,
    mode: 'onBlur',
  });

  // Keep stable refs to avoid form/formData in useEffect deps (they change every render)
  const formRef = React.useRef(form);
  formRef.current = form;
  const formDataRef = React.useRef(formData);
  formDataRef.current = formData;

  // Update form values when step becomes active and has stored data
  React.useEffect(() => {
    if (isActive && formDataRef.current[name]) {
      const storedData = formDataRef.current[name] as Record<string, unknown>;
      Object.entries(storedData).forEach(([key, value]) => {
        formRef.current.setValue(key, value);
      });
    }
  }, [isActive, name]);

  // Register/unregister form with context
  React.useEffect(() => {
    if (isActive) {
      // Extract only the methods we need to avoid type conflicts
      setCurrentStepForm({
        trigger: formRef.current.trigger,
        getValues: formRef.current.getValues,
        setValue: formRef.current.setValue,
      });
    }
    return () => {
      if (isActive) {
        setCurrentStepForm(null);
      }
    };
  }, [isActive, setCurrentStepForm]);

  // Don't render if not active or not yet registered
  if (stepIndex === -1 || !isActive) {
    return null;
  }

  return (
    <FormProvider {...form}>
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        <div className="space-y-4">{children}</div>
      </div>
    </FormProvider>
  );
}

// ============================================
// MultiStepFormProgress Component
// ============================================

function MultiStepFormProgress({ variant = 'dots', showLabels = false, className }: MultiStepFormProgressProps) {
  const { currentStep, totalSteps, steps, goToStep } = useMultiStepFormContext();

  if (totalSteps === 0) return null;

  const progressPercentage = ((currentStep + 1) / totalSteps) * 100;

  // Dots variant
  if (variant === 'dots') {
    return (
      <div className={cn('flex items-center justify-center gap-2', className)}>
        {steps.map((step, index) => {
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;

          return (
            <button
              key={step.name}
              type="button"
              onClick={() => goToStep(index)}
              className={cn(
                'h-2 w-2 rounded-full transition-colors',
                isActive || isCompleted ? 'bg-primary' : 'bg-primary/30',
              )}
              aria-label={`Go to step ${index + 1}: ${step.title}`}
            />
          );
        })}
      </div>
    );
  }

  // Steps variant
  if (variant === 'steps') {
    return (
      <div className={cn('w-full', className)}>
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;

            return (
              <React.Fragment key={step.name}>
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => goToStep(index)}
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'border-primary bg-primary text-primary-foreground'
                        : isCompleted
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-muted bg-background text-muted-foreground',
                    )}
                    aria-label={`Go to step ${index + 1}: ${step.title}`}
                  >
                    {isCompleted ? <CheckIcon className="h-4 w-4" /> : index + 1}
                  </button>
                  {showLabels && (
                    <span
                      className={cn(
                        'mt-2 text-xs font-medium',
                        isActive || isCompleted ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {step.title}
                    </span>
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div className={cn('h-0.5 flex-1 mx-2', index < currentStep ? 'bg-primary' : 'bg-muted')} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  }

  // Progress bar variant
  if (variant === 'progress-bar') {
    return (
      <div className={cn('w-full space-y-2', className)}>
        {showLabels && (
          <div className="flex justify-between text-sm">
            <span className="font-medium">{steps[currentStep]?.title}</span>
            <span className="text-muted-foreground">
              Step {currentStep + 1} of {totalSteps}
            </span>
          </div>
        )}
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300 ease-in-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>
    );
  }

  return null;
}

// ============================================
// MultiStepFormNavigation Component
// ============================================

function MultiStepFormNavigation({
  nextLabel = 'Next',
  prevLabel = 'Previous',
  submitLabel = 'Submit',
  showPrevOnFirst = false,
  className,
}: MultiStepFormNavigationProps) {
  const { isFirstStep, isLastStep, nextStep, prevStep, isSubmitting } = useMultiStepFormContext();

  const handleNext = async (e: React.MouseEvent) => {
    e.preventDefault();
    await nextStep();
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.preventDefault();
    prevStep();
  };

  return (
    <div className={cn('flex justify-between pt-4', className)}>
      <div>
        {(showPrevOnFirst || !isFirstStep) && (
          <Button type="button" variant="outline" onClick={handlePrev} disabled={isFirstStep || isSubmitting}>
            {prevLabel}
          </Button>
        )}
      </div>
      <Button type="button" onClick={handleNext} disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
            {submitLabel}...
          </>
        ) : isLastStep ? (
          submitLabel
        ) : (
          nextLabel
        )}
      </Button>
    </div>
  );
}

// ============================================
// Icons
// ============================================

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function LoaderIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

// ============================================
// Exports
// ============================================

export {
  MultiStepFormProvider,
  MultiStepForm,
  MultiStepFormProgress,
  MultiStepFormStep,
  MultiStepFormNavigation,
  useMultiStepForm,
};

export type {
  MultiStepFormProps,
  MultiStepFormStepProps,
  MultiStepFormProgressProps,
  MultiStepFormNavigationProps,
  UseMultiStepFormReturn,
};
