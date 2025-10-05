import { renderHook, render } from "@testing-library/react";
import { act } from "react";
import { useValidator } from "../useValidator";
import * as z from "zod";

describe("useValidator", () => {
  describe("Simple validation (no factory)", () => {
    it("should initialize with no errors", () => {
      const { result } = renderHook(() => useValidator());

      expect(result.current.errors).toEqual([]);
    });

    it("should not show errors before validate() is called", () => {
      const { result } = renderHook(() => useValidator());
      let capturedError: string | undefined;

      const Component = () =>
        result.current.ValidateWrapper({
          fn: (val: string | undefined | null) =>
            val && val.length > 0 ? true : "Required",
          setValue: () => {},
          children: ({ error }) => {
            capturedError = error;
            return <div>{error ?? "no-error"}</div>;
          },
        });

      render(<Component />);
      expect(capturedError).toBeUndefined();
    });

    it("should validate and show errors after validate() is called", () => {
      const { result } = renderHook(() => useValidator());
      let capturedError: string | undefined;

      const Component = () =>
        result.current.ValidateWrapper({
          fn: (val: string | undefined | null) =>
            val && val.length >= 3 ? true : "Must be at least 3 characters",
          setValue: () => {},
          children: ({ error, setValue: _setValue }) => {
            capturedError = error;
            return <div data-testid="error">{error}</div>;
          },
        });

      render(<Component />);

      act(() => {
        result.current.validate();
      });

      expect(capturedError).toBe("Must be at least 3 characters");
      expect(result.current.errors).toContain("Must be at least 3 characters");
    });

    it("should clear errors after reset() is called", () => {
      const { result } = renderHook(() => useValidator());

      const Component = () =>
        result.current.ValidateWrapper({
          fn: (val) => (val ? true : "Required"),
          setValue: () => {},
          children: ({ error }) => <div>{error ?? "no-error"}</div>,
        });

      render(<Component />);

      act(() => {
        result.current.validate();
      });

      expect(result.current.errors.length).toBeGreaterThan(0);

      act(() => {
        result.current.reset();
      });

      expect(result.current.errors).toEqual([]);
    });

    it("should handle multiple ValidateWrappers", () => {
      const { result } = renderHook(() => useValidator());

      const Component1 = () =>
        result.current.ValidateWrapper({
          fn: (val: string | undefined | null) =>
            val && val.length > 0 ? true : "Field 1 required",
          setValue: () => {},
          children: ({ error }) => <div>{error}</div>,
        });

      const Component2 = () =>
        result.current.ValidateWrapper({
          fn: (val: string | undefined | null) =>
            val && val.length > 0 ? true : "Field 2 required",
          setValue: () => {},
          children: ({ error }) => <div>{error}</div>,
        });

      render(
        <>
          <Component1 />
          <Component2 />
        </>
      );

      act(() => {
        result.current.validate();
      });

      expect(result.current.errors).toHaveLength(2);
      expect(result.current.errors).toContain("Field 1 required");
      expect(result.current.errors).toContain("Field 2 required");
    });

    it("should update validation when value changes", () => {
      const { result } = renderHook(() => useValidator());
      let capturedSetValue: ((value: string) => void) | undefined;

      const Component = () =>
        result.current.ValidateWrapper({
          fn: (val: string | undefined | null) =>
            val && val.length >= 3 ? true : "Must be at least 3 characters",
          setValue: () => {},
          children: ({ error, setValue }) => {
            capturedSetValue = setValue;
            return <div>{error}</div>;
          },
        });

      render(<Component />);

      // Trigger validation
      act(() => {
        result.current.validate();
      });

      expect(result.current.errors).toContain("Must be at least 3 characters");

      // Update value to valid
      act(() => {
        capturedSetValue?.("valid");
      });

      expect(result.current.errors).toEqual([]);
    });

    it("should handle null and undefined values", () => {
      const { result } = renderHook(() => useValidator());

      const Component = () =>
        result.current.ValidateWrapper({
          fn: (val) => (val ? true : "Required"),
          setValue: () => {},
          children: ({ error }) => <div>{error}</div>,
        });

      render(<Component />);

      act(() => {
        result.current.validate();
      });

      expect(result.current.errors).toContain("Required");
    });

    it("should only show errors after validation is enabled", () => {
      const { result } = renderHook(() => useValidator());
      let currentError: string | undefined;

      const Component = () =>
        result.current.ValidateWrapper({
          fn: () => "Always invalid",
          setValue: () => {},
          children: ({ error }) => {
            currentError = error;
            return <div>{error}</div>;
          },
        });

      render(<Component />);

      // Before validation
      expect(currentError).toBeUndefined();

      // After validation
      act(() => {
        result.current.validate();
      });

      expect(currentError).toBe("Always invalid");
    });
  });

  describe("Factory validation (with schema)", () => {
    const validationFactory = (
      data: unknown,
      schema: z.ZodType
    ): string | true => {
      const result = schema.safeParse(data);
      return result.success
        ? true
        : (result.error.issues?.[0]?.message ?? "Validation failed");
    };

    it("should validate using zod schema", () => {
      const { result } = renderHook(() => useValidator(validationFactory));

      const schema = z.string().min(3, "Min 3 chars");
      let capturedSetValue: ((value: string) => void) | undefined;

      const Component = () =>
        result.current.ValidateWrapper({
          fn: schema,
          setValue: () => {},
          children: ({ error, setValue }) => {
            capturedSetValue = setValue;
            return <div>{error}</div>;
          },
        });

      render(<Component />);

      // Set initial value
      act(() => {
        capturedSetValue?.("");
      });

      act(() => {
        result.current.validate();
      });

      expect(result.current.errors).toContain("Min 3 chars");
    });

    it("should validate multiple fields with different schemas", () => {
      const { result } = renderHook(() => useValidator(validationFactory));

      const nameSchema = z.string().min(2, "Name too short");
      const emailSchema = z.string().email("Invalid email");

      let capturedNameSetValue: ((value: string) => void) | undefined;
      let capturedEmailSetValue: ((value: string) => void) | undefined;

      const NameComponent = () =>
        result.current.ValidateWrapper({
          fn: nameSchema,
          setValue: () => {},
          children: ({ error, setValue }) => {
            capturedNameSetValue = setValue;
            return <div>{error}</div>;
          },
        });

      const EmailComponent = () =>
        result.current.ValidateWrapper({
          fn: emailSchema,
          setValue: () => {},
          children: ({ error, setValue }) => {
            capturedEmailSetValue = setValue;
            return <div>{error}</div>;
          },
        });

      render(
        <>
          <NameComponent />
          <EmailComponent />
        </>
      );

      // Set initial values
      act(() => {
        capturedNameSetValue?.("a");
        capturedEmailSetValue?.("notanemail");
      });

      act(() => {
        result.current.validate();
      });

      expect(result.current.errors).toHaveLength(2);
      expect(result.current.errors).toContain("Name too short");
      expect(result.current.errors).toContain("Invalid email");
    });

    it("should pass valid values through factory validation", () => {
      const { result } = renderHook(() => useValidator(validationFactory));

      const schema = z.string().min(3);
      let capturedSetValue: ((value: string) => void) | undefined;

      const Component = () =>
        result.current.ValidateWrapper({
          fn: schema,
          setValue: () => {},
          children: ({ error, setValue }) => {
            capturedSetValue = setValue;
            return <div>{error ?? "valid"}</div>;
          },
        });

      render(<Component />);

      act(() => {
        result.current.validate();
      });

      expect(result.current.errors.length).toBeGreaterThan(0);

      act(() => {
        capturedSetValue?.("valid value");
      });

      expect(result.current.errors).toEqual([]);
    });

    it("should handle complex zod schemas", () => {
      const { result } = renderHook(() => useValidator(validationFactory));

      const schema = z
        .string()
        .trim()
        .min(1, "Required")
        .min(3, "Min 3")
        .max(10, "Max 10")
        .regex(/^[a-z]+$/, "Lowercase only");

      let capturedSetValue: ((value: string) => void) | undefined;

      const Component = () =>
        result.current.ValidateWrapper({
          fn: schema,
          setValue: () => {},
          children: ({ error, setValue }) => {
            capturedSetValue = setValue;
            return <div>{error}</div>;
          },
        });

      render(<Component />);

      act(() => {
        result.current.validate();
      });

      expect(result.current.errors.length).toBeGreaterThan(0);

      // Invalid: too short
      act(() => {
        capturedSetValue?.("ab");
      });
      expect(result.current.errors.length).toBeGreaterThan(0);

      // Invalid: has uppercase
      act(() => {
        capturedSetValue?.("ABC");
      });
      expect(result.current.errors.length).toBeGreaterThan(0);

      // Valid
      act(() => {
        capturedSetValue?.("valid");
      });
      expect(result.current.errors).toEqual([]);
    });
  });

  describe("Edge cases and bugs", () => {
    it("should handle rapid validate/reset cycles", () => {
      const { result } = renderHook(() => useValidator());

      const Component = () =>
        result.current.ValidateWrapper({
          fn: () => "Error",
          setValue: () => {},
          children: ({ error }) => <div>{error}</div>,
        });

      render(<Component />);

      act(() => {
        result.current.validate();
        result.current.reset();
        result.current.validate();
        result.current.reset();
      });

      expect(result.current.errors).toEqual([]);
    });

    it("should handle unmounting ValidateWrapper", () => {
      const { result } = renderHook(() => useValidator());

      const Component = ({ show }: { show: boolean }) =>
        show
          ? result.current.ValidateWrapper({
              fn: () => "Error",
              setValue: () => {},
              children: ({ error }) => <div>{error}</div>,
            })
          : null;

      const { rerender } = render(<Component show={true} />);

      act(() => {
        result.current.validate();
      });

      expect(result.current.errors).toContain("Error");

      // Unmount the wrapper
      rerender(<Component show={false} />);

      // Errors should still be present until reset
      expect(result.current.errors).toContain("Error");

      act(() => {
        result.current.reset();
      });

      expect(result.current.errors).toEqual([]);
    });

    it("should handle empty string vs null vs undefined", () => {
      const { result } = renderHook(() => useValidator());
      let capturedSetValue: ((value: string) => void) | undefined;

      const Component = () =>
        result.current.ValidateWrapper({
          fn: (val) => {
            if (val === null) return "Value is null";
            if (val === undefined) return "Value is undefined";
            if (val === "") return "Value is empty string";
            return true;
          },
          setValue: () => {},
          children: ({ error, setValue }) => {
            capturedSetValue = setValue;
            return <div>{error}</div>;
          },
        });

      render(<Component />);

      act(() => {
        result.current.validate();
      });

      expect(result.current.errors).toContain("Value is undefined");

      act(() => {
        capturedSetValue?.("");
      });

      expect(result.current.errors).toContain("Value is empty string");
    });

    it("should not add duplicate errors from same field", () => {
      const { result } = renderHook(() => useValidator());
      let capturedSetValue: ((value: string) => void) | undefined;

      const Component = () =>
        result.current.ValidateWrapper({
          fn: () => "Same error",
          setValue: () => {},
          children: ({ error, setValue }) => {
            capturedSetValue = setValue;
            return <div>{error}</div>;
          },
        });

      render(<Component />);

      act(() => {
        result.current.validate();
      });

      expect(result.current.errors).toEqual(["Same error"]);

      // Change value (still invalid)
      act(() => {
        capturedSetValue?.("new value");
      });

      // Should still have only one error
      expect(result.current.errors).toEqual(["Same error"]);
    });

    it("should handle setValue being called before validate", () => {
      const { result } = renderHook(() => useValidator());
      let capturedSetValue: ((value: string) => void) | undefined;
      let currentError: string | undefined;

      const Component = () =>
        result.current.ValidateWrapper({
          fn: (val: string | undefined | null) =>
            val && val.length >= 3 ? true : "Must be at least 3 characters",
          setValue: () => {},
          children: ({ error, setValue }) => {
            capturedSetValue = setValue;
            currentError = error;
            return <div>{error}</div>;
          },
        });

      render(<Component />);

      // Set value before validation
      act(() => {
        capturedSetValue?.("ab");
      });

      // Should not show error yet
      expect(currentError).toBeUndefined();
      expect(result.current.errors).toEqual([]);

      // Now validate
      act(() => {
        result.current.validate();
      });

      // Should show error
      expect(currentError).toBe("Must be at least 3 characters");
      expect(result.current.errors).toContain("Must be at least 3 characters");
    });

    it("should filter out undefined errors from the errors array", () => {
      const { result } = renderHook(() => useValidator());

      const Component1 = () =>
        result.current.ValidateWrapper({
          fn: () => true, // Valid
          setValue: () => {},
          children: ({ error }) => <div>{error}</div>,
        });

      const Component2 = () =>
        result.current.ValidateWrapper({
          fn: () => "Error",
          setValue: () => {},
          children: ({ error }) => <div>{error}</div>,
        });

      render(
        <>
          <Component1 />
          <Component2 />
        </>
      );

      act(() => {
        result.current.validate();
      });

      // Should only contain the actual error, not undefined
      expect(result.current.errors).toEqual(["Error"]);
    });
  });
});
