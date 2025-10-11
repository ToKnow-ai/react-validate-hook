import { useCallback, useEffect, useId, useState } from "react";
import type {
  ErrorReportCallback,
  SimpleValidationFn,
  ValidationFactory,
  ValidationResult,
  ValidationStateCallback,
} from "./types";

// Core validation logic hook
export const useValidationLogic = <TValue, TFactoryValue, TSchema>(
  setFieldValue: (value: TValue) => void,
  externalValue: TValue | undefined,
  onError: ErrorReportCallback,
  subscribe: (key: string, callback: ValidationStateCallback) => void,
  unsubscribe: (key: string) => void,
  props:
    | { fn: SimpleValidationFn<TValue> }
    | {
        validationFactory: ValidationFactory<TFactoryValue, TSchema>;
        fn: TSchema;
      }
) => {
  const [error, setError] = useState<string | undefined>(undefined);
  const [currentValue, setCurrentValue] = useState<TValue | undefined>(
    externalValue
  );
  const [canValidate, setCanValidate] = useState<boolean>(false);
  const id = useId();

  // Sync internal value with external value prop
  useEffect(() => {
    if (externalValue !== undefined) {
      setCurrentValue(externalValue);
    }
  }, [externalValue]);

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
      const result: ValidationResult =
        "validationFactory" in props
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

  return { error, currentValue, canValidate, setValue };
};
