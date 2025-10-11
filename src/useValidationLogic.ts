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

  const setValue = useCallback(
    (newValue: TValue) => {
      setFieldValue(newValue);
      setCurrentValue(newValue);
    },
    [setFieldValue]
  );

  const validate = async (_currentValue: typeof currentValue, _canValidate: boolean) => {
    if (_canValidate) {
      const result: ValidationResult =
        "validationFactory" in props
          ? await props.validationFactory(
              _currentValue as TFactoryValue,
              props.fn
            )
          : await props.fn(_currentValue);

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
  };

  // Sync internal value with external value prop
  useEffect(() => {
    if (externalValue !== undefined) {
      setCurrentValue(externalValue);
    }
  }, [externalValue]);

  useEffect(() => {
    subscribe(id, (_canValidate: boolean) => {
      setCanValidate(_canValidate);
      return validate(currentValue, _canValidate);
    });

    return () => {
      unsubscribe(id);
    };
  /**
   * This should only fire when id, subscribe, unsubscribe changes.
   * This functions is mostly intended to subscribe and unsubscribe.
   * 
   * Current value changing should not fire this, it has its own useEffect!
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, subscribe, unsubscribe, currentValue]);

  useEffect(() => {
    void validate(currentValue, canValidate);
  /**
   * This should only fire when current value changes, 
   * not when canValidate changes.
   * 
   * the canValidate is evaluated automatically, when calling validate
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentValue]);

  return { error, currentValue, canValidate, setValue };
};
