import { beforeEach, describe, expect, test } from 'vitest';
import { useToastStore } from '../toastStore';

beforeEach(() => {
  useToastStore.setState({ toasts: [] });
});

describe('useToastStore', () => {
  test('addToast appends a toast, defaulting to the "error" variant', () => {
    useToastStore.getState().addToast('Something failed');
    expect(useToastStore.getState().toasts).toMatchObject([{ message: 'Something failed', variant: 'error' }]);
  });

  test('addToast accepts an explicit variant', () => {
    useToastStore.getState().addToast('Saved', 'success');
    expect(useToastStore.getState().toasts).toMatchObject([{ message: 'Saved', variant: 'success' }]);
  });

  test('each toast gets a unique id', () => {
    useToastStore.getState().addToast('one');
    useToastStore.getState().addToast('two');
    const [a, b] = useToastStore.getState().toasts;
    expect(a.id).not.toBe(b.id);
  });

  test('dismissToast removes only the matching toast', () => {
    useToastStore.getState().addToast('one');
    useToastStore.getState().addToast('two');
    const [first] = useToastStore.getState().toasts;

    useToastStore.getState().dismissToast(first.id);

    const remaining = useToastStore.getState().toasts;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].message).toBe('two');
  });
});
