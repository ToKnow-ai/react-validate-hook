import { useCallback, useEffect, useId, useRef, useState } from "react";
import type {
  ErrorReportCallback,
  SimpleValidationFn,
  ValidationFactory,
  ValidationResult,
  ValidationStateCallback,
} from "./types";

const useStateWithRef = <T>(initialValue: T) => {
  const [state, _setState] = useState<T>(initialValue);
  const stateRef = useRef<T>(initialValue);
  const setState = useCallback((value: T) => {
    stateRef.current = value;
    _setState(value);
  }, []);

  return [state, setState, stateRef] as const;
};

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
  const [currentValue, setCurrentValue, currentValueRef] = useStateWithRef<TValue | undefined>(
    externalValue
  );
  const [canValidate, setCanValidate, canValidateRef] = useStateWithRef<boolean>(false);
  const id = useId();

  const setValue = useCallback(
    (newValue: TValue) => {
      setFieldValue(newValue);
      setCurrentValue(newValue);
      void validate();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setCurrentValue, setFieldValue]
  );

  const validate = async () => {
    if (canValidateRef.current) {
      const result: ValidationResult =
        "validationFactory" in props
          ? await props.validationFactory(
              currentValueRef.current as TFactoryValue,
              props.fn
            )
          : await props.fn(currentValueRef.current);

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
      setValue(externalValue);
    }
  }, [externalValue, setValue]);

  useEffect(() => {
    subscribe(id, (_canValidate: boolean) => {
      setCanValidate(_canValidate);
      return validate();
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
  }, [id, subscribe, unsubscribe]);

  return { error, currentValue, canValidate, setValue };
};
