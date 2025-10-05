import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

// ============================================================================
// Core Types - All other types derive from these
// ============================================================================

/**
 * Type for validation result - either true (valid) or error message string
 */
type ValidationResult = string | true;

/**
 * Simple validation function that validates a value directly
 */
type SimpleValidationFn<TValue> = (
  value: TValue | undefined | null
) => ValidationResult;

/**
 * Factory-based validation function that uses a schema/validator object
 * @template TValue - The type of value being validated
 * @template TSchema - The type of schema/validator (e.g., z.ZodType, Yup schema, etc.)
 */
type ValidationFactory<TValue, TSchema> = (
  value: TValue,
  schema: TSchema
) => ValidationResult;

/**
 * Callback for subscription to validation state changes
 */
type ValidationStateCallback = (canValidate: boolean) => void;

/**
 * Callback for reporting validation errors
 */
type ErrorReportCallback = (key: string, message?: string) => void;

// ============================================================================
// Internal Props - Used by ValidateWrapper component
// ============================================================================

/**
 * Base internal props injected into ValidateWrapper
 */
type BaseInternalProps = {
  onError: ErrorReportCallback;
  subscribe: (key: string, callback: ValidationStateCallback) => void;
  unsubscribe: (key: string) => void;
};

/**
 * Internal props for simple validation (no factory)
 */
type SimpleValidationInternalProps<TValue> = BaseInternalProps & {
  fn: SimpleValidationFn<TValue>;
};

/**
 * Internal props for factory-based validation
 */
type FactoryValidationInternalProps<TValue, TSchema> = BaseInternalProps & {
  validationFactory: ValidationFactory<TValue, TSchema>;
  fn: TSchema;
};

// ============================================================================
// Public Props - Used by consumers
// ============================================================================

/**
 * Base props shared by all ValidateWrapper components
 */
type BaseValidateWrapperProps<TValue> = {
  setValue: (value: TValue) => void;
  children: (props: {
    error: string | undefined;
    setValue: (value: TValue) => void;
  }) => ReactNode;
};

/**
 * Props for ValidateWrapper using simple validation function
 */
type SimpleValidateWrapperProps<TValue> = BaseValidateWrapperProps<TValue> & {
  fn: SimpleValidationFn<TValue>;
};

/**
 * Props for ValidateWrapper using factory-based validation
 */
type FactoryValidateWrapperProps<TValue, TSchema> =
  BaseValidateWrapperProps<TValue> & {
    fn: TSchema;
  };

// ============================================================================
// Hook Return Types
// ============================================================================

/**
 * Return type for useValidator without factory (simple validation)
 */
type SimpleValidatorReturn = {
  ValidateWrapper: <TValue>(
    props: SimpleValidateWrapperProps<TValue>
  ) => JSX.Element;
  errors: string[];
  validate: () => void;
  reset: () => void;
};

/**
 * Return type for useValidator with factory (schema-based validation)
 */
type FactoryValidatorReturn<TSchema> = {
  ValidateWrapper: <TFieldValue>(
    props: FactoryValidateWrapperProps<TFieldValue, TSchema>
  ) => JSX.Element;
  errors: string[];
  validate: () => void;
  reset: () => void;
};

// ============================================================================
// ValidateWrapper Component
// ============================================================================

// eslint-disable-next-line react-refresh/only-export-components
const ValidateWrapper = <TValue, TFactoryValue, TSchema>({
  setValue: setFieldValue,
  children,
  onError,
  subscribe,
  unsubscribe,
  ...props
}:
  | (SimpleValidateWrapperProps<TValue> & SimpleValidationInternalProps<TValue>)
  | (FactoryValidateWrapperProps<TValue, TSchema> &
      FactoryValidationInternalProps<TFactoryValue, TSchema>)) => {
  const [error, setError] = useState<string | undefined>(undefined);
  const [currentValue, setCurrentValue] = useState<TValue | undefined>(
    undefined
  );
  const [canValidate, setCanValidate] = useState<boolean>(false);
  const id = useId();

  const setValue = useCallback(
    (newValue: TValue) => {
      setFieldValue(newValue);
      setCurrentValue(newValue);
    },
    [setFieldValue]
  );

  useEffect(() => {
    subscribe(id, setCanValidate);

    return () => {
      unsubscribe(id);
    };
  }, [id, subscribe, unsubscribe]);

  useEffect(() => {
    if (canValidate) {
      const result: ValidationResult = "validationFactory" in props
        ? props.validationFactory(currentValue as TFactoryValue, props.fn)
        : props.fn(currentValue);

      if (result === true) {
        setError(undefined);
        onError(id, undefined);
      } else {
        setError(result);
        onError(id, result);
      }
    } else {
      setError(undefined);
      onError(id, undefined);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, onError, currentValue, canValidate]);

  return <>{children({ error: canValidate ? error : undefined, setValue })}</>;
};

// ============================================================================
// useValidator Hook - Overloads & Implementation
// ============================================================================

/**
 * useValidator hook without factory - uses simple validation functions
 * @example
 * const { ValidateWrapper, validate, errors } = useValidator();
 * <ValidateWrapper fn={(value) => value ? true : "Required"} setValue={setName}>
 *   {({ error, setValue }) => <input onChange={e => setValue(e.target.value)} />}
 * </ValidateWrapper>
 */
export function useValidator(): SimpleValidatorReturn;

/**
 * useValidator hook with factory - uses schema-based validation
 * @template TValue - The type of value the factory validates
 * @template TSchema - The type of schema/validator object
 * @param validationFactory - Factory function to validate values against schemas
 * @example
 * const { ValidateWrapper, validate, errors } = useValidator(
 *   (data, schema) => schema.safeParse(data).success ? true : "Invalid"
 * );
 * <ValidateWrapper fn={zodSchema} setValue={setName}>
 *   {({ error, setValue }) => <input onChange={e => setValue(e.target.value)} />}
 * </ValidateWrapper>
 */
export function useValidator<TValue, TSchema>(
  validationFactory: ValidationFactory<TValue, TSchema>
): FactoryValidatorReturn<TSchema>;

/**
 * Implementation of useValidator hook
 */
export function useValidator<TValue, TSchema>(
  validationFactory?: ValidationFactory<TValue, TSchema>
): SimpleValidatorReturn | FactoryValidatorReturn<TSchema> {
  const [canValidate, setCanValidate] = useState<boolean>(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const onError = useCallback<ErrorReportCallback>((key, message) => {
    setErrors((prev) => ({
      ...prev,
      [key]: message,
    }));
  }, []);

  const subscriberRefs = useRef<Record<string, ValidationStateCallback>>({});

  const subscribe = useCallback(
    (key: string, callback: ValidationStateCallback) => {
      subscriberRefs.current[key] = callback;
    },
    []
  );

  const unsubscribe = useCallback((key: string) => {
    delete subscriberRefs.current[key];
  }, []);

  const InnerWrapper = useMemo(() => {
    const Wrapper = <TFieldValue,>(
      props:
        | SimpleValidateWrapperProps<TFieldValue>
        | FactoryValidateWrapperProps<TFieldValue, TSchema>
    ) => {
      const allProps = {
        subscribe,
        unsubscribe,
        onError,
        ...(validationFactory && { validationFactory }),
        ...props,
      } as
        | (SimpleValidateWrapperProps<TFieldValue> &
            SimpleValidationInternalProps<TFieldValue>)
        | (FactoryValidateWrapperProps<TFieldValue, TSchema> &
            FactoryValidationInternalProps<TValue, TSchema>);

      return <ValidateWrapper {...allProps} />;
    };
    return Wrapper;
  }, [onError, subscribe, unsubscribe, validationFactory]);

  const flattenedErrors = useMemo(
    () =>
      canValidate
        ? (Object.values(errors).filter(Boolean) as string[])
        : [],
    [errors, canValidate]
  );

  const validate = useCallback(() => {
    Object.values(subscriberRefs.current).forEach((callback) =>
      callback(true)
    );
    setCanValidate(true);
  }, []);

  const reset = useCallback(() => {
    Object.values(subscriberRefs.current).forEach((callback) =>
      callback(false)
    );
    setCanValidate(false);
    setErrors({});
  }, []);

  return {
    ValidateWrapper: InnerWrapper,
    errors: flattenedErrors,
    validate,
    reset,
  };
}
