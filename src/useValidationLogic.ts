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

// Simple shallow comparison for objects
const isShallowEqual = <T>(a: T, b: T): boolean => {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object' || typeof b !== 'object') return a === b;
  
  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);
  
  if (aKeys.length !== bKeys.length) return false;
  
  return aKeys.every(key => aObj[key] === bObj[key]);
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

  // Store props in a ref so validate() always uses the latest validation logic
  // without needing to recreate callbacks (avoids unnecessary rerenders)
  const propsRef = useRef(props);
  
  // Update the ref whenever props changes (e.g., when schema dependencies change)
  useEffect(() => {
    propsRef.current = props;
  }, [props]);

  const validate = async () => {
    if (canValidateRef.current) {
      // Use propsRef.current to always access the latest validation logic
      const result: ValidationResult =
        "validationFactory" in propsRef.current
          ? await propsRef.current.validationFactory(
              currentValueRef.current as TFactoryValue,
              propsRef.current.fn
            )
          : await propsRef.current.fn(currentValueRef.current);

      if (result === true) {
        setError(undefined);
        onError(id, undefined);
      } else {
        setError(result);
        onError(id, result);
      }
      
      return result
    } else {
      setError(undefined);
      onError(id, undefined);
    }
  };

  const setValue = useCallback(
    (newValue: TValue) => {
      setFieldValue(newValue);
      setCurrentValue(newValue);
      void validate();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setCurrentValue, setFieldValue]
  );

  // Sync internal value with external value prop
  useEffect(() => {
    if (externalValue !== undefined && !isShallowEqual(externalValue, currentValueRef.current)) {
      setValue(externalValue);
    }
  }, [currentValueRef, externalValue, setValue]);

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
