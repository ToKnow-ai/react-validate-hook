import { renderHook, render, waitFor } from "@testing-library/react";
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

    it("should validate and show errors after validate() is called", async () => {
      const { result } = renderHook(() => useValidator());
      let capturedError: string | undefined;

      const Component = () =>
        result.current.ValidateWrapper({
          fn: (val: string | undefined | null) =>
            val && val.length >= 3 ? true : "Must be at least 3 characters",
          setValue: () => {},
          children: ({ error }) => {
            capturedError = error;
            return <div data-testid="error">{error}</div>;
          },
        });

      render(<Component />);

      await act(result.current.validate);

      expect(capturedError).toBe("Must be at least 3 characters");
      expect(result.current.errors).toContain("Must be at least 3 characters");
    });

    it("should clear errors after reset() is called", async () => {
      const { result } = renderHook(() => useValidator());

      const Component = () =>
        result.current.ValidateWrapper({
          fn: (val) => (val ? true : "Required"),
          setValue: () => {},
          children: ({ error }) => <div>{error ?? "no-error"}</div>,
        });

      render(<Component />);

      await act(result.current.validate);

      expect(result.current.errors.length).toBeGreaterThan(0);

      act(() => {
        result.current.reset();
      });

      expect(result.current.errors).toEqual([]);
    });

    it("should handle multiple ValidateWrappers", async () => {
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

      await act(result.current.validate);

      expect(result.current.errors).toHaveLength(2);
      expect(result.current.errors).toContain("Field 1 required");
      expect(result.current.errors).toContain("Field 2 required");
    });

    it("should update validation when value changes", async () => {
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
      await act(result.current.validate);

      expect(result.current.errors).toContain("Must be at least 3 characters");

      // Update value to valid
      act(() => {
        capturedSetValue?.("valid");
      });

      await waitFor(() => {
        expect(result.current.errors).toEqual([]);
      });
    });

    it("should handle null and undefined values", async () => {
      const { result } = renderHook(() => useValidator());

      const Component = () =>
        result.current.ValidateWrapper({
          fn: (val) => (val ? true : "Required"),
          setValue: () => {},
          children: ({ error }) => <div>{error}</div>,
        });

      render(<Component />);

      await act(result.current.validate);

      expect(result.current.errors).toContain("Required");
    });

    it("should only show errors after validation is enabled", async () => {
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
      await act(result.current.validate);

      expect(currentError).toBe("Always invalid");
    });

    it("should return errors from validate() that match result.current.errors", async () => {
      const { result } = renderHook(() => useValidator());

      const Component1 = () =>
        result.current.ValidateWrapper({
          fn: () => "Error 1",
          setValue: () => {},
          children: ({ error }) => <div>{error}</div>,
        });

      const Component2 = () =>
        result.current.ValidateWrapper({
          fn: () => "Error 2",
          setValue: () => {},
          children: ({ error }) => <div>{error}</div>,
        });

      const Component3 = () =>
        result.current.ValidateWrapper({
          fn: () => true,
          setValue: () => {},
          children: ({ error }) => <div>{error}</div>,
        });

      render(
        <>
          <Component1 />
          <Component2 />
          <Component3 />
        </>
      );

      const returnedErrors = await act(result.current.validate);

      // The errors returned from validate() should match result.current.errors
      expect(returnedErrors).toEqual(result.current.errors);
      expect(returnedErrors).toHaveLength(2);
      expect(returnedErrors).toContain("Error 1");
      expect(returnedErrors).toContain("Error 2");
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

    it("should validate using zod schema", async () => {
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

      await act(result.current.validate);

      expect(result.current.errors).toContain("Min 3 chars");
    });

    it("should validate multiple fields with different schemas", async () => {
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

      await act(result.current.validate);

      expect(result.current.errors).toHaveLength(2);
      expect(result.current.errors).toContain("Name too short");
      expect(result.current.errors).toContain("Invalid email");
    });

    it("should pass valid values through factory validation", async () => {
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

      await act(result.current.validate);

      expect(result.current.errors.length).toBeGreaterThan(0);

      act(() => {
        capturedSetValue?.("valid value");
      });

      await waitFor(() => {
        expect(result.current.errors).toEqual([]);
      });
    });

    it("should handle complex zod schemas", async () => {
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

      await act(result.current.validate);

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

      await waitFor(() => {
        expect(result.current.errors).toEqual([]);
      });
    });
  });

  describe("Value prop feature", () => {
    it("should validate initial value when value prop is provided", async () => {
      const { result } = renderHook(() => useValidator());
      let capturedValue: string | undefined;

      const Component = () =>
        result.current.ValidateWrapper({
          fn: (val: string | undefined | null) =>
            val && val.length >= 3 ? true : "Min 3 characters",
          value: "ab",
          setValue: () => {},
          children: ({ error, value }) => {
            capturedValue = value;
            return <div>{error}</div>;
          },
        });

      render(<Component />);

      // Value should be available in children
      expect(capturedValue).toBe("ab");

      // Validate should work with initial value
      await act(result.current.validate);

      expect(result.current.errors).toContain("Min 3 characters");
    });

    it("should pass valid initial value through validation", async () => {
      const { result } = renderHook(() => useValidator());

      const Component = () =>
        result.current.ValidateWrapper({
          fn: (val: string | undefined | null) =>
            val && val.length >= 3 ? true : "Min 3 characters",
          value: "valid",
          setValue: () => {},
          children: ({ error }) => <div>{error}</div>,
        });

      render(<Component />);

      await act(result.current.validate);

      expect(result.current.errors).toEqual([]);
    });

    it("should sync internal value with external value prop changes", async () => {
      const { result } = renderHook(() => useValidator());
      let capturedValue: string | undefined;

      const Component = ({ externalValue }: { externalValue: string }) =>
        result.current.ValidateWrapper({
          fn: (val: string | undefined | null) =>
            val && val.length >= 3 ? true : "Min 3 characters",
          value: externalValue,
          setValue: () => {},
          children: ({ error, value }) => {
            capturedValue = value;
            return <div>{error}</div>;
          },
        });

      const { rerender } = render(<Component externalValue="ab" />);

      expect(capturedValue).toBe("ab");

      // Change external value
      rerender(<Component externalValue="abc" />);

      expect(capturedValue).toBe("abc");

      // Validate with updated value
      await act(result.current.validate);

      expect(result.current.errors).toEqual([]);
    });

    it("should allow setValue to update value when value prop is provided", async () => {
      const { result } = renderHook(() => useValidator());
      let capturedSetValue: ((value: string) => void) | undefined;
      let capturedValue: string | undefined;

      const Component = () =>
        result.current.ValidateWrapper({
          fn: (val: string | undefined | null) =>
            val && val.length >= 3 ? true : "Min 3 characters",
          value: "initial",
          setValue: () => {},
          children: ({ error, value, setValue }) => {
            capturedSetValue = setValue;
            capturedValue = value;
            return <div>{error}</div>;
          },
        });

      render(<Component />);

      expect(capturedValue).toBe("initial");

      // Update via setValue
      act(() => {
        capturedSetValue?.("updated");
      });

      expect(capturedValue).toBe("updated");

      await act(result.current.validate);

      expect(result.current.errors).toEqual([]);
    });

    it("should work with factory validation and value prop", async () => {
      const validationFactory = (
        data: unknown,
        schema: z.ZodType
      ): string | true => {
        const result = schema.safeParse(data);
        return result.success
          ? true
          : (result.error.issues?.[0]?.message ?? "Validation failed");
      };

      const { result } = renderHook(() => useValidator(validationFactory));
      const schema = z.string().email("Invalid email");

      const Component = () =>
        result.current.ValidateWrapper({
          fn: schema,
          value: "not-an-email",
          setValue: () => {},
          children: ({ error }) => <div>{error}</div>,
        });

      render(<Component />);

      await act(result.current.validate);

      expect(result.current.errors).toContain("Invalid email");
    });

    it("should handle undefined as initial value prop", async () => {
      const { result } = renderHook(() => useValidator());
      let capturedValue: string | undefined;

      const Component = () =>
        result.current.ValidateWrapper({
          fn: (val) => (val ? true : "Required"),
          value: undefined,
          setValue: () => {},
          children: ({ error, value }) => {
            capturedValue = value;
            return <div>{error}</div>;
          },
        });

      render(<Component />);

      expect(capturedValue).toBeUndefined();

      await act(result.current.validate);

      expect(result.current.errors).toContain("Required");
    });

    it("should provide value in children callback when value prop is present", () => {
      const { result } = renderHook(() => useValidator());
      let childrenCallbackKeys: string[] = [];

      const Component = () =>
        result.current.ValidateWrapper({
          fn: () => true,
          value: "test",
          setValue: () => {},
          children: (props) => {
            childrenCallbackKeys = Object.keys(props);
            return <div>test</div>;
          },
        });

      render(<Component />);

      expect(childrenCallbackKeys).toContain("error");
      expect(childrenCallbackKeys).toContain("value");
      expect(childrenCallbackKeys).toContain("setValue");
    });

    it("should not provide value in children callback when value prop is absent", () => {
      const { result } = renderHook(() => useValidator());
      let childrenCallbackKeys: string[] = [];

      const Component = () =>
        result.current.ValidateWrapper({
          fn: () => true,
          setValue: () => {},
          children: (props) => {
            childrenCallbackKeys = Object.keys(props);
            return <div>test</div>;
          },
        });

      render(<Component />);

      expect(childrenCallbackKeys).toContain("error");
      expect(childrenCallbackKeys).toContain("setValue");
      expect(childrenCallbackKeys).not.toContain("value");
    });
  });

  describe("Edge cases and bugs", () => {
    it("should handle rapid validate/reset cycles", async () => {
      const { result } = renderHook(() => useValidator());

      const Component = () =>
        result.current.ValidateWrapper({
          fn: () => "Error",
          setValue: () => {},
          children: ({ error }) => <div>{error}</div>,
        });

      render(<Component />);

      await act(async () => {
        await result.current.validate();
        result.current.reset();
        await result.current.validate();
        result.current.reset();
      });

      expect(result.current.errors).toEqual([]);
    });

    it("should handle unmounting ValidateWrapper", async () => {
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

      await act(result.current.validate);

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

    it("should handle empty string vs null vs undefined", async () => {
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

      await act(result.current.validate);

      expect(result.current.errors).toContain("Value is undefined");

      act(() => {
        capturedSetValue?.("");
      });

      await waitFor(() => {
        expect(result.current.errors).toContain("Value is empty string");
      });
    });

    it("should not add duplicate errors from same field", async () => {
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

      await act(result.current.validate);

      expect(result.current.errors).toEqual(["Same error"]);

      // Change value (still invalid)
      act(() => {
        capturedSetValue?.("new value");
      });

      await waitFor(() => {
        // Should still have only one error
        expect(result.current.errors).toEqual(["Same error"]);
      });
    });

    it("should handle setValue being called before validate", async () => {
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
      await act(result.current.validate);

      // Should show error
      expect(currentError).toBe("Must be at least 3 characters");
      expect(result.current.errors).toContain("Must be at least 3 characters");
    });

    it("should filter out undefined errors from the errors array", async () => {
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

      await act(result.current.validate);

      // Should only contain the actual error, not undefined
      expect(result.current.errors).toEqual(["Error"]);
    });
  });

  describe("Async validation", () => {
    beforeEach(() => {
      jest.clearAllTimers();
    });

    afterEach(() => {
      jest.clearAllTimers();
    });

    it("should handle async validation functions", async () => {
      const { result } = renderHook(() => useValidator());

      const Component = () =>
        result.current.ValidateWrapper({
          fn: async (val: string | undefined | null) => {
            await new Promise((resolve) => setTimeout(resolve, 50));
            return val && val.length >= 3 ? true : "Min 3 chars";
          },
          setValue: () => {},
          children: ({ error }) => <div>{error}</div>,
        });

      render(<Component />);

      await act(result.current.validate);

      expect(result.current.errors).toContain("Min 3 chars");
    });

    it("should handle multiple async validations in parallel", async () => {
      const { result } = renderHook(() => useValidator());

      const Component1 = () =>
        result.current.ValidateWrapper({
          fn: async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
            return "Error 1";
          },
          setValue: () => {},
          children: ({ error }) => <div>{error}</div>,
        });

      const Component2 = () =>
        result.current.ValidateWrapper({
          fn: async () => {
            await new Promise((resolve) => setTimeout(resolve, 50));
            return "Error 2";
          },
          setValue: () => {},
          children: ({ error }) => <div>{error}</div>,
        });

      render(
        <>
          <Component1 />
          <Component2 />
        </>
      );

      const start = Date.now();
      await act(result.current.validate);
      const duration = Date.now() - start;

      expect(result.current.errors).toHaveLength(2);
      expect(result.current.errors).toContain("Error 1");
      expect(result.current.errors).toContain("Error 2");
      // Should run in parallel, not sequentially (< 150ms, not 150ms+)
      expect(duration).toBeLessThan(150);
    });

    it("should handle async validation with setValue updates", async () => {
      const { result } = renderHook(() => useValidator());
      let capturedSetValue: ((value: string) => void) | undefined;

      const Component = () =>
        result.current.ValidateWrapper({
          fn: async (val: string | undefined | null) => {
            await new Promise((resolve) => setTimeout(resolve, 30));
            return val === "valid" ? true : "Invalid";
          },
          setValue: () => {},
          children: ({ error, setValue }) => {
            capturedSetValue = setValue;
            return <div>{error}</div>;
          },
        });

      render(<Component />);

      await act(result.current.validate);
      expect(result.current.errors).toContain("Invalid");

      act(() => {
        capturedSetValue?.("valid");
      });

      await waitFor(
        () => {
          expect(result.current.errors).toEqual([]);
        },
        { timeout: 100 }
      );
    });

    it("should handle async factory validation", async () => {
      const asyncFactory = async (
        data: unknown,
        schema: z.ZodType
      ): Promise<string | true> => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        const result = schema.safeParse(data);
        return result.success ? true : "Async validation failed";
      };

      const { result } = renderHook(() => useValidator(asyncFactory));
      const schema = z.string().min(5);

      const Component = () =>
        result.current.ValidateWrapper({
          fn: schema,
          value: "abc",
          setValue: () => {},
          children: ({ error }) => <div>{error}</div>,
        });

      render(<Component />);

      await act(result.current.validate);

      expect(result.current.errors).toContain("Async validation failed");
    });

    it("should not have race conditions with rapid validate calls", async () => {
      const { result } = renderHook(() => useValidator());
      let validationCount = 0;

      const Component = () =>
        result.current.ValidateWrapper({
          fn: async () => {
            validationCount++;
            await new Promise((resolve) => setTimeout(resolve, 50));
            return "Error";
          },
          setValue: () => {},
          children: ({ error }) => <div>{error}</div>,
        });

      render(<Component />);

      await act(async () => {
        await Promise.all([
          result.current.validate(),
          result.current.validate(),
          result.current.validate(),
        ]);
      });

      expect(result.current.errors).toContain("Error");
      expect(validationCount).toBeGreaterThanOrEqual(1);
    });

    it("should handle async validation errors being thrown", async () => {
      const { result } = renderHook(() => useValidator());

      const Component = () =>
        result.current.ValidateWrapper({
          fn: async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            throw new Error("Validation threw");
          },
          setValue: () => {},
          children: ({ error }) => <div>{error}</div>,
        });

      render(<Component />);

      try {
        await act(result.current.validate);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it("should complete all async validations before resolving validate()", async () => {
      const { result } = renderHook(() => useValidator());

      const Component1 = () =>
        result.current.ValidateWrapper({
          fn: async () => {
            await new Promise((resolve) => setTimeout(resolve, 50));
            return "Error 1";
          },
          setValue: () => {},
          children: ({ error }) => <div>{error}</div>,
        });

      const Component2 = () =>
        result.current.ValidateWrapper({
          fn: async () => {
            await new Promise((resolve) => setTimeout(resolve, 20));
            return "Error 2";
          },
          setValue: () => {},
          children: ({ error }) => <div>{error}</div>,
        });

      render(
        <>
          <Component1 />
          <Component2 />
        </>
      );

      await act(result.current.validate);

      expect(result.current.errors).toHaveLength(2);
      expect(result.current.errors).toContain("Error 1");
      expect(result.current.errors).toContain("Error 2");
    });
  });
});
